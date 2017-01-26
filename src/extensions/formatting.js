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

    function computePropertyValue(state, property) {
        var value;
        $(state.getSelectedElements()).each(function (i, v) {
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

    function createElementWithClassName(tagName, className) {
        var element = Typer.createElement(tagName);
        if (className) {
            element.className = className;
        }
        return element;
    }

    function removeParagraph(element) {
        if ($(element).is('li:only-child')) {
            element = element.parentNode;
        }
        $(element).remove();
    }

    function indentParagraph(element) {
        var list = $(element).parent('ul,ol')[0] || $(element).prev('ul,ol')[0] || $('<ul>').insertBefore(element)[0];
        var newList = list;
        if (newList === element.parentNode) {
            var prevItem = $(element).prev('li')[0] || $('<li>').insertBefore(element)[0];
            newList = $(prevItem).children('ul,ol')[0] || $(list.cloneNode(false)).appendTo(prevItem)[0];
        }
        $('<li>').append(element.childNodes).appendTo(newList);
        removeParagraph(element);
        if ($(newList).parent('li')[0] && !newList.previousSibling) {
            $(Typer.createTextNode()).insertBefore(newList);
        }
    }

    function outdentParagraph(element) {
        var list = $(element).parent('ul,ol')[0];
        var parentList = $(list).parent('li')[0];
        if ($(element).next('li')[0]) {
            if (parentList) {
                $(list.cloneNode(false)).append($(element).nextAll()).appendTo(element);
            } else {
                $(list.cloneNode(false)).append($(element).nextAll()).insertAfter(list);
                $(element).children('ul,ol').insertAfter(list);
            }
        }
        $(createElementWithClassName(parentList ? 'li' : 'p')).append(element.childNodes).insertAfter(parentList || list);
        removeParagraph(element);
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
                $(v)[Typer.comparePosition(v, list) < 0 ? 'prependTo' : 'appendTo'](list).wrap('<li>').contents().unwrap();
                lists.push(list);
            } else if (!$(v.parentNode).filter(filter)[0]) {
                $(v.parentNode).wrap(html).contents().unwrap();
                lists.push(v.parentNode);
            } else if (tx.selection.focusNode.widget.id === 'list' && $.inArray(v.parentNode, lists) < 0) {
                outdentParagraph(v);
            }
        });
    }

    Typer.widgets.inlineStyle = {
        inline: true,
        beforeStateChange: function (e) {
            var selection = e.typer.getSelection();
            $.extend(e.widget, {
                bold: /bold|700/.test(computePropertyValue(selection, 'fontWeight')),
                italic: computePropertyValue(selection, 'fontStyle') === 'italic',
                underline: computePropertyValue(selection, 'textDecoration') === 'underline',
                strikeThrough: computePropertyValue(selection, 'textDecoration') === 'line-through',
                superscript: !!$(selection.getSelectedElements()).filter('sup')[0],
                subscript: !!$(selection.getSelectedElements()).filter('sub')[0],
                inlineClass: computePropertyValue(selection, 'inlineClass')
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
            var textAlign = computePropertyValue(selection, 'textAlign');
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
                    $(tx.selection.getParagraphElements()).not('li').wrap(createElementWithClassName(m[1] || 'p', m[2])).contents().unwrap();
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
        commands: {
            indent: function (tx) {
                $.map(tx.selection.getParagraphElements(), indentParagraph);
            },
            outdent: function (tx) {
                $.map(tx.selection.getParagraphElements(), outdentParagraph);
            }
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
            requireCommand: 'formatting',
            hiddenWhenDisabled: true,
            controls: function (toolbar) {
                return $.map(Object.keys(toolbar.options.formattings || {}), function (v) {
                    return Typer.ui.button({
                        requireWidget: 'formatting',
                        execute: 'formatting',
                        value: v,
                        label: toolbar.options.formattings[v],
                        active: function (toolbar, self) {
                            return self.widget.formattingWithClassName === v || self.widget.formatting === v;
                        }
                    });
                });
            },
            enabled: function (toolbar) {
                return isEnabled(toolbar, false);
            }
        }),
        'formatting:inlineStyle': Typer.ui.dropdown({
            requireCommand: 'applyClass',
            hiddenWhenDisabled: true,
            controls: function (toolbar) {
                return $.map(Object.keys(toolbar.options.inlineClass || {}), function (v) {
                    return Typer.ui.button({
                        requireWidget: 'inlineStyle',
                        execute: 'applyClass',
                        value: v,
                        label: toolbar.options.inlineClass[v],
                        active: function (toolbar, self) {
                            return self.widget.inlineClass === v;
                        }
                    });
                });
            },
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
            typer.invoke(function (tx) {
                $.map(tx.selection.getParagraphElements(), indentParagraph);
            });
            return true;
        }
    });

} (jQuery, window.Typer));
