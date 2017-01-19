(function ($, Typer) {

    var INVALID = {
        left: 10000,
        right: -10000
    };
    var NODE_ANY_ALLOWTEXT = Typer.NODE_PARAGRAPH | Typer.NODE_EDITABLE_PARAGRAPH | Typer.NODE_INLINE | Typer.NODE_INLINE_WIDGET | Typer.NODE_INLINE_EDITABLE;

    var supported = !window.ActiveXObject;
    var selectionLayers = [];
    var hoverLayers = [];
    var freeDiv = [];
    var windowWidth = $(window).width();
    var windowHeight = $(window).height();
    var container;
    var activeTyper;
    var activeWidget;
    var previousRect;

    function init() {
        var style = '\
            .has-typer-visualizer:focus { outline:none; }\
            .has-typer-visualizer::selection,.has-typer-visualizer ::selection { background-color:transparent; }\
            .has-typer-visualizer::-moz-selection,.has-typer-visualizer ::-moz-selection { background-color:transparent; }\
            .typer-visualizer { position:fixed;pointer-events:none;width:100%;height:100%; }\
            .typer-visualizer > div { position:fixed;box-sizing:border-box; }\
            .typer-visualizer .fill { background-color:rgba(0,31,81,0.2); }\
            .typer-visualizer .fill-margin { border:solid rgba(255,158,98,0.2); }\
            @supports (clip-path:polygon(0 0,0 0)) or (-webkit-clip-path:polygon(0 0,0 0)) { .typer-visualizer .bl-r:before,.typer-visualizer .tl-r:before,.typer-visualizer .br-r:after,.typer-visualizer .tr-r:after { content:"";display:block;position:absolute;background-color:rgba(0,31,81,0.2);width:4px;height:4px;-webkit-clip-path:polygon(100% 100%,100% 0,96.6% 25.9%,86.6% 50%,70.7% 70.7%,50% 86.6%,25.9% 96.6%,0 100%);clip-path:polygon(100% 100%,100% 0,96.6% 25.9%,86.6% 50%,70.7% 70.7%,50% 86.6%,25.9% 96.6%,0 100%); } }\
            .typer-visualizer .line-n,.typer-visualizer .line-s { border-top:1px solid rgba(0,31,81,0.2);left:0;right:0;height:1px; }\
            .typer-visualizer .line-w,.typer-visualizer .line-e { border-left:1px solid rgba(0,31,81,0.2);top:0;bottom:0;width:1px; }\
            .typer-visualizer .line-s { margin-top:-1px; }\
            .typer-visualizer .line-e { margin-left:-1px; }\
            .typer-visualizer .bl { border-bottom-left-radius:4px; }\
            .typer-visualizer .tl { border-top-left-radius:4px; }\
            .typer-visualizer .br { border-bottom-right-radius:4px; }\
            .typer-visualizer .tr { border-top-right-radius:4px; }\
            .typer-visualizer .bl-r:before { right:100%;bottom:0; }\
            .typer-visualizer .tl-r:before { right:100%;top:0;-webkit-transform:flipY();transform:flipY(); }\
            .typer-visualizer .br-r:after { left:100%;bottom:0;-webkit-transform:flipX();transform:flipX(); }\
            .typer-visualizer .tr-r:after { left:100%;top:0;-webkit-transform:rotate(180deg);transform:rotate(180deg); }\
        ';
        $(document.body).append('<style>' + style + '</style>');
        container = $('<div class="typer-ui typer-visualizer">').appendTo(document.body)[0];

        $(window).bind('scroll resize orientationchange focus', function () {
            windowWidth = $(window).width();
            windowHeight = $(window).height();
            redrawSelection();
        });
        $(document.body).bind('mousewheel', redrawSelection);
        $(document.body).bind('mousemove', function (e) {
            updateHover(e.clientX, e.clientY);
        });
    }

    function rectEquals(a, b) {
        return a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height;
    }

    function rectCovers(a, b) {
        return b.left >= a.left && b.right <= a.right && b.top >= a.top && b.bottom <= a.bottom;
    }

    function toRightBottom(v) {
        return {
            top: v.top | 0,
            left: v.left | 0,
            right: (v.right || v.left + v.width) | 0,
            bottom: (v.bottom || v.top + v.height) | 0
        };
    }

    function toScreenRightBottom(v) {
        return {
            top: v.top,
            left: v.left,
            right: windowWidth - (v.right || v.left + v.width),
            bottom: windowHeight - (v.bottom || v.top + v.height)
        };
    }

    function computeTextRects(element) {
        var bRect = element.getBoundingClientRect();
        var range = window.getSelection().rangeCount && window.getSelection().getRangeAt(0);
        var rects = !range ? [] : $.map(Typer.createRange(range, Typer.createRange(element)).getClientRects(), toRightBottom);
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
                    prev.right = bRect.left + bRect.width;
                }
            }
            if (prev) {
                if (rectCovers(prev, v)) {
                    return;
                }
                if (v.top > prev.top && v.top - prev.bottom < v.bottom - v.top) {
                    prev.bottom = v.top;
                }
                if (result[1] && prev.left === result[1].left && prev.right === result[1].right) {
                    prev.top = result.splice(1, 1)[0].top;
                }
            }
            result.unshift(v);
        });
        return result;
    }

    function getParagraphNode(node) {
        if (node.nodeType & (Typer.NODE_INLINE | Typer.NODE_INLINE_EDITABLE | Typer.NODE_INLINE_WIDGET)) {
            for (; !(node.nodeType & (Typer.NODE_PARAGRAPH | Typer.NODE_EDITABLE_PARAGRAPH)) && node.parentNode; node = node.parentNode);
        }
        return node;
    }

    function addLayer(layers, element, type) {
        var found;
        $.each(layers, function (i, v) {
            if (v.element === null) {
                found = v;
            }
            if (v.element === element) {
                v.type = type;
                found = true;
                return false;
            }
        });
        if (typeof found === 'object') {
            found.element = element;
            found.type = type;
        } else if (!found) {
            layers[layers.length] = {
                element: element,
                type: type
            };
        }
    }

    function resetLayers(layers) {
        $.each(layers, function (i, v) {
            v.type = 'none';
            if (!$.contains(document, v.element)) {
                v.element = null;
            }
        });
    }

    function draw(layers) {
        $.each(layers, function (i, v) {
            var dom = v.dom = v.dom || [];
            var domCount = 0;

            function drawLayer(className, css, value) {
                dom[domCount] = dom[domCount] || freeDiv.pop() || $('<div>')[0];
                dom[domCount].className = className;
                dom[domCount].setAttribute('style', '');
                $(dom[domCount]).css(css || '', value);
                return dom[domCount++];
            }

            if (v.type === 'text') {
                var rects = computeTextRects(v.element);
                $.each(rects, function (i, v) {
                    var prev = rects[i - 1] || INVALID;
                    var next = rects[i + 1] || INVALID;
                    var dom = drawLayer('fill', toScreenRightBottom(v));
                    dom.className += [
                        v.left < prev.left || v.left > prev.right ? ' bl' : v.left > prev.left && v.left < prev.right ? ' bl-r' : '',
                        v.left < next.left || v.left > next.right ? ' tl' : v.left > next.left && v.left < next.right ? ' tl-r' : '',
                        v.right > prev.right || v.right < prev.left ? ' br' : v.right < prev.right && v.right > prev.left ? ' br-r' : '',
                        v.right > next.right || v.right < next.left ? ' tr' : v.right < next.right && v.right > next.left ? ' tr-r' : ''].join('');
                });
            } else if (v.type === 'layout' || v.type === 'layout-fill' || v.type === 'layout-margin') {
                var bRect = v.element.getBoundingClientRect();
                drawLayer('line-n', 'top', bRect.top);
                drawLayer('line-s', 'top', bRect.top + bRect.height);
                drawLayer('line-w', 'left', bRect.left);
                drawLayer('line-e', 'left', bRect.left + bRect.width);
                if (v.type === 'layout-margin' || v.type === 'layout-fill') {
                    var style = window.getComputedStyle(v.element);
                    var s = toScreenRightBottom(bRect);
                    s.margin = [-parseFloat(style.marginTop), -parseFloat(style.marginRight), -parseFloat(style.marginBottom), -parseFloat(style.marginLeft), ''].join('px ');
                    s.borderWidth = [style.marginTop, style.marginRight, style.marginBottom, style.marginLeft].join(' ');
                    drawLayer('fill-margin', s);
                }
                if (v.type === 'layout-fill') {
                    drawLayer('fill', bRect);
                }
            }
            if (dom.length > domCount) {
                freeDiv.push.apply(freeDiv, dom.splice(domCount));
            }
            $(dom).appendTo(container);
        });
        $(freeDiv).detach();
    }

    function redrawSelection() {
        if (activeTyper) {
            var currentRect = activeTyper.element.getBoundingClientRect();
            if (!previousRect || !rectEquals(previousRect, currentRect)) {
                previousRect = currentRect;
                draw(selectionLayers);
            }
        }
    }

    function updateHover(x, y) {
        resetLayers(hoverLayers);
        if (activeTyper) {
            var node = activeTyper.nodeFromPoint(x, y);
            if (node) {
                if (node.nodeType & (Typer.NODE_WIDGET)) {
                    addLayer(hoverLayers, node.widget.element, 'layout');
                } else {
                    node = getParagraphNode(node);
                    addLayer(hoverLayers, node.element, 'layout');
                }
            }
        }
        draw(hoverLayers);
    }

    function updateSelection(options) {
        var selection = activeTyper.getSelection();
        resetLayers(selectionLayers);
        if (!selection.isCaret) {
            Typer.iterate(selection.createTreeWalker(-1, function (v) {
                if ((v.nodeType & NODE_ANY_ALLOWTEXT) || (options.layout && activeWidget && v.element === activeWidget.element)) {
                    addLayer(selectionLayers, v.element, v.nodeType & NODE_ANY_ALLOWTEXT ? 'text' : 'layout-fill');
                    return 2;
                }
            }));
        } else if (options.layout && selection.startNode && (selection.startNode.nodeType & NODE_ANY_ALLOWTEXT)) {
            addLayer(selectionLayers, (getParagraphNode(selection.startNode) || selection.startNode).element, 'layout-margin');
        }
        draw(selectionLayers);
    }

    Typer.widgets.visualizer = {
        inline: true,
        options: {
            layout: true
        },
        init: function (e) {
            $(e.typer.element).addClass('has-typer-visualizer');
            if (supported && !init.init) {
                init();
                init.init = true;
            }
        },
        focusin: function (e) {
            activeTyper = e.typer;
            Typer.ui.setZIndex(container, activeTyper.element);
        },
        focusout: function (e) {
            activeTyper = null;
            $(container).children().detach();
        },
        widgetFocusin: function (e) {
            activeWidget = e.targetWidget;
            if (supported) {
                updateSelection(e.widget.options);
            }
        },
        widgetFocusout: function (e) {
            activeWidget = null;
        },
        stateChange: function (e) {
            if (supported && e.typer === activeTyper) {
                updateSelection(e.widget.options);
            }
        }
    };

    Typer.defaultOptions.visualizer = supported;

})(jQuery, window.Typer);
