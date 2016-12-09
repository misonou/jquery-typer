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
        $(state.selectedElements).each(function (i, v) {
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

    /* ********************************
     * Commands
     * ********************************/

    function justifyCommand(tx) {
        $(tx.selection.paragraphElements).attr('align', ALIGN_VALUE[tx.commandName]);
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

    function insertListCommand(tx, type) {
        var tagName = tx.commandName === 'insertOrderedList' || type ? 'ol' : 'ul';
        var html = '<' + tagName + (type || '').replace(/^.+/, ' type="$&"') + '>';
        var filter = function (i, v) {
            return v.tagName.toLowerCase() === tagName && ($(v).attr('type') || '') === (type || '');
        };
        $.each(tx.selection.paragraphElements, function (i, v) {
            if (v.tagName.toLowerCase() !== 'li') {
                var list = $(v).prev().filter(filter)[0] || $(v).next().filter(filter)[0] || $(html).insertAfter(v)[0];
                $(v).wrap('<li>').contents().unwrap().parent()[Typer.comparePosition(v, list) < 0 ? 'prependTo' : 'appendTo'](list);
            } else if (!$(v.parentNode).filter(filter)[0]) {
                $(v.parentNode).wrap(html).contents().unwrap();
            }
        });
        tx.restoreSelection();
    }

    function addCommandHotKeys(name, hotkeys) {
        (hotkeys || '').replace(/(\w+):(\w+)/g, function (v, a, b) {
            Typer.widgets[name][a] = function (e) {
                e.typer.invoke(b);
            };
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
                superscript: !!selection.getSelectedElements('sup')[0],
                subscript: !!selection.getSelectedElements('sub')[0],
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
                var paragraphs = tx.selection.paragraphElements;
                $(tx.getSelectedTextNodes()).wrap(createElementWithClassName('span', className));
                $('span:has(span)', paragraphs).each(function (i, v) {
                    $(v).contents().unwrap().filter(function (i, v) {
                        return v.nodeType === 3;
                    }).wrap(createElementWithClassName('span', v.className));
                });
                $('span[class=""]', paragraphs).contents().unwrap();
                tx.restoreSelection();
            }
        }
    };
    addCommandHotKeys('inlineStyle', 'ctrlB:bold ctrlI:italic ctrlU:underline');

    Typer.widgets.formatting = {
        beforeStateChange: function (e) {
            var selection = e.typer.getSelection();
            var element = selection.paragraphElements.slice(-1)[0];
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
        commands: {
            justifyCenter: justifyCommand,
            justifyFull: justifyCommand,
            justifyLeft: justifyCommand,
            justifyRight: justifyCommand,
            formatting: function (tx, value) {
                var m = /^([^.]*)(?:\.(.+))?/.exec(value) || [];
                if (m[1] === 'ol' || m[1] === 'ul') {
                    tx.insertWidget('list', m[1] === 'ol' && '1');
                } else {
                    $(tx.selection.paragraphElements).not('li').wrap(createElementWithClassName(m[1] || 'p', m[2])).contents().unwrap();
                }
                tx.restoreSelection();
            },
            insertLine: function (tx) {
                var selection = tx.selection;
                var nextElm = selection.isCaret && (selection.textEnd && $(selection.startTextNode).next('br')[0]) || (selection.textStart && $(selection.startTextNode).prev('br')[0]);
                tx.insertText('\n\n');
                if (nextElm) {
                    tx.remove(nextElm);
                }
            }
        }
    };
    addCommandHotKeys('formatting', 'enter:insertLine ctrlShiftL:justifyLeft ctrlShiftE:justifyCenter ctrlShiftR:justifyRight');

    Typer.widgets.lineBreak = {
        inline: true,
        commands: {
            insertLineBreak: function (tx) {
                tx.insertHtml('<br>' + (tx.selection.textEnd ? Typer.ZWSP_ENTITIY : ''));
            }
        }
    };
    addCommandHotKeys('lineBreak', 'shiftEnter:insertLineBreak');

    Typer.widgets.list = {
        element: 'ul,ol',
        editable: 'ul,ol',
        insert: insertListCommand,
        beforeStateChange: function (e) {
            var tagName = e.widget.element.tagName.toLowerCase();
            $.extend(e.widget, {
                insertUnorderedList: tagName === 'ul',
                insertOrderedList: tagName === 'ol',
                listType: $(e.widget.element).attr('type') || ''
            });
        },
        commands: {
            indent: function (tx) {
                $.each(tx.selection.paragraphElements, function (i, v) {
                    var list = $(v.parentNode).filter('ul,ol')[0];
                    var prevItem = $(v).prev('li')[0] || $('<li>').insertBefore(v)[0];
                    var newList = $(prevItem).children('ul,ol')[0] || $(list.cloneNode(false)).appendTo(prevItem)[0];
                    $('<li>').append(v.childNodes).appendTo(newList);
                    tx.remove(v);
                    if ($(newList).parent('li')[0] && !newList.previousSibling) {
                        $(Typer.createTextNode()).insertBefore(newList);
                    }
                });
                tx.restoreSelection();
            },
            outdent: function (tx) {
                $.each(tx.selection.paragraphElements, function (i, v) {
                    var list = $(v.parentNode).filter('ul,ol')[0];
                    var parentList = $(list).parent('li')[0];
                    if ($(v).next('li')[0]) {
                        if (parentList) {
                            $(list.cloneNode(false)).append($(v).nextAll()).appendTo(v);
                        } else {
                            $(list.cloneNode(false)).append($(v).nextAll()).insertAfter(list);
                            $(v).children('ul,ol').insertAfter(list);
                        }
                    }
                    $(createElementWithClassName(parentList ? 'li' : 'p')).append(v.childNodes).insertAfter(parentList || list);
                    tx.remove(v);
                });
                tx.restoreSelection();
            }
        }
    };

    $.each('formatting list inlineStyle lineBreak'.split(' '), function (i, v) {
        Typer.defaultOptions[v] = true;
    });

    /* ********************************
     * Controls
     * ********************************/

    var simpleCommandButton = Typer.ui.button.extend(function (command, widget) {
        this._super({
            requireWidget: widget,
            requireCommand: command,
            execute: command,
            active: function (toolbar, self) {
                return self.widget && self.widget[command];
            },
            enabled: function (toolbar, self) {
                return (command !== 'indent' && command !== 'outdent') || (self.widget);
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
            rqeuireTyper: true,
            enabled: function (toolbar) {
                return !!toolbar.typer.getSelection().paragraphElements[0];
            }
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
        'formatting:unorderedList': 'Bullet List',
        'formatting:orderedList': 'Numbered List',
        'formatting:indent': 'Indent',
        'formatting:outdent': 'Outdent',
        'formatting:justifyLeft': 'Align Left',
        'formatting:justifyCenter': 'Align Center',
        'formatting:justifyRight': 'Align Right',
        'formatting:justifyFull': 'Align Justified',
        'formatting:paragraph': 'Formatting',
        'formatting:inlineStyle': 'Text Style',
        'formatting:orderedList:1': 'Decimal numbers',
        'formatting:orderedList:a': 'Alphabetically ordered list, lowercase',
        'formatting:orderedList:A': 'Alphabetically ordered list, uppercase',
        'formatting:orderedList:i': 'Roman numbers, lowercase',
        'formatting:orderedList:I': 'Roman numbers, uppercase',
    });

    Typer.ui.addIcons('material', {
        'formatting:bold': 'format_bold',
        'formatting:italic': 'format_italic',
        'formatting:underline': 'format_underlined',
        'formatting:strikeThrough': 'strikethrough_s',
        'formatting:unorderedList': 'format_list_bulleted',
        'formatting:orderedList': 'format_list_numbered',
        'formatting:indent': 'format_indent_increase',
        'formatting:outdent': 'format_indent_decrease',
        'formatting:justifyLeft': 'format_align_left',
        'formatting:justifyCenter': 'format_align_center',
        'formatting:justifyRight': 'format_align_right',
        'formatting:justifyFull': 'format_align_justify'
    });

} (jQuery, window.Typer));
