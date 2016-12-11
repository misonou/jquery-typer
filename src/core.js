(function ($, window, document, String, Node, Range, DocumentFragment, WeakMap, array) {
    'use strict';

    var KEYNAMES = JSON.parse('{"8":"backspace","9":"tab","13":"enter","16":"shift","17":"ctrl","18":"alt","19":"pause","20":"capsLock","27":"escape","33":"pageUp","34":"pageDown","35":"end","36":"home","37":"leftArrow","38":"upArrow","39":"rightArrow","40":"downArrow","45":"insert","46":"delete","48":"0","49":"1","50":"2","51":"3","52":"4","53":"5","54":"6","55":"7","56":"8","57":"9","65":"a","66":"b","67":"c","68":"d","69":"e","70":"f","71":"g","72":"h","73":"i","74":"j","75":"k","76":"l","77":"m","78":"n","79":"o","80":"p","81":"q","82":"r","83":"s","84":"t","85":"u","86":"v","87":"w","88":"x","89":"y","90":"z","91":"leftWindow","92":"rightWindowKey","93":"select","96":"numpad0","97":"numpad1","98":"numpad2","99":"numpad3","100":"numpad4","101":"numpad5","102":"numpad6","103":"numpad7","104":"numpad8","105":"numpad9","106":"multiply","107":"add","109":"subtract","110":"decimalPoint","111":"divide","112":"f1","113":"f2","114":"f3","115":"f4","116":"f5","117":"f6","118":"f7","119":"f8","120":"f9","121":"f10","122":"f11","123":"f12","144":"numLock","145":"scrollLock","186":"semiColon","187":"equalSign","188":"comma","189":"dash","190":"period","191":"forwardSlash","192":"backtick","219":"openBracket","220":"backSlash","221":"closeBracket","222":"singleQuote"}');
    var VOID_TAGS = 'area base br col command embed hr img input keygen link meta param source track wbr'.split(' ');
    var INNER_PTAG = 'h1,h2,h3,h4,h5,h6,p,q,blockquote,pre,code,li,caption,figcaption,summary,dt,th';
    var ZWSP = '\u200b';
    var ZWSP_ENTITIY = '&#8203;';
    var EMPTY_LINE = '<p>&#8203;</p>';
    var COLLAPSE_START_INSIDE = 7;
    var COLLAPSE_START_OUTSIDE = 6;
    var COLLAPSE_END_INSIDE = 3;
    var COLLAPSE_END_OUTSIDE = 2;
    var NODE_WIDGET = 1;
    var NODE_EDITABLE = 2;
    var NODE_EDITABLE_PARAGRAPH = 32;
    var NODE_PARAGRAPH = 4;
    var NODE_OUTER_PARAGRAPH = 8;
    var NODE_INLINE = 16;
    var NODE_INLINE_WIDGET = 64;
    var NODE_INLINE_EDITABLE = 128;
    var NODE_SHOW_EDITABLE = 4096;
    var NODE_ANY_BLOCK_EDITABLE = NODE_EDITABLE | NODE_EDITABLE_PARAGRAPH;
    var NODE_ANY_INLINE = NODE_INLINE | NODE_INLINE_WIDGET | NODE_INLINE_EDITABLE;
    var NODE_ANY_ALLOWTEXT = NODE_PARAGRAPH | NODE_EDITABLE_PARAGRAPH | NODE_ANY_INLINE;
    var EVENT_ALL = 1;
    var EVENT_STATIC = 2;
    var EVENT_HANDLER = 3;
    var EVENT_CURRENT = 4;
    var IS_IE = !!window.ActiveXObject || document.documentElement.style.msTouchAction !== undefined;

    var isFunction = $.isFunction;
    var selection = window.getSelection();
    var suppressIETextInput;
    var windowFocusedOut;

    function TyperSelection(selection) {
        if (is(selection, TyperSelection)) {
            Object.getOwnPropertyNames(selection).filter(function (v) {
                return !TyperSelection.prototype.hasOwnProperty(v);
            }).forEach(function (v) {
                this[v] = selection[v];
            }, this);
        }
    }

    function TyperWidget(typer, id, element, options) {
        this.typer = typer;
        this.id = id;
        this.element = element || null;
        this.options = options || {};
    }

    function TyperEvent(eventName, typer, widget) {
        this.eventName = eventName;
        this.typer = typer;
        this.widget = widget || null;
    }

    function TyperNode(nodeType, element, widget) {
        this.childNodes = [];
        this.nodeType = nodeType;
        this.element = element;
        this.widget = widget;
    }

    function TyperTreeWalker(root, whatToShow, filter) {
        this.whatToShow = whatToShow;
        this.filter = filter || null;
        this.currentNode = root;
        this.root = root;
    }

    function TyperDOMNodeIterator(root, whatToShow, filter) {
        this.whatToShow = whatToShow;
        this.filter = filter || null;
        this.typerNodeIterator = is(root, TyperTreeWalker) || new TyperTreeWalker(root, NODE_WIDGET | NODE_ANY_ALLOWTEXT);
    }

    function replaceTimeout(source, fn, milliseconds) {
        clearTimeout(replaceTimeout[source.name]);
        replaceTimeout[source.name] = fn && setTimeout(fn, milliseconds);
    }

    function definePrototype(fn, prototype) {
        fn.prototype = prototype;
        Object.defineProperty(prototype, 'constructor', {
            configurable: true,
            writable: true,
            value: fn
        });
    }

    function defineLazyProperties(obj, props) {
        $.each(props, function (i, v) {
            Object.defineProperty(obj, i, {
                enumerable: true,
                configurable: true,
                get: function () {
                    Object.defineProperty(this, i, {
                        enumerable: true,
                        writable: true,
                        value: v.apply(this)
                    });
                    return this[i];
                }
            });
        });
    }

    function slice(arr, start, end) {
        return array.slice.call(arr || {}, start || 0, end);
    }

    function mapFn(prop) {
        mapFn[prop] = mapFn[prop] || function (v) {
            return v[prop];
        };
        return mapFn[prop];
    }

    function any(arr, callback) {
        var result;
        $.each(arr, function (i, v) {
            result = callback.call(this, v) && v;
            return !result;
        });
        return result;
    }

    function acceptNode(iterator, node) {
        var nodeType = (node || iterator.currentNode || '').nodeType;
        if (!(iterator.whatToShow & (is(iterator, TyperTreeWalker) ? nodeType : (1 << (nodeType - 1))))) {
            return 3;
        }
        return !iterator.filter ? 1 : (iterator.filter.acceptNode || iterator.filter).call(iterator.filter, node || iterator.currentNode);
    }

    function iterate(iterator, callback, from) {
        iterator.currentNode = from || iterator.currentNode;
        var value = acceptNode(iterator);
        if (value !== 2) {
            if (value === 1 && callback) {
                callback(iterator.currentNode);
            }
            for (; iterator.nextNode(); callback && callback(iterator.currentNode));
        }
    }

    function iterateToArray(iterator, callback, from) {
        var result = [];
        iterate(iterator, array.push.bind(result), from);
        return callback ? $.map(result, callback) : result;
    }

    function trim(v) {
        return String(v || '').replace(/^[\s\u200b]+|[\s\u200b]+$/g, '');
    }

    function capfirst(v) {
        v = String(v || '');
        return v.charAt(0).toUpperCase() + v.slice(1);
    }

    function lowfirst(v) {
        v = String(v || '');
        return v.charAt(0).toLowerCase() + v.slice(1);
    }

    function tagName(element) {
        return element && element.tagName && element.tagName.toLowerCase();
    }

    function is(element, selector) {
        if (!element || !selector) {
            return false;
        }
        // constructors of native DOM objects in Safari refuse to be functions
        // use a fairly accurate but fast checking instead of $.isFunction
        if (selector.prototype) {
            return element instanceof selector && element;
        }
        if (selector.toFixed) {
            return (element.nodeType & selector) && element;
        }
        return (selector === '*' || $(element).is(selector)) && element;
    }

    function attrs(element) {
        var value = {};
        $.each($.makeArray(element && element.attributes), function (i, v) {
            value[v.nodeName] = v.value;
        });
        return value;
    }

    function compareAttrs(a, b) {
        var thisAttr = attrs(a);
        var prevAttr = attrs(b);
        $.each(prevAttr, function (i, v) {
            if (v === thisAttr[i]) {
                delete thisAttr[i];
                delete prevAttr[i];
            }
        });
        return !Object.keys(thisAttr)[0] && !Object.keys(prevAttr)[0];
    }

    function comparePosition(a, b, strict) {
        if (a === b) {
            return 0;
        }
        var v = a && b && a.compareDocumentPosition(b);
        if (v & 2) {
            return (strict && v & 8) || (v & 1) ? NaN : 1;
        }
        if (v & 4) {
            return (strict && v & 16) || (v & 1) ? NaN : -1;
        }
        return NaN;
    }

    function containsOrEquals(container, contained) {
        return container === contained || $.contains(container, contained);
    }

    function getOffset(node, offset) {
        var len = node.length || node.childNodes.length;
        return (offset === len || (offset === 0 && 1 / offset === -Infinity)) ? len : (len + offset) % len || 0;
    }

    function createRange(startNode, startOffset, endNode, endOffset) {
        if (is(startNode, TyperSelection)) {
            var state = startNode;
            startNode = state.startTextNode || state.startElement;
            endNode = state.endTextNode || state.endElement;
            startOffset = startNode.nodeType === 1 ? state.isCaret ? state.caretPosition <= 0 : true : state.startOffset;
            endOffset = endNode.nodeType === 1 ? state.isCaret ? state.caretPosition <= 0 : false : state.endOffset;
        }
        var startOffsetNum = +startOffset === startOffset;
        var range;
        if (is(startNode, Node)) {
            range = document.createRange();
            if (endNode) {
                if (startOffsetNum) {
                    range.setStart(startNode, getOffset(startNode, startOffset));
                } else {
                    range[startOffset ? 'setStartBefore' : 'setStartAfter'](startNode);
                }
                if (is(endNode, Node)) {
                    if (+endOffset === endOffset) {
                        range.setEnd(endNode, getOffset(endNode, endOffset));
                    } else {
                        range[endOffset ? 'setEndBefore' : 'setEndAfter'](endNode);
                    }
                }
            } else {
                range[(startOffset === true || (startOffsetNum && (startOffset & 1))) ? 'selectNodeContents' : 'selectNode'](startNode);
                if (startOffsetNum && (startOffset & 2)) {
                    range.collapse(!!(startOffset & 4));
                }
            }
        } else if (is(startNode, Range)) {
            range = startNode.cloneRange();
            if (!range.collapsed) {
                if (typeof startOffset === 'boolean') {
                    range.collapse(startOffset);
                } else if (startOffsetNum && (startOffset & 2)) {
                    range.collapse(!!(startOffset & 4));
                }
            }
        }
        if (is(startOffset, Range)) {
            var inverse = range.collapsed && startOffset.collapsed ? -1 : 1;
            if (range.compareBoundaryPoints(0, startOffset) * inverse < 0) {
                range.setStart(startOffset.startContainer, startOffset.startOffset);
            }
            if (range.compareBoundaryPoints(2, startOffset) * inverse > 0) {
                range.setEnd(startOffset.endContainer, startOffset.endOffset);
            }
        }
        return range;
    }

    function rangeIntersects(a, b) {
        a = is(a, Range) || createRange(a, true);
        b = is(b, Range) || createRange(b, true);
        return a && b && !(a.startContainer.compareDocumentPosition(b.startContainer) & 1) && a.compareBoundaryPoints(3, b) <= 0 && a.compareBoundaryPoints(1, b) >= 0;
    }

    function rangeCovers(a, b) {
        a = is(a, Range) || createRange(a, true);
        b = is(b, Range) || createRange(b, true);
        return a && b && !(a.startContainer.compareDocumentPosition(b.startContainer) & 1) && a.compareBoundaryPoints(0, b) <= 0 && a.compareBoundaryPoints(2, b) >= 0;
    }

    function compareRangePosition(a, b, strict) {
        a = is(a, Range) || createRange(a, true);
        b = is(b, Range) || createRange(b, true);
        var value = a && b && (a.startContainer.compareDocumentPosition(b.startContainer) & 1) ? NaN : a.compareBoundaryPoints(0, b) + a.compareBoundaryPoints(2, b);
        return (strict && ((value !== 0 && rangeIntersects(a, b)) || (value === 0 && (!rangeCovers(a, b) || !rangeCovers(b, a))))) ? NaN : value && value / Math.abs(value);
    }

    function codeUpdate(callback) {
        // IE fires textinput event on the parent element when the text node's value is modified
        // even if modification is done through JavaScript rather than user action
        if (!suppressIETextInput) {
            setTimeout(function () {
                suppressIETextInput = false;
            });
        }
        suppressIETextInput = true;
        callback();
    }

    function getRangeFromPoint(x, y) {
        if (document.caretRangeFromPoint) {
            return document.caretRangeFromPoint(x, y);
        }
        if (document.caretPositionFromPoint) {
            var pos = document.caretPositionFromPoint(x, y);
            return createRange(pos.offsetNode, pos.offset, true);
        }
        if (document.body.createTextRange) {
            var currentRange = selection.rangeCount && selection.getRangeAt(0);
            var textRange = document.body.createTextRange();
            textRange.moveToPoint(x, y);
            textRange.select();
            var range = selection.getRangeAt(0);
            if (currentRange) {
                selection.removeAllRanges();
                selection.addRange(currentRange);
            }
            return range;
        }
    }

    function splitTextBoundary(state) {
        var startTextNode = state.startTextNode;
        var endTextNode = state.endTextNode;
        var sameNode = (startTextNode === endTextNode);
        if (endTextNode && state.endOffset < endTextNode.length) {
            endTextNode.splitText(state.endOffset);
        }
        if (startTextNode && state.startOffset > 0) {
            state.startTextNode = startTextNode.splitText(state.startOffset);
            if (sameNode) {
                state.endTextNode = state.startTextNode;
                state.endOffset -= state.startOffset;
            }
            state.startOffset = 0;
        }
    }

    function createDocumentFragment(node) {
        return is(node, DocumentFragment) || $(document.createDocumentFragment()).append(node)[0];
    }

    function createTextNode(text) {
        return document.createTextNode(trim(text) || ZWSP);
    }

    function createElement(name) {
        return document.createElement(name);
    }

    function wrapNode(content, parentNodes) {
        $.each(parentNodes, function (i, v) {
            content = $(v.cloneNode(false)).append(content)[0];
        });
        return is(content, Node) || createDocumentFragment(content);
    }

    function Typer(topElement, options) {
        if (!is(topElement, Node)) {
            options = topElement;
            topElement = topElement.element;
        }
        options = $.extend(true, {}, Typer.defaultOptions, options);

        var typer = this;
        var typerDocument;
        var topNodeType = options.inline || is(topElement, INNER_PTAG) ? NODE_EDITABLE_PARAGRAPH : NODE_EDITABLE;
        var widgets = [];
        var widgetOptions = {};
        var currentSelection;
        var undoable = {};
        var userFocus;
        var $self = $(topElement);

        function TyperTransaction() {
            this.originalSelection = new TyperSelection(currentSelection);
        }

        function getTargetedWidgets(eventMode) {
            switch (eventMode) {
                case EVENT_ALL:
                    return widgets.concat(currentSelection.widgets);
                case EVENT_STATIC:
                    return widgets;
                case EVENT_HANDLER:
                    return currentSelection.widgets.slice(0).reverse().concat(widgets);
                case EVENT_CURRENT:
                    return currentSelection.widgets.slice(-1);
            }
        }

        function triggerEvent(eventMode, eventName, value) {
            var widgets = $.makeArray(is(eventMode, TyperWidget) || getTargetedWidgets(eventMode));
            var handlerCalled;
            $.each(widgets, function (i, v) {
                var options = widgetOptions[v.id];
                if (isFunction(options[eventName])) {
                    handlerCalled = true;
                    return options[eventName].call(options, new TyperEvent(eventName, typer, v), value) !== false || eventMode !== EVENT_HANDLER;
                }
            });
            if (is(eventMode, TyperWidget)) {
                setTimeout(function () {
                    triggerEvent(EVENT_STATIC, 'widget' + capfirst(eventName), eventMode);
                });
            }
            return handlerCalled;
        }

        function getActiveRange() {
            if (selection.rangeCount) {
                var range = selection.getRangeAt(0);
                return containsOrEquals(topElement, range.commonAncestorContainer) && range;
            }
        }

        function createTyperDocument(rootElement, fireEvent) {
            var nodeMap = new WeakMap();
            var dirtyElements = [];
            var observer;

            function addChild(parent, node) {
                if (node.parentNode !== parent && node !== parent) {
                    if (node.parentNode) {
                        removeFromParent(node, true);
                    }
                    for (var index = parent.childNodes.length; index && compareRangePosition(node.element, parent.childNodes[index - 1].element) < 0; index--);
                    node.parentNode = parent;
                    node.previousSibling = parent.childNodes[index - 1];
                    node.nextSibling = parent.childNodes[index];
                    (node.previousSibling || {}).nextSibling = node;
                    (node.nextSibling || {}).previousSibling = node;
                    parent.childNodes.splice(index, 0, node);
                }
            }

            function removeFromParent(node, suppressEvent) {
                if (node.parentNode) {
                    var index = node.parentNode.childNodes.indexOf(node);
                    if (index >= 0) {
                        if (fireEvent && !suppressEvent && node.widget.element === node.element) {
                            node.widget.destroyed = true;
                            triggerEvent(node.widget, 'destroy');
                        }
                        node.parentNode.childNodes.splice(index, 1);
                        node.parentNode = null;
                        (node.previousSibling || {}).nextSibling = node.nextSibling;
                        (node.nextSibling || {}).previousSibling = node.previousSibling;
                    }
                }
            }

            function visitElement(element, childOnly) {
                var stack = [nodeMap.get(element)];

                function getWidget(node) {
                    if (!node.widget || !is(node.element, widgetOptions[node.widget.id].element)) {
                        if (node.widget && node.widget.element === node.element && fireEvent) {
                            node.widget.destroyed = true;
                            triggerEvent(node.widget, 'destroy');
                        }
                        delete node.widget;
                        $.each(widgetOptions, function (i, v) {
                            if (is(node.element, v.element)) {
                                node.widget = new TyperWidget(typer, i, node.element, v.options);
                                if (fireEvent) {
                                    triggerEvent(node.widget, 'init');
                                }
                                return false;
                            }
                        });
                    }
                    return node.widget;
                }

                function updateNodeFromElement(node) {
                    $.each(node.childNodes.slice(0), function (i, v) {
                        if (!containsOrEquals(rootElement, v.element)) {
                            removeFromParent(v);
                            nodeMap.delete(v.element);
                        }
                    });
                }

                updateNodeFromElement(stack[0]);

                // jQuery prior to 1.12.0 cannot directly apply selector to DocumentFragment
                var $children = childOnly ? $(element).children() : is(element, DocumentFragment) ? $(element).children().find('*').andSelf() : $('*', element);
                $children.each(function (i, v) {
                    while (!containsOrEquals(stack[0].element, v)) {
                        stack.shift();
                    }
                    if (tagName(v) === 'br') {
                        if (nodeMap.has(v) && is(stack[0], NODE_ANY_ALLOWTEXT)) {
                            removeFromParent(nodeMap.get(v));
                            nodeMap.delete(v);
                        }
                        return;
                    }

                    var unvisited = !nodeMap.has(v);
                    var node = nodeMap.get(v) || new TyperNode(0, v);
                    node.widget = !is(stack[0], NODE_WIDGET) && getWidget(node) || stack[0].widget;

                    var widgetOption = widgetOptions[node.widget.id];
                    if (node.widget === stack[0].widget && !is(stack[0], NODE_WIDGET)) {
                        node.nodeType = is(node.element, INNER_PTAG) ? NODE_PARAGRAPH : NODE_INLINE;
                    } else if (is(node.element, widgetOption.editable) || (widgetOption.inline && !widgetOption.editable)) {
                        node.nodeType = widgetOption.inline ? NODE_INLINE_EDITABLE : is(node.element, INNER_PTAG) ? NODE_EDITABLE_PARAGRAPH : NODE_EDITABLE;
                    } else {
                        node.nodeType = widgetOption.inline && !is(stack[0], NODE_INLINE_WIDGET) ? NODE_INLINE_WIDGET : NODE_WIDGET;
                    }
                    updateNodeFromElement(node);
                    addChild(stack[0], node);
                    nodeMap.set(v, node);
                    if (childOnly && unvisited) {
                        visitElement(v);
                    }
                    stack.unshift(node);
                });
            }

            function handleMutations(mutations) {
                var changedElements = $.map(mutations, function (v) {
                    return $(v.addedNodes).add(v.removedNodes).filter(':not(#Typer_RangeStart,#Typer_RangeEnd)')[0] ? v.target : null;
                });
                array.push.apply(dirtyElements, changedElements);
            }

            function ensureNode(element) {
                for (var root = element; !nodeMap.has(root); root = root.parentNode);
                visitElement(root);
                return nodeMap.get(element);
            }

            function ensureState() {
                if (observer) {
                    handleMutations(observer.takeRecords());
                } else {
                    replaceTimeout(ensureState, function () {
                        dirtyElements.push(null);
                    });
                }
                if (dirtyElements[0] === null) {
                    visitElement(dirtyElements.splice(0) && rootElement);
                } else if (dirtyElements[0]) {
                    $(rootElement.parentNode || rootElement).find($.unique(dirtyElements.splice(0))).each(function (i, v) {
                        visitElement(v, !!observer);
                    });
                }
            }

            if (!rootElement.parentNode) {
                rootElement = is(rootElement, DocumentFragment) || createDocumentFragment(rootElement);
            }
            if (window.MutationObserver && fireEvent) {
                observer = new MutationObserver(handleMutations);
                observer.observe(rootElement, {
                    subtree: true,
                    childList: true
                });
            }
            nodeMap.set(rootElement, new TyperNode(topNodeType, rootElement, new TyperWidget(typer, '__root__', topElement, options)));
            dirtyElements.push(null);

            return {
                get rootNode() {
                    return this.getNode(rootElement);
                },
                getNode: function (element) {
                    if (containsOrEquals(rootElement, element)) {
                        if (element.nodeType === 3 || tagName(element) === 'br') {
                            element = element.parentNode;
                        }
                        ensureState();
                        return nodeMap.get(element) || ensureNode(element);
                    }
                }
            };
        }

        function findWidgetWithCommand(name) {
            var widget;
            $.each(getTargetedWidgets(EVENT_HANDLER), function (i, v) {
                widget = isFunction((widgetOptions[v.id].commands || {})[name]) && v;
                return !widget;
            });
            return widget;
        }

        function select(startNode, startOffset, endNode, endOffset) {
            var range = createRange(startNode, startOffset, endNode, endOffset);
            if (range) {
                currentSelection = computeSelection(range);
            }
            if (containsOrEquals(document, topElement)) {
                selection.removeAllRanges();
                if (range) {
                    selection.addRange(createRange(currentSelection));
                }
            }
        }

        function getRangeFromTextOffset(node, offset) {
            if (node && node.nodeType !== 3) {
                var iterator = new TyperDOMNodeIterator(typerDocument.getNode(node), 4);
                if (offset) {
                    for (; iterator.nextNode() && offset > iterator.currentNode.length; offset -= iterator.currentNode.length);
                } else if (1 / offset < 0) {
                    while (iterator.nextNode());
                    offset = iterator.currentNode.length;
                }
                node = iterator.currentNode;
            }
            return createRange(node, +offset === offset ? offset : 0, true);
        }

        function getFocusNode(range) {
            var focusElement = range.commonAncestorContainer;
            if (range.startContainer === range.endContainer && range.endOffset - range.startOffset <= 1) {
                focusElement = is(focusElement.childNodes[range.startOffset], Element) || focusElement;
            }
            if (!containsOrEquals(topElement, focusElement)) {
                return typerDocument.rootNode;
            }
            var focusNode = typerDocument.getNode(focusElement);
            return is(focusNode, NODE_WIDGET) ? typerDocument.getNode(focusNode.widget.element) : focusNode;
        }

        function computeSelection(range) {
            if (!containsOrEquals(topElement, range.commonAncestorContainer)) {
                range = createRange(topElement, true);
            }

            function getBoundary(element, offset, end) {
                var textNode, textOffset;
                if (tagName(element) === 'br') {
                    textNode = element.nextSibling;
                    offset = 0;
                } else if (element.nodeType === 1 && element.childNodes[0]) {
                    if (end || offset === element.childNodes.length) {
                        element = element.childNodes[(offset || 1) - 1];
                        if (element.nodeType === 3) {
                            textNode = element;
                            element = textNode.parentNode;
                            offset = textNode.length;
                        }
                        end = true;
                    } else {
                        element = element.childNodes[offset];
                        if (!end && offset && element.nodeType === 1 && element.previousSibling.nodeType === 1) {
                            element = element.previousSibling;
                            end = true;
                        }
                        offset = 0;
                    }
                }
                if (element.nodeType === 3) {
                    textNode = element;
                    element = element.parentNode;
                }
                var node = typerDocument.getNode(element);
                while (node.parentNode && is(node, NODE_ANY_INLINE) && !is(node.parentNode, NODE_ANY_BLOCK_EDITABLE)) {
                    node = node.parentNode;
                }
                if (is(node, NODE_WIDGET | NODE_EDITABLE)) {
                    element = node.widget.element;
                    textNode = null;
                } else if (!textNode && element.nodeType === 1) {
                    var iterator2 = new TyperDOMNodeIterator(node, 4);
                    iterator2.currentNode = element;
                    while (iterator2.nextNode() && end);
                    textNode = iterator2.currentNode;
                    offset = end ? textNode && textNode.length : 0;
                }
                return {
                    node: node,
                    element: element,
                    textNode: textNode,
                    offset: offset
                };
            }

            var startPoint = getBoundary(range.startContainer, range.startOffset);
            var endPoint = range.collapsed ? startPoint : getBoundary(range.endContainer, range.endOffset, true);
            return $.extend(new TyperSelection(), {
                isCaret: range.collapsed,
                caretPosition: (range.collapsed && compareRangePosition(range, startPoint.node.element)) || 0,
                focusNode: getFocusNode(range),
                startNode: startPoint.node,
                startElement: startPoint.element,
                startTextNode: startPoint.textNode || null,
                startOffset: startPoint.offset || 0,
                endNode: endPoint.node,
                endElement: endPoint.element,
                endTextNode: endPoint.textNode || null,
                endOffset: endPoint.offset || 0,
            });
        }

        function updateState(fireEvent) {
            var activeRange = getActiveRange();
            if (activeRange || fireEvent === true) {
                currentSelection = computeSelection(activeRange || createRange(currentSelection));
            }
            if (fireEvent !== false) {
                triggerEvent(EVENT_ALL, 'beforeStateChange');
                triggerEvent(EVENT_ALL, 'stateChange');
            }
        }

        function removeNode(element) {
            if (is(element, 'li:only-child')) {
                element = element.parentNode;
            }
            $(element).remove();
        }

        function normalize(range) {
            range = is(range, Range) || createRange(range || topElement, true);
            codeUpdate(function () {
                var selection = computeSelection(range);
                if (is(selection.focusNode, NODE_EDITABLE) && !selection.focusNode.childNodes[0]) {
                    $(EMPTY_LINE).appendTo(selection.focusNode.element);
                    return;
                }
                if (is(selection.focusNode, NODE_EDITABLE_PARAGRAPH) && !selection.focusNode.childDOMNodes[0]) {
                    $(createTextNode(ZWSP)).appendTo(selection.focusNode.element);
                    return;
                }
                iterate(selection.createTreeWalker(-1), function (node) {
                    if (is(node, NODE_ANY_ALLOWTEXT)) {
                        // WebKit adds dangling <BR> element when a line is empty
                        // normalize it into a ZWSP and continue process
                        var lastBr = $('br:last-child', node.element)[0];
                        if (lastBr && !lastBr.nextSibling) {
                            $(createTextNode()).insertBefore(lastBr);
                            removeNode(lastBr);
                        }
                        var firstBr = $('br:first-child', node.element)[0];
                        if (firstBr && !firstBr.previousSibling) {
                            removeNode(firstBr);
                        }
                        var hasTextNodes;
                        $(node.childDOMNodes).each(function (i, v) {
                            if (v.nodeType === 3) {
                                if (!v.nodeValue) {
                                    if ((!v.previousSibling && !v.nextSibling) || tagName(v.previousSibling) === 'br') {
                                        v.nodeValue = ZWSP;
                                    } else if (!currentSelection || compareRangePosition(v, currentSelection, true)) {
                                        removeNode(v);
                                    }
                                } else if (v.length > 1 && (v.previousSibling || v.nextSibling)) {
                                    if (v.nodeValue.charAt(0) === ZWSP) {
                                        v = v.splitText(1);
                                        removeNode(v.previousSibling);
                                    } else if (v.nodeValue.slice(-1) === ZWSP) {
                                        v.splitText(v.length - 1);
                                        removeNode(v.nextSibling);
                                    } else if (/\b\u00a0$/.test(v.nodeValue) && v.nextSibling && v.nextSibling.nodeType === 3 && !/^[^\S\u00a0]/.test(v.nextSibling.nodeValue)) {
                                        // prevent unintended non-breaking space (&nbsp;) between word boundaries when inserting contents
                                        v.nodeValue = v.nodeValue.slice(0, -1) + ' ';
                                    }
                                }
                                hasTextNodes = true;
                            }
                        });
                        if (!hasTextNodes) {
                            $(createTextNode()).appendTo(node.element);
                        }
                    }
                    if (is(node.element, Node)) {
                        if (!is(node, NODE_WIDGET) && (!currentSelection || !rangeIntersects(currentSelection, node.element))) {
                            node.element.normalize();
                            if (is(node, NODE_INLINE)) {
                                if (tagName(node.element.previousSibling) === tagName(node.element) && compareAttrs(node.element, node.element.previousSibling)) {
                                    $(node.element).contents().appendTo(node.element.previousSibling);
                                    removeNode(node.element);
                                } else if (VOID_TAGS.indexOf(tagName(node.element)) < 0 && node.element.childElementCount === 0 && !trim(node.element.textContent)) {
                                    removeNode(node.element);
                                }
                            } else if (is(node, NODE_EDITABLE)) {
                                $(node.element).contents().each(function (i, v) {
                                    if (v.nodeType === 3) {
                                        if (trim(v.nodeValue)) {
                                            $(v).wrap('<p>');
                                        } else {
                                            removeNode(v);
                                        }
                                    }
                                });
                                if (!node.element.childNodes[0]) {
                                    $(EMPTY_LINE).appendTo(node.element);
                                }
                            } else if (is(node, NODE_EDITABLE_PARAGRAPH)) {
                                $(createTextNode(ZWSP)).appendTo(node.element);
                            }
                        }
                    }
                });
                // Mozilla adds <br type="_moz"> when a container is empty
                $('br[type="_moz"]', topElement).remove();

                // IE fires input and text-input event on the innermost element where the caret positions at
                // the event does not bubble up so need to trigger manually on the top element
                // also IE use all lowercase letter in the event name
                $(IS_IE && '*', topElement).each(function (i, v) {
                    if (!$(v).data('typerIEFix')) {
                        $(v).data('typerIEFix', true);
                        $(v).bind('input textinput', function (e) {
                            if (!suppressIETextInput) {
                                $self.trigger(e);
                            }
                        });
                    }
                });
            });
        }

        function extractContents(range, mode, callback) {
            var method = mode === 'cut' ? 'extractContents' : mode === 'paste' ? 'deleteContents' : 'cloneContents';
            var cloneNode = mode !== 'paste';
            var clearNode = mode !== 'copy';
            var fragment = document.createDocumentFragment();
            var startPoint, endPoint;

            function getInsertionPoint(node) {
                return createRange(node, (compareRangePosition(range, node) < 0 ? COLLAPSE_START_OUTSIDE : COLLAPSE_END_OUTSIDE) | (node !== typerDocument.getNode(node).widget.element && node.nodeType === 1));
            }

            range = createRange(range);
            if (!range.collapsed) {
                var state = computeSelection(range);
                if (isFunction(callback)) {
                    startPoint = getInsertionPoint(state.startTextNode || state.startElement);
                    endPoint = state.isSingleEditable ? getInsertionPoint(state.endTextNode || state.endElement) : startPoint;
                }
                var stack = [[topElement, fragment]];
                iterate(state.createTreeWalker(-1, function (node) {
                    while (is(node.element, Node) && !containsOrEquals(stack[0][0], node.element)) {
                        stack.shift();
                    }
                    if (rangeCovers(range, node.element)) {
                        if (cloneNode) {
                            $(stack[0][1]).append(node.cloneDOMNodes(true));
                        }
                        if (clearNode) {
                            if (is(node, NODE_EDITABLE)) {
                                $(node.element).html(EMPTY_LINE);
                            } else if (is(node, NODE_EDITABLE_PARAGRAPH)) {
                                $(node.element).html(ZWSP_ENTITIY);
                            } else {
                                removeNode(node.element);
                            }
                        }
                        return 2;
                    }
                    var content = is(node, NODE_ANY_ALLOWTEXT) && createRange(node.element, range)[method]();
                    if (cloneNode) {
                        if (node.element !== topElement && (!is(node, NODE_PARAGRAPH | NODE_INLINE) || (content && tagName(content.firstChild) !== tagName(node.element)))) {
                            var clonedNode = node.cloneDOMNodes(false);
                            stack[0][1].appendChild(clonedNode);
                            if (!is(clonedNode, DocumentFragment)) {
                                stack.unshift([node.element, clonedNode]);
                            }
                        }
                        if (content) {
                            stack[0][1].appendChild(content);
                        }
                    }
                    return is(node, NODE_ANY_ALLOWTEXT) ? 2 : 1;
                }));
            }
            if (isFunction(callback)) {
                startPoint = startPoint || createRange(range, true);
                endPoint = endPoint || createRange(range, false);
                var newState = computeSelection(createRange(startPoint, endPoint));

                // check if current insertion point is an empty editable element
                // normalize before inserting content
                if (is(newState.startNode, NODE_ANY_BLOCK_EDITABLE) && newState.startNode === newState.endNode) {
                    normalize(range);
                    newState = computeSelection(createRange(newState.startNode.element, true));
                }
                // ensure start point lies within valid selection
                if (compareRangePosition(startPoint, newState.startNode.element) < 0) {
                    startPoint = createRange(newState.startNode.element, COLLAPSE_START_INSIDE);
                }
                callback(newState, startPoint, endPoint);
            } else {
                normalize(range);
            }
            updateState(false);
            return fragment;
        }

        function insertContents(range, content) {
            if (!is(content, Node)) {
                content = String(content || '').replace(/\u000d/g, '').replace(/</g, '&lt;').replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>').replace(/.+/, '<p>$&</p>').replace(/<p>(<|$)/g, '<p>' + ZWSP_ENTITIY + '$1') || EMPTY_LINE;
            }
            content = $.map(createDocumentFragment(content).childNodes, function (v) {
                // make sure no dangling text exists in the inserting document
                return v.nodeType === 3 || tagName(v) === 'br' ? $(v).wrap('<p>').parent()[0] : v;
            });
            extractContents(range, 'paste', function (state, startPoint, endPoint) {
                var allowedWidgets = ('__root__ ' + (widgetOptions[state.focusNode.widget.id].allowedWidgets || '*')).split(' ');
                var startNode = state.startNode;
                var endNode = state.endNode;
                var document = createTyperDocument(content);
                var nodes = document.rootNode.childNodes.slice(0);
                var needGlue = !nodes[1] && (!nodes[0] || is(nodes[0], NODE_ANY_ALLOWTEXT)) && startNode !== endNode;
                var hasInsertedText, newPoint;

                var formattingNodes;
                if (is(startNode, NODE_EDITABLE_PARAGRAPH)) {
                    formattingNodes = [];
                } else if (is(startNode, NODE_PARAGRAPH)) {
                    formattingNodes = [startNode.element];
                } else if (is(startNode, NODE_ANY_INLINE)) {
                    formattingNodes = $(state.startElement).parentsUntil(startNode.element).andSelf().get().reverse();
                } else {
                    formattingNodes = [createElement('p')];
                }

                while (nodes[0]) {
                    var node = nodes.pop();
                    if (node.widget.id === '__unknown__' || (allowedWidgets[1] !== '*' && allowedWidgets.indexOf(node.widget.id) < 0)) {
                        var textContent = node.widget.id === '__unknown__' ? node.element.textContent : extractText(node.element);
                        node = new TyperNode(NODE_INLINE, wrapNode(createTextNode(textContent), formattingNodes), node.parentNode.widget);
                    }
                    var inlineNodes = is(node, NODE_ANY_INLINE) ? [node.element] : node.childDOMNodes.slice(0);
                    var needSplit = is(node, NODE_WIDGET) || !is(endNode, NODE_ANY_ALLOWTEXT) || (nodes[0] && !hasInsertedText && !is(endNode, NODE_EDITABLE_PARAGRAPH));

                    if (needSplit) {
                        var splitEnd = createRange(endNode.element, COLLAPSE_END_OUTSIDE);
                        var splitContent = createRange(endPoint, splitEnd).extractContents();
                        var splitFirstNode = splitContent.childNodes[0];

                        if (splitContent.textContent || (splitFirstNode && (!is(node, NODE_ANY_ALLOWTEXT) || inlineNodes[0]))) {
                            splitEnd.insertNode(splitContent);
                            endNode = getFocusNode(splitEnd);
                            endPoint = splitEnd;
                            if (splitContent.textContent) {
                                newPoint = newPoint || createRange(endNode.element, COLLAPSE_START_INSIDE);
                            }
                        }
                        // insert the last paragraph of text being inserted to the newly created paragraph if any
                        if (is(node, NODE_ANY_ALLOWTEXT)) {
                            if (inlineNodes[0]) {
                                if (is(endNode, NODE_ANY_ALLOWTEXT)) {
                                    (createRange(splitFirstNode, COLLAPSE_START_INSIDE) || endPoint).insertNode(wrapNode(inlineNodes, formattingNodes.slice(0, -1)));
                                } else {
                                    splitEnd.insertNode(wrapNode(inlineNodes, formattingNodes));
                                }
                                newPoint = newPoint || createRange(inlineNodes.slice(-1)[0], COLLAPSE_END_INSIDE);
                                hasInsertedText = true;
                            }
                            continue;
                        }
                    }
                    if (is(node, NODE_WIDGET | NODE_ANY_BLOCK_EDITABLE)) {
                        endPoint.insertNode(node.element);
                        newPoint = newPoint || createRange(node.element, COLLAPSE_END_OUTSIDE);
                    } else {
                        if (nodes[0]) {
                            endPoint.insertNode(wrapNode(inlineNodes, hasInsertedText ? formattingNodes : formattingNodes.slice(0, -1)));
                        } else if (inlineNodes[0]) {
                            startPoint.insertNode(startNode ? createDocumentFragment(inlineNodes) : wrapNode(inlineNodes, formattingNodes));
                        } else {
                            continue;
                        }
                        newPoint = newPoint || createRange(inlineNodes.slice(-1)[0], COLLAPSE_END_INSIDE);
                        hasInsertedText = true;
                    }
                }
                if (needGlue) {
                    var gluePoint = createRange(formattingNodes[0] || startNode.element, COLLAPSE_END_INSIDE);
                    newPoint = newPoint || startPoint.cloneRange();
                    gluePoint.insertNode(createRange(endNode.element, true).extractContents());
                    removeNode(endNode.element);
                }
                normalize(createRange(startPoint, newPoint || endPoint));
                select(newPoint || endPoint);
            });
        }

        function extractText(content) {
            if (containsOrEquals(topElement, content)) {
                content = extractContents(content, 'copy');
            }
            var text = '';
            var document = createTyperDocument(content);
            $.each(document.rootNode.childNodes, function (i, v) {
                if (is(v, NODE_WIDGET | NODE_EDITABLE) && isFunction(widgetOptions[v.widget.id].text)) {
                    text += (text && '\n\n') + widgetOptions[v.widget.id].text(v.widget);
                    return;
                }
                iterate(new TyperTreeWalker(v, NODE_ANY_ALLOWTEXT | NODE_SHOW_EDITABLE, function (v) {
                    text += text && '\n\n';
                    iterate(new TyperDOMNodeIterator(v, 5, function (v) {
                        text += v.nodeValue || (tagName(v) === 'br' ? '\n' : '');
                    }));
                    return 2;
                }));
            });
            return text;
        }

        function initUndoable() {
            var MARKER_ATTR = ['x-typer-end', 'x-typer-start'];
            var lastValue = topElement.outerHTML;
            var snapshots = [lastValue];
            var currentIndex = 0;

            function checkActualChange() {
                var value = trim(topElement.innerHTML.replace(/\s+x-typer-(start|end)(="\d+")?|(?!>)\u200b(?!<\/)/g, ''));
                if (value !== lastValue) {
                    triggerEvent(EVENT_ALL, 'change', value);
                    lastValue = value;
                    return true;
                }
            }

            function setMarker(node, offset, start) {
                if (node && node.nodeType === 3) {
                    var wholeTextOffset = 0;
                    $.each(iterateToArray(new TyperDOMNodeIterator(typerDocument.getNode(node), 4)), function (i, v) {
                        wholeTextOffset += v === node ? offset : v.length;
                        return v !== node;
                    });
                    $(node.parentNode).attr(MARKER_ATTR[+start], wholeTextOffset);
                } else if (node) {
                    $(node).attr(MARKER_ATTR[+start], '');
                }
            }

            function getRangeFromMarker(start) {
                var attr = MARKER_ATTR[+start];
                var element = $self.find('[' + attr + ']')[0] || $self.filter('[' + attr + ']')[0];
                var offset = +$(element).attr(attr);
                if (element) {
                    $(element).removeAttr(attr);
                    return +offset === offset ? getRangeFromTextOffset(element, offset) : createRange(element, start ? COLLAPSE_START_OUTSIDE : COLLAPSE_END_OUTSIDE);
                }
            }

            function takeSnapshot() {
                updateState(true);
                setMarker(currentSelection.startTextNode || currentSelection.startElement, currentSelection.startOffset, true);
                if (!currentSelection.isCaret) {
                    setMarker(currentSelection.endTextNode || currentSelection.endElement, currentSelection.endOffset, false);
                }
                var newValue = topElement.outerHTML;
                if (newValue !== snapshots[0]) {
                    var hasChange = checkActualChange();
                    snapshots.splice(0, currentIndex + !hasChange, newValue);
                    snapshots.splice(options.historyLevel);
                    currentIndex = 0;
                }
                $self.find('[x-typer-start], [x-typer-end]').andSelf().removeAttr('x-typer-start x-typer-end');
            }

            function applySnapshot(value) {
                var content = $.parseHTML(value)[0];
                $self.empty().append(content.childNodes).attr(attrs(content));
                select(getRangeFromMarker(true), getRangeFromMarker(false));
                updateState(true);
                checkActualChange();
            }

            $.extend(undoable, {
                canUndo: function () {
                    return currentIndex < snapshots.length - 1;
                },
                canRedo: function () {
                    return currentIndex > 0;
                },
                undo: function () {
                    if (undoable.canUndo()) {
                        applySnapshot(snapshots[++currentIndex]);
                    }
                },
                redo: function () {
                    if (undoable.canRedo()) {
                        applySnapshot(snapshots[--currentIndex]);
                    }
                },
                snapshot: function (delay) {
                    replaceTimeout('snapshot');
                    if (delay) {
                        replaceTimeout('snapshot', takeSnapshot, delay);
                    } else if (delay !== false) {
                        takeSnapshot();
                    }
                }
            });
        }

        function normalizeInputEvent() {
            var lastInputTime = 0;
            var mousedown;
            var composition;
            var modifierCount;
            var modifiedKeyCode;
            var keyDefaultPrevented;
            var hasKeyEvent;
            var activeWidget;
            var selectDirection;

            function triggerWidgetFocusout() {
                var widget = activeWidget;
                if (activeWidget && !activeWidget.destroyed) {
                    activeWidget = null;
                    triggerEvent(widget, 'focusout');
                }
            }

            function sparseSnapshot(e) {
                setTimeout(function () {
                    undoable.snapshot(e.timeStamp - lastInputTime < 50 ? 50 : 0);
                    lastInputTime = e.timeStamp;
                });
            }

            function handleKeyStroke(eventName) {
                if (!/(backspace|(?:left|shiftLeft|up|shiftUp)Arrow)|(delete|(?:right|shiftRight|down|shiftDown)Arrow)/g.test(eventName)) {
                    return false;
                }
                var direction = RegExp.$1 ? -1 : 1;
                var textEnd = direction < 0 ? currentSelection.textStart : currentSelection.textEnd;

                switch (eventName) {
                    case 'backspace':
                    case 'delete':
                        var nextTextNode = direction < 0 ? currentSelection.previousTextNode : currentSelection.nextTextNode;
                        if (currentSelection.isCaret && currentSelection.startTextNode && !textEnd) {
                            return false;
                        }
                        if (!currentSelection.isCaret) {
                            insertContents(currentSelection, '');
                        } else if (!currentSelection.startTextNode) {
                            if (currentSelection.caretPosition === direction) {
                                select(nextTextNode, direction < 0 ? COLLAPSE_END_INSIDE : COLLAPSE_START_INSIDE);
                                return false;
                            }
                            select(currentSelection.startElement);
                        } else if (!nextTextNode) {
                            if (currentSelection.textStart && currentSelection.textEnd) {
                                removeNode(currentSelection.startElement);
                            }
                            select(direction < 0 ? currentSelection.previousNode.element : currentSelection.nextNode.element);
                        } else if (direction < 0) {
                            insertContents(createRange(nextTextNode, -0, currentSelection.startTextNode, 0), '');
                        } else {
                            insertContents(createRange(currentSelection.startTextNode, -0, nextTextNode, 0), '');
                        }
                        return true;
                    case 'leftArrow':
                    case 'rightArrow':
                    case 'shiftLeftArrow':
                    case 'shiftRightArrow':
                        var nextTextNode2 = direction < 0 ? currentSelection.previousTraversableTextNode : currentSelection.nextTraversableTextNode;
                        if (textEnd && nextTextNode2) {
                            if (eventName.charAt(0) !== 's') {
                                select(getRangeFromTextOffset(nextTextNode2, 0 * direction));
                                return true;
                            }
                            var nextWidget = typerDocument.getNode(nextTextNode2).widget;
                            if (nextWidget !== currentSelection.focusNode.widget) {
                                select(createRange(nextWidget.element, COLLAPSE_START_OUTSIDE), createRange(currentSelection));
                                return true;
                            }
                        }
                        break;
                    case 'upArrow':
                    case 'downArrow':
                    case 'shiftUpArrow':
                    case 'shiftDownArrow':
                        if (currentSelection.isCaret) {
                            selectDirection = direction;
                        }
                        var currentRange = createRange(currentSelection);
                        var currentPoint = createRange(currentRange, selectDirection < 0);
                        var rect = currentPoint.getBoundingClientRect();
                        for (var y = rect.top ; true; y += rect.height * direction) {
                            var newPoint = getRangeFromPoint(rect.left, y);
                            if (!newPoint || !containsOrEquals(topElement, newPoint.startContainer)) {
                                return false;
                            }
                            var newRect = newPoint.getBoundingClientRect();
                            if (compareRangePosition(newPoint, currentPoint) && newRect.top !== rect.top && !is(getFocusNode(newPoint), NODE_WIDGET)) {
                                newPoint = getRangeFromPoint(rect.left, newRect.top);
                                select(newPoint, eventName.charAt(0) !== 's' || createRange(currentRange, selectDirection > 0));
                                return true;
                            }
                        }
                }
            }

            $self.mousedown(function (e) {
                var anchorPoint = getRangeFromPoint(e.originalEvent.clientX, e.originalEvent.clientY);
                var handlers = {
                    mousemove: function (e) {
                        if (!e.which && mousedown) {
                            handlers.mouseup();
                            return;
                        }
                        var range = createRange(anchorPoint, getRangeFromPoint(e.originalEvent.clientX, e.originalEvent.clientY));
                        select(computeSelection(range));
                        replaceTimeout(normalizeInputEvent, updateState);
                        e.preventDefault();
                    },
                    mouseup: function () {
                        mousedown = false;
                        $(document.body).unbind(handlers);
                        replaceTimeout(normalizeInputEvent, function () {
                            updateState();
                            normalize(currentSelection.focusNode.element);
                            undoable.snapshot();
                        });
                    }
                };
                $(document.body).bind(handlers);
                mousedown = true;
                e.stopPropagation();
            });

            $self.bind('compositionstart compositionupdate compositionend', function (e) {
                e.stopPropagation();
                composition = e.type.substr(-3) !== 'end';
            });

            $self.bind('keydown keypress keyup', function (e) {
                e.stopPropagation();
                triggerWidgetFocusout();
                if (composition) {
                    e.stopImmediatePropagation();
                    return;
                }
                hasKeyEvent = true;
                setTimeout(function () {
                    hasKeyEvent = false;
                });
                var isModifierKey = ($.inArray(e.keyCode, [16, 17, 18, 91, 93]) >= 0);
                var isSpecialKey = !isModifierKey && KEYNAMES[e.keyCode] !== String.fromCharCode(e.keyCode).toLowerCase();
                if (e.type === 'keydown') {
                    modifierCount = e.ctrlKey + e.shiftKey + e.altKey + e.metaKey + !isModifierKey;
                    modifierCount *= isSpecialKey || ((modifierCount > 2 || (modifierCount > 1 && !e.shiftKey)) && !isModifierKey);
                    modifiedKeyCode = e.keyCode;
                    if (modifierCount) {
                        var keyEventName = lowfirst(((e.ctrlKey || e.metaKey) ? 'Ctrl' : '') + (e.altKey ? 'Alt' : '') + (e.shiftKey ? 'Shift' : '') + capfirst(KEYNAMES[modifiedKeyCode] || String.fromCharCode(e.charCode)));
                        if (triggerEvent(EVENT_HANDLER, keyEventName) || (handleKeyStroke(keyEventName) && (undoable.snapshot(), 1)) || /ctrl(?![axcvr]$)|alt|enter/i.test(keyEventName)) {
                            keyDefaultPrevented = true;
                            e.preventDefault();
                            return;
                        }
                    }
                    keyDefaultPrevented = false;
                    replaceTimeout(normalizeInputEvent, function () {
                        updateState();
                        normalize(currentSelection.focusNode.element);
                    });
                } else if (e.type === 'keypress') {
                    if (modifierCount || !e.charCode) {
                        e.stopImmediatePropagation();
                    }
                } else {
                    if ((e.keyCode === modifiedKeyCode || isModifierKey) && modifierCount--) {
                        e.stopImmediatePropagation();
                    }
                    if (!keyDefaultPrevented && !isModifierKey) {
                        updateState();
                        sparseSnapshot(e);
                    }
                }
            });

            $self.bind('compositionstart keypress textInput textinput', function (e) {
                undoable.snapshot(false);
                if (!currentSelection.startTextNode || currentSelection.paragraphElements[1]) {
                    if (e.type !== 'compositionstart') {
                        e.preventDefault();
                    }
                    var inputText = e.originalEvent.data || String.fromCharCode(e.charCode) || '';
                    if (currentSelection.startTextNode || !triggerEvent(EVENT_CURRENT, 'textInput', inputText)) {
                        insertContents(currentSelection, inputText);
                        undoable.snapshot();
                        return;
                    }
                }
                sparseSnapshot(e);
            });

            $self.bind('dragstart', function (e) {
                var dragSelection = createRange(currentSelection);
                var handlers = {
                    drop: function (e) {
                        var range = getRangeFromPoint(e.originalEvent.clientX, e.originalEvent.clientY);
                        var content = extractContents(dragSelection, e.ctrlKey ? 'copy' : 'cut');
                        insertContents(range, content);
                        undoable.snapshot();
                        e.preventDefault();
                        $self.unbind(handlers);
                    }
                };
                $self.bind(handlers);
                e.stopPropagation();
            });

            $self.bind('cut copy', function (e) {
                var clipboardData = e.originalEvent.clipboardData || window.clipboardData;
                var content = extractContents(currentSelection, e.type);
                var textContent = extractText(content);
                if (window.clipboardData) {
                    clipboardData.setData('Text', textContent);
                } else {
                    clipboardData.setData('text/plain', textContent);
                    clipboardData.setData('text/html', $('<div id="Typer">').append(content)[0].outerHTML);
                    clipboardData.setData('application/x-typer', 'true');
                }
                e.stopPropagation();
                e.preventDefault();
            });

            $self.bind('paste', function (e) {
                var clipboardData = e.originalEvent.clipboardData || window.clipboardData;
                if ($.inArray('application/x-typer', clipboardData.types) >= 0) {
                    var html = clipboardData.getData('text/html');
                    var content = createDocumentFragment($(html).filter('#Typer').contents());
                    insertContents(currentSelection, content);
                } else if ($.inArray('text/plain', clipboardData.types) >= 0) {
                    insertContents(currentSelection, clipboardData.getData('text/plain'));
                } else if (window.clipboardData) {
                    insertContents(currentSelection, clipboardData.getData('Text'));
                }
                undoable.snapshot();
                e.stopPropagation();
                e.preventDefault();
                if (IS_IE) {
                    // IE put the caret in the wrong position after user code
                    // need to reposition the caret
                    setTimeout(function () {
                        select(currentSelection);
                    });
                }
            });

            $self.bind('mouseup mscontrolselect', function (e) {
                // disable resize handle on image element on IE and Firefox
                // also select the whole widget when clicking on uneditable elements
                var node = typerDocument.getNode(e.target);
                if (activeWidget !== node.widget) {
                    triggerWidgetFocusout();
                }
                var range = getActiveRange();
                if (is(node, NODE_WIDGET | NODE_INLINE_WIDGET) && (!range || range.collapsed || !rangeIntersects(range, node.element) || getFocusNode(range) === node)) {
                    if (IS_IE) {
                        setTimeout(function () {
                            select(node.widget.element);
                        });
                    }
                    select(node.widget.element);
                    if (activeWidget !== node.widget) {
                        activeWidget = node.widget;
                        triggerEvent(node.widget, 'focusin');
                    }
                }
            });

            $self.bind('focusin', function () {
                setTimeout(function () {
                    if (!userFocus) {
                        triggerEvent(EVENT_ALL, 'focusin');
                        if (!mousedown) {
                            select(currentSelection);
                        }
                    }
                    windowFocusedOut = false;
                    userFocus = null;
                });
            });

            $self.bind('focusout', function () {
                setTimeout(function () {
                    if (!windowFocusedOut && !userFocus) {
                        triggerWidgetFocusout();
                        triggerEvent(EVENT_ALL, 'focusout');
                    }
                });
            });
        }

        function activateWidget(name, settings) {
            if ((options[name] || options.widgets[name]) && (settings.inline || topNodeType === NODE_EDITABLE)) {
                widgetOptions[name] = Object.create(settings);
                widgetOptions[name].options = $.extend(Object.create(settings.options || null), options[name]);
                if (!settings.element) {
                    widgets.push(new TyperWidget(typer, name, null, widgetOptions[name].options));
                }
            }
        }

        function initWidgets() {
            widgets[0] = new TyperWidget(typer, '__core__');
            widgets[1] = new TyperWidget(typer, '__root__');
            $.each(options.widgets, activateWidget);
            $.each(Typer.widgets, activateWidget);

            widgetOptions.__root__ = options;
            widgetOptions.__core__ = {
                ctrlZ: undoable.undo,
                ctrlY: undoable.redo,
                ctrlShiftZ: undoable.redo,
                escape: function () {
                    topElement.blur();
                    select();
                }
            };
            widgetOptions.__unknown__ = {
                // make all other tags that are not considered paragraphs and inlines to be widgets
                // to avoid unknown behavior while editing
                element: options.disallowedElement || ':not(' + INNER_PTAG + ',br,b,em,i,u,strike,small,strong,sub,sup,ins,del,mark,span)'
            };
        }

        initUndoable();
        initWidgets();
        normalizeInputEvent();

        var retainFocusHandlers = {
            focusin: function (e) {
                userFocus = e.currentTarget;
            },
            focusout: function (e) {
                var focusoutTarget = e.currentTarget;
                setTimeout(function () {
                    if (userFocus === focusoutTarget && !getActiveRange()) {
                        userFocus = null;
                        $self.trigger('focusout');
                    }
                });
            }
        };

        $.extend(typer, {
            element: topElement,
            canUndo: undoable.canUndo,
            canRedo: undoable.canRedo,
            undo: undoable.undo,
            redo: undoable.redo,
            hasCommand: function (command) {
                return !!findWidgetWithCommand(command);
            },
            widgetEnabled: function (id) {
                return widgetOptions.hasOwnProperty(id);
            },
            getStaticWidgets: function () {
                return widgets.slice(0);
            },
            getSelection: function () {
                return new TyperSelection(currentSelection);
            },
            select: function (startNode, startOffset, endNode, endOffset) {
                select(startNode, startOffset, endNode, endOffset);
                undoable.snapshot();
            },
            moveCaret: function (node, offset) {
                select(getRangeFromTextOffset(node, offset));
                undoable.snapshot();
            },
            retainFocus: function (element) {
                $(element).bind(retainFocusHandlers);
            },
            invoke: function (command, value) {
                codeUpdate(function () {
                    var tx = new TyperTransaction();
                    if (typeof command === 'string') {
                        tx.commandName = command;
                        tx.widget = findWidgetWithCommand(command);
                        command = tx.widget && widgetOptions[tx.widget.id].commands[command];
                    }
                    if (isFunction(command)) {
                        command.call(typer, tx, value);
                    }
                });
                updateState();
                undoable.snapshot();
            }
        });

        definePrototype(TyperTransaction, {
            widget: null,
            remove: removeNode,
            normalize: normalize,
            invoke: typer.invoke,
            hasCommand: typer.hasCommand,
            insertText: function (text) {
                insertContents(currentSelection, text);
            },
            insertHtml: function (content) {
                insertContents(currentSelection, createDocumentFragment(content));
            },
            insertWidget: function (name, options) {
                if (widgetOptions[name] && isFunction(widgetOptions[name].insert)) {
                    widgetOptions[name].insert(this, options);
                }
            },
            removeWidget: function (widget) {
                if (isFunction(widgetOptions[widget.id].remove)) {
                    widgetOptions[widget.id].remove(this, widget);
                } else if (widgetOptions[widget.id].remove === 'keepText') {
                    var textContent = extractText(widget.element);
                    $(widget.element).replaceWith(createTextNode(textContent));
                } else {
                    removeNode(widget.element);
                }
            },
            execCommand: function (commandName, value) {
                document.execCommand(commandName, false, value || '');
                updateState(false);
            },
            getSelectedText: function () {
                var content = extractContents(currentSelection, 'copy');
                return extractText(content);
            },
            getSelectedTextNodes: function () {
                splitTextBoundary(currentSelection);
                return $.map(currentSelection.selectedElements, function (v) {
                    return $(v).contents().filter(function (i, v) {
                        return v.nodeType === 3 && comparePosition(currentSelection.startTextNode, v) <= 0 && comparePosition(currentSelection.endTextNode, v) >= 0;
                    });
                });
            },
            select: function (startNode, startOffset, endNode, endOffset) {
                select(startNode, startOffset, endNode, endOffset);
                updateState(false);
            },
            moveCaret: function (node, offset) {
                select(getRangeFromTextOffset(node, offset));
                updateState(false);
            },
            restoreSelection: function () {
                select(this.originalSelection);
                updateState(false);
            }
        });

        defineLazyProperties(TyperTransaction.prototype, {
            selection: function () {
                return new TyperSelection(currentSelection);
            }
        });

        $self.attr('contenteditable', 'true');
        typerDocument = this.document = createTyperDocument(topElement, true);
        currentSelection = computeSelection(createRange(topElement, COLLAPSE_START_INSIDE));
        normalize();
        triggerEvent(EVENT_STATIC, 'init');
    }

    window.Typer = Typer;

    $.extend(Typer, {
        COLLAPSE_START_INSIDE: COLLAPSE_START_INSIDE,
        COLLAPSE_START_OUTSIDE: COLLAPSE_START_OUTSIDE,
        COLLAPSE_END_INSIDE: COLLAPSE_END_INSIDE,
        COLLAPSE_END_OUTSIDE: COLLAPSE_END_OUTSIDE,
        NODE_WIDGET: NODE_WIDGET,
        NODE_PARAGRAPH: NODE_PARAGRAPH,
        NODE_EDITABLE: NODE_EDITABLE,
        NODE_EDITABLE_PARAGRAPH: NODE_EDITABLE_PARAGRAPH,
        NODE_INLINE: NODE_INLINE,
        NODE_INLINE_WIDGET: NODE_INLINE_WIDGET,
        NODE_INLINE_EDITABLE: NODE_INLINE_EDITABLE,
        NODE_OUTER_PARAGRAPH: NODE_OUTER_PARAGRAPH,
        NODE_SHOW_EDITABLE: NODE_SHOW_EDITABLE,
        ZWSP: ZWSP,
        ZWSP_ENTITIY: ZWSP_ENTITIY,
        trim: trim,
        iterate: iterate,
        iterateToArray: iterateToArray,
        compareAttrs: compareAttrs,
        comparePosition: comparePosition,
        compareRangePosition: compareRangePosition,
        containsOrEquals: containsOrEquals,
        createElement: createElement,
        createTextNode: createTextNode,
        createRange: createRange,
        rangeIntersects: rangeIntersects,
        rangeCovers: rangeCovers,
        getRangeFromPoint: getRangeFromPoint,
        defaultOptions: {
            historyLevel: 100,
            disallowedWidgets: 'keepText',
            widgets: {}
        },
        widgets: {}
    });

    definePrototype(TyperNode, {
        get childDOMNodes() {
            return slice(this.element.childNodes);
        },
        get firstChild() {
            return this.childNodes[0] || null;
        },
        get lastChild() {
            return this.childNodes.slice(-1)[0] || null;
        },
        createRange: function (collapse) {
            return createRange(this.element, +collapse === collapse ? collapse : !!collapse);
        },
        createDOMNodeIterator: function (whatToShow, filter) {
            return new TyperDOMNodeIterator(this, whatToShow, filter);
        },
        cloneDOMNodes: function (deep) {
            return this.element.cloneNode(deep);
        }
    });

    function treeWalkerIsNodeVisible(inst, node) {
        return node && ((inst.whatToShow & NODE_SHOW_EDITABLE) || !is(node, NODE_WIDGET | NODE_ANY_BLOCK_EDITABLE));
    }

    function treeWalkerAcceptNode(inst, node, checkWidget) {
        if (checkWidget && !treeWalkerIsNodeVisible(inst, node)) {
            return 2;
        }
        if (is(node, NODE_WIDGET) && is(node.parentNode, NODE_WIDGET)) {
            return 3;
        }
        return acceptNode(inst, node);
    }

    function treeWalkerNodeAccepted(inst, node, checkWidget) {
        treeWalkerAcceptNode.returnValue = treeWalkerAcceptNode(inst, node, checkWidget);
        if (treeWalkerAcceptNode.returnValue === 1) {
            inst.currentNode = node;
            return true;
        }
    }

    function treeWalkerTraverseChildren(inst, pChild, pSib) {
        var node = inst.currentNode[pChild];
        while (node) {
            if (treeWalkerNodeAccepted(inst, node, true)) {
                return node;
            }
            if (treeWalkerAcceptNode.returnValue === 3 && node[pChild]) {
                node = node[pChild];
                continue;
            }
            while (!node[pSib]) {
                node = treeWalkerIsNodeVisible(inst, node.parentNode) && node.parentNode;
                if (!node || node === inst.root || node === inst.currentNode) {
                    return null;
                }
            }
            node = node[pSib];
        }
    }

    function treeWalkerTraverseSibling(inst, pChild, pSib) {
        var node = inst.currentNode;
        while (node && node !== inst.root) {
            var sibling = node[pSib];
            while (sibling) {
                if (treeWalkerNodeAccepted(inst, sibling)) {
                    return sibling;
                }
                sibling = (treeWalkerAcceptNode.returnValue === 2 || !sibling[pChild]) ? sibling[pSib] : sibling[pChild];
            }
            node = treeWalkerIsNodeVisible(inst, node.parentNode) && node.parentNode;
            if (!node || node === inst.root || treeWalkerAcceptNode(inst, node, true) === 1) {
                return null;
            }
        }
    }

    definePrototype(TyperTreeWalker, {
        previousSibling: function () {
            return treeWalkerTraverseSibling(this, 'firstChild', 'nextSibling');
        },
        nextSibling: function () {
            return treeWalkerTraverseSibling(this, 'lastChild', 'previousSibling');
        },
        firstChild: function () {
            return treeWalkerTraverseChildren(this, 'firstChild', 'nextSibling');
        },
        lastChild: function () {
            return treeWalkerTraverseChildren(this, 'lastChild', 'previousSibling');
        },
        parentNode: function () {
            for (var node = this.currentNode; node && node !== this.root; node = node.parentNode) {
                if (treeWalkerNodeAccepted(this, node.parentNode, true)) {
                    return node.parentNode;
                }
            }
        },
        previousNode: function () {
            var node = this.currentNode;
            while (node && node !== this.root) {
                for (var sibling = node.previousSibling; sibling; sibling = node.previousSibling) {
                    node = sibling;
                    var rv = treeWalkerAcceptNode(this, sibling);
                    while (rv !== 2 && treeWalkerIsNodeVisible(this, node.childNodes[0]) && node.childNodes[0]) {
                        node = node.lastChild;
                        rv = treeWalkerAcceptNode(this, node, true);
                    }
                    if (rv === 1) {
                        this.currentNode = node;
                        return node;
                    }
                }
                node = treeWalkerIsNodeVisible(this, node.parentNode) && node.parentNode;
                if (!node || node === this.root) {
                    return null;
                }
                if (treeWalkerNodeAccepted(this, node, true)) {
                    return node;
                }
            }
        },
        nextNode: function () {
            var node = this.currentNode;
            var rv = 1;
            while (node) {
                while (rv !== 2 && node.childNodes[0]) {
                    node = node.firstChild;
                    if (treeWalkerNodeAccepted(this, node, true)) {
                        return node;
                    }
                    rv = treeWalkerAcceptNode.returnValue;
                }
                while (node && node !== this.root && !node.nextSibling) {
                    node = treeWalkerIsNodeVisible(this, node.parentNode) && node.parentNode;
                }
                if (!node || node === this.root) {
                    return null;
                }
                node = node.nextSibling;
                if (treeWalkerNodeAccepted(this, node)) {
                    return node;
                }
                rv = treeWalkerAcceptNode.returnValue;
            }
        }
    });

    function nodeIteratorCreateNodeIterator(inst, dir) {
        var node = inst.typerNodeIterator.currentNode;
        if (!is(node, NODE_ANY_ALLOWTEXT)) {
            return document.createNodeIterator(node.element, 0, null, false);
        }
        var iterator = document.createTreeWalker(node.element, inst.whatToShow | 1, function (v) {
            return acceptNode(inst, v) | 1;
        }, false);
        if (dir === 'previousNode') {
            var before = inst.currentNode;
            while (iterator.lastChild());
            while (comparePosition(before, iterator.currentNode, true) <= 0 && iterator[dir]());
        }
        return iterator;
    }

    function nodeIteratorTraverse(inst, dir) {
        var before = inst.currentNode;
        if (inst.iterator[dir]()) {
            if (inst.currentNode.parentNode !== before.parentNode && inst.typerNodeIterator[dir]()) {
                inst.iteratorStack.unshift({
                    dir: dir,
                    iterator: inst.iterator
                });
                inst.iterator = nodeIteratorCreateNodeIterator(inst, dir);
                if (acceptNode(inst.iterator) === 1 || inst.iterator[dir]()) {
                    return inst.currentNode;
                }
            }
            return inst.currentNode;
        }
        while (inst.iteratorStack[0]) {
            var d = inst.iteratorStack.shift();
            if (d.dir === dir) {
                inst.iterator = d.iterator;
                return inst.currentNode;
            }
        }
        while (inst.typerNodeIterator[dir]()) {
            inst.iterator = nodeIteratorCreateNodeIterator(inst, dir);
            if (acceptNode(inst.iterator) === 1 || inst.iterator[dir]()) {
                return inst.currentNode;
            }
        }
    }

    definePrototype(TyperDOMNodeIterator, {
        get currentNode() {
            return this.iterator.currentNode;
        },
        set currentNode(node) {
            this.iterator.currentNode = node;
        },
        previousNode: function () {
            return nodeIteratorTraverse(this, 'previousNode');
        },
        nextNode: function () {
            return nodeIteratorTraverse(this, 'nextNode');
        }
    });

    defineLazyProperties(TyperDOMNodeIterator.prototype, {
        iterator: function () {
            var t = this.typerNodeIterator;
            if (!is(t.currentNode, NODE_ANY_ALLOWTEXT)) {
                t.nextNode();
            }
            this.iteratorStack = [];
            return nodeIteratorCreateNodeIterator(this);
        }
    });

    function typerSelectionDeepIterator(inst, whatToShow, filter) {
        var range = createRange(inst);
        return new TyperTreeWalker(inst.focusNode, whatToShow | NODE_SHOW_EDITABLE, function (v) {
            return !rangeIntersects(v.element, range) ? 2 : !filter ? 1 : filter(v);
        });
    }

    function typerSelectionSiblingIterator(node, whatToShow, startDOMNode) {
        for (var root = node; root.parentNode; root = root.parentNode);
        var iterator = new TyperTreeWalker(root, whatToShow);
        iterator.currentNode = node;
        if (startDOMNode) {
            iterator = new TyperDOMNodeIterator(iterator, 4);
            iterator.currentNode = startDOMNode;
        }
        return iterator;
    }

    function typerSelectionGetWidgets(inst) {
        var nodes = [];
        for (var node = inst.focusNode; node; node = node.parentNode) {
            if (is(node, NODE_ANY_BLOCK_EDITABLE | NODE_INLINE_EDITABLE)) {
                nodes.unshift(node);
            }
        }
        return nodes;
    }

    definePrototype(TyperSelection, {
        getSelectedElements: function (selector) {
            return $(this.selectedElements).filter(selector || '*').get();
        },
        getEditableElements: function (widget, selector) {
            return $(widget.element).find(this.editableElements).filter(selector || '*').get();
        },
        createTreeWalker: function (whatToShow, filter) {
            return typerSelectionDeepIterator(this, whatToShow, filter);
        },
        createDOMNodeIterator: function (whatToShow, filter) {
            return new TyperDOMNodeIterator(typerSelectionDeepIterator(this, NODE_WIDGET | NODE_ANY_ALLOWTEXT), whatToShow, filter);
        }
    });

    defineLazyProperties(TyperSelection.prototype, {
        widgets: function () {
            return $.map(typerSelectionGetWidgets(this), mapFn('widget'));
        },
        editableElements: function () {
            return $.map(typerSelectionGetWidgets(this).concat(iterateToArray(typerSelectionDeepIterator(this, NODE_ANY_BLOCK_EDITABLE))), mapFn('element'));
        },
        paragraphElements: function () {
            var iterator = new TyperTreeWalker(this.focusNode, NODE_PARAGRAPH | NODE_SHOW_EDITABLE);
            var nodes = iterateToArray(iterator, null, this.startNode);
            nodes.splice(nodes.indexOf(this.endNode) + 1);
            return $.map(nodes, mapFn('element'));
        },
        selectedElements: function () {
            return iterateToArray(typerSelectionDeepIterator(this, NODE_ANY_ALLOWTEXT), mapFn('element'));
        },
        previousNode: function () {
            return typerSelectionSiblingIterator(this.startNode, NODE_PARAGRAPH | NODE_WIDGET).previousNode() || null;
        },
        nextNode: function () {
            return typerSelectionSiblingIterator(this.endNode, NODE_PARAGRAPH | NODE_WIDGET).nextNode() || null;
        },
        previousTextNode: function () {
            return typerSelectionSiblingIterator(this.startNode, NODE_ANY_ALLOWTEXT, this.startTextNode || this.startElement).previousNode() || null;
        },
        nextTextNode: function () {
            return typerSelectionSiblingIterator(this.endNode, NODE_ANY_ALLOWTEXT, this.endTextNode || this.endElement).nextNode() || null;
        },
        previousTraversableTextNode: function () {
            return typerSelectionSiblingIterator(this.startNode, NODE_ANY_ALLOWTEXT | NODE_SHOW_EDITABLE, this.startTextNode || this.startElement).previousNode() || null;
        },
        nextTraversableTextNode: function () {
            return typerSelectionSiblingIterator(this.endNode, NODE_ANY_ALLOWTEXT | NODE_SHOW_EDITABLE, this.endTextNode || this.endElement).nextNode() || null;
        },
        textStart: function () {
            if (this.startTextNode && (!this.startOffset || this.startTextNode.nodeValue.slice(0, this.startOffset) === ZWSP)) {
                return !this.previousTextNode || (!rangeCovers(this.startNode.element, this.previousTextNode) || (tagName(this.previousTextNode.nextSibling) === 'br' && this.startTextNode.previousSibling === this.previousTextNode.nextSibling));
            }
        },
        textEnd: function () {
            if (this.endTextNode && (this.endOffset === this.endTextNode.length || this.endTextNode.nodeValue.slice(this.endOffset) === ZWSP)) {
                return !this.nextTextNode || (!rangeCovers(this.endNode.element, this.nextTextNode) || (tagName(this.nextTextNode.previousSibling) === 'br' && this.endTextNode.nextSibling === this.nextTextNode.previousSibling));
            }
        },
        isSingleEditable: function () {
            return !iterateToArray(typerSelectionDeepIterator(this, NODE_ANY_BLOCK_EDITABLE))[1];
        }
    });

    definePrototype(TyperWidget, {
        remove: function () {
            var self = this;
            self.typer.invoke(function (tx) {
                tx.removeWidget(self);
            });
        }
    });

    // disable Mozilla and IE object resizing and inline table editing controls
    if (!IS_IE) {
        try {
            document.designMode = 'on';
            document.execCommand('enableObjectResizing', false, false);
            document.execCommand('enableInlineTableEditing', false, false);
        } catch (e) { }
        document.designMode = 'off';
    }

    $(window).bind('focusin focusout', function (e) {
        if (e.target === window || e.target === document.body) {
            windowFocusedOut = e.type === 'focusout';
        }
    });

    // polyfill for WeakMap
    // simple and good enough as we only need to associate data to a DOM object
    if (typeof WeakMap === 'undefined') {
        WeakMap = function () {
            Object.defineProperty(this, '__dataKey__', {
                value: 'typer' + Math.random().toString(36).substr(2, 8)
            });
        };
        definePrototype(WeakMap, {
            get: function (key) {
                return key[this.__dataKey__];
            },
            set: function (key, value) {
                key[this.__dataKey__] = value;
            },
            has: function (key) {
                return this.__dataKey__ in key;
            },
            delete: function (key) {
                delete key[this.__dataKey__];
            }
        });
    }

} (jQuery, window, document, String, Node, Range, DocumentFragment, window.WeakMap, []));
