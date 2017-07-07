(function ($, Typer, window, document) {

    var INVALID = {
        left: 10000,
        right: -10000
    };

    var rectEquals = Typer.rectEquals;
    var rectCovers = Typer.rectCovers;

    var supported = !window.ActiveXObject;
    var selectionLayers = [];
    var hoverLayers = [];
    var freeDiv = [];
    var windowWidth = $(window).width();
    var windowHeight = $(window).height();
    var lastClientX;
    var lastClientY;
    var container;
    var activeTyper;
    var activeWidget;
    var previousRect;

    function init() {
        var style =
            '.has-N:focus{outline:none;}' +
            '.has-N::selection,.has-N ::selection{background-color:transparent;}' +
            '.has-N::-moz-selection,.has-N ::-moz-selection{background-color:transparent;}' +
            '.N{position:fixed;pointer-events:none;width:100%;height:100%;font-family:monospace;font-size:10px;}' +
            '.N>div{position:fixed;box-sizing:border-box;}' +
            '.N>.border{border:1px solid rgba(0,31,81,0.2);}' +
            '.N>.fill{background-color:rgba(0,31,81,0.2);}' +
            '.N>.fill-margin{border:solid rgba(255,158,98,0.2);}' +
            '@supports (clip-path:polygon(0 0,0 0)) or (-webkit-clip-path:polygon(0 0,0 0)){.N>.bl-r:before,.N>.tl-r:before,.N>.br-r:after,.N>.tr-r:after{content:"";display:block;position:absolute;background-color:rgba(0,31,81,0.2);width:4px;height:4px;-webkit-clip-path:polygon(100% 100%,100% 0,96.6% 25.9%,86.6% 50%,70.7% 70.7%,50% 86.6%,25.9% 96.6%,0 100%);clip-path:polygon(100% 100%,100% 0,96.6% 25.9%,86.6% 50%,70.7% 70.7%,50% 86.6%,25.9% 96.6%,0 100%);}}' +
            '.N>.bl{border-bottom-left-radius:4px;}' +
            '.N>.tl{border-top-left-radius:4px;}' +
            '.N>.br{border-bottom-right-radius:4px;}' +
            '.N>.tr{border-top-right-radius:4px;}' +
            '.N>.bl-r:before{right:100%;bottom:0;}' +
            '.N>.tl-r:before{right:100%;top:0;-webkit-transform:flipY();transform:flipY();}' +
            '.N>.br-r:after{left:100%;bottom:0;-webkit-transform:flipX();transform:flipX();}' +
            '.N>.tr-r:after{left:100%;top:0;-webkit-transform:rotate(180deg);transform:rotate(180deg);}' +
            '.N>.newline:before{content:"\\0021a9";position:absolute;top:50%;left:2px;margin-top:-0.5em;line-height:1;background-color:white;box-shadow:0 0 1px black;opacity:0.5;padding:0 0.25em;}' +
            '.N>.elm:before{content:attr(elm);box-shadow:0 0 1px white;background-color:rgba(0,31,81,0.8);color:white;padding:0 0.25em;position:absolute;bottom:100%;white-space:nowrap}';
        $(document.body).append('<style>' + style.replace(/N/g, 'typer-visualizer') + '</style>');
        container = $('<div class="typer-ui typer-visualizer">').appendTo(document.body)[0];

        $(window).bind('scroll resize orientationchange focus', function () {
            windowWidth = $(window).width();
            windowHeight = $(window).height();
            redrawSelection();
        });
        $(document.body).bind('mousewheel', redrawSelection);
        $(document.body).bind('mousemove', function (e) {
            lastClientX = e.clientX;
            lastClientY = e.clientY;
            updateHover(lastClientX, lastClientY);
        });
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

    function getElementMarker(element) {
        var node = activeTyper.getNode(element);
        var arr = [];
        do {
            arr.unshift(node.element.tagName.toLowerCase() + node.element.className.replace(/^(?=.)|\s+/, '.'));
            node = node.parentNode;
        } while (Typer.is(node, Typer.NODE_ANY_ALLOWTEXT));
        return arr.join(' > ');
    }

    function getParagraphNode(node) {
        if (Typer.is(node, Typer.NODE_ANY_INLINE)) {
            for (; !Typer.is(node, Typer.NODE_PARAGRAPH | Typer.NODE_EDITABLE_PARAGRAPH) && node.parentNode; node = node.parentNode);
        }
        return node;
    }

    function computeTextRects(range) {
        var container = range.commonAncestorContainer;
        var bRect = (container.nodeType === 1 ? container : container.parentNode).getBoundingClientRect();
        var rects = $.map(range.getClientRects(), toRightBottom);
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
                var d = dom[domCount] = dom[domCount] || freeDiv.pop() || $('<div>')[0];
                d.className = className;
                d.removeAttribute('style');
                $(d).css(css || '', value);
                domCount++;
                return d;
            }

            if (v.type.substr(0, 4) === 'text') {
                var range = Typer.createRange(v.element);
                if (v.type === 'text-fill' && window.getSelection().rangeCount) {
                    range = Typer.createRange(range, window.getSelection().getRangeAt(0));
                }
                var rects = computeTextRects(range);
                var type = v.type;
                $.each(rects, function (i, v) {
                    var prev = rects[i - 1] || INVALID;
                    var next = rects[i + 1] || INVALID;
                    var dom = drawLayer(type === 'text-fill' ? 'fill' : 'border', toScreenRightBottom(v));
                    dom.className += [
                        v.left < prev.left || v.left > prev.right ? ' bl' : v.left > prev.left && v.left < prev.right ? ' bl-r' : '',
                        v.left < next.left || v.left > next.right ? ' tl' : v.left > next.left && v.left < next.right ? ' tl-r' : '',
                        v.right > prev.right || v.right < prev.left ? ' br' : v.right < prev.right && v.right > prev.left ? ' br-r' : '',
                        v.right > next.right || v.right < next.left ? ' tr' : v.right < next.right && v.right > next.left ? ' tr-r' : ''].join('');
                });
                if (v.type === 'text') {
                    drawLayer('elm', rects[rects.length - 1]).setAttribute('elm', getElementMarker(v.element));
                }
            } else if (v.type.substr(0, 5) === 'block') {
                var bRect = v.element.getBoundingClientRect();
                drawLayer('border', bRect);
                if (v.type === 'block') {
                    drawLayer('elm', bRect).setAttribute('elm', getElementMarker(v.element));
                } else if (v.type === 'block-fill') {
                    drawLayer('fill', bRect);
                } else if (v.type === 'block-margin') {
                    var style = window.getComputedStyle(v.element);
                    var s = toScreenRightBottom(bRect);
                    s.margin = [
                        -parseFloat(style.marginTop),
                        -parseFloat(style.marginRight),
                        -parseFloat(style.marginBottom),
                        -parseFloat(style.marginLeft), ''].join('px ');
                    s.borderWidth = [
                        style.marginTop,
                        style.marginRight,
                        style.marginBottom,
                        style.marginLeft].join(' ');
                    drawLayer('fill-margin', s);
                    $('br', v.element).each(function (i, v) {
                        drawLayer('newline', v.getBoundingClientRect());
                    });
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
            if (node && node.element !== activeTyper.element) {
                if (Typer.is(node, Typer.NODE_WIDGET)) {
                    addLayer(hoverLayers, node.widget.element, 'block');
                } else {
                    addLayer(hoverLayers, node.element, Typer.is(node, Typer.NODE_ANY_INLINE) ? 'text' : 'block');
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
                if (Typer.is(v, Typer.NODE_ANY_ALLOWTEXT) || (options.layout && activeWidget && v.element === activeWidget.element)) {
                    addLayer(selectionLayers, v.element, v.nodeType & Typer.NODE_ANY_ALLOWTEXT ? 'text-fill' : 'block-fill');
                    return 2;
                }
            }));
        } else if (options.layout && selection.startNode && Typer.is(selection.startNode, Typer.NODE_ANY_ALLOWTEXT)) {
            addLayer(selectionLayers, getParagraphNode(selection.startNode).element, 'block-margin');
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
            if (e.targetWidget.typer === activeTyper) {
                activeWidget = e.targetWidget;
                if (supported) {
                    updateSelection(e.widget.options);
                }
            }
        },
        widgetFocusout: function (e) {
            activeWidget = null;
        },
        stateChange: function (e) {
            if (supported && e.typer === activeTyper) {
                updateSelection(e.widget.options);
                updateHover(lastClientX, lastClientY);
            }
        }
    };

    Typer.defaultOptions.visualizer = supported;

})(jQuery, window.Typer, window, document);
