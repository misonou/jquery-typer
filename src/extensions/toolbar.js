(function ($, Typer) {
    'use strict';

    var activeToolbar;

    function nativePrompt(message, value) {
        value = window.prompt(message, value);
        if (value !== null) {
            return $.when(value);
        }
        return $.Deferred().reject().promise();
    }

    function detectClipboardInaccessible(callback) {
        if (detectClipboardInaccessible.value === false) {
            callback();
        } else if (!detectClipboardInaccessible.value) {
            var handler = function () {
                detectClipboardInaccessible.value = true;
            };
            $(document).one('paste', handler);
            setTimeout(function () {
                $(document).off('paste', handler);
                if (!detectClipboardInaccessible.value) {
                    detectClipboardInaccessible.value = false;
                    callback();
                }
            });
        }
    }

    function positionToolbar(toolbar, position) {
        var height = $(toolbar.element).height();
        if (position) {
            toolbar.position = 'fixed';
        } else if (toolbar.position !== 'fixed') {
            var rect = Typer.getRect(toolbar.widget || toolbar.typer);
            if (rect.left === 0 && rect.top === 0 && rect.width === 0 && rect.height === 0) {
                // invisible element or IE bug related - https://connect.microsoft.com/IE/feedback/details/881970
                return;
            }
            position = {
                position: 'fixed',
                left: rect.left,
                top: Math.max(0, rect.top - height - 10)
            };
        }
        if (position) {
            var r = toolbar.typer.getSelection().extendCaret.getRect();
            if (r.top >= position.top && r.top <= position.top + height) {
                position.top = r.bottom + 10;
            }
            $(toolbar.element).css(position);
        }
    }

    function showToolbar(toolbar, position) {
        toolbar.update();
        if (toolbar.widget || !toolbar.options.container) {
            if (activeToolbar !== toolbar) {
                hideToolbar();
                activeToolbar = toolbar;
                $(toolbar.element).appendTo(document.body);
                Typer.ui.setZIndex(toolbar.element, toolbar.typer.element);
            }
            positionToolbar(toolbar, position);
        }
    }

    function hideToolbar(typer) {
        if (activeToolbar && (!typer || activeToolbar.typer === typer)) {
            $(activeToolbar.element).detach();
            activeToolbar.position = '';
            activeToolbar = null;
        }
    }

    function createToolbar(typer, options, widget, type) {
        var toolbar = Typer.ui({
            type: type || 'toolbar',
            typer: typer,
            widget: widget || null,
            theme: options.theme,
            defaultNS: 'typer',
            controls: type === 'contextmenu' ? 'contextmenu' : widget ? 'widget' : 'toolbar',
            options: options,
            showButtonLabel: type === 'contextmenu',
            executed: function (ui, control) {
                if (!control.is('textbox')) {
                    ui.typer.getSelection().focus();
                }
            }
        });
        var $elm = $(toolbar.element);
        if (options.container) {
            $elm.appendTo(options.container);
        } else {
            $elm.addClass('typer-ui-float');
            $elm.mousedown(function (e) {
                var pos = $elm.position();
                if (e.target === toolbar.element) {
                    var handler = function (e1) {
                        showToolbar(toolbar, {
                            top: pos.top + (e1.clientY - e.clientY),
                            left: pos.left + (e1.clientX - e.clientX)
                        });
                    };
                    $(document.body).mousemove(handler);
                    $(document.body).mouseup(function () {
                        $(document.body).off('mousemove', handler);
                    });
                }
            });
        }
        if (type === 'contextmenu') {
            $(typer.element).on('contextmenu', function (e) {
                e.preventDefault();
                toolbar.update();
                toolbar.show({
                    x: e.clientX,
                    y: e.clientY
                });
                setTimeout(function () {
                    // fix IE11 rendering issue when mousedown on contextmenu
                    // without moving focus beforehand
                    toolbar.element.focus();
                });
            });
            $(typer.element).on('click', function (e) {
                if (e.which === 1) {
                    toolbar.hide();
                }
            });
        }
        return toolbar;
    }

    Typer.widgets.toolbar = {
        inline: true,
        options: {
            container: '',
            theme: 'material',
            formattings: {
                p: 'Paragraph',
                h1: 'Heading 1',
                h2: 'Heading 2',
                h3: 'Heading 3',
                h4: 'Heading 4'
            },
            inlineClasses: {}
        },
        init: function (e) {
            e.widget.toolbar = createToolbar(e.typer, e.widget.options);
            e.widget.contextmenu = createToolbar(e.typer, e.widget.options, null, 'contextmenu');
            e.widget.toolbars = {};
        },
        focusin: function (e) {
            showToolbar(e.widget.toolbar);
        },
        focusout: function (e) {
            hideToolbar(e.typer);
        },
        stateChange: function (e) {
            if (activeToolbar && activeToolbar.typer === e.typer) {
                var toolbar = e.widget.toolbar;
                var selection = e.typer.getSelection();
                var currentWidget = selection.focusNode.widget;
                if (currentWidget.id !== '__root__' && selection.focusNode.element === currentWidget.element) {
                    if (Typer.ui.controls['typer:widget:' + currentWidget.id]) {
                        toolbar = e.widget.toolbars[currentWidget.id] || (e.widget.toolbars[currentWidget.id] = createToolbar(e.typer, e.widget.options, currentWidget));
                        toolbar.widget = currentWidget;
                    }
                }
                showToolbar(toolbar);
            }
        }
    };

    $(window).scroll(function () {
        if (activeToolbar) {
            positionToolbar(activeToolbar);
        }
    });

    /* ********************************
     * Built-in Controls
     * ********************************/

    Typer.ui.addControls('typer', {
        'contextmenu': Typer.ui.group('history selection clipboard insert *'),
        'contextmenu:history': Typer.ui.group('typer:history:* *'),
        'contextmenu:selection': Typer.ui.group('typer:selection:* *'),
        'contextmenu:clipboard': Typer.ui.group('typer:clipboard:* *'),
        'contextmenu:insert': Typer.ui.group('typer:toolbar:insert *'),
        'toolbar': Typer.ui.group(),
        'toolbar:insert': Typer.ui.callout({
            before: '*',
            controls: 'typer:insert:*',
            requireChildControls: true
        }),
        'widget': Typer.ui.group({
            requireWidget: true,
            controls: function (toolbar, self) {
                return toolbar.widget.id + ' delete';
            }
        }),
        'history:undo': Typer.ui.button({
            before: '*',
            shortcut: 'ctrlZ',
            execute: function (toolbar) {
                toolbar.typer.undo();
            },
            enabled: function (toolbar) {
                return toolbar.typer.canUndo();
            }
        }),
        'history:redo': Typer.ui.button({
            before: '*',
            shortcut: 'ctrlShiftZ',
            execute: function (toolbar) {
                toolbar.typer.redo();
            },
            enabled: function (toolbar) {
                return toolbar.typer.canRedo();
            }
        }),
        'widget:delete': Typer.ui.button({
            after: '*',
            requireWidget: true,
            execute: function (toolbar) {
                toolbar.widget.remove();
            }
        }),
        'selection:selectAll': Typer.ui.button({
            before: '*',
            shortcut: 'ctrlA',
            execute: function (toolbar) {
                var selection = toolbar.typer.getSelection();
                selection.selectAll();
                selection.focus();
            }
        }),
        'selection:selectParagraph': Typer.ui.button({
            before: '*',
            hiddenWhenDisabled: true,
            execute: function (toolbar) {
                var selection = toolbar.typer.getSelection();
                selection.select(selection.startNode.element, 'contents');
                selection.focus();
            },
            enabled: function (toolbar) {
                return toolbar.typer.getSelection().isCaret;
            }
        }),
        'clipboard:cut': Typer.ui.button({
            before: '*',
            shortcut: 'ctrlX',
            execute: function (toolbar) {
                toolbar.typer.getSelection().focus();
                document.execCommand('cut');
            }
        }),
        'clipboard:copy': Typer.ui.button({
            before: '*',
            shortcut: 'ctrlC',
            execute: function (toolbar) {
                toolbar.typer.getSelection().focus();
                document.execCommand('copy');
            }
        }),
        'clipboard:paste': Typer.ui.button({
            before: '*',
            shortcut: 'ctrlV',
            execute: function (toolbar) {
                toolbar.typer.getSelection().focus();
                document.execCommand('paste');
                detectClipboardInaccessible(function () {
                    Typer.ui.alert('typer:clipboard:inaccessible');
                });
            }
        })
    });

    Typer.ui.addLabels('en', 'typer', {
        'toolbar:insert': 'Insert widget',
        'history:undo': 'Undo',
        'history:redo': 'Redo',
        'selection:selectAll': 'Select all',
        'selection:selectParagraph': 'Select paragraph',
        'clipboard:cut': 'Cut',
        'clipboard:copy': 'Copy',
        'clipboard:paste': 'Paste',
        'clipboard:inaccessible': 'Unable to access clipboard due to browser security. Please use Ctrl+V or [Paste] from browser\'s menu.',
        'widget:delete': 'Delete'
    });

    Typer.ui.addIcons('material', 'typer', {
        'toolbar:insert': '\ue1bd',      // widgets
        'history:undo': '\ue166',        // undo
        'history:redo': '\ue15a',        // redo
        'selection:selectAll': '\ue162', // select_all
        'clipboard:cut': '\ue14e',       // content_cut
        'clipboard:copy': '\ue14d',      // content_copy
        'clipboard:paste': '\ue14f',     // content_paste
        'widget:delete': '\ue872'        // delete
    });

}(jQuery, Typer));
