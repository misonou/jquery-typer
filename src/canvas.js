(function ($, Typer) {
    'use strict';

    var root = document.documentElement;
    var getRect = Typer.getRect;
    var parseFloat = window.parseFloat;
    var allLayers = {};
    var pointerRegions = [];
    var freeDiv = [];
    var state = {};
    var lastState = {};
    var activeTyper;
    var oldLayers;
    var newLayers;
    var container;
    var timeout;

    function TyperCanvas() {
        state.timestamp = activeTyper.getSelection().timestamp;
        state.rect = toAbsolute(getRect(activeTyper.element));
        $.extend(this, {
            typer: activeTyper,
            pointerX: state.x || 0,
            pointerY: state.y || 0,
            mousedown: state.mousedown,
            editorReflow: !lastState.rect || !Typer.rectEquals(lastState.rect, state.rect),
            pointerMoved: lastState.x != state.x || lastState.y != state.y,
            selectionChanged: lastState.timestamp !== state.timestamp
        });
        $.extend(lastState, state);
    }

    function init() {
        var repl = {
            N: 'typer-visualizer',
            E: 'before',
            F: 'after',
            G: 'background',
            S: 'selection',
            X: 'transparent'
        };
        var style =
            '.has-N{caret-color:X;}' +
            '.has-N:focus{outline:none;}' +
            '.has-N::S,.has-N ::S{G:X;}' +
            '.has-N::-moz-S,.has-N ::-moz-S{G:X;}' +
            '.N{position:absolute;T:0;L:0;font-family:serif;font-size:12px;}' +
            '.N>div{position:absolute;pointer-events:none;}' +
            '.N>.k{animation:caret 0.5s infinite alternate ease-in;outline:1px solid rgba(0,31,81,0.8);}' +
            '.N>.c{pointer-events:all;border:1px solid black;G:white;}' +
            '.N>.f{G:rgba(0,31,81,0.2);}' +
            '.N>.m:E{content:"\\0000b6";position:absolute;top:50%;margin-top:-0.5em;left:4px;color:rgba(0,0,0,0.5);line-height:1;text-shadow:0 0 1px white,0 0 2px white;}' +
            '.N>.m-br:E{content:"\\0021a9";}' +
            '@keyframes caret{0%{opacity:1;}100%{opacity:0;}}';
        $(document.body).append('<style>' + style.replace(/\b[A-Z]/g, function (v) {
            return repl[v] || v;
        }) + '</style>');
        container = $('<div class="typer-ui typer-visualizer">').appendTo(document.body)[0];

        $(window).on('scroll resize orientationchange focus', refresh);
        $(document.body).on('mousewheel mousedown mouseup keyup', refresh);

        $(document.body).mousedown(function (e) {
            $.each(pointerRegions, function (i, v) {
                if (Typer.pointInRect(e.clientX, e.clientY, toFixed(v.rect))) {
                    var promise = handlePointer(e);
                    v.handler(promise);
                    promise.always(function () {
                        if (activeTyper) {
                            activeTyper.getSelection().focus();
                        }
                    });
                    e.preventDefault();
                    return false;
                }
            });
        });
        $(document.body).mousemove(function (e) {
            timeout = setTimeout(refresh);
            $.extend(state, {
                x: e.clientX,
                y: e.clientY,
                mousedown: !!(e.buttons & 1)
            });
        });
    }

    function toAbsolute(rect) {
        return rect.translate(root.scrollLeft, root.scrollTop);
    }

    function toFixed(rect) {
        return rect.translate(-root.scrollLeft, -root.scrollTop);
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

    function handlePointer(e) {
        var deferred = $.Deferred();
        var handlers = {};
        var hasMoved;

        handlers.mousemove = function (e) {
            if (!e.which) {
                handlers.mouseup();
            } else if (lastState.x != state.x || lastState.y != state.y) {
                hasMoved = true;
                deferred.notify(e);
            }
        };
        handlers.mouseup = function () {
            $(document.body).off(handlers);
            deferred.resolve(hasMoved);
        };
        if (e.which === 1) {
            $(document.body).on(handlers);
        } else {
            deferred.reject();
        }
        return deferred.promise();
    }

    function addLayer(name, callback) {
        allLayers[name] = [callback, []];
    }

    function addObject(kind, state, callback, handler) {
        for (var i = 0, len = oldLayers.length; i < len; i++) {
            if (oldLayers[i].state === state && oldLayers[i].kind === kind) {
                newLayers[newLayers.length] = oldLayers.splice(i, 1)[0];
                return;
            }
        }
        newLayers[newLayers.length] = {
            kind: kind,
            state: state,
            callback: $.isFunction(callback) ? callback : paint.bind(null, kind, state, callback, handler)
        };
    }

    function paint(className, rect, extraCSS, handler) {
        newLayers[newLayers.length] = {
            className: className,
            rect: toAbsolute('top' in rect ? rect : getRect(rect)),
            css: extraCSS,
            handler: handler
        };
    }

    function freeUnusedDOM(layers) {
        layers.forEach(function (v) {
            freeDiv[freeDiv.length] = $(v).detach().removeAttr('style')[0];
        });
    }

    function refresh(force) {
        clearTimeout(timeout);
        if (activeTyper && document.activeElement === activeTyper.element) {
            var canvas = new TyperCanvas();
            if (canvas.editorReflow || canvas.selectionChanged || canvas.pointerMoved) {
                pointerRegions.splice(0);
                $.each(allLayers, function (i, v) {
                    newLayers = v[1];
                    oldLayers = [];
                    v[0].call(null, canvas);
                    oldLayers.forEach(function (v) {
                        freeUnusedDOM(v.dom || []);
                    });
                    newLayers.forEach(function (v) {
                        if (!v.dom || canvas.editorReflow || force === true) {
                            var arr = v.dom || (v.dom = []);
                            newLayers = v.layers = [];
                            v.callback(v.state);
                            freeUnusedDOM(arr.splice(newLayers.length));
                            newLayers.forEach(function (v, i) {
                                var dom = arr[i] || (arr[i] = $(freeDiv.pop() || document.createElement('div')).appendTo(container)[0]);
                                dom.className = v.className;
                                $(dom).css($.extend(Typer.ui.cssFromRect(toFixed(v.rect), container), v.css));
                            });
                        }
                        v.layers.forEach(function (w) {
                            if (w.handler) {
                                pointerRegions[pointerRegions.length] = w;
                            }
                        });
                    });
                });
            }
        }
    }

    $.extend(TyperCanvas.prototype, {
        refresh: function () {
            setTimeout(refresh, 0, true);
        },
        clear: function () {
            oldLayers.push.apply(oldLayers, newLayers.splice(0));
        },
        fill: function (range) {
            if (range instanceof Node) {
                addObject('f', range);
            } else {
                var arr = [];
                Typer.iterate(activeTyper.createSelection(range).createTreeWalker(-1, function (v) {
                    if (Typer.rangeCovers(range, v.element)) {
                        arr[arr.length] = getRect(v.element);
                        return 2;
                    }
                    if (Typer.is(v, Typer.NODE_ANY_ALLOWTEXT)) {
                        arr.push.apply(arr, computeFillRects(Typer.createRange(range, Typer.createRange(v.element, 'content'))));
                        return 2;
                    }
                    return 1;
                }));
                arr.forEach(function (v) {
                    addObject('f', v);
                });
            }
        },
        drawCaret: function (caret) {
            addObject('k', caret.clone());
        },
        drawBorder: function (element, mtop, mright, mbottom, mleft, color, inset) {
            var style = {};
            style.border = 'solid ' + color;
            style.borderWidth = [parseFloat(mtop), parseFloat(mright), parseFloat(mbottom), parseFloat(mleft), ''].join('px ');
            style.margin = inset ? '0px' : style.borderWidth.replace(/(^|\s)(\d)/g, '$1-$2');
            style.boxSizing = inset ? 'border-box' : 'auto';
            addObject('b', element, style);
        },
        drawLineBreak: function (node) {
            if (Typer.is(node, Typer.NODE_PARAGRAPH | Typer.NODE_EDITABLE_PARAGRAPH)) {
                $('br', node.element).each(function (i, v) {
                    addObject('m m-br', v);
                });
            }
        },
        drawLine: function (x1, y1, x2, y2, width, color, lineStyle) {
            var style = {};
            style.borderTop = parseFloat(width) + 'px ' + (lineStyle || 'solid') + ' ' + (color || '');
            style.marginTop = -parseFloat(width) + 'px';
            style.transformOrigin = '0% 50%';
            style.transform = 'rotate(' + Math.atan2(y2 - y1, x2 - x1) + 'rad)';
            addObject('l', Typer.toPlainRect(x1, y1, x1 + (Math.sqrt((y2 - y1) * (y2 - y1) + (x2 - x1) * (x2 - x1))), y1), style);
        },
        addControlPoint: function (element, cursor, callback) {
            addObject('c', element, function () {
                var r = getRect(element);
                paint('c', Typer.toPlainRect(r.right, r.top - 8, r.right + 8, r.top), {
                    cursor: cursor || 'pointer'
                }, callback);
            });
        }
    });

    addLayer('pointedNode', function (canvas) {
        canvas.clear();
        if (!canvas.mousedown) {
            var node = canvas.typer.nodeFromPoint(canvas.pointerX, canvas.pointerY, Typer.NODE_PARAGRAPH | Typer.NODE_EDITABLE_PARAGRAPH);
            if (node) {
                var style = window.getComputedStyle(node.element);
                canvas.drawBorder(node.element, style.marginTop, style.marginRight, style.marginBottom, style.marginLeft, 'rgba(255,158,98,0.2)');
            }
        }
    });
    addLayer('selection', function (canvas) {
        canvas.clear();
        var selection = canvas.typer.getSelection();
        var startNode = selection.startNode;
        if (selection.isCaret) {
            if ('caretColor' in root.style) {
                canvas.drawCaret(selection.baseCaret);
            }
            canvas.drawLineBreak(startNode);
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
            e.typer.retainFocus(container);
        },
        focusin: function (e) {
            activeTyper = e.typer;
            Typer.ui.setZIndex(container, activeTyper.element);
            refresh();
        },
        focusout: function (e) {
            activeTyper = null;
            $(container).children().detach();
        },
        stateChange: function (e) {
            refresh();
        }
    };

    Typer.defaultOptions.visualizer = true;

    Typer.canvas = {
        addLayer: addLayer
    };

})(jQuery, Typer);
