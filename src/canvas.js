(function ($, Typer, window, document, parseFloat) {
    'use strict';

    var INVALID = {
        left: 10000,
        right: -10000
    };
    var supported = !window.ActiveXObject;
    var root = document.documentElement;
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
        state.rect = translate(Typer.getRect(activeTyper.element), root.scrollLeft, root.scrollTop);
        $.extend(this, {
            typer: activeTyper,
            pointerX: state.x,
            pointerY: state.y,
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
            L: 'left',
            R: 'right',
            T: 'top',
            B: 'bottom',
            U: 'radius',
            P: 'polygon(100% 100%,100% 0,96.6% 25.9%,86.6% 50%,70.7% 70.7%,50% 86.6%,25.9% 96.6%,0 100%)',
            X: 'transform'
        };
        var style =
            '.has-N:focus{outline:none;}' +
            '.has-N::selection,.has-N ::selection{G:transparent;}' +
            '.has-N::-moz-selection,.has-N ::-moz-selection{G:transparent;}' +
            '.N{position:absolute;T:0;L:0;font-family:serif;font-size:12px;}' +
            '.N>div{position:absolute;pointer-events:none;}' +
            '.N>.c{pointer-events:all;border:1px solid black;G:white;}' +
            '.N>.f{G:rgba(0,31,81,0.2);}' +
            '.N>.m:E{content:"\\0000b6";position:absolute;top:50%;margin-top:-0.5em;left:4px;color:rgba(0,0,0,0.5);line-height:1;text-shadow:0 0 1px white,0 0 2px white;}' +
            '.N>.m-br:E{content:"\\0021a9";}' +
            '@supports (clip-path:polygon(0 0,0 0)) or (-webkit-clip-path:polygon(0 0,0 0)){.N>.bl-r:E,.N>.tl-r:E,.N>.br-r:F,.N>.tr-r:F{content:"";display:block;position:absolute;G:rgba(0,31,81,0.2);width:4px;height:4px;-webkit-clip-path:P;clip-path:P;}}' +
            '.N>.bl{border-B-L-U:4px;}' +
            '.N>.tl{border-T-L-U:4px;}' +
            '.N>.br{border-B-R-U:4px;}' +
            '.N>.tr{border-T-R-U:4px;}' +
            '.N>.bl-r:E{R:100%;B:0;}' +
            '.N>.tl-r:E{R:100%;T:0;-webkit-X:flipY();X:flipY();}' +
            '.N>.br-r:F{L:100%;B:0;-webkit-X:flipX();X:flipX();}' +
            '.N>.tr-r:F{L:100%;T:0;-webkit-X:rotate(180deg);X:rotate(180deg);}';
        $(document.body).append('<style>' + style.replace(/\b[A-Z]/g, function (v) {
            return repl[v] || v;
        }) + '</style>');
        container = $('<div class="typer-ui typer-visualizer">').appendTo(document.body)[0];

        $(window).bind('scroll resize orientationchange focus', refresh);
        $(document.body).bind('mousewheel mousedown mouseup keyup', refresh);

        $(document.body).mousedown(function (e) {
            $.each(pointerRegions, function (i, v) {
                if (Typer.pointInRect(e.clientX, e.clientY, translate(v.rect, -root.scrollLeft, -root.scrollTop))) {
                    var promise = handlePointer(e);
                    v.handler(promise);
                    promise.always(function () {
                        activeTyper.getSelection().focus();
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

    function translate(rect, x, y) {
        return Typer.toPlainRect(rect.left + x, rect.top + y, rect.right + x, rect.bottom + y);
    }

    function computeFillRects(range) {
        var container = range.commonAncestorContainer;
        var bRect = Typer.getRect(container.nodeType === 1 ? container : container.parentNode);
        var rects = $.map(range.getClientRects(), Typer.toPlainRect);
        var result = [];
        rects.sort(function (a, b) {
            return (a.top - b.top) || (a.left - b.left) || (b.bottom - a.bottom) || (b.right - a.right);
        });
        $.each(rects, function (i, v) {
            var prev = result[0];
            if (prev) {
                if (v.left >= prev.right && v.top < prev.bottom) {
                    result.shift();
                    v.top = Math.min(v.top, prev.top);
                    v.left = prev.left;
                    v.bottom = Math.max(v.bottom, prev.bottom);
                    prev = result[0];
                } else if (v.top >= prev.bottom) {
                    prev.left = result[1] ? bRect.left : prev.left;
                    prev.right = bRect.right;
                }
            }
            if (prev) {
                if (Typer.rectCovers(prev, v)) {
                    return;
                }
                if (v.top > prev.top) {
                    prev.bottom = v.top;
                }
                if (result[1] && prev.left === result[1].left && prev.right === result[1].right) {
                    prev.top = result.splice(1, 1)[0].top;
                }
            }
            result.unshift((delete v.width, delete v.height, v));
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
            $(document.body).unbind(handlers);
            deferred.resolve(hasMoved);
        };
        if (e.which === 1) {
            $(document.body).bind(handlers);
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
            rect: translate('top' in rect ? rect : rect.getRect ? rect.getRect() : Typer.getRect(rect), root.scrollLeft, root.scrollTop),
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
        if (activeTyper) {
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
                                $(dom).css($.extend(Typer.ui.cssFromRect(translate(v.rect, -root.scrollLeft, -root.scrollTop), container), v.css));
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
            setImmediate(refresh, true);
        },
        clear: function () {
            oldLayers.push.apply(oldLayers, newLayers.splice(0));
        },
        fill: function (range) {
            if (range instanceof Node) {
                addObject('f tl tr bl br', range);
            } else {
                var arr = [];
                Typer.iterate(activeTyper.createSelection(range).createTreeWalker(-1, function (v) {
                    if (Typer.is(v, Typer.NODE_ANY_ALLOWTEXT) || Typer.rangeCovers(range, v.element)) {
                        var r = Typer.createRange(range, Typer.createRange(v.element));
                        if (!arr[0] || arr[0].commonAncestorContainer !== v.element.parentNode) {
                            arr.unshift(r);
                        } else {
                            arr[0] = Typer.createRange(Typer.createRange(arr[0], true), Typer.createRange(r, false));
                        }
                        return 2;
                    }
                }));
                arr.forEach(function (v) {
                    addObject('f', v, function (range) {
                        var rects = computeFillRects(range);
                        $.each(rects, function (i, v) {
                            var prev = rects[i - 1] || INVALID;
                            var next = rects[i + 1] || INVALID;
                            var className = [
                                v.left < prev.left || v.left > prev.right ? ' bl' : v.left > prev.left && v.left < prev.right ? ' bl-r' : '',
                                v.left < next.left || v.left > next.right ? ' tl' : v.left > next.left && v.left < next.right ? ' tl-r' : '',
                                v.right > prev.right || v.right < prev.left ? ' br' : v.right < prev.right && v.right > prev.left ? ' br-r' : '',
                                v.right > next.right || v.right < next.left ? ' tr' : v.right < next.right && v.right > next.left ? ' tr-r' : ''].join('');
                            paint('f' + className, v);
                        });
                    });
                }, this);
            }
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
                var r = Typer.getRect(element);
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
            if (supported && !init.init) {
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

    Typer.defaultOptions.visualizer = supported;

    Typer.canvas = {
        addLayer: addLayer
    };

})(jQuery, window.Typer, window, document, parseFloat);
