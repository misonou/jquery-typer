(function ($, Typer) {
    'use strict';

    var ALIGN_VALUE = {
        justifyLeft: 'left',
        justifyRight: 'right',
        justifyCenter: 'center',
        justifyFull: 'justify'
    };
    var STYLE_TAGNAME = {
        bold: 'b',
        italic: 'i',
        underline: 'u',
        strikeThrough: 'strike',
        superscript: 'sup',
        subscript: 'sub'
    };
    var LIST_STYLE_TYPE = {
        '1': 'decimal',
        'A': 'upper-alpha',
        'a': 'lower-alpha',
        'I': 'upper-roman',
        'i': 'lower-roman'
    };

    var reFormat = /^([a-z\d]*)(?:\.(.+))?/i;
    var reCompatFormat = /^(p|h[1-6])(?:\.(.+))?$/i;

    function outermost(elements) {
        return elements.filter(function (v) {
            return !elements.some(function (w) {
                return $.contains(w, v);
            });
        });
    }

    function getTextAlign(element) {
        var textAlign = $(element).css('text-align');
        var direction = $(element).css('direction');
        switch (textAlign) {
            case '-webkit-left':
                return 'left';
            case '-webkit-right':
                return 'right';
            case 'start':
                return direction === 'ltr' ? 'left' : 'right';
            case 'end':
                return direction === 'ltr' ? 'right' : 'left';
            default:
                return textAlign;
        }
    }

    function computePropertyValue(elements, property) {
        var value;
        $(elements).each(function (i, v) {
            var my;
            if (property === 'textAlign') {
                my = getTextAlign(v);
            } else if (property === 'inlineClass') {
                my = $(v).attr('class') || '';
            } else {
                my = $(v).css(property);
            }
            value = (value === '' || (value && value !== my)) ? '' : my;
        });
        return value || '';
    }

    function compatibleFormatting(a, b) {
        a = a.toLowerCase();
        b = b.toLowerCase();
        return a === b || (reCompatFormat.test(a) && reCompatFormat.test(b));
    }

    function createElementWithClassName(tagName, className) {
        var element = Typer.createElement(tagName);
        if (className) {
            element.className = className;
        }
        return element;
    }

    /* ********************************
     * Commands
     * ********************************/

    function justifyCommand(tx) {
        $(tx.selection.getParagraphElements()).attr('align', ALIGN_VALUE[tx.commandName]);
        tx.trackChange(tx.selection.focusNode.element);
    }

    function inlineStyleCommand(tx) {
        if (tx.selection.isCaret) {
            tx.insertHtml(createElementWithClassName(STYLE_TAGNAME[tx.commandName]));
        } else {
            // IE will nest <sub> and <sup> elements on the subscript and superscript command
            // clear the subscript or superscript format before applying the opposite command
            if (tx.widget.subscript && tx.commandName === 'superscript') {
                tx.execCommand('subscript');
            } else if (tx.widget.superscript && tx.commandName === 'subscript') {
                tx.execCommand('superscript');
            }
            tx.execCommand(tx.commandName);
            tx.trackChange(tx.selection.focusNode.element);
        }
    }

    function listCommand(tx, type) {
        var tagName = tx.commandName === 'insertOrderedList' || type ? 'ol' : 'ul';
        var html = '<' + tagName + (type || '').replace(/^.+/, ' type="$&"') + '>';
        var filter = function (i, v) {
            return v.tagName.toLowerCase() === tagName && ($(v).attr('type') || '') === (type || '');
        };
        var lists = [];
        $.each(tx.selection.getParagraphElements(), function (i, v) {
            if (!$(v).is('ol>li,ul>li')) {
                var list = $(v).prev().filter(filter)[0] || $(v).next().filter(filter)[0] || $(html).insertAfter(v)[0];
                $(v)[Typer.comparePosition(v, list) < 0 ? 'prependTo' : 'appendTo'](list);
                tx.replaceElement(v, 'li');
                lists.push(list);
            } else if (!$(v.parentNode).filter(filter)[0]) {
                tx.replaceElement(v.parentNode, $(html)[0]);
                lists.push(v.parentNode);
            } else if ($(v).is('li') && $.inArray(v.parentNode, lists) < 0) {
                outdentCommand(tx, [v]);
            }
        });
        tx.trackChange(tx.selection.focusNode.element);
    }

    function indentCommand(tx, elements) {
        elements = elements || outermost(tx.selection.getParagraphElements());
        $.each(elements, function (i, v) {
            var list = $(v).parent('ul,ol')[0] || $(v).prev('ul,ol')[0] || $('<ul>').insertBefore(v)[0];
            var newList = list;
            if (newList === v.parentNode) {
                var prevItem = $(v).prev('li')[0] || $('<li>').insertBefore(v)[0];
                newList = $(prevItem).children('ul,ol')[0] || $(list.cloneNode(false)).appendTo(prevItem)[0];
            }
            $(tx.replaceElement(v, 'li')).appendTo(newList);
            if ($(newList).parent('li')[0]) {
                $(Typer.createTextNode('\u00a0')).insertBefore(newList);
            }
            if (!list.children[0]) {
                tx.removeElement(list);
            }
        });
    }

    function outdentCommand(tx, elements) {
        elements = elements || outermost(tx.selection.getParagraphElements());
        $.each(elements, function (i, v) {
            var list = $(v).parent('ul,ol')[0];
            var parentList = $(list).parent('li')[0];
            if ($(v).next('li')[0]) {
                if (parentList) {
                    $(list.cloneNode(false)).append($(v).nextAll()).appendTo(v);
                } else {
                    $(list.cloneNode(false)).append($(v).nextAll()).insertAfter(list);
                    $(v).children('ul,ol').insertAfter(list);
                }
            }
            if (parentList) {
                $(v).insertAfter(parentList);
                if (!Typer.trim(tx.typer.extractText(parentList))) {
                    tx.removeElement(parentList);
                }
            } else {
                $(tx.replaceElement(v, 'p')).insertAfter(list);
            }
            if (!list.children[0]) {
                tx.removeElement(list);
            }
        });
        tx.trackChange(tx.selection.focusNode.element);
    }

    Typer.widgets.inlineStyle = {
        inline: true,
        beforeStateChange: function (e) {
            var elements = e.typer.getSelection().getSelectedElements();
            $.extend(e.widget, {
                bold: Typer.ui.matchWSDelim(computePropertyValue(elements, 'fontWeight'), 'bold 700'),
                italic: computePropertyValue(elements, 'fontStyle') === 'italic',
                underline: computePropertyValue(elements, 'textDecoration') === 'underline',
                strikeThrough: computePropertyValue(elements, 'textDecoration') === 'line-through',
                superscript: !!$(elements).filter('sup')[0],
                subscript: !!$(elements).filter('sub')[0],
                inlineClass: computePropertyValue(elements, 'inlineClass')
            });
        },
        commands: {
            bold: inlineStyleCommand,
            italic: inlineStyleCommand,
            underline: inlineStyleCommand,
            strikeThrough: inlineStyleCommand,
            superscript: inlineStyleCommand,
            subscript: inlineStyleCommand,
            applyClass: function (tx, className) {
                var isCaret = tx.selection.isCaret;
                var span = createElementWithClassName('span', className);
                if (tx.selection.isCaret) {
                    tx.insertHtml(span);
                    span.appendChild(Typer.createTextNode());
                } else {
                    $(tx.selection.getSelectedTextNodes()).wrap(span);
                }
                var $elm = $(tx.selection.getSelectedElements());
                $elm.filter('span:has(span)').each(function (i, v) {
                    $(v).contents().unwrap().filter(function (i, v) {
                        return v.nodeType === 3;
                    }).wrap(createElementWithClassName('span', v.className));
                });
                $elm.filter('span[class=""],span:not([class])').contents().unwrap();
                $elm.filter('span+span').each(function (i, v) {
                    if (Typer.is(v.previousSibling, 'span.' + v.className)) {
                        $(v).contents().appendTo(v.previousSibling);
                        $(v).remove();
                    }
                });
                if (isCaret) {
                    tx.selection.select(span, -0);
                }
                tx.trackChange(tx.selection.focusNode.element);
            }
        }
    };

    Typer.widgets.formatting = {
        beforeStateChange: function (e) {
            var selection = e.typer.getSelection();
            var element = selection.getParagraphElements().slice(-1)[0];
            if ($(element).is('li')) {
                element = $(element).closest('ol, ul')[0] || element;
            }
            var tagName = element && element.tagName.toLowerCase();
            var tagNameWithClasses = tagName + ($(element).attr('class') || '').replace(/^(.)/, '.$1');
            var textAlign = computePropertyValue(selection.getSelectedElements(), 'textAlign');
            $.extend(e.widget, {
                justifyLeft: textAlign === 'left',
                justifyCenter: textAlign === 'center',
                justifyRight: textAlign === 'right',
                justifyFull: textAlign === 'justify',
                formatting: tagName,
                formattingWithClassName: tagNameWithClasses
            });
        },
        enter: function (e) {
            e.typer.invoke('insertLine');
        },
        commands: {
            justifyCenter: justifyCommand,
            justifyFull: justifyCommand,
            justifyLeft: justifyCommand,
            justifyRight: justifyCommand,
            formatting: function (tx, value) {
                var m = /^([a-z\d]*)(?:\.(.+))?/i.exec(value) || [];
                if (m[1] === 'ol' || m[1] === 'ul') {
                    tx.insertWidget('list', m[1] === 'ol' && '1');
                } else {
                    $(tx.selection.getParagraphElements()).not('li').each(function (i, v) {
                        if (m[1] && m[1] !== v.tagName.toLowerCase() && compatibleFormatting(m[1], v.tagName)) {
                            tx.replaceElement(v, createElementWithClassName(m[1] || 'p', m[2]));
                        } else {
                            v.className = m[2] || '';
                            tx.trackChange(v);
                        }
                    });
                }
            },
            insertLine: function (tx) {
                tx.insertText('\n\n');
            }
        }
    };

    Typer.widgets.lineBreak = {
        inline: true,
        shiftEnter: function (e) {
            e.typer.invoke('insertLineBreak');
        },
        commands: {
            insertLineBreak: function (tx) {
                tx.insertHtml('<br>');
            }
        }
    };

    Typer.widgets.list = {
        element: 'ul,ol',
        editable: 'ul,ol',
        insert: listCommand,
        textFlow: true,
        remove: 'keepText',
        tab: function (e) {
            e.typer.invoke('indent');
        },
        shiftTab: function (e) {
            e.typer.invoke('outdent');
        },
        init: function (e) {
            $(e.widget.element).filter('ol').attr('type-css-value', LIST_STYLE_TYPE[$(e.widget.element).attr('type')] || 'decimal');
            if ($(e.widget.element).parent('li')[0] && !e.widget.element.previousSibling) {
                $(Typer.createTextNode()).insertBefore(e.widget.element);
            }
        },
        contentChange: function (e) {
            if (!$(e.widget.element).children('li')[0]) {
                e.typer.invoke(function (tx) {
                    tx.removeElement(e.widget.element);
                });
            }
        },
        commands: {
            indent: indentCommand,
            outdent: outdentCommand
        }
    };

    $.each('formatting list inlineStyle lineBreak'.split(' '), function (i, v) {
        Typer.defaultOptions[v] = true;
    });

    /* ********************************
     * Controls
     * ********************************/

    function isEnabled(toolbar, inline) {
        var selection = toolbar.typer.getSelection();
        return !!(inline ? (selection.startNode.nodeType & (Typer.NODE_PARAGRAPH | Typer.NODE_EDITABLE_PARAGRAPH | Typer.NODE_INLINE)) : selection.getParagraphElements()[0]);
    }

    function simpleCommandButton(command, widget) {
        return Typer.ui.button({
            requireWidget: widget,
            requireCommand: command,
            execute: command,
            active: function (toolbar, self) {
                return self.widget && self.widget[command];
            },
            enabled: function (toolbar) {
                return isEnabled(toolbar, widget === 'inlineStyle');
            }
        });
    }

    function orderedListButton(type, annotation) {
        return Typer.ui.button({
            name: 'formatting:listtype:' + LIST_STYLE_TYPE[type],
            annotation: annotation,
            requireWidgetEnabled: 'list',
            value: type,
            execute: function (toolbar, self, tx) {
                tx.insertWidget('list', type);
            },
            active: function (toolbar, self) {
                return self.widget && $(self.widget.element).attr('type') === type;
            }
        });
    }

    Typer.ui.addControls('typer:toolbar', {
        formatting: Typer.ui.group('* -inlineStyleOptions -inlineStyleClear', {
            requireTyper: true,
            defaultNS: 'typer:formatting'
        })
    });

    Typer.ui.addControls('typer:formatting', {
        paragraph: Typer.ui.dropdown({
            requireWidget: 'formatting',
            requireCommand: 'formatting',
            hiddenWhenDisabled: true,
            controls: function (toolbar) {
                var definedOptions = $.map(Object.keys(toolbar.options.formattings || {}), function (v) {
                    return Typer.ui.button({
                        hiddenWhenDisabled: true,
                        value: v,
                        label: toolbar.options.formattings[v],
                        enabled: function (toolbar, self) {
                            var selection = toolbar.typer.getSelection();
                            var curElm = (selection.startNode === selection.endNode ? selection.startNode : selection.focusNode).element;
                            return !reFormat.test(self.value) || compatibleFormatting(curElm.tagName, RegExp.$1);
                        }
                    });
                });
                var fallbackOption = Typer.ui.button({
                    requireWidget: 'formatting',
                    hiddenWhenDisabled: true,
                    enabled: function (toolbar, self) {
                        for (var i = 0, len = definedOptions.length; i < len; i++) {
                            if (definedOptions[i].value === self.widget.formatting) {
                                return false;
                            }
                        }
                        self.label = 'typer:formatting:tagname:' + (reFormat.exec(self.widget.formatting) || [])[1];
                        self.value = self.widget.formatting;
                        return true;
                    }
                });
                return definedOptions.concat(fallbackOption);
            },
            execute: 'formatting',
            enabled: function (toolbar) {
                return isEnabled(toolbar, false);
            },
            stateChange: function (toolbar, self) {
                for (var i = 0, length = self.controls.length; i < length; i++) {
                    if (self.controls[i].value === self.widget.formattingWithClassName) {
                        self.value = self.widget.formattingWithClassName;
                        return;
                    }
                }
                self.value = self.widget.formatting;
            }
        }),
        inlineStyle: Typer.ui.dropdown({
            requireWidget: 'inlineStyle',
            requireCommand: 'applyClass',
            hiddenWhenDisabled: true,
            defaultNS: 'typer:formatting',
            controls: 'inlineStyleOptions inlineStyleClear',
            execute: 'applyClass',
            enabled: function (toolbar) {
                return isEnabled(toolbar, true);
            },
            stateChange: function (toolbar, self) {
                self.value = self.widget.inlineClass;
            }
        }),
        inlineStyleOptions: Typer.ui.group({
            controls: function (toolbar) {
                return $.map(Object.keys(toolbar.options.inlineClass || {}), function (v) {
                    return Typer.ui.button({
                        value: v,
                        label: toolbar.options.inlineClass[v]
                    });
                });
            }
        }),
        inlineStyleClear: Typer.ui.button({
            dropdownOption: 'exclude',
            requireWidget: 'inlineStyle',
            execute: 'applyClass'
        }),
        bold: simpleCommandButton('bold', 'inlineStyle'),
        italic: simpleCommandButton('italic', 'inlineStyle'),
        underline: simpleCommandButton('underline', 'inlineStyle'),
        strikeThrough: simpleCommandButton('strikeThrough', 'inlineStyle'),
        unorderedList: Typer.ui.button({
            requireWidgetEnabled: 'list',
            execute: function (toolbar, self, tx) {
                tx.insertWidget('list', '');
            },
            active: function (toolbar, self) {
                return self.widget && self.widget.element.tagName.toLowerCase() === 'ul';
            },
            enabled: function (toolbar) {
                return isEnabled(toolbar, false);
            }
        }),
        orderedList: Typer.ui.callout({
            requireWidgetEnabled: 'list',
            controls: [
                orderedListButton('1', '1, 2, 3, 4'),
                orderedListButton('a', 'a, b, c, d'),
                orderedListButton('A', 'A, B, C, D'),
                orderedListButton('i', 'i, ii, iii, iv'),
                orderedListButton('I', 'I, II, III, IV')
            ],
            active: function (toolbar, self) {
                return self.widget && self.widget.element.tagName.toLowerCase() === 'ol';
            },
            enabled: function (toolbar) {
                return isEnabled(toolbar, false);
            }
        }),
        indent: simpleCommandButton('indent', 'list'),
        outdent: simpleCommandButton('outdent', 'list'),
        justifyLeft: simpleCommandButton('justifyLeft', 'formatting'),
        justifyCenter: simpleCommandButton('justifyCenter', 'formatting'),
        justifyRight: simpleCommandButton('justifyRight', 'formatting'),
        justifyFull: simpleCommandButton('justifyFull', 'formatting')
    });

    Typer.ui.addLabels('en', 'typer:formatting', {
        bold: 'Bold',
        italic: 'Italic',
        underline: 'Underlined',
        strikeThrough: 'Strikethrough',
        unorderedList: 'Bullet list',
        orderedList: 'Numbered list',
        indent: 'Indent',
        outdent: 'Outdent',
        justifyLeft: 'Align left',
        justifyCenter: 'Align center',
        justifyRight: 'Align right',
        justifyFull: 'Align justified',
        paragraph: 'Formatting',
        inlineStyle: 'Text style',
        inlineStyleClear: 'Clear style'
    });

    Typer.ui.addLabels('en', 'typer:formatting:listtype', {
        'decimal': 'Decimal numbers',
        'lower-alpha': 'Alphabetically ordered list, lowercase',
        'upper-alpha': 'Alphabetically ordered list, uppercase',
        'lower-roman': 'Roman numbers, lowercase',
        'upper-roman': 'Roman numbers, uppercase'
    });

    Typer.ui.addLabels('en', 'typer:formatting:tagname', {
        p: 'Paragraph',
        h1: 'Header 1',
        h2: 'Header 2',
        h3: 'Header 3',
        h4: 'Header 4',
        h5: 'Header 5',
        h6: 'Header 6',
        table: 'Table',
        td: 'Table cell',
        th: 'Table header',
        ul: 'Unordered list',
        ol: 'Ordered list',
        li: 'List item',
        blockquote: 'Blockquote'
    });

    Typer.ui.addIcons('material', 'typer:formatting', {
        bold: '\ue238', // format_bold
        italic: '\ue23f', // format_italic
        underline: '\ue249', // format_underlined
        strikeThrough: '\ue257', // strikethrough_s
        unorderedList: '\ue241', // format_list_bulleted
        orderedList: '\ue242', // format_list_numbered
        indent: '\ue23e', // format_indent_increase
        outdent: '\ue23d', // format_indent_decrease
        justifyLeft: '\ue236', // format_align_left
        justifyCenter: '\ue234', // format_align_center
        justifyRight: '\ue237', // format_align_right
        justifyFull: '\ue235' // format_align_justify
    });

    Typer.ui.setShortcut({
        bold: 'ctrlB',
        italic: 'ctrlI',
        underline: 'ctrlU',
        justifyLeft: 'ctrlShiftL',
        justifyCenter: 'ctrlShiftE',
        justifyRight: 'ctrlShiftR'
    });

    Typer.ui.addHook('tab', function (typer) {
        if (typer.widgetEnabled('list')) {
            typer.invoke(indentCommand);
            return true;
        }
    });

}(jQuery, window.Typer));
