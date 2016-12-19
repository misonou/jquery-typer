(function ($, Typer) {
    'use strict';

    var activeToolbar;
    var timeout;

    function nativePrompt(message, value) {
        value = window.prompt(message, value);
        if (value !== null) {
            return $.when(value);
        }
        return $.Deferred().reject().promise();
    }

    function showToolbar(toolbar, position) {
        if (toolbar.widget || !toolbar.options.container) {
            clearTimeout(timeout);
            if (activeToolbar !== toolbar) {
                hideToolbar(true);
                activeToolbar = toolbar;
                $(toolbar.element).appendTo(document.body);
            }
            if (position) {
                toolbar.position = 'fixed';
                $(toolbar.element).css(position);
            } else if (toolbar.position !== 'fixed') {
                var rect = (toolbar.widget || toolbar.typer).element.getBoundingClientRect();
                var height = $(toolbar.element).height();

                if (rect.top + rect.height > document.body.offsetHeight) {
                    toolbar.position = '';
                } else if (rect.top < height) {
                    toolbar.position = 'bottom';
                }
                $(toolbar.element).css({
                    left: rect.left + $(window).scrollLeft(),
                    top: (toolbar.position === 'bottom' ? Math.min((rect.top + rect.height) + 10, $(window).height() - height - 10) : Math.max(0, rect.top - height - 10)) + $(window).scrollTop()
                });
            }
        }
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

    function createToolbar(typer, options, widget) {
        var toolbar = Typer.ui({
            type: 'toolbar',
            typer: typer,
            widget: widget || null,
            theme: options.theme,
            controls: widget ? 'toolbar:widget' : 'toolbar',
            options: options
        });
        var $elm = $(toolbar.element).addClass('typer-ui-toolbar');
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
            e.widget.state = e.widget.toolbar.state = {};
        },
        widgetInit: function (e, widget) {
            widget.toolbar = createToolbar(e.typer, e.widget.options, widget);
        },
        focusin: function (e) {
            showToolbar(e.widget.toolbar);
        },
        focusout: function (e) {
            setTimeout(hideToolbar);
        },
        widgetFocusin: function (e, widget) {
            if (widget.toolbar.all['toolbar:widget'].controls[0]) {
                widget.toolbar.update();
                showToolbar(widget.toolbar);
            }
        },
        widgetFocusout: function (e, widget) {
            showToolbar(e.widget.toolbar);
        },
        widgetDestroy: function (e, widget) {
            if (widget.toolbar) {
                widget.toolbar.destroy();
                showToolbar(e.widget.toolbar);
            }
        },
        stateChange: function () {
            if (activeToolbar) {
                activeToolbar.update();
                showToolbar(activeToolbar);
            }
        }
    };

    $(window).scroll(function () {
        if (activeToolbar) {
            showToolbar(activeToolbar);
        }
    });

    /* ********************************
     * Built-in Controls
     * ********************************/

    $.extend(Typer.ui.controls, {
        'toolbar': Typer.ui.group('toolbar:history toolbar:insert toolbar:* -toolbar:widget'),
        'toolbar:history': Typer.ui.group('history:*'),
        'toolbar:insert': Typer.ui.callout({
            controls: 'insert:*',
            enabled: function (toolbar) {
                return toolbar.typer.document.rootNode.nodeType !== Typer.NODE_EDITABLE_INLINE;
            }
        }),
        'toolbar:widget': Typer.ui.group('', {
            requireWidget: true,
            controls: function (toolbar, self) {
                return toolbar.widget && ('widget:' + toolbar.widget.id);
            }
        }),
        'history:undo': Typer.ui.button({
            execute: function (toolbar) {
                toolbar.typer.undo();
            },
            enabled: function (toolbar) {
                return toolbar.typer.canUndo();
            }
        }),
        'history:redo': Typer.ui.button({
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
    });

    Typer.ui.addLabels('en', {
        'toolbar:insert': 'Insert Widget',
        'history:undo': 'Undo',
        'history:redo': 'Redo',
        'widget:delete': 'Delete'
    });

    Typer.ui.addIcons('material', {
        'toolbar:insert': 'widgets',
        'history:undo': 'undo',
        'history:redo': 'redo',
        'widget:delete': 'delete'
    });

} (jQuery, window.Typer));
