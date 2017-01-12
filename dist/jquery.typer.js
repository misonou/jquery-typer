/*!
 * jQuery Typer Plugin v0.9.0
 *
 * The MIT License (MIT)
 *
 * Copyright (c) 2016
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

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

    function TyperSelection(typer, range) {
        this.typer = typer;
        this.baseCaret = new TyperCaret(typer, this);
        this.extendCaret = new TyperCaret(typer, this);
        if (range) {
            this.select(range);
        }
    }

    function TyperWidget(typer, id, element, options) {
        this.typer = typer;
        this.id = id;
        this.element = element || null;
        this.options = options || {};
    }

    function TyperEvent(eventName, typer, widget, data) {
        this.eventName = eventName;
        this.typer = typer;
        this.widget = widget || null;
        this.data = data !== undefined ? data : null;
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

    function TyperCaret(typer, selection) {
        this.typer = typer;
        this.selection = selection;
    }

    function replaceTimeout(source, fn, milliseconds) {
        clearTimeout(replaceTimeout[source.name]);
        replaceTimeout[source.name] = fn && setTimeout(fn, milliseconds);
    }

    function defineProperty(obj, name, value, enumerable) {
        Object.defineProperty(obj, name, {
            enumerable: enumerable !== false,
            configurable: true,
            writable: true,
            value: value
        });
    }

    function definePrototype(fn, prototype) {
        fn.prototype = prototype;
        defineProperty(prototype, 'constructor', fn, false);
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
            for (var cur; (cur = iterator.nextNode()); callback && callback(cur));
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

    function connected(a, b) {
        return a && b && !((a.commonAncestorContainer || a).compareDocumentPosition(b.commonAncestorContainer || b) & 1);
    }

    function containsOrEquals(container, contained) {
        return container === contained || $.contains(container, contained);
    }

    function getCommonAncestor(a, b) {
        for (b = b || a; a && a !== b && a.compareDocumentPosition(b) !== 20; a = a.parentNode);
        return a;
    }

    function getOffset(node, offset) {
        var len = node.length || node.childNodes.length;
        return (offset === len || (offset === 0 && 1 / offset === -Infinity)) ? len : (len + offset) % len || 0;
    }

    function getWholeTextOffset(node, textNode) {
        var iterator = new TyperDOMNodeIterator(node, 4);
        for (var offset = 0, cur; (cur = iterator.nextNode()) && cur !== textNode; offset += cur.length);
        return offset;
    }

    function createRange(startNode, startOffset, endNode, endOffset) {
        if (startNode && isFunction(startNode.getRange)) {
            return startNode.getRange();
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
                if (is(endNode, Node) && connected(startNode, endNode)) {
                    if (+endOffset === endOffset) {
                        range.setEnd(endNode, getOffset(endNode, endOffset));
                    } else {
                        range[endOffset ? 'setEndBefore' : 'setEndAfter'](endNode);
                    }
                }
            } else {
                range[(startOffset === true || (startOffsetNum && (startOffset & 1)) || !startNode.parentNode) ? 'selectNodeContents' : 'selectNode'](startNode);
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
        if (is(startOffset, Range) && connected(range, startOffset)) {
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
        a = is(a, Range) || createRange(a);
        b = is(b, Range) || createRange(b);
        return connected(a, b) && a.compareBoundaryPoints(3, b) <= 0 && a.compareBoundaryPoints(1, b) >= 0;
    }

    function rangeCovers(a, b) {
        a = is(a, Range) || createRange(a);
        b = is(b, Range) || createRange(b);
        return connected(a, b) && a.compareBoundaryPoints(0, b) <= 0 && a.compareBoundaryPoints(2, b) >= 0;
    }

    function rangeEquals(a, b) {
        a = is(a, Range) || createRange(a);
        b = is(b, Range) || createRange(b);
        return connected(a, b) && a.compareBoundaryPoints(0, b) === 0 && a.compareBoundaryPoints(2, b) === 0;
    }

    function compareRangePosition(a, b, strict) {
        a = is(a, Range) || createRange(a);
        b = is(b, Range) || createRange(b);
        var value = !connected(a, b) ? NaN : a.compareBoundaryPoints(0, b) + a.compareBoundaryPoints(2, b);
        return (strict && ((value !== 0 && rangeIntersects(a, b)) || (value === 0 && !rangeEquals(a, b)))) ? NaN : value && value / Math.abs(value);
    }

    function rectEquals(a, b) {
        return a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height;
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

    function getActiveRange(container) {
        if (selection.rangeCount) {
            var range = selection.getRangeAt(0);
            return containsOrEquals(container, range.commonAncestorContainer) && range;
        }
    }

    function caretRangeFromPoint(x, y) {
        function distanceFromRect(rect) {
            var distX = rect.left > x ? rect.left - x : Math.min(0, rect.left + rect.width - x);
            var distY = rect.top > y ? rect.top - y : Math.min(0, rect.top + rect.height - y);
            return !distX || !distY ? distX || distY : distY > 0 ? Infinity : -Infinity;
        }

        function distanceFromCharacter(node, index) {
            return distanceFromRect(createRange(node, index, true).getClientRects()[0] || {});
        }

        if (document.caretRangeFromPoint) {
            return document.caretRangeFromPoint(x, y);
        }
        if (document.caretPositionFromPoint) {
            var pos = document.caretPositionFromPoint(x, y);
            return createRange(pos.offsetNode, pos.offset, true);
        }
        if (document.body.createTextRange) {
            var element = document.elementFromPoint(x, y);
            for (var dist, nextElement; dist !== Infinity; dist = Infinity, element = nextElement || element) {
                for (var i = 0, length = element.childNodes.length; i < length; i++) {
                    var node = element.childNodes[i];
                    if (node.nodeType === 1 && tagName(node) !== 'br') {
                        var thisDist = Math.abs(distanceFromRect(node.getBoundingClientRect()));
                        if (thisDist > dist) {
                            break;
                        }
                        dist = thisDist;
                        nextElement = node;
                    } else if (node.nodeType === 3 && distanceFromCharacter(node, node.length - 1) > 0) {
                        var b0 = 0, b1 = node.length;
                        while (b1 - b0 > 1) {
                            var mid = (b1 + b0) >> 1;
                            var p = distanceFromCharacter(node, mid) < 0;
                            b0 = p ? mid : b0;
                            b1 = p ? b1 : mid;
                        }
                        return createRange(node, Math.abs(distanceFromCharacter(node, b0)) < Math.abs(distanceFromCharacter(node, b1)) ? b0 : b1, true);
                    }
                }
            }
            return createRange(element, COLLAPSE_END_INSIDE);
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

    function removeNode(node) {
        $(node).remove();
    }

    function wrapNode(content, parentNodes) {
        $.each(parentNodes, function (i, v) {
            content = $(v.cloneNode(false)).append(content)[0];
        });
        return is(content, Node) || createDocumentFragment(content);
    }

    function applyRange(range) {
        try {
            selection.removeAllRanges();
        } catch (e) {
            // IE fails to clear ranges by removeAllRanges() in occasions mentioned in
            // http://stackoverflow.com/questions/22914075
            var r = document.body.createTextRange();
            r.collapse();
            r.select();
            selection.removeAllRanges();
        }
        selection.addRange(range);
    }

    function Typer(topElement, options) {
        if (!is(topElement, Node)) {
            options = topElement;
            topElement = topElement.element;
        }
        options = $.extend(true, {}, (!options || options.defaultOptions !== false) && Typer.defaultOptions, options);

        var typer = this;
        var typerDocument;
        var topNodeType = options.inline || is(topElement, INNER_PTAG) ? NODE_EDITABLE_PARAGRAPH : NODE_EDITABLE;
        var widgets = [];
        var widgetOptions = {};
        var currentSelection;
        var suppressSnapshot;
        var undoable = {};
        var userFocus;
        var $self = $(topElement);

        function TyperTransaction() { }

        function getTargetedWidgets(eventMode) {
            switch (eventMode) {
                case EVENT_ALL:
                    return widgets.concat(currentSelection.getWidgets());
                case EVENT_STATIC:
                    return widgets;
                case EVENT_HANDLER:
                    return currentSelection.getWidgets().reverse().concat(widgets);
                case EVENT_CURRENT:
                    return currentSelection.getWidgets().slice(-1);
            }
        }

        function findWidgetWithCommand(name) {
            var widget;
            $.each(getTargetedWidgets(EVENT_HANDLER), function (i, v) {
                widget = isFunction((widgetOptions[v.id].commands || {})[name]) && v;
                return !widget;
            });
            return widget;
        }

        function triggerEvent(eventMode, eventName, value) {
            var widgets = $.makeArray(is(eventMode, TyperWidget) || getTargetedWidgets(eventMode));
            var handlerCalled;
            $.each(widgets, function (i, v) {
                var options = widgetOptions[v.id];
                if (isFunction(options[eventName])) {
                    handlerCalled = true;
                    return options[eventName].call(options, new TyperEvent(eventName, typer, v, value)) !== false || eventMode !== EVENT_HANDLER;
                }
            });
            if (is(eventMode, TyperWidget)) {
                setTimeout(function () {
                    triggerEvent(EVENT_STATIC, 'widget' + capfirst(eventName), eventMode);
                });
            }
            return handlerCalled;
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

            function updateNode(node, context) {
                context = context || node.parentNode || nodeMap.get(rootElement);
                if (!is(context, NODE_WIDGET) && (!node.widget || !is(node.element, widgetOptions[node.widget.id].element))) {
                    delete node.widget;
                    $.each(widgetOptions, function (i, v) {
                        if (is(node.element, v.element)) {
                            node.widget = new TyperWidget(typer, i, node.element, v.options);
                            return false;
                        }
                    });
                }
                node.widget = node.widget || context.widget;
                var widgetOption = widgetOptions[node.widget.id];
                if (node.widget === context.widget && !is(context, NODE_WIDGET)) {
                    node.nodeType = is(node.element, INNER_PTAG) ? NODE_PARAGRAPH : NODE_INLINE;
                } else if (is(node.element, widgetOption.editable) || (widgetOption.inline && !widgetOption.editable)) {
                    node.nodeType = widgetOption.inline ? NODE_INLINE_EDITABLE : is(node.element, INNER_PTAG) ? NODE_EDITABLE_PARAGRAPH : NODE_EDITABLE;
                } else {
                    node.nodeType = widgetOption.inline && !is(context, NODE_INLINE_WIDGET) ? NODE_INLINE_WIDGET : NODE_WIDGET;
                }
            }

            function updateNodeFromElement(node) {
                $.each(node.childNodes.slice(0), function (i, v) {
                    if (!containsOrEquals(rootElement, v.element)) {
                        removeFromParent(v);
                        nodeMap.delete(v.element);
                    }
                });
            }

            function visitElement(element, childOnly) {
                var stack = [nodeMap.get(element)];
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
                    var originalWidget = node.widget;
                    addChild(stack[0], node);
                    updateNodeFromElement(node);
                    updateNode(node);
                    if (node.widget !== originalWidget && fireEvent) {
                        if (originalWidget) {
                            originalWidget.destroyed = true;
                            triggerEvent(originalWidget, 'destroy');
                        }
                        triggerEvent(node.widget, 'init');
                    }
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

            function getNode(element) {
                ensureState();
                if (containsOrEquals(rootElement, element)) {
                    if (element.nodeType === 3 || tagName(element) === 'br') {
                        element = element.parentNode;
                    }
                    return nodeMap.get(element) || ensureNode(element);
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
                getNode: getNode,
                getEditableNode: function (element) {
                    var focusNode = getNode(element) || nodeMap.get(rootElement);
                    return is(focusNode, NODE_WIDGET) ? getNode(focusNode.widget.element) : focusNode;
                }
            };
        }

        function getRangeFromTextOffset(node, offset) {
            var caret = new TyperCaret(typer);
            caret.moveToText(node, offset);
            return caret.getRange();
        }

        function updateState(fireEvent) {
            var activeRange = getActiveRange(topElement);
            if (activeRange && !rangeEquals(activeRange, createRange(currentSelection))) {
                currentSelection.select(activeRange);
            }
            if (fireEvent !== false) {
                triggerEvent(EVENT_ALL, 'beforeStateChange');
                triggerEvent(EVENT_ALL, 'stateChange');
            }
        }

        function normalize(range) {
            range = is(range, Range) || createRange(range || topElement, true);
            codeUpdate(function () {
                var selection = new TyperSelection(typer, range);
                if (is(selection.focusNode, NODE_EDITABLE) && !selection.focusNode.childNodes[0]) {
                    $(EMPTY_LINE).appendTo(selection.focusNode.element);
                    return;
                }
                if (is(selection.focusNode, NODE_EDITABLE_PARAGRAPH) && !selection.focusNode.element.childNodes[0]) {
                    $(createTextNode()).appendTo(selection.focusNode.element);
                    return;
                }
                var selectedRange = createRange(currentSelection);
                iterate(selection.createTreeWalker(NODE_ANY_ALLOWTEXT | NODE_EDITABLE | NODE_SHOW_EDITABLE), function (node) {
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
                        $(node.element).contents().each(function (i, v) {
                            if (/\b\u00a0$/.test(v.nodeValue) && v.nextSibling && v.nextSibling.nodeType === 3 && !/^[^\S\u00a0]/.test(v.nextSibling.nodeValue)) {
                                // prevent unintended non-breaking space (&nbsp;) between word boundaries when inserting contents
                                v.nodeValue = v.nodeValue.slice(0, -1) + ' ';
                            }
                        });
                        if (!/\S/.test(node.element.textContent)) {
                            $(createTextNode()).appendTo(node.element);
                        }
                    }
                    if (!rangeIntersects(selectedRange, node.element)) {
                        node.element.normalize();
                        $(node.element).contents().each(function (i, v) {
                            if (v.nodeType === 3) {
                                v.nodeValue = v.nodeValue.replace(/(?=.)\u200b+(?=.)|^[^\S\u00a0]+|[^\S\u00a0]+$/g, '').replace(/\b\u00a0\b/g, ' ');
                            }
                        });
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
            range = is(range, Range) || createRange(range);

            var method = mode === 'cut' ? 'extractContents' : mode === 'paste' ? 'deleteContents' : 'cloneContents';
            var cloneNode = mode !== 'paste';
            var clearNode = mode !== 'copy';
            var fragment = document.createDocumentFragment();
            var state = new TyperSelection(typer, range);
            var isSingleEditable = state.isSingleEditable;

            if (!range.collapsed) {
                var stack = [[topElement, fragment]];
                iterate(state.createTreeWalker(-1, function (node) {
                    while (is(node.element, Node) && !containsOrEquals(stack[0][0], node.element)) {
                        stack.shift();
                    }
                    if (rangeCovers(range, node.element)) {
                        if (cloneNode) {
                            $(stack[0][1]).append(node.element.cloneNode(true));
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
                            var clonedNode = node.element.cloneNode(false);
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
                var startPoint = createRange(range, true);
                var endPoint = !isSingleEditable ? startPoint : createRange(range, false);
                var newState = new TyperSelection(typer, createRange(startPoint, endPoint));

                // check if current insertion point is an empty editable element
                // normalize before inserting content
                if (is(newState.startNode, NODE_ANY_BLOCK_EDITABLE) && newState.startNode === newState.endNode) {
                    normalize(range);
                    newState = new TyperSelection(typer, createRange(newState.startNode.element, true));
                }
                // ensure start point lies within valid selection
                if (compareRangePosition(startPoint, newState.startNode.element) < 0) {
                    startPoint = createRange(newState.startNode.element, COLLAPSE_START_INSIDE);
                }
                callback(newState, startPoint, endPoint);
            } else {
                normalize(range);
                undoable.snapshot();
            }
            return fragment;
        }

        function insertContents(range, content) {
            if (!is(content, Node)) {
                content = String(content || '').replace(/\u000d/g, '').replace(/</g, '&lt;').replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>').replace(/.*/, '<p>$&</p>');
            }
            content = slice(createDocumentFragment(content).childNodes);

            extractContents(range, 'paste', function (state, startPoint, endPoint) {
                var allowedWidgets = ('__root__ ' + (widgetOptions[state.focusNode.widget.id].allowedWidgets || '*')).split(' ');
                var caretPoint = startPoint.cloneRange();
                var insertAsInline = is(state.startNode, NODE_ANY_ALLOWTEXT);
                var paragraphAsInline = true;
                var hasInsertedBlock;
                var newPoint;

                var formattingNodes;
                if (is(state.startNode, NODE_EDITABLE_PARAGRAPH)) {
                    formattingNodes = [];
                } else if (is(state.startNode, NODE_PARAGRAPH)) {
                    formattingNodes = [state.startNode.element];
                } else if (is(state.startNode, NODE_ANY_INLINE)) {
                    formattingNodes = $(state.startElement).parentsUntil(state.startNode.element).andSelf().get().reverse();
                } else {
                    formattingNodes = [createElement('p')];
                }

                while (content[0]) {
                    var nodeToInsert = content.shift();
                    var node = new TyperNode(NODE_INLINE, nodeToInsert);
                    if (nodeToInsert.nodeType === 1 && tagName(nodeToInsert) !== 'br') {
                        startPoint.insertNode(nodeToInsert);
                        node = typerDocument.getNode(nodeToInsert);
                        removeNode(nodeToInsert);
                        if (node.widget.id === '__unknown__' || (allowedWidgets[1] !== '*' && allowedWidgets.indexOf(node.widget.id) < 0)) {
                            nodeToInsert = createTextNode(node.widget.id === '__unknown__' ? nodeToInsert.textContent : extractText(nodeToInsert));
                            node = new TyperNode(NODE_INLINE, nodeToInsert);
                        }
                    }
                    if (!is(node, NODE_ANY_ALLOWTEXT) || (!is(node, NODE_ANY_INLINE) && !paragraphAsInline)) {
                        var splitLastNode = typerDocument.getEditableNode(caretPoint.startContainer);
                        while (!is(splitLastNode.parentNode, NODE_ANY_BLOCK_EDITABLE)) {
                            splitLastNode = splitLastNode.parentNode;
                        }
                        var splitEnd = createRange(splitLastNode.element, COLLAPSE_END_OUTSIDE);
                        var splitContent = createRange(caretPoint, splitEnd).extractContents();
                        var splitFirstNode = splitContent.childNodes[0];
                        splitEnd.insertNode(splitContent);

                        if (!/\S/.test(splitLastNode.element.textContent)) {
                            caretPoint.insertNode(createTextNode());
                        }
                        if (!/\S/.test(splitFirstNode.textContent)) {
                            splitFirstNode.appendChild(createTextNode());
                        }
                        if (splitLastNode.element.textContent.slice(-1) === ' ') {
                            var n1 = iterateToArray(document.createNodeIterator(splitLastNode.element, 4, null, false)).filter(mapFn('nodeValue')).slice(-1)[0];
                            n1.nodeValue = n1.nodeValue.slice(0, -1) + '\u00a0';
                        }
                        if (splitFirstNode.textContent.charAt(0) === ' ') {
                            var n2 = iterateToArray(document.createNodeIterator(splitFirstNode, 4, null, false)).filter(mapFn('nodeValue'))[0];
                            n2.nodeValue = '\u00a0' + n2.nodeValue.slice(1);
                        }
                        caretPoint = createRange(splitFirstNode || splitEnd, COLLAPSE_START_INSIDE);
                        newPoint = newPoint || caretPoint.cloneRange();
                        endPoint = createRange(splitEnd, false);
                        paragraphAsInline = true;
                        hasInsertedBlock = true;
                    }
                    insertAsInline = insertAsInline && is(node, NODE_ANY_ALLOWTEXT);
                    if (is(node, NODE_ANY_INLINE)) {
                        nodeToInsert = wrapNode(nodeToInsert, insertAsInline ? formattingNodes.slice(0, -1) : formattingNodes);
                    } else if (insertAsInline && paragraphAsInline) {
                        nodeToInsert = createDocumentFragment(nodeToInsert.childNodes);
                    }
                    if (insertAsInline) {
                        caretPoint.insertNode(nodeToInsert);
                        caretPoint.collapse(false);
                        paragraphAsInline = false;
                    } else {
                        var caretNode = typerDocument.getEditableNode(caretPoint.startContainer);
                        if (is(caretNode, NODE_ANY_BLOCK_EDITABLE)) {
                            caretPoint.insertNode(nodeToInsert);
                        } else {
                            createRange(caretNode.element, COLLAPSE_START_OUTSIDE).insertNode(nodeToInsert);
                        }
                        caretPoint = createRange(nodeToInsert, COLLAPSE_END_INSIDE);
                        insertAsInline = is(node, NODE_ANY_ALLOWTEXT);
                        hasInsertedBlock = true;
                    }
                }
                if (!hasInsertedBlock && state.startNode !== state.endNode && is(state.startNode, NODE_PARAGRAPH) && is(state.endNode, NODE_PARAGRAPH)) {
                    createRange(state.startNode.element, COLLAPSE_END_INSIDE).insertNode(createRange(state.endNode.element, true).extractContents());
                    removeNode(state.endNode.element);
                }
                normalize(createRange(startPoint, caretPoint));
                currentSelection.select(newPoint || caretPoint, true);
            });
        }

        function extractText(content) {
            if (containsOrEquals(topElement, content)) {
                content = extractContents(content, 'copy');
            }
            var text = '';
            var rootNode = createTyperDocument(content).getNode(content);
            $.each(rootNode.childNodes, function (i, v) {
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
                    $(node.parentNode).attr(MARKER_ATTR[+start], getWholeTextOffset(typerDocument.getNode(node), node) + offset);
                } else if (node) {
                    $(node).attr(MARKER_ATTR[+start], '');
                }
            }

            function getRangeFromMarker(start) {
                var attr = MARKER_ATTR[+start];
                var element = $self.find('[' + attr + ']')[0] || $self.filter('[' + attr + ']')[0];
                var offset = parseInt($(element).attr(attr));
                if (element) {
                    $(element).removeAttr(attr);
                    return +offset === offset ? getRangeFromTextOffset(element, offset) : createRange(element, start ? COLLAPSE_START_OUTSIDE : COLLAPSE_END_OUTSIDE);
                }
            }

            function takeSnapshot() {
                updateState();
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
                currentSelection.select(getRangeFromMarker(true), getRangeFromMarker(false));
                updateState();
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
                    } else if (delay !== false && !suppressSnapshot) {
                        takeSnapshot();
                    } else {
                        updateState(false);
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

            function deleteNextContent(e) {
                if (!currentSelection.isCaret) {
                    insertContents(currentSelection, '');
                } else {
                    var selection = currentSelection.clone();
                    if (selection.moveByCharacter('extend', e.eventName === 'backspace' ? -1 : 1) && selection.isSingleEditable) {
                        insertContents(selection, '');
                    }
                }
            }

            function handleTextInput(inputText, compositionend) {
                if (inputText && triggerEvent(EVENT_CURRENT, 'textInput', inputText)) {
                    return true;
                }
                if (compositionend || !currentSelection.startTextNode || !currentSelection.isCaret) {
                    insertContents(currentSelection, inputText);
                    return true;
                }
            }

            $self.mousedown(function (e) {
                var handlers = {
                    mousemove: function (e) {
                        if (!e.which && mousedown) {
                            handlers.mouseup();
                            return;
                        }
                        currentSelection.moveToPoint('extend', e.clientX, e.clientY);
                        setTimeout(function () {
                            currentSelection.focus();
                        });
                        replaceTimeout(normalizeInputEvent, updateState);
                        e.preventDefault();
                    },
                    mouseup: function () {
                        mousedown = false;
                        $(document.body).unbind(handlers);
                        replaceTimeout(normalizeInputEvent, function () {
                            normalize(currentSelection.focusNode.element);
                            undoable.snapshot();
                        });
                    }
                };
                currentSelection.moveToPoint(e.clientX, e.clientY);
                $(document.body).bind(handlers);
                mousedown = true;
                e.stopPropagation();
            });

            $self.bind('compositionstart compositionupdate compositionend', function (e) {
                e.stopPropagation();
                composition = e.type.slice(-1) !== 'd';
                if (!composition) {
                    var range = getActiveRange(topElement);
                    createRange(range.startContainer, range.startOffset - e.originalEvent.data.length, range.startContainer, range.startOffset).deleteContents();
                    updateState(false);
                    handleTextInput(e.originalEvent.data, true);
                } else {
                    handleTextInput('');
                }
            });

            $self.bind('keydown keypress keyup', function (e) {
                e.stopPropagation();
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
                        if (triggerEvent(EVENT_HANDLER, keyEventName) || /ctrl(?![axcvr]$)|alt|enter/i.test(keyEventName)) {
                            keyDefaultPrevented = true;
                            e.preventDefault();
                            return;
                        }
                    }
                    keyDefaultPrevented = false;
                    replaceTimeout(normalizeInputEvent, function () {
                        if (!composition) {
                            updateState();
                            normalize(currentSelection.focusNode.element);
                            if (currentSelection.focusNode.widget !== activeWidget) {
                                triggerWidgetFocusout();
                            }
                        }
                    });
                } else if (e.type === 'keypress') {
                    if (modifierCount || !e.charCode) {
                        e.stopImmediatePropagation();
                    }
                } else {
                    if ((e.keyCode === modifiedKeyCode || isModifierKey) && modifierCount--) {
                        e.stopImmediatePropagation();
                    }
                    if (!keyDefaultPrevented && !isModifierKey && !composition) {
                        updateState();
                        sparseSnapshot(e);
                    }
                }
            });

            $self.bind('keypress textInput textinput', function (e) {
                if (!suppressIETextInput) {
                    if (handleTextInput(e.originalEvent.data || String.fromCharCode(e.charCode) || '')) {
                        e.preventDefault();
                    }
                    sparseSnapshot(e);
                }
            });

            $self.bind('dragstart', function (e) {
                var selectedRange = createRange(currentSelection);
                var handlers = {
                    drop: function (e) {
                        var range = caretRangeFromPoint(e.originalEvent.clientX, e.originalEvent.clientY);
                        var content = extractContents(selectedRange, e.ctrlKey ? 'copy' : 'cut');
                        insertContents(range, content);
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
                e.stopPropagation();
                e.preventDefault();
                if (IS_IE) {
                    // IE put the caret in the wrong position after user code
                    // need to reposition the caret
                    setTimeout(function () {
                        currentSelection.focus();
                    });
                }
            });

            $self.bind('mousedown mouseup mscontrolselect', function (e) {
                // disable resize handle on image element on IE and Firefox
                // also select the whole widget when clicking on uneditable elements
                var node = typerDocument.getNode(e.target);
                if (activeWidget !== node.widget) {
                    triggerWidgetFocusout();
                }
                if (is(node, NODE_WIDGET | NODE_INLINE_WIDGET)) {
                    setTimeout(function () {
                        currentSelection.focus();
                    });
                    currentSelection.select(node.widget.element);
                    if (activeWidget !== node.widget) {
                        activeWidget = node.widget;
                        triggerEvent(node.widget, 'focusin');
                    }
                }
            });

            $self.bind('dblclick', function (e) {
                if (currentSelection.moveToPoint(e.clientX, e.clientY)) {
                    currentSelection.expand('word');
                }
                e.preventDefault();
            });

            $self.bind('focusin', function () {
                setTimeout(function () {
                    if (!userFocus) {
                        triggerEvent(EVENT_ALL, 'focusin');
                        if (!mousedown) {
                            currentSelection.focus();
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

            $.each({
                moveByLine: 'upArrow downArrow shiftUpArrow shiftDownArrow',
                moveByWord: 'ctrlLeftArrow ctrlRightArrow ctrlShiftLeftArrow ctrlShiftRightArrow',
                moveToLineEnd: 'home end shiftHome shiftEnd',
                moveByCharacter: 'leftArrow rightArrow shiftLeftArrow shiftRightArrow'
            }, function (i, v) {
                $.each(v.split(' '), function (j, v) {
                    var direction = (j & 1) ? 1 : -1, extend = !!(j & 2);
                    widgetOptions.__core__[v] = function () {
                        if (!extend && !currentSelection.isCaret) {
                            currentSelection.collapse(direction < 0 ? 'start' : 'end');
                        } else {
                            currentSelection[i]('extend', direction);
                            if (!extend) {
                                currentSelection.collapse('extend');
                            }
                        }
                    };
                });
            });
            $.extend(widgetOptions.__core__, {
                ctrlZ: undoable.undo,
                ctrlY: undoable.redo,
                ctrlShiftZ: undoable.redo,
                backspace: deleteNextContent,
                delete: deleteNextContent,
                escape: function () {
                    topElement.blur();
                    if (getActiveRange(topElement)) {
                        selection.removeAllRanges();
                    }
                }
            });
        }

        function activateWidget(name, settings) {
            if ((options[name] || (options.widgets || '')[name]) && (settings.inline || topNodeType === NODE_EDITABLE)) {
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
            $.each(options.widgets || {}, activateWidget);
            $.each(Typer.widgets, activateWidget);

            widgetOptions.__root__ = options;
            widgetOptions.__core__ = {};
            widgetOptions.__unknown__ = {
                // make all other tags that are not considered paragraphs and inlines to be widgets
                // to avoid unknown behavior while editing
                element: options.disallowedElement || ':not(' + INNER_PTAG + ',br,b,em,i,u,strike,small,strong,sub,sup,ins,del,mark,span)'
            };
        }

        var retainFocusHandlers = {
            focusin: function (e) {
                userFocus = e.currentTarget;
            },
            focusout: function (e) {
                var focusoutTarget = e.currentTarget;
                setTimeout(function () {
                    if (userFocus === focusoutTarget && !getActiveRange(topElement)) {
                        userFocus = null;
                        $self.trigger('focusout');
                    }
                });
            }
        };

        initUndoable();
        initWidgets();
        normalizeInputEvent();
        $self.attr('contenteditable', 'true');
        typerDocument = createTyperDocument(topElement, true);

        $.extend(typer, undoable, typerDocument, {
            element: topElement,
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
                return currentSelection;
            },
            nodeFromPoint: function (x, y) {
                return typerDocument.getNode(document.elementFromPoint(x, y));
            },
            retainFocus: function (element) {
                $(element).bind(retainFocusHandlers);
            },
            invoke: function (command, value) {
                var originalValue = suppressSnapshot;
                var originalSelection = currentSelection.clone();
                var timestamp = currentSelection.timestamp;
                try {
                    suppressSnapshot = true;
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
                } finally {
                    if (timestamp === currentSelection.timestamp) {
                        currentSelection.select(originalSelection);
                    }
                    suppressSnapshot = originalValue;
                    undoable.snapshot();
                }
            }
        });

        definePrototype(TyperTransaction, {
            typer: typer,
            widget: null,
            get selection() {
                return currentSelection;
            },
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
                $.each(currentSelection.getEditableRanges(), function (i, v) {
                    applyRange(v);
                    document.execCommand(commandName, false, value || '');
                });
                currentSelection.focus();
            },
            getSelectedText: function () {
                var content = extractContents(currentSelection, 'copy');
                return extractText(content);
            },
            getSelectedTextNodes: function () {
                splitTextBoundary(currentSelection);
                return iterateToArray(currentSelection.createDOMNodeIterator(4));
            }
        });

        currentSelection = new TyperSelection(typer, createRange(topElement, COLLAPSE_START_INSIDE));
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
        rangeEquals: rangeEquals,
        rectEquals: rectEquals,
        caretRangeFromPoint: caretRangeFromPoint,
        defaultOptions: {
            historyLevel: 100,
            disallowedWidgets: 'keepText',
            widgets: {}
        },
        widgets: {}
    });

    definePrototype(TyperNode, {
        get firstChild() {
            return this.childNodes[0] || null;
        },
        get lastChild() {
            return this.childNodes.slice(-1)[0] || null;
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
            return treeWalkerTraverseSibling(this, 'lastChild', 'previousSibling');
        },
        nextSibling: function () {
            return treeWalkerTraverseSibling(this, 'firstChild', 'nextSibling');
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

    function nodeIteratorTraverseTyperNode(inst, dir, into) {
        if (dir === 'previousNode') {
            return (into && inst.typerNodeIterator.lastChild()) || inst.typerNodeIterator.previousSibling() || inst.typerNodeIterator.parentNode();
        }
        return (!into && inst.typerNodeIterator.nextSibling()) || inst.typerNodeIterator.nextNode();
    }

    function nodeIteratorTraverse(inst, dir) {
        var before = inst.currentNode;
        if (inst.iterator[dir]()) {
            if (inst.currentNode.parentNode !== before.parentNode && acceptNode(inst.iterator, before) === 1 && nodeIteratorTraverseTyperNode(inst, dir, true)) {
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
        while (nodeIteratorTraverseTyperNode(inst, dir)) {
            inst.iterator = nodeIteratorCreateNodeIterator(inst, dir);
            if ((inst.currentNode !== before && acceptNode(inst.iterator) === 1) || inst.iterator[dir]()) {
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
        get typerNodeIterator() {
            return null;
        },
        set typerNodeIterator(iterator) {
            if (!is(iterator.currentNode, NODE_ANY_ALLOWTEXT)) {
                iterator.nextNode();
            }
            defineProperty(this, 'typerNodeIterator', iterator, false);
            defineProperty(this, 'iteratorStack', [], false);
            defineProperty(this, 'iterator', nodeIteratorCreateNodeIterator(this), false);
        },
        previousNode: function () {
            return nodeIteratorTraverse(this, 'previousNode');
        },
        nextNode: function () {
            return nodeIteratorTraverse(this, 'nextNode');
        }
    });

    function typerSelectionDeepIterator(inst, whatToShow, filter) {
        var range = createRange(inst);
        return new TyperTreeWalker(inst.focusNode, whatToShow | NODE_SHOW_EDITABLE, function (v) {
            return !rangeIntersects(v.element, range) ? 2 : !filter ? 1 : filter(v);
        });
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
        get isSingleEditable() {
            return !typerSelectionDeepIterator(this, NODE_ANY_BLOCK_EDITABLE).nextNode();
        },
        getCaret: function (point) {
            switch (point) {
                case 'extend':
                    return this.extendCaret;
                case 'start':
                    return this.direction < 0 ? this.extendCaret : this.baseCaret;
                case 'end':
                    return this.direction > 0 ? this.extendCaret : this.baseCaret;
                default:
                    return this.baseCaret;
            }
        },
        getRange: function (collapse) {
            if (collapse !== undefined || this.isCaret) {
                return (collapse !== false ? this.baseCaret : this.extendCaret).getRange();
            }
            return createRange(this.baseCaret.getRange(), this.extendCaret.getRange());
        },
        getEditableRanges: function () {
            var range = createRange(this);
            return $.map(iterateToArray(typerSelectionDeepIterator(this, NODE_PARAGRAPH | NODE_EDITABLE_PARAGRAPH)), function (v) {
                return createRange(range, createRange(v.element));
            });
        },
        getWidgets: function () {
            return $.map(typerSelectionGetWidgets(this), mapFn('widget'));
        },
        getEditableElements: function () {
            return $.map(typerSelectionGetWidgets(this).concat(iterateToArray(typerSelectionDeepIterator(this, NODE_ANY_BLOCK_EDITABLE))), mapFn('element'));
        },
        getParagraphElements: function () {
            var iterator = new TyperTreeWalker(this.focusNode, NODE_PARAGRAPH | NODE_SHOW_EDITABLE);
            var nodes = iterateToArray(iterator, null, this.startNode);
            nodes.splice(nodes.indexOf(this.endNode) + 1);
            return $.map(nodes, mapFn('element'));
        },
        getSelectedElements: function () {
            return iterateToArray(typerSelectionDeepIterator(this, NODE_ANY_ALLOWTEXT), mapFn('element'));
        },
        createTreeWalker: function (whatToShow, filter) {
            return typerSelectionDeepIterator(this, whatToShow, filter);
        },
        createDOMNodeIterator: function (whatToShow, filter) {
            return new TyperDOMNodeIterator(typerSelectionDeepIterator(this, NODE_WIDGET | NODE_ANY_ALLOWTEXT), whatToShow, filter);
        },
        collapse: function (point) {
            point = this.getCaret(point);
            return (point === this.baseCaret ? this.extendCaret : this.baseCaret).moveTo(point);
        },
        select: function (point, a, b, c) {
            if (typeof point === 'string') {
                return this.getCaret(point).moveTo(a);
            }
            var range = is(point, Range) || createRange(point, a, b, c);
            return (this.baseCaret.moveTo(range, COLLAPSE_START_OUTSIDE) + (range.collapsed ? this.extendCaret.moveTo(this.baseCaret) : this.extendCaret.moveTo(range, COLLAPSE_END_OUTSIDE))) > 0;
        },
        expand: function (mode) {
            var direction = this.direction || 1;
            return (this.baseCaret['moveBy' + capfirst(mode)](-1 * direction) + this.extendCaret['moveBy' + capfirst(mode)](1 * direction)) > 0;
        },
        shrink: function (mode) {
            var direction = this.direction;
            var value = !!(direction && (this.baseCaret['moveBy' + capfirst(mode)](1 * direction) + this.extendCaret['moveBy' + capfirst(mode)](-1 * direction)));
            if (this.direction !== direction) {
                this.collapse();
            }
            return value;
        },
        focus: function () {
            if (containsOrEquals(document, this.typer.element)) {
                applyRange(createRange(this));
            }
        },
        clone: function () {
            var inst = new TyperSelection(this.typer);
            inst.baseCaret.moveTo(this.baseCaret);
            inst.extendCaret.moveTo(this.extendCaret);
            return inst;
        }
    });

    $.each('moveToPoint moveToText moveByLine moveToLineEnd moveByWord moveByCharacter'.split(' '), function (i, v) {
        TyperSelection.prototype[v] = function (point) {
            var collapse = typeof point !== 'string';
            var value = !!TyperCaret.prototype[v].apply(this.getCaret(point), slice(arguments, +!collapse));
            if (collapse) {
                this.collapse();
            }
            return value;
        };
    });

    function caretTextNodeIterator(inst, whatToShow) {
        var iterator = new TyperDOMNodeIterator(new TyperTreeWalker(inst.typer.getNode(inst.typer.element), whatToShow), 4);
        iterator.typerNodeIterator.currentNode = inst.typer.getNode(inst.element);
        iterator.currentNode = inst.textNode || inst.element;
        return iterator;
    }

    function caretUpdateSelection(inst) {
        inst.timestamp = +new Date();
        inst.direction = compareRangePosition(inst.extendCaret.getRange(), inst.baseCaret.getRange()) || 0;
        inst.isCaret = !inst.direction;
        inst.focusNode = inst.typer.getEditableNode(getCommonAncestor(inst.baseCaret.element, inst.extendCaret.element));
        for (var i = 0, p1 = inst.getCaret('start'), p2 = inst.getCaret('end'); i < 4; i++) {
            inst[caretUpdateSelection.NAMES[i + 4]] = p1[caretUpdateSelection.NAMES[i]];
            inst[caretUpdateSelection.NAMES[i + 8]] = p2[caretUpdateSelection.NAMES[i]];
        }
        if (inst === inst.typer.getSelection()) {
            inst.focus();
            inst.typer.snapshot();
        }
    }
    caretUpdateSelection.NAMES = 'node element textNode offset startNode startElement startTextNode startOffset endNode endElement endTextNode endOffset'.split(' ');

    function caretSetPositionRaw(inst, node, element, textNode, offset) {
        inst.node = node;
        inst.element = element;
        inst.textNode = textNode || null;
        inst.offset = offset || 0;
        inst.wholeTextOffset = inst.offset + (textNode && getWholeTextOffset(node, textNode));
        if (inst.selection) {
            caretUpdateSelection(inst.selection);
        }
        return inst;
    }

    function caretSetPosition(inst, element, offset, end) {
        var node, textNode, textOffset;
        if (tagName(element) === 'br') {
            textNode = element.nextSibling;
            offset = 0;
        } else if (element.nodeType === 1 && element.childNodes[0]) {
            if (end || offset === element.childNodes.length) {
                element = element.childNodes[(offset || 1) - 1];
                offset = element.length;
                end = true;
            } else {
                element = element.childNodes[offset];
                offset = 0;
            }
        }
        if (element.nodeType === 3) {
            textNode = element;
            element = textNode.parentNode;
        }
        node = inst.typer.getEditableNode(textNode || element);
        if (textNode) {
            if (node.element !== textNode.parentNode) {
                element = node.element;
                textNode = null;
            } else if (!is(node, NODE_ANY_ALLOWTEXT)) {
                node = any(node.childNodes, function (v) {
                    return comparePosition(textNode, v.element) < 0;
                }) || node.lastChild;
                element = node.element;
                textNode = null;
                end = true;
            }
        }
        if (!textNode && is(node, NODE_ANY_ALLOWTEXT)) {
            var iterator2 = new TyperDOMNodeIterator(node, 4);
            iterator2.currentNode = element;
            while (iterator2.nextNode() && end);
            textNode = iterator2.currentNode;
            offset = end ? textNode && textNode.length : 0;
        }
        if (is(node, NODE_ANY_ALLOWTEXT)) {
            for (; !is(node, NODE_PARAGRAPH | NODE_EDITABLE_PARAGRAPH); node = node.parentNode);
        }
        return caretSetPositionRaw(inst, node, element, textNode, textNode ? offset : end ? COLLAPSE_END_OUTSIDE : COLLAPSE_START_OUTSIDE);
    }

    definePrototype(TyperCaret, {
        getRange: function () {
            if (this.textNode && !this.textNode.parentNode) {
                // use calculated text offset from paragraph node in case anchored text node is detached from DOM
                // assuming that there is no unmanaged edit after the previous selection
                this.moveToText(this.node.element, this.wholeTextOffset);
            }
            return createRange(this.textNode || this.element, this.offset, !!this.textNode);
        },
        clone: function () {
            return Object.create(TyperCaret.prototype).moveTo(this);
        },
        moveTo: function (startNode, startOffset, endNode, endOffset) {
            if (is(startNode, TyperCaret)) {
                return caretSetPositionRaw(this, startNode.node, startNode.element, startNode.textNode, startNode.offset);
            }
            var range = createRange(startNode, startOffset, endNode, endOffset);
            var startPoint = this.selection && this.selection.getCaret('start').getRange();
            return range && caretSetPosition(this, range.startContainer, range.startOffset, startPoint && compareRangePosition(startPoint, range) < 0);
        },
        moveToPoint: function (x, y) {
            return this.moveTo(caretRangeFromPoint(x, y));
        },
        moveToText: function (node, offset) {
            if (node.nodeType !== 3) {
                var iterator = new TyperDOMNodeIterator(this.typer.getNode(node), 4);
                if (offset) {
                    for (; iterator.nextNode() && offset > iterator.currentNode.length; offset -= iterator.currentNode.length);
                } else if (1 / offset < 0) {
                    while (iterator.nextNode());
                    offset = iterator.currentNode.length;
                }
                node = iterator.currentNode;
            }
            return caretSetPosition(this, node, getOffset(node, offset));
        },
        moveToLineEnd: function (direction) {
            var rect = this.getRange().getBoundingClientRect();
            var minx = rect.left;
            iterate(new TyperDOMNodeIterator(this.node, 4), function (v) {
                $.each(createRange(v).getClientRects(), function (i, v) {
                    if (v.top <= rect.top + rect.height && v.top + v.height >= rect.top) {
                        minx = Math[direction < 0 ? 'min' : 'max'](minx, direction < 0 ? v.left : v.left + v.width);
                    }
                });
            });
            return this.moveToPoint(minx, rect.top + rect.height / 2);
        },
        moveByLine: function (direction) {
            var iterator = caretTextNodeIterator(this, NODE_ANY_ALLOWTEXT | NODE_SHOW_EDITABLE);
            var rect = this.getRange().getBoundingClientRect();
            while (true) {
                var rects = slice(createRange(iterator.currentNode).getClientRects());
                var newRect = any(direction < 0 ? rects.reverse() : rects, function (v) {
                    return direction < 0 ? v.top + v.height <= rect.top : v.top >= rect.top + rect.height;
                });
                if (newRect) {
                    return this.moveToPoint(rect.left, newRect.top + (newRect.height / 2));
                }
                if (!iterator[direction < 0 ? 'previousNode' : 'nextNode']()) {
                    return this.moveToLineEnd(direction);
                }
            }
        },
        moveByWord: function (direction) {
            var re = direction < 0 ? /\b(\S*\s+|\S+)$/g : /^(\s+\S*|\S+)\b/g;
            if (this.textNode) {
                var str = direction < 0 ? this.textNode.nodeValue.substr(0, this.offset) : this.textNode.nodeValue.slice(this.offset);
                if (!re.test(str)) {
                    return this.moveByCharacter(direction);
                }
                if (RegExp.$1.length !== getOffset(str, 0 * -direction)) {
                    return this.moveToText(this.textNode, this.offset + direction * RegExp.$1.length);
                }
            }
            var iterator = new TyperDOMNodeIterator(this.node, 4);
            iterator.currentNode = this.textNode || this.element;
            while (iterator[direction < 0 ? 'previousNode' : 'nextNode']()) {
                if (re.test(iterator.currentNode.nodeValue) && RegExp.$1.length !== getOffset(iterator.currentNode, 0 * -direction)) {
                    return this.moveToText(iterator.currentNode, RegExp.$1.length);
                }
            }
            return iterator.currentNode && this.moveToText(iterator.currentNode, 0 * -direction);
        },
        moveByCharacter: function (direction) {
            var iterator = caretTextNodeIterator(this, NODE_ANY_ALLOWTEXT | NODE_SHOW_EDITABLE);
            var rect = this.getRange().getBoundingClientRect();
            var offset = this.offset;
            while (true) {
                while (iterator.currentNode.nodeType === 1 || offset === getOffset(iterator.currentNode, 0 * -direction)) {
                    if (!iterator[direction < 0 ? 'previousNode' : 'nextNode']()) {
                        return false;
                    }
                    offset = direction < 0 ? iterator.currentNode.length + 1 : -1;
                }
                offset += direction;
                var newRect = createRange(iterator.currentNode, offset, true).getBoundingClientRect();
                if (rect.height && !rectEquals(rect, newRect)) {
                    return this.moveToText(iterator.currentNode, offset);
                }
                rect = newRect;
            }
        }
    });

    $.each('moveByLine moveByWord moveByCharacter'.split(' '), function (i, v) {
        var fn = TyperCaret.prototype[v];
        TyperCaret.prototype[v] = function (direction) {
            for (var step = direction; step && fn.call(this, direction / Math.abs(direction)); step += step > 0 ? -1 : 1);
            return !direction || step !== direction ? this : null;
        };
    });

    definePrototype(TyperWidget, {
        remove: function () {
            var self = this;
            self.typer.invoke(function (tx) {
                tx.removeWidget(self);
            });
        }
    });

    // disable Mozilla object resizing and inline table editing controls
    if (!IS_IE) {
        try {
            document.designMode = 'on';
            document.execCommand('enableObjectResizing', false, false);
            document.execCommand('enableInlineTableEditing', false, false);
        } catch (e) { }
        document.designMode = 'off';
    }

    $(window).bind('focusin focusout', function (e) {
        if (e.target === window || e.target === document.body || !e.relatedTarget) {
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

} (jQuery, window, document, String, Node, Range, DocumentFragment, window.WeakMap, Array.prototype));

(function ($, Typer) {
    'use strict';

    Typer.presets = {
        textbox: {
            inline: true,
            defaultOptions: false,
            disallowedElement: '*',
            init: function (e) {
                e.typer.getSelection().moveToText(e.typer.element, -0);
                Object.defineProperty(e.typer.element, 'value', {
                    enumerable: true,
                    configurable: true,
                    get: function () {
                        return Typer.trim(this.textContent);
                    },
                    set: function (value) {
                        if (value !== this.value) {
                            this.textContent = value;
                            e.typer.getSelection().moveToText(this, -0);
                        }
                    }
                });
            },
            change: function (e) {
                $(e.typer.element).trigger('change');
            }
        }
    };

    $.fn.typer = function (preset, options) {
        options = typeof preset === 'string' ? $.extend({}, Typer.presets[preset], options) : preset;
        return this.each(function (i, v) {
            new Typer(v, options);
        });
    };

} (jQuery, window.Typer));

(function ($, Typer) {
    'use strict';

    var isFunction = $.isFunction;
    var boolAttrs = 'checked selected disabled readonly multiple ismap'.split(' ');

    var definedControls = {};
    var definedIcons = {};
    var definedLabels = {};
    var definedThemes = {};

    function define(name, base, ctor) {
        /* jshint -W054 */
        var fn = (new Function('fn', 'return function ' + (name || '') + '() { return fn.apply(this, arguments); }'))(function (options) {
            if (!(this instanceof fn)) {
                var obj = Object.create(fn.prototype);
                fn.apply(obj, arguments);
                return obj;
            }
            if (!isFunction(ctor)) {
                return $.extend(this, options);
            }
            try {
                this._super = base;
                ctor.apply(this, arguments);
            } finally {
                delete this._super;
            }
        });
        fn.prototype = isFunction(base) ? new base() : $.extend(fn.prototype, base);
        fn.extend = function (ctor) {
            return define(null, fn, ctor);
        };
        return fn;
    }

    function parseCompactSyntax(str) {
        var m = /^([\w-:]*)(?:\(([^}]+)\))?$/.exec(str);
        var params = null;
        try {
            params = m[2] && JSON.parse(('{' + m[2] + '}').replace(/([{:,])\s*([^\s:,}]+)/g, '$1"$2"'));
        } catch (e) { }
        return {
            name: m[1],
            params: params
        };
    }

    function toggleDisplay($elm, visible) {
        if (!visible) {
            if ($elm.css('display') !== 'none') {
                $elm.data('original-display', $elm.css('display'));
            }
            $elm.hide();
        } else if ($elm.data('original-display')) {
            $elm.css('display', $elm.data('original-display'));
        } else {
            $elm.show();
        }
    }

    function callFunction(ui, control, name, optArg) {
        if (ui !== control && isFunction(control[name])) {
            return control[name](ui, control, optArg);
        }
    }

    function triggerEvent(ui, control, name, optArg) {
        callFunction(ui, control, name, optArg);
        var themeEvent = control.type + name.charAt(0).toUpperCase() + name.slice(1);
        if (isFunction(definedThemes[ui.theme][themeEvent])) {
            definedThemes[ui.theme][themeEvent](ui, control, optArg);
        }
    }

    function resolveControls(ui, control) {
        control = control || ui;
        if (isFunction(control.controls)) {
            control.controls = control.controls(ui, control) || '';
        }
        if (typeof control.controls === 'string') {
            var tokens = control.controls.split(/\s+/);
            var controlsProto = {};
            $.each(tokens, function (i, v) {
                if (v.slice(-1) === '*') {
                    $.each(definedControls, function (i, w) {
                        if (i.slice(0, v.length - 1) === v.slice(0, -1) && i.indexOf(':', v.length) < 0 && tokens.indexOf('-' + i) < 0 && !controlsProto[i]) {
                            controlsProto[i] = Object.create(w);
                        }
                    });
                } else if (v.charAt(0) !== '-') {
                    var t = parseCompactSyntax(v);
                    if (definedControls[t.name] && tokens.indexOf('-' + t.name) < 0 && !controlsProto[t.name]) {
                        controlsProto[t.name] = $.extend(Object.create(definedControls[t.name]), t.params);
                    }
                }
            });
            control.controls = [];
            $.each(controlsProto, function (i, v) {
                v.name = v.name || i;
                control.controls.push(v);
            });
        } else if ($.isArray(control.controls)) {
            control.controls = $.map(control.controls, Object.create);
        }
        $.each(control.controls || [], function (i, v) {
            v.name = v.name || 'noname:' + (Math.random().toString(36).substr(2, 8));
            v.parent = control;
            if (v.label === undefined) {
                v.label = v.name;
            }
            ui.all[v.name] = v;
            resolveControls(ui, v);
        });
        return control.controls;
    }

    function renderControl(ui, control, params) {
        control = control || ui;
        var bindedElements = [];

        function bindData() {
            $.each(bindedElements, function (i, v) {
                $.each(v[1], function (i, w) {
                    if (i === '_') {
                        $(v[0]).text(definedLabels[control[w]] || control[w] || '');
                    } else if (boolAttrs.indexOf(i) >= 0) {
                        $(v[0]).prop(i, !!control[w] && control[w] !== "false");
                    } else if (control[w]) {
                        $(v[0]).attr(i, definedLabels[control[w]] || control[w] || '');
                    } else {
                        $(v[0]).removeAttr(i);
                    }
                });
            });
        }

        function bindPlaceholder(element) {
            $(element).find('*').andSelf().filter('[x\\:bind]').each(function (i, v) {
                var t = parseCompactSyntax($(v).attr('x:bind'));
                bindedElements.push([v, t.params]);
            }).removeAttr('x:bind');
        }

        function replacePlaceholder(name) {
            var element = $(definedThemes[ui.theme][name] || '<div><br x:t="children"></div>')[0];
            bindPlaceholder(element);
            $('[x\\:t]', element).each(function (i, v) {
                var t = parseCompactSyntax($(v).attr('x:t'));
                var element;
                if (isFunction(definedThemes[ui.theme][t.name])) {
                    element = $(definedThemes[ui.theme][t.name](ui, control, t.params));
                    bindPlaceholder(element);
                } else if (t.name === 'children') {
                    element = $.map(control.controls, function (v) {
                        return renderControl(ui, v, t.params);
                    });
                } else {
                    element = replacePlaceholder(t.name);
                }
                $(v).replaceWith(element);
            });
            return element;
        }

        function executeFromEvent(e) {
            e.stopPropagation();
            if ($(e.target).is(':checkbox')) {
                setTimeout(function () {
                    ui.setValue(control, !!e.target.checked);
                });
            } else {
                ui.execute(control);
            }
        }

        control.element = replacePlaceholder(control.type);
        control.bindData = bindData;

        var executeEvent = definedThemes[ui.theme][control.type + 'ExecuteOn'];
        if (typeof executeEvent === 'string') {
            $(control.element).bind(executeEvent, executeFromEvent);
        } else if (executeEvent) {
            $(executeEvent.of, control.element).bind(executeEvent.on, executeFromEvent);
        }
        return control.element;
    }

    function updateControl(ui, control) {
        var suppressStateChange;
        if (typeof (control.requireWidget || control.requireWidgetEnabled) === 'string') {
            control.widget = ui._widgets[control.requireWidget || control.requireWidgetEnabled] || null;
            suppressStateChange = !control.widget;
        }
        if (!suppressStateChange) {
            triggerEvent(ui, control, 'stateChange');
        }

        var disabled = !ui.enabled(control);
        var visible = !control.hiddenWhenDisabled || !disabled;
        if (visible) {
            control.bindData();
        }

        var $elm = $(control.element);
        var theme = definedThemes[ui.theme];
        if ($elm.is(':input')) {
            $elm.prop('disabled', disabled);
        }
        if (theme.controlDisabledClass) {
            $elm.toggleClass(theme.controlDisabledClass, disabled);
        }
        if (theme.controlActiveClass) {
            $elm.toggleClass(theme.controlActiveClass, !!ui.active(control));
        }
        if (theme.controlHiddenClass) {
            $elm.toggleClass(theme.controlHiddenClass, !visible);
        } else {
            toggleDisplay($elm, visible);
        }
    }

    function executeControl(ui, control) {
        if (ui.typer) {
            if (isFunction(control.execute)) {
                ui.typer.invoke(function (tx) {
                    control.execute(ui, control, tx, control.value);
                });
            } else if (ui.typer.hasCommand(control.execute)) {
                ui.typer.invoke(control.execute, control.value);
            }
        } else if (isFunction(control.execute)) {
            control.execute(ui, control, null, control.value);
        }
    }

    function foreachControl(ui, fn, optArg, control) {
        $.each(Object.keys(ui.all).reverse(), function (i, v) {
            fn(ui, ui.all[v], optArg);
        });
        fn(ui, ui, optArg);
    }

    Typer.ui = define('TyperUI', null, function (options, theme) {
        if (typeof options === 'string') {
            options = {
                theme: theme,
                controls: options
            };
        }
        var self = $.extend(this, options);
        self.all = {};
        self.controls = resolveControls(self);
        self.element = renderControl(self);
        $(self.element).addClass('typer-ui typer-ui-' + options.theme);
        if (self.typer) {
            self.typer.retainFocus(self.element);
        }
        callFunction(self, definedThemes[self.theme], 'init');
        foreachControl(self, triggerEvent, 'init');
    });

    $.extend(Typer.ui.prototype, {
        update: function () {
            var self = this;
            var obj = self._widgets = {};
            if (self.widget) {
                obj[self.widget.id] = self.widget;
            } else if (self.typer) {
                $.each(self.typer.getSelection().getWidgets().concat(self.typer.getStaticWidgets()), function (i, v) {
                    obj[v.id] = v;
                });
            }
            foreachControl(this, updateControl);
        },
        destroy: function () {
            foreachControl(this, callFunction, 'destroy');
        },
        trigger: function (control, event) {
            if (typeof control === 'string') {
                control = this.all[control] || {};
            }
            triggerEvent(this, control, event);
        },
        enabled: function (control) {
            if (typeof control === 'string') {
                control = this.all[control] || {};
            }
            if (!this.typer && (control.requireTyper || control.requireWidget || control.requireWidgetEnabled || control.requireCommand)) {
                return false;
            }
            if ((control.requireCommand && !this.typer.hasCommand(control.requireCommand)) ||
                (control.requireWidgetEnabled && !this.typer.widgetEnabled(control.requireWidgetEnabled))) {
                return false;
            }
            if ((control.requireWidget === true && !Object.getOwnPropertyNames(this._widgets)[0]) ||
                (control.requireWidget && !control.widget && !this.widget)) {
                return false;
            }
            return callFunction(this, control, 'enabled') !== false;
        },
        active: function (control) {
            if (typeof control === 'string') {
                control = this.all[control] || {};
            }
            return !!callFunction(this, control, 'active');
        },
        setValue: function (control, value) {
            if (typeof control === 'string') {
                control = this.all[control] || {};
            }
            control.value = value;
            if (control.executeOnSetValue && this.enabled(control)) {
                executeControl(this, control);
            }
        },
        execute: function (control) {
            if (typeof control === 'string') {
                control = this.all[control] || {};
            }
            var self = this;
            if (self.enabled(control)) {
                if (isFunction(control.dialog)) {
                    var promise = $.when(control.dialog(self, control));
                    promise.done(function (value) {
                        if (value !== undefined) {
                            control.value = value;
                        }
                        executeControl(self, control);
                    });
                    return promise;
                } else {
                    executeControl(self, control);
                }
            }
        },
        prompt: function (label, value) {
            var ui = Typer.ui('ui:prompt', this.theme);
            var dialog = ui.all['ui:prompt'];
            dialog.label = label;
            dialog.value = value;
            return ui.execute(dialog);
        }
    });

    $.extend(Typer.ui, {
        controls: definedControls,
        themes: definedThemes,
        getIcon: function (control, iconSet) {
            return (definedIcons[control.icon] || definedIcons[control.name] || '')[iconSet] || '';
        },
        addIcons: function (iconSet, values) {
            $.each(values, function (i, v) {
                if (!definedIcons[i]) {
                    definedIcons[i] = {};
                }
                definedIcons[i][iconSet] = v;
            });
        },
        addLabels: function (language, values) {
            $.extend(definedLabels, values);
        },
        setZIndex: function (element, over) {
            element.style.zIndex = (+$(over).parentsUntil(element.parentNode).filter(function (i, v) {
                return /absolute|fixed|relative/.test($(v).css('position'));
            }).slice(-1).css('z-index') || 0) + 1;
        }
    });

    /* ********************************
     * Built-in Control Types
     * ********************************/

    $.extend(Typer.ui, {
        button: define('TyperUIButton', {
            type: 'button'
        }),
        dropdown: define('TyperUIDropdown', {
            type: 'dropdown',
            stateChange: function (ui, self) {
                $.each(self.controls, function (i, v) {
                    if (ui.active(v)) {
                        $('select', self.element).prop('selectedIndex', i);
                        self.selectedIndex = i;
                        self.selectedValue = v.label || v.name;
                        return false;
                    }
                });
            },
            execute: function (ui, self) {
                ui.execute(self.controls[self.selectedIndex]);
            },
            enabled: function (ui, self) {
                return self.controls.length > 0;
            }
        }),
        group: define('TyperUIGroup', {
            type: 'group',
            hiddenWhenDisabled: true
        }, function (controls, params) {
            this.controls = controls;
            $.extend(this, params);
        }),
        callout: define('TyperUICallout', {
            type: 'callout'
        }),
        textbox: define('TyperUITextbox', {
            type: 'textbox',
            executeOnSetValue: true
        }),
        checkbox: define('TyperUICheckbox', {
            type: 'checkbox',
            executeOnSetValue: true
        }),
        dialog: define('TyperUIDialog', {
            type: 'dialog'
        }, function (controls, setup) {
            this.controls = controls;
            this.dialog = function (ui, self) {
                var deferred = $.Deferred();
                setup(ui, self, deferred.resolve.bind(deferred), deferred.reject.bind(deferred));
                ui.update();
                ui.trigger(self, 'open');
                deferred.always(function () {
                    ui.trigger(self, 'close');
                    ui.destroy();
                });
                return deferred.promise();
            };
        })
    });

    $.extend(definedControls, {
        'ui:button-ok': Typer.ui.button(),
        'ui:button-cancel': Typer.ui.button(),
        'ui:prompt-input': Typer.ui.textbox({
            label: '',
            executeOnSetValue: false
        }),
        'ui:prompt-buttonset': Typer.ui.group('ui:button-ok ui:button-cancel'),
        'ui:prompt': Typer.ui.dialog('ui:prompt-input ui:prompt-buttonset', function (ui, self, resolve, reject) {
            ui.all['ui:button-ok'].execute = function () {
                resolve(ui.all['ui:prompt-input'].value);
            };
            ui.all['ui:button-cancel'].execute = reject;
            ui.setValue('ui:prompt-input', self.value);
        })
    });

    Typer.ui.addLabels('en', {
        'ui:button-ok': 'OK',
        'ui:button-cancel': 'Cancel'
    });

    Typer.ui.addIcons('material', {
        'ui:button-ok': 'done',
        'ui:button-cancel': 'close'
    });

} (jQuery, window.Typer));

(function ($, Typer) {
    'use strict';

    var ALIGN_VALUE = {
        justifyLeft: 'left',
        justifyRight: 'right',
        justifyCenter: 'center',
        justifyFull: 'justify'
    };
    var STYLE_TAGNAME = {
        bold: 'b',
        italic: 'i',
        underline: 'u',
        strikeThrough: 'strike',
        superscript: 'sup',
        subscript: 'sub'
    };

    function getTextAlign(element) {
        var textAlign = $(element).css('text-align');
        var direction = $(element).css('direction');
        switch (textAlign) {
            case '-webkit-left':
                return 'left';
            case '-webkit-right':
                return 'right';
            case 'start':
                return direction === 'ltr' ? 'left' : 'right';
            case 'end':
                return direction === 'ltr' ? 'right' : 'left';
            default:
                return textAlign;
        }
    }

    function computePropertyValue(state, property) {
        var value;
        $(state.getSelectedElements()).each(function (i, v) {
            var my;
            if (property === 'textAlign') {
                my = getTextAlign(v);
            } else if (property === 'inlineClass') {
                my = $(v).filter('span').attr('class') || '';
            } else {
                my = $(v).css(property);
            }
            value = (value === '' || (value && value !== my)) ? '' : my;
        });
        return value || '';
    }

    function createElementWithClassName(tagName, className) {
        var element = Typer.createElement(tagName);
        if (className) {
            element.className = className;
        }
        return element;
    }

    function removeParagraph(element) {
        if ($(element).is('li:only-child')) {
            element = element.parentNode;
        }
        $(element).remove();
    }

    function indentParagraph(element) {
        var list = $(element.parentNode).filter('ul,ol')[0];
        var prevItem = $(element).prev('li')[0] || $('<li>').insertBefore(element)[0];
        var newList = $(prevItem).children('ul,ol')[0] || $(list.cloneNode(false)).appendTo(prevItem)[0];
        $('<li>').append(element.childNodes).appendTo(newList);
        removeParagraph(element);
        if ($(newList).parent('li')[0] && !newList.previousSibling) {
            $(Typer.createTextNode()).insertBefore(newList);
        }
    }

    function outdentParagraph(element) {
        var list = $(element).parent('ul,ol')[0];
        var parentList = $(list).parent('li')[0];
        if ($(element).next('li')[0]) {
            if (parentList) {
                $(list.cloneNode(false)).append($(element).nextAll()).appendTo(element);
            } else {
                $(list.cloneNode(false)).append($(element).nextAll()).insertAfter(list);
                $(element).children('ul,ol').insertAfter(list);
            }
        }
        $(createElementWithClassName(parentList ? 'li' : 'p')).append(element.childNodes).insertAfter(parentList || list);
        removeParagraph(element);
    }

    /* ********************************
     * Commands
     * ********************************/

    function justifyCommand(tx) {
        $(tx.selection.getParagraphElements()).attr('align', ALIGN_VALUE[tx.commandName]);
    }

    function inlineStyleCommand(tx) {
        if (tx.selection.isCaret) {
            tx.insertHtml(createElementWithClassName(STYLE_TAGNAME[tx.commandName]));
        } else {
            // IE will nest <sub> and <sup> elements on the subscript and superscript command
            // clear the subscript or superscript format before applying the opposite command
            if (tx.widget.subscript && tx.commandName === 'superscript') {
                tx.execCommand('subscript');
            } else if (tx.widget.superscript && tx.commandName === 'subscript') {
                tx.execCommand('superscript');
            }
            tx.execCommand(tx.commandName);
        }
    }

    function listCommand(tx, type) {
        var tagName = tx.commandName === 'insertOrderedList' || type ? 'ol' : 'ul';
        var html = '<' + tagName + (type || '').replace(/^.+/, ' type="$&"') + '>';
        var filter = function (i, v) {
            return v.tagName.toLowerCase() === tagName && ($(v).attr('type') || '') === (type || '');
        };
        $.each(tx.selection.getParagraphElements(), function (i, v) {
            if (!$(v).is('ol>li,ul>li')) {
                var list = $(v).prev().filter(filter)[0] || $(v).next().filter(filter)[0] || $(html).insertAfter(v)[0];
                $(v).wrap('<li>').contents().unwrap().parent()[Typer.comparePosition(v, list) < 0 ? 'prependTo' : 'appendTo'](list);
            } else if (!$(v.parentNode).filter(filter)[0]) {
                $(v.parentNode).wrap(html).contents().unwrap();
            } else if (tx.selection.focusNode.widget.id === 'list') {
                outdentParagraph(v);
            }
        });
    }

    function addCommandHotKeys(name, hotkeys) {
        (hotkeys || '').replace(/(\w+):(\w+)/g, function (v, a, b) {
            Typer.widgets[name][a] = function (e) {
                e.typer.invoke(b);
            };
        });
    }

    Typer.widgets.inlineStyle = {
        inline: true,
        beforeStateChange: function (e) {
            var selection = e.typer.getSelection();
            $.extend(e.widget, {
                bold: /bold|700/.test(computePropertyValue(selection, 'fontWeight')),
                italic: computePropertyValue(selection, 'fontStyle') === 'italic',
                underline: computePropertyValue(selection, 'textDecoration') === 'underline',
                strikeThrough: computePropertyValue(selection, 'textDecoration') === 'line-through',
                superscript: !!$(selection.getSelectedElements()).filter('sup')[0],
                subscript: !!$(selection.getSelectedElements()).filter('sub')[0],
                inlineClass: computePropertyValue(selection, 'inlineClass')
            });
        },
        commands: {
            bold: inlineStyleCommand,
            italic: inlineStyleCommand,
            underline: inlineStyleCommand,
            strikeThrough: inlineStyleCommand,
            superscript: inlineStyleCommand,
            subscript: inlineStyleCommand,
            applyClass: function (tx, className) {
                var paragraphs = tx.selection.getParagraphElements();
                $(tx.getSelectedTextNodes()).wrap(createElementWithClassName('span', className));
                $('span:has(span)', paragraphs).each(function (i, v) {
                    $(v).contents().unwrap().filter(function (i, v) {
                        return v.nodeType === 3;
                    }).wrap(createElementWithClassName('span', v.className));
                });
                $('span[class=""]', paragraphs).contents().unwrap();
            }
        }
    };
    addCommandHotKeys('inlineStyle', 'ctrlB:bold ctrlI:italic ctrlU:underline');

    Typer.widgets.formatting = {
        beforeStateChange: function (e) {
            var selection = e.typer.getSelection();
            var element = selection.getParagraphElements().slice(-1)[0];
            if ($(element).is('li')) {
                element = $(element).closest('ol, ul')[0] || element;
            }
            var tagName = element && element.tagName.toLowerCase();
            var tagNameWithClasses = tagName + ($(element).attr('class') || '').replace(/^(.)/, '.$1');
            var textAlign = computePropertyValue(selection, 'textAlign');
            $.extend(e.widget, {
                justifyLeft: textAlign === 'left',
                justifyCenter: textAlign === 'center',
                justifyRight: textAlign === 'right',
                justifyFull: textAlign === 'justify',
                formatting: tagName,
                formattingWithClassName: tagNameWithClasses
            });
        },
        commands: {
            justifyCenter: justifyCommand,
            justifyFull: justifyCommand,
            justifyLeft: justifyCommand,
            justifyRight: justifyCommand,
            formatting: function (tx, value) {
                var m = /^([^.]*)(?:\.(.+))?/.exec(value) || [];
                if (m[1] === 'ol' || m[1] === 'ul') {
                    tx.insertWidget('list', m[1] === 'ol' && '1');
                } else {
                    $(tx.selection.getParagraphElements()).not('li').wrap(createElementWithClassName(m[1] || 'p', m[2])).contents().unwrap();
                }
            },
            insertLine: function (tx) {
                tx.insertText('\n\n');
            }
        }
    };
    addCommandHotKeys('formatting', 'enter:insertLine ctrlShiftL:justifyLeft ctrlShiftE:justifyCenter ctrlShiftR:justifyRight');

    Typer.widgets.lineBreak = {
        inline: true,
        commands: {
            insertLineBreak: function (tx) {
                tx.insertHtml('<br>');
            }
        }
    };
    addCommandHotKeys('lineBreak', 'shiftEnter:insertLineBreak');

    Typer.widgets.list = {
        element: 'ul,ol',
        editable: 'ul,ol',
        insert: listCommand,
        remove: 'keepText',
        commands: {
            indent: function (tx) {
                $.map(tx.selection.getParagraphElements(), indentParagraph);
            },
            outdent: function (tx) {
                $.map(tx.selection.getParagraphElements(), outdentParagraph);
            }
        }
    };

    $.each('formatting list inlineStyle lineBreak'.split(' '), function (i, v) {
        Typer.defaultOptions[v] = true;
    });

    /* ********************************
     * Controls
     * ********************************/

    var simpleCommandButton = Typer.ui.button.extend(function (command, widget) {
        this._super({
            requireWidget: widget,
            requireCommand: command,
            execute: command,
            active: function (toolbar, self) {
                return self.widget && self.widget[command];
            }
        });
    });
    var orderedListButton = Typer.ui.button.extend(function (type, annotation) {
        this._super({
            name: 'formatting:orderedList:' + type,
            annotation: annotation,
            requireWidgetEnabled: 'list',
            value: type,
            execute: function (toolbar, self, tx) {
                tx.insertWidget('list', type);
            },
            active: function (toolbar, self) {
                return self.widget && $(self.widget.element).attr('type') === type;
            }
        });
    });

    $.extend(Typer.ui.controls, {
        'toolbar:formatting': Typer.ui.group('formatting:*', {
            rqeuireTyper: true,
            enabled: function (toolbar) {
                return !!toolbar.typer.getSelection().getParagraphElements()[0];
            }
        }),
        'formatting:paragraph': Typer.ui.dropdown({
            requireCommand: 'formatting',
            hiddenWhenDisabled: true,
            controls: function (toolbar) {
                return $.map(Object.keys(toolbar.options.formattings || {}), function (v) {
                    return Typer.ui.button({
                        requireWidget: 'formatting',
                        execute: 'formatting',
                        value: v,
                        label: toolbar.options.formattings[v],
                        active: function (toolbar, self) {
                            return self.widget.formattingWithClassName === v || self.widget.formatting === v;
                        }
                    });
                });
            }
        }),
        'formatting:inlineStyle': Typer.ui.dropdown({
            requireCommand: 'applyClass',
            hiddenWhenDisabled: true,
            controls: function (toolbar) {
                return $.map(Object.keys(toolbar.options.inlineClass || {}), function (v) {
                    return Typer.ui.button({
                        requireWidget: 'inlineStyle',
                        execute: 'applyClass',
                        value: v,
                        label: toolbar.options.inlineClass[v],
                        active: function (toolbar, self) {
                            return self.widget.inlineClass === v;
                        }
                    });
                });
            }
        }),
        'formatting:bold': simpleCommandButton('bold', 'inlineStyle'),
        'formatting:italic': simpleCommandButton('italic', 'inlineStyle'),
        'formatting:underline': simpleCommandButton('underline', 'inlineStyle'),
        'formatting:strikeThrough': simpleCommandButton('strikeThrough', 'inlineStyle'),
        'formatting:unorderedList': Typer.ui.button({
            requireWidgetEnabled: 'list',
            execute: function (toolbar, self, tx) {
                tx.insertWidget('list', '');
            },
            active: function (toolbar, self) {
                return self.widget && self.widget.element.tagName.toLowerCase() === 'ul';
            }
        }),
        'formatting:orderedList': Typer.ui.callout({
            requireWidgetEnabled: 'list',
            controls: [
                orderedListButton('1', '1, 2, 3, 4'),
                orderedListButton('a', 'a, b, c, d'),
                orderedListButton('A', 'A, B, C, D'),
                orderedListButton('i', 'i, ii, iii, iv'),
                orderedListButton('I', 'I, II, III, IV')
            ],
            active: function (toolbar, self) {
                return self.widget && self.widget.element.tagName.toLowerCase() === 'ol';
            }
        }),
        'formatting:indent': simpleCommandButton('indent', 'list'),
        'formatting:outdent': simpleCommandButton('outdent', 'list'),
        'formatting:justifyLeft': simpleCommandButton('justifyLeft', 'formatting'),
        'formatting:justifyCenter': simpleCommandButton('justifyCenter', 'formatting'),
        'formatting:justifyRight': simpleCommandButton('justifyRight', 'formatting'),
        'formatting:justifyFull': simpleCommandButton('justifyFull', 'formatting')
    });

    /* ********************************
     * Resources
     * ********************************/

    Typer.ui.addLabels('en', {
        'formatting:bold': 'Bold',
        'formatting:italic': 'Italic',
        'formatting:underline': 'Underlined',
        'formatting:strikeThrough': 'Strikethrough',
        'formatting:unorderedList': 'Bullet List',
        'formatting:orderedList': 'Numbered List',
        'formatting:indent': 'Indent',
        'formatting:outdent': 'Outdent',
        'formatting:justifyLeft': 'Align Left',
        'formatting:justifyCenter': 'Align Center',
        'formatting:justifyRight': 'Align Right',
        'formatting:justifyFull': 'Align Justified',
        'formatting:paragraph': 'Formatting',
        'formatting:inlineStyle': 'Text Style',
        'formatting:orderedList:1': 'Decimal numbers',
        'formatting:orderedList:a': 'Alphabetically ordered list, lowercase',
        'formatting:orderedList:A': 'Alphabetically ordered list, uppercase',
        'formatting:orderedList:i': 'Roman numbers, lowercase',
        'formatting:orderedList:I': 'Roman numbers, uppercase',
    });

    Typer.ui.addIcons('material', {
        'formatting:bold': 'format_bold',
        'formatting:italic': 'format_italic',
        'formatting:underline': 'format_underlined',
        'formatting:strikeThrough': 'strikethrough_s',
        'formatting:unorderedList': 'format_list_bulleted',
        'formatting:orderedList': 'format_list_numbered',
        'formatting:indent': 'format_indent_increase',
        'formatting:outdent': 'format_indent_decrease',
        'formatting:justifyLeft': 'format_align_left',
        'formatting:justifyCenter': 'format_align_center',
        'formatting:justifyRight': 'format_align_right',
        'formatting:justifyFull': 'format_align_justify'
    });

} (jQuery, window.Typer));

(function ($, Typer) {
    'use strict';

    Typer.widgets.link = {
        element: 'a[href]',
        inline: true,
        insert: function (tx, value) {
            value = value || (/^[a-z]+:\/\//g.test(tx.getSelectedText()) && RegExp.input) || '#';
            if (tx.selection.isCaret) {
                var element = $('<a>').text(value).attr('href', value)[0];
                tx.insertHtml(element);
            } else {
                tx.execCommand('createLink', value);
            }
        },
        remove: 'keepText',
        commands: {
            setURL: function (tx, value) {
                tx.widget.element.href = value;
            },
            unlink: function (tx) {
                tx.removeWidget(tx.widget);
            }
        }
    };

    Typer.defaultOptions.link = true;

    $.extend(Typer.ui.controls, {
        'toolbar:link': Typer.ui.callout({
            controls: 'link:*',
            requireWidgetEnabled: 'link',
            hiddenWhenDisabled: true,
            dialog: function (toolbar, self) {
                if (typeof toolbar.options.selectLink === 'function') {
                    return toolbar.options.selectLink();
                }
                return toolbar.prompt('dialog:selectLink', self.widget ? $(self.widget.element).attr('href') : '');
            },
            execute: function (toolbar, self, tx, value) {
                if (self.widget) {
                    tx.invoke('setURL', value);
                } else {
                    tx.insertWidget('link', value);
                }
            },
            active: function (toolbar, self) {
                return self.widget;
            }
        }),
        'link:url': Typer.ui.textbox({
            hiddenWhenDisabled: true,
            requireWidget: 'link',
            execute: 'setURL',
            stateChange: function (toolbar, self) {
                self.value = $(self.widget.element).attr('href');
            }
        }),
        'link:blank': Typer.ui.checkbox({
            hiddenWhenDisabled: true,
            requireWidget: 'link',
            stateChange: function (toolbar, self) {
                self.value = $(self.widget.element).attr('target') === '_blank';
            },
            execute: function (toolbar, self) {
                if (self.value) {
                    $(self.widget.element).attr('target', '_blank');
                } else {
                    $(self.widget.element).removeAttr('target');
                }
            }
        }),
        'link:unlink': Typer.ui.button({
            hiddenWhenDisabled: true,
            requireWidget: 'link',
            execute: 'unlink'
        })
    });

    Typer.ui.addLabels('en', {
        'toolbar:link': 'Insert Link',
        'link:url': 'Link URL',
        'link:blank': 'Open in New Window',
        'link:unlink': 'Remove Link',
        'dialog:selectLink': 'Enter URL'
    });

    Typer.ui.addIcons('material', {
        'toolbar:link': 'insert_link',
        'link:url': 'insert_link'
    });

} (jQuery, window.Typer));

(function ($, Typer) {
    'use strict';

    var reMediaType = /\.(?:(jpg|jpeg|png|gif|webp)|(mp4|ogg|webm)|(mp3))(?:\?.*)?$/gi;

    Typer.widgets.media = {
        element: 'img,audio,video,a:has(>img)',
        text: function (widget) {
            return widget.element.src;
        },
        insert: function (tx, options) {
            var element = Typer.createElement(reMediaType.exec(options.src || options) && (RegExp.$1 ? 'img' : RegExp.$2 ? 'video' : 'audio'));
            element.src = options.src || options;
            tx.insertHtml(element);
        }
    };

    Typer.defaultOptions.media = true;

    var insertMediaButton = Typer.ui.button.extend(function (type) {
        this._super({
            requireWidgetEnabled: 'media',
            hiddenWhenDisabled: true,
            dialog: function (toolbar) {
                if (typeof toolbar.options.selectMedia === 'function') {
                    return toolbar.options.selectMedia(type);
                }
                return toolbar.prompt('dialog:selectImage');
            },
            execute: function (toolbar, self, tx, value) {
                tx.insertWidget('media', value);
            }
        });
    });

    $.extend(Typer.ui.controls, {
        'widget:media': Typer.ui.group('media:* widget:delete'),
        'insert:image': insertMediaButton('image'),
        'insert:video': insertMediaButton('video'),
        'media:filePicker': Typer.ui.button({
            requireWidget: 'media',
            stateChange: function (toolbar, self) {
                self.value = $(self.widget.element).attr('src');
                self.label = (/(?:^|\/)([^/?#]+)(?:\?.+)?$/.exec(self.value) || [])[1] || '';
            },
            dialog: function (toolbar, self) {
                if (typeof toolbar.options.selectMedia === 'function') {
                    var mediaType = reMediaType.exec(self.label) && (RegExp.$1 ? 'image' : RegExp.$2 ? 'video' : 'audio');
                    return toolbar.options.selectMedia(mediaType, self.value);
                }
                return toolbar.prompt('dialog:selectImage', self.value);
            },
            execute: function (toolbar, self, tx, value) {
                $(self.widget.element).attr('src', value.src || value);
            }
        }),
        'media:altText': Typer.ui.textbox({
            requireWidget: 'media',
            hiddenWhenDisabled: true,
            stateChange: function (toolbar, self) {
                self.value = $(self.widget.element).attr('alt');
            },
            execute: function (toolbar, self) {
                $(self.widget.element).attr('alt', self.value);
            }
        })
    });

    Typer.ui.addLabels('en', {
        'insert:image': 'Image',
        'insert:video': 'Video',
        'media:altText': 'Alternate Text',
        'dialog:selectImage': 'Enter Image URL'
    });

    Typer.ui.addIcons('material', {
        'insert:image': 'insert_photo',
        'insert:video': 'videocam',
        'media:altText': 'comment'
    });

} (jQuery, window.Typer));

(function ($, Typer) {
    'use strict';

    var TD_HTML = '<td></td>';
    var TH_HTML = '<th></th>';
    var TR_HTML = '<tr>%</tr>';

    function repeat(str, count) {
        return new Array(count + 1).join(str);
    }

    function moveToCell(tx, dx, dy) {
        var cell = $('>tbody>tr', tx.widget.element).eq(Math.max(0, tx.widget.row + dx)).children()[Math.max(0, tx.widget.column + dy)];
        tx.normalize(tx.widget.element);
        tx.moveCaret(cell, -0);
    }

    Typer.widgets.table = {
        element: 'table',
        editable: 'th,td',
        insert: function (tx, options) {
            options = $.extend({
                rows: 2,
                columns: 2
            }, options);
            tx.insertHtml('<table>' + repeat(TR_HTML.replace('%', repeat(TD_HTML, options.columns)), options.rows) + '</table>');
        },
        beforeStateChange: function (e) {
            var selection = e.typer.getSelection();
            var selectedCells = selection.getEditableElements(e.widget);
            var c = selectedCells.length > 1 ? -1 : $(selectedCells).index();
            var r = selectedCells.length > 1 ? -1 : $(selectedCells).parent().index();
            $.extend(e.widget, {
                row: r,
                rowCount: $('>tbody>tr', e.widget.element).length,
                rowCells: $('>tbody>tr:nth-child(' + (r + 1) + ')>*', e.widget.element).get(),
                column: c,
                columnCount: $('>tbody>tr:first>*', e.widget.element).length,
                columnCells: $('>tbody>tr>*:nth-child(' + (c + 1) + ')', e.widget.element).get()
            });
        },
        tab: function (e) {
            var cells = $('>tbody>tr>*', e.widget.element).get();
            var currentIndex = e.widget.row * e.widget.columnCount + e.widget.column;
            if (currentIndex < cells.length - 1) {
                e.typer.moveCaret(cells[currentIndex + 1]);
            }
        },
        shiftTab: function (e) {
            var cells = $('>tbody>tr>*', e.widget.element).get();
            var currentIndex = e.widget.row * e.widget.columnCount + e.widget.column;
            if (currentIndex > 0) {
                e.typer.moveCaret(cells[currentIndex - 1], -0);
            }
        },
        ctrlEnter: function (e) {
            if (e.widget.row === 0 && e.widget.column === 0) {
                e.typer.invoke('insertSpaceBefore');
            } else if (e.widget.row === e.widget.rowCount - 1 && e.widget.column === e.widget.columnCount - 1) {
                e.typer.invoke('insertSpaceAfter');
            }
        },
        commands: {
            justifyLeft: function (tx) {
                $(tx.selection.getEditableElements(tx.widget)).attr('align', 'left');
            },
            justifyCenter: function (tx) {
                $(tx.selection.getEditableElements(tx.widget)).attr('align', 'center');
            },
            justifyRight: function (tx) {
                $(tx.selection.getEditableElements(tx.widget)).attr('align', 'right');
            },
            addColumnBefore: function (tx) {
                $(tx.widget.columnCells).filter('th').before(TH_HTML);
                $(tx.widget.columnCells).filter('td').before(TD_HTML);
                moveToCell(tx, 0, 0);
            },
            addColumnAfter: function (tx) {
                $(tx.widget.columnCells).filter('th').after(TH_HTML);
                $(tx.widget.columnCells).filter('td').after(TD_HTML);
                moveToCell(tx, 0, 1);
            },
            addRowAbove: function (tx) {
                $(tx.widget.rowCells).before(TR_HTML.replace('%', repeat(TD_HTML, tx.widget.columnCount)));
                moveToCell(tx, 0, 0);
            },
            addRowBelow: function (tx) {
                $(tx.widget.rowCells).after(TR_HTML.replace('%', repeat(TD_HTML, tx.widget.columnCount)));
                moveToCell(tx, 1, 0);
            },
            removeColumn: function (tx) {
                $(tx.widget.columnCells).remove();
                moveToCell(tx, 0, -1);
            },
            removeRow: function (tx) {
                $(tx.widget.rowCells).remove();
                moveToCell(tx, -1, 0);
            },
            toggleTableHeader: function (tx) {
                if ($(tx.widget.element).find('th')[0]) {
                    $(tx.widget.element).find('tr:has(th)').remove();
                    if (tx.widget.row === 0) {
                        moveToCell(tx, 0, 0);
                    }
                } else {
                    $(tx.widget.element).find('tbody').prepend(TR_HTML.replace('%', repeat(TH_HTML, tx.widget.columnCount)));
                    moveToCell(tx, -tx.widget.row, -tx.widget.column);
                }
            },
            insertSpaceBefore: function (tx) {
                tx.select(tx.widget.element, Typer.COLLAPSE_START_OUTSIDE);
                tx.insertText('');
            },
            insertSpaceAfter: function (tx) {
                tx.select(tx.widget.element, Typer.COLLAPSE_END_OUTSIDE);
                tx.insertText('');
            }
        }
    };

    $.extend(Typer.ui.controls, {
        'insert:table': Typer.ui.callout({
            controls: 'table:*',
            requireWidgetEnabled: 'table',
            hiddenWhenDisabled: true,
            execute: function (toolbar, self, tx) {
                tx.insertWidget('table');
            },
            active: function (toolbar, self) {
                return self.widget;
            }
        }),
        'table:addColumnBefore': Typer.ui.button({
            requireWidget: 'table',
            execute: 'addColumnBefore'
        }),
        'table:addColumnAfter': Typer.ui.button({
            requireWidget: 'table',
            execute: 'addColumnAfter'
        }),
        'table:addRowAbove': Typer.ui.button({
            requireWidget: 'table',
            execute: 'addRowAbove'
        }),
        'table:addRowBelow': Typer.ui.button({
            requireWidget: 'table',
            execute: 'addRowBelow'
        }),
        'table:removeColumn': Typer.ui.button({
            requireWidget: 'table',
            execute: 'removeColumn'
        }),
        'table:removeRow': Typer.ui.button({
            requireWidget: 'table',
            execute: 'removeRow'
        })
    });

    Typer.ui.addLabels('en', {
        'insert:table': 'Table',
        'table:addColumnBefore': 'Add Column Before',
        'table:addColumnAfter': 'Add Column After',
        'table:addRowAbove': 'Add Row Above',
        'table:addRowBelow': 'Add Row Below',
        'table:removeColumn': 'Remove Column',
        'table:removeRow': 'Remove Row'
    });

    Typer.ui.addIcons('material', {
        'insert:table': 'border_all'
    });

} (jQuery, window.Typer));

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
                Typer.ui.setZIndex(toolbar.element, toolbar.typer.element);
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
        widgetInit: function (e) {
            var widget = e.data;
            widget.toolbar = createToolbar(e.typer, e.widget.options, widget);
        },
        focusin: function (e) {
            showToolbar(e.widget.toolbar);
        },
        focusout: function (e) {
            setTimeout(hideToolbar);
        },
        widgetFocusin: function (e) {
            var widget = e.data;
            if (widget.toolbar.all['toolbar:widget'].controls[0]) {
                widget.toolbar.update();
                showToolbar(widget.toolbar);
            }
        },
        widgetFocusout: function (e) {
            showToolbar(e.widget.toolbar);
        },
        widgetDestroy: function (e) {
            var widget = e.data;
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
            .typer-visualizer { position:fixed;pointer-events:none; }\
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
            activeWidget = e.data;
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

(function ($, Typer) {
    'use strict';

    var $blockUI = $('<div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(255,255,255,0.5) url(data:image/gif;,);z-index:999;">');

    Typer.ui.themes.material = {
        resources: [
            'https://fonts.googleapis.com/css?family=Roboto:400,500,700',
            'https://fonts.googleapis.com/icon?family=Material+Icons',
            'https://cdn.rawgit.com/misonou/jquery-typer/master/css/jquery.typer.material.css'
        ],
        controlActiveClass: 'active',
        controlDisabledClass: 'disabled',
        controlHiddenClass: 'hidden',
        labelText: function (ui, control) {
            var hasIcon = !!Typer.ui.getIcon(control, 'material');
            return hasIcon && ui.type === 'toolbar' && (control.type === 'textbox' || (control.parent || '').type !== 'callout') ? '' : '<span x:bind="(_:label)"></span>';
        },
        labelIcon: function (ui, control) {
            var icon = Typer.ui.getIcon(control, 'material');
            if ((control.parent || '').type === 'callout') {
                return control.type === 'checkbox' ? '' : icon.replace(/.*/, '<i class="material-icons">$&</i>');
            }
            return icon.replace(/.+/, '<i class="material-icons">$&</i>');
        },
        group: '<div class="typer-ui-group" x:bind="(role:name)"><br x:t="children"/></div>',
        label: '<span class="typer-ui-label"><br x:t="labelIcon"/><br x:t="labelText"/></span>',
        button: '<button x:bind="(title:label,role:name)"><br x:t="label"/><span class="typer-ui-menu-annotation" x:bind="(_:annotation)"></span></button>',
        buttonExecuteOn: 'click',
        callout: '<div class="typer-ui-menu" x:bind="(role:name)"><button x:bind="(title:label)"><br x:t="label"/></button><div class="typer-ui-menupane"><br x:t="children"></div></div>',
        calloutExecuteOn: {
            on: 'click',
            of: '>button'
        },
        dropdown: '<div class="typer-ui-dropdown typer-ui-menu" x:bind="(role:name)"><button x:bind="(title:label)"><span class="typer-ui-label"><br x:t="labelIcon"/><span x:bind="(_:selectedValue)"></span></span></button><div class="typer-ui-menupane"><br x:t="children(t:button)"></div></div>',
        checkbox: '<label class="typer-ui-checkbox" x:bind="(title:label,role:name)"><input type="checkbox" x:bind="(checked:value)"/><br x:t="label"/></label>',
        checkboxExecuteOn: {
            on: 'change',
            of: ':checkbox'
        },
        textbox: '<label class="typer-ui-textbox" x:bind="(role:name,title:label)"><br x:t="label"/><div contenteditable spellcheck="false" x:bind="(data-placeholder:label)"></div></label>',
        textboxInit: function (ui, control) {
            var $editable = $('[contenteditable]', control.element);
            $editable.typer('textbox', {
                enter: function () {
                    ui.execute('ui:button-ok');
                },
                escape: function () {
                    ui.execute('ui:button-cancel');
                }
            });
            $editable.bind('change', function () {
                ui.setValue(control, this.value);
                $(control.element).toggleClass('empty', !this.value);
            });
            $editable.bind('focusin focusout', function (e) {
                $(control.element).parents('.typer-ui-menu').toggleClass('open', e.type === 'focusin');
            });
        },
        textboxStateChange: function (toolbar, control) {
            $(control.element).toggleClass('empty', !control.value);
            $(control.element).find('[contenteditable]').prop('value', control.value || '');
        },
        dialog: '<div class="typer-ui-dialog"><h1><br x:t="label"/></h1><br x:t="children"></div>',
        dialogOpen: function (dialog, control) {
            $blockUI.appendTo(document.body);
            $(dialog.element).appendTo(document.body);
            setTimeout(function () {
                $(control.element).addClass('open');
                $('[contenteditable]:first', dialog.all['ui:prompt-input'].element).focus();
            });
        },
        dialogClose: function (dialog, control) {
            $blockUI.detach();
            $(control.element).removeClass('open').one('transitionend otransitionend webkitTransitionEnd', function () {
                $(dialog.element).remove();
            });
        },
        init: function (ui) {
            $(ui.element).on('mouseover', '.typer-ui-menu', function (e) {
                setTimeout(function () {
                    var callout = $('.typer-ui-menupane', e.currentTarget)[0];
                    var nested = !!$(e.currentTarget).parents('.typer-ui-menu')[1];
                    var rect = callout.getBoundingClientRect();
                    if (rect.top + rect.height > $(window).height()) {
                        $(callout).css('bottom', nested ? '0' : '100%');
                    } else if (rect.top < 0) {
                        $(callout).css('bottom', 'auto');
                    }
                    if (rect.left + rect.width > $(window).width()) {
                        $(callout).css('right', nested ? '100%' : '0');
                    } else if (rect.left < 0) {
                        $(callout).css('right', 'auto');
                    }
                });
            });
        }
    };

} (jQuery, window.Typer));
