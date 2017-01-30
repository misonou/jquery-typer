(function ($, Typer) {
    'use strict';

    var activeToolbar;
    var activeContextMenu;
    var timeout;

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
                $(document).unbind('paste', handler);
                if (!detectClipboardInaccessible.value) {
                    detectClipboardInaccessible.value = false;
                    callback();
                }
            });
        }
    }

    function showToolbar(toolbar, position) {
        toolbar.update();
        if (toolbar.widget || !toolbar.options.container) {
            clearTimeout(timeout);
            if (activeToolbar !== toolbar) {
                hideToolbar(true);
                activeToolbar = toolbar;
                $(toolbar.element).appendTo(document.body);
                Typer.ui.setZIndex(toolbar.element, toolbar.typer.element);
            }
            var height = $(toolbar.element).height();
            if (position) {
                toolbar.position = 'fixed';
            } else if (toolbar.position !== 'fixed') {
                var rect = (toolbar.widget || toolbar.typer).element.getBoundingClientRect();
                position = {
                    position: 'fixed',
                    left: rect.left,
                    top: Math.max(0, rect.top - height - 10)
                };
            }
            if (position) {
                var range = toolbar.typer.getSelection().getRange();
                if (range) {
                    var r = range.getClientRects()[0] || range.getBoundingClientRect();
                    if (r.top >= position.top && r.top <= position.top + height) {
                        position.top = r.bottom + 10;
                    }
                }
                $(toolbar.element).css(position);
            }
        }
    }

    function showContextMenu(contextMenu, x, y) {
        contextMenu.update();
        if (activeContextMenu !== contextMenu) {
            hideContextMenu();
            activeContextMenu = contextMenu;
            $(contextMenu.element).appendTo(document.body);
            Typer.ui.setZIndex(contextMenu.element, contextMenu.typer.element);
        }
        if (x + $(contextMenu.element).width() > $(window).width()) {
            x -= $(contextMenu.element).width();
        }
        if (y + $(contextMenu.element).height() > $(window).height()) {
            y -= $(contextMenu.element).height();
        }
        $(contextMenu.element).css({
            position: 'fixed',
            left: x,
            top: y
        });
    }

    function hideToolbar(force) {
        clearTimeout(timeout);
        if (force) {
            if (activeToolbar) {
                $(activeToolbar.element).detach();
                activeToolbar.position = '';
                activeToolbar = null;
            }
        } else {
            timeout = setTimeout(function () {
                hideToolbar(true);
            }, 100);
        }
    }

    function hideContextMenu() {
        if (activeContextMenu) {
            $(activeContextMenu.element).detach();
            activeContextMenu = null;
        }
    }

    function createToolbar(typer, options, widget, type) {
        var toolbar = Typer.ui({
            type: type || 'toolbar',
            typer: typer,
            widget: widget || null,
            theme: options.theme,
            controls: type === 'contextmenu' ? 'contextmenu' : widget ? 'toolbar:widget' : 'toolbar',
            options: options,
            controlExecuted: function (ui, self, control) {
                if (/button|dropdown/.test(control.type)) {
                    ui.typer.getSelection().focus();
                }
            }
        });
        var $elm = $(toolbar.element);
        if (options.container) {
            $elm.appendTo(options.container);
        } else {
            $elm.addClass('typer-ui-toolbar-floating');
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
                        $(document.body).unbind('mousemove', handler);
                    });
                }
            });
        }
        if (type === 'contextmenu') {
            var focusout;
            $(typer.element).bind('contextmenu', function (e) {
                e.preventDefault();
                focusout = false;
                showContextMenu(toolbar, e.clientX, e.clientY);
            });
            $elm.focusout(function (e) {
                focusout = true;
            });
            $elm.mouseup(function (e) {
                setTimeout(function () {
                    if (focusout) {
                        hideContextMenu();
                    }
                });
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
        },
        widgetInit: function (e) {
            if (Typer.ui.controls['widget:' + e.targetWidget.id]) {
                e.targetWidget.toolbar = createToolbar(e.typer, e.widget.options, e.targetWidget);
            }
        },
        focusin: function (e) {
            showToolbar(e.widget.toolbar);
        },
        focusout: function (e) {
            timeout = setTimeout(hideToolbar);
        },
        widgetFocusin: function (e) {
            if (e.targetWidget.toolbar) {
                showToolbar(e.targetWidget.toolbar);
            }
        },
        widgetFocusout: function (e) {
            showToolbar(e.widget.toolbar);
        },
        widgetDestroy: function (e) {
            if (e.targetWidget.toolbar) {
                e.targetWidget.toolbar.destroy();
                showToolbar(e.widget.toolbar);
            }
        },
        stateChange: function () {
            if (activeToolbar) {
                showToolbar(activeToolbar);
            }
        }
    };

    $(window).scroll(function () {
        if (activeToolbar) {
            showToolbar(activeToolbar);
        }
    });
    $(function () {
        $(document.body).mouseup(function (e) {
            if (activeContextMenu && !$.contains(activeContextMenu.element, e.target)) {
                hideContextMenu();
            }
        });
    });

    /* ********************************
     * Built-in Controls
     * ********************************/

    $.extend(Typer.ui.controls, {
        'contextmenu': Typer.ui.group('contextmenu:*'),
        'contextmenu:history': Typer.ui.group('history:*'),
        'contextmenu:selection': Typer.ui.group('selection:*'),
        'contextmenu:clipboard': Typer.ui.group('clipboard:*'),
        'toolbar': Typer.ui.group('toolbar:insert toolbar:* -toolbar:widget'),
        'toolbar:insert': Typer.ui.callout({
            controls: 'insert:*',
            enabled: function (toolbar) {
                return toolbar.typer.getNode(toolbar.typer.element).nodeType !== Typer.NODE_EDITABLE_INLINE;
            }
        }),
        'toolbar:widget': Typer.ui.group('', {
            requireWidget: true,
            controls: function (toolbar, self) {
                return toolbar.widget && ('widget:' + toolbar.widget.id);
            }
        }),
        'history:undo': Typer.ui.button({
            shortcut: 'ctrlZ',
            execute: function (toolbar) {
                toolbar.typer.undo();
            },
            enabled: function (toolbar) {
                return toolbar.typer.canUndo();
            }
        }),
        'history:redo': Typer.ui.button({
            shortcut: 'ctrlShiftZ',
            execute: function (toolbar) {
                toolbar.typer.redo();
            },
            enabled: function (toolbar) {
                return toolbar.typer.canRedo();
            }
        }),
        'widget:delete': Typer.ui.button({
            requireWidget: true,
            execute: function (toolbar) {
                toolbar.widget.remove();
            }
        }),
        'selection:selectAll': Typer.ui.button({
            shortcut: 'ctrlA',
            execute: function (toolbar) {
                toolbar.typer.getSelection().select(toolbar.typer.element, true);
                toolbar.typer.getSelection().focus();
            }
        }),
        'clipboard:cut': Typer.ui.button({
            shortcut: 'ctrlX',
            execute: function (toolbar) {
                toolbar.typer.getSelection().focus();
                document.execCommand('cut');
            }
        }),
        'clipboard:copy': Typer.ui.button({
            shortcut: 'ctrlC',
            execute: function (toolbar) {
                toolbar.typer.getSelection().focus();
                document.execCommand('copy');
            }
        }),
        'clipboard:paste': Typer.ui.button({
            shortcut: 'ctrlV',
            execute: function (toolbar) {
                toolbar.typer.getSelection().focus();
                document.execCommand('paste');
                detectClipboardInaccessible(function () {
                   toolbar.alert('clipboard:inaccessible');
                });
            }
        })
    });

    Typer.ui.addLabels('en', {
        'toolbar:insert': 'Insert widget',
        'history:undo': 'Undo',
        'history:redo': 'Redo',
        'selection:selectAll': 'Select all',
        'clipboard:cut': 'Cut',
        'clipboard:copy': 'Copy',
        'clipboard:paste': 'Paste',
        'clipboard:inaccessible': 'Unable to access clipboard due to browser security. Please use Ctrl+V or [Paste] from browser\'s menu.',
        'widget:delete': 'Delete'
    });

    Typer.ui.addIcons('material', {
        'toolbar:insert': '\ue1bd',      // widgets
        'history:undo': '\ue166',        // undo
        'history:redo': '\ue15a',        // redo
        'selection:selectAll': '\ue162', // select_all
        'clipboard:cut': '\ue14e',       // content_cut
        'clipboard:copy': '\ue14d',      // content_copy
        'clipboard:paste': '\ue14f',     // content_paste
        'widget:delete': '\ue872'        // delete
    });

} (jQuery, window.Typer));
