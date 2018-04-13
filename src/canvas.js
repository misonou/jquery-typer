(function ($, Typer) {
    'use strict';

    var root = document.documentElement;
    var getRect = Typer.getRect;

    var container = $('<div style="position:absolute;top:0;left:0;">')[0];
    var handles = new shim.WeakMap();
    var allLayers = {};
    var freeDiv = [];
    var state = {};
    var lastState = {};
    var mousedown = false;
    var activeTyper;
    var activeHandle;
    var hoverNode;
    var oldLayers;
    var newLayers;
    var timeout;

    function TyperCanvas() {
        state.timestamp = activeTyper.getSelection().timestamp;
        state.rect = getRect(activeTyper).translate(root.scrollLeft, root.scrollTop);
        $.extend(this, {
            typer: activeTyper,
            pointerX: state.x || 0,
            pointerY: state.y || 0,
            mousedown: mousedown,
            hoverNode: hoverNode || null,
            activeHandle: activeHandle || null,
            editorReflow: !lastState.rect || !Typer.rectEquals(lastState.rect, state.rect),
            pointerMoved: lastState.x != state.x || lastState.y != state.y,
            selectionChanged: lastState.timestamp !== state.timestamp
        });
        $.extend(lastState, state);
    }

    function TyperCanvasHandle(cursor, done) {
        this.cursor = cursor || 'pointer';
        this.done = done;
    }

    function init() {
        var repl = {
            N: 'typer-visualizer',
            G: 'background',
            S: 'selection',
            X: 'transparent'
        };
        var style = '<style>.has-N{caret-color:X;}.has-N:focus{outline:none;}.has-N::S,.has-N ::S{G:X;}.has-N::-moz-S,.has-N ::-moz-S{G:X;}@keyframes caret{0%{opacity:1;}100%{opacity:0;}}</style>';
        $(document.body).append(style.replace(/\b[A-Z]/g, function (v) {
            return repl[v] || v;
        })).append(container);

        $(container).mousedown(function (e) {
            if (e.buttons & 1) {
                activeHandle = handles.get(e.target);
                Typer.draggable(e, activeTyper.element).always(function () {
                    (activeHandle.done || $.noop).call(activeHandle);
                    activeHandle = null;
                });
                e.preventDefault();
            }
        });
        $(document.body).on('mousedown mousemove mouseup', function (e) {
            state.x = e.clientX;
            state.y = e.clientY;
            hoverNode = activeTyper && activeTyper.nodeFromPoint(state.x, state.y);
            clearTimeout(timeout);
            if (e.type === 'mousemove') {
                timeout = setTimeout(refresh, 0);
            } else {
                mousedown = e.buttons & 1;
                timeout = setTimeout(refresh, 0, true);
            }
        });
        $(window).on('scroll resize orientationchange focus', refresh);
    }

    function computeFillRects(range) {
        var start = Typer.getAbstractSide('inline-start', range.startContainer);
        var end = Typer.getAbstractSide('inline-end', range.startContainer);
        var result = [];
        $.each(Typer.getRects(range), function (i, v) {
            if (Math.abs(v[start] - v[end]) <= 1) {
                v[end] += 5;
            }
            result.forEach(function (prev) {
                if (Math.abs(v.left - prev.right) <= 1) {
                    prev.right = v.left;
                }
                if (Math.abs(v.top - prev.bottom) <= 1) {
                    prev.bottom = v.top;
                }
            });
            result.unshift(v);
        });
        return result;
    }

    function addLayer(name, callback) {
        allLayers[name] = [callback, [], {}, true];
    }

    function addObject(kind, state, rect, css, handle) {
        for (var i = 0, len = oldLayers.length; i < len; i++) {
            if (oldLayers[i].state === state && oldLayers[i].kind === kind) {
                newLayers[newLayers.length] = oldLayers.splice(i, 1)[0];
                return;
            }
        }
        newLayers[newLayers.length] = {
            kind: kind,
            state: state,
            rect: rect || ('top' in state ? state : Typer.getRect),
            css: css,
            handle: handle
        };
    }

    function refresh(force) {
        force = force === true;
        clearTimeout(timeout);
        if (activeTyper && (force || activeTyper.focused(true))) {
            var canvas = new TyperCanvas();
            if (force || canvas.editorReflow || canvas.selectionChanged || canvas.pointerMoved) {
                $.each(allLayers, function (i, v) {
                    newLayers = v[1];
                    oldLayers = newLayers.splice(0);
                    if (v[3] !== false) {
                        v[0].call(null, canvas, v[2]);
                    }
                    oldLayers.forEach(function (v) {
                        freeDiv[freeDiv.length] = $(v.dom).detach().removeAttr('style')[0];
                        handles.delete(v.dom);
                    });
                    newLayers.forEach(function (v) {
                        if (force || !v.dom || canvas.editorReflow || $.isFunction(v.rect)) {
                            var dom = v.dom || (v.dom = $(freeDiv.pop() || document.createElement('div')).appendTo(container)[0]);
                            $(dom).css($.extend({
                                position: 'absolute',
                                cursor: (v.handle || '').cursor,
                                pointerEvents: v.handle ? 'all' : 'none'
                            }, v.css, Typer.ui.cssFromRect('top' in v.rect ? v.rect : v.rect(v.state), container)));
                            handles.set(dom, v.handle);
                        }
                    });
                });
            }
        }
    }

    $.extend(TyperCanvas.prototype, {
        refresh: function () {
            setTimeout(refresh, 0, true);
        },
        toggleLayer: function (name, visible) {
            var needRefresh = false;
            name.split(' ').forEach(function (v) {
                needRefresh |= visible ^ (allLayers[v] || '')[3];
                (allLayers[v] || {})[3] = visible;
            });
            if (needRefresh) {
                setTimeout(refresh, 0, true);
            }
        },
        fill: function (range, color, handle) {
            var style = {};
            style.background = color || 'rgba(0,31,81,0.2)';
            if (range instanceof Node || 'top' in range) {
                addObject('f', range, null, style, handle);
            } else {
                var arr = [];
                Typer.iterate(activeTyper.createSelection(range).createTreeWalker(-1, function (v) {
                    if (Typer.rangeCovers(range, v.element)) {
                        arr[arr.length] = getRect(v);
                        return 2;
                    }
                    if (Typer.is(v, Typer.NODE_ANY_ALLOWTEXT)) {
                        arr.push.apply(arr, computeFillRects(Typer.createRange(range, Typer.createRange(v.element, 'content'))));
                        return 2;
                    }
                    return 1;
                }));
                arr.forEach(function (v) {
                    addObject('f', v, null, style, handle);
                });
            }
        },
        drawCaret: function (caret) {
            addObject('k', caret, null, {
                animation: 'caret 0.5s infinite alternate ease-in',
                outline: '1px solid rgba(0,31,81,0.8)'
            });
        },
        drawBorder: function (element, width, color, lineStyle, inset) {
            var style = {};
            style.border = parseFloat(width) + 'px ' + (lineStyle || 'solid') + ' ' + (color || 'black');
            style.margin = inset ? '0px' : -parseFloat(width) + 'px';
            style.boxSizing = inset ? 'border-box' : 'auto';
            addObject('b', element, null, style);
        },
        drawLine: function (x1, y1, x2, y2, width, color, lineStyle, handle) {
            var dx = x2 - x1;
            var dy = y2 - y1;
            var style = {};
            style.borderTop = parseFloat(width) + 'px ' + (lineStyle || 'solid') + ' ' + (color || 'black');
            style.transformOrigin = '0% 50%';
            style.transform = 'translateY(-50%) rotate(' + Math.atan2(dy, dx) + 'rad)';
            addObject('l', Typer.toPlainRect(x1, y1, x1 + (Math.sqrt(dy * dy + dx * dx)), y1), null, style, handle);
        },
        drawHandle: function (element, pos, size, image, handle) {
            var style = {};
            style.border = '1px solid #999';
            style.background = 'white' + (image ? ' url("' + image + '")' : '');
            size = size || 8;
            addObject('c', element, function () {
                var r = getRect(element);
                var x = Typer.ui.matchWSDelim(pos, 'left right') || 'centerX';
                var y = Typer.ui.matchWSDelim(pos, 'top bottom') || 'centerY';
                r.left -= size;
                r.top -= size;
                return Typer.toPlainRect(r[x], r[y], r[x] + size, r[y] + size);
            }, style, handle);
        }
    });

    addLayer('selection', function (canvas) {
        var selection = canvas.typer.getSelection();
        var startNode = selection.startNode;
        if (selection.isCaret) {
            if ('caretColor' in root.style) {
                canvas.drawCaret(selection.baseCaret);
            }
        } else if (Typer.is(startNode, Typer.NODE_WIDGET) === selection.focusNode) {
            canvas.fill(startNode.element);
        } else {
            canvas.fill(selection.getRange());
        }
    });

    Typer.widgets.visualizer = {
        init: function (e) {
            $(e.typer.element).addClass('has-typer-visualizer');
            if (!init.init) {
                init();
                init.init = true;
            }
        },
        focusin: function (e) {
            activeTyper = e.typer;
            Typer.ui.setZIndex(container, activeTyper.element);
            refresh(true);
        },
        focusout: function (e) {
            activeTyper = null;
            $(container).children().detach();
        },
        contentChange: function (e) {
            refresh(true);
        },
        stateChange: function (e) {
            refresh();
        }
    };

    Typer.defaultOptions.visualizer = true;

    Typer.canvas = {
        addLayer: addLayer,
        handle: function (cursor, done) {
            return new TyperCanvasHandle(cursor, done);
        }
    };

})(jQuery, Typer);
