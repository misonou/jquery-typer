(function ($, Typer) {
    'use strict';

    var INNER_PTAG = 'h1,h2,h3,h4,h5,h6,p,ul,ol,li,q,blockquote,pre,code';
    var OUTER_PTAG = 'ul,ol';

    var aligns = {
        justifyLeft: 'left',
        justifyRight: 'right',
        justifyCenter: 'center',
        justifyFull: 'justify'
    };

    var inlineStyleTagNames = {
        bold: 'b',
        italic: 'i',
        underline: 'u',
        superscript: 'sup',
        subscript: 'sub'
    };

    function justifyCommand(tx) {
        $(tx.selection.paragraphElements).attr('align', aligns[tx.commandName]);
    }

    function inlineStyleCommand(tx) {
        if (tx.selection.isCaret) {
            tx.insertHtml(Typer.createElement(inlineStyleTagNames[tx.commandName]));
        } else {
            // IE will nest <sub> and <sup> elements on the subscript and superscript command
            // clear the subscript or superscript format before applying the opposite command
            if (tx.selection.subscript && tx.commandName === 'superscript') {
                tx.execCommand('subscript');
            } else if (tx.selection.superscript && tx.commandName === 'subscript') {
                tx.execCommand('superscript');
            }
            tx.execCommand(tx.commandName);
        }
    }

    function insertListCommand(tx, tagName, className) {
        tagName = tagName || (tx.commandName === 'insertOrderedList' ? 'ol' : 'ul');
        $.each(tx.selection.paragraphElements, function (i, v) {
            var selector = tagName + (className || '').replace(/^(.)/, '.$1');
            if (v.tagName.toLowerCase() !== 'li') {
                var list = $(v).prev(selector)[0] || $(v).next(selector)[0] || $(Typer.createElement(tagName, className)).insertAfter(v)[0];
                $(v).wrap('<li>').contents().unwrap().parent()[Typer.comparePosition(v, list) < 0 ? 'prependTo' : 'appendTo'](list);
            } else if (!$(v.parentNode).is(selector)) {
                $(v.parentNode).wrap(Typer.createElement(tagName, className)).contents().unwrap();
            }
        });
        tx.restoreSelection();
    }

    function addCommandWidget(name, commands, hotkeys) {
        Typer.widgets[name] = {
            commands: commands
        };
        Typer.defaultOptions[name] = true;
        (hotkeys || '').replace(/(\w+):(\w+)/g, function (v, a, b) {
            Typer.widgets[name][a] = function (e) {
                e.typer.invoke(b);
            };
        });
    }

    addCommandWidget('inlineStyle', {
        bold: inlineStyleCommand,
        italic: inlineStyleCommand,
        underline: inlineStyleCommand,
        superscript: inlineStyleCommand,
        subscript: inlineStyleCommand,
        applyClass: function (tx, className) {
            var paragraphs = tx.selection.paragraphElements;
            $(tx.getSelectedTextNodes()).wrap(Typer.createElement('span', className));
            $('span:has(span)', paragraphs).each(function (i, v) {
                $(v).contents().unwrap().filter(function (i, v) {
                    return v.nodeType === 3;
                }).wrap(Typer.createElement('span', v.className));
            });
            $('span[class=""]', paragraphs).contents().unwrap();
            tx.restoreSelection();
        }
    }, 'ctrlB:bold ctrlI:italic ctrlU:underline');

    addCommandWidget('formatting', {
        justifyCenter: justifyCommand,
        justifyFull: justifyCommand,
        justifyLeft: justifyCommand,
        justifyRight: justifyCommand,
        formatting: function (tx, value) {
            var m = /^([^.]*)(?:\.(.+))?/.exec(value) || [];
            if (m[1] === 'ol' || m[1] === 'ul') {
                insertListCommand(tx, m[1], m[2]);
            } else {
                $(tx.selection.paragraphElements).not('li').wrap(Typer.createElement(m[1] || 'p', m[2])).contents().unwrap();
            }
            tx.restoreSelection();
        },
        insertLine: function (tx) {
            tx.insertText('\n\n');
        }
    }, 'enter:insertLine ctrlShiftL:justifyLeft ctrlShiftE:justifyCenter ctrlShiftR:justifyRight');

    addCommandWidget('lineBreak', {
        insertLineBreak: function (tx) {
            tx.insertHtml('<br>' + (tx.selection.textEnd ? Typer.ZWSP_ENTITIY : ''));
        }
    }, 'shiftEnter:insertLineBreak');

    addCommandWidget('list', {
        insertOrderedList: insertListCommand,
        insertUnorderedList: insertListCommand,
        indent: function (tx) {
            $.each(tx.selection.paragraphElements, function (i, v) {
                var list = $(v.parentNode).filter(OUTER_PTAG)[0];
                var prevItem = $(v).prev('li')[0] || $('<li>').insertBefore(v)[0];
                var newList = $(prevItem).children(OUTER_PTAG)[0] || $(list.cloneNode(false)).appendTo(prevItem)[0];
                $('<li>').append(v.childNodes).appendTo(newList);
                tx.remove(v);
            });
        },
        outdent: function (tx) {
            $.each(tx.selection.paragraphElements, function (i, v) {
                var list = $(v.parentNode).filter(OUTER_PTAG)[0];
                var parentList = $(list).parent('li')[0];
                if ($(v).next('li')[0]) {
                    if (parentList) {
                        $(list.cloneNode(false)).append($(v).nextAll()).appendTo(v);
                    } else {
                        $(list.cloneNode(false)).append($(v).nextAll()).insertAfter(list);
                        $(v).children(OUTER_PTAG).insertAfter(list);
                    }
                }
                $(Typer.createElement(parentList ? 'li' : 'p')).append(v.childNodes).insertAfter(parentList || list);
                tx.remove(v);
            });
        },
    });

    addCommandWidget('link', {
        createLink: function (tx, value) {
            value = value || (/^[a-z]+:\/\//g.test(tx.getSelectedText()) && RegExp.input) || '#';
            tx.select(tx.selection.getSelectedElements('a')[0] || tx.selection);
            tx.execCommand('createLink', value);
        },
        unlink: function (tx) {
            var linkElement = tx.selection.getSelectedElements('a')[0];
            if (linkElement) {
                tx.select(linkElement);
                tx.execCommand('unlink');
            }
        }
    });
    
    $.each('inlineStyle lineBreak link'.split(' '), function (i, v) {
        Typer.widgets[v].inline = true;
    });

} (jQuery, window.Typer));
