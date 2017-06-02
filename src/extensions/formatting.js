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
                my = $(v).filter('span').attr('class') || '';
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
                Typer.replaceElement(v, 'li');
                lists.push(list);
            } else if (!$(v.parentNode).filter(filter)[0]) {
                Typer.replaceElement(v.parentNode, $(html)[0]);
                lists.push(v.parentNode);
            } else if ($(v).is('li') && $.inArray(v.parentNode, lists) < 0) {
                outdentCommand(tx, [v]);
            }
        });
    }

    function indentCommand(tx, elements) {
        elements = elements || Typer.outermost(tx.selection.getParagraphElements());
        $.each(elements, function (i, v) {
            var list = $(v).parent('ul,ol')[0] || $(v).prev('ul,ol')[0] || $('<ul>').insertBefore(v)[0];
            var newList = list;
            if (newList === v.parentNode) {
                var prevItem = $(v).prev('li')[0] || $('<li>').insertBefore(v)[0];
                newList = $(prevItem).children('ul,ol')[0] || $(list.cloneNode(false)).appendTo(prevItem)[0];
            }
            $(Typer.replaceElement(v, 'li')).appendTo(newList);
            if ($(newList).parent('li')[0]) {
                $(Typer.createTextNode('\u00a0')).insertBefore(newList);
            }
            if (!list.children[0]) {
                Typer.removeElement(list);
            }
        });
    }

    function outdentCommand(tx, elements) {
        elements = elements || Typer.outermost(tx.selection.getParagraphElements());
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
                    Typer.removeElement(parentList);
                }
            } else {
                $(Typer.replaceElement(v, 'p')).insertAfter(list);
            }
            if (!list.children[0]) {
                Typer.removeElement(list);
            }
        });
    }

    Typer.widgets.inlineStyle = {
        inline: true,
        beforeStateChange: function (e) {
            var selection = e.typer.getSelection();
            var elements = selection.getSelectedElements();
            $.extend(e.widget, {
                bold: /bold|700/.test(computePropertyValue(elements, 'fontWeight')),
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
                var paragraphs = tx.selection.getParagraphElements();
                $(tx.selection.getSelectedTextNodes()).wrap(createElementWithClassName('span', className));
                $('span:has(span)', paragraphs).each(function (i, v) {
                    $(v).contents().unwrap().filter(function (i, v) {
                        return v.nodeType === 3;
                    }).wrap(createElementWithClassName('span', v.className));
                });
                $('span[class=""]', paragraphs).contents().unwrap();
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
                            Typer.replaceElement(v, createElementWithClassName(m[1] || 'p', m[2]));
                        } else {
                            v.className = m[2];
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
                Typer.removeElement(e.widget.element);
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

    var simpleCommandButton = Typer.ui.button.extend(function (command, widget) {
        this._super({
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
    });
    var orderedListButton = Typer.ui.button.extend(function (type, annotation) {
        this._super({
            name: 'formatting:orderedList:' + type,
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
    });

    $.extend(Typer.ui.controls, {
        'toolbar:formatting': Typer.ui.group('formatting:*', {
            requireTyper: true
        }),
        'formatting:paragraph': Typer.ui.dropdown({
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
                            var myElm = (reFormat.exec(self.value) || [])[1];
                            return !myElm || compatibleFormatting(curElm.tagName, myElm);
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
                        self.label = 'formatting:name:' + (reFormat.exec(self.widget.formatting) || [])[1];
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
        'formatting:inlineStyle': Typer.ui.dropdown({
            requireWidget: 'inlineStyle',
            requireCommand: 'applyClass',
            hiddenWhenDisabled: true,
            controls: function (toolbar) {
                return $.map(Object.keys(toolbar.options.inlineClass || {}), function (v) {
                    return Typer.ui.button({
                        value: v,
                        label: toolbar.options.inlineClass[v]
                    });
                });
            },
            execute: 'applyClass',
            enabled: function (toolbar) {
                return isEnabled(toolbar, true);
            }
        }),
        'formatting:bold': simpleCommandButton('bold', 'inlineStyle'),
        'formatting:italic': simpleCommandButton('italic', 'inlineStyle'),
        'formatting:underline': simpleCommandButton('underline', 'inlineStyle'),
        'formatting:strikeThrough': simpleCommandButton('strikeThrough', 'inlineStyle'),
        'formatting:unorderedList': Typer.ui.button({
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
        'formatting:orderedList': Typer.ui.callout({
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
        'formatting:indent': simpleCommandButton('indent', 'list'),
        'formatting:outdent': simpleCommandButton('outdent', 'list'),
        'formatting:justifyLeft': simpleCommandButton('justifyLeft', 'formatting'),
        'formatting:justifyCenter': simpleCommandButton('justifyCenter', 'formatting'),
        'formatting:justifyRight': simpleCommandButton('justifyRight', 'formatting'),
        'formatting:justifyFull': simpleCommandButton('justifyFull', 'formatting')
    });

    /* ********************************
     * Resources
     * ********************************/

    Typer.ui.addLabels('en', {
        'formatting:bold': 'Bold',
        'formatting:italic': 'Italic',
        'formatting:underline': 'Underlined',
        'formatting:strikeThrough': 'Strikethrough',
        'formatting:unorderedList': 'Bullet list',
        'formatting:orderedList': 'Numbered list',
        'formatting:indent': 'Indent',
        'formatting:outdent': 'Outdent',
        'formatting:justifyLeft': 'Align left',
        'formatting:justifyCenter': 'Align center',
        'formatting:justifyRight': 'Align right',
        'formatting:justifyFull': 'Align justified',
        'formatting:paragraph': 'Formatting',
        'formatting:inlineStyle': 'Text style',
        'formatting:orderedList:1': 'Decimal numbers',
        'formatting:orderedList:a': 'Alphabetically ordered list, lowercase',
        'formatting:orderedList:A': 'Alphabetically ordered list, uppercase',
        'formatting:orderedList:i': 'Roman numbers, lowercase',
        'formatting:orderedList:I': 'Roman numbers, uppercase',
        'formatting:name:p': 'Paragraph',
        'formatting:name:h1': 'Header 1',
        'formatting:name:h2': 'Header 2',
        'formatting:name:h3': 'Header 3',
        'formatting:name:h4': 'Header 4',
        'formatting:name:h5': 'Header 5',
        'formatting:name:h6': 'Header 6',
        'formatting:name:td': 'Table cell',
        'formatting:name:th': 'Table header',
        'formatting:name:ul': 'Unordered list',
        'formatting:name:ol': 'Ordered list',
        'formatting:name:li': 'List item',
        'formatting:name:blockquote': 'Blockquote'
    });

    Typer.ui.addIcons('material', {
        'formatting:bold': '\ue238',          // format_bold
        'formatting:italic': '\ue23f',        // format_italic
        'formatting:underline': '\ue249',     // format_underlined
        'formatting:strikeThrough': '\ue257', // strikethrough_s
        'formatting:unorderedList': '\ue241', // format_list_bulleted
        'formatting:orderedList': '\ue242',   // format_list_numbered
        'formatting:indent': '\ue23e',        // format_indent_increase
        'formatting:outdent': '\ue23d',       // format_indent_decrease
        'formatting:justifyLeft': '\ue236',   // format_align_left
        'formatting:justifyCenter': '\ue234', // format_align_center
        'formatting:justifyRight': '\ue237',  // format_align_right
        'formatting:justifyFull': '\ue235'    // format_align_justify
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

} (jQuery, window.Typer));
