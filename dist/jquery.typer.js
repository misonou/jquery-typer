/*!
 * jQuery Typer Plugin v0.10.0
 *
 * The MIT License (MIT)
 *
 * Copyright (c) 2017
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

    var KEYNAMES = JSON.parse('{"8":"backspace","9":"tab","13":"enter","16":"shift","17":"ctrl","18":"alt","19":"pause","20":"capsLock","27":"escape","32":"space","33":"pageUp","34":"pageDown","35":"end","36":"home","37":"leftArrow","38":"upArrow","39":"rightArrow","40":"downArrow","45":"insert","46":"delete","48":"0","49":"1","50":"2","51":"3","52":"4","53":"5","54":"6","55":"7","56":"8","57":"9","65":"a","66":"b","67":"c","68":"d","69":"e","70":"f","71":"g","72":"h","73":"i","74":"j","75":"k","76":"l","77":"m","78":"n","79":"o","80":"p","81":"q","82":"r","83":"s","84":"t","85":"u","86":"v","87":"w","88":"x","89":"y","90":"z","91":"leftWindow","92":"rightWindowKey","93":"select","96":"numpad0","97":"numpad1","98":"numpad2","99":"numpad3","100":"numpad4","101":"numpad5","102":"numpad6","103":"numpad7","104":"numpad8","105":"numpad9","106":"multiply","107":"add","109":"subtract","110":"decimalPoint","111":"divide","112":"f1","113":"f2","114":"f3","115":"f4","116":"f5","117":"f6","118":"f7","119":"f8","120":"f9","121":"f10","122":"f11","123":"f12","144":"numLock","145":"scrollLock","186":"semiColon","187":"equalSign","188":"comma","189":"dash","190":"period","191":"forwardSlash","192":"backtick","219":"openBracket","220":"backSlash","221":"closeBracket","222":"singleQuote"}');
    var VOID_TAGS = 'area base br col command embed hr img input keygen link meta param source track wbr'.split(' ');
    var INNER_PTAG = 'h1,h2,h3,h4,h5,h6,p,q,blockquote,pre,code,li,caption,figcaption,summary,dt,th';
    var SOURCE_PRIORITY = 'keystroke textInput mouse cut paste'.split(' ');
    var ZWSP = '\u200b';
    var ZWSP_ENTITIY = '&#8203;';
    var EMPTY_LINE = '<p>&#8203;</p>';
    var WIDGET_CORE = '__core__';
    var WIDGET_ROOT = '__root__';
    var WIDGET_UNKNOWN = '__unknown__';
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
    var NODE_ANY_ALLOWTEXT = NODE_PARAGRAPH | NODE_EDITABLE_PARAGRAPH | NODE_INLINE | NODE_INLINE_EDITABLE;
    var EVENT_ALL = 1;
    var EVENT_STATIC = 2;
    var EVENT_HANDLER = 3;
    var EVENT_CURRENT = 4;
    var IS_IE = !!window.ActiveXObject || document.documentElement.style.msTouchAction !== undefined;

    var caretRangeFromPoint_ = document.caretRangeFromPoint;
    var compareDocumentPosition_ = document.compareDocumentPosition;
    var compareBoundaryPoints_ = Range.prototype.compareBoundaryPoints;

    var isFunction = $.isFunction;
    var selection = window.getSelection();
    var clipboard = {};
    var userFocus;
    var caretNotification;
    var windowFocusedOut;
    var permitFocusEvent;
    var supportTextInputEvent;

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

    function TyperEvent(eventName, typer, widget, data, props) {
        this.eventName = eventName;
        this.typer = typer;
        this.widget = widget || null;
        this.data = data !== undefined ? data : null;
        $.extend(this, props);
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
        nodeIteratorInit(this, is(root, TyperTreeWalker) || new TyperTreeWalker(root, NODE_WIDGET | NODE_ANY_ALLOWTEXT));
    }

    function TyperChangeTracker(typer) {
        this.typer = typer;
        this.changes = [];
    }

    function TyperCaret(typer, selection) {
        this.typer = typer;
        this.selection = selection || null;
    }

    function TyperCaretNotification() {
        this.weakMap = new WeakMap();
    }

    function transaction(finalize) {
        return function run(callback, args, thisArg) {
            var originalValue = run.executing;
            try {
                run.executing = true;
                return callback.apply(thisArg || this, args);
            } finally {
                run.executing = originalValue;
                if (!run.executing && finalize) {
                    finalize();
                }
            }
        };
    }

    function defineProperty(obj, name, value, freeze) {
        Object.defineProperty(obj, name, {
            configurable: !freeze,
            writable: true,
            value: value
        });
    }

    function definePrototype(fn, prototype) {
        fn.prototype = prototype;
        defineProperty(prototype, 'constructor', fn);
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
        var value = iterator.currentNode ? acceptNode(iterator) : 3;
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
        return (selector === '*' || tagName(element) === selector || $(element).is(selector)) && element;
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
        var v = a && b && compareDocumentPosition_.call(a, b);
        if (v & 2) {
            return (strict && v & 8) || (v & 1) ? NaN : 1;
        }
        if (v & 4) {
            return (strict && v & 16) || (v & 1) ? NaN : -1;
        }
        return NaN;
    }

    function connected(a, b) {
        return a && b && !(compareDocumentPosition_.call(a.commonAncestorContainer || a, b.commonAncestorContainer || b) & 1);
    }

    function containsOrEquals(container, contained) {
        return container === contained || $.contains(container, contained);
    }

    function getCommonAncestor(a, b) {
        for (b = b || a; a && a !== b && compareDocumentPosition_.call(a, b) !== 20; a = a.parentNode);
        return a;
    }

    function getOffset(node, offset) {
        var len = node.length || node.childNodes.length;
        return (offset === len || (offset === 0 && 1 / offset === -Infinity)) ? len : (len + offset) % len || 0;
    }

    function getWholeTextOffset(node, textNode) {
        var iterator = new TyperDOMNodeIterator(node, 5);
        for (var offset = 0, cur; (cur = iterator.nextNode()) && cur !== textNode; offset += cur.length || 0);
        return offset;
    }

    function createRange(startNode, startOffset, endNode, endOffset) {
        if (startNode && isFunction(startNode.getRange)) {
            return startNode.getRange();
        }
        var range;
        if (is(startNode, Node)) {
            range = document.createRange();
            if (+startOffset !== startOffset) {
                range[(startOffset === 'contents' || !startNode.parentNode) ? 'selectNodeContents' : 'selectNode'](startNode);
                if (typeof startOffset === 'boolean') {
                    range.collapse(startOffset);
                }
            } else {
                range.setStart(startNode, getOffset(startNode, startOffset));
            }
            if (is(endNode, Node) && connected(startNode, endNode)) {
                range.setEnd(endNode, getOffset(endNode, endOffset));
            }
        } else if (is(startNode, Range)) {
            range = startNode.cloneRange();
            if (!range.collapsed && typeof startOffset === 'boolean') {
                range.collapse(startOffset);
            }
        }
        if (is(startOffset, Range) && connected(range, startOffset)) {
            var inverse = range.collapsed && startOffset.collapsed ? -1 : 1;
            if (compareBoundaryPoints_.call(range, 0, startOffset) * inverse < 0) {
                range.setStart(startOffset.startContainer, startOffset.startOffset);
            }
            if (compareBoundaryPoints_.call(range, 2, startOffset) * inverse > 0) {
                range.setEnd(startOffset.endContainer, startOffset.endOffset);
            }
        }
        return range;
    }

    function rangeIntersects(a, b) {
        a = is(a, Range) || createRange(a);
        b = is(b, Range) || createRange(b);
        return connected(a, b) && compareBoundaryPoints_.call(a, 3, b) <= 0 && compareBoundaryPoints_.call(a, 1, b) >= 0;
    }

    function rangeCovers(a, b) {
        a = is(a, Range) || createRange(a);
        b = is(b, Range) || createRange(b);
        return connected(a, b) && compareBoundaryPoints_.call(a, 0, b) <= 0 && compareBoundaryPoints_.call(a, 2, b) >= 0;
    }

    function rangeEquals(a, b) {
        a = is(a, Range) || createRange(a);
        b = is(b, Range) || createRange(b);
        return connected(a, b) && compareBoundaryPoints_.call(a, 0, b) === 0 && compareBoundaryPoints_.call(a, 2, b) === 0;
    }

    function compareRangePosition(a, b, strict) {
        a = is(a, Range) || createRange(a);
        b = is(b, Range) || createRange(b);
        var value = !connected(a, b) ? NaN : compareBoundaryPoints_.call(a, 0, b) + compareBoundaryPoints_.call(a, 2, b);
        return (strict && ((value !== 0 && rangeIntersects(a, b)) || (value === 0 && !rangeEquals(a, b)))) ? NaN : value && value / Math.abs(value);
    }

    function rectEquals(a, b) {
        function check(prop) {
            return Math.abs(a[prop] - b[prop]) < 1;
        }
        return check('left') && check('top') && check('bottom') && check('right');
    }

    function rectCovers(a, b) {
        return b.left >= a.left && b.right <= a.right && b.top >= a.top && b.bottom <= a.bottom;
    }

    function pointInRect(x, y, rect) {
        return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    }

    function computeTextRects(node) {
        var target = is(node, Range) || createRange(node, 'contents');
        var zeroLength = target.collapsed && target.startContainer.nodeType === 3 && !target.startContainer.length;
        if (zeroLength) {
            // no rects are returned for zero-length text node
            // return rects as if there was content
            target.startContainer.nodeValue = ZWSP;
        }
        try {
            if (target.collapsed) {
                // no rects are returned for caret ranges anchored at the end of text node
                // calculate rect from the last character
                if (target.startOffset === target.startContainer.length) {
                    target.setStart(target.startContainer, target.startOffset - 1);
                    var rect = target.getClientRects()[0];
                    if (rect) {
                        return [{
                            top: rect.top,
                            left: rect.right,
                            right: rect.right,
                            bottom: rect.bottom,
                            width: 0,
                            height: rect.height
                        }];
                    }
                }
            }
            return target.getClientRects();
        } finally {
            if (zeroLength) {
                target.startContainer.nodeValue = '';
            }
        }
    }

    function getActiveRange(container) {
        if (selection.rangeCount) {
            var range = selection.getRangeAt(0);
            return containsOrEquals(container, range.commonAncestorContainer) && range;
        }
    }

    function caretRangeFromPoint(x, y, element) {
        var range = caretRangeFromPoint_.call(document, x, y);
        if (range && element && element !== document.body && pointInRect(x, y, element.getBoundingClientRect())) {
            var elm = [];
            try {
                var container;
                while (comparePosition(element, (container = range.commonAncestorContainer), true)) {
                    var target = $(container).parentsUntil(getCommonAncestor(element, container)).slice(-1)[0] || container;
                    if (target === elm[elm.length - 1]) {
                        return null;
                    }
                    target.style.pointerEvents = 'none';
                    elm[elm.length] = target;
                    range = caretRangeFromPoint_.call(document, x, y);
                }
            } finally {
                $(elm).css('pointer-events', '');
            }
        }
        return range;
    }

    function createDocumentFragment(node) {
        return is(node, DocumentFragment) || $(document.createDocumentFragment()).append(node)[0];
    }

    function createTextNode(text) {
        return document.createTextNode(text || ZWSP);
    }

    function createElement(name) {
        return document.createElement(name);
    }

    function removeNode(node, silent) {
        if (silent !== false) {
            iterate(document.createNodeIterator(node, 1, null, false), function (v) {
                caretNotification.update(v, node.parentNode);
            });
        }
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
        var topNodeType = options.inline || is(topElement, INNER_PTAG) ? NODE_EDITABLE_PARAGRAPH : NODE_EDITABLE;
        var widgets = [];
        var widgetOptions = {};
        var relatedElements = new WeakMap();
        var tracker = new TyperChangeTracker(typer);
        var undoable = {};
        var currentSelection;
        var typerDocument;
        var typerFocused = false;
        var $self = $(topElement);

        var codeUpdate = (function () {
            var currentSource = 'script';
            var run = transaction(function () {
                var source = currentSource;
                if (codeUpdate.needSnapshot) {
                    undoable.snapshot();
                }
                currentSource = 'script';
                setImmediate(function () {
                    codeUpdate.suppressTextEvent = false;
                    tracker.collect(function (changedWidgets) {
                        codeUpdate(source, function () {
                            $.each(changedWidgets, function (i, v) {
                                normalize(v.element);
                                if (v.id !== WIDGET_ROOT) {
                                    triggerEvent(source, v, 'contentChange', source);
                                }
                            });
                            triggerEvent(source, EVENT_STATIC, 'contentChange', source);
                        });
                    });
                });
            });
            return function (source, callback) {
                // IE fires textinput event on the parent element when the text node's value is modified
                // even if modification is done through JavaScript rather than user action
                codeUpdate.suppressTextEvent = true;
                if (source !== currentSource && SOURCE_PRIORITY.indexOf(source) > SOURCE_PRIORITY.indexOf(currentSource)) {
                    currentSource = source || 'script';
                }
                var args = slice(arguments, 2);
                return run(function () {
                    return callback.apply(null, args);
                });
            };
        } ());

        function TyperTransaction() { }

        function getTargetedWidgets(eventMode) {
            switch (eventMode) {
                case EVENT_ALL:
                    return widgets.concat(currentSelection.getWidgets().slice(0, -1));
                case EVENT_STATIC:
                    return widgets;
                case EVENT_HANDLER:
                    return currentSelection.getWidgets().reverse().concat(widgets);
                case EVENT_CURRENT:
                    return currentSelection.focusNode.widget;
            }
        }

        function findWidgetWithCommand(name) {
            return any(getTargetedWidgets(EVENT_HANDLER), function (v) {
                var options = widgetOptions[v.id];
                return options.commands && isFunction(options.commands[name]);
            });
        }

        function eventListened(widgets, name) {
            if (!Array.isArray(widgets)) {
                widgets = $.makeArray(is(widgets, TyperWidget) || getTargetedWidgets(widgets));
            }
            return !!any(widgets, function (v) {
                return !v.destroyed && isFunction(widgetOptions[v.id][name]);
            });
        }

        function triggerEvent(eventSource, eventMode, eventName, data, props) {
            var widgets = $.makeArray(is(eventMode, TyperWidget) || getTargetedWidgets(eventMode));
            var handlerCalled;
            if (eventListened(widgets, eventName)) {
                codeUpdate(eventSource, function () {
                    $.each(widgets, function (i, v) {
                        var options = widgetOptions[v.id];
                        if (!v.destroyed && isFunction(options[eventName])) {
                            handlerCalled = true;
                            options[eventName].call(options, new TyperEvent(eventName, typer, v, data, props));
                            return eventMode !== EVENT_HANDLER;
                        }
                    });
                });
            }
            if (is(eventMode, TyperWidget) && eventListened(EVENT_STATIC, 'widget' + capfirst(eventName))) {
                setTimeout(function () {
                    triggerEvent(eventSource, EVENT_STATIC, 'widget' + capfirst(eventName), null, {
                        targetWidget: eventMode
                    });
                });
            }
            return handlerCalled;
        }

        function triggerDefaultPreventableEvent(eventSource, eventMode, eventName, data, eventObj) {
            eventObj = eventObj || $.Event(eventName);
            triggerEvent(eventSource, eventMode, eventName, data, {
                preventDefault: eventObj.preventDefault.bind(eventObj),
                isDefaultPrevented: function () {
                    return eventObj.isDefaultPrevented();
                }
            });
            return eventObj.isDefaultPrevented();
        }

        function createTyperDocument(rootElement, fireEvent) {
            var nodeMap = new WeakMap();
            var dirtyElements = [];
            var self = {};
            var nodeSource = containsOrEquals(topElement, rootElement) ? typer : self;
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
                            triggerEvent(null, node.widget, 'destroy');
                        }
                        node.parentNode.childNodes.splice(index, 1);
                        node.parentNode = null;
                        (node.previousSibling || {}).nextSibling = node.nextSibling;
                        (node.nextSibling || {}).previousSibling = node.previousSibling;
                    }
                }
            }

            function updateNode(node) {
                var context = node.parentNode || nodeMap.get(rootElement);
                if (!is(context, NODE_WIDGET) && (!node.widget || !is(node.element, widgetOptions[node.widget.id].element))) {
                    if (fireEvent && node.widget && node.widget.element === node.element) {
                        node.widget.destroyed = true;
                        if (node.widget.id !== WIDGET_UNKNOWN) {
                            triggerEvent(null, node.widget, 'destroy');
                        }
                    }
                    delete node.widget;
                    $.each(widgetOptions, function (i, v) {
                        if (is(node.element, v.element)) {
                            node.widget = new TyperWidget(nodeSource, i, node.element, v.options);
                            return false;
                        }
                    });
                    if (fireEvent && node.widget && node.widget.id !== WIDGET_UNKNOWN) {
                        triggerEvent(null, node.widget, 'init');
                    }
                }
                if (node.widget && node.widget.id === WIDGET_UNKNOWN && !is(context, NODE_ANY_ALLOWTEXT)) {
                    node.widget = context.widget;
                    node.nodeType = NODE_WIDGET;
                } else {
                    node.widget = node.widget || context.widget;
                    var widgetOption = widgetOptions[node.widget.id];
                    if (node.widget === context.widget && !is(context, NODE_WIDGET)) {
                        node.nodeType = is(node.element, INNER_PTAG) ? NODE_PARAGRAPH : NODE_INLINE;
                    } else if (is(node.element, widgetOption.editable) || (widgetOption.inline && !widgetOption.editable)) {
                        node.nodeType = widgetOption.inline ? NODE_INLINE_EDITABLE : is(node.element, INNER_PTAG) ? NODE_EDITABLE_PARAGRAPH : NODE_EDITABLE;
                    } else {
                        node.nodeType = widgetOption.inline && node.widget !== context.widget && is(context, NODE_ANY_ALLOWTEXT) ? NODE_INLINE_WIDGET : NODE_WIDGET;
                    }
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
                    clearImmediate(ensureState.handle);
                    ensureState.handle = setImmediate(function () {
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
            nodeMap.set(rootElement, new TyperNode(topNodeType, rootElement, new TyperWidget(nodeSource, WIDGET_ROOT, topElement, options)));
            dirtyElements.push(null);

            return $.extend(self, {
                getNode: getNode,
                getEditableNode: function (element) {
                    var focusNode = getNode(element) || nodeMap.get(rootElement);
                    return is(focusNode, NODE_WIDGET) ? getNode(focusNode.widget.element) : focusNode;
                }
            });
        }

        function getRangeFromTextOffset(node, offset) {
            var caret = new TyperCaret(typer);
            caret.moveToText(node, offset);
            return caret.getRange();
        }

        function checkEditable(node) {
            if (is(node, NODE_EDITABLE) && !node.childNodes[0]) {
                $(node.element).html('<p>' + (trim(node.element.textContent) || ZWSP_ENTITIY) + '</p>');
                return true;
            }
            if (is(node, NODE_EDITABLE_PARAGRAPH) && !node.element.childNodes[0]) {
                $(createTextNode()).appendTo(node.element);
                return true;
            }
        }

        function textNodeFreezed(textNode) {
            var t1 = currentSelection.baseCaret;
            var t2 = currentSelection.extendCaret;
            if (textNode === t1.textNode || textNode === t2.textNode) {
                return true;
            }
            if (IS_IE) {
                // setting node value if text node that has selection anchored at position just between neighboring text node
                // will also trigger selection change in IE
                var v1 = t1.textNode && ((textNode === t1.textNode.previousSibling && t1.offset === 0) || (textNode === t1.textNode.nextSibling && t1.offset === t1.textNode.length));
                var v2 = t2.textNode && ((textNode === t2.textNode.previousSibling && t2.offset === 0) || (textNode === t2.textNode.nextSibling && t2.offset === t2.textNode.length));
                return v1 || v2;
            }
        }

        function normalize(range) {
            range = is(range, Range) || createRange(topElement, 'contents');
            codeUpdate('script', function () {
                iterate(new TyperSelection(typer, range).createTreeWalker(NODE_ANY_ALLOWTEXT | NODE_EDITABLE | NODE_SHOW_EDITABLE), function (node) {
                    if (checkEditable(node)) {
                        return;
                    }
                    if (is(node, NODE_ANY_INLINE) && !is(node.parentNode, NODE_ANY_ALLOWTEXT)) {
                        $(node.element).wrap('<p>');
                    }
                    if (is(node, NODE_ANY_ALLOWTEXT)) {
                        // WebKit adds dangling <BR> element when a line is empty
                        // normalize it into a ZWSP and continue process
                        var lastBr = $('>br:last-child', node.element)[0];
                        if (lastBr && !lastBr.nextSibling) {
                            $(createTextNode()).insertBefore(lastBr);
                            removeNode(lastBr);
                        }
                        var firstBr = $('>br:first-child', node.element)[0];
                        if (firstBr && !firstBr.previousSibling) {
                            removeNode(firstBr);
                        }
                        $('>br', node.element).each(function (i, v) {
                            if (!v.nextSibling || v.nextSibling.nodeType === 1) {
                                $(createTextNode()).insertAfter(v);
                            }
                        });
                        $(node.element).contents().each(function (i, v) {
                            if (v.nodeType === 3 && !textNodeFreezed(v)) {
                                var nextNode = v.nextSibling;
                                if (/\b\u00a0$/.test(v.nodeValue) && nextNode && nextNode.nodeType === 3 && !/^[^\S\u00a0]/.test(nextNode.nodeValue)) {
                                    // prevent unintended non-breaking space (&nbsp;) between word boundaries when inserting contents
                                    v.nodeValue = v.nodeValue.slice(0, -1) + ' ';
                                }
                                v.nodeValue = v.nodeValue.replace(/(?=.)\u200b+(?=.)/g, '').replace(/\b\u00a0\b/g, ' ') || ZWSP;
                                if (nextNode && nextNode.nodeType === 3 && !textNodeFreezed(nextNode)) {
                                    nextNode.nodeValue = v.nodeValue + nextNode.nodeValue;
                                    removeNode(v);
                                }
                            }
                        });
                        if (!/\S/.test(node.element.textContent)) {
                            $(createTextNode()).appendTo(node.element);
                        }
                        if (is(node, NODE_INLINE) && node.element !== currentSelection.startElement && node.element !== currentSelection.endElement) {
                            if (tagName(node.element.previousSibling) === tagName(node.element) && compareAttrs(node.element, node.element.previousSibling)) {
                                $(node.element).contents().appendTo(node.element.previousSibling);
                                removeNode(node.element);
                            }
                        }
                    }
                });
                // Mozilla adds <br type="_moz"> when a container is empty
                $('br[type="_moz"]', topElement).remove();
            });
        }

        function extractContents(range, mode, callback) {
            range = is(range, Range) || createRange(range);

            var method = mode === 'cut' ? 'extractContents' : mode === 'paste' ? 'deleteContents' : 'cloneContents';
            var cloneNode = mode !== 'paste';
            var clearNode = mode !== 'copy';
            var fragment = document.createDocumentFragment();
            var state = new TyperSelection(typer, range);
            var allowTextFlow = state.isSingleEditable || ((state.startNode.widget.id === WIDGET_ROOT || widgetOptions[state.startNode.widget.id].textFlow) && (state.endNode.widget.id === WIDGET_ROOT || widgetOptions[state.endNode.widget.id].textFlow));

            codeUpdate(mode, function () {
                if (!range.collapsed) {
                    var stack = [[topElement, fragment]];
                    iterate(state.createTreeWalker(-1, function (node) {
                        var content;
                        // skip focused editable element because all selected content is within the editable element
                        if (node === state.focusNode && is(node, NODE_EDITABLE)) {
                            return 3;
                        }
                        while (is(node.element, Node) && !containsOrEquals(stack[0][0], node.element)) {
                            stack.shift();
                        }
                        if (rangeCovers(range, node.element)) {
                            if (cloneNode) {
                                content = node.element.cloneNode(true);
                                $(stack[0][1]).append(node.element === topElement ? content.childNodes : content);
                            }
                            if (clearNode) {
                                if (is(node, NODE_EDITABLE)) {
                                    $(node.element).html(EMPTY_LINE);
                                    tracker.track(node);
                                } else if (is(node, NODE_EDITABLE_PARAGRAPH)) {
                                    $(node.element).html(ZWSP_ENTITIY);
                                    tracker.track(node);
                                } else {
                                    removeNode(node.element);
                                }
                            }
                            return 2;
                        }
                        if (is(node, NODE_ANY_ALLOWTEXT)) {
                            content = createRange(node.element, range)[method]();
                        }
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
                        if (clearNode) {
                            tracker.track(node);
                        }
                        return is(node, NODE_ANY_ALLOWTEXT) ? 2 : 1;
                    }));
                }
                if (isFunction(callback)) {
                    var startPoint = createRange(range, true);
                    var endPoint = !allowTextFlow ? startPoint : createRange(range, false);
                    var newState = new TyperSelection(typer, createRange(startPoint, endPoint));

                    // check if current insertion point is an empty editable element
                    // normalize before inserting content
                    if (is(newState.startNode, NODE_ANY_BLOCK_EDITABLE) && newState.startNode === newState.endNode && checkEditable(newState.startNode)) {
                        newState = new TyperSelection(typer, createRange(newState.startNode.element, 'contents'));
                    }
                    // ensure start point lies within valid selection
                    if (compareRangePosition(startPoint, newState.startNode.element) < 0) {
                        startPoint = createRange(newState.startNode.element, 0);
                    }
                    callback(newState, startPoint, endPoint);
                }
            });
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
                var forcedInline = is(state.startNode, NODE_EDITABLE_PARAGRAPH);
                var insertAsInline = is(state.startNode, NODE_ANY_ALLOWTEXT);
                var paragraphAsInline = true;
                var hasInsertedBlock;
                var formattingNodes = [];

                var cur = typerDocument.getNode(state.startElement);
                if (is(cur, NODE_ANY_INLINE)) {
                    for (; cur !== state.startNode; cur = cur.parentNode) {
                        if (is(cur, NODE_INLINE)) {
                            formattingNodes.push(cur.element);
                        }
                    }
                    formattingNodes.push(state.startNode.element);
                } else if (is(cur, NODE_PARAGRAPH)) {
                    formattingNodes[0] = state.startNode.element;
                } else if (!is(cur, NODE_EDITABLE_PARAGRAPH)) {
                    formattingNodes[0] = createElement('p');
                }

                while (content[0]) {
                    var nodeToInsert = content.shift();
                    var node = new TyperNode(NODE_INLINE, nodeToInsert);
                    var isLineBreak = tagName(nodeToInsert) === 'br';
                    if (nodeToInsert.nodeType === 1 && !isLineBreak) {
                        startPoint.insertNode(nodeToInsert);
                        node = typerDocument.getNode(nodeToInsert);
                        removeNode(nodeToInsert);
                        if (node.widget.id === WIDGET_UNKNOWN || (allowedWidgets[1] !== '*' && allowedWidgets.indexOf(node.widget.id) < 0)) {
                            nodeToInsert = createTextNode(node.widget.id === WIDGET_UNKNOWN ? nodeToInsert.textContent : extractText(nodeToInsert));
                            node = new TyperNode(NODE_INLINE, nodeToInsert);
                        }
                    }
                    if ((isLineBreak && !is(typerDocument.getEditableNode(caretPoint.startContainer), NODE_PARAGRAPH | NODE_EDITABLE_PARAGRAPH)) || !is(node, NODE_ANY_ALLOWTEXT | NODE_INLINE_WIDGET) || (!is(node, NODE_ANY_INLINE) && !paragraphAsInline)) {
                        var splitLastNode = typerDocument.getEditableNode(caretPoint.startContainer);
                        while (!is(splitLastNode.parentNode, isLineBreak ? NODE_PARAGRAPH : NODE_ANY_BLOCK_EDITABLE)) {
                            splitLastNode = splitLastNode.parentNode;
                        }
                        var splitEnd = createRange(splitLastNode.element, false);
                        var splitContent = createRange(caretPoint, splitEnd).extractContents();
                        if (!splitContent.textContent) {
                            // avoid unindented empty elements when splitting at end of line
                            splitContent = createDocumentFragment(wrapNode(createTextNode(), formattingNodes));
                        }
                        var splitFirstNode = splitContent.firstChild;
                        splitEnd.insertNode(splitContent);
                        tracker.track(splitEnd.startContainer);

                        if (!/\S/.test(splitLastNode.element.textContent)) {
                            caretPoint.insertNode(createTextNode());
                        }
                        if (splitFirstNode && !/\S/.test(splitFirstNode.textContent)) {
                            splitFirstNode.appendChild(createTextNode());
                        }
                        if (splitLastNode.element.textContent.slice(-1) === ' ') {
                            var n1 = iterateToArray(document.createNodeIterator(splitLastNode.element, 4, null, false)).filter(mapFn('nodeValue')).slice(-1)[0];
                            n1.nodeValue = n1.nodeValue.slice(0, -1) + '\u00a0';
                        }
                        if (splitFirstNode && splitFirstNode.textContent.charAt(0) === ' ') {
                            var n2 = iterateToArray(document.createNodeIterator(splitFirstNode, 4, null, false)).filter(mapFn('nodeValue'))[0];
                            n2.nodeValue = n2.nodeValue.slice(1);
                        }
                        caretPoint = isLineBreak ? createRange(splitEnd, true) : splitFirstNode ? createRange(splitFirstNode, 0) : createRange(splitEnd, false);
                        endPoint = createRange(splitEnd, false);
                        if (!isLineBreak) {
                            paragraphAsInline = true;
                            hasInsertedBlock = true;
                        }
                    }
                    insertAsInline = insertAsInline && is(node, NODE_ANY_ALLOWTEXT | NODE_INLINE_WIDGET);
                    if (!isLineBreak) {
                        if (is(node, NODE_ANY_INLINE)) {
                            nodeToInsert = createDocumentFragment(wrapNode(nodeToInsert, insertAsInline ? formattingNodes.slice(0, -1) : formattingNodes));
                        } else if (insertAsInline && paragraphAsInline) {
                            nodeToInsert = createDocumentFragment(nodeToInsert.childNodes);
                        }
                    }
                    var lastNode = createDocumentFragment(nodeToInsert).lastChild;
                    if (insertAsInline) {
                        if (lastNode) {
                            caretPoint.insertNode(nodeToInsert);
                            if (isLineBreak || is(node, NODE_INLINE_WIDGET)) {
                                // ensure there is a text insertion point after an inline widget
                                caretPoint = createRange(lastNode, false);
                                caretPoint.insertNode(createTextNode());
                                caretPoint.collapse(false);
                            } else {
                                caretPoint = createRange(lastNode, -0);
                            }
                        }
                        paragraphAsInline = forcedInline;
                    } else {
                        var caretNode = typerDocument.getEditableNode(caretPoint.startContainer);
                        if (is(caretNode, NODE_ANY_BLOCK_EDITABLE)) {
                            caretPoint.insertNode(nodeToInsert);
                        } else {
                            createRange(caretNode.element, true).insertNode(nodeToInsert);
                        }
                        insertAsInline = forcedInline || is(node, NODE_ANY_ALLOWTEXT | NODE_INLINE_WIDGET);
                        caretPoint = insertAsInline ? createRange(lastNode, -0) : createRange(lastNode, false);
                        paragraphAsInline = forcedInline || !insertAsInline;
                        hasInsertedBlock = true;
                    }
                    tracker.track(caretPoint.startContainer);
                }
                if (!hasInsertedBlock && state.startNode !== state.endNode && is(state.startNode, NODE_PARAGRAPH) && is(state.endNode, NODE_PARAGRAPH)) {
                    if (caretPoint) {
                        var caretNode2 = typerDocument.getNode(caretPoint.startContainer);
                        while (is(caretNode2, NODE_ANY_INLINE)) {
                            caretNode2 = caretNode2.parentNode;
                        }
                        caretPoint = createRange(caretNode2.element, -0);
                    } else {
                        caretPoint = createRange(state.startNode.element, -0);
                    }
                    caretPoint.insertNode(createRange(state.endNode.element, 'contents').extractContents());
                    caretPoint.collapse(true);
                    removeNode(state.endNode.element);
                    tracker.track(state.endNode);
                    tracker.track(state.startNode);
                }
                currentSelection.select(caretPoint);
            });
        }

        function extractText(content) {
            if (containsOrEquals(topElement, content)) {
                content = extractContents(content, 'copy');
            }
            var text = '';
            var rootNode = createTyperDocument(content).getNode(content);
            iterate(new TyperTreeWalker(rootNode, -1, function (v) {
                if (is(v, NODE_WIDGET | NODE_INLINE_WIDGET) && isFunction(widgetOptions[v.widget.id].text)) {
                    text += (text && '\n\n') + widgetOptions[v.widget.id].text(v.widget);
                    return 2;
                }
                if (is(v, NODE_ANY_ALLOWTEXT)) {
                    var it = new TyperTreeWalker(v, NODE_ANY_ALLOWTEXT | NODE_INLINE_WIDGET | NODE_SHOW_EDITABLE, function (v) {
                        if (is(v, NODE_WIDGET | NODE_INLINE_WIDGET) && isFunction(widgetOptions[v.widget.id].text)) {
                            text += widgetOptions[v.widget.id].text(v.widget);
                            return 2;
                        }
                        return is(v, NODE_ANY_ALLOWTEXT) ? 1 : 3;
                    });
                    text += text && '\n\n';
                    iterate(new TyperDOMNodeIterator(it, 5), function (v) {
                        text += v.nodeType === 3 ? v.nodeValue : tagName(v) === 'br' ? '\n' : '';
                    });
                    return 2;
                }
            }));
            return text.replace(/\u200b/g, '').replace(/[^\S\n\u00a0]+|\u00a0/g, ' ');
        }

        function initUndoable() {
            var MARKER_ATTR = ['x-typer-end', 'x-typer-start'];
            var lastValue = topElement.outerHTML;
            var snapshots = [];
            var currentIndex = 0;
            var snapshotTimeout;

            function triggerStateChange() {
                setTimeout(function () {
                    triggerEvent(null, EVENT_ALL, 'beforeStateChange');
                    triggerEvent(null, EVENT_ALL, 'stateChange');
                });
            }

            function checkActualChange() {
                var value = trim(topElement.innerHTML.replace(/\s+(style|x-typer-(start|end))(="[^"]*")?|(?!>)\u200b(?!<\/)/g, ''));
                if (value !== lastValue) {
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
                    return +offset === offset ? getRangeFromTextOffset(element, offset) : createRange(element, !!start);
                }
            }

            function takeSnapshot() {
                triggerStateChange();
                setMarker(currentSelection.startTextNode || currentSelection.startElement, currentSelection.startOffset, true);
                if (!currentSelection.isCaret) {
                    setMarker(currentSelection.endTextNode || currentSelection.endElement, currentSelection.endOffset, false);
                }
                var newValue = topElement.outerHTML;
                if (newValue !== snapshots[0]) {
                    var hasChange = checkActualChange();
                    snapshots.splice(0, currentIndex + !hasChange, newValue);
                    snapshots.splice(Typer.historyLevel);
                    currentIndex = 0;
                }
                $self.find('[x-typer-start], [x-typer-end]').andSelf().removeAttr('x-typer-start x-typer-end');
            }

            function applySnapshot(value) {
                var content = $.parseHTML(value)[0];
                $self.empty().append(content.childNodes).attr(attrs(content));
                currentSelection.select(getRangeFromMarker(true), getRangeFromMarker(false));
                triggerStateChange();
                checkActualChange();
            }

            $.extend(undoable, {
                getValue: function () {
                    if (codeUpdate.needSnapshot) {
                        codeUpdate.needSnapshot = false;
                        takeSnapshot();
                    }
                    return lastValue.slice(lastValue.indexOf('>') + 1, lastValue.lastIndexOf('<'));
                },
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
                    clearTimeout(snapshotTimeout);
                    if (+delay === delay || !currentSelection) {
                        snapshotTimeout = setTimeout(takeSnapshot, delay);
                    } else if (delay === true || !codeUpdate.executing) {
                        codeUpdate.needSnapshot = false;
                        takeSnapshot();
                    } else {
                        codeUpdate.needSnapshot = true;
                        triggerStateChange();
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

            function getEventName(e, suffix) {
                return lowfirst(((e.ctrlKey || e.metaKey) ? 'Ctrl' : '') + (e.altKey ? 'Alt' : '') + (e.shiftKey ? 'Shift' : '') + capfirst(suffix));
            }

            function triggerWidgetFocusout() {
                var widget = activeWidget;
                if (activeWidget && !activeWidget.destroyed) {
                    activeWidget = null;
                    triggerEvent(null, widget, 'focusout');
                }
            }

            function updateFromNativeInput() {
                var activeRange = getActiveRange(topElement);
                if (!userFocus.has(typer) && activeRange && !rangeEquals(activeRange, createRange(currentSelection))) {
                    currentSelection.select(activeRange);
                    if (currentSelection.focusNode.widget !== activeWidget) {
                        triggerWidgetFocusout();
                    }
                    var timeStamp = +new Date();
                    setTimeout(function () {
                        undoable.snapshot(timeStamp - lastInputTime < 200 ? 200 : 0);
                        lastInputTime = timeStamp;
                    });
                }
            }

            function deleteNextContent(e) {
                if (!currentSelection.isCaret) {
                    codeUpdate('keystroke', function () {
                        insertContents(currentSelection, '');
                    });
                } else {
                    var selection = currentSelection.clone();
                    if (selection.extendCaret.moveByCharacter(e.data === 'backspace' ? -1 : 1)) {
                        codeUpdate('keystroke', function () {
                            insertContents(selection, '');
                        });
                    }
                }
            }

            function handleTextInput(inputText, compositionend) {
                if (inputText && triggerDefaultPreventableEvent('textInput', EVENT_ALL, 'textInput', inputText)) {
                    return true;
                }
                if (compositionend || !currentSelection.startTextNode || !currentSelection.isCaret) {
                    codeUpdate('textInput', function () {
                        insertContents(currentSelection, inputText);
                    });
                    return true;
                }
                setImmediate(function () {
                    updateFromNativeInput();
                    if (getTargetedWidgets(EVENT_CURRENT).id !== WIDGET_ROOT) {
                        triggerEvent('textInput', EVENT_CURRENT, 'contentChange', 'textInput');
                    }
                    triggerEvent('textInput', EVENT_STATIC, 'contentChange', 'textInput');
                });
            }

            $self.mousedown(function (e) {
                var handlers = {
                    mousemove: function (e) {
                        if (!e.which && mousedown) {
                            handlers.mouseup();
                            return;
                        }
                        currentSelection.extendCaret.moveToPoint(e.clientX, e.clientY);
                        setImmediate(function () {
                            currentSelection.focus();
                        });
                        e.preventDefault();
                    },
                    mouseup: function () {
                        mousedown = false;
                        $(document.body).unbind(handlers);
                    }
                };
                if (e.which === 1) {
                    (e.shiftKey ? currentSelection.extendCaret : currentSelection).moveToPoint(e.clientX, e.clientY);
                    if (!typerFocused) {
                        currentSelection.focus();
                    }
                    $(document.body).bind(handlers);
                    mousedown = true;
                }
                e.preventDefault();
            });

            $self.bind('compositionstart compositionupdate compositionend', function (e) {
                e.stopPropagation();
                composition = e.type.slice(-1) !== 'd';
                if (!composition) {
                    var range = getActiveRange(topElement);
                    createRange(range.startContainer, range.startOffset - e.originalEvent.data.length, range.startContainer, range.startOffset).deleteContents();
                    updateFromNativeInput();
                    handleTextInput(e.originalEvent.data, true);
                } else {
                    handleTextInput('');
                }
            });

            $self.bind('keydown keypress keyup', function (e) {
                if (composition) {
                    e.stopImmediatePropagation();
                    return;
                }
                hasKeyEvent = true;
                setImmediate(function () {
                    hasKeyEvent = false;
                });
                var isModifierKey = ($.inArray(e.keyCode, [16, 17, 18, 91, 93]) >= 0);
                var isSpecialKey = !isModifierKey && KEYNAMES[e.keyCode] !== String.fromCharCode(e.keyCode).toLowerCase();
                if (e.type === 'keydown') {
                    modifierCount = e.ctrlKey + e.shiftKey + e.altKey + e.metaKey + !isModifierKey;
                    modifierCount *= isSpecialKey || ((modifierCount > 2 || (modifierCount > 1 && !e.shiftKey)) && !isModifierKey);
                    modifiedKeyCode = e.keyCode;
                    if (modifierCount) {
                        var keyEventName = getEventName(e, KEYNAMES[modifiedKeyCode] || String.fromCharCode(e.charCode));
                        if (triggerEvent('keystroke', EVENT_HANDLER, keyEventName)) {
                            e.preventDefault();
                        }
                        if (triggerDefaultPreventableEvent('keystroke', EVENT_ALL, 'keystroke', keyEventName, e) || /ctrl(?![acfnprstvwx]|f5|shift[nt]$)|enter/i.test(keyEventName)) {
                            e.preventDefault();
                        }
                    }
                    keyDefaultPrevented = e.isDefaultPrevented();
                    setImmediate(function () {
                        if (!composition && !keyDefaultPrevented) {
                            updateFromNativeInput();
                        }
                    });
                } else if (e.type === 'keypress') {
                    if (!e.charCode) {
                        e.stopImmediatePropagation();
                    }
                } else {
                    if ((e.keyCode === modifiedKeyCode || isModifierKey) && modifierCount--) {
                        e.stopImmediatePropagation();
                    }
                    if (!keyDefaultPrevented && !isModifierKey && !composition) {
                        updateFromNativeInput();
                    }
                }
            });

            $self.bind('keypress input textInput', function (e) {
                if (!codeUpdate.executing && !codeUpdate.suppressTextEvent && (e.type === 'textInput' || !supportTextInputEvent)) {
                    if (handleTextInput(e.originalEvent.data || String.fromCharCode(e.charCode) || '')) {
                        e.preventDefault();
                    }
                }
            });

            $self.bind('dragstart', function (e) {
                var selectedRange = createRange(currentSelection);
                var handlers = {
                    drop: function (e) {
                        codeUpdate('drop', function () {
                            var range = caretRangeFromPoint(e.originalEvent.clientX, e.originalEvent.clientY);
                            var content = extractContents(selectedRange, e.ctrlKey ? 'copy' : 'cut');
                            insertContents(range, content);
                            e.preventDefault();
                            $self.unbind(handlers);
                        });
                    }
                };
                $self.bind(handlers);
            });

            $self.bind('cut copy', function (e) {
                var clipboardData = e.originalEvent.clipboardData || window.clipboardData;
                codeUpdate('cut', function () {
                    clipboard.content = extractContents(currentSelection, e.type);
                    clipboard.textContent = extractText(clipboard.content);
                });
                if (window.clipboardData) {
                    clipboardData.setData('Text', clipboard.textContent);
                } else {
                    clipboardData.setData('text/plain', clipboard.textContent);
                    clipboardData.setData('text/html', $('<div id="Typer">').append(clipboard.content.cloneNode(true))[0].outerHTML);
                    clipboardData.setData('application/x-typer', 'true');
                }
                e.preventDefault();
            });

            $self.bind('paste', function (e) {
                var clipboardData = e.originalEvent.clipboardData || window.clipboardData;
                var acceptHtml = widgetOptions[currentSelection.focusNode.widget.id].accept !== 'text';
                if (acceptHtml && $.inArray('application/x-typer', clipboardData.types) >= 0) {
                    var html = clipboardData.getData('text/html');
                    var content = createDocumentFragment($(html).filter('#Typer').contents());
                    codeUpdate('paste', function () {
                        insertContents(currentSelection, content);
                    });
                } else {
                    var textContent = clipboardData.getData(window.clipboardData ? 'Text' : 'text/plain');
                    if (acceptHtml && textContent === clipboard.textContent) {
                        codeUpdate('paste', function () {
                            insertContents(currentSelection, clipboard.content.cloneNode(true));
                        });
                    } else if (!triggerDefaultPreventableEvent('paste', EVENT_ALL, 'textInput', textContent)) {
                        codeUpdate('paste', function () {
                            insertContents(currentSelection, textContent);
                        });
                    }
                }
                e.preventDefault();
                if (IS_IE) {
                    // IE put the caret in the wrong position after user code
                    // need to reposition the caret
                    var selection = currentSelection.clone();
                    setImmediate(function () {
                        currentSelection.select(selection);
                    });
                }
            });

            $self.bind('mousedown mouseup mscontrolselect', function (e) {
                var node = typerDocument.getNode(e.target);
                if (activeWidget !== node.widget) {
                    triggerWidgetFocusout();
                }
                if (is(node, NODE_WIDGET | NODE_INLINE_WIDGET)) {
                    // disable resize handle on image element on IE and Firefox
                    // also select the whole widget when clicking on uneditable elements
                    setImmediate(function () {
                        currentSelection.focus();
                    });
                    currentSelection.select(node.widget.element);
                    if (activeWidget !== node.widget) {
                        activeWidget = node.widget;
                        triggerEvent(null, node.widget, 'focusin');
                    }
                }
            });

            $self.bind('contextmenu', function (e) {
                var range = caretRangeFromPoint(e.clientX, e.clientY, topElement);
                if (currentSelection.isCaret || !rangeIntersects(currentSelection, range)) {
                    currentSelection.select(range);
                }
            });

            $self.bind('click', function (e) {
                var props = {
                    clientX: e.clientX,
                    clientY: e.clientY,
                    target: e.target
                };
                triggerEvent('mouse', EVENT_HANDLER, getEventName(e, 'click'), null, props);
                e.preventDefault();
            });

            $self.bind('dblclick', function (e) {
                if (!triggerEvent('mouse', EVENT_HANDLER, 'dblclick')) {
                    currentSelection.select('word');
                }
                e.preventDefault();
            });

            $self.bind('mousewheel', function (e) {
                if (typerFocused && triggerDefaultPreventableEvent('mouse', EVENT_HANDLER, 'mousewheel', Typer.ui.getWheelDelta(e))) {
                    e.preventDefault();
                }
            });

            $self.bind('focusin', function (e) {
                // prevent focus event triggered due to content updates through code
                // when current editor is not focused
                if (typerFocused || (codeUpdate.executing && !permitFocusEvent)) {
                    return;
                }
                permitFocusEvent = false;
                windowFocusedOut = false;
                if (!userFocus.has(typer)) {
                    typerFocused = true;
                    triggerEvent(null, EVENT_ALL, 'focusin');
                    if (!mousedown) {
                        currentSelection.focus();
                    }
                }
                userFocus.delete(typer);
            });

            $self.bind('focusout', function (e) {
                if (document.activeElement !== topElement && typerFocused) {
                    if (e.relatedTarget === undefined) {
                        // Chrome triggers focusout event with relatedTarget equals undefined
                        // after contextmenu event by right mouse click
                        return;
                    }
                    for (var element = e.relatedTarget; element; element = element.parentNode) {
                        if (relatedElements.has(element)) {
                            userFocus.set(typer, element);
                            return;
                        }
                    }
                    typerFocused = false;
                    triggerWidgetFocusout();
                    triggerEvent(null, EVENT_ALL, 'focusout');
                    normalize();

                    // prevent focus returns to current editor
                    // due to content updates through code
                    if (containsOrEquals(topElement, document.activeElement)) {
                        if (e.relatedTarget) {
                            e.relatedTarget.focus();
                        } else {
                            topElement.blur();
                        }
                    }
                }
            });

            var defaultKeystroke = {
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
            };
            $.each({
                moveByLine: 'upArrow downArrow shiftUpArrow shiftDownArrow',
                moveByWord: 'ctrlLeftArrow ctrlRightArrow ctrlShiftLeftArrow ctrlShiftRightArrow',
                moveToLineEnd: 'home end shiftHome shiftEnd',
                moveByCharacter: 'leftArrow rightArrow shiftLeftArrow shiftRightArrow'
            }, function (i, v) {
                $.each(v.split(' '), function (j, v) {
                    var direction = (j & 1) ? 1 : -1;
                    var extend = !!(j & 2);
                    defaultKeystroke[v] = function () {
                        if (!extend && !currentSelection.isCaret) {
                            currentSelection.collapse(direction < 0 ? 'start' : 'end');
                        } else {
                            (extend ? currentSelection.extendCaret : currentSelection)[i](direction);
                        }
                    };
                });
            });
            widgetOptions.__core__.keystroke = function (e) {
                if (!e.isDefaultPrevented() && (e.data in defaultKeystroke)) {
                    e.preventDefault();
                    defaultKeystroke[e.data](e);
                }
            };
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
            widgets[0] = new TyperWidget(typer, WIDGET_ROOT);
            $.each(options.widgets || {}, activateWidget);
            $.each(Typer.widgets, activateWidget);
            widgets[widgets.length] = new TyperWidget(typer, WIDGET_CORE);

            widgetOptions[WIDGET_ROOT] = options;
            widgetOptions[WIDGET_CORE] = {};
            widgetOptions[WIDGET_UNKNOWN] = {
                // make all other tags that are not considered paragraphs and inlines to be widgets
                // to avoid unknown behavior while editing
                element: options.disallowedElement || ':not(' + INNER_PTAG + ',br,b,em,i,u,strike,small,strong,sub,sup,ins,del,mark,span)'
            };
        }

        var retainFocusHandlers = {
            focusout: function (e) {
                if (!containsOrEquals(e.currentTarget, e.relatedTarget)) {
                    if (userFocus.get(typer) === e.currentTarget) {
                        userFocus.delete(typer);
                    }
                    if (topElement === e.relatedTarget) {
                        currentSelection.focus();
                    } else {
                        $self.trigger('focusout');
                    }
                }
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
            focused: function () {
                return typerFocused;
            },
            widgetEnabled: function (id) {
                return widgetOptions.hasOwnProperty(id);
            },
            getStaticWidget: function (id) {
                return any(widgets.slice(1, -1), function (v) {
                    return v.id === id;
                });
            },
            getStaticWidgets: function () {
                return widgets.slice(1, -1);
            },
            getSelection: function () {
                return currentSelection;
            },
            extractText: function (selection) {
                var content = extractContents(selection || topElement, 'copy');
                return extractText(content);
            },
            nodeFromPoint: function (x, y) {
                var range = caretRangeFromPoint(x, y, topElement);
                return range && typerDocument.getNode(range.commonAncestorContainer);
            },
            retainFocus: function (element) {
                if (!relatedElements.has(element)) {
                    relatedElements.set(element, true);
                    $(element).bind(retainFocusHandlers);
                }
            },
            releaseFocus: function (element) {
                relatedElements.delete(element);
                $(element).unbind(retainFocusHandlers);
            },
            invoke: function (command, value) {
                var tx = new TyperTransaction();
                if (typeof command === 'string') {
                    tx.commandName = command;
                    tx.widget = findWidgetWithCommand(command);
                    command = tx.widget && widgetOptions[tx.widget.id].commands[command];
                }
                if (isFunction(command)) {
                    codeUpdate('script', function () {
                        command.call(typer, tx, value);
                        if (typerFocused && !userFocus.has(typer)) {
                            currentSelection.focus();
                        }
                    });
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
                    insertContents(createRange(widget.element, true), textContent);
                    removeNode(widget.element);
                } else {
                    insertContents(createRange(widget.element), '');
                }
            },
            replaceElement: function (oldElement, newElement) {
                newElement = is(newElement, Node) || createElement(newElement);
                $(newElement).append(oldElement.childNodes).insertBefore(oldElement);
                caretNotification.update(oldElement, newElement);
                removeNode(oldElement, false);
                tracker.track(newElement.parentNode);
                return newElement;
            },
            removeElement: function (element) {
                removeNode(element);
                tracker.track(element.parentNode);
            },
            trackChange: function (node) {
                tracker.track(node);
            },
            execCommand: function (commandName, value) {
                var r1, r2;
                $.each(currentSelection.getEditableRanges(), function (i, v) {
                    applyRange(v);
                    document.execCommand(commandName, false, value || '');
                    r1 = r1 || selection.getRangeAt(0);
                    r2 = selection.getRangeAt(0);
                });
                currentSelection.select(createRange(r1, true), createRange(r2, false));
            }
        });

        currentSelection = new TyperSelection(typer, createRange(topElement, 0));
        normalize();
        triggerEvent(null, EVENT_STATIC, 'init');
    }

    window.Typer = Typer;

    $.extend(Typer, {
        NODE_WIDGET: NODE_WIDGET,
        NODE_PARAGRAPH: NODE_PARAGRAPH,
        NODE_EDITABLE: NODE_EDITABLE,
        NODE_EDITABLE_PARAGRAPH: NODE_EDITABLE_PARAGRAPH,
        NODE_INLINE: NODE_INLINE,
        NODE_INLINE_WIDGET: NODE_INLINE_WIDGET,
        NODE_INLINE_EDITABLE: NODE_INLINE_EDITABLE,
        NODE_OUTER_PARAGRAPH: NODE_OUTER_PARAGRAPH,
        NODE_SHOW_EDITABLE: NODE_SHOW_EDITABLE,
        NODE_ANY_ALLOWTEXT: NODE_ANY_ALLOWTEXT,
        NODE_ANY_BLOCK_EDITABLE: NODE_ANY_BLOCK_EDITABLE,
        NODE_ANY_INLINE: NODE_ANY_INLINE,
        ZWSP: ZWSP,
        ZWSP_ENTITIY: ZWSP_ENTITIY,
        is: is,
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
        rectCovers: rectCovers,
        pointInRect: pointInRect,
        caretRangeFromPoint: caretRangeFromPoint,
        historyLevel: 100,
        defaultOptions: {
            disallowedWidgets: 'keepText',
            widgets: {}
        },
        widgets: {}
    });

    definePrototype(Typer, {
        hasContent: function () {
            return !!this.getValue();
        },
        setValue: function (value) {
            this.selectAll();
            this.invoke(function (tx) {
                tx.insertHtml(value);
            });
        },
        select: function (startNode, startOffset, endNode, endOffset) {
            this.getSelection().select(startNode, startOffset, endNode, endOffset);
        },
        selectAll: function () {
            this.getSelection().selectAll();
        }
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

    function nodeIteratorInit(inst, iterator) {
        var typer = iterator.currentNode.widget.typer;
        var iterator2 = document.createTreeWalker(iterator.root.element, inst.whatToShow | 1, function (v) {
            return treeWalkerAcceptNode(iterator, typer.getNode(v), true) !== 1 ? 3 : acceptNode(inst, v) | 1;
        }, false);
        defineProperty(inst, 'iterator', iterator2);
    }

    definePrototype(TyperDOMNodeIterator, {
        get currentNode() {
            return this.iterator.currentNode;
        },
        set currentNode(node) {
            this.iterator.currentNode = node;
        },
        previousNode: function () {
            return this.iterator.previousNode();
        },
        nextNode: function () {
            return this.iterator.nextNode();
        }
    });

    function typerSelectionDeepIterator(inst, whatToShow, filter) {
        var range = createRange(inst);
        return new TyperTreeWalker(inst.focusNode, whatToShow | NODE_SHOW_EDITABLE, function (v) {
            return !rangeIntersects(v.element, range) ? 2 : !filter ? 1 : filter(v);
        });
    }

    function typerSelectionSplitText(inst) {
        var p1 = inst.getCaret('start');
        var p2 = inst.getCaret('end');
        var sameNode = (p1.textNode === p2.textNode);
        if (p2.textNode && p2.offset < p2.textNode.length) {
            p2.textNode.splitText(p2.offset);
        }
        if (p1.textNode && p1.offset > 0) {
            var offset = p1.offset;
            typerSelectionAtomic(inst, function () {
                caretSetPositionRaw(p1, p1.node, p1.element, p1.textNode.splitText(p1.offset), 0);
                if (sameNode) {
                    caretSetPositionRaw(p2, p2.node, p2.element, p1.textNode, p2.offset - offset);
                }
            });
        }
    }

    function typerSelectionUpdate(inst) {
        inst.direction = compareRangePosition(inst.extendCaret.getRange(), inst.baseCaret.getRange()) || 0;
        inst.isCaret = !inst.direction;
        for (var i = 0, p1 = inst.getCaret('start'), p2 = inst.getCaret('end'); i < 4; i++) {
            inst[typerSelectionUpdate.NAMES[i + 4]] = p1[typerSelectionUpdate.NAMES[i]];
            inst[typerSelectionUpdate.NAMES[i + 8]] = p2[typerSelectionUpdate.NAMES[i]];
        }
    }
    typerSelectionUpdate.NAMES = 'node element textNode offset startNode startElement startTextNode startOffset endNode endElement endTextNode endOffset'.split(' ');

    function typerSelectionAtomic(inst, callback, args, thisArg) {
        inst._lock = inst._lock || transaction(function () {
            delete inst._lock;
            typerSelectionUpdate(inst);
            if (inst === inst.typer.getSelection()) {
                if (inst.typer.focused() && !userFocus.has(inst.typer)) {
                    inst.focus();
                }
                inst.typer.snapshot();
            }
        });
        return inst._lock(callback, args, thisArg);
    }

    definePrototype(TyperSelection, {
        get isSingleEditable() {
            return this.isCaret || !typerSelectionDeepIterator(this, NODE_ANY_BLOCK_EDITABLE).nextNode();
        },
        get focusNode() {
            var node = this.typer.getEditableNode(getCommonAncestor(this.baseCaret.element, this.extendCaret.element));
            while (node.parentNode && !is(node, NODE_WIDGET | NODE_INLINE_WIDGET | NODE_ANY_BLOCK_EDITABLE | NODE_INLINE_EDITABLE)) {
                node = node.parentNode;
            }
            return node;
        },
        getCaret: function (point) {
            switch (point) {
                case 'extend':
                    return this.extendCaret;
                case 'start':
                    return this.direction < 0 ? this.extendCaret : this.baseCaret;
                case 'end':
                    return this.direction < 0 ? this.baseCaret : this.extendCaret;
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
            if (this.isCaret || is(this.focusNode, NODE_ANY_INLINE)) {
                return [range];
            }
            return $.map(iterateToArray(typerSelectionDeepIterator(this, NODE_PARAGRAPH | NODE_EDITABLE_PARAGRAPH)), function (v) {
                return createRange(range, createRange(v.element));
            });
        },
        getWidgets: function () {
            var nodes = [];
            for (var node = this.focusNode; node; node = node.parentNode) {
                nodes.unshift(node.widget);
                node = this.typer.getNode(node.widget.element);
            }
            return nodes;
        },
        getParagraphElements: function () {
            if (this.isCaret) {
                return [this.startNode.element];
            }
            var iterator = new TyperTreeWalker(this.focusNode, NODE_PARAGRAPH | NODE_SHOW_EDITABLE);
            var nodes = iterateToArray(iterator, null, this.startNode);
            nodes.splice(nodes.indexOf(this.endNode) + 1);
            return $.map(nodes, mapFn('element'));
        },
        getSelectedElements: function () {
            if (this.isCaret) {
                return [this.startElement];
            }
            return iterateToArray(typerSelectionDeepIterator(this, NODE_ANY_ALLOWTEXT | NODE_INLINE_WIDGET), mapFn('element'));
        },
        getSelectedText: function () {
            return this.typer.extractText(this);
        },
        getSelectedTextNodes: function () {
            if (this.isCaret) {
                return [];
            }
            typerSelectionSplitText(this);
            var range = createRange(this);
            var iterator = new TyperDOMNodeIterator(typerSelectionDeepIterator(this, NODE_ANY_ALLOWTEXT), 4, function (v) {
                return rangeIntersects(range, createRange(v, 'contents')) ? 1 : 2;
            });
            return iterateToArray(iterator);
        },
        createTreeWalker: function (whatToShow, filter) {
            return typerSelectionDeepIterator(this, whatToShow, filter);
        },
        collapse: function (point) {
            point = this.getCaret(point);
            return (point === this.baseCaret ? this.extendCaret : this.baseCaret).moveTo(point);
        },
        select: function (startNode, startOffset, endNode, endOffset) {
            return typerSelectionAtomic(this, function () {
                if (startNode === 'word') {
                    return this.getCaret('start').moveByWord(-1) + this.getCaret('end').moveByWord(1) > 0;
                }
                var range = createRange(startNode, startOffset, endNode, endOffset);
                return this.baseCaret.moveTo(createRange(range, true)) + this.extendCaret.moveTo(createRange(range, false)) > 0;
            });
        },
        selectAll: function () {
            return this.select(this.typer.element, 'contents');
        },
        focus: function () {
            if (containsOrEquals(document, this.typer.element)) {
                permitFocusEvent = true;
                applyRange(createRange(this));
                // Firefox does not set focus on the host element automatically
                // when selection is changed by JavaScript
                if (!IS_IE && document.activeElement !== this.typer.element) {
                    this.typer.element.focus();
                }
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
        TyperSelection.prototype[v] = function () {
            return typerSelectionAtomic(this, function () {
                return TyperCaret.prototype[v].apply(this.extendCaret, arguments) + this.collapse('extend') > 0;
            }, slice(arguments));
        };
    });

    definePrototype(TyperCaretNotification, {
        listen: function (inst, element) {
            var arr = this.weakMap.get(element) || (this.weakMap.set(element, []), this.weakMap.get(element));
            if (arr.indexOf(inst) < 0) {
                arr.push(inst);
            }
        },
        unlisten: function (inst, element) {
            var arr = this.weakMap.get(element);
            if (arr && arr.indexOf(inst) >= 0) {
                arr.splice(arr.indexOf(inst), 1);
            }
        },
        update: function (oldElement, newElement) {
            var carets = this.weakMap.get(oldElement);
            if (carets && carets.length) {
                typerSelectionAtomic(carets[0].selection, function () {
                    carets.forEach(function (caret) {
                        var n1 = caret.node.element === oldElement ? caret.typer.getNode(newElement) : caret.node;
                        var n2 = caret.element === oldElement ? newElement : caret.element;
                        var n3 = containsOrEquals(newElement, caret.textNode) ? caret.textNode : null;
                        if (n1 !== caret.node || n2 !== caret.element) {
                            caretSetPositionRaw(caret, n1, n2, n3, n3 ? caret.offset : true);
                        }
                    });
                });
            }
        }
    });

    function caretTextNodeIterator(inst) {
        var iterator = new TyperDOMNodeIterator(new TyperTreeWalker(inst.typer.getNode(inst.typer.element), NODE_ANY_ALLOWTEXT | NODE_SHOW_EDITABLE), 4);
        iterator.currentNode = inst.textNode || inst.element;
        return iterator;
    }

    function caretAtomic(inst, callback) {
        return inst.selection ? typerSelectionAtomic(inst.selection, callback, null, inst) : callback.call(inst);
    }

    function caretSetPositionRaw(inst, node, element, textNode, offset) {
        caretAtomic(inst, function () {
            if (inst.selection && inst.selection === inst.typer.getSelection()) {
                if (inst.node !== node && inst.node.element !== inst.element) {
                    caretNotification.unlisten(inst, inst.node.element);
                }
                if (inst.element !== element && inst.element !== inst.node.element) {
                    caretNotification.unlisten(inst, inst.element);
                }
                caretNotification.listen(inst, node.element);
                caretNotification.listen(inst, element);
            }
            inst.node = node;
            inst.element = element;
            inst.textNode = textNode || null;
            inst.offset = offset;
            inst.wholeTextOffset = (textNode ? inst.offset : 0) + getWholeTextOffset(node, textNode || element);
        });
        return true;
    }

    function caretSetPosition(inst, element, offset, end) {
        var node, textNode, textOffset;
        if (tagName(element) === 'br') {
            textNode = element.nextSibling;
            offset = 0;
        } else if (element.nodeType === 1 && element.childNodes[0]) {
            if (offset === element.childNodes.length || (end && element.childNodes[(offset || 1) - 1].nodeType === 1)) {
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
                }) || node.lastChild || node;
                element = node.element;
                textNode = null;
                end = true;
            }
        }
        if (!textNode && is(node, NODE_ANY_ALLOWTEXT)) {
            var iterator2 = new TyperDOMNodeIterator(node, 4);
            iterator2.currentNode = element;
            while (iterator2.nextNode() && end);
            if (iterator2.currentNode.nodeType === 3) {
                textNode = iterator2.currentNode;
            }
            offset = end ? textNode && textNode.length : 0;
        }
        if (is(node, NODE_ANY_ALLOWTEXT | NODE_INLINE_WIDGET)) {
            for (; node.parentNode && !is(node, NODE_PARAGRAPH | NODE_EDITABLE_PARAGRAPH); node = node.parentNode);
        }
        return caretSetPositionRaw(inst, node, element, textNode, textNode ? offset : !end);
    }

    definePrototype(TyperCaret, {
        getRange: function () {
            if ((this.element && this.element !== this.typer.element && !this.element.parentNode) || (this.textNode && (!this.textNode.parentNode || this.offset > this.textNode.length))) {
                // use calculated text offset from paragraph node in case anchored text node is detached from DOM
                // assuming that there is no unmanaged edit after the previous selection
                this.moveToText(this.node.element, this.wholeTextOffset);
            }
            if (IS_IE && this.textNode && this.offset === this.textNode.length && this.textNode.nextSibling && this.textNode.nextSibling.nodeType === 1 && !/inline/.test($(this.textNode.nextSibling).css('display'))) {
                // IE fails to visually position caret when it is at the end of text line
                // and there is a next sibling element which its display mode is not inline
                if (this.textNode.nodeValue.slice(-1) === ZWSP) {
                    this.offset--;
                } else {
                    this.textNode.nodeValue += ZWSP;
                }
            }
            return createRange(this.textNode || this.element, this.offset);
        },
        clone: function () {
            var clone = new TyperCaret(this.typer);
            clone.moveTo(this);
            return clone;
        },
        moveTo: function (node, offset) {
            var range = is(node, Range) || createRange(node, offset);
            if (range) {
                var end = this.selection && this === this.selection.extendCaret && compareRangePosition(this.selection.baseCaret, range) < 0;
                return caretSetPosition(this, range.startContainer, range.startOffset, end);
            }
            return false;
        },
        moveToPoint: function (x, y) {
            var range = caretRangeFromPoint(x, y, this.typer.element);
            var node = this.typer.getNode(range.startContainer);
            if (is(node, NODE_WIDGET)) {
                // range returned is anchored at the closest text node which may or may not be at the point (x, y)
                // avoid moving caret to widget element that does not actually cover that point
                if (!pointInRect(x, y, node.widget.element.getBoundingClientRect())) {
                    range = createRange(node.widget.element, false);
                }
            }
            return this.moveTo(range);
        },
        moveToText: function (node, offset) {
            if (node.nodeType !== 3) {
                var iterator = new TyperDOMNodeIterator(new TyperTreeWalker(this.typer.getNode(node), NODE_ANY_ALLOWTEXT | NODE_SHOW_EDITABLE), 4);
                if (offset) {
                    for (; iterator.nextNode() && offset > iterator.currentNode.length; offset -= iterator.currentNode.length);
                } else if (1 / offset < 0) {
                    while (iterator.nextNode());
                }
                node = iterator.currentNode;
            }
            return !!node && caretSetPosition(this, node, getOffset(node, offset));
        },
        moveToLineEnd: function (direction) {
            var rect = computeTextRects(this)[0];
            var minx = rect.left;
            iterate(new TyperDOMNodeIterator(new TyperTreeWalker(this.node, NODE_ANY_ALLOWTEXT | NODE_SHOW_EDITABLE), 4), function (v) {
                $.each(computeTextRects(v), function (i, v) {
                    if (v.top <= rect.bottom && v.bottom >= rect.top) {
                        minx = Math[direction < 0 ? 'min' : 'max'](minx, direction < 0 ? v.left : v.right);
                    }
                });
            });
            return this.moveToPoint(minx, rect.top + rect.height / 2);
        },
        moveByLine: function (direction) {
            var iterator = caretTextNodeIterator(this);
            var rect = computeTextRects(this)[0];
            do {
                var rects = computeTextRects(iterator.currentNode);
                var newRect = any(direction < 0 ? slice(rects).reverse() : rects, function (v) {
                    return direction < 0 ? v.bottom <= rect.top : v.top >= rect.bottom;
                });
                if (newRect) {
                    return this.moveToPoint(rect.left, newRect.top + newRect.height / 2);
                }
            } while (iterator[direction < 0 ? 'previousNode' : 'nextNode']());
            return this.moveToLineEnd(direction);
        },
        moveByWord: function (direction) {
            var re = direction < 0 ? /\b(\S*\s+|\S+)$/ : /^(\s+\S*|\S+)\b/;
            var str = '';
            var matched;
            if (this.textNode) {
                str = direction < 0 ? this.textNode.nodeValue.substr(0, this.offset) : this.textNode.nodeValue.slice(this.offset);
                if ((matched = re.test(str)) && RegExp.$1.length !== str.length) {
                    return this.moveToText(this.textNode, this.offset + direction * RegExp.$1.length);
                }
            }
            var iterator = new TyperDOMNodeIterator(new TyperTreeWalker(this.node, NODE_ANY_ALLOWTEXT | NODE_SHOW_EDITABLE), 4);
            iterator.currentNode = this.textNode || this.element;
            while (iterator[direction < 0 ? 'previousNode' : 'nextNode']()) {
                str = direction < 0 ? iterator.currentNode.nodeValue + str : str + iterator.currentNode.nodeValue;
                if ((matched = re.test(str)) && RegExp.$1.length !== str.length) {
                    return this.moveToText(iterator.currentNode, direction * (RegExp.$1.length - (str.length - iterator.currentNode.length)));
                }
            }
            return !matched || !iterator.currentNode ? false : this.moveToText(iterator.currentNode, 0 * -direction);
        },
        moveByCharacter: function (direction) {
            var iterator = caretTextNodeIterator(this);
            var rect = computeTextRects(this)[0];
            var offset = this.offset;
            while (true) {
                while (iterator.currentNode.nodeType === 1 || offset === getOffset(iterator.currentNode, 0 * -direction)) {
                    if (!iterator[direction < 0 ? 'previousNode' : 'nextNode']()) {
                        return false;
                    }
                    var p1 = new TyperCaret(this.typer);
                    p1.moveToText(iterator.currentNode);
                    offset = (direction < 0 ? iterator.currentNode.length : 0) + (p1.node !== this.node && -direction);
                }
                offset += direction;
                var newRect = computeTextRects(createRange(iterator.currentNode, offset))[0];
                if (!rect || (newRect && !rectEquals(rect, newRect))) {
                    return this.moveToText(iterator.currentNode, offset);
                }
            }
        }
    });

    $.each('moveByLine moveByWord moveByCharacter'.split(' '), function (i, v) {
        var fn = TyperCaret.prototype[v];
        TyperCaret.prototype[v] = function (direction) {
            return caretAtomic(this, function () {
                for (var step = direction; step && fn.call(this, direction / Math.abs(direction)); step += step > 0 ? -1 : 1);
                return !direction || step !== direction;
            });
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

    definePrototype(TyperChangeTracker, {
        track: function (node) {
            node = is(node, TyperNode) || this.typer.getNode(node);
            if (node && this.changes.indexOf(node.widget) < 0) {
                this.changes.push(node.widget);
            }
        },
        collect: function (callback) {
            if (this.changes.length && isFunction(callback)) {
                callback(this.changes.splice(0));
            }
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
        // IE raise event on the current active element instead of window object when browser loses focus
        // need to check if there is related target instead
        if (IS_IE ? !e.relatedTarget : e.target === window) {
            windowFocusedOut = e.type === 'focusout';
        }
    });

    // polyfill for WeakMap
    // simple and good enough as we only need to associate data to a DOM object
    if (typeof WeakMap === 'undefined') {
        WeakMap = function () {
            defineProperty(this, '__dataKey__', 'typer' + Math.random().toString(36).substr(2, 8), true);
        };
        definePrototype(WeakMap, {
            get: function (key) {
                return key && key[this.__dataKey__];
            },
            set: function (key, value) {
                key[this.__dataKey__] = value;
            },
            has: function (key) {
                return key && this.__dataKey__ in key;
            },
            delete: function (key) {
                delete key[this.__dataKey__];
            }
        });
    }
    userFocus = new WeakMap();
    caretNotification = new TyperCaretNotification();

    // polyfill for document.caretRangeFromPoint
    if (typeof caretRangeFromPoint_ === 'undefined') {
        caretRangeFromPoint_ = function () {
            if (document.caretPositionFromPoint) {
                return function (x, y) {
                    var pos = document.caretPositionFromPoint(x, y);
                    return createRange(pos.offsetNode, pos.offset);
                };
            }
            return function (x, y) {
                function distanceToRect(rect) {
                    var distX = rect.left > x ? rect.left - x : Math.min(0, rect.right - x);
                    var distY = rect.top > y ? rect.top - y : Math.min(0, rect.bottom - y);
                    return distX && distY ? Infinity : Math.abs(distX || distY);
                }

                function distanceFromCharacter(node, index) {
                    while (node.nodeValue.charCodeAt(index) === 10 && --index);
                    var rect;
                    if (node.nodeValue.charCodeAt(index) === 32 && index) {
                        // IE11 (update version 11.0.38) crashes with memory access violation when
                        // Range.getClientRects() is called on a whitespace neignboring a non-static positioned element
                        // https://jsfiddle.net/b6q4p664/
                        rect = computeTextRects(createRange(node, index - 1))[0];
                        rect = rect && {
                            top: rect.top,
                            left: rect.right,
                            right: rect.right,
                            bottom: rect.bottom
                        };
                    } else {
                        rect = computeTextRects(createRange(node, index))[0];
                    }
                    if (rect) {
                        var distX = rect.left > x ? rect.left - x : Math.min(0, rect.right - x);
                        var distY = rect.top > y ? rect.top - y : Math.min(0, rect.bottom - y);
                        return !distY ? distX : distY > 0 ? Infinity : -Infinity;
                    }
                }

                function findOffset(node) {
                    var b0 = 0;
                    var b1 = node.length;
                    while (b1 - b0 > 1) {
                        var mid = (b1 + b0) >> 1;
                        var p = distanceFromCharacter(node, mid) < 0;
                        b0 = p ? mid : b0;
                        b1 = p ? b1 : mid;
                    }
                    return Math.abs(distanceFromCharacter(node, b0)) < Math.abs(distanceFromCharacter(node, b1)) ? b0 : b1;
                }

                function hitTestChildElements(node) {
                    var currentZIndex;
                    var target;
                    $(node).children().each(function (i, v) {
                        var style = window.getComputedStyle(v, null);
                        if (style.pointerEvents !== 'none' && style.display !== 'inline' && pointInRect(x, y, v.getBoundingClientRect())) {
                            var zIndex = style.position === 'static' ? undefined : parseInt(style.zIndex) || 0;
                            if (currentZIndex === undefined || zIndex > currentZIndex) {
                                currentZIndex = zIndex;
                                target = v;
                            }
                        }
                    });
                    return target;
                }

                // IE returns outer element when the coordinate exactly on the box boundaries
                // manually finds the innermost selectable element and starts searching caret position there first
                // also before IE11 pointer-events does not thus cannot use document.elementFromPoint
                var element = window.ActiveXObject ? document.body : document.elementFromPoint(x, y);
                for (var child = element; child; element = child || element) {
                    child = hitTestChildElements(element);
                }

                var newY = y;
                for (var target = element, distY, lastDistY; target && target.nodeType === 1; element = target || element) {
                    distY = Infinity;
                    target = null;
                    $(element).contents().each(function (i, v) {
                        var rects;
                        if (v.nodeType === 3) {
                            rects = computeTextRects(v);
                        } else if (v.nodeType === 1 && $(v).css('pointer-events') !== 'none') {
                            rects = [v.getBoundingClientRect()];
                        }
                        for (var j = 0, length = (rects || '').length; j < length; j++) {
                            if (rects[j].top <= y && rects[j].bottom >= y) {
                                target = v;
                                newY = y;
                                distY = 0;
                                return v.nodeType === 1 || distanceFromCharacter(v, v.length - 1) < 0;
                            }
                            lastDistY = distY;
                            distY = Math.min(distY, distanceToRect(rects[j]));
                            if (distY < lastDistY) {
                                target = v;
                                newY = v.nodeType === 1 ? y : rects[j].top + rects[j].height / 2;
                            }
                        }
                    });
                }
                if (element.nodeType === 3) {
                    y = newY;
                    return createRange(element, findOffset(element));
                }
                return createRange(element, -0);
            };
        } ();
    }

    // detect support for textInput event
    function detectTextInputEvent(e) {
        keypressed = e.type === 'keypress';
        if (keypressed) {
            setImmediate(function () {
                supportTextInputEvent = !keypressed;
                document.removeEventListener('keypress', detectTextInputEvent, true);
                document.removeEventListener('textInput', detectTextInputEvent, true);
            });
        }
    }

    var keypressed;
    document.addEventListener('keypress', detectTextInputEvent, true);
    document.addEventListener('textInput', detectTextInputEvent, true);

    // IE fires input and text-input event on the innermost element where the caret positions at
    // the event does not bubble up so need to trigger manually on the top element
    // also IE use all lowercase letter in the event name
    function dispatchInputEvent(e) {
        for (var target = e.target; target; target = target.parentNode) {
            if (target.contentEditable === 'true') {
                var event = document.createEvent('Event');
                event.initEvent(e.type === 'input' ? 'input' : 'textInput', true, false);
                event.data = e.data;
                e.stopPropagation();
                target.dispatchEvent(event);
                return;
            }
        }
    }

    if (IS_IE) {
        document.addEventListener('input', dispatchInputEvent, true);
        document.addEventListener('textinput', dispatchInputEvent, true);
    }

} (jQuery, window, document, String, Node, Range, DocumentFragment, window.WeakMap, Array.prototype));

(function ($, Typer) {
    'use strict';

    Typer.presets = {};

    Typer.preset = function (element, name, options) {
        var preset = Typer.presets[name];
        var presetDefinition = {};
        var presetWidget;

        options = {
            inline: true,
            defaultOptions: false,
            disallowedElement: '*',
            widgets: {},
            __preset__: $.extend({}, options)
        };
        $.each(preset, function (i, v) {
            (typeof v === 'function' || i === 'options' ? presetDefinition : options)[i] = v;
        });
        $.each(options.__preset__, function (i, v) {
            if (typeof v === 'function' || !presetDefinition.options || !(i in presetDefinition.options)) {
                options[i] = v;
                delete options.__preset__[i];
            }
        });

        var originalInit = options.init;
        options.init = function (e) {
            presetWidget = e.typer.getStaticWidget('__preset__');
            $.each(preset.overrides, function (i, v) {
                e.typer[i] = function (value) {
                    return v.call(this, presetWidget, value);
                };
            });
            if (typeof originalInit === 'function') {
                originalInit.call(options, e);
            }
        };
        options.widgets.__preset__ = presetDefinition;
        presetDefinition.inline = true;
        return new Typer(element, options);
    };

    $.fn.typer = function (options) {
        return this.each(function (i, v) {
            new Typer(v, options);
        });
    };

} (jQuery, window.Typer));

(function ($, Typer, Object, RegExp, window, document) {
    'use strict';

    var SELECTOR_INPUT = ':text, :password, :checkbox, :radio, textarea, [contenteditable]';
    var SELECTOR_FOCUSABLE = ':input, [contenteditable], a[href], area[href], iframe';
    var BOOL_ATTRS = 'checked selected disabled readonly multiple ismap';

    var isFunction = $.isFunction;
    var isPlainObject = $.isPlainObject;
    var getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
    var defineProperty = Object.defineProperty;

    var alwaysTrue = function () {
        return true;
    };
    var alwaysFalse = function () {
        return false;
    };
    var FLIP_POS = {
        left: 'right',
        right: 'left',
        top: 'bottom',
        bottom: 'top'
    };
    var ZERO_ORIGIN = {
        percentX: 0,
        percentY: 0,
        offsetX: 0,
        offsetY: 0
    };
    var ORIGIN_TO_PERCENT = {
        center: 0.5,
        right: 1,
        bottom: 1
    };
    var MAC_CTRLKEY = {
        ctrl: '\u2318',
        alt: '\u2325',
        shift: '\u21e7',
        enter: '\u21a9',
        tab: '\u2135',
        pageUp: '\u21de',
        pageDown: '\u21df',
        backspace: '\u232b',
        escape: '\u238b',
        leftArrow: '\u2b60',
        upArrow: '\u2b61',
        rightArrow: '\u2b62',
        downArrow: '\u2b63',
        home: '\u2b66',
        end: '\u2b68'
    };

    var definedControls = {};
    var definedIcons = {};
    var definedLabels = {};
    var definedThemes = {};
    var definedShortcuts = {};
    var controlExtensions = {};
    var wsDelimCache = {};
    var executionContext = [];
    var currentPinnedElements = [];
    var currentCallouts = [];
    var currentDialog;
    var IS_MAC = navigator.userAgent.indexOf('Macintosh') >= 0;

    function randomId() {
        return Math.random().toString(36).substr(2, 8);
    }

    function isString(v) {
        return typeof v === 'string' && v;
    }

    function capfirst(v) {
        v = String(v || '');
        return v.charAt(0).toUpperCase() + v.slice(1);
    }

    function lowfirst(v) {
        v = String(v || '');
        return v.charAt(0).toLowerCase() + v.slice(1);
    }

    function exclude(haystack, needle) {
        var result = {};
        for (var i in haystack) {
            if (!(i in needle)) {
                result[i] = haystack[i];
            }
        }
        return result;
    }

    function matchWSDelim(haystack, needle) {
        var re = wsDelimCache[needle] || (wsDelimCache[needle] = new RegExp('(?:^|\\s)(' + needle.replace(/\s+/g, '|') + ')(?=$|\\s)'));
        return re.test(String(haystack || '')) && RegExp.$1;
    }

    function matchParams(params, control) {
        for (var i in params) {
            if (!matchWSDelim(control[i], params[i])) {
                return false;
            }
        }
        return true;
    }

    function getPropertyDescriptor(obj, prop) {
        if (prop in obj) {
            for (var cur = obj; cur; cur = Object.getPrototypeOf(cur)) {
                if (cur.hasOwnProperty(prop)) {
                    return getOwnPropertyDescriptor(cur, prop);
                }
            }
        }
    }

    function defineHiddenProperty(obj, prop, value) {
        defineProperty(obj, prop, {
            configurable: true,
            writable: true,
            value: value
        });
    }

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
            ctor.apply(this, arguments);
        });
        fn.prototype = base || {};
        defineHiddenProperty(base, 'constructor', fn);
        Object.setPrototypeOf(fn.prototype, controlExtensions);
        return fn;
    }

    function listen(obj, prop, callback) {
        var desc = getPropertyDescriptor(obj, prop) || {
            enumerable: true,
            value: obj[prop]
        };
        defineProperty(obj, prop, {
            enumerable: desc.enumerable,
            configurable: false,
            get: function () {
                return desc.get ? desc.get.call(obj) : desc.value;
            },
            set: function (value) {
                if (value !== this[prop]) {
                    if (desc.set) {
                        desc.set.call(obj, value);
                    } else {
                        desc.value = value;
                    }
                    callback.call(this, prop, value);
                }
            }
        });
    }

    function parseCompactSyntax(str) {
        var m = /^([\w-:]*)(?:\(([^}]+)\))?$/.exec(str);
        var params = null;
        try {
            params = m[2] && JSON.parse(('{' + m[2] + '}').replace(/([{:,])\s*([^\s:,}]+)/g, '$1"$2"'));
        } catch (e) { }
        return {
            name: m[1],
            params: params || {}
        };
    }

    function getZIndex(element, pseudo) {
        var style = window.getComputedStyle(element, pseudo || null);
        return matchWSDelim(style.position, 'absolute fixed relative') && style.zIndex !== 'auto' ? parseInt(style.zIndex) : -1;
    }

    function getZIndexOver(over) {
        var maxZIndex = -1;
        var iterator = document.createTreeWalker(document.body, 1, function (v) {
            if (Typer.comparePosition(v, over, true)) {
                return 2;
            }
            var zIndex = getZIndex(v);
            if (zIndex >= 0) {
                maxZIndex = Math.max(maxZIndex, zIndex);
                return 2;
            }
            maxZIndex = Math.max(maxZIndex, getZIndex(v, '::before'), getZIndex(v, '::after'));
            return 1;
        }, false);
        Typer.iterate(iterator);
        return maxZIndex + 1;
    }

    function getBoundingClientRect(elm) {
        return (elm || document.documentElement).getBoundingClientRect();
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

    function updatePinnedPositions() {
        var windowSize = getBoundingClientRect();

        $.each(currentPinnedElements, function (i, v) {
            var dialog = $(v.element).find('.typer-ui-dialog')[0];
            var dialogSize = getBoundingClientRect(dialog);
            var rect = getBoundingClientRect(v.reference);
            var stick = {};

            var $r = $(v.element).css({
                top: rect.top,
                left: rect.left,
                width: rect.width,
                height: rect.height
            });
            if (v.direction === 'bottom' || v.direction === 'top') {
                stick.left = rect.left + rect.width / 2 < dialogSize.width / 2;
                stick.right = windowSize.width - rect.left - rect.width / 2 < dialogSize.width / 2;
            }
            if (v.direction === 'left' || v.direction === 'right') {
                stick.top = rect.top + rect.height / 2 < dialogSize.height / 2;
                stick.bottom = windowSize.height - rect.top - rect.height / 2 < dialogSize.height / 2;
            }
            $.each(['left', 'right', 'top', 'bottom'], function (i, v) {
                dialog.style[v] = stick[v] ? -(Math.abs(windowSize[v] - rect[v]) - 10) + 'px' : '';
            });
            callThemeFunction(v.control, 'positionUpdate', {
                element: v.element,
                position: rect,
                stick: stick
            });
        });
    }

    function showCallout(control, element, ref, pos) {
        for (var i = 0; i < currentCallouts.length; i++) {
            if (currentCallouts[i].control !== control && !currentCallouts[i].control.parentOf(control)) {
                hideCallout(currentCallouts[i].control);
                break;
            }
        }
        $(element).appendTo(document.body).css({
            position: 'fixed',
            zIndex: getZIndexOver(currentCallouts[0] ? currentCallouts[0].element : document.body)
        });

        var rect = {
            control: control,
            element: element
        };
        if (ref.getBoundingClientRect) {
            var xrel = matchWSDelim(pos, 'left right') || 'left';
            var yrel = matchWSDelim(pos, 'top bottom') || 'bottom';
            var refRect = getBoundingClientRect(ref);
            rect[xrel] = refRect.left;
            rect[yrel] = refRect.top;
            rect[FLIP_POS[xrel]] = refRect.right;
            rect[FLIP_POS[yrel]] = refRect.bottom;
        } else {
            rect.left = rect.right = ref.x;
            rect.top = rect.bottom = ref.y;
        }
        var winRect = getBoundingClientRect();
        var elmRect = getBoundingClientRect(element);
        $(element).css({
            left: (rect.left + elmRect.width > winRect.width ? rect.right - elmRect.width : rect.left) + 'px',
            top: (rect.top + elmRect.height > winRect.height ? rect.bottom - elmRect.height : rect.top) + 'px'
        });
        currentCallouts.unshift(rect);
        callThemeFunction(control, 'afterShow', rect);
    }

    function hideCallout(control) {
        var i = currentCallouts.length - 1;
        if (control) {
            for (; i >= 0 && control !== currentCallouts[i].control && !control.parentOf(currentCallouts[i].control); i--);
        }
        $.each(currentCallouts.splice(0, i + 1), function (i, v) {
            $.when(callThemeFunction(v.control, 'beforeHide', v)).done(function () {
                $(v.element).detach();
            });
        });
    }

    function callFunction(control, name, data) {
        var holder = name.substr(0, 7) === 'control' ? control.ui : control;
        if (isFunction(holder[name])) {
            try {
                executionContext.unshift(holder);
                return holder[name](control.ui, control, data);
            } finally {
                executionContext.shift();
            }
        }
    }

    function callThemeFunction(control, name, data) {
        var theme = definedThemes[control.ui.theme];
        if (isFunction(theme[name])) {
            try {
                executionContext.unshift(control);
                return theme[name](control.ui, control, data);
            } finally {
                executionContext.shift();
            }
        }
    }

    function triggerEvent(control, name, data) {
        callFunction(control, name, data);
        if (control.ui === control || name.substr(0, 7) === 'control') {
            callThemeFunction(control, name, data);
        } else {
            callThemeFunction(control, control.type + capfirst(name), data);
        }
    }

    function findControls(control, needle, defaultNS, haystack, exclusions) {
        haystack = haystack || control.all || control.contextualParent.all;
        if (!haystack._cache) {
            defineHiddenProperty(haystack, '_cache', {});
        }
        defaultNS = defaultNS || control.defaultNS;
        exclusions = exclusions || {};
        if (control.name) {
            exclusions[control.name] = true;
        }

        var cacheKey = (defaultNS || '*') + '/' + needle;
        if (control !== control.ui && haystack === definedControls) {
            cacheKey = [control.ui.type || '*', control.type, cacheKey].join('/');
        }
        var cachedResult = haystack._cache[cacheKey];
        if (cachedResult) {
            return Object.keys(exclude(cachedResult.include, $.extend(exclusions, cachedResult.exclude)));
        }

        var resultExclude = {};
        var resultInclude = {};
        String(needle || '').replace(/(?:^|\s)(-?)((?:([\w-:]+|\*):)?(?:[\w-]+|\*|(?=\()))(\([^)]+\))?(?=$|\s)/g, function (v, minus, name, ns, params) {
            var arr = {};
            var startWith = (ns || defaultNS || '').replace(/.$/, '$&:');
            if (!name || name.slice(-1) === '*') {
                $.each(haystack, function (i) {
                    if (ns === '*' || (i.substr(0, startWith.length) === startWith && i.indexOf(':', startWith.length) < 0)) {
                        arr[i] = true;
                    }
                });
            } else {
                name = name.indexOf(':') < 0 ? startWith + name : name;
                if (haystack[name]) {
                    arr[name] = true;
                }
            }
            if (params) {
                params = parseCompactSyntax(params).params;
                $.each(arr, function (i) {
                    if (!matchParams(params, haystack[i])) {
                        delete arr[i];
                    }
                });
            }
            if (minus) {
                $.extend(resultExclude, arr);
                resultInclude = exclude(resultInclude, arr);
            } else {
                $.extend(resultInclude, arr);
            }
        });
        haystack._cache[cacheKey] = {
            include: resultInclude,
            exclude: resultExclude
        };
        return Object.keys(exclude(resultInclude, $.extend(exclusions, resultExclude)));
    }

    function sortControls(controls) {
        var defaultOrder = {};
        $.each(controls, function (i, v) {
            defaultOrder[v.name] = i;
        });
        controls.sort(function (a, b) {
            function m(a, b, prop, mult) {
                return !a[prop] ? 0 : findControls(a.contextualParent, a[prop], a.name.substr(0, a.name.lastIndexOf(':'))).indexOf(b.name) >= 0 ? mult : -mult;
            }
            var a1 = m(a, b, 'after', 1);
            var a2 = m(a, b, 'before', -1);
            var b1 = m(b, a, 'after', -1);
            var b2 = m(b, a, 'before', 1);
            if ((!a1 && !a2) ^ (!b1 && !b2)) {
                return a1 || a2 || b1 || b2;
            }
            return (a1 + a2 + b1 + b2) || defaultOrder[a.name] - defaultOrder[b.name];
        });
    }

    function createControls(control, contextualParent, exclusions) {
        var ui = control.ui;
        contextualParent = control instanceof typerUI.group ? contextualParent || ui : control;
        contextualParent.all = contextualParent.all || {};
        exclusions = exclusions || {};

        if (isFunction(control.controls)) {
            control.controls = control.controls(ui, control);
        }
        if (isString(control.controls)) {
            control.controls = findControls(control, control.controls, null, definedControls, exclusions);
            $.each(control.controls, function (i, v) {
                exclusions[v] = true;
            });
        }
        control.controls = $.map(control.controls || [], function (v, i) {
            var inst = Object.create(isString(v) ? definedControls[v] : v);
            var name = inst.name || isString(v) || control.defaultNS + ':' + randomId();
            $.extend(inst, {
                ui: ui,
                name: name,
                parent: control,
                contextualParent: contextualParent,
                defaultNS: isString(inst.defaultNS) || name,
                icon: isString(inst.icon) || name,
                label: isString(inst.label) || name
            });
            if (!isString(inst.shortcut) && isString(inst.execute)) {
                inst.shortcut = typerUI.getShortcut(inst.execute);
            }
            contextualParent.all[name] = inst;
            createControls(inst, contextualParent, (control === ui || control === contextualParent) && $.extend({}, exclusions));
            return inst;
        });
        sortControls(control.controls);
    }

    function renderControls(control, params) {
        var ui = control.ui;
        var bindedProperties = {};

        function propertyChanged(prop, value) {
            if (isFunction(definedThemes[ui.theme]['bind' + capfirst(prop)])) {
                value = callThemeFunction(control, 'bind' + capfirst(prop), value);
            } else {
                value = callThemeFunction(control, 'bind', value);
            }
            $.each(bindedProperties[prop], function (i, v) {
                if (v[1] === '_') {
                    $(v[0]).html(value || '');
                } else if (matchWSDelim(v[1], BOOL_ATTRS)) {
                    $(v[0]).prop(v[1], !!value && value !== "false");
                } else if (value) {
                    $(v[0]).attr(v[1], value);
                } else {
                    $(v[0]).removeAttr(v[1]);
                }
            });
        }

        function bindPlaceholder(element) {
            $(element).find('*').andSelf().filter('[x\\:bind]').each(function (i, v) {
                var t = parseCompactSyntax($(v).attr('x:bind'));
                $.each(t.params, function (i, w) {
                    if (!bindedProperties[w]) {
                        bindedProperties[w] = [];
                        listen(control, w, propertyChanged);
                    }
                    bindedProperties[w].push([v, i]);
                });
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
                    var arr = control.controls;
                    for (var j in t.params) {
                        arr = arr.filter(matchParams.bind(null, t.params));
                        break;
                    }
                    element = arr.map(function (v) {
                        return renderControls(v, t.params);
                    });
                } else {
                    element = replacePlaceholder(t.name);
                }
                $(v).replaceWith(element);
            });
            return element;
        }

        function executeFromEvent(e) {
            if ($(e.target).is(':checkbox')) {
                setImmediate(function () {
                    ui.setValue(control, !!e.target.checked);
                    ui.execute(control);
                });
            } else {
                ui.execute(control);
            }
        }

        control.element = replacePlaceholder(control.type);
        $(control.element).attr('role', control.name);
        $.each(bindedProperties, function (i, v) {
            propertyChanged(i, control[i]);
        });

        var executeEvent = definedThemes[ui.theme][control.type + 'ExecuteOn'];
        if (isString(executeEvent)) {
            $(control.element).bind(executeEvent, executeFromEvent);
        } else if (executeEvent) {
            $(executeEvent.of, control.element).bind(executeEvent.on, executeFromEvent);
        }
        return control.element;
    }

    function resolveControls(control, name) {
        var all = control.all || control.contextualParent.all;
        var controls = findControls(control, name, null, all);
        if (!controls.length) {
            return $.map(control.controls, function (v) {
                return resolveControls(v, name);
            });
        }
        return $.map(controls, function (v) {
            return all[v];
        });
    }

    function isEnabled(control) {
        var ui = control.ui;
        if (!ui.typer && (control.requireTyper || control.requireWidget || control.requireWidgetEnabled || control.requireCommand)) {
            return false;
        }
        if ((control.requireCommand && !ui.typer.hasCommand(control.requireCommand)) ||
            (control.requireWidgetEnabled && !ui.typer.widgetEnabled(control.requireWidgetEnabled))) {
            return false;
        }
        if ((control.requireWidget === true && !Object.getOwnPropertyNames(ui._widgets)[0]) ||
            (control.requireWidget && !control.widget)) {
            return false;
        }
        if (control.requireChildControls === true && !control.controls.some(isEnabled)) {
            return false;
        }
        return control.enabled !== false && callFunction(control, 'enabled') !== false;
    }

    function isActive(control) {
        return control.active === true || !!callFunction(control, 'active');
    }

    function updateControl(control) {
        var ui = control.ui;
        var suppressStateChange;
        if (control.requireWidget || control.requireWidgetEnabled) {
            control.widget = ui._widgets[control.requireWidget || control.requireWidgetEnabled] || ui.widget;
            suppressStateChange = !control.widget;
        }
        if (!suppressStateChange) {
            triggerEvent(control, 'stateChange');
        }

        var disabled = !isEnabled(control);
        var visible = (!control.hiddenWhenDisabled || !disabled) && control.visible !== false && callFunction(control, 'visible') !== false;

        var $elm = $(control.element);
        var theme = definedThemes[ui.theme];
        if ($elm.is(':input')) {
            $elm.prop('disabled', disabled);
        }
        if (theme.controlDisabledClass) {
            $elm.toggleClass(theme.controlDisabledClass, disabled);
        }
        if (theme.controlActiveClass) {
            $elm.toggleClass(theme.controlActiveClass, isActive(control));
        }
        if (theme.controlHiddenClass) {
            $elm.toggleClass(theme.controlHiddenClass, !visible);
        } else {
            toggleDisplay($elm, visible);
        }
    }

    function executeControl(control) {
        var ui = control.ui;
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
        triggerEvent(control, 'controlExecuted');
    }

    function foreachControl(control, fn, optArg, fnArg) {
        $.each(Object.keys(control.all).reverse(), function (i, v) {
            v = control.all[v];
            if (v.all) {
                foreachControl(v, fn, optArg, fnArg);
            }
            fn(v, optArg, fnArg);
        });
    }

    function createForm(control) {
        var ui = control.ui;
        var deferred = $.Deferred();
        var execute = function (value, submitControl) {
            if (ui.validate()) {
                submitControl = submitControl || control.resolve(control.resolveBy)[0];
                var promise = $.when(isFunction(control.submit) && control.submit(ui, control, submitControl));
                if (promise.state() === 'pending') {
                    ui.trigger(control, 'waiting', submitControl);
                }
                promise.done(function (returnValue) {
                    ui.trigger(control, 'success', returnValue);
                    deferred.resolve(value);
                });
                promise.fail(function (err) {
                    ui.trigger(control, 'error', err);
                    typerUI.focus(control.element, true);
                });
            } else {
                ui.trigger(control, 'validateError');
                typerUI.focus(control.element, true);
            }
        };
        var defaultResolve = function () {
            execute(ui.getValue(control.resolveWith || control), this);
        };
        var defaultReject = function () {
            deferred.reject();
        };
        $.each(control.resolve(control.resolveBy), function (i, v) {
            v.execute = defaultResolve;
        });
        $.each(control.resolve(control.rejectBy), function (i, v) {
            v.execute = defaultReject;
        });
        if (isFunction(control.setup)) {
            control.setup(ui, control, execute, defaultReject);
        }
        return {
            promise: deferred.promise(),
            resolve: defaultResolve,
            reject: defaultReject
        };
    }

    var typerUI = Typer.ui = define('TyperUI', {
        language: 'en'
    }, function (options, values) {
        if (isString(options)) {
            options = {
                controls: options
            };
        }
        if (executionContext[0]) {
            var parentUI = executionContext[0].ui;
            $.extend(options, {
                theme: parentUI.theme,
                typer: parentUI.typer,
                widget: parentUI.widget,
                parent: parentUI,
                parentControl: parentUI.getExecutingControl()
            });
        }
        var self = $.extend(this, options);
        self.ui = self;
        self.theme = self.theme || Object.keys(definedThemes)[0];
        createControls(self);
        renderControls(self);
        $(self.element).addClass('typer-ui typer-ui-' + self.theme);
        if (self.typer) {
            self.typer.retainFocus(self.element);
        }
        foreachControl(self, triggerEvent, 'init');
        triggerEvent(self, 'init');
        if (isPlainObject(values)) {
            $.each(values, function (i, v) {
                self.setValue(i, 'value', v);
            });
        }
    });

    $.extend(typerUI.prototype, {
        update: function () {
            var self = this;
            self._widgets = {};
            if (self.widget) {
                self._widgets[self.widget.id] = self.widget;
            } else if (self.typer) {
                $.each(self.typer.getSelection().getWidgets().concat(self.typer.getStaticWidgets()), function (i, v) {
                    self._widgets[v.id] = v;
                });
            }
            foreachControl(this, updateControl);
        },
        destroy: function () {
            foreachControl(this, triggerEvent, 'destroy');
        },
        resolve: function (control) {
            return resolveControls(this.getExecutingControl() || this, control);
        },
        trigger: function (control, event, data) {
            if (isString(control)) {
                control = this.resolve(control)[0] || {};
            }
            triggerEvent(control, event, data);
        },
        show: function (control, element, ref, pos) {
            if (isString(control)) {
                control = this.resolve(control)[0] || {};
            }
            if (control.ui === this) {
                showCallout(control, element, ref, pos);
            } else {
                showCallout(this, this.element, control, element);
            }
        },
        hide: function (control) {
            if (isString(control)) {
                control = this.resolve(control)[0] || {};
            }
            hideCallout(control || this);
        },
        enabled: function (control) {
            if (isString(control)) {
                control = this.resolve(control)[0] || {};
            }
            return isEnabled(control);
        },
        active: function (control) {
            if (isString(control)) {
                control = this.resolve(control)[0] || {};
            }
            return isActive(control);
        },
        getIcon: function (control) {
            return (definedIcons[control.icon] || definedIcons[control.name] || definedIcons[control] || '')[this.iconset || definedThemes[this.theme].iconset] || '';
        },
        getLabel: function (control) {
            control = (control || '').label || control;
            if (definedLabels[control]) {
                if (this.language in definedLabels[control]) {
                    return definedLabels[control][this.language];
                }
                for (var i in definedLabels[control]) {
                    return definedLabels[control][i];
                }
            }
            return control;
        },
        getValue: function (control, prop) {
            var self = this;
            prop = prop || 'value';
            if (isString(control)) {
                control = self.resolve(control)[0];
            }
            if (control) {
                if (!control.valueMap) {
                    return control[prop];
                }
                var value = {};
                $.each(control.valueMap, function (i, v) {
                    value[i] = self.getValue(resolveControls(control, v)[0], prop);
                });
                return value;
            }
        },
        setValue: function (control, prop, value) {
            var self = this;
            if (arguments.length < 3) {
                return self.setValue(control, 'value', prop);
            }
            if (isString(control)) {
                control = self.resolve(control)[0];
            }
            if (control) {
                if (control.valueMap) {
                    $.each(value, function (i, v) {
                        self.setValue(resolveControls(control, control.valueMap[i])[0], prop, v);
                    });
                    return;
                }
                control[prop] = value;
                updateControl(control);
            }
        },
        getExecutingControl: function () {
            for (var i = 0, length = executionContext.length; i < length; i++) {
                if (executionContext[i].ui === this) {
                    return executionContext[i];
                }
            }
        },
        validate: function () {
            var optArg = {
                isFailed: alwaysFalse,
                fail: function () {
                    this.isFailed = alwaysTrue;
                }
            };
            foreachControl(this, function (control) {
                if (isEnabled(control)) {
                    triggerEvent(control, 'validate', optArg);
                }
            });
            return !optArg.isFailed();
        },
        execute: function (control) {
            var self = this;
            if (isString(control)) {
                control = self.resolve(control)[0];
            } else if (!control) {
                control = self.controls[0];
            }
            if (control && executionContext.indexOf(control) < 0 && isEnabled(control)) {
                executionContext.unshift(control);
                triggerEvent(control, 'controlExecuting');
                if (isFunction(control.dialog)) {
                    var promise = $.when(control.dialog(self, control));
                    promise.done(function (value) {
                        self.setValue(control, value);
                        executeControl(control);
                    });
                    promise.always(function () {
                        executionContext.shift(control);
                    });
                    return promise;
                }
                try {
                    executeControl(control);
                } finally {
                    executionContext.shift(control);
                }
            }
        }
    });

    $.extend(typerUI, {
        controls: definedControls,
        themes: definedThemes,
        themeExtensions: {},
        controlExtensions: controlExtensions,
        matchWSDelim: matchWSDelim,
        define: function (name, base, ctor) {
            if (isPlainObject(name)) {
                $.each(name, typerUI.define);
                return;
            }
            base = base || {};
            ctor = ctor || (getOwnPropertyDescriptor(base, 'constructor') || '').value;
            base.type = name;
            typerUI[name] = define('TyperUI' + capfirst(name), base, ctor);
        },
        getShortcut: function (command) {
            var current = definedShortcuts._map[command];
            return current && current[0];
        },
        addControls: function (ns, values) {
            var prefix = isString(ns) ? ns + ':' : '';
            $.each(values || ns, function (i, v) {
                definedControls[prefix + i] = v;
            });
        },
        addIcons: function (iconSet, ns, values) {
            var prefix = isString(ns) ? ns + ':' : '';
            $.each(values || ns, function (i, v) {
                i = prefix + i;
                if (!definedIcons[i]) {
                    definedIcons[i] = {};
                }
                definedIcons[i][iconSet] = v;
            });
        },
        addLabels: function (language, ns, values) {
            var prefix = isString(ns) ? ns + ':' : '';
            $.each(values || ns, function (i, v) {
                i = prefix + i;
                if (!definedLabels[i]) {
                    definedLabels[i] = {};
                }
                definedLabels[i][language] = v;
            });
        },
        addHook: function (keystroke, hook) {
            if (isPlainObject(keystroke)) {
                $.each(keystroke, typerUI.addHook);
                return;
            }
            (keystroke || '').replace(/\S+/g, function (v) {
                definedShortcuts[v] = definedShortcuts[v] || [];
                definedShortcuts[v].push({
                    hook: hook
                });
            });
        },
        setShortcut: function (command, keystroke) {
            if (isPlainObject(command)) {
                $.each(command, typerUI.setShortcut);
                return;
            }
            command = parseCompactSyntax(command);
            definedShortcuts._map = definedShortcuts._map || {};

            var current = definedShortcuts._map[command.name] = definedShortcuts._map[command.name] || [];
            var before = current.slice(0);
            (keystroke || '').replace(/\S+/g, function (v) {
                var index = before.indexOf(v);
                if (index >= 0) {
                    before.splice(index, 1);
                } else {
                    current[current.length] = v;
                    definedShortcuts[v] = definedShortcuts[v] || [];
                    definedShortcuts[v].push({
                        command: command.name,
                        value: (command.params || '').value
                    });
                }
            });
            $.each(before, function (i, v) {
                current.splice(current.indexOf(v), 1);
                $.each(definedShortcuts[v], function (i, w) {
                    if (w.command === command.name && w.value === (command.params || '').value) {
                        definedShortcuts[v].splice(i, 1);
                        return false;
                    }
                });
            });
        },
        setZIndex: function (element, over) {
            element.style.zIndex = getZIndexOver(over);
            if ($(element).css('position') === 'static') {
                element.style.position = 'relative';
            }
        },
        pin: function (control, element, reference, direction) {
            currentPinnedElements.push({
                control: control,
                element: element,
                reference: reference,
                direction: direction
            });
            updatePinnedPositions();
        },
        unpin: function (control) {
            $.each(currentPinnedElements, function (i, v) {
                if (v.control === control) {
                    currentPinnedElements.splice(i, 1);
                    return false;
                }
            });
        },
        focus: function (element, inputOnly) {
            if (!$.contains(element, document.activeElement) || (inputOnly && !$(document.activeElement).is(SELECTOR_INPUT))) {
                $(inputOnly ? SELECTOR_INPUT : SELECTOR_FOCUSABLE, element).not(':disabled, :hidden').andSelf().eq(0).focus();
            }
        },
        alert: function (message) {
            return typerUI('dialog:prompt -dialog:input -dialog:buttonCancel', {
                message: message
            }).execute();
        },
        confirm: function (message) {
            return typerUI('dialog:prompt -dialog:input', {
                message: message
            }).execute();
        },
        prompt: function (message, value) {
            return typerUI('dialog:prompt', {
                message: message,
                input: value
            }).execute();
        },
        getWheelDelta: function (e) {
            e = e.originalEvent || e;
            var dir = -e.wheelDeltaY || -e.wheelDelta || e.detail;
            return dir / Math.abs(dir) * (IS_MAC ? -1 : 1);
        },
        parseOrigin: function (value) {
            if (/(left|center|right)?(?:((?:^|\s|[+-]?)\d+(?:\.\d+)?)(px|%))?(?:\s+(top|center|bottom)?(?:((?:^|\s|[+-]?)\d+(?:\.\d+)?)(px|%))?)?/g.test(value)) {
                return {
                    percentX: (ORIGIN_TO_PERCENT[RegExp.$1] || 0) + (RegExp.$3 === '%' && +RegExp.$2),
                    percentY: (ORIGIN_TO_PERCENT[RegExp.$4 || (!RegExp.$5 && RegExp.$1)] || 0) + (RegExp.$6 === '%' && +RegExp.$5),
                    offsetX: +(RegExp.$3 === 'px' && +RegExp.$2),
                    offsetY: +(RegExp.$6 === 'px' && +RegExp.$5)
                };
            }
            return $.extend({}, ZERO_ORIGIN);
        }
    });

    $.extend(controlExtensions, {
        buttonsetGroup: 'left',
        markdown: false,
        showButtonLabel: true,
        is: function (type) {
            return matchWSDelim(this.type, type);
        },
        resolve: function (control) {
            return resolveControls(this, control);
        },
        parentOf: function (control) {
            for (; control; control = control.parent) {
                if (this === control) {
                    return true;
                }
            }
            return false;
        }
    });

    $.extend(typerUI.themeExtensions, {
        bind: function (ui, control, value) {
            value = ui.getLabel(value) || '';
            if (control.markdown) {
                return new showdown.Converter({
                    simplifiedAutoLink: true,
                    excludeTrailingPunctuationFromURLs: true,
                    simpleLineBreaks: true
                }).makeHtml(String(value));
            }
            var elm = document.createElement('div');
            elm.textContent = value;
            return elm.innerHTML;
        },
        bindIcon: function (ui, control, value) {
            return ui.getIcon(value);
        },
        bindShortcut: function (ui, control, value) {
            var flag = {};
            var str = (value || '').replace(/ctrl|alt|shift/gi, function (v) {
                return IS_MAC ? ((flag[v.toLowerCase()] = MAC_CTRLKEY[v.toLowerCase()]), '') : capfirst(v) + '+';
            });
            return IS_MAC ? (flag.alt || '') + (flag.shift || '') + (flag.ctrl || '') + (MAC_CTRLKEY[lowfirst(str)] || str) : str;
        }
    });

    /* ********************************
     * Built-in Control Types
     * ********************************/

    typerUI.define({
        theme: typerUI.themeExtensions,
        group: {
            hiddenWhenDisabled: true,
            requireChildControls: true,
            controls: '*',
            constructor: function (controls, params) {
                if (isString(controls)) {
                    this.controls = controls;
                    if (isString(params)) {
                        this.type = params;
                    } else {
                        $.extend(this, params);
                    }
                } else {
                    $.extend(this, controls);
                }
            }
        },
        dropdown: {
            requireChildControls: true,
            controls: '*',
            get value() {
                return this.selectedValue;
            },
            set value(value) {
                var self = this;
                self.selectedIndex = -1;
                $.each(self.resolve('(type:button) -(dropdownOption:exclude)'), function (i, v) {
                    if (v.value === value) {
                        self.selectedIndex = i;
                        self.selectedText = v.label || v.name;
                        self.selectedValue = v.value;
                        return false;
                    }
                });
                if (self.selectedIndex === -1) {
                    self.selectedValue = '';
                    self.selectedText = self.label || self.name;
                }
                foreachControl(self, updateControl);
            },
            init: function (ui, self) {
                $.each(self.resolve('(type:button) -(dropdownOption:exclude)'), function (i, v) {
                    v.active = function () {
                        return self.selectedIndex === i;
                    };
                    v.execute = function () {
                        self.value = v.value;
                        ui.execute(self);
                    };
                });
            }
        },
        callout: {
            controls: '*'
        },
        label: {
            get value() {
                return this.label;
            },
            set value(value) {
                this.label = value;
            }
        },
        button: {},
        file: {},
        textbox: {
            preset: 'textbox'
        },
        textboxCombo: {
            controls: function (ui, self) {
                var controls = [];
                self.valueMap = {};
                (self.format || '').replace(/\{([^}]+)\}|[^{]+/g, function (v, property) {
                    var control = property ? typerUI.textbox(self[property]) : typerUI.label(v);
                    control.name = self.name + ':' + (property || randomId());
                    controls.push(control);
                    if (property) {
                        self.valueMap[property] = control.name;
                    }
                });
                return controls;
            }
        },
        checkbox: {},
        dialog: {
            pinnable: false,
            keyboardResolve: true,
            keyboardReject: true,
            resolveBy: 'dialog:buttonOK',
            rejectBy: 'dialog:buttonCancel',
            dialog: function (ui, self) {
                var previousDialog = currentDialog;
                var previousActiveElement = document.activeElement;
                var form = createForm(self);
                ui.update();
                ui.trigger(self, 'open');
                setImmediate(typerUI.focus, self.element);
                form.promise.always(function () {
                    ui.trigger(self, 'close');
                    ui.destroy();
                    currentDialog = previousDialog;
                    if (previousActiveElement) {
                        previousActiveElement.focus();
                    }
                });
                typerUI.setZIndex(ui.element, document.body);
                currentDialog = {
                    element: self.element,
                    keyboardResolve: self.keyboardResolve && form.resolve,
                    keyboardReject: self.keyboardReject && form.reject
                };
                return form.promise;
            }
        }
    });

    /* ********************************
     * Built-in Controls and Resources
     * ********************************/

    typerUI.addControls('dialog', {
        buttonset: typerUI.group('(type:button)', {
            type: 'buttonset',
            defaultNS: 'dialog'
        }),
        buttonOK: typerUI.label({
            type: 'button',
            buttonsetGroup: 'right'
        }),
        buttonCancel: typerUI.label({
            type: 'button',
            buttonsetGroup: 'right'
        }),
        message: typerUI.label({
            markdown: true
        }),
        input: typerUI.textbox(),
        prompt: typerUI.dialog({
            pinnable: true,
            defaultNS: 'dialog',
            controls: 'message input buttonset',
            resolveWith: 'input'
        })
    });

    typerUI.addLabels('en', 'dialog', {
        input: '',
        buttonOK: 'OK',
        buttonCancel: 'Cancel'
    });

    typerUI.addIcons('material', 'dialog', {
        buttonOK: '\ue876',
        buttonCancel: '\ue5cd'
    });

    Typer.defaultOptions.shortcut = true;

    Typer.widgets.shortcut = {
        keystroke: function (e) {
            if (!e.isDefaultPrevented()) {
                $.each(definedShortcuts[e.data] || [], function (i, v) {
                    if (v.hook && v.hook(e.typer)) {
                        e.preventDefault();
                        return false;
                    }
                    if (e.typer.hasCommand(v.command)) {
                        e.typer.invoke(v.command, v.value);
                        e.preventDefault();
                        return false;
                    }
                });
            }
        }
    };

    $(function () {
        $(window).keydown(function (e) {
            if (currentDialog && (e.which === 13 || e.which === 27)) {
                (currentDialog[e.which === 13 ? 'keyboardResolve' : 'keyboardReject'] || $.noop)();
            }
        });
        $(window).focusin(function (e) {
            if (currentDialog && e.relatedTarget && !$.contains(currentDialog.element, e.target)) {
                typerUI.focus(currentDialog.element);
            }
        });
        $(window).bind('resize scroll orientationchange', function (e) {
            updatePinnedPositions();
        });
        $(document.body).mousedown(function (e) {
            $.each(currentCallouts.slice(0), function (i, v) {
                if (!Typer.containsOrEquals(v.element, e.target)) {
                    hideCallout(v.control);
                }
            });
        });
    });

}(jQuery, window.Typer, Object, RegExp, window, document));

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
    var LIST_STYLE_TYPE = {
        '1': 'decimal',
        'A': 'upper-alpha',
        'a': 'lower-alpha',
        'I': 'upper-roman',
        'i': 'lower-roman'
    };

    var reFormat = /^([a-z\d]*)(?:\.(.+))?/i;
    var reCompatFormat = /^(p|h[1-6])(?:\.(.+))?$/i;

    function outermost(elements) {
        return elements.filter(function (v) {
            return !elements.some(function (w) {
                return $.contains(w, v);
            });
        });
    }

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

    function computePropertyValue(elements, property) {
        var value;
        $(elements).each(function (i, v) {
            var my;
            if (property === 'textAlign') {
                my = getTextAlign(v);
            } else if (property === 'inlineClass') {
                my = $(v).attr('class') || '';
            } else {
                my = $(v).css(property);
            }
            value = (value === '' || (value && value !== my)) ? '' : my;
        });
        return value || '';
    }

    function compatibleFormatting(a, b) {
        a = a.toLowerCase();
        b = b.toLowerCase();
        return a === b || (reCompatFormat.test(a) && reCompatFormat.test(b));
    }

    function createElementWithClassName(tagName, className) {
        var element = Typer.createElement(tagName);
        if (className) {
            element.className = className;
        }
        return element;
    }

    /* ********************************
     * Commands
     * ********************************/

    function justifyCommand(tx) {
        $(tx.selection.getParagraphElements()).attr('align', ALIGN_VALUE[tx.commandName]);
        tx.trackChange(tx.selection.focusNode.element);
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
            tx.trackChange(tx.selection.focusNode.element);
        }
    }

    function listCommand(tx, type) {
        var tagName = tx.commandName === 'insertOrderedList' || type ? 'ol' : 'ul';
        var html = '<' + tagName + (type || '').replace(/^.+/, ' type="$&"') + '>';
        var filter = function (i, v) {
            return Typer.is(v, tagName) && ($(v).attr('type') || '') === (type || '');
        };
        var lists = [];
        $.each(tx.selection.getParagraphElements(), function (i, v) {
            if (!$(v).is('ol>li,ul>li')) {
                var list = $(v).prev().filter(filter)[0] || $(v).next().filter(filter)[0] || $(html).insertAfter(v)[0];
                $(v)[Typer.comparePosition(v, list) < 0 ? 'prependTo' : 'appendTo'](list);
                tx.replaceElement(v, 'li');
                lists.push(list);
            } else if (!$(v.parentNode).filter(filter)[0]) {
                tx.replaceElement(v.parentNode, $(html)[0]);
                lists.push(v.parentNode);
            } else if ($(v).is('li') && $.inArray(v.parentNode, lists) < 0) {
                outdentCommand(tx, [v]);
            }
        });
        tx.trackChange(tx.selection.focusNode.element);
    }

    function indentCommand(tx, elements) {
        elements = elements || outermost(tx.selection.getParagraphElements());
        $.each(elements, function (i, v) {
            var list = $(v).parent('ul,ol')[0] || $(v).prev('ul,ol')[0] || $('<ul>').insertBefore(v)[0];
            var newList = list;
            if (newList === v.parentNode) {
                var prevItem = $(v).prev('li')[0] || $('<li>').insertBefore(v)[0];
                newList = $(prevItem).children('ul,ol')[0] || $(list.cloneNode(false)).appendTo(prevItem)[0];
            }
            $(tx.replaceElement(v, 'li')).appendTo(newList);
            if ($(newList).parent('li')[0]) {
                $(Typer.createTextNode('\u00a0')).insertBefore(newList);
            }
            if (!list.children[0]) {
                tx.removeElement(list);
            }
        });
    }

    function outdentCommand(tx, elements) {
        elements = elements || outermost(tx.selection.getParagraphElements());
        $.each(elements, function (i, v) {
            var list = $(v).parent('ul,ol')[0];
            var parentList = $(list).parent('li')[0];
            if ($(v).next('li')[0]) {
                if (parentList) {
                    $(list.cloneNode(false)).append($(v).nextAll()).appendTo(v);
                } else {
                    $(list.cloneNode(false)).append($(v).nextAll()).insertAfter(list);
                    $(v).children('ul,ol').insertAfter(list);
                }
            }
            if (parentList) {
                $(v).insertAfter(parentList);
                if (!Typer.trim(tx.typer.extractText(parentList))) {
                    tx.removeElement(parentList);
                }
            } else {
                $(tx.replaceElement(v, 'p')).insertAfter(list);
            }
            if (!list.children[0]) {
                tx.removeElement(list);
            }
        });
        tx.trackChange(tx.selection.focusNode.element);
    }

    Typer.widgets.inlineStyle = {
        inline: true,
        beforeStateChange: function (e) {
            var elements = e.typer.getSelection().getSelectedElements();
            $.extend(e.widget, {
                bold: Typer.ui.matchWSDelim(computePropertyValue(elements, 'fontWeight'), 'bold 700'),
                italic: computePropertyValue(elements, 'fontStyle') === 'italic',
                underline: computePropertyValue(elements, 'textDecoration') === 'underline',
                strikeThrough: computePropertyValue(elements, 'textDecoration') === 'line-through',
                superscript: !!$(elements).filter('sup')[0],
                subscript: !!$(elements).filter('sub')[0],
                inlineClass: computePropertyValue(elements, 'inlineClass')
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
                var isCaret = tx.selection.isCaret;
                var span = createElementWithClassName('span', className);
                if (tx.selection.isCaret) {
                    tx.insertHtml(span);
                    span.appendChild(Typer.createTextNode());
                } else {
                    $(tx.selection.getSelectedTextNodes()).wrap(span);
                }
                var $elm = $(tx.selection.getSelectedElements());
                $elm.filter('span:has(span)').each(function (i, v) {
                    $(v).contents().unwrap().filter(function (i, v) {
                        return v.nodeType === 3;
                    }).wrap(createElementWithClassName('span', v.className));
                });
                $elm.filter('span[class=""],span:not([class])').contents().unwrap();
                $elm.filter('span+span').each(function (i, v) {
                    if (Typer.is(v.previousSibling, 'span.' + v.className)) {
                        $(v).contents().appendTo(v.previousSibling);
                        $(v).remove();
                    }
                });
                if (isCaret) {
                    tx.selection.select(span, -0);
                }
                tx.trackChange(tx.selection.focusNode.element);
            }
        }
    };

    Typer.widgets.formatting = {
        beforeStateChange: function (e) {
            var selection = e.typer.getSelection();
            var element = selection.getParagraphElements().slice(-1)[0];
            if ($(element).is('li')) {
                element = $(element).closest('ol, ul')[0] || element;
            }
            var tagName = element && element.tagName.toLowerCase();
            var tagNameWithClasses = tagName + ($(element).attr('class') || '').replace(/^(.)/, '.$1');
            var textAlign = computePropertyValue(selection.getSelectedElements(), 'textAlign');
            $.extend(e.widget, {
                justifyLeft: textAlign === 'left',
                justifyCenter: textAlign === 'center',
                justifyRight: textAlign === 'right',
                justifyFull: textAlign === 'justify',
                formatting: tagName,
                formattingWithClassName: tagNameWithClasses
            });
        },
        enter: function (e) {
            if (e.typer.widgetEnabled('lineBreak') && Typer.is(e.typer.getSelection().startNode, Typer.NODE_EDITABLE_PARAGRAPH)) {
                e.typer.invoke('insertLineBreak');
            } else {
                e.typer.invoke('insertLine');
            }
        },
        commands: {
            justifyCenter: justifyCommand,
            justifyFull: justifyCommand,
            justifyLeft: justifyCommand,
            justifyRight: justifyCommand,
            formatting: function (tx, value) {
                var m = /^([a-z\d]*)(?:\.(.+))?/i.exec(value) || [];
                if (m[1] === 'ol' || m[1] === 'ul') {
                    tx.insertWidget('list', m[1] === 'ol' && '1');
                } else {
                    $(tx.selection.getParagraphElements()).not('li').each(function (i, v) {
                        if (m[1] && !Typer.is(v, m[1]) && compatibleFormatting(m[1], v.tagName)) {
                            tx.replaceElement(v, createElementWithClassName(m[1] || 'p', m[2]));
                        } else {
                            v.className = m[2] || '';
                            tx.trackChange(v);
                        }
                    });
                }
            },
            insertLine: function (tx) {
                tx.insertText('\n\n');
            }
        }
    };

    Typer.widgets.lineBreak = {
        inline: true,
        enter: function (e) {
            e.typer.invoke('insertLineBreak');
        },
        shiftEnter: function (e) {
            e.typer.invoke('insertLineBreak');
        },
        commands: {
            insertLineBreak: function (tx) {
                tx.insertHtml('<br>');
            }
        }
    };

    Typer.widgets.list = {
        element: 'ul,ol',
        editable: 'ul,ol',
        insert: listCommand,
        textFlow: true,
        remove: 'keepText',
        tab: function (e) {
            e.typer.invoke('indent');
        },
        shiftTab: function (e) {
            e.typer.invoke('outdent');
        },
        init: function (e) {
            $(e.widget.element).filter('ol').attr('type-css-value', LIST_STYLE_TYPE[$(e.widget.element).attr('type')] || 'decimal');
            if ($(e.widget.element).parent('li')[0] && !e.widget.element.previousSibling) {
                $(Typer.createTextNode()).insertBefore(e.widget.element);
            }
        },
        contentChange: function (e) {
            if (!$(e.widget.element).children('li')[0]) {
                e.typer.invoke(function (tx) {
                    tx.removeElement(e.widget.element);
                });
            }
        },
        commands: {
            indent: indentCommand,
            outdent: outdentCommand
        }
    };

    $.each('formatting list inlineStyle lineBreak'.split(' '), function (i, v) {
        Typer.defaultOptions[v] = true;
    });

    /* ********************************
     * Controls
     * ********************************/

    function isEnabled(toolbar, inline) {
        var selection = toolbar.typer.getSelection();
        return !!(inline ? (selection.startNode.nodeType & (Typer.NODE_PARAGRAPH | Typer.NODE_EDITABLE_PARAGRAPH | Typer.NODE_INLINE)) : selection.getParagraphElements()[0]);
    }

    function simpleCommandButton(command, widget) {
        return Typer.ui.button({
            requireWidget: widget,
            requireCommand: command,
            execute: command,
            active: function (toolbar, self) {
                return self.widget && self.widget[command];
            },
            enabled: function (toolbar) {
                return isEnabled(toolbar, widget === 'inlineStyle');
            }
        });
    }

    function orderedListButton(type, annotation) {
        return Typer.ui.button({
            name: 'formatting:listtype:' + LIST_STYLE_TYPE[type],
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
    }

    Typer.ui.addControls('typer:toolbar', {
        formatting: Typer.ui.group('* -inlineStyleOptions -inlineStyleClear', {
            requireTyper: true,
            defaultNS: 'typer:formatting'
        })
    });

    Typer.ui.addControls('typer:formatting', {
        paragraph: Typer.ui.dropdown({
            requireWidget: 'formatting',
            requireCommand: 'formatting',
            hiddenWhenDisabled: true,
            controls: function (toolbar) {
                var definedOptions = $.map(Object.keys(toolbar.options.formattings || {}), function (v) {
                    return Typer.ui.button({
                        hiddenWhenDisabled: true,
                        value: v,
                        label: toolbar.options.formattings[v],
                        enabled: function (toolbar, self) {
                            var selection = toolbar.typer.getSelection();
                            var curElm = (selection.startNode === selection.endNode ? selection.startNode : selection.focusNode).element;
                            return !reFormat.test(self.value) || compatibleFormatting(curElm.tagName, RegExp.$1);
                        }
                    });
                });
                var fallbackOption = Typer.ui.button({
                    requireWidget: 'formatting',
                    hiddenWhenDisabled: true,
                    enabled: function (toolbar, self) {
                        for (var i = 0, len = definedOptions.length; i < len; i++) {
                            if (definedOptions[i].value === self.widget.formatting) {
                                return false;
                            }
                        }
                        self.label = 'typer:formatting:tagname:' + (reFormat.exec(self.widget.formatting) || [])[1];
                        self.value = self.widget.formatting;
                        return true;
                    }
                });
                return definedOptions.concat(fallbackOption);
            },
            execute: 'formatting',
            enabled: function (toolbar) {
                return isEnabled(toolbar, false);
            },
            stateChange: function (toolbar, self) {
                for (var i = 0, length = self.controls.length; i < length; i++) {
                    if (self.controls[i].value === self.widget.formattingWithClassName) {
                        self.value = self.widget.formattingWithClassName;
                        return;
                    }
                }
                self.value = self.widget.formatting;
            }
        }),
        inlineStyle: Typer.ui.dropdown({
            requireWidget: 'inlineStyle',
            requireCommand: 'applyClass',
            hiddenWhenDisabled: true,
            defaultNS: 'typer:formatting',
            controls: 'inlineStyleOptions inlineStyleClear',
            execute: 'applyClass',
            enabled: function (toolbar) {
                return isEnabled(toolbar, true);
            },
            stateChange: function (toolbar, self) {
                self.value = self.widget.inlineClass;
            }
        }),
        inlineStyleOptions: Typer.ui.group({
            controls: function (toolbar) {
                return $.map(Object.keys(toolbar.options.inlineClass || {}), function (v) {
                    return Typer.ui.button({
                        value: v,
                        label: toolbar.options.inlineClass[v]
                    });
                });
            }
        }),
        inlineStyleClear: Typer.ui.button({
            dropdownOption: 'exclude',
            requireWidget: 'inlineStyle',
            execute: 'applyClass'
        }),
        bold: simpleCommandButton('bold', 'inlineStyle'),
        italic: simpleCommandButton('italic', 'inlineStyle'),
        underline: simpleCommandButton('underline', 'inlineStyle'),
        strikeThrough: simpleCommandButton('strikeThrough', 'inlineStyle'),
        unorderedList: Typer.ui.button({
            requireWidgetEnabled: 'list',
            execute: function (toolbar, self, tx) {
                tx.insertWidget('list', '');
            },
            active: function (toolbar, self) {
                return self.widget && Typer.is(self.widget.element, 'ul');
            },
            enabled: function (toolbar) {
                return isEnabled(toolbar, false);
            }
        }),
        orderedList: Typer.ui.callout({
            requireWidgetEnabled: 'list',
            controls: [
                orderedListButton('1', '1, 2, 3, 4'),
                orderedListButton('a', 'a, b, c, d'),
                orderedListButton('A', 'A, B, C, D'),
                orderedListButton('i', 'i, ii, iii, iv'),
                orderedListButton('I', 'I, II, III, IV')
            ],
            active: function (toolbar, self) {
                return self.widget && Typer.is(self.widget.element, 'ol');
            },
            enabled: function (toolbar) {
                return isEnabled(toolbar, false);
            }
        }),
        indent: simpleCommandButton('indent', 'list'),
        outdent: simpleCommandButton('outdent', 'list'),
        justifyLeft: simpleCommandButton('justifyLeft', 'formatting'),
        justifyCenter: simpleCommandButton('justifyCenter', 'formatting'),
        justifyRight: simpleCommandButton('justifyRight', 'formatting'),
        justifyFull: simpleCommandButton('justifyFull', 'formatting')
    });

    Typer.ui.addLabels('en', 'typer:formatting', {
        bold: 'Bold',
        italic: 'Italic',
        underline: 'Underlined',
        strikeThrough: 'Strikethrough',
        unorderedList: 'Bullet list',
        orderedList: 'Numbered list',
        indent: 'Indent',
        outdent: 'Outdent',
        justifyLeft: 'Align left',
        justifyCenter: 'Align center',
        justifyRight: 'Align right',
        justifyFull: 'Align justified',
        paragraph: 'Formatting',
        inlineStyle: 'Text style',
        inlineStyleClear: 'Clear style'
    });

    Typer.ui.addLabels('en', 'typer:formatting:listtype', {
        'decimal': 'Decimal numbers',
        'lower-alpha': 'Alphabetically ordered list, lowercase',
        'upper-alpha': 'Alphabetically ordered list, uppercase',
        'lower-roman': 'Roman numbers, lowercase',
        'upper-roman': 'Roman numbers, uppercase'
    });

    Typer.ui.addLabels('en', 'typer:formatting:tagname', {
        p: 'Paragraph',
        h1: 'Header 1',
        h2: 'Header 2',
        h3: 'Header 3',
        h4: 'Header 4',
        h5: 'Header 5',
        h6: 'Header 6',
        table: 'Table',
        td: 'Table cell',
        th: 'Table header',
        ul: 'Unordered list',
        ol: 'Ordered list',
        li: 'List item',
        blockquote: 'Blockquote'
    });

    Typer.ui.addIcons('material', 'typer:formatting', {
        bold: '\ue238', // format_bold
        italic: '\ue23f', // format_italic
        underline: '\ue249', // format_underlined
        strikeThrough: '\ue257', // strikethrough_s
        unorderedList: '\ue241', // format_list_bulleted
        orderedList: '\ue242', // format_list_numbered
        indent: '\ue23e', // format_indent_increase
        outdent: '\ue23d', // format_indent_decrease
        justifyLeft: '\ue236', // format_align_left
        justifyCenter: '\ue234', // format_align_center
        justifyRight: '\ue237', // format_align_right
        justifyFull: '\ue235' // format_align_justify
    });

    Typer.ui.setShortcut({
        bold: 'ctrlB',
        italic: 'ctrlI',
        underline: 'ctrlU',
        justifyLeft: 'ctrlShiftL',
        justifyCenter: 'ctrlShiftE',
        justifyRight: 'ctrlShiftR'
    });

    Typer.ui.addHook('tab', function (typer) {
        if (typer.widgetEnabled('list')) {
            typer.invoke(indentCommand);
            return true;
        }
    });

}(jQuery, window.Typer));

(function ($, Typer) {
    'use strict';

    function normalizeUrl(url) {
        var anchor = document.createElement('A');
        anchor.href = url || '';
        if (location.protocol === anchor.protocol && location.hostname === anchor.hostname && (location.port === anchor.port || (location.port === '' && anchor.port === (location.protocol === 'https:' ? '443' : '80')))) {
            // for browsers incorrectly report URL components with a relative path
            // the supplied value must be at least an absolute path on the origin
            return anchor.pathname.replace(/^(?!\/)/, '/') + anchor.search + anchor.hash;
        }
        return url;
    }

    Typer.widgets.link = {
        element: 'a[href]',
        inline: true,
        insert: function (tx, value) {
            value = normalizeUrl(value || (/^[a-z]+:\/\//g.test(tx.selection.getSelectedText()) && RegExp.input));
            if (tx.selection.isCaret) {
                var element = $('<a>').text(value).attr('href', value)[0];
                tx.insertHtml(element);
            } else {
                tx.execCommand('createLink', value);
                tx.selection.collapse('end');
                tx.trackChange(tx.selection.startElement);
            }
        },
        remove: 'keepText',
        ctrlClick: function (e) {
            window.open(e.widget.element.href);
        },
        commands: {
            setURL: function (tx, value) {
                tx.widget.element.href = normalizeUrl(value);
                tx.trackChange(tx.widget.element);
            },
            unlink: function (tx) {
                tx.removeWidget(tx.widget);
            }
        }
    };

    Typer.defaultOptions.link = true;

    Typer.ui.addControls('typer', {
        'toolbar:link': Typer.ui.button({
            after: 'insert',
            requireWidgetEnabled: 'link',
            hiddenWhenDisabled: true,
            dialog: function (toolbar, self) {
                var selectedText = self.widget || toolbar.typer.getSelection().getSelectedText();
                var currentValue = {
                    href: self.widget ? $(self.widget.element).attr('href') : /^[a-z]+:\/\//g.test(selectedText) ? selectedText : '',
                    text: self.widget ? $(self.widget.element).text() : selectedText,
                    blank: self.widget ? $(self.widget.element).attr('target') === '_blank' : false
                };
                if (typeof toolbar.options.selectLink === 'function') {
                    return toolbar.options.selectLink(currentValue);
                }
                return Typer.ui('typer:link:selectLink', {
                    'typer:link:selectLink': currentValue
                }).execute();
            },
            execute: function (toolbar, self, tx, value) {
                if (!value) {
                    return null;
                }
                var href = value.href || value;
                var text = value.text || href;
                if (self.widget) {
                    $(self.widget.element).text(text);
                    tx.typer.invoke('setURL', href);
                    if (value.blank) {
                        $(self.widget.element).attr('target', '_blank');
                    } else {
                        $(self.widget.element).removeAttr('target');
                    }
                    tx.trackChange(self.widget.element);
                } else {
                    var textNode = Typer.createTextNode(text);
                    tx.insertHtml(textNode);
                    tx.selection.select(textNode);
                    tx.insertWidget('link', href);
                    if (tx.selection.focusNode.widget.id === 'link') {
                        if (value.blank) {
                            $(tx.selection.focusNode.widget.element).attr('target', '_blank');
                        } else {
                            $(tx.selection.focusNode.widget.element).removeAttr('target');
                        }
                    }
                }
            },
            active: function (toolbar, self) {
                return self.widget;
            }
        }),
        'contextmenu:link': Typer.ui.group('typer:link:*(type:button)'),
        'link:open': Typer.ui.button({
            requireWidget: 'link',
            hiddenWhenDisabled: true,
            shortcut: 'ctrlClick',
            execute: function (toolbar, self) {
                window.open(self.widget.element.href);
            }
        }),
        'link:unlink': Typer.ui.button({
            hiddenWhenDisabled: true,
            requireWidget: 'link',
            execute: 'unlink'
        }),
        'link:selectLink:text': Typer.ui.textbox(),
        'link:selectLink:url': Typer.ui.textbox(),
        'link:selectLink:blank': Typer.ui.checkbox(),
        'link:selectLink': Typer.ui.dialog({
            controls: '* dialog:buttonset',
            valueMap: {
                text: 'text',
                href: 'url',
                blank: 'blank'
            }
        })
    });

    Typer.ui.addLabels('en', 'typer', {
        'toolbar:link': 'Insert hyperlink',
        'link:url': 'Link URL',
        'link:blank': 'Open in new window',
        'link:open': 'Open hyperlink',
        'link:unlink': 'Remove hyperlink',
        'link:selectLink': 'Create hyperlink',
        'link:selectLink:text': 'Text',
        'link:selectLink:url': 'URL',
        'link:selectLink:blank': 'Open in new window',
    });

    Typer.ui.addIcons('material', 'typer', {
        'toolbar:link': '\ue250',  // insert_link
        'link:url': '\ue250'       // insert_link
    });

    Typer.ui.addHook('space', function (typer) {
        if (typer.widgetEnabled('link')) {
            var selection = typer.getSelection().clone();
            if (selection.getCaret('start').moveByWord(-1) && selection.focusNode.widget.id !== 'link' && /^[a-z]+:\/\//g.test(selection.getSelectedText())) {
                typer.snapshot(true);
                typer.getSelection().select(selection);
                typer.invoke(function (tx) {
                    tx.insertWidget('link');
                });
                typer.getSelection().collapse('end');
            }
        }
    });

}(jQuery, window.Typer));

(function ($, Typer) {
    'use strict';

    var reMediaType = /\.(?:(jpg|jpeg|png|gif|webp)|(mp4|ogg|webm)|(mp3))(?:\?.*)?$/i;

    Typer.widgets.media = {
        element: 'img,audio,video,a:has(>img)',
        text: function (widget) {
            return widget.element.src;
        },
        insert: function (tx, options) {
            var element = Typer.createElement(reMediaType.test(options.src || options) ? (RegExp.$2 ? 'video' : RegExp.$3 ? 'audio' : 'img') : 'img');
            element.src = options.src || options;
            if (Typer.is(element, 'video')) {
                $(element).attr('controls', '');
            }
            tx.insertHtml(element);
        }
    };

    Typer.defaultOptions.media = true;

    function insertMediaButton(type) {
        return Typer.ui.button({
            requireWidgetEnabled: 'media',
            hiddenWhenDisabled: true,
            dialog: function (toolbar) {
                if (typeof toolbar.options.selectMedia === 'function') {
                    return toolbar.options.selectMedia(type);
                }
                return toolbar.prompt('typer:media:selectImage');
            },
            execute: function (toolbar, self, tx, value) {
                tx.insertWidget('media', value);
            }
        });
    }

    Typer.ui.addControls('typer', {
        'widget:media': Typer.ui.group('typer:media:*'),
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
                return Typer.ui.prompt('dialog:selectImage', self.value);
            },
            execute: function (toolbar, self, tx, value) {
                $(self.widget.element).attr('src', value.src || value);
                tx.trackChange(self.widget.element);
            }
        }),
        'media:altText': Typer.ui.textbox({
            requireWidget: 'media',
            hiddenWhenDisabled: true,
            stateChange: function (toolbar, self) {
                self.value = $(self.widget.element).attr('alt');
            },
            execute: function (toolbar, self, tx) {
                $(self.widget.element).attr('alt', self.value).attr('title', self.value);
                tx.trackChange(self.widget.element);
            }
        })
    });

    Typer.ui.addLabels('en', 'typer', {
        'insert:image': 'Image',
        'insert:video': 'Video',
        'media:altText': 'Alternate text',
        'media:selectImage': 'Enter image URL'
    });

    Typer.ui.addIcons('material', 'typer', {
        'insert:image': '\ue251',  // insert_photo
        'insert:video': '\ue04b',  // videocam
        'media:altText': '\ue0b9'  // comment
    });

}(jQuery, window.Typer));

(function ($, Typer) {
    'use strict';

    var TD_HTML = '<td></td>';
    var TH_HTML = '<th></th>';
    var TR_HTML = '<tr>%</tr>';

    function repeat(str, count) {
        return new Array(count + 1).join(str);
    }

    function getSelectionInfo(selection) {
        var rows = [];
        var cols = [];
        Typer.iterate(selection.createTreeWalker(Typer.NODE_EDITABLE | Typer.NODE_EDITABLE_PARAGRAPH), function (v) {
            rows[rows.length] = $(v.element).parent().index();
            cols[cols.length] = $(v.element).index();
        });
        return {
            minRow: Math.min.apply(null, rows),
            maxRow: Math.max.apply(null, rows),
            minColumn: Math.min.apply(null, cols),
            maxColumn: Math.max.apply(null, cols)
        };
    }

    function tabNextCell(selection, dir, selector) {
        if (selection.isSingleEditable) {
            var nextCell = $(selection.focusNode.element)[dir]()[0] || $(selection.focusNode.element).parent()[dir]().children(selector)[0];
            if (nextCell) {
                selection.moveToText(nextCell, -0);
            }
        }
    }

    function setEditorStyle(element) {
        $('td,th', element).css({
            outline: '1px dotted black',
            minWidth: '3em'
        });
    }

    Typer.ui.define('tableGrid', {
        type: 'tableGrid'
    });

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
        init: function (e) {
            setEditorStyle(e.widget.element);
        },
        tab: function (e) {
            tabNextCell(e.typer.getSelection(), 'next', ':first-child');
        },
        shiftTab: function (e) {
            tabNextCell(e.typer.getSelection(), 'prev', ':last-child');
        },
        ctrlEnter: function (e) {
            e.typer.invoke(function (tx) {
                tx.selection.select(tx.widget.element, Typer.COLLAPSE_START_OUTSIDE);
                tx.insertText('');
            });
        },
        commands: {
            addColumnBefore: function (tx) {
                var info = getSelectionInfo(tx.selection);
                $(tx.widget.element).find('>tbody>tr>th:nth-child(' + (info.minColumn + 1) + ')').before(TH_HTML);
                $(tx.widget.element).find('>tbody>tr>td:nth-child(' + (info.minColumn + 1) + ')').before(TD_HTML);
                setEditorStyle(tx.widget.element);
                tx.trackChange(tx.widget.element);
            },
            addColumnAfter: function (tx) {
                var info = getSelectionInfo(tx.selection);
                $(tx.widget.element).find('>tbody>tr>th:nth-child(' + (info.maxColumn + 1) + ')').after(TH_HTML);
                $(tx.widget.element).find('>tbody>tr>td:nth-child(' + (info.maxColumn + 1) + ')').after(TD_HTML);
                setEditorStyle(tx.widget.element);
                tx.trackChange(tx.widget.element);
            },
            addRowAbove: function (tx) {
                var info = getSelectionInfo(tx.selection);
                var tableRow = $(tx.widget.element).find('>tbody>tr')[info.minRow];
                $(tableRow).before(TR_HTML.replace('%', repeat(TD_HTML, tableRow.childElementCount)));
                setEditorStyle(tx.widget.element);
                tx.trackChange(tx.widget.element);
            },
            addRowBelow: function (tx) {
                var info = getSelectionInfo(tx.selection);
                var tableRow = $(tx.widget.element).find('>tbody>tr')[info.maxRow];
                $(tableRow).after(TR_HTML.replace('%', repeat(TD_HTML, tableRow.childElementCount)));
                setEditorStyle(tx.widget.element);
                tx.trackChange(tx.widget.element);
            },
            removeColumn: function (tx) {
                var info = getSelectionInfo(tx.selection);
                $(tx.widget.element).find('>tbody>tr').each(function (i, v) {
                    $($(v).children().splice(info.minColumn, info.maxColumn - info.minColumn + 1)).remove();
                });
                tx.trackChange(tx.widget.element);
            },
            removeRow: function (tx) {
                var info = getSelectionInfo(tx.selection);
                $($(tx.widget.element).find('>tbody>tr').splice(info.minRow, info.maxRow - info.minRow + 1)).remove();
                tx.trackChange(tx.widget.element);
            },
            toggleTableHeader: function (tx) {
                if ($(tx.widget.element).find('th')[0]) {
                    $(tx.widget.element).find('th').wrapInner('<p>').each(function (i, v) {
                        tx.replaceElement(v, 'td');
                    });
                } else {
                    var columnCount = $(tx.widget.element).find('>tbody>tr')[0].childElementCount;
                    $(tx.widget.element).find('tbody').prepend(TR_HTML.replace('%', repeat(TH_HTML, columnCount)));
                    $(tx.widget.element).find('th').text(function (i, v) {
                        return 'Column ' + (i + 1);
                    });
                }
                setEditorStyle(tx.widget.element);
                tx.trackChange(tx.widget.element);
            }
        }
    };

    $.extend(Typer.ui.themeExtensions, {
        tableGrid: '<div class="typer-ui-grid"><div class="typer-ui-grid-wrapper"></div><br x:t="label"/></div>',
        tableGridExecuteOn: 'click',
        tableGridInit: function (toolbar, self) {
            var html = repeat('<div class="typer-ui-grid-row">' + repeat('<div class="typer-ui-grid-cell"></div>', 7) + '</div>', 7);
            $(self.element).find('.typer-ui-grid-wrapper').append(html);
            $(self.element).find('.typer-ui-grid-cell').mouseover(function () {
                self.value.rows = $(this).parent().index() + 1;
                self.value.columns = $(this).index() + 1;
                self.label = self.value.rows + ' \u00d7 ' + self.value.columns;
                $(self.element).find('.typer-ui-grid-cell').removeClass('active');
                $(self.element).find('.typer-ui-grid-row:lt(' + self.value.rows + ')').find('.typer-ui-grid-cell:nth-child(' + self.value.columns + ')').prevAll().andSelf().addClass('active');
            });
            self.label = '0 \u00d7 0';
            self.value = {};
        }
    });

    Typer.ui.addControls('typer', {
        'insert:table': Typer.ui.callout({
            requireWidgetEnabled: 'table',
            hiddenWhenDisabled: true
        }),
        'insert:table:create': Typer.ui.tableGrid({
            execute: function (toolbar, self, tx) {
                tx.insertWidget('table', self.value);
            }
        }),
        'contextmenu:table': Typer.ui.callout({
            requireWidget: 'table',
            hiddenWhenDisabled: true,
            defaultNS: 'typer:table'
        }),
        'selection:selectTable': Typer.ui.button({
            requireWidget: 'table',
            hiddenWhenDisabled: true,
            execute: function (toolbar, self) {
                var selection = toolbar.typer.getSelection();
                selection.select(self.widget.element);
                selection.focus();
            }
        }),
        'table:toggleTableHeader': Typer.ui.checkbox({
            requireWidget: 'table',
            execute: 'toggleTableHeader',
            stateChange: function (toolbar, self) {
                self.value = !!$(self.widget.element).find('th')[0];
            }
        }),
        'table:style': Typer.ui.callout({
            requireWidget: 'table',
            controls: function (toolbar, self) {
                var definedOptions = $.map(Object.keys(toolbar.options.tableStyles || {}), function (v) {
                    return Typer.ui.button({
                        requireWidget: 'table',
                        value: v,
                        label: toolbar.options.tableStyles[v],
                        execute: function (toolbar, self) {
                            self.widget.element.className = v;
                        }
                    });
                });
                var fallbackOption = Typer.ui.button({
                    requireWidget: 'table',
                    label: 'typer:table:styleDefault',
                    execute: function (toolbar, self) {
                        self.widget.element.className = '';
                    }
                });
                return definedOptions.concat(fallbackOption);
            }
        }),
        'table:tableWidth': Typer.ui.callout(),
        'table:tableWidth:fitContent': Typer.ui.button({
            requireWidget: 'table',
            execute: function (toolbar, self) {
                $(self.widget.element).removeAttr('width');
            }
        }),
        'table:tableWidth:fullWidth': Typer.ui.button({
            requireWidget: 'table',
            execute: function (toolbar, self) {
                $(self.widget.element).attr('width', '100%');
            }
        }),
        'table:addRemoveCell': Typer.ui.group(),
        'table:addRemoveCell:addColumnBefore': Typer.ui.button({
            requireWidget: 'table',
            execute: 'addColumnBefore'
        }),
        'table:addRemoveCell:addColumnAfter': Typer.ui.button({
            requireWidget: 'table',
            execute: 'addColumnAfter'
        }),
        'table:addRemoveCell:addRowAbove': Typer.ui.button({
            requireWidget: 'table',
            execute: 'addRowAbove'
        }),
        'table:addRemoveCell:addRowBelow': Typer.ui.button({
            requireWidget: 'table',
            execute: 'addRowBelow'
        }),
        'table:addRemoveCell:removeColumn': Typer.ui.button({
            requireWidget: 'table',
            execute: 'removeColumn'
        }),
        'table:addRemoveCell:removeRow': Typer.ui.button({
            requireWidget: 'table',
            execute: 'removeRow'
        })
    });

    Typer.ui.addLabels('en', 'typer', {
        'insert:table': 'Table',
        'contextmenu:table': 'Modify table',
        'selection:selectTable': 'Select table',
        'table:toggleTableHeader': 'Show header',
        'table:columnWidth': 'Set column width',
        'table:tableWidth': 'Set table width',
        'table:style': 'Set table style',
        'table:styleDefault': 'Default',
        'table:addRemoveCell:addColumnBefore': 'Add column before',
        'table:addRemoveCell:addColumnAfter': 'Add column after',
        'table:addRemoveCell:addRowAbove': 'Add row above',
        'table:addRemoveCell:addRowBelow': 'Add row below',
        'table:addRemoveCell:removeColumn': 'Remove column',
        'table:addRemoveCell:removeRow': 'Remove row',
        'table:tableWidth:fitContent': 'Fit to content',
        'table:tableWidth:fullWidth': 'Full width'
    });

}(jQuery, window.Typer));

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
                hideToolbar();
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

    function hideToolbar(toolbar) {
        if (activeToolbar && (!toolbar || activeToolbar === toolbar)) {
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
            controlExecuted: function (ui, control) {
                if (control.is('button dropdown')) {
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
                        $(document.body).unbind('mousemove', handler);
                    });
                }
            });
        }
        if (type === 'contextmenu') {
            $(typer.element).bind('contextmenu', function (e) {
                e.preventDefault();
                toolbar.update();
                toolbar.show({
                    x: e.clientX,
                    y: e.clientY
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
            e.widget.widgets = {};
        },
        focusin: function (e) {
            showToolbar(e.widget.toolbar);
        },
        focusout: function (e) {
            hideToolbar(e.widget.toolbar);
        },
        widgetFocusin: function (e) {
            if (!e.widget.widgets[e.targetWidget.id]) {
                if (Typer.ui.controls['typer:widget:' + e.targetWidget.id]) {
                    e.widget.widgets[e.targetWidget.id] = createToolbar(e.typer, e.widget.options, e.targetWidget);
                }
            }
            if (e.widget.widgets[e.targetWidget.id]) {
                e.widget.widgets[e.targetWidget.id].widget = e.targetWidget;
                showToolbar(e.widget.widgets[e.targetWidget.id]);
            }
        },
        widgetFocusout: function (e) {
            showToolbar(e.widget.toolbar);
        },
        widgetDestroy: function (e) {
            if (activeToolbar && activeToolbar.typer === e.typer) {
                showToolbar(e.widget.toolbar);
            }
        },
        stateChange: function (e) {
            if (activeToolbar && activeToolbar.typer === e.typer) {
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

    Typer.ui.addControls('typer', {
        'contextmenu': Typer.ui.group('history selection clipboard *'),
        'contextmenu:history': Typer.ui.group('typer:history:*'),
        'contextmenu:selection': Typer.ui.group('typer:selection:*'),
        'contextmenu:clipboard': Typer.ui.group('typer:clipboard:*'),
        'toolbar': Typer.ui.group(),
        'toolbar:insert': Typer.ui.callout({
            before: '*',
            controls: 'typer:insert:*',
            enabled: function (toolbar) {
                return toolbar.typer.getNode(toolbar.typer.element).nodeType !== Typer.NODE_EDITABLE_INLINE;
            }
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

}(jQuery, window.Typer));

(function ($, Typer) {
    'use strict';

    Typer.widgets.validation = {
        inline: true,
        init: function (e) {
            var options = e.widget.options;
            if (options.invalidChars) {
                options.invalidCharsRegex = new RegExp('[' + options.invalidChars.replace(/[\[\]\\^]/g, '\\$&') + ']', 'g');
            }
            if (options.allowChars) {
                options.invalidCharsRegex = new RegExp('[^' + options.allowChars.replace(/[\[\]\\^]/g, '\\$&') + ']', 'g');
            }
        },
        textInput: function (e) {
            var options = e.widget.options;
            var filteredText = e.data;
            if (options.invalidCharsRegex) {
                var o = filteredText;
                filteredText = filteredText.replace(options.invalidCharsRegex, '');
            }
            if (options.maxlength) {
                var room = options.maxlength - e.typer.extractText().length;
                if (filteredText.length > room) {
                    filteredText = filteredText.substr(0, room);
                }
            }
            if (filteredText !== e.data) {
                e.preventDefault();
                if (filteredText) {
                    e.typer.invoke(function (tx) {
                        tx.insertText(filteredText);
                    });
                }
            }
        }
    };

} (jQuery, window.Typer));

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

(function ($, Typer) {
    'use strict';

    var MS_PER_DAY = 86400000;
    var monthstr = 'January February March April May June July August September October November December'.split(' ');
    var shortWeekday = 'Su Mo Tu We Th Fr Sa'.split(' ');
    var activeTyper;
    var datepickerMenuUI;

    function repeat(str, count) {
        return new Array(count + 1).join(str);
    }

    function normalizeDate(mode, date) {
        date = new Date(+date);
        switch (mode) {
            case 'week':
                date.setDate(date.getDate() - date.getDay());
                break;
            case 'month':
                date.setDate(1);
                break;
        }
        return date;
    }

    function stepDate(mode, date, dir) {
        switch (mode) {
            case 'day':
                return new Date(+date + MS_PER_DAY * dir);
            case 'week':
                return new Date(+date + MS_PER_DAY * 7 * dir);
            case 'month':
                return new Date(date.getFullYear(), date.getMonth() + dir, date.getDate());
            case 'year':
                return new Date(date.getFullYear() + dir, date.getMonth(), date.getDate());
        }
    }

    function formatDate(mode, date) {
        switch (mode) {
            case 'month':
                return monthstr[date.getMonth()] + ' ' + date.getFullYear();
            case 'week':
                var end = stepDate('day', date, 6);
                return monthstr[date.getMonth()] + ' ' + date.getDate() + ' - ' + (end.getMonth() !== date.getMonth() ? monthstr[end.getMonth()] + ' ' : '') + end.getDate() + ', ' + date.getFullYear();
        }
        return monthstr[date.getMonth()] + ' ' + date.getDate() + ', ' + date.getFullYear();
    }

    function initDatapicker() {
        datepickerMenuUI = Typer.ui({
            type: 'contextmenu',
            controls: [Typer.ui.calendar({
                name: 'calendar'
            })],
            controlExecuted: function (ui, control) {
                if (control.is('calendar')) {
                    activeTyper.setValue(ui.getValue(control));
                }
            }
        });
    }

    Typer.ui.define('calendar', {
        type: 'calendar',
        defaultNS: 'calendar',
        controls: '*',
        showButtonLabel: false,
        get value() {
            return normalizeDate(this.mode, this.selectedDate);
        },
        set value(value) {
            this.selectedDate = normalizeDate(this.mode, value);
            this.ui.trigger(this, 'showMonth', this.selectedDate);
        },
        init: function (ui, self) {
            var $table = $('table', self.element);
            $(repeat('<tr></tr>', 7)).appendTo($table);
            $(repeat('<th></th>', 7)).appendTo($table.find('tr:first'));
            $(repeat('<td></td>', 7)).appendTo($table.find('tr+tr'));
            $('<button>').appendTo($table.find('td'));
            $table.find('th').text(function (i) {
                return shortWeekday[i];
            });
            $table.bind('mousewheel', function (e) {
                ui.trigger(self, 'showMonth', Typer.ui.getWheelDelta(e));
            });
            $table.find('td').click(function () {
                var monthDelta = $(this).hasClass('prev') ? -1 : $(this).hasClass('next') ? 1 : 0;
                ui.setValue(self, new Date(self.currentMonth.getFullYear(), self.currentMonth.getMonth() + monthDelta, +this.textContent));
                ui.execute(self);
            });
        },
        stateChange: function (ui, self) {
            ui.trigger(self, 'showMonth', self.currentMonth || self.value || new Date());
        },
        showMonth: function (ui, self, date) {
            if (isNaN(+date)) {
                return;
            }
            if (typeof date === 'number') {
                date = stepDate('month', self.currentMonth, date);
            }
            var y = date.getFullYear();
            var m = date.getMonth();
            var currentMonth = new Date(y, m);
            var firstDay = currentMonth.getDay();
            var $buttons = $('td', self.element).removeClass('selected');

            if (currentMonth !== self.currentMonth) {
                var numDays = new Date(y, m + 1, 0).getDate();
                var numDaysLast = new Date(y, m, 0).getDate();
                $buttons.removeClass('prev cur next today');
                $buttons.each(function (i, v) {
                    if (i < firstDay) {
                        $(v).children().text(i + 1 - firstDay + numDaysLast).end().addClass('prev');
                    } else if (i >= numDays + firstDay) {
                        $(v).children().text(i + 1 - firstDay - numDays).end().addClass('next');
                    } else {
                        $(v).children().text(i + 1 - firstDay).end().addClass('cur');
                    }
                });
                var today = new Date();
                if (today.getFullYear() === y && today.getMonth() === m) {
                    $buttons.filter('.cur').eq(today.getDate() - 1).addClass('today');
                }
                $('tr:last', self.element).toggle(firstDay + numDays > 35);

                var cy = self.resolve('year')[0];
                var cm = self.resolve('month')[0];
                $.each(cy.controls, function (i, v) {
                    v.label = v.value = y + i - 5;
                });
                cy.value = y;
                cm.value = m;
                self.currentMonth = currentMonth;
            }
            if (self.value.getFullYear() === y && self.value.getMonth() === m) {
                switch (self.mode) {
                    case 'day':
                        $buttons.eq(self.value.getDate() + firstDay - 1).addClass('selected');
                        break;
                    case 'week':
                        $buttons.slice(self.value.getDate() + firstDay - 1, self.value.getDate() + firstDay + 6).addClass('selected');
                        break;
                    case 'month':
                        $buttons.filter('td.cur').addClass('selected');
                        break;
                }
            }
            $(self.element).toggleClass('select-range', self.mode !== 'day');
        }
    });

    Typer.ui.addControls('calendar', {
        year: Typer.ui.dropdown({
            controls: function () {
                var arr = [];
                for (var i = 0; i < 11; i++) {
                    arr[i] = Typer.ui.button();
                }
                return arr;
            },
            execute: function (ui, self) {
                ui.trigger(self.contextualParent, 'showMonth', new Date(self.value, ui.getValue('calendar:month')));
            }
        }),
        month: Typer.ui.dropdown({
            execute: function (ui, self) {
                ui.trigger(self.contextualParent, 'showMonth', new Date(ui.getValue('calendar:year'), self.value));
            }
        }),
        prev: Typer.ui.button({
            buttonsetGroup: 'right',
            execute: function (ui, self) {
                ui.trigger(self.contextualParent, 'showMonth', -1);
            }
        }),
        today: Typer.ui.button({
            buttonsetGroup: 'right',
            execute: function (ui, self) {
                ui.setValue(self.contextualParent, new Date());
            }
        }),
        next: Typer.ui.button({
            buttonsetGroup: 'right',
            execute: function (ui, self) {
                ui.trigger(self.contextualParent, 'showMonth', 1);
            }
        })
    });

    Typer.ui.addIcons('material', 'calendar', {
        today: '\ue8df', // today
        prev: '\ue314', // keyboard_arrow_left
        next: '\ue315', // keyboard_arrow_right
    });

    Typer.ui.addLabels('en', 'calendar', {
        today: 'Today',
        prev: 'Previous month',
        next: 'Next month'
    });

    var monthLabels = {};
    var monthControls = {};
    for (var i = 0; i < 12; i++) {
        monthLabels[monthstr[i].toLowerCase()] = monthstr[i];
        monthControls[monthstr[i].toLowerCase()] = Typer.ui.button({
            value: i
        });
    }
    Typer.ui.addControls('calendar:month', monthControls);
    Typer.ui.addLabels('en', 'calendar:month', monthLabels);

    $.extend(Typer.ui.themeExtensions, {
        calendar: '<div class="typer-ui-calendar"><div class="typer-ui-calendar-header"><br x:t="buttonset"/></div><div class="typer-ui-calendar-body"><table></table></div></div>'
    });

    Typer.presets.datepicker = {
        options: {
            mode: 'day'
        },
        overrides: {
            getValue: function (preset) {
                return preset.selectedDate ? normalizeDate(preset.options.mode, preset.selectedDate) : null;
            },
            setValue: function (preset, date) {
                preset.selectedDate = date && normalizeDate(preset.options.mode, date);
                this.selectAll();
                this.invoke(function (tx) {
                    tx.insertText(date ? formatDate(preset.options.mode, preset.selectedDate) : '');
                });
                if (this === activeTyper) {
                    datepickerMenuUI.setValue('calendar', preset.selectedDate || new Date());
                }
            },
            hasContent: function (preset) {
                return !!preset.selectedDate;
            }
        },
        contentChange: function (e) {
            if (e.typer === activeTyper && e.data !== 'script') {
                var date = new Date(e.typer.extractText());
                if (!isNaN(+date)) {
                    datepickerMenuUI.setValue('calendar', normalizeDate(e.widget.options.mode, date));
                }
            }
        },
        click: function (e) {
            if (e.typer === activeTyper) {
                datepickerMenuUI.show(e.typer.element);
            }
        },
        mousewheel: function (e) {
            e.typer.setValue(stepDate(e.widget.options.mode, e.typer.getValue(), e.data));
            e.preventDefault();
        },
        upArrow: function (e) {
            e.typer.setValue(stepDate(e.widget.options.mode, e.typer.getValue(), -1));
        },
        downArrow: function (e) {
            e.typer.setValue(stepDate(e.widget.options.mode, e.typer.getValue(), 1));
        },
        focusin: function (e) {
            if (!datepickerMenuUI) {
                initDatapicker();
            }
            e.typer.retainFocus(datepickerMenuUI.element);
            activeTyper = e.typer;
            datepickerMenuUI.setValue('calendar', 'mode', e.widget.options.mode);
            datepickerMenuUI.setValue('calendar', e.typer.getValue() || new Date());
            datepickerMenuUI.show(e.typer.element);
        },
        focusout: function (e) {
            if (e.typer === activeTyper) {
                e.typer.setValue(datepickerMenuUI.getValue('calendar'));
            }
            datepickerMenuUI.hide();
        }
    };

}(jQuery, window.Typer));

(function ($, Typer) {
    'use strict';

    function encode(v) {
        var a = document.createTextNode(v.replace(/\s/g, '\u00a0')),
            b = document.createElement('div');
        b.appendChild(a);
        return b.innerHTML;
    }

    function filter(suggestions, needle, count) {
        suggestions = suggestions.map(function (v) {
            return {
                value: String(v)
            };
        }).filter(function (v) {
            var vector = [];
            var str = v.value.toLowerCase();
            var j = 0,
                lastpos = -1;
            for (var i = 0; i < needle.length; i++) {
                var l = needle.charAt(i).toLowerCase();
                if (l == ' ') {
                    continue;
                }
                j = str.indexOf(l, j);
                if (j == -1) {
                    return false;
                }
                vector[vector.length] = j - lastpos - 1;
                lastpos = j++;
            }
            v.firstIndex = vector[0];
            v.consecutiveMatches = /^(0+)/.test(vector.slice(0).sort().join('')) && RegExp.$1.length;
            v.formattedText = '';
            j = 0;
            for (i = 0; i < vector.length; i++) {
                v.formattedText += encode(v.value.substr(j, vector[i])) + '<b>' + encode(v.value[j + vector[i]]) + '</b>';
                j += vector[i] + 1;
            }
            v.formattedText += encode(v.value.slice(j));
            v.formattedText = v.formattedText.replace(/<\/b><b>/g, '');
            return true;
        });
        suggestions.sort(function (a, b) {
            return ((b.consecutiveMatches - a.consecutiveMatches) + (a.firstIndex - b.firstIndex)) || a.value.localeCompare(b.value);
        });
        return suggestions.slice(0, count);
    }

    Typer.presets.keyword = {
        options: {
            required: false,
            allowFreeInput: true,
            suggestionCount: 5,
            suggestions: false,
            validate: function () {
                return true;
            }
        },
        overrides: {
            getValue: function (preset) {
                return $('span', this.element).map(function (i, v) {
                    return v.childNodes[0].data;
                }).get();
            },
            setValue: function (preset, values) {
                this.invoke(function (tx) {
                    function validateAndAdd(v) {
                        if (preset.options.validate(v)) {
                            tx.insertWidget('tag', v);
                        }
                    }
                    tx.selection.select(tx.typer.element, 'contents');
                    tx.insertText('');
                    if ($.isArray(values)) {
                        $.map(values, validateAndAdd);
                    } else {
                        String(values).replace(/\S+/g, validateAndAdd);
                    }
                });
            },
            hasContent: function () {
                return !!($('span', this.element)[0] || this.extractText());
            },
            validate: function (preset) {
                var value = this.getValue();
                if (preset.options.required && !value.length) {
                    return false;
                }
                return !$('.invalid', this.element)[0];
            }
        },
        widgets: {
            tag: {
                element: 'span',
                inline: true,
                editable: 'none',
                insert: function (tx, value) {
                    tx.insertHtml('<span class="typer-ui-keyword">' + value + '<i>delete</i></span>');
                },
                click: function (e) {
                    if (e.target !== e.widget.element) {
                        e.widget.remove();
                    }
                }
            }
        },
        commands: {
            add: function (tx, value) {
                if (!value || tx.typer.getValue().indexOf(value) >= 0) {
                    return;
                }
                var lastSpan = $('span:last', tx.typer.element)[0];
                if (lastSpan) {
                    tx.selection.select(lastSpan, false);
                } else {
                    tx.selection.select(tx.typer.element, 0);
                }
                tx.insertWidget('tag', value);
                lastSpan = $('span:last', tx.typer.element)[0];
                tx.selection.select(Typer.createRange(lastSpan, false), Typer.createRange(tx.typer.element, -0));
                tx.insertText('');

                var preset = tx.typer.getStaticWidget('__preset__');
                $(lastSpan).toggleClass('invalid', (!preset.options.allowFreeInput && preset.allowedValues.indexOf(value) < 0));
            }
        },
        init: function (e) {
            e.typer.getSelection().moveToText(e.typer.element, -0);
            e.widget.callout = $('<div class="typer-ui typer-ui-float"><div class="typer-ui-buttonlist"></div></div>')[0];
            $(e.widget.callout).on('click', 'button', function (e2) {
                e.typer.invoke('add', $(e2.currentTarget).text());
                $(e.typer.element).focus();
                $(e.widget.callout).detach();
            });
            e.typer.retainFocus(e.widget.callout);
        },
        click: function (e) {
            e.widget.selectedIndex = -1;
        },
        focusout: function (e) {
            e.widget.selectedIndex = -1;
            $(e.widget.callout).detach();
            var value = Typer.trim(e.typer.extractText());
            if (value && e.widget.options.validate(value)) {
                e.typer.invoke('add', value);
            }
        },
        upArrow: function (e) {
            if (e.widget.selectedIndex >= 0) {
                $('button', e.widget.callout).removeClass('active').eq(e.widget.selectedIndex--).prev().addClass('active');
            }
        },
        downArrow: function (e) {
            if (e.widget.selectedIndex < $('button', e.widget.callout).length - 1) {
                $('button', e.widget.callout).removeClass('active').eq(++e.widget.selectedIndex).addClass('active');
            }
        },
        enter: function (e) {
            if (e.widget.selectedIndex >= 0) {
                e.typer.invoke('add', $('button', e.widget.callout).eq(e.widget.selectedIndex).text());
                e.widget.selectedIndex = -1;
            } else {
                var value = Typer.trim(e.typer.extractText());
                if (value && e.widget.options.validate(value)) {
                    e.typer.invoke('add', value);
                }
            }
        },
        keystroke: function (e) {
            if (e.data === 'escape' && $.contains(document.body, e.widget.callout)) {
                e.widget.selectedIndex = -1;
                $(e.widget.callout).detach();
                e.preventDefault();
            }
        },
        contentChange: function (e) {
            if (e.data === 'textInput' || e.data === 'keystroke') {
                var value = Typer.trim(e.typer.extractText());
                var suggestions = e.widget.options.suggestions || [];
                if ($.isFunction(suggestions)) {
                    suggestions = suggestions(value);
                }
                $.when(suggestions).done(function (suggestions) {
                    var currentValues = e.typer.getValue();
                    e.widget.allowedValues = suggestions;
                    suggestions = suggestions.filter(function (v) {
                        return currentValues.indexOf(v) < 0;
                    });
                    suggestions = filter(suggestions, value, e.widget.options.suggestionCount);
                    if (value && e.widget.options.allowFreeInput) {
                        suggestions.push({
                            formattedText: '<i>' + encode(value) + '</i>'
                        });
                    }
                    var html;
                    if (suggestions.length) {
                        html = '<button>' + suggestions.map(function (v) {
                            return v.formattedText;
                        }).join('</button><button>') + '</button>';
                    } else {
                        html = '<button class="disabled">No suggestions</button>';
                    }
                    $(e.widget.callout).children().html(html);
                });
                setTimeout(function () {
                    if (e.typer.focused() && !$.contains(document.body, e.widget.callout)) {
                        var r = e.typer.element.getBoundingClientRect();
                        $(e.widget.callout).appendTo(document.body).css({
                            position: 'fixed',
                            top: r.bottom,
                            left: r.left
                        });
                        Typer.ui.setZIndex(e.widget.callout, e.typer.element);
                    }
                });
            }
        }
    };

}(jQuery, window.Typer));

(function ($, Typer) {
    'use strict';

    Typer.presets.number = {
        validation: {
            allowChars: '0-9'
        },
        options: {
            max: null,
            min: null,
            digits: 'auto',
            step: 1
        },
        overrides: {
            getValue: function (preset) {
                return parseInt(this.extractText());
            },
            setValue: function (preset, value) {
                value = +value || 0;
                if (preset.options.max !== null && value > preset.options.max) {
                    value = preset.options.max;
                }
                if (preset.options.min !== null && value < preset.options.min) {
                    value = preset.options.min;
                }
                value = String(+value || 0);
                if (preset.options.digits === 'fixed') {
                    var numOfDigits = String(+preset.options.max || 0).length;
                    value = (new Array(numOfDigits + 1).join('0') + value).substr(-numOfDigits);
                }
                if (value !== this.extractText()) {
                    this.invoke(function (tx) {
                        tx.selection.select(this.element, 'contents');
                        tx.insertText(String(value));
                    });
                }
            },
            hasContent: function () {
                return !!this.extractText();
            }
        },
        focusout: function (e) {
            var value = parseInt(e.typer.extractText()) || 0;
            e.typer.setValue(value);
        },
        mousewheel: function (e) {
            e.typer.setValue(e.typer.getValue() - e.data * e.widget.options.step);
            e.preventDefault();
        },
        upArrow: function (e) {
            var value = parseInt(e.typer.extractText()) || 0;
            e.typer.setValue(value + e.widget.options.step);
        },
        downArrow: function (e) {
            var value = parseInt(e.typer.extractText()) || 0;
            e.typer.setValue(value - e.widget.options.step);
        },
        contentChange: function (e) {
            if (e.data !== 'keystroke') {
                var value = parseInt(e.typer.extractText()) || 0;
                e.typer.setValue(value);
            }
        }
    };

} (jQuery, window.Typer));

(function ($, Typer) {
    'use strict';

    Typer.presets.textbox = {
        accept: 'text',
        options: {
            required: false
        },
        overrides: {
            getValue: function (preset) {
                return this.extractText();
            },
            setValue: function (preset, value) {
                if (value !== this.getValue()) {
                    this.invoke(function (tx) {
                        tx.selection.select(this.element, 'contents');
                        tx.insertText(value);
                    });
                }
            },
            hasContent: function () {
                return !!this.getValue();
            },
            validate: function (preset) {
                var value = this.getValue();
                if (preset.options.required && !value) {
                    return false;
                }
                return true;
            }
        },
        init: function (e) {
            e.typer.getSelection().moveToText(e.typer.element, -0);
        }
    };

} (jQuery, window.Typer));

(function ($, Typer, window, document) {
    'use strict';

    var ANIMATION_END = 'animationend oanimationend webkitAnimationEnd';
    var TRANSITION_END = 'transitionend otransitionend webkitTransitionEnd';

    function setMenuPosition(thisMenu) {
        var callout = $('.typer-ui-float', thisMenu)[0];
        var nested = !!$(thisMenu).parents('.typer-ui-float')[0];
        var rect = callout.getBoundingClientRect();
        if (rect.bottom > $(window).height()) {
            $(callout).removeClass('float-top float-bottom').addClass('float-top');
        } else if (rect.top < 0) {
            $(callout).removeClass('float-top float-bottom').addClass('float-bottom');
        }
        if (rect.right > $(window).width()) {
            $(callout).removeClass('float-left float-right').addClass('float-left');
        } else if (rect.left < 0) {
            $(callout).removeClass('float-left float-right').addClass('float-right');
        }
    }

    function detachCallout(control) {
        var callout = $('<div class="typer-ui typer-ui-material">').append($(control.element).children('.typer-ui-float').addClass('is-' + control.type))[0];
        if (control.ui.typer) {
            control.ui.typer.retainFocus(callout);
        }
        $(control.element).click(function (e) {
            control.ui.show(control, callout, control.element, 'left bottom');
        });
    }

    Typer.ui.themes.material = Typer.ui.theme({
        resources: [
            'https://fonts.googleapis.com/css?family=Roboto:400,500,700',
            'https://fonts.googleapis.com/icon?family=Material+Icons',
            'https://cdn.rawgit.com/misonou/jquery-typer/master/css/jquery.typer.material.css'
        ],
        controlActiveClass: 'active',
        controlDisabledClass: 'disabled',
        controlHiddenClass: 'hidden',
        controlPinActiveClass: 'pin-active',
        iconset: 'material',
        label: '<span class="typer-ui-label"><br x:t="labelIcon"/><br x:t="labelText"/></span>',
        labelText: function (ui, control) {
            if (control.is('textbox')) {
                return '';
            }
            if (!(control.contextualParent || ui).is('callout') && ui.getIcon(control)) {
                if (!control.showButtonLabel || !control.contextualParent.showButtonLabel || !ui.showButtonLabel) {
                    return '';
                }
            }
            return '<span x:bind="(_:label)"></span>';
        },
        labelIcon: function (ui, control) {
            if ((control.contextualParent || ui).is('dropdown') || control.is('checkbox') || !ui.getIcon(control)) {
                return '';
            }
            return '<i class="material-icons" x:bind="(_:icon)"></i>';
        },
        buttonset: '<div class="typer-ui-buttonset"><br x:t="children(buttonsetGroup:left)"/><div class="typer-ui-buttonset-pad"></div><br x:t="children(buttonsetGroup:right)"/></div>',
        buttonlist: '<div class="typer-ui-buttonlist"><br x:t="children"/></div>',
        form: '<div class="typer-ui-form"><br x:t="children"/></div>',
        menupane: '<div class="typer-ui-float"><div class="typer-ui-buttonlist"><br x:t="children"/></div></div>',
        toolbar: '<div class="typer-ui-buttonset is-toolbar"><br x:t="children"/></div>',
        contextmenu: '<div class="typer-ui-float is-contextmenu"><div class="typer-ui-buttonlist"><br x:t="children"/></div></div>',
        group: '<div class="typer-ui-group"><br x:t="children"/></div>',
        groupStateChange: function (ui, control) {
            setImmediate(function () {
                $(control.element).toggleClass('sep-before', !!$(control.element).prevAll(':not(.hidden)')[0]);
                $(control.element).toggleClass('sep-after', !!$(control.element).nextAll(':not(.hidden):first:not(.typer-ui-group)')[0]);
            });
        },
        button: '<button x:bind="(title:label)"><br x:t="label"/><span class="typer-ui-label-annotation" role="shortcut" x:bind="(_:shortcut)"></span><span class="typer-ui-label-annotation" x:bind="(_:annotation)"></span></button>',
        buttonExecuteOn: 'click',
        file: '<label class="has-clickeffect" x:bind="(title:label)"><input type="file"/><br x:t="label"/></label>',
        fileInit: function (ui, control) {
            $(control.element).find(':file').change(function (e) {
                control.value = e.target.files;
                ui.execute(control);
                setImmediate(function () {
                    var form = document.createElement('form');
                    form.appendChild(e.target);
                    form.reset();
                    $(e.target).prependTo(control.element);
                });
            });
        },
        callout: '<label class="typer-ui-callout" x:bind="(title:label)"><br x:t="button"/><br x:t="menupane"/></label>',
        calloutExecuteOn: 'click',
        calloutInit: function (ui, control) {
            if (!control.contextualParent.is('callout contextmenu')) {
                detachCallout(control);
            }
        },
        dropdown: '<button class="typer-ui-dropdown" x:bind="(title:label)"><span class="typer-ui-label"><br x:t="labelIcon"/><span x:bind="(_:selectedText)"></span></span><br x:t="menupane"/></button>',
        dropdownInit: function (ui, control) {
            if (!control.contextualParent.is('callout contextmenu')) {
                detachCallout(control);
            }
        },
        checkbox: '<button class="typer-ui-checkbox" x:bind="(title:label)"><br x:t="label"/></button>',
        checkboxInit: function (ui, control) {
            $(control.element).click(function () {
                control.value = $(this).toggleClass('checked').hasClass('checked');
                ui.execute(control);
            });
        },
        checkboxStateChange: function (ui, control) {
            $(control.element).toggleClass('checked', !!control.value);
        },
        textboxInner: '<div class="typer-ui-textbox-inner"><div contenteditable spellcheck="false"></div><div class="typer-ui-textbox-placeholder" x:bind="(_:label)"></div><div class="typer-ui-textbox-error"></div></div>',
        textboxCombo: '<label class="typer-ui-textbox typer-ui-textbox-combo" x:bind="(title:label)"><br x:t="label"/><div class="typer-ui-textbox-wrapper"><br x:t="children(textbox:textboxInner)"/></div></label>',
        textbox: '<label class="typer-ui-textbox" x:bind="(title:label)"><br x:t="label"/><div class="typer-ui-textbox-wrapper"><br x:t="textboxInner"/></div></label>',
        textboxInit: function (ui, control) {
            var editable = $('[contenteditable]', control.element)[0];
            control.preset = Typer.preset(editable, control.preset, $.extend({}, control.presetOptions, {
                focusin: function (e) {
                    $(control.element).closest('.typer-ui-textbox').addClass('focused');
                },
                focusout: function (e) {
                    $(control.element).closest('.typer-ui-textbox').removeClass('focused');
                },
                contentChange: function (e) {
                    control.value = control.preset.getValue();
                    $(control.element).toggleClass('empty', !control.preset.hasContent()).removeClass('error');
                    if (e.typer.focused()) {
                        ui.execute(control);
                    }
                }
            }));
            control.preset.parentControl = control;
            $(control.element).toggleClass('empty', !control.preset.hasContent());
        },
        textboxValidate: function (ui, control, opt) {
            var valid = control.preset.validate() !== false;
            $(control.element).toggleClass('error', !valid);
            if (!valid) {
                opt.fail();
            }
        },
        textboxStateChange: function (ui, control) {
            control.preset.setValue(control.value || '');
        },
        dialog: '<div class="typer-ui-dialog-wrapper"><div class="typer-ui-dialog-pin"></div><div class="typer-ui-dialog"><div class="typer-ui-dialog-content typer-ui-form"><br x:t="children"></div></div></div>',
        dialogOpen: function (ui, control) {
            var resolveButton = control.resolve(control.resolveBy)[0];
            var $wrapper = $(ui.element).find('.typer-ui-dialog-wrapper');
            var $content = $(ui.element).find('.typer-ui-dialog-content');

            $(ui.element).appendTo(document.body);
            $wrapper.click(function (e) {
                if (e.target === $wrapper[0]) {
                    $content.addClass('pop');
                }
            });
            $content.bind(ANIMATION_END, function () {
                $content.removeClass('pop');
            });
            if (resolveButton) {
                $(resolveButton.element).addClass('pin-active');
            }
            setImmediate(function () {
                $(control.element).addClass('open');
                if (control.pinnable && ui.parentControl && Typer.ui.matchWSDelim(ui.parentControl.pinDirection, 'left right top bottom')) {
                    $wrapper.addClass('pinned pinned-' + ui.parentControl.pinDirection);
                    $(ui.parentControl.element).addClass('pin-active');
                    Typer.ui.pin(control, $wrapper[0], ui.parentControl.element, ui.parentControl.pinDirection);
                }
            });
        },
        dialogWaiting: function (ui, control) {
            $(control.element).addClass('loading');
        },
        dialogError: function (ui, control) {
            $(control.element).removeClass('loading');
        },
        dialogClose: function (ui, control) {
            $(control.element).addClass('closing').one(TRANSITION_END, function () {
                $(ui.element).remove();
                if (control.pinnable && ui.parentControl) {
                    $(ui.parentControl.element).removeClass('pin-active');
                    Typer.ui.unpin(control);
                }
            });
        },
        afterShow: function (ui, control, data) {
            if (control.is('dialog contextmenu')) {
                $(data.element).removeClass('closing').addClass('open');
            }
        },
        beforeHide: function (ui, control, data) {
            if (control.is('dialog contextmenu')) {
                var deferred = $.Deferred();
                $(data.element).addClass('closing').one(TRANSITION_END, function () {
                    if ($(this).hasClass('closing')) {
                        $(this).removeClass('open closing');
                        deferred.resolve();
                    }
                });
                return deferred.promise();
            }
        },
        positionUpdate: function (ui, control, data) {
            $.each(['left', 'right', 'top', 'bottom'], function (i, v) {
                $(data.element).toggleClass('stick-' + v, !!data.stick[v]);
            });
        },
        controlExecuted: function (ui, control) {
            if (control.is('button') && control.contextualParent.is('callout dropdown contextmenu')) {
                ui.hide(control.contextualParent);
            }
        }
    });

    $(function () {
        var SELECT_EFFECT = '.typer-ui-material button:not(.typer-ui-checkbox), .typer-ui-material .has-clickeffect';
        $(document.body).on('mousedown', SELECT_EFFECT, function (e) {
            var pos = e.currentTarget.getBoundingClientRect();
            var $overlay = $('<div class="typer-ui-clickeffect"><i></i></div>').appendTo(e.currentTarget).children().css({
                top: e.clientY - pos.top,
                left: e.clientX - pos.left,
            });
            var p1 = Math.pow(e.clientY - pos.top, 2) + Math.pow(e.clientX - pos.left, 2);
            var p2 = Math.pow(e.clientY - pos.top, 2) + Math.pow(e.clientX - pos.right, 2);
            var p3 = Math.pow(e.clientY - pos.bottom, 2) + Math.pow(e.clientX - pos.left, 2);
            var p4 = Math.pow(e.clientY - pos.bottom, 2) + Math.pow(e.clientX - pos.right, 2);
            var scalePercent = 0.5 + 2 * Math.sqrt(Math.max(p1, p2, p3, p4)) / parseFloat($overlay.css('font-size'));
            setImmediate(function () {
                $overlay.css('transform', $overlay.css('transform') + ' scale(' + scalePercent + ')').addClass('animate-in');
            });
            $overlay.parent().css('border-radius', $(e.currentTarget).css('border-radius'));
        });
        $(document.body).on('mouseup mouseleave', SELECT_EFFECT, function (e) {
            var $overlay = $('.typer-ui-clickeffect', e.currentTarget);
            $overlay.children().addClass('animate-out').bind(TRANSITION_END, function () {
                $overlay.remove();
            });
        });
        $(document.body).on('mouseover', '.typer-ui-callout:has(>.typer-ui-float)', function (e) {
            setMenuPosition(e.currentTarget);
        });
    });

}(jQuery, window.Typer, window, document));

(function (global, undefined) {
    "use strict";

    if (global.setImmediate) {
        return;
    }

    var nextHandle = 1; // Spec says greater than zero
    var tasksByHandle = {};
    var currentlyRunningATask = false;
    var doc = global.document;
    var registerImmediate;

    function setImmediate(callback) {
      // Callback can either be a function or a string
      if (typeof callback !== "function") {
        callback = new Function("" + callback);
      }
      // Copy function arguments
      var args = new Array(arguments.length - 1);
      for (var i = 0; i < args.length; i++) {
          args[i] = arguments[i + 1];
      }
      // Store and register the task
      var task = { callback: callback, args: args };
      tasksByHandle[nextHandle] = task;
      registerImmediate(nextHandle);
      return nextHandle++;
    }

    function clearImmediate(handle) {
        delete tasksByHandle[handle];
    }

    function run(task) {
        var callback = task.callback;
        var args = task.args;
        switch (args.length) {
        case 0:
            callback();
            break;
        case 1:
            callback(args[0]);
            break;
        case 2:
            callback(args[0], args[1]);
            break;
        case 3:
            callback(args[0], args[1], args[2]);
            break;
        default:
            callback.apply(undefined, args);
            break;
        }
    }

    function runIfPresent(handle) {
        // From the spec: "Wait until any invocations of this algorithm started before this one have completed."
        // So if we're currently running a task, we'll need to delay this invocation.
        if (currentlyRunningATask) {
            // Delay by doing a setTimeout. setImmediate was tried instead, but in Firefox 7 it generated a
            // "too much recursion" error.
            setTimeout(runIfPresent, 0, handle);
        } else {
            var task = tasksByHandle[handle];
            if (task) {
                currentlyRunningATask = true;
                try {
                    run(task);
                } finally {
                    clearImmediate(handle);
                    currentlyRunningATask = false;
                }
            }
        }
    }

    function installNextTickImplementation() {
        registerImmediate = function(handle) {
            process.nextTick(function () { runIfPresent(handle); });
        };
    }

    function canUsePostMessage() {
        // The test against `importScripts` prevents this implementation from being installed inside a web worker,
        // where `global.postMessage` means something completely different and can't be used for this purpose.
        if (global.postMessage && !global.importScripts) {
            var postMessageIsAsynchronous = true;
            var oldOnMessage = global.onmessage;
            global.onmessage = function() {
                postMessageIsAsynchronous = false;
            };
            global.postMessage("", "*");
            global.onmessage = oldOnMessage;
            return postMessageIsAsynchronous;
        }
    }

    function installPostMessageImplementation() {
        // Installs an event handler on `global` for the `message` event: see
        // * https://developer.mozilla.org/en/DOM/window.postMessage
        // * http://www.whatwg.org/specs/web-apps/current-work/multipage/comms.html#crossDocumentMessages

        var messagePrefix = "setImmediate$" + Math.random() + "$";
        var onGlobalMessage = function(event) {
            if (event.source === global &&
                typeof event.data === "string" &&
                event.data.indexOf(messagePrefix) === 0) {
                runIfPresent(+event.data.slice(messagePrefix.length));
            }
        };

        if (global.addEventListener) {
            global.addEventListener("message", onGlobalMessage, false);
        } else {
            global.attachEvent("onmessage", onGlobalMessage);
        }

        registerImmediate = function(handle) {
            global.postMessage(messagePrefix + handle, "*");
        };
    }

    function installMessageChannelImplementation() {
        var channel = new MessageChannel();
        channel.port1.onmessage = function(event) {
            var handle = event.data;
            runIfPresent(handle);
        };

        registerImmediate = function(handle) {
            channel.port2.postMessage(handle);
        };
    }

    function installReadyStateChangeImplementation() {
        var html = doc.documentElement;
        registerImmediate = function(handle) {
            // Create a <script> element; its readystatechange event will be fired asynchronously once it is inserted
            // into the document. Do so, thus queuing up the task. Remember to clean up once it's been called.
            var script = doc.createElement("script");
            script.onreadystatechange = function () {
                runIfPresent(handle);
                script.onreadystatechange = null;
                html.removeChild(script);
                script = null;
            };
            html.appendChild(script);
        };
    }

    function installSetTimeoutImplementation() {
        registerImmediate = function(handle) {
            setTimeout(runIfPresent, 0, handle);
        };
    }

    // If supported, we should attach to the prototype of global, since that is where setTimeout et al. live.
    var attachTo = Object.getPrototypeOf && Object.getPrototypeOf(global);
    attachTo = attachTo && attachTo.setTimeout ? attachTo : global;

    // Don't get fooled by e.g. browserify environments.
    if ({}.toString.call(global.process) === "[object process]") {
        // For Node.js before 0.9
        installNextTickImplementation();

    } else if (canUsePostMessage()) {
        // For non-IE10 modern browsers
        installPostMessageImplementation();

    } else if (global.MessageChannel) {
        // For web workers, where supported
        installMessageChannelImplementation();

    } else if (doc && "onreadystatechange" in doc.createElement("script")) {
        // For IE 6–8
        installReadyStateChangeImplementation();

    } else {
        // For older browsers
        installSetTimeoutImplementation();
    }

    attachTo.setImmediate = setImmediate;
    attachTo.clearImmediate = clearImmediate;
}(typeof self === "undefined" ? typeof global === "undefined" ? this : global : self));

/*! showdown 02-06-2017 */

(function(){function a(a){"use strict";var b={omitExtraWLInCodeBlocks:{defaultValue:!1,describe:"Omit the default extra whiteline added to code blocks",type:"boolean"},noHeaderId:{defaultValue:!1,describe:"Turn on/off generated header id",type:"boolean"},prefixHeaderId:{defaultValue:!1,describe:"Specify a prefix to generated header ids",type:"string"},ghCompatibleHeaderId:{defaultValue:!1,describe:"Generate header ids compatible with github style (spaces are replaced with dashes, a bunch of non alphanumeric chars are removed)",type:"boolean"},headerLevelStart:{defaultValue:!1,describe:"The header blocks level start",type:"integer"},parseImgDimensions:{defaultValue:!1,describe:"Turn on/off image dimension parsing",type:"boolean"},simplifiedAutoLink:{defaultValue:!1,describe:"Turn on/off GFM autolink style",type:"boolean"},excludeTrailingPunctuationFromURLs:{defaultValue:!1,describe:"Excludes trailing punctuation from links generated with autoLinking",type:"boolean"},literalMidWordUnderscores:{defaultValue:!1,describe:"Parse midword underscores as literal underscores",type:"boolean"},literalMidWordAsterisks:{defaultValue:!1,describe:"Parse midword asterisks as literal asterisks",type:"boolean"},strikethrough:{defaultValue:!1,describe:"Turn on/off strikethrough support",type:"boolean"},tables:{defaultValue:!1,describe:"Turn on/off tables support",type:"boolean"},tablesHeaderId:{defaultValue:!1,describe:"Add an id to table headers",type:"boolean"},ghCodeBlocks:{defaultValue:!0,describe:"Turn on/off GFM fenced code blocks support",type:"boolean"},tasklists:{defaultValue:!1,describe:"Turn on/off GFM tasklist support",type:"boolean"},smoothLivePreview:{defaultValue:!1,describe:"Prevents weird effects in live previews due to incomplete input",type:"boolean"},smartIndentationFix:{defaultValue:!1,description:"Tries to smartly fix indentation in es6 strings",type:"boolean"},disableForced4SpacesIndentedSublists:{defaultValue:!1,description:"Disables the requirement of indenting nested sublists by 4 spaces",type:"boolean"},simpleLineBreaks:{defaultValue:!1,description:"Parses simple line breaks as <br> (GFM Style)",type:"boolean"},requireSpaceBeforeHeadingText:{defaultValue:!1,description:"Makes adding a space between `#` and the header text mandatory (GFM Style)",type:"boolean"},ghMentions:{defaultValue:!1,description:"Enables github @mentions",type:"boolean"},ghMentionsLink:{defaultValue:"https://github.com/{u}",description:"Changes the link generated by @mentions. Only applies if ghMentions option is enabled.",type:"string"},encodeEmails:{defaultValue:!0,description:"Encode e-mail addresses through the use of Character Entities, transforming ASCII e-mail addresses into its equivalent decimal entities",type:"boolean"},openLinksInNewWindow:{defaultValue:!1,description:"Open all links in new windows",type:"boolean"}};if(!1===a)return JSON.parse(JSON.stringify(b));var c={};for(var d in b)b.hasOwnProperty(d)&&(c[d]=b[d].defaultValue);return c}function b(a,b){"use strict";var c=b?"Error in "+b+" extension->":"Error in unnamed extension",e={valid:!0,error:""};d.helper.isArray(a)||(a=[a]);for(var f=0;f<a.length;++f){var g=c+" sub-extension "+f+": ",h=a[f];if("object"!=typeof h)return e.valid=!1,e.error=g+"must be an object, but "+typeof h+" given",e;if(!d.helper.isString(h.type))return e.valid=!1,e.error=g+'property "type" must be a string, but '+typeof h.type+" given",e;var i=h.type=h.type.toLowerCase();if("language"===i&&(i=h.type="lang"),"html"===i&&(i=h.type="output"),"lang"!==i&&"output"!==i&&"listener"!==i)return e.valid=!1,e.error=g+"type "+i+' is not recognized. Valid values: "lang/language", "output/html" or "listener"',e;if("listener"===i){if(d.helper.isUndefined(h.listeners))return e.valid=!1,e.error=g+'. Extensions of type "listener" must have a property called "listeners"',e}else if(d.helper.isUndefined(h.filter)&&d.helper.isUndefined(h.regex))return e.valid=!1,e.error=g+i+' extensions must define either a "regex" property or a "filter" method',e;if(h.listeners){if("object"!=typeof h.listeners)return e.valid=!1,e.error=g+'"listeners" property must be an object but '+typeof h.listeners+" given",e;for(var j in h.listeners)if(h.listeners.hasOwnProperty(j)&&"function"!=typeof h.listeners[j])return e.valid=!1,e.error=g+'"listeners" property must be an hash of [event name]: [callback]. listeners.'+j+" must be a function but "+typeof h.listeners[j]+" given",e}if(h.filter){if("function"!=typeof h.filter)return e.valid=!1,e.error=g+'"filter" must be a function, but '+typeof h.filter+" given",e}else if(h.regex){if(d.helper.isString(h.regex)&&(h.regex=new RegExp(h.regex,"g")),!(h.regex instanceof RegExp))return e.valid=!1,e.error=g+'"regex" property must either be a string or a RegExp object, but '+typeof h.regex+" given",e;if(d.helper.isUndefined(h.replace))return e.valid=!1,e.error=g+'"regex" extensions must implement a replace string or function',e}}return e}function c(a,b){"use strict";return"¨E"+b.charCodeAt(0)+"E"}var d={},e={},f={},g=a(!0),h="vanilla",i={github:{omitExtraWLInCodeBlocks:!0,simplifiedAutoLink:!0,excludeTrailingPunctuationFromURLs:!0,literalMidWordUnderscores:!0,strikethrough:!0,tables:!0,tablesHeaderId:!0,ghCodeBlocks:!0,tasklists:!0,disableForced4SpacesIndentedSublists:!0,simpleLineBreaks:!0,requireSpaceBeforeHeadingText:!0,ghCompatibleHeaderId:!0,ghMentions:!0},original:{noHeaderId:!0,ghCodeBlocks:!1},ghost:{omitExtraWLInCodeBlocks:!0,parseImgDimensions:!0,simplifiedAutoLink:!0,excludeTrailingPunctuationFromURLs:!0,literalMidWordUnderscores:!0,strikethrough:!0,tables:!0,tablesHeaderId:!0,ghCodeBlocks:!0,tasklists:!0,smoothLivePreview:!0,simpleLineBreaks:!0,requireSpaceBeforeHeadingText:!0,ghMentions:!1,encodeEmails:!0},vanilla:a(!0),allOn:function(){"use strict";var b=a(!0),c={};for(var d in b)b.hasOwnProperty(d)&&(c[d]=!0);return c}()};d.helper={},d.extensions={},d.setOption=function(a,b){"use strict";return g[a]=b,this},d.getOption=function(a){"use strict";return g[a]},d.getOptions=function(){"use strict";return g},d.resetOptions=function(){"use strict";g=a(!0)},d.setFlavor=function(a){"use strict";if(!i.hasOwnProperty(a))throw Error(a+" flavor was not found");d.resetOptions();var b=i[a];h=a;for(var c in b)b.hasOwnProperty(c)&&(g[c]=b[c])},d.getFlavor=function(){"use strict";return h},d.getFlavorOptions=function(a){"use strict";if(i.hasOwnProperty(a))return i[a]},d.getDefaultOptions=function(b){"use strict";return a(b)},d.subParser=function(a,b){"use strict";if(d.helper.isString(a)){if(void 0===b){if(e.hasOwnProperty(a))return e[a];throw Error("SubParser named "+a+" not registered!")}e[a]=b}},d.extension=function(a,c){"use strict";if(!d.helper.isString(a))throw Error("Extension 'name' must be a string");if(a=d.helper.stdExtName(a),d.helper.isUndefined(c)){if(!f.hasOwnProperty(a))throw Error("Extension named "+a+" is not registered!");return f[a]}"function"==typeof c&&(c=c()),d.helper.isArray(c)||(c=[c]);var e=b(c,a);if(!e.valid)throw Error(e.error);f[a]=c},d.getAllExtensions=function(){"use strict";return f},d.removeExtension=function(a){"use strict";delete f[a]},d.resetExtensions=function(){"use strict";f={}},d.validateExtension=function(a){"use strict";var c=b(a,null);return!!c.valid||(console.warn(c.error),!1)},d.hasOwnProperty("helper")||(d.helper={}),d.helper.isString=function(a){"use strict";return"string"==typeof a||a instanceof String},d.helper.isFunction=function(a){"use strict";var b={};return a&&"[object Function]"===b.toString.call(a)},d.helper.isArray=function(a){"use strict";return a.constructor===Array},d.helper.isUndefined=function(a){"use strict";return void 0===a},d.helper.forEach=function(a,b){"use strict";if(d.helper.isUndefined(a))throw new Error("obj param is required");if(d.helper.isUndefined(b))throw new Error("callback param is required");if(!d.helper.isFunction(b))throw new Error("callback param must be a function/closure");if("function"==typeof a.forEach)a.forEach(b);else if(d.helper.isArray(a))for(var c=0;c<a.length;c++)b(a[c],c,a);else{if("object"!=typeof a)throw new Error("obj does not seem to be an array or an iterable object");for(var e in a)a.hasOwnProperty(e)&&b(a[e],e,a)}},d.helper.stdExtName=function(a){"use strict";return a.replace(/[_?*+\/\\.^-]/g,"").replace(/\s/g,"").toLowerCase()},d.helper.escapeCharactersCallback=c,d.helper.escapeCharacters=function(a,b,d){"use strict";var e="(["+b.replace(/([\[\]\\])/g,"\\$1")+"])";d&&(e="\\\\"+e);var f=new RegExp(e,"g");return a=a.replace(f,c)};var j=function(a,b,c,d){"use strict";var e,f,g,h,i,j=d||"",k=j.indexOf("g")>-1,l=new RegExp(b+"|"+c,"g"+j.replace(/g/g,"")),m=new RegExp(b,j.replace(/g/g,"")),n=[];do{for(e=0;g=l.exec(a);)if(m.test(g[0]))e++||(f=l.lastIndex,h=f-g[0].length);else if(e&&!--e){i=g.index+g[0].length;var o={left:{start:h,end:f},match:{start:f,end:g.index},right:{start:g.index,end:i},wholeMatch:{start:h,end:i}};if(n.push(o),!k)return n}}while(e&&(l.lastIndex=f));return n};d.helper.matchRecursiveRegExp=function(a,b,c,d){"use strict";for(var e=j(a,b,c,d),f=[],g=0;g<e.length;++g)f.push([a.slice(e[g].wholeMatch.start,e[g].wholeMatch.end),a.slice(e[g].match.start,e[g].match.end),a.slice(e[g].left.start,e[g].left.end),a.slice(e[g].right.start,e[g].right.end)]);return f},d.helper.replaceRecursiveRegExp=function(a,b,c,e,f){"use strict";if(!d.helper.isFunction(b)){var g=b;b=function(){return g}}var h=j(a,c,e,f),i=a,k=h.length;if(k>0){var l=[];0!==h[0].wholeMatch.start&&l.push(a.slice(0,h[0].wholeMatch.start));for(var m=0;m<k;++m)l.push(b(a.slice(h[m].wholeMatch.start,h[m].wholeMatch.end),a.slice(h[m].match.start,h[m].match.end),a.slice(h[m].left.start,h[m].left.end),a.slice(h[m].right.start,h[m].right.end))),m<k-1&&l.push(a.slice(h[m].wholeMatch.end,h[m+1].wholeMatch.start));h[k-1].wholeMatch.end<a.length&&l.push(a.slice(h[k-1].wholeMatch.end)),i=l.join("")}return i},d.helper.regexIndexOf=function(a,b,c){"use strict";if(!d.helper.isString(a))throw"InvalidArgumentError: first parameter of showdown.helper.regexIndexOf function must be a string";if(b instanceof RegExp==!1)throw"InvalidArgumentError: second parameter of showdown.helper.regexIndexOf function must be an instance of RegExp";var e=a.substring(c||0).search(b);return e>=0?e+(c||0):e},d.helper.splitAtIndex=function(a,b){"use strict";if(!d.helper.isString(a))throw"InvalidArgumentError: first parameter of showdown.helper.regexIndexOf function must be a string";return[a.substring(0,b),a.substring(b)]},d.helper.encodeEmailAddress=function(a){"use strict";var b=[function(a){return"&#"+a.charCodeAt(0)+";"},function(a){return"&#x"+a.charCodeAt(0).toString(16)+";"},function(a){return a}];return a=a.replace(/./g,function(a){if("@"===a)a=b[Math.floor(2*Math.random())](a);else{var c=Math.random();a=c>.9?b[2](a):c>.45?b[1](a):b[0](a)}return a})},"undefined"==typeof console&&(console={warn:function(a){"use strict";alert(a)},log:function(a){"use strict";alert(a)},error:function(a){"use strict";throw a}}),d.helper.regexes={asteriskAndDash:/([*_])/g},d.Converter=function(a){"use strict";function c(a,c){if(c=c||null,d.helper.isString(a)){if(a=d.helper.stdExtName(a),c=a,d.extensions[a])return console.warn("DEPRECATION WARNING: "+a+" is an old extension that uses a deprecated loading method.Please inform the developer that the extension should be updated!"),void e(d.extensions[a],a);if(d.helper.isUndefined(f[a]))throw Error('Extension "'+a+'" could not be loaded. It was either not found or is not a valid extension.');a=f[a]}"function"==typeof a&&(a=a()),d.helper.isArray(a)||(a=[a]);var g=b(a,c);if(!g.valid)throw Error(g.error);for(var h=0;h<a.length;++h){switch(a[h].type){case"lang":m.push(a[h]);break;case"output":n.push(a[h])}if(a[h].hasOwnProperty("listeners"))for(var i in a[h].listeners)a[h].listeners.hasOwnProperty(i)&&j(i,a[h].listeners[i])}}function e(a,c){"function"==typeof a&&(a=a(new d.Converter)),d.helper.isArray(a)||(a=[a]);var e=b(a,c);if(!e.valid)throw Error(e.error);for(var f=0;f<a.length;++f)switch(a[f].type){case"lang":m.push(a[f]);break;case"output":n.push(a[f]);break;default:throw Error("Extension loader error: Type unrecognized!!!")}}function j(a,b){if(!d.helper.isString(a))throw Error("Invalid argument in converter.listen() method: name must be a string, but "+typeof a+" given");if("function"!=typeof b)throw Error("Invalid argument in converter.listen() method: callback must be a function, but "+typeof b+" given");o.hasOwnProperty(a)||(o[a]=[]),o[a].push(b)}function k(a){var b=a.match(/^\s*/)[0].length,c=new RegExp("^\\s{0,"+b+"}","gm");return a.replace(c,"")}var l={},m=[],n=[],o={},p=h;!function(){a=a||{};for(var b in g)g.hasOwnProperty(b)&&(l[b]=g[b]);if("object"!=typeof a)throw Error("Converter expects the passed parameter to be an object, but "+typeof a+" was passed instead.");for(var e in a)a.hasOwnProperty(e)&&(l[e]=a[e]);l.extensions&&d.helper.forEach(l.extensions,c)}(),this._dispatch=function(a,b,c,d){if(o.hasOwnProperty(a))for(var e=0;e<o[a].length;++e){var f=o[a][e](a,b,this,c,d);f&&void 0!==f&&(b=f)}return b},this.listen=function(a,b){return j(a,b),this},this.makeHtml=function(a){if(!a)return a;var b={gHtmlBlocks:[],gHtmlMdBlocks:[],gHtmlSpans:[],gUrls:{},gTitles:{},gDimensions:{},gListLevel:0,hashLinkCounts:{},langExtensions:m,outputModifiers:n,converter:this,ghCodeBlocks:[]};return a=a.replace(/¨/g,"¨T"),a=a.replace(/\$/g,"¨D"),a=a.replace(/\r\n/g,"\n"),a=a.replace(/\r/g,"\n"),a=a.replace(/\u00A0/g," "),l.smartIndentationFix&&(a=k(a)),a="\n\n"+a+"\n\n",a=d.subParser("detab")(a,l,b),a=a.replace(/^[ \t]+$/gm,""),d.helper.forEach(m,function(c){a=d.subParser("runExtension")(c,a,l,b)}),a=d.subParser("hashPreCodeTags")(a,l,b),a=d.subParser("githubCodeBlocks")(a,l,b),a=d.subParser("hashHTMLBlocks")(a,l,b),a=d.subParser("hashCodeTags")(a,l,b),a=d.subParser("stripLinkDefinitions")(a,l,b),a=d.subParser("blockGamut")(a,l,b),a=d.subParser("unhashHTMLSpans")(a,l,b),a=d.subParser("unescapeSpecialChars")(a,l,b),a=a.replace(/¨D/g,"$$"),a=a.replace(/¨T/g,"¨"),d.helper.forEach(n,function(c){a=d.subParser("runExtension")(c,a,l,b)}),a},this.setOption=function(a,b){l[a]=b},this.getOption=function(a){return l[a]},this.getOptions=function(){return l},this.addExtension=function(a,b){b=b||null,c(a,b)},this.useExtension=function(a){c(a)},this.setFlavor=function(a){if(!i.hasOwnProperty(a))throw Error(a+" flavor was not found");var b=i[a];p=a;for(var c in b)b.hasOwnProperty(c)&&(l[c]=b[c])},this.getFlavor=function(){return p},this.removeExtension=function(a){d.helper.isArray(a)||(a=[a]);for(var b=0;b<a.length;++b){for(var c=a[b],e=0;e<m.length;++e)m[e]===c&&m[e].splice(e,1);for(;0<n.length;++e)n[0]===c&&n[0].splice(e,1)}},this.getAllExtensions=function(){return{language:m,output:n}}},d.subParser("anchors",function(a,b,c){"use strict";a=c.converter._dispatch("anchors.before",a,b,c);var e=function(a,e,f,g,h,i,j){if(d.helper.isUndefined(j)&&(j=""),f=f.toLowerCase(),a.search(/\(<?\s*>? ?(['"].*['"])?\)$/m)>-1)g="";else if(!g){if(f||(f=e.toLowerCase().replace(/ ?\n/g," ")),g="#"+f,d.helper.isUndefined(c.gUrls[f]))return a;g=c.gUrls[f],d.helper.isUndefined(c.gTitles[f])||(j=c.gTitles[f])}g=g.replace(d.helper.regexes.asteriskAndDash,d.helper.escapeCharactersCallback);var k='<a href="'+g+'"';return""!==j&&null!==j&&(j=j.replace(/"/g,"&quot;"),j=j.replace(d.helper.regexes.asteriskAndDash,d.helper.escapeCharactersCallback),k+=' title="'+j+'"'),b.openLinksInNewWindow&&(k+=' target="¨E95Eblank"'),k+=">"+e+"</a>"};return a=a.replace(/\[((?:\[[^\]]*]|[^\[\]])*)] ?(?:\n *)?\[(.*?)]()()()()/g,e),a=a.replace(/\[((?:\[[^\]]*]|[^\[\]])*)]()[ \t]*\([ \t]?<([^>]*)>(?:[ \t]*((["'])([^"]*?)\5))?[ \t]?\)/g,e),a=a.replace(/\[((?:\[[^\]]*]|[^\[\]])*)]()[ \t]*\([ \t]?<?([\S]+?(?:\([\S]*?\)[\S]*?)?)>?(?:[ \t]*((["'])([^"]*?)\5))?[ \t]?\)/g,e),a=a.replace(/\[([^\[\]]+)]()()()()()/g,e),b.ghMentions&&(a=a.replace(/(^|\s)(\\)?(@([a-z\d\-]+))(?=[.!?;,[\]()]|\s|$)/gim,function(a,c,e,f,g){if("\\"===e)return c+f;if(!d.helper.isString(b.ghMentionsLink))throw new Error("ghMentionsLink option must be a string");return c+'<a href="'+b.ghMentionsLink.replace(/\{u}/g,g)+'">'+f+"</a>"})),a=c.converter._dispatch("anchors.after",a,b,c)});var k=/\b(((https?|ftp|dict):\/\/|www\.)[^'">\s]+\.[^'">\s]+)()(?=\s|$)(?!["<>])/gi,l=/\b(((https?|ftp|dict):\/\/|www\.)[^'">\s]+\.[^'">\s]+?)([.!?,()\[\]]?)(?=\s|$)(?!["<>])/gi,m=/<(((https?|ftp|dict):\/\/|www\.)[^'">\s]+)()>/gi,n=/(^|\s)(?:mailto:)?([A-Za-z0-9!#$%&'*+-\/=?^_`{|}~.]+@[-a-z0-9]+(\.[-a-z0-9]+)*\.[a-z]+)(?=$|\s)/gim,o=/<()(?:mailto:)?([-.\w]+@[-a-z0-9]+(\.[-a-z0-9]+)*\.[a-z]+)>/gi,p=function(a){"use strict";return function(b,c,d,e,f){var g=c,h="",i="";return/^www\./i.test(c)&&(c=c.replace(/^www\./i,"http://www.")),a.excludeTrailingPunctuationFromURLs&&f&&(h=f),a.openLinksInNewWindow&&(i=' target="¨E95Eblank"'),'<a href="'+c+'"'+i+">"+g+"</a>"+h}},q=function(a,b){"use strict";return function(c,e,f){var g="mailto:";return e=e||"",f=d.subParser("unescapeSpecialChars")(f,a,b),a.encodeEmails?(g=d.helper.encodeEmailAddress(g+f),f=d.helper.encodeEmailAddress(f)):g+=f,e+'<a href="'+g+'">'+f+"</a>"}};d.subParser("autoLinks",function(a,b,c){"use strict";return a=c.converter._dispatch("autoLinks.before",a,b,c),a=a.replace(m,p(b)),a=a.replace(o,q(b,c)),a=c.converter._dispatch("autoLinks.after",a,b,c)}),d.subParser("simplifiedAutoLinks",function(a,b,c){"use strict";return b.simplifiedAutoLink?(a=c.converter._dispatch("simplifiedAutoLinks.before",a,b,c),a=b.excludeTrailingPunctuationFromURLs?a.replace(l,p(b)):a.replace(k,p(b)),a=a.replace(n,q(b,c)),a=c.converter._dispatch("simplifiedAutoLinks.after",a,b,c)):a}),d.subParser("blockGamut",function(a,b,c){"use strict";return a=c.converter._dispatch("blockGamut.before",a,b,c),a=d.subParser("blockQuotes")(a,b,c),a=d.subParser("headers")(a,b,c),a=d.subParser("horizontalRule")(a,b,c),a=d.subParser("lists")(a,b,c),a=d.subParser("codeBlocks")(a,b,c),a=d.subParser("tables")(a,b,c),a=d.subParser("hashHTMLBlocks")(a,b,c),a=d.subParser("paragraphs")(a,b,c),a=c.converter._dispatch("blockGamut.after",a,b,c)}),d.subParser("blockQuotes",function(a,b,c){"use strict";return a=c.converter._dispatch("blockQuotes.before",a,b,c),a=a.replace(/((^ {0,3}>[ \t]?.+\n(.+\n)*\n*)+)/gm,function(a,e){var f=e;return f=f.replace(/^[ \t]*>[ \t]?/gm,"¨0"),f=f.replace(/¨0/g,""),f=f.replace(/^[ \t]+$/gm,""),f=d.subParser("githubCodeBlocks")(f,b,c),f=d.subParser("blockGamut")(f,b,c),f=f.replace(/(^|\n)/g,"$1  "),f=f.replace(/(\s*<pre>[^\r]+?<\/pre>)/gm,function(a,b){var c=b;return c=c.replace(/^  /gm,"¨0"),c=c.replace(/¨0/g,"")}),d.subParser("hashBlock")("<blockquote>\n"+f+"\n</blockquote>",b,c)}),a=c.converter._dispatch("blockQuotes.after",a,b,c)}),d.subParser("codeBlocks",function(a,b,c){"use strict";a=c.converter._dispatch("codeBlocks.before",a,b,c),a+="¨0";var e=/(?:\n\n|^)((?:(?:[ ]{4}|\t).*\n+)+)(\n*[ ]{0,3}[^ \t\n]|(?=¨0))/g;return a=a.replace(e,function(a,e,f){var g=e,h=f,i="\n";return g=d.subParser("outdent")(g,b,c),g=d.subParser("encodeCode")(g,b,c),g=d.subParser("detab")(g,b,c),g=g.replace(/^\n+/g,""),g=g.replace(/\n+$/g,""),b.omitExtraWLInCodeBlocks&&(i=""),g="<pre><code>"+g+i+"</code></pre>",d.subParser("hashBlock")(g,b,c)+h}),a=a.replace(/¨0/,""),a=c.converter._dispatch("codeBlocks.after",a,b,c)}),d.subParser("codeSpans",function(a,b,c){"use strict";return a=c.converter._dispatch("codeSpans.before",a,b,c),void 0===a&&(a=""),a=a.replace(/(^|[^\\])(`+)([^\r]*?[^`])\2(?!`)/gm,function(a,e,f,g){var h=g;return h=h.replace(/^([ \t]*)/g,""),h=h.replace(/[ \t]*$/g,""),h=d.subParser("encodeCode")(h,b,c),e+"<code>"+h+"</code>"}),a=c.converter._dispatch("codeSpans.after",a,b,c)}),d.subParser("detab",function(a,b,c){"use strict";return a=c.converter._dispatch("detab.before",a,b,c),a=a.replace(/\t(?=\t)/g,"    "),a=a.replace(/\t/g,"¨A¨B"),a=a.replace(/¨B(.+?)¨A/g,function(a,b){for(var c=b,d=4-c.length%4,e=0;e<d;e++)c+=" ";return c}),a=a.replace(/¨A/g,"    "),a=a.replace(/¨B/g,""),a=c.converter._dispatch("detab.after",a,b,c)}),d.subParser("encodeAmpsAndAngles",function(a,b,c){"use strict";return a=c.converter._dispatch("encodeAmpsAndAngles.before",a,b,c),a=a.replace(/&(?!#?[xX]?(?:[0-9a-fA-F]+|\w+);)/g,"&amp;"),a=a.replace(/<(?![a-z\/?$!])/gi,"&lt;"),a=a.replace(/</g,"&lt;"),a=a.replace(/>/g,"&gt;"),a=c.converter._dispatch("encodeAmpsAndAngles.after",a,b,c)}),d.subParser("encodeBackslashEscapes",function(a,b,c){"use strict";return a=c.converter._dispatch("encodeBackslashEscapes.before",a,b,c),a=a.replace(/\\(\\)/g,d.helper.escapeCharactersCallback),a=a.replace(/\\([`*_{}\[\]()>#+.!~=|-])/g,d.helper.escapeCharactersCallback),a=c.converter._dispatch("encodeBackslashEscapes.after",a,b,c)}),d.subParser("encodeCode",function(a,b,c){"use strict";return a=c.converter._dispatch("encodeCode.before",a,b,c),a=a.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/([*_{}\[\]\\=~-])/g,d.helper.escapeCharactersCallback),a=c.converter._dispatch("encodeCode.after",a,b,c)}),d.subParser("escapeSpecialCharsWithinTagAttributes",function(a,b,c){"use strict";a=c.converter._dispatch("escapeSpecialCharsWithinTagAttributes.before",a,b,c);var e=/(<[a-z\/!$]("[^"]*"|'[^']*'|[^'">])*>|<!(--.*?--\s*)+>)/gi;return a=a.replace(e,function(a){return a.replace(/(.)<\/?code>(?=.)/g,"$1`").replace(/([\\`*_~=|])/g,d.helper.escapeCharactersCallback)}),a=c.converter._dispatch("escapeSpecialCharsWithinTagAttributes.after",a,b,c)}),d.subParser("githubCodeBlocks",function(a,b,c){"use strict";return b.ghCodeBlocks?(a=c.converter._dispatch("githubCodeBlocks.before",a,b,c),a+="¨0",a=a.replace(/(?:^|\n)```(.*)\n([\s\S]*?)\n```/g,function(a,e,f){var g=b.omitExtraWLInCodeBlocks?"":"\n";return f=d.subParser("encodeCode")(f,b,c),f=d.subParser("detab")(f,b,c),f=f.replace(/^\n+/g,""),f=f.replace(/\n+$/g,""),f="<pre><code"+(e?' class="'+e+" language-"+e+'"':"")+">"+f+g+"</code></pre>",f=d.subParser("hashBlock")(f,b,c),"\n\n¨G"+(c.ghCodeBlocks.push({text:a,codeblock:f})-1)+"G\n\n"}),a=a.replace(/¨0/,""),c.converter._dispatch("githubCodeBlocks.after",a,b,c)):a}),d.subParser("hashBlock",function(a,b,c){"use strict";return a=c.converter._dispatch("hashBlock.before",a,b,c),a=a.replace(/(^\n+|\n+$)/g,""),a="\n\n¨K"+(c.gHtmlBlocks.push(a)-1)+"K\n\n",a=c.converter._dispatch("hashBlock.after",a,b,c)}),d.subParser("hashCodeTags",function(a,b,c){"use strict";a=c.converter._dispatch("hashCodeTags.before",a,b,c);var e=function(a,e,f,g){var h=f+d.subParser("encodeCode")(e,b,c)+g;return"¨C"+(c.gHtmlSpans.push(h)-1)+"C"};return a=d.helper.replaceRecursiveRegExp(a,e,"<code\\b[^>]*>","</code>","gim"),a=c.converter._dispatch("hashCodeTags.after",a,b,c)}),d.subParser("hashElement",function(a,b,c){"use strict";return function(a,b){var d=b;return d=d.replace(/\n\n/g,"\n"),d=d.replace(/^\n/,""),d=d.replace(/\n+$/g,""),d="\n\n¨K"+(c.gHtmlBlocks.push(d)-1)+"K\n\n"}}),d.subParser("hashHTMLBlocks",function(a,b,c){"use strict";a=c.converter._dispatch("hashHTMLBlocks.before",a,b,c);for(var e=["pre","div","h1","h2","h3","h4","h5","h6","blockquote","table","dl","ol","ul","script","noscript","form","fieldset","iframe","math","style","section","header","footer","nav","article","aside","address","audio","canvas","figure","hgroup","output","video","p"],f=function(a,b,d,e){var f=a;return-1!==d.search(/\bmarkdown\b/)&&(f=d+c.converter.makeHtml(b)+e),"\n\n¨K"+(c.gHtmlBlocks.push(f)-1)+"K\n\n"},g=0;g<e.length;++g)for(var h,i=new RegExp("^ {0,3}<"+e[g]+"\\b[^>]*>","im"),j="<"+e[g]+"\\b[^>]*>",k="</"+e[g]+">";-1!==(h=d.helper.regexIndexOf(a,i));){var l=d.helper.splitAtIndex(a,h),m=d.helper.replaceRecursiveRegExp(l[1],f,j,k,"im");if(m===l[1])break;a=l[0].concat(m)}return a=a.replace(/(\n {0,3}(<(hr)\b([^<>])*?\/?>)[ \t]*(?=\n{2,}))/g,d.subParser("hashElement")(a,b,c)),a=d.helper.replaceRecursiveRegExp(a,function(a){return"\n\n¨K"+(c.gHtmlBlocks.push(a)-1)+"K\n\n"},"^ {0,3}\x3c!--","--\x3e","gm"),a=a.replace(/(?:\n\n)( {0,3}(?:<([?%])[^\r]*?\2>)[ \t]*(?=\n{2,}))/g,d.subParser("hashElement")(a,b,c)),a=c.converter._dispatch("hashHTMLBlocks.after",a,b,c)}),d.subParser("hashHTMLSpans",function(a,b,c){"use strict";function d(a){return"¨C"+(c.gHtmlSpans.push(a)-1)+"C"}return a=c.converter._dispatch("hashHTMLSpans.before",a,b,c),a=a.replace(/<[^>]+?\/>/gi,function(a){return d(a)}),a=a.replace(/<([^>]+?)>[\s\S]*?<\/\1>/g,function(a){return d(a)}),a=a.replace(/<([^>]+?)\s[^>]+?>[\s\S]*?<\/\1>/g,function(a){return d(a)}),a=a.replace(/<[^>]+?>/gi,function(a){return d(a)}),a=c.converter._dispatch("hashHTMLSpans.after",a,b,c)}),d.subParser("unhashHTMLSpans",function(a,b,c){"use strict";a=c.converter._dispatch("unhashHTMLSpans.before",a,b,c);for(var d=0;d<c.gHtmlSpans.length;++d){for(var e=c.gHtmlSpans[d],f=0;/¨C(\d+)C/.test(e);){var g=RegExp.$1;if(e=e.replace("¨C"+g+"C",c.gHtmlSpans[g]),10===f)break;++f}a=a.replace("¨C"+d+"C",e)}return a=c.converter._dispatch("unhashHTMLSpans.after",a,b,c)}),d.subParser("hashPreCodeTags",function(a,b,c){"use strict";a=c.converter._dispatch("hashPreCodeTags.before",a,b,c);var e=function(a,e,f,g){var h=f+d.subParser("encodeCode")(e,b,c)+g;return"\n\n¨G"+(c.ghCodeBlocks.push({text:a,codeblock:h})-1)+"G\n\n"};return a=d.helper.replaceRecursiveRegExp(a,e,"^ {0,3}<pre\\b[^>]*>\\s*<code\\b[^>]*>","^ {0,3}</code>\\s*</pre>","gim"),a=c.converter._dispatch("hashPreCodeTags.after",a,b,c)}),d.subParser("headers",function(a,b,c){"use strict";function e(a){var e;if(b.customizedHeaderId){var f=a.match(/\{([^{]+?)}\s*$/);f&&f[1]&&(a=f[1])}return e=d.helper.isString(b.prefixHeaderId)?b.prefixHeaderId+a:!0===b.prefixHeaderId?"section "+a:a,e=g?e.replace(/ /g,"-").replace(/&amp;/g,"").replace(/¨T/g,"").replace(/¨D/g,"").replace(/[&+$,\/:;=?@"#{}|^¨~\[\]`\\*)(%.!'<>]/g,"").toLowerCase():e.replace(/[^\w]/g,"").toLowerCase(),c.hashLinkCounts[e]?e=e+"-"+c.hashLinkCounts[e]++:c.hashLinkCounts[e]=1,e}a=c.converter._dispatch("headers.before",a,b,c);var f=isNaN(parseInt(b.headerLevelStart))?1:parseInt(b.headerLevelStart),g=b.ghCompatibleHeaderId,h=b.smoothLivePreview?/^(.+)[ \t]*\n={2,}[ \t]*\n+/gm:/^(.+)[ \t]*\n=+[ \t]*\n+/gm,i=b.smoothLivePreview?/^(.+)[ \t]*\n-{2,}[ \t]*\n+/gm:/^(.+)[ \t]*\n-+[ \t]*\n+/gm;a=a.replace(h,function(a,g){var h=d.subParser("spanGamut")(g,b,c),i=b.noHeaderId?"":' id="'+e(g)+'"',j=f,k="<h"+j+i+">"+h+"</h"+j+">";return d.subParser("hashBlock")(k,b,c)}),a=a.replace(i,function(a,g){var h=d.subParser("spanGamut")(g,b,c),i=b.noHeaderId?"":' id="'+e(g)+'"',j=f+1,k="<h"+j+i+">"+h+"</h"+j+">";return d.subParser("hashBlock")(k,b,c)});var j=b.requireSpaceBeforeHeadingText?/^(#{1,6})[ \t]+(.+?)[ \t]*#*\n+/gm:/^(#{1,6})[ \t]*(.+?)[ \t]*#*\n+/gm;return a=a.replace(j,function(a,g,h){var i=h;b.customizedHeaderId&&(i=h.replace(/\s?\{([^{]+?)}\s*$/,""));var j=d.subParser("spanGamut")(i,b,c),k=b.noHeaderId?"":' id="'+e(h)+'"',l=f-1+g.length,m="<h"+l+k+">"+j+"</h"+l+">";return d.subParser("hashBlock")(m,b,c)}),a=c.converter._dispatch("headers.after",a,b,c)}),d.subParser("horizontalRule",function(a,b,c){"use strict";a=c.converter._dispatch("horizontalRule.before",a,b,c);var e=d.subParser("hashBlock")("<hr />",b,c);return a=a.replace(/^ {0,2}( ?-){3,}[ \t]*$/gm,e),a=a.replace(/^ {0,2}( ?\*){3,}[ \t]*$/gm,e),a=a.replace(/^ {0,2}( ?_){3,}[ \t]*$/gm,e),a=c.converter._dispatch("horizontalRule.after",a,b,c)}),d.subParser("images",function(a,b,c){"use strict";function e(a,b,e,f,g,h,i,j){var k=c.gUrls,l=c.gTitles,m=c.gDimensions;if(e=e.toLowerCase(),j||(j=""),a.search(/\(<?\s*>? ?(['"].*['"])?\)$/m)>-1)f="";else if(""===f||null===f){if(""!==e&&null!==e||(e=b.toLowerCase().replace(/ ?\n/g," ")),f="#"+e,d.helper.isUndefined(k[e]))return a;f=k[e],d.helper.isUndefined(l[e])||(j=l[e]),d.helper.isUndefined(m[e])||(g=m[e].width,h=m[e].height)}b=b.replace(/"/g,"&quot;").replace(d.helper.regexes.asteriskAndDash,d.helper.escapeCharactersCallback),f=f.replace(d.helper.regexes.asteriskAndDash,d.helper.escapeCharactersCallback);var n='<img src="'+f+'" alt="'+b+'"';return j&&(j=j.replace(/"/g,"&quot;").replace(d.helper.regexes.asteriskAndDash,d.helper.escapeCharactersCallback),n+=' title="'+j+'"'),g&&h&&(g="*"===g?"auto":g,h="*"===h?"auto":h,n+=' width="'+g+'"',n+=' height="'+h+'"'),n+=" />"}a=c.converter._dispatch("images.before",a,b,c);var f=/!\[([^\]]*?)][ \t]*()\([ \t]?<?([\S]+?(?:\([\S]*?\)[\S]*?)?)>?(?: =([*\d]+[A-Za-z%]{0,4})x([*\d]+[A-Za-z%]{0,4}))?[ \t]*(?:(["'])([^"]*?)\6)?[ \t]?\)/g,g=/!\[([^\]]*?)][ \t]*()\([ \t]?<([^>]*)>(?: =([*\d]+[A-Za-z%]{0,4})x([*\d]+[A-Za-z%]{0,4}))?[ \t]*(?:(?:(["'])([^"]*?)\6))?[ \t]?\)/g,h=/!\[([^\]]*?)] ?(?:\n *)?\[(.*?)]()()()()()/g,i=/!\[([^\[\]]+)]()()()()()/g;return a=a.replace(h,e),a=a.replace(g,e),a=a.replace(f,e),a=a.replace(i,e),a=c.converter._dispatch("images.after",a,b,c)}),d.subParser("italicsAndBold",function(a,b,c){"use strict";function e(a,e,f){return b.simplifiedAutoLink&&(a=d.subParser("simplifiedAutoLinks")(a,b,c)),e+a+f}return a=c.converter._dispatch("italicsAndBold.before",a,b,c),b.literalMidWordUnderscores?(a=a.replace(/\b___(\S[\s\S]*)___\b/g,function(a,b){return e(b,"<strong><em>","</em></strong>")}),a=a.replace(/\b__(\S[\s\S]*)__\b/g,function(a,b){return e(b,"<strong>","</strong>")}),a=a.replace(/\b_(\S[\s\S]*?)_\b/g,function(a,b){return e(b,"<em>","</em>")})):(a=a.replace(/___(\S[\s\S]*?)___/g,function(a,b){return/\S$/.test(b)?e(b,"<strong><em>","</em></strong>"):a}),a=a.replace(/__(\S[\s\S]*?)__/g,function(a,b){return/\S$/.test(b)?e(b,"<strong>","</strong>"):a}),a=a.replace(/_([^\s_][\s\S]*?)_/g,function(a,b){return/\S$/.test(b)?e(b,"<em>","</em>"):a})),b.literalMidWordAsterisks?(a=a.trim().replace(/(?:^| +)\*{3}(\S[\s\S]*?)\*{3}(?: +|$)/g,function(a,b){return e(b," <strong><em>","</em></strong> ")}),a=a.trim().replace(/(?:^| +)\*{2}(\S[\s\S]*?)\*{2}(?: +|$)/g,function(a,b){return e(b," <strong>","</strong> ")}),a=a.trim().replace(/(?:^| +)\*{1}(\S[\s\S]*?)\*{1}(?: +|$)/g,function(a,b){return e(b," <em>","</em>"+(" "===a.slice(-1)?" ":""))})):(a=a.replace(/\*\*\*(\S[\s\S]*?)\*\*\*/g,function(a,b){return/\S$/.test(b)?e(b,"<strong><em>","</em></strong>"):a}),a=a.replace(/\*\*(\S[\s\S]*?)\*\*/g,function(a,b){return/\S$/.test(b)?e(b,"<strong>","</strong>"):a}),a=a.replace(/\*([^\s*][\s\S]*?)\*/g,function(a,b){return/\S$/.test(b)?e(b,"<em>","</em>"):a})),a=c.converter._dispatch("italicsAndBold.after",a,b,c)}),d.subParser("lists",function(a,b,c){"use strict";function e(a,e){c.gListLevel++,a=a.replace(/\n{2,}$/,"\n"),a+="¨0";var f=/(\n)?(^ {0,3})([*+-]|\d+[.])[ \t]+((\[(x|X| )?])?[ \t]*[^\r]+?(\n{1,2}))(?=\n*(¨0| {0,3}([*+-]|\d+[.])[ \t]+))/gm,g=/\n[ \t]*\n(?!¨0)/.test(a);return b.disableForced4SpacesIndentedSublists&&(f=/(\n)?(^ {0,3})([*+-]|\d+[.])[ \t]+((\[(x|X| )?])?[ \t]*[^\r]+?(\n{1,2}))(?=\n*(¨0|\2([*+-]|\d+[.])[ \t]+))/gm),a=a.replace(f,function(a,e,f,h,i,j,k){k=k&&""!==k.trim();var l=d.subParser("outdent")(i,b,c),m="";return j&&b.tasklists&&(m=' class="task-list-item" style="list-style-type: none;"',l=l.replace(/^[ \t]*\[(x|X| )?]/m,function(){var a='<input type="checkbox" disabled style="margin: 0px 0.35em 0.25em -1.6em; vertical-align: middle;"';return k&&(a+=" checked"),a+=">"})),l=l.replace(/^([-*+]|\d\.)[ \t]+[\S\n ]*/g,function(a){return"¨A"+a}),e||l.search(/\n{2,}/)>-1?(l=d.subParser("githubCodeBlocks")(l,b,c),l=d.subParser("blockGamut")(l,b,c)):(l=d.subParser("lists")(l,b,c),l=l.replace(/\n$/,""),l=d.subParser("hashHTMLBlocks")(l,b,c),l=l.replace(/\n\n+/g,"\n\n"),l=l.replace(/\n\n/g,"¨B"),l=g?d.subParser("paragraphs")(l,b,c):d.subParser("spanGamut")(l,b,c),l=l.replace(/¨B/g,"\n\n")),l=l.replace("¨A",""),l="<li"+m+">"+l+"</li>\n"}),a=a.replace(/¨0/g,""),c.gListLevel--,e&&(a=a.replace(/\s+$/,"")),a}function f(a,c,d){var f=b.disableForced4SpacesIndentedSublists?/^ ?\d+\.[ \t]/gm:/^ {0,3}\d+\.[ \t]/gm,g=b.disableForced4SpacesIndentedSublists?/^ ?[*+-][ \t]/gm:/^ {0,3}[*+-][ \t]/gm,h="ul"===c?f:g,i="";return-1!==a.search(h)?function a(b){var j=b.search(h);-1!==j?(i+="\n<"+c+">\n"+e(b.slice(0,j),!!d)+"</"+c+">\n",c="ul"===c?"ol":"ul",h="ul"===c?f:g,a(b.slice(j))):i+="\n<"+c+">\n"+e(b,!!d)+"</"+c+">\n"}(a):i="\n<"+c+">\n"+e(a,!!d)+"</"+c+">\n",i}
return a=c.converter._dispatch("lists.before",a,b,c),a+="¨0",a=c.gListLevel?a.replace(/^(( {0,3}([*+-]|\d+[.])[ \t]+)[^\r]+?(¨0|\n{2,}(?=\S)(?![ \t]*(?:[*+-]|\d+[.])[ \t]+)))/gm,function(a,b,c){return f(b,c.search(/[*+-]/g)>-1?"ul":"ol",!0)}):a.replace(/(\n\n|^\n?)(( {0,3}([*+-]|\d+[.])[ \t]+)[^\r]+?(¨0|\n{2,}(?=\S)(?![ \t]*(?:[*+-]|\d+[.])[ \t]+)))/gm,function(a,b,c,d){return f(c,d.search(/[*+-]/g)>-1?"ul":"ol",!1)}),a=a.replace(/¨0/,""),a=c.converter._dispatch("lists.after",a,b,c)}),d.subParser("outdent",function(a,b,c){"use strict";return a=c.converter._dispatch("outdent.before",a,b,c),a=a.replace(/^(\t|[ ]{1,4})/gm,"¨0"),a=a.replace(/¨0/g,""),a=c.converter._dispatch("outdent.after",a,b,c)}),d.subParser("paragraphs",function(a,b,c){"use strict";a=c.converter._dispatch("paragraphs.before",a,b,c),a=a.replace(/^\n+/g,""),a=a.replace(/\n+$/g,"");for(var e=a.split(/\n{2,}/g),f=[],g=e.length,h=0;h<g;h++){var i=e[h];i.search(/¨(K|G)(\d+)\1/g)>=0?f.push(i):i.search(/\S/)>=0&&(i=d.subParser("spanGamut")(i,b,c),i=i.replace(/^([ \t]*)/g,"<p>"),i+="</p>",f.push(i))}for(g=f.length,h=0;h<g;h++){for(var j="",k=f[h],l=!1;/¨(K|G)(\d+)\1/.test(k);){var m=RegExp.$1,n=RegExp.$2;j="K"===m?c.gHtmlBlocks[n]:l?d.subParser("encodeCode")(c.ghCodeBlocks[n].text,b,c):c.ghCodeBlocks[n].codeblock,j=j.replace(/\$/g,"$$$$"),k=k.replace(/(\n\n)?¨(K|G)\d+\2(\n\n)?/,j),/^<pre\b[^>]*>\s*<code\b[^>]*>/.test(k)&&(l=!0)}f[h]=k}return a=f.join("\n"),a=a.replace(/^\n+/g,""),a=a.replace(/\n+$/g,""),c.converter._dispatch("paragraphs.after",a,b,c)}),d.subParser("runExtension",function(a,b,c,d){"use strict";if(a.filter)b=a.filter(b,d.converter,c);else if(a.regex){var e=a.regex;e instanceof RegExp||(e=new RegExp(e,"g")),b=b.replace(e,a.replace)}return b}),d.subParser("spanGamut",function(a,b,c){"use strict";return a=c.converter._dispatch("spanGamut.before",a,b,c),a=d.subParser("codeSpans")(a,b,c),a=d.subParser("escapeSpecialCharsWithinTagAttributes")(a,b,c),a=d.subParser("encodeBackslashEscapes")(a,b,c),a=d.subParser("images")(a,b,c),a=d.subParser("anchors")(a,b,c),a=d.subParser("autoLinks")(a,b,c),a=d.subParser("italicsAndBold")(a,b,c),a=d.subParser("strikethrough")(a,b,c),a=d.subParser("simplifiedAutoLinks")(a,b,c),a=d.subParser("hashHTMLSpans")(a,b,c),a=d.subParser("encodeAmpsAndAngles")(a,b,c),a=b.simpleLineBreaks?a.replace(/\n/g,"<br />\n"):a.replace(/  +\n/g,"<br />\n"),a=c.converter._dispatch("spanGamut.after",a,b,c)}),d.subParser("strikethrough",function(a,b,c){"use strict";function e(a){return b.simplifiedAutoLink&&(a=d.subParser("simplifiedAutoLinks")(a,b,c)),"<del>"+a+"</del>"}return b.strikethrough&&(a=c.converter._dispatch("strikethrough.before",a,b,c),a=a.replace(/(?:~){2}([\s\S]+?)(?:~){2}/g,function(a,b){return e(b)}),a=c.converter._dispatch("strikethrough.after",a,b,c)),a}),d.subParser("stripLinkDefinitions",function(a,b,c){"use strict";var e=/^ {0,3}\[(.+)]:[ \t]*\n?[ \t]*<?([^>\s]+)>?(?: =([*\d]+[A-Za-z%]{0,4})x([*\d]+[A-Za-z%]{0,4}))?[ \t]*\n?[ \t]*(?:(\n*)["|'(](.+?)["|')][ \t]*)?(?:\n+|(?=¨0))/gm;return a+="¨0",a=a.replace(e,function(a,e,f,g,h,i,j){return e=e.toLowerCase(),c.gUrls[e]=d.subParser("encodeAmpsAndAngles")(f,b,c),i?i+j:(j&&(c.gTitles[e]=j.replace(/"|'/g,"&quot;")),b.parseImgDimensions&&g&&h&&(c.gDimensions[e]={width:g,height:h}),"")}),a=a.replace(/¨0/,"")}),d.subParser("tables",function(a,b,c){"use strict";function e(a){return/^:[ \t]*--*$/.test(a)?' style="text-align:left;"':/^--*[ \t]*:[ \t]*$/.test(a)?' style="text-align:right;"':/^:[ \t]*--*[ \t]*:$/.test(a)?' style="text-align:center;"':""}function f(a,e){var f="";return a=a.trim(),b.tableHeaderId&&(f=' id="'+a.replace(/ /g,"_").toLowerCase()+'"'),a=d.subParser("spanGamut")(a,b,c),"<th"+f+e+">"+a+"</th>\n"}function g(a,e){return"<td"+e+">"+d.subParser("spanGamut")(a,b,c)+"</td>\n"}function h(a,b){for(var c="<table>\n<thead>\n<tr>\n",d=a.length,e=0;e<d;++e)c+=a[e];for(c+="</tr>\n</thead>\n<tbody>\n",e=0;e<b.length;++e){c+="<tr>\n";for(var f=0;f<d;++f)c+=b[e][f];c+="</tr>\n"}return c+="</tbody>\n</table>\n"}if(!b.tables)return a;var i=/^ {0,3}\|?.+\|.+\n[ \t]{0,3}\|?[ \t]*:?[ \t]*(?:-|=){2,}[ \t]*:?[ \t]*\|[ \t]*:?[ \t]*(?:-|=){2,}[\s\S]+?(?:\n\n|¨0)/gm;return a=c.converter._dispatch("tables.before",a,b,c),a=a.replace(/\\(\|)/g,d.helper.escapeCharactersCallback),a=a.replace(i,function(a){var b,c=a.split("\n");for(b=0;b<c.length;++b)/^ {0,3}\|/.test(c[b])&&(c[b]=c[b].replace(/^ {0,3}\|/,"")),/\|[ \t]*$/.test(c[b])&&(c[b]=c[b].replace(/\|[ \t]*$/,""));var i=c[0].split("|").map(function(a){return a.trim()}),j=c[1].split("|").map(function(a){return a.trim()}),k=[],l=[],m=[],n=[];for(c.shift(),c.shift(),b=0;b<c.length;++b)""!==c[b].trim()&&k.push(c[b].split("|").map(function(a){return a.trim()}));if(i.length<j.length)return a;for(b=0;b<j.length;++b)m.push(e(j[b]));for(b=0;b<i.length;++b)d.helper.isUndefined(m[b])&&(m[b]=""),l.push(f(i[b],m[b]));for(b=0;b<k.length;++b){for(var o=[],p=0;p<l.length;++p)d.helper.isUndefined(k[b][p]),o.push(g(k[b][p],m[p]));n.push(o)}return h(l,n)}),a=c.converter._dispatch("tables.after",a,b,c)}),d.subParser("unescapeSpecialChars",function(a,b,c){"use strict";return a=c.converter._dispatch("unescapeSpecialChars.before",a,b,c),a=a.replace(/¨E(\d+)E/g,function(a,b){var c=parseInt(b);return String.fromCharCode(c)}),a=c.converter._dispatch("unescapeSpecialChars.after",a,b,c)});var r=this;"undefined"!=typeof module&&module.exports?module.exports=d:"function"==typeof define&&define.amd?define(function(){"use strict";return d}):r.showdown=d}).call(this);
//# sourceMappingURL=showdown.min.js.map
