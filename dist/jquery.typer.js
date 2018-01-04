/*!
 * jQuery Typer Plugin v0.10.7
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

(function ($, window, document, String, Node, Range, DocumentFragment, WeakMap, array, RegExp) {
    'use strict';

    var KEYNAMES = JSON.parse('{"8":"backspace","9":"tab","13":"enter","16":"shift","17":"ctrl","18":"alt","19":"pause","20":"capsLock","27":"escape","32":"space","33":"pageUp","34":"pageDown","35":"end","36":"home","37":"leftArrow","38":"upArrow","39":"rightArrow","40":"downArrow","45":"insert","46":"delete","48":"0","49":"1","50":"2","51":"3","52":"4","53":"5","54":"6","55":"7","56":"8","57":"9","65":"a","66":"b","67":"c","68":"d","69":"e","70":"f","71":"g","72":"h","73":"i","74":"j","75":"k","76":"l","77":"m","78":"n","79":"o","80":"p","81":"q","82":"r","83":"s","84":"t","85":"u","86":"v","87":"w","88":"x","89":"y","90":"z","91":"leftWindow","92":"rightWindowKey","93":"select","96":"numpad0","97":"numpad1","98":"numpad2","99":"numpad3","100":"numpad4","101":"numpad5","102":"numpad6","103":"numpad7","104":"numpad8","105":"numpad9","106":"multiply","107":"add","109":"subtract","110":"decimalPoint","111":"divide","112":"f1","113":"f2","114":"f3","115":"f4","116":"f5","117":"f6","118":"f7","119":"f8","120":"f9","121":"f10","122":"f11","123":"f12","144":"numLock","145":"scrollLock","186":"semiColon","187":"equalSign","188":"comma","189":"dash","190":"period","191":"forwardSlash","192":"backtick","219":"openBracket","220":"backSlash","221":"closeBracket","222":"singleQuote"}');
    var VOID_TAGS = 'area base br col command embed hr img input keygen link meta param source track wbr'.split(' ');
    var INNER_PTAG = 'h1,h2,h3,h4,h5,h6,p,q,blockquote,pre,code,li,caption,figcaption,summary,dt,th';
    var SOURCE_PRIORITY = 'script keystroke textInput mouse touch cut paste'.split(' ');
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
    var NODE_SHOW_HIDDEN = 8192;
    var NODE_ANY_BLOCK_EDITABLE = NODE_EDITABLE | NODE_EDITABLE_PARAGRAPH;
    var NODE_ANY_BLOCK = NODE_WIDGET | NODE_PARAGRAPH | NODE_ANY_BLOCK_EDITABLE;
    var NODE_ANY_INLINE = NODE_INLINE | NODE_INLINE_WIDGET | NODE_INLINE_EDITABLE;
    var NODE_ANY_ALLOWTEXT = NODE_PARAGRAPH | NODE_EDITABLE_PARAGRAPH | NODE_INLINE | NODE_INLINE_EDITABLE;
    var NODE_ALL_VISIBLE = -1 & ~NODE_SHOW_HIDDEN;
    var EVENT_ALL = 1;
    var EVENT_STATIC = 2;
    var EVENT_HANDLER = 3;
    var EVENT_CURRENT = 4;
    var IS_IE = !!window.ActiveXObject || document.documentElement.style.msTouchAction !== undefined || document.documentElement.style.msUserSelect !== undefined;

    // document.caretRangeFromPoint is still broken even in Edge browser
    // it does not return correct range for the points x or y larger than window's width or height
    var caretRangeFromPoint_ = IS_IE ? undefined : document.caretRangeFromPoint;
    var compareDocumentPosition_ = document.compareDocumentPosition;
    var compareBoundaryPoints_ = Range.prototype.compareBoundaryPoints;

    var isFunction = $.isFunction;
    var extend = $.extend;
    var selection = window.getSelection();
    var clipboard = {};
    var userFocus;
    var caretNotification;
    var windowFocusedOut;
    var permitFocusEvent;
    var supportTextInputEvent;
    var currentSource = [];
    var lastTouchedElement;

    function TyperSelection(typer, range) {
        var self = this;
        self.typer = typer;
        self.baseCaret = new TyperCaret(typer, self);
        self.extendCaret = new TyperCaret(typer, self);
        if (range) {
            self.select(range);
        }
    }

    function TyperWidget(typer, id, element, options) {
        var self = this;
        self.typer = typer;
        self.id = id;
        self.element = element || null;
        self.options = options || {};
    }

    function TyperEvent(eventName, typer, widget, data, props) {
        var self = extend(this, props);
        self.eventName = eventName;
        self.source = currentSource[currentSource.length - 1][1];
        self.timestamp = +new Date();
        self.typer = typer;
        self.widget = widget || null;
        self.data = data !== undefined ? data : null;
    }

    function TyperNode(nodeType, element, widget) {
        var self = this;
        self.childNodes = [];
        self.nodeType = nodeType;
        self.element = element;
        self.widget = widget;
    }

    function TyperTreeWalker(root, whatToShow, filter) {
        var self = this;
        self.whatToShow = whatToShow;
        self.filter = filter || null;
        self.currentNode = root;
        self.root = root;
    }

    function TyperDOMNodeIterator(root, whatToShow, filter) {
        var self = this;
        self.whatToShow = whatToShow;
        self.filter = filter || null;
        nodeIteratorInit(self, is(root, TyperTreeWalker) || new TyperTreeWalker(root, NODE_WIDGET | NODE_ANY_ALLOWTEXT));
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

    function eventSource(typer, source, callback, args, thisArg) {
        var len = currentSource.length;
        var cur = currentSource[len - 1] || (currentSource.push([typer, source || 'script']), currentSource[len]);
        if (cur[0] && typer && cur[0] !== typer) {
            currentSource.push([typer, 'script']);
        } else if (cur === currentSource[0] && SOURCE_PRIORITY.indexOf(source) > SOURCE_PRIORITY.indexOf(cur[1])) {
            cur[1] = source;
        }
        try {
            return (callback || $.noop).apply(thisArg || null, args);
        } finally {
            if (!len) {
                cur[0] = null;
                setImmediate(function () {
                    currentSource.splice(len);
                });
            } else {
                currentSource.splice(len);
            }
        }
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
        node = node || iterator.currentNode;
        if (!node || !(iterator.whatToShow & (is(iterator, TyperTreeWalker) ? node.nodeType : (1 << (node.nodeType - 1))))) {
            return 3;
        }
        return !iterator.filter ? 1 : (iterator.filter.acceptNode || iterator.filter).call(iterator.filter, node);
    }

    function iterate(iterator, callback, from, until) {
        iterator.currentNode = from = from || iterator.currentNode;
        callback = callback || $.noop;
        switch (acceptNode(iterator)) {
            case 2:
                return;
            case 1:
                callback(from);
        }
        for (var cur; (cur = iterator.nextNode()) && (!until || (isFunction(until) ? until(cur) : cur !== until || void callback(cur))); callback(cur));
    }

    function iterateToArray(iterator, callback, from, until) {
        var result = [];
        iterate(iterator, array.push.bind(result), from, until);
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

    function isElm(v) {
        return v && v.nodeType === 1 && v;
    }

    function isText(v) {
        return v && v.nodeType === 3 && v;
    }

    function isTextNodeEnd(v, offset, dir) {
        var str = v.data;
        return (dir >= 0 && (offset === v.length || str.slice(offset) === ZWSP)) ? 1 : (dir <= 0 && (!offset || str.slice(0, offset) === ZWSP)) ? -1 : 0;
    }

    function closest(node, type) {
        for (; node.parentNode && !is(node, type); node = node.parentNode);
        return node;
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
        var iterator = new TyperDOMNodeIterator(new TyperTreeWalker(node, NODE_ANY_ALLOWTEXT | NODE_SHOW_EDITABLE), 5);
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
        var zeroLength = target.collapsed && isText(target.startContainer) && !target.startContainer.length;
        if (zeroLength) {
            // no rects are returned for zero-length text node
            // return rects as if there was content
            target.startContainer.data = ZWSP;
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
                target.startContainer.data = '';
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

    function createNodeIterator(root, whatToShow) {
        return document.createNodeIterator(root, whatToShow, null, false);
    }

    function removeNode(node, silent) {
        if (silent !== false) {
            iterate(createNodeIterator(node, 1), function (v) {
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
        try {
            selection.addRange(range);
        } catch (e) {
            // IE may throws unspecified error even though the selection is successfully moved to the given range
            // if the range is not successfully selected retry after selecting other range
            if (!selection.rangeCount) {
                selection.addRange(createRange(document.body));
                selection.removeAllRanges();
                selection.addRange(range);
            }
        }
    }

    function fixIEInputEvent(element, topElement) {
        // IE fires input and text-input event on the innermost element where the caret positions at
        // the event does not bubble up so need to trigger manually on the top element
        // also IE use all lowercase letter in the event name
        $(element).bind('input textinput', function (e) {
            e.stopPropagation();
            if (e.type === 'textinput' || topElement) {
                var event = document.createEvent('Event');
                event.initEvent(e.type === 'input' ? 'input' : 'textInput', true, false);
                event.data = e.data;
                (topElement || element).dispatchEvent(event);
            }
        });
    }

    function Typer(topElement, options) {
        if (!is(topElement, Node)) {
            options = topElement;
            topElement = topElement.element;
        }
        options = extend(true, {}, (!options || options.defaultOptions !== false) && Typer.defaultOptions, options);

        var typer = this;
        var topNodeType = options.inline || is(topElement, INNER_PTAG) ? NODE_EDITABLE_PARAGRAPH : NODE_EDITABLE;
        var widgets = [];
        var widgetOptions = {};
        var relatedElements = new WeakMap();
        var tracker = new TyperChangeTracker(typer);
        var undoable = {};
        var currentSelection;
        var typerFocused = false;
        var $self = $(topElement);

        var codeUpdate = (function () {
            var run = transaction(function () {
                var source = currentSource[currentSource.length - 1][1];
                codeUpdate.executing = false;
                if (codeUpdate.needSnapshot || tracker.changes[0]) {
                    undoable.snapshot();
                }
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
            return function (source, callback, args, thisArg) {
                // IE fires textinput event on the parent element when the text node's value is modified
                // even if modification is done through JavaScript rather than user action
                codeUpdate.suppressTextEvent = true;
                codeUpdate.executing = true;
                return eventSource(typer, source, run, [callback, args, thisArg]);
            };
        }());

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
                setImmediate(function () {
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
                    $.each(widgetOptions, function (i, v) {
                        if (is(node.element, v.element)) {
                            node.widget = new TyperWidget(nodeSource, i, node.element, v.options);
                            if (fireEvent && node.widget.id !== WIDGET_UNKNOWN) {
                                triggerEvent(null, node.widget, 'init');
                            }
                            return false;
                        }
                    });
                }
                if (node.widget && node.widget.destroyed) {
                    delete node.widget;
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
                var $children = (childOnly ? $(element).children() : $(element).children().find('*').andSelf()).not('br');
                $children.each(function (i, v) {
                    while (!containsOrEquals(stack[0].element, v)) {
                        stack.shift();
                    }
                    var unvisited = !nodeMap.has(v);
                    var node = nodeMap.get(v) || new TyperNode(0, v);
                    addChild(stack[0], node);
                    updateNodeFromElement(node);
                    updateNode(node);
                    nodeMap.set(v, node);
                    if (childOnly && unvisited) {
                        visitElement(v);
                        if (IS_IE) {
                            fixIEInputEvent(v, topElement);
                        }
                    }
                    stack.unshift(node);
                });
            }

            function handleMutations(mutations) {
                var changedElements = $.map(mutations, function (v) {
                    return (v.addedNodes[0] || v.removedNodes[0]) && tagName(v.target) !== 'br' ? v.target : null;
                });
                array.push.apply(dirtyElements, changedElements);
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
                if (isText(element) || tagName(element) === 'br') {
                    element = element.parentNode || element;
                }
                if (containsOrEquals(rootElement, element)) {
                    for (var root = element; !nodeMap.has(root); root = root.parentNode);
                    if (root !== element) {
                        visitElement(root);
                    }
                    return nodeMap.get(element);
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

            return extend(self, {
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
            if (is(node, NODE_EDITABLE) && !node.firstChild) {
                $(node.element).html('<p>' + (trim(node.element.textContent) || ZWSP_ENTITIY) + '</p>');
                return true;
            }
            if (is(node, NODE_EDITABLE_PARAGRAPH) && !node.element.firstChild) {
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
                    var element = node.element;
                    if (is(node, NODE_EDITABLE)) {
                        $(element).contents().each(function (i, v) {
                            if (v.parentNode === element) {
                                var contents = [];
                                for (; v && (isText(v) || tagName(v) === 'br' || is(typer.getNode(v), NODE_ANY_INLINE)); v = v.nextSibling) {
                                    if (contents.length || isElm(v) || trim(v.data)) {
                                        contents.push(v);
                                    }
                                }
                                if (contents.length) {
                                    $(contents).wrap('<p>');
                                }
                            }
                        });
                        return;
                    }
                    if (is(node, NODE_PARAGRAPH | NODE_EDITABLE_PARAGRAPH)) {
                        // WebKit adds dangling <BR> element when a line is empty
                        // normalize it into a ZWSP and continue process
                        var lastBr = $('>br:last-child', element)[0];
                        if (lastBr && !lastBr.nextSibling) {
                            $(createTextNode()).insertBefore(lastBr);
                            removeNode(lastBr);
                        }
                        var firstBr = $('>br:first-child', element)[0];
                        if (firstBr && !firstBr.previousSibling) {
                            removeNode(firstBr);
                        }
                    }
                    if (is(node, NODE_ANY_ALLOWTEXT)) {
                        $('>br', element).each(function (i, v) {
                            if (!isText(v.nextSibling)) {
                                $(createTextNode()).insertAfter(v);
                            }
                        });
                        $(element).contents().each(function (i, v) {
                            if (isText(v) && !textNodeFreezed(v)) {
                                var nextNode = v.nextSibling;
                                if (/\b\u00a0$/.test(v.data) && isText(nextNode) && !/^[^\S\u00a0]/.test(nextNode.data)) {
                                    // prevent unintended non-breaking space (&nbsp;) between word boundaries when inserting contents
                                    v.data = v.data.slice(0, -1) + ' ';
                                }
                                v.data = v.data.replace(/(?=.)\u200b+(?=.)/g, '').replace(/\b\u00a0\b/g, ' ') || ZWSP;
                                if (isText(nextNode) && !textNodeFreezed(nextNode)) {
                                    nextNode.data = v.data + nextNode.data;
                                    removeNode(v);
                                }
                            }
                        });
                        if (is(node, NODE_INLINE) && element !== currentSelection.startElement && element !== currentSelection.endElement) {
                            if (tagName(element.previousSibling) === tagName(element) && compareAttrs(element, element.previousSibling)) {
                                $(element).contents().appendTo(element.previousSibling);
                                removeNode(element);
                            }
                        }
                    }
                });
                // Mozilla adds <br type="_moz"> when a container is empty
                $('br[type="_moz"]', topElement).remove();
            });
        }

        function extractContents(range, mode, callback) {
            var dir = is(range, TyperSelection) ? range.direction : 1;
            range = is(range, Range) || createRange(range);

            var method = mode === 'cut' ? 'extractContents' : mode === 'paste' ? 'deleteContents' : 'cloneContents';
            var cloneNode = mode !== 'paste';
            var clearNode = mode !== 'copy';
            var fragment = document.createDocumentFragment();
            var state = new TyperSelection(typer, range);
            var allowTextFlow = state.isSingleEditable || ((state.startNode.widget.id === WIDGET_ROOT || widgetOptions[state.startNode.widget.id].textFlow) && (state.endNode.widget.id === WIDGET_ROOT || widgetOptions[state.endNode.widget.id].textFlow));

            codeUpdate(null, function () {
                if (!range.collapsed) {
                    var stack = [[topElement, fragment]];
                    iterate(state.createTreeWalker(NODE_ALL_VISIBLE, function (node) {
                        var element = node.element;
                        var content;
                        // skip focused editable element because all selected content is within the editable element
                        if (node === state.focusNode && is(node, NODE_EDITABLE)) {
                            return 3;
                        }
                        while (is(element, Node) && !containsOrEquals(stack[0][0], element)) {
                            stack.shift();
                        }
                        if (rangeCovers(range, element)) {
                            if (cloneNode) {
                                content = element.cloneNode(true);
                                $(stack[0][1]).append(element === topElement ? content.childNodes : content);
                            }
                            if (clearNode) {
                                if (is(node, NODE_EDITABLE)) {
                                    $(element).html(EMPTY_LINE);
                                    tracker.track(node);
                                } else if (is(node, NODE_EDITABLE_PARAGRAPH)) {
                                    $(element).html(ZWSP_ENTITIY);
                                    tracker.track(node);
                                } else {
                                    removeNode(element);
                                }
                            }
                            return 2;
                        }
                        if (is(node, NODE_ANY_ALLOWTEXT)) {
                            content = createRange(element, range)[method]();
                        }
                        if (cloneNode) {
                            if (element !== topElement && (!is(node, NODE_PARAGRAPH | NODE_INLINE) || (content && tagName(content.firstChild) !== tagName(element)))) {
                                var clonedNode = element.cloneNode(false);
                                stack[0][1].appendChild(clonedNode);
                                if (!is(clonedNode, DocumentFragment)) {
                                    stack.unshift([element, clonedNode]);
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
                    var startPoint = createRange(range, allowTextFlow ? true : dir > 0);
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
            content = is(content, Node) || $.parseHTML(String(content || '').replace(/\u000d/g, '').replace(/</g, '&lt;').replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>').replace(/.*/, '<p>$&</p>'));
            content = slice(createDocumentFragment(content).childNodes);

            extractContents(range, 'paste', function (state, startPoint) {
                var allowedWidgets = ('__root__ ' + (widgetOptions[state.focusNode.widget.id].allowedWidgets || '*')).split(' ');
                var caretPoint = startPoint.cloneRange();
                var forcedInline = is(state.startNode, NODE_EDITABLE_PARAGRAPH);
                var insertAsInline = is(state.startNode, NODE_ANY_ALLOWTEXT);
                var paragraphAsInline = true;
                var hasInsertedBlock;
                var formattingNodes = [];

                var cur = typer.getNode(state.startElement);
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

                content.forEach(function (nodeToInsert) {
                    var cur = typer.getEditableNode(caretPoint.startContainer);
                    var node = new TyperNode(NODE_INLINE, nodeToInsert);
                    var isLineBreak = tagName(nodeToInsert) === 'br';

                    if (isElm(nodeToInsert) && !isLineBreak) {
                        startPoint.insertNode(nodeToInsert);
                        node = typer.getNode(nodeToInsert);
                        removeNode(nodeToInsert);
                        if (node.widget.id === WIDGET_UNKNOWN || (is(cur, NODE_EDITABLE_PARAGRAPH) && !widgetOptions[node.widget.id].inline) || (allowedWidgets[1] !== '*' && allowedWidgets.indexOf(node.widget.id) < 0)) {
                            nodeToInsert = createTextNode(node.widget.id === WIDGET_UNKNOWN ? nodeToInsert.textContent : extractText(nodeToInsert));
                            node = new TyperNode(NODE_INLINE, nodeToInsert);
                        }
                    }
                    if ((isLineBreak && !is(cur, NODE_PARAGRAPH | NODE_EDITABLE_PARAGRAPH)) || !is(node, NODE_ANY_ALLOWTEXT | NODE_ANY_INLINE) || (!is(node, NODE_ANY_INLINE) && !paragraphAsInline)) {
                        var splitLastNode = cur;
                        while (!is(splitLastNode.parentNode, isLineBreak ? NODE_PARAGRAPH : NODE_ANY_BLOCK_EDITABLE)) {
                            splitLastNode = splitLastNode.parentNode;
                        }
                        var splitEnd = createRange(splitLastNode.element, false);
                        var splitContent = createRange(caretPoint, splitEnd).extractContents();
                        if (!splitContent.firstChild) {
                            // avoid unindented empty elements when splitting at end of line
                            splitContent = createDocumentFragment(wrapNode(createTextNode(), formattingNodes));
                        }
                        var splitFirstNode = splitContent.firstChild;
                        splitEnd.insertNode(splitContent);
                        tracker.track(splitEnd.startContainer);

                        for (var cur1 = typer.getNode(splitFirstNode); cur1 && !/\S/.test(cur1.element.textContent); cur1 = cur1.firstChild) {
                            if (is(cur1, NODE_INLINE_WIDGET | NODE_INLINE_EDITABLE)) {
                                // avoid empty inline widget at the start of inserted line
                                if (cur1.element.firstChild) {
                                    $(cur1.element).contents().unwrap();
                                } else {
                                    $(cur1.element).remove();
                                }
                                break;
                            }
                        }
                        if (is(splitLastNode, NODE_ANY_ALLOWTEXT) && !splitLastNode.element.firstChild) {
                            $(createTextNode()).appendTo(splitLastNode.element);
                        }
                        if (splitLastNode.element.textContent.slice(-1) === ' ') {
                            var n1 = iterateToArray(createNodeIterator(splitLastNode.element, 4)).filter(mapFn('data')).slice(-1)[0];
                            n1.data = n1.data.slice(0, -1) + '\u00a0';
                        }
                        if (splitFirstNode.textContent.charAt(0) === ' ') {
                            var n2 = iterateToArray(createNodeIterator(splitFirstNode, 4)).filter(mapFn('data'))[0];
                            n2.data = n2.data.slice(1);
                        }
                        if (isLineBreak) {
                            caretPoint = createRange(splitEnd, true);
                        } else {
                            for (var w = new TyperTreeWalker(typer.getNode(splitFirstNode), NODE_ANY_ALLOWTEXT); w.firstChild(););
                            caretPoint = createRange(w.currentNode.element, 0);
                            paragraphAsInline = true;
                            hasInsertedBlock = true;
                        }
                    }
                    insertAsInline = insertAsInline && is(node, NODE_ANY_ALLOWTEXT | NODE_ANY_INLINE);
                    if (!isLineBreak) {
                        if (is(node, NODE_ANY_INLINE) && !insertAsInline) {
                            nodeToInsert = wrapNode(nodeToInsert, formattingNodes);
                        } else if (!is(node, NODE_ANY_INLINE) && insertAsInline && paragraphAsInline) {
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
                        var caretNode = typer.getEditableNode(caretPoint.startContainer);
                        if (is(caretNode, NODE_ANY_BLOCK_EDITABLE)) {
                            caretPoint.insertNode(nodeToInsert);
                        } else {
                            createRange(caretNode.element, true).insertNode(nodeToInsert);
                        }
                        insertAsInline = forcedInline || is(node, NODE_ANY_ALLOWTEXT | NODE_ANY_INLINE);
                        caretPoint = insertAsInline ? createRange(lastNode, -0) : createRange(lastNode, false);
                        paragraphAsInline = forcedInline || !insertAsInline;
                        hasInsertedBlock = true;
                    }
                    tracker.track(caretPoint.startContainer);
                });
                if (!hasInsertedBlock && state.startNode !== state.endNode && is(state.startNode, NODE_PARAGRAPH) && is(state.endNode, NODE_PARAGRAPH)) {
                    if (caretPoint) {
                        var caretNode = closest(typer.getNode(caretPoint.startContainer), -1 & ~NODE_ANY_INLINE);
                        caretPoint = createRange(caretNode.element, -0);
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
            var range = createRange(content || topElement);
            var lastNode, lastWidget;
            var text = '';
            var iterator = new TyperDOMNodeIterator(new TyperSelection(typer, range).createTreeWalker(NODE_ALL_VISIBLE), 5, function (v) {
                return rangeIntersects(range, createRange(v, 'contents')) ? 1 : 2;
            });
            iterate(iterator, function (v) {
                var node = typer.getNode(v);
                var widgetOption = widgetOptions[node.widget.id];
                if (node !== lastNode) {
                    if (is(lastNode, NODE_ANY_BLOCK) && is(node, NODE_ANY_BLOCK) && text.slice(-2) !== '\n\n') {
                        text += '\n\n';
                    }
                    if (node.widget !== lastWidget && isFunction(widgetOption.text)) {
                        text += widgetOption.text(node.widget);
                    }
                    lastNode = node;
                    lastWidget = node.widget;
                }
                if (is(node, NODE_ANY_ALLOWTEXT) && !isFunction(widgetOption.text)) {
                    if (isText(v)) {
                        var value = v.data;
                        if (v === range.endContainer) {
                            value = value.slice(0, range.endOffset);
                        }
                        if (v === range.startContainer) {
                            value = value.slice(range.startOffset);
                        }
                        text += value;
                    } else if (tagName(v) === 'br') {
                        text += '\n';
                    }
                }
            });
            return trim(text).replace(/\u200b/g, '').replace(/[^\S\n\u00a0]+|\u00a0/g, ' ');
        }

        function initUndoable() {
            var MARKER_ATTR = ['x-typer-end', 'x-typer-start'];
            var lastValue = trim(topElement.innerHTML);
            var snapshots = [];
            var currentIndex = 0;
            var snapshotTimeout;

            function triggerStateChange() {
                setImmediate(function () {
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
                if (isText(node)) {
                    $(node.parentNode).attr(MARKER_ATTR[+start], getWholeTextOffset(typer.getNode(node), node) + offset);
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

            extend(undoable, {
                getValue: function () {
                    if (codeUpdate.needSnapshot) {
                        codeUpdate.needSnapshot = false;
                        takeSnapshot();
                    }
                    return lastValue;
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
                    clearImmediate(snapshotTimeout);
                    if (+delay === delay || !currentSelection) {
                        snapshotTimeout = setImmediate(takeSnapshot, delay);
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
            var touchObj;
            var activeWidget;

            function getEventName(e, suffix) {
                return lowfirst(((e.ctrlKey || e.metaKey) ? 'Ctrl' : '') + (e.altKey ? 'Alt' : '') + (e.shiftKey ? 'Shift' : '') + capfirst(suffix));
            }

            function triggerWidgetFocusout(source) {
                var widget = activeWidget;
                if (activeWidget && !activeWidget.destroyed) {
                    activeWidget = null;
                    triggerEvent(source, widget, 'focusout');
                }
            }

            function triggerClick(source, e, point) {
                var props = {
                    clientX: (point || e).clientX,
                    clientY: (point || e).clientY,
                    target: e.target
                };
                triggerEvent(source, EVENT_HANDLER, getEventName(e, 'click'), null, props);
            }

            function ensureFocused(source) {
                eventSource(typer, source, currentSelection.focus, null, currentSelection);
            }

            function updateFromNativeInput() {
                var activeRange = getActiveRange(topElement);
                if (!userFocus.has(typer) && activeRange && !rangeEquals(activeRange, createRange(currentSelection))) {
                    currentSelection.select(activeRange);
                    if (currentSelection.focusNode.widget !== activeWidget) {
                        triggerWidgetFocusout('textInput');
                    }
                    var timeStamp = +new Date();
                    setImmediate(function () {
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
                            ensureFocused('mouse');
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
                    ensureFocused('mouse');
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
                    if (!keyDefaultPrevented) {
                        codeUpdate.suppressTextEvent = false;
                    }
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
                    clipboard.textContent = extractText(currentSelection);
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
                var node = typer.getNode(e.target);
                if (activeWidget !== node.widget) {
                    triggerWidgetFocusout('mouse');
                }
                if (is(node, NODE_WIDGET | NODE_INLINE_WIDGET)) {
                    // disable resize handle on image element on IE and Firefox
                    // also select the whole widget when clicking on uneditable elements
                    setImmediate(function () {
                        ensureFocused('mouse');
                    });
                    currentSelection.select(node.widget.element);
                    if (activeWidget !== node.widget) {
                        activeWidget = node.widget;
                        triggerEvent('mouse', node.widget, 'focusin');
                    }
                }
            });

            $self.bind('touchstart touchmove touchend', function (e) {
                if (e.type === 'touchend' && touchObj) {
                    currentSelection.moveToPoint(touchObj.clientX, touchObj.clientY);
                    ensureFocused('touch');
                    triggerClick('touch', e, touchObj);
                    e.preventDefault();
                }
                var touches = e.originalEvent.touches;
                touchObj = e.type === 'touchstart' && !touches[1] && touches[0];
            });

            $self.bind('contextmenu', function (e) {
                var range = caretRangeFromPoint(e.clientX, e.clientY, topElement);
                if (currentSelection.isCaret || !rangeIntersects(currentSelection, range)) {
                    currentSelection.select(range);
                }
            });

            $self.bind('click', function (e) {
                triggerClick('mouse', e);
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
            fixIEInputEvent(topElement);
        }

        function activateWidget(name, settings) {
            if (options[name] || (options.widgets || '')[name]) {
                widgetOptions[name] = Object.create(settings);
                widgetOptions[name].options = extend(Object.create(settings.options || null), options[name]);
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

        function retainFocusHandler(e) {
            var relatedTarget = e.relatedTarget || lastTouchedElement;
            if (!containsOrEquals(e.currentTarget, relatedTarget)) {
                if (userFocus.get(typer) === e.currentTarget) {
                    userFocus.delete(typer);
                }
                if (topElement === relatedTarget) {
                    currentSelection.focus();
                } else {
                    $self.trigger($.Event('focusout', {
                        relatedTarget: e.relatedTarget
                    }));
                }
            }
        }

        initUndoable();
        initWidgets();
        normalizeInputEvent();
        $self.attr('contenteditable', 'true');

        extend(typer, undoable, createTyperDocument(topElement, true), {
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
            getWidgetOption: function (id, name) {
                return widgetOptions[id] && widgetOptions[id][name];
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
                return extractText(selection);
            },
            nodeFromPoint: function (x, y) {
                var range = caretRangeFromPoint(x, y, topElement);
                return range && typer.getNode(range.commonAncestorContainer);
            },
            retainFocus: function (element) {
                if (!relatedElements.has(element)) {
                    relatedElements.set(element, true);
                    $(element).bind('focusout', retainFocusHandler);
                }
            },
            releaseFocus: function (element) {
                relatedElements.delete(element);
                $(element).unbind('focusout', retainFocusHandler);
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
                tracker.track(element.parentNode);
                removeNode(element);
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

    extend(Typer, {
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
        return node && ((inst.whatToShow & NODE_SHOW_EDITABLE) || !is(node, NODE_WIDGET | NODE_ANY_BLOCK_EDITABLE)) && ((inst.whatToShow & NODE_SHOW_HIDDEN) || is(node.element, ':visible')) && node;
    }

    function treeWalkerAcceptNode(inst, node, checkWidget) {
        if (checkWidget && node !== inst.root && !treeWalkerIsNodeVisible(inst, node)) {
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
                node = treeWalkerIsNodeVisible(inst, node.parentNode);
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
            node = treeWalkerIsNodeVisible(inst, node.parentNode);
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
            var self = this;
            for (var node = self.currentNode; node && node !== self.root;) {
                for (var sibling = node.previousSibling; sibling; sibling = node.previousSibling) {
                    node = sibling;
                    var rv = treeWalkerAcceptNode(self, sibling);
                    while (rv !== 2 && treeWalkerIsNodeVisible(self, node.firstChild)) {
                        node = node.lastChild;
                        rv = treeWalkerAcceptNode(self, node, true);
                    }
                    if (rv === 1) {
                        self.currentNode = node;
                        return node;
                    }
                }
                node = treeWalkerIsNodeVisible(self, node.parentNode);
                if (!node || node === self.root) {
                    return null;
                }
                if (treeWalkerNodeAccepted(self, node, true)) {
                    return node;
                }
            }
        },
        nextNode: function () {
            var self = this;
            var rv = 1;
            for (var node = self.currentNode; node;) {
                while (rv !== 2 && node.firstChild) {
                    node = node.firstChild;
                    if (treeWalkerNodeAccepted(self, node, true)) {
                        return node;
                    }
                    rv = treeWalkerAcceptNode.returnValue;
                }
                while (node && node !== self.root && !node.nextSibling) {
                    node = treeWalkerIsNodeVisible(self, node.parentNode);
                }
                if (!node || node === self.root) {
                    return null;
                }
                node = node.nextSibling;
                if (treeWalkerNodeAccepted(self, node, true)) {
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

    function selectionCreateTreeWalker(inst, whatToShow, filter) {
        var range = createRange(inst);
        return new TyperTreeWalker(inst.focusNode, whatToShow | NODE_SHOW_EDITABLE, function (v) {
            return !rangeIntersects(v.element, range) ? 2 : !filter ? 1 : filter(v);
        });
    }

    function selectionSplitText(inst) {
        var p1 = inst.getCaret('start');
        var p2 = inst.getCaret('end');
        var sameNode = (p1.textNode === p2.textNode);
        if (p2.textNode && !isTextNodeEnd(p2.textNode, p2.offset, 1)) {
            p2.textNode.splitText(p2.offset);
        }
        if (p1.textNode && !isTextNodeEnd(p1.textNode, p1.offset, -1)) {
            var offset = p1.offset;
            selectionAtomic(inst, function () {
                if (offset === p1.textNode.length) {
                    var iterator = caretTextNodeIterator(p1);
                    if (iterator.nextNode()) {
                        caretSetPosition(p1, iterator.currentNode, 0);
                    } else {
                        caretSetPosition(p1, p1.element, false);
                    }
                } else {
                    caretSetPositionRaw(p1, p1.node, p1.element, p1.textNode.splitText(p1.offset), 0);
                }
                if (sameNode) {
                    caretSetPositionRaw(p2, p2.node, p2.element, p1.textNode, p2.offset - offset);
                }
            });
        }
    }

    function selectionUpdate(inst) {
        inst.direction = compareRangePosition(inst.extendCaret.getRange(), inst.baseCaret.getRange()) || 0;
        inst.isCaret = !inst.direction;
        for (var i = 0, p1 = inst.getCaret('start'), p2 = inst.getCaret('end'); i < 4; i++) {
            inst[selectionUpdate.NAMES[i + 4]] = p1[selectionUpdate.NAMES[i]];
            inst[selectionUpdate.NAMES[i + 8]] = p2[selectionUpdate.NAMES[i]];
        }
    }
    selectionUpdate.NAMES = 'node element textNode offset startNode startElement startTextNode startOffset endNode endElement endTextNode endOffset'.split(' ');

    function selectionAtomic(inst, callback, args, thisArg) {
        inst._lock = inst._lock || transaction(function () {
            delete inst._lock;
            selectionUpdate(inst);
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
            return this.isCaret || !selectionCreateTreeWalker(this, NODE_ANY_BLOCK_EDITABLE).nextNode();
        },
        get focusNode() {
            var node = this.typer.getEditableNode(getCommonAncestor(this.baseCaret.element, this.extendCaret.element));
            return closest(node, NODE_WIDGET | NODE_INLINE_WIDGET | NODE_ANY_BLOCK_EDITABLE | NODE_INLINE_EDITABLE);
        },
        getCaret: function (point) {
            var b = this.baseCaret;
            var e = this.extendCaret;
            switch (point) {
                case 'extend':
                    return e;
                case 'start':
                    return this.direction < 0 ? e : b;
                case 'end':
                    return this.direction < 0 ? b : e;
                default:
                    return b;
            }
        },
        getRange: function (collapse) {
            var b = this.baseCaret;
            var e = this.extendCaret;
            if (collapse !== undefined || this.isCaret) {
                return (collapse !== false ? b : e).getRange();
            }
            return createRange(b.getRange(), e.getRange());
        },
        getEditableRanges: function () {
            var self = this;
            var range = createRange(self);
            if (self.isCaret || is(self.focusNode, NODE_ANY_INLINE)) {
                return [range];
            }
            var ranges = iterateToArray(selectionCreateTreeWalker(self, NODE_PARAGRAPH | NODE_EDITABLE_PARAGRAPH), function (v) {
                return createRange(range, createRange(v.element));
            });
            return $.grep(ranges, function (v, i) {
                return !i || !any(ranges.slice(0, i), function (w) {
                    return rangeCovers(w, v);
                });
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
            var self = this;
            if (self.startNode === self.endNode) {
                return is(self.startNode, NODE_PARAGRAPH) ? [self.startNode.element] : [];
            }
            return iterateToArray(new TyperTreeWalker(self.focusNode, NODE_PARAGRAPH | NODE_SHOW_EDITABLE), mapFn('element'), self.startNode, self.endNode);
        },
        getSelectedElements: function () {
            var self = this;
            if (self.isCaret) {
                return [self.startElement];
            }
            var commonContainer = getCommonAncestor(self.startElement, self.endElement);
            return iterateToArray(selectionCreateTreeWalker(self, NODE_ANY_ALLOWTEXT | NODE_INLINE_WIDGET), mapFn('element')).filter(function (v) {
                return containsOrEquals(commonContainer, v);
            });
        },
        getSelectedText: function () {
            return this.typer.extractText(this.getRange());
        },
        getSelectedTextNodes: function () {
            var self = this;
            if (self.isCaret) {
                return [];
            }
            selectionSplitText(self);
            return iterateToArray(new TyperDOMNodeIterator(selectionCreateTreeWalker(self, NODE_ANY_ALLOWTEXT), 4), null, self.startTextNode || self.startElement, function (v) {
                return comparePosition(v, self.endTextNode || self.endElement) <= 0;
            });
        },
        createTreeWalker: function (whatToShow, filter) {
            return selectionCreateTreeWalker(this, whatToShow, filter);
        },
        collapse: function (point) {
            point = this.getCaret(point);
            return (point === this.baseCaret ? this.extendCaret : this.baseCaret).moveTo(point);
        },
        select: function (startNode, startOffset, endNode, endOffset) {
            var self = this;
            return selectionAtomic(self, function () {
                if (startNode === 'word') {
                    return self.getCaret('start').moveByWord(-1) + self.getCaret('end').moveByWord(1) > 0;
                }
                var range = createRange(startNode, startOffset, endNode, endOffset);
                return self.baseCaret.moveTo(createRange(range, true)) + self.extendCaret.moveTo(createRange(range, false)) > 0;
            });
        },
        selectAll: function () {
            return this.select(this.typer.element, 'contents');
        },
        focus: function () {
            var topElement = this.typer.element;
            if (containsOrEquals(document, topElement)) {
                permitFocusEvent = true;
                applyRange(createRange(this));
                // Firefox does not set focus on the host element automatically
                // when selection is changed by JavaScript
                if (!IS_IE && document.activeElement !== topElement) {
                    topElement.focus();
                }
            }
        },
        clone: function () {
            var self = this;
            var inst = new TyperSelection(self.typer);
            selectionAtomic(inst, function () {
                inst.baseCaret.moveTo(self.baseCaret);
                inst.extendCaret.moveTo(self.extendCaret);
            });
            return inst;
        },
        widgetAllowed: function (id) {
            var self = this;
            if (is(self.focusNode, NODE_EDITABLE_PARAGRAPH) && !self.typer.getWidgetOption(self.focusNode.widget.id, 'inline')) {
                return false;
            }
            var allowedWidgets = self.typer.getWidgetOption(self.focusNode.widget.id, 'allowedWidgets');
            return !allowedWidgets || allowedWidgets === '*' || (' __root__ ' + allowedWidgets + ' ').indexOf(' ' + id + ' ') >= 0;
        }
    });

    $.each('moveToPoint moveToText moveByLine moveToLineEnd moveByWord moveByCharacter'.split(' '), function (i, v) {
        TyperSelection.prototype[v] = function () {
            return selectionAtomic(this, function () {
                return TyperCaret.prototype[v].apply(this.extendCaret, arguments) + this.collapse('extend') > 0;
            }, slice(arguments));
        };
    });

    definePrototype(TyperCaretNotification, {
        listen: function (inst, element) {
            var map = this.weakMap;
            var arr = map.get(element) || (map.set(element, []), map.get(element));
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
                selectionAtomic(carets[0].selection, function () {
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

    function caretTextNodeIterator(inst, root, whatToShow) {
        var iterator = new TyperDOMNodeIterator(new TyperTreeWalker(is(root, TyperNode) || inst.typer.getNode(root || inst.typer.element), NODE_ANY_ALLOWTEXT | NODE_SHOW_EDITABLE), whatToShow | 4);
        iterator.currentNode = inst.textNode || inst.element;
        return iterator;
    }

    function caretAtomic(inst, callback) {
        return inst.selection ? selectionAtomic(inst.selection, callback, null, inst) : callback.call(inst);
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

    function caretGetNode(node) {
        return is(node, NODE_ANY_BLOCK) || closest(node, NODE_PARAGRAPH | NODE_EDITABLE_PARAGRAPH);
    }

    function caretSetPosition(inst, element, offset, end) {
        var node, textNode, textOffset;
        if (tagName(element) === 'br') {
            textNode = isText(element.nextSibling) || $(createTextNode()).insertAfter(element)[0];
            element = textNode.parentNode;
            offset = 0;
        } else if (isElm(element) && element.firstChild) {
            if (offset === element.childNodes.length || (end && isElm(element.childNodes[(offset || 1) - 1]))) {
                element = element.childNodes[(offset || 1) - 1];
                offset = element.length;
                end = true;
            } else {
                element = element.childNodes[offset];
                offset = 0;
            }
        }
        if (isText(element)) {
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
            textNode = isText(iterator2.currentNode) || $(createTextNode())[end ? 'appendTo' : 'prependTo'](element)[0];
            offset = end ? textNode.length : 0;
        }
        if (textNode) {
            var moveToMostInner = function (dir, pSib, pChild, mInsert) {
                var next = isTextNodeEnd(textNode, offset, dir) && isElm(textNode[pSib]);
                if (next && tagName(next) !== 'br' && is(inst.typer.getNode(next), NODE_ANY_ALLOWTEXT)) {
                    element = next;
                    textNode = isText(element[pChild]) || $(createTextNode())[mInsert](element)[0];
                    offset = getOffset(textNode, 0 * dir);
                    return true;
                }
            };
            while (moveToMostInner(-1, 'previousSibling', 'lastChild', 'appendTo') || moveToMostInner(1, 'nextSibling', 'firstChild', 'prependTo'));
        }
        return caretSetPositionRaw(inst, caretGetNode(node), element, textNode, textNode ? offset : !end);
    }

    definePrototype(TyperCaret, {
        getRange: function () {
            var self = this;
            var node = self.textNode || self.element;
            if (!containsOrEquals(self.typer.element, node) || (isText(node) && self.offset > node.length)) {
                // use calculated text offset from paragraph node in case anchored text node is detached from DOM
                // assuming that there is no unmanaged edit after the previous selection
                self.moveToText(self.node.element, self.wholeTextOffset);
                node = self.textNode || self.element;
            }
            if (IS_IE && self.offset === node.length && isElm(node.nextSibling) && !/inline/.test($(node.nextSibling).css('display'))) {
                // IE fails to visually position caret when it is at the end of text line
                // and there is a next sibling element which its display mode is not inline
                if (node.data.slice(-1) === ZWSP) {
                    self.offset--;
                } else {
                    node.data += ZWSP;
                }
            }
            if (node === self.typer.element) {
                // avoid creating range that is outside the content editable area
                return createRange(node, self.offset ? 0 : -0);
            }
            return createRange(node, self.offset);
        },
        clone: function () {
            var clone = new TyperCaret(this.typer);
            clone.moveTo(this);
            return clone;
        },
        moveTo: function (node, offset) {
            var range = is(node, Range) || createRange(node, offset);
            if (range) {
                var selection = this.selection;
                var end = selection && this === selection.extendCaret && compareRangePosition(selection.baseCaret, range) < 0;
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
            var self = this;
            var iterator = caretTextNodeIterator(self, self.node);
            var rect = computeTextRects(self)[0];
            var minx = rect.left;
            do {
                $.each(computeTextRects(iterator.currentNode), function (i, v) {
                    if (v.top <= rect.bottom && v.bottom >= rect.top) {
                        minx = Math[direction < 0 ? 'min' : 'max'](minx, direction < 0 ? v.left : v.right);
                    }
                });
            } while (iterator[direction < 0 ? 'previousNode' : 'nextNode']());
            return self.moveToPoint(minx, rect.top + rect.height / 2);
        },
        moveByLine: function (direction) {
            var self = this;
            var iterator = caretTextNodeIterator(self);
            var rect = computeTextRects(self)[0];
            do {
                var rects = computeTextRects(iterator.currentNode);
                var newRect = any(direction < 0 ? slice(rects).reverse() : rects, function (v) {
                    return direction < 0 ? v.bottom <= rect.top : v.top >= rect.bottom;
                });
                if (newRect) {
                    return self.moveToPoint(rect.left, newRect.top + newRect.height / 2);
                }
            } while (iterator[direction < 0 ? 'previousNode' : 'nextNode']());
            return self.moveToLineEnd(direction);
        },
        moveByWord: function (direction) {
            var self = this;
            var node = self.textNode;
            var re = direction < 0 ? /\b(\S*\s+|\S+)$/ : /^(\s+\S*|\S+)\b/;
            var str = '';
            var matched;
            if (node) {
                str = direction < 0 ? node.data.substr(0, self.offset) : node.data.slice(self.offset);
                if ((matched = re.test(str)) && RegExp.$1.length !== str.length) {
                    return self.moveToText(node, self.offset + direction * RegExp.$1.length);
                }
            }
            var iterator = caretTextNodeIterator(self, self.node);
            var lastNode = iterator.currentNode;
            var lastLength = matched && RegExp.$1.length;
            while ((node = iterator[direction < 0 ? 'previousNode' : 'nextNode']())) {
                str = direction < 0 ? node.data + str : str + node.data;
                if ((matched = re.test(str)) && RegExp.$1.length !== str.length) {
                    // avoid unnecessarily expanding selection over multiple text nodes or elements
                    if (RegExp.$1.length === lastLength) {
                        return self.moveToText(lastNode, -direction * 0);
                    }
                    return self.moveToText(node, direction * (RegExp.$1.length - (str.length - node.length)));
                }
                lastNode = node;
                lastLength = RegExp.$1.length;
            }
            return !matched || (!node && !lastLength) ? false : self.moveToText(node || lastNode, 0 * -direction);
        },
        moveByCharacter: function (direction) {
            var self = this;
            var rect = computeTextRects(self)[0];
            var iterator = caretTextNodeIterator(self, null, 5);
            var node = isText(iterator.currentNode);
            var offset = self.offset;
            var overBr = false;
            while (true) {
                if (!node || offset === getOffset(node, 0 * -direction)) {
                    while (!(node = iterator[direction < 0 ? 'previousNode' : 'nextNode']()) || !node.length) {
                        if (!node) {
                            return false;
                        }
                        overBr |= tagName(node) === 'br';
                    }
                    offset = (direction < 0 ? node.length : 0) + ((overBr || caretGetNode(self.typer.getNode(node)) !== self.node) && -direction);
                }
                offset += direction;
                var newRect = node.data.charAt(offset) !== ZWSP && computeTextRects(createRange(node, offset))[0];
                if (!rect || (newRect && !rectEquals(rect, newRect))) {
                    return self.moveToText(node, offset);
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
            var arr = this.changes.splice(0);
            if (arr[0] && isFunction(callback)) {
                callback(arr);
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

    var EVT_SOURCES = {
        mouse: 'mousedown mouseup click',
        keystroke: 'keydown keyup keypress',
        touch: 'touchstart touchmove touchend'
    };
    $(function () {
        $.each(EVT_SOURCES, function (i, v) {
            $(document.body).bind(v, function () {
                eventSource(null, i);
            });
        });
        $(document.body).bind('touchstart mousedown', function (e) {
            // document.activeElement or FocusEvent.relatedTarget does not report non-focusable element
            lastTouchedElement = e.target;
        });
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
                    while (node.data.charCodeAt(index) === 10 && --index);
                    var rect;
                    if (node.data.charCodeAt(index) === 32 && index) {
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
                for (var target = element, distY, lastDistY; isElm(target); element = target || element) {
                    distY = Infinity;
                    target = null;
                    $(element).contents().each(function (i, v) {
                        var rects;
                        if (isText(v)) {
                            rects = computeTextRects(v);
                        } else if (isElm(v) && $(v).css('pointer-events') !== 'none') {
                            rects = [v.getBoundingClientRect()];
                        }
                        for (var j = 0, length = (rects || '').length; j < length; j++) {
                            if (rects[j].top <= y && rects[j].bottom >= y) {
                                target = v;
                                newY = y;
                                distY = 0;
                                return isElm(v) || distanceFromCharacter(v, v.length - 1) < 0;
                            }
                            lastDistY = distY;
                            distY = Math.min(distY, distanceToRect(rects[j]));
                            if (distY < lastDistY) {
                                target = v;
                                newY = isElm(v) ? y : rects[j].top + rects[j].height / 2;
                            }
                        }
                    });
                }
                if (isText(element)) {
                    y = newY;
                    return createRange(element, findOffset(element));
                }
                return createRange(element, -0);
            };
        }();
    }

    // detect support for textInput event
    function detectTextInputEvent(e) {
        var self = detectTextInputEvent;
        self.keypressed = e.type === 'keypress';
        self.data = e.data;
        if (self.keypressed) {
            setImmediate(function () {
                supportTextInputEvent = !self.keypressed && self.data !== null;
                document.removeEventListener('keypress', detectTextInputEvent, true);
                document.removeEventListener('textInput', detectTextInputEvent, true);
            });
        }
    }

    document.addEventListener('keypress', detectTextInputEvent, true);
    document.addEventListener('textInput', detectTextInputEvent, true);

}(jQuery, window, document, String, Node, Range, DocumentFragment, window.WeakMap, Array.prototype, RegExp));

(function ($, Typer) {
    'use strict';

    function fixTextOverflow(typer) {
        var topElement = typer.element;
        var style = window.getComputedStyle(topElement);
        if (style.whiteSpace === 'nowrap' && style.overflow === 'hidden') {
            var rect = Typer.ui.getRect(topElement);
            var pos = Typer.ui.getRect(typer.getSelection().extendCaret.getRange());
            if (pos.left - rect.right >= 1) {
                topElement.style.textIndent = parseInt(style.textIndent) - (pos.left - rect.right + 5) + 'px';
            } else if (rect.left - pos.left >= 1) {
                topElement.style.textIndent = Math.min(0, parseInt(style.textIndent) + (rect.left - pos.left + 5)) + 'px';
            }
        }
    }

    Typer.presets = {};

    Typer.preset = function (element, name, options) {
        var preset = Typer.presets[name];
        var presetDefinition = {};
        var presetWidget;

        options = {
            inline: true,
            accept: 'text',
            defaultOptions: false,
            disallowedElement: '*',
            widgets: {},
            stateChange: function (e) {
                fixTextOverflow(e.typer);
            },
            __preset__: $.extend({}, options)
        };
        $.each(preset, function (i, v) {
            (typeof v === 'function' || i === 'options' || i === 'commands' ? presetDefinition : options)[i] = v;
        });
        $.each(options.__preset__, function (i, v) {
            if (!presetDefinition.options || !(i in presetDefinition.options)) {
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

(function ($, Typer, Object, RegExp, Node, window, document) {
    'use strict';

    var SELECTOR_INPUT = ':text, :password, :checkbox, :radio, textarea, [contenteditable]';
    var SELECTOR_FOCUSABLE = ':input, [contenteditable], a[href], area[href], iframe';
    var BOOL_ATTRS = 'checked selected disabled readonly multiple ismap';
    var ROOT_EVENTS = 'executing executed cancelled';
    var IS_MAC = navigator.userAgent.indexOf('Macintosh') >= 0;
    var IS_TOUCH = 'ontouchstart' in window;
    var XFORM_VALUES = 'none translate(-50%,0) translate(0,-50%) translate(-50%,-50%)'.split(' ');

    var FLIP_POS = {
        top: 'bottom',
        left: 'right',
        right: 'left',
        bottom: 'top'
    };
    var MARGIN_PROP = {
        top: 'marginTop',
        left: 'marginLeft',
        right: 'marginRight',
        bottom: 'marginBottom'
    };
    var DIR_SIGN = {
        top: -1,
        left: -1,
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

    var data = $._data;
    var isFunction = $.isFunction;
    var isPlainObject = $.isPlainObject;
    var getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
    var containsOrEquals = Typer.containsOrEquals;
    var dummyDiv = document.createElement('div');

    var definedControls = {};
    var definedIcons = {};
    var definedLabels = {};
    var definedThemes = {};
    var definedShortcuts = {};
    var controlExtensions = {};
    var wsDelimCache = {};
    var executionContext = [];
    var callstack = [];
    var snaps = [];
    var currentCallouts = [];
    var currentDialog;
    var originDiv;

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

    function setImmediateOnce(fn) {
        clearImmediate(fn._timeout);
        fn._timeout = setImmediate(fn.bind.apply(fn, arguments));
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

    function defineProperty(obj, prop, flag, getter, setter) {
        var desc = {};
        desc.configurable = flag.indexOf('c') >= 0;
        desc.enumerable = flag.indexOf('e') >= 0;
        if (flag.indexOf('g') >= 0) {
            desc.get = getter;
            desc.set = setter || null;
        } else {
            desc.writable = true;
            desc.value = getter;
        }
        Object.defineProperty(obj, prop, desc);
    }

    function inheritProperty(obj, prop) {
        var initialValue = obj[prop];
        defineProperty(obj, prop, 'ceg', function () {
            var parent = this.contextualParent;
            return parent ? parent[prop] : initialValue;
        }, function (value) {
            defineProperty(this, prop, 'ce', value);
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
        var baseFn = function () { };
        baseFn.prototype = controlExtensions;
        fn.prototype = new baseFn();
        Object.getOwnPropertyNames(base || {}).forEach(function (v) {
            Object.defineProperty(fn.prototype, v, getOwnPropertyDescriptor(base, v));
        });
        defineProperty(fn.prototype, 'constructor', 'c', fn);
        return fn;
    }

    function listen(obj, prop, callback) {
        var desc = getPropertyDescriptor(obj, prop) || {
            value: obj[prop]
        };
        defineProperty(obj, prop, desc.enumerable !== false ? 'eg' : 'g', function () {
            return desc.get ? desc.get.call(obj) : desc.value;
        }, function (value) {
            if (value !== this[prop]) {
                if (desc.set) {
                    desc.set.call(obj, value);
                } else {
                    desc.value = value;
                }
                callback.call(this, prop, value);
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

    function getState(element, name) {
        var re = new RegExp('(^|\\s)\\s*' + name + '(?:-(\\S+)|\\b)$', 'ig');
        var t = [false];
        (element.className || '').replace(re, function (v, a) {
            t[a ? t.length : 0] = a || true;
        });
        return t[1] ? t.slice(1) : t[0];
    }

    function setState(element, name, values) {
        var re = new RegExp('(^|\\s)\\s*' + name + '(?:-(\\S+)|\\b)|\\s*$', 'ig');
        var replaced = 0;
        element.className = (element.className || '').replace(re, function () {
            return replaced++ || !values || values.length === 0 ? '' : (' ' + name + (values[0] ? [''].concat(values).join(' ' + name + '-') : ''));
        });
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

    function getRect(elm) {
        var rect = $.extend({}, (elm || document.documentElement).getBoundingClientRect());
        return delete rect.x, delete rect.y, delete rect.toJSON, rect;
    }

    function cssFromPoint(x, y, origin, parent) {
        parent = Typer.is(parent || origin, Node);
        var refRect = getRect(parent || originDiv);
        var winRect = getRect(parent);
        var dirX = matchWSDelim(origin || y, 'left right') || 'left';
        var dirY = matchWSDelim(origin || y, 'top bottom') || 'top';
        var style = {};
        y = (((x.top || x.clientY || x.y || y) | 0) - refRect.top);
        x = (((x.left || x.clientX || x.x || x) | 0) - refRect.left);
        style[dirX] = (dirX === 'left' ? x : winRect.width - x) + 'px';
        style[dirY] = (dirY === 'top' ? y : winRect.height - y) + 'px';
        style[FLIP_POS[dirX]] = 'auto';
        style[FLIP_POS[dirY]] = 'auto';
        return style;
    }

    function cssFromRect(rect) {
        var style = cssFromPoint(rect);
        style.width = ((rect.width || rect.right - rect.left) | 0) + 'px';
        style.height = ((rect.height || rect.bottom - rect.top) | 0) + 'px';
        return style;
    }

    function snapToElement(elm, of, at, within) {
        var refRect = isPlainObject(of) || !of ? {} : getRect(of);
        if (!('left' in refRect)) {
            refRect.left = refRect.right = (of.left || of.clientX || of.x) | 0;
            refRect.top = refRect.bottom = (of.right || of.clientY || of.y) | 0;
        }
        var inset = matchWSDelim(at, 'inset-x inset-y inset') || 'inset-x';
        var winRect = inset === 'inset' ? refRect : getRect(within);
        var elmRect = getRect(elm);
        var elmStyle = window.getComputedStyle(elm);
        var margin = {};
        var point = {};
        var fn = function (dir, inset, p, pSize) {
            if (!FLIP_POS[dir]) {
                var center = (refRect[FLIP_POS[p]] + refRect[p]);
                dir = center - winRect[p] * 2 < elmRect[pSize] ? p : winRect[FLIP_POS[p]] * 2 - center < elmRect[pSize] ? FLIP_POS[p] : '';
                point[p] = (dir ? winRect[dir] : center / 2) + margin[dir || p];
                return dir;
            }
            // determine cases of 'normal', 'flip' and 'fit' by available rooms
            var rDir = inset ? FLIP_POS[dir] : dir;
            if (refRect[dir] * DIR_SIGN[rDir] + elmRect[pSize] <= winRect[rDir] * DIR_SIGN[rDir]) {
                point[p] = refRect[dir] + margin[FLIP_POS[rDir]];
            } else if (refRect[FLIP_POS[dir]] * DIR_SIGN[rDir] - elmRect[pSize] > winRect[FLIP_POS[rDir]] * DIR_SIGN[rDir]) {
                dir = FLIP_POS[dir];
                point[p] = refRect[dir] + margin[rDir];
            } else {
                point[p] = winRect[dir] + margin[dir];
                return dir;
            }
            return inset ? dir : FLIP_POS[dir];
        };

        Object.keys(FLIP_POS).forEach(function (v) {
            margin[v] = (parseFloat(elmStyle[MARGIN_PROP[v]]) || 0) * DIR_SIGN[v];
            winRect[v] -= margin[v];
        });
        var oDirX = matchWSDelim(at, 'left right center') || 'left';
        var oDirY = matchWSDelim(at, 'top bottom center') || 'bottom';
        var dirX = fn(oDirX, FLIP_POS[oDirY] && inset === 'inset-x', 'left', 'width');
        var dirY = fn(oDirY, FLIP_POS[oDirX] && inset === 'inset-y', 'top', 'height');

        var style = cssFromPoint(point, dirX + ' ' + dirY);
        style.position = 'fixed';
        style.transform = XFORM_VALUES[((!dirY) << 1) | (!dirX)];
        $(elm).css(style);
    }

    function updateSnaps() {
        snaps.forEach(function (v) {
            if (Typer.is(v.ref, ':visible') && !Typer.rectEquals(getRect(v.ref), v.rect || {})) {
                v.list.forEach(function (w) {
                    if (Typer.is(w.elm, ':visible')) {
                        snapToElement(w.elm, v.ref, w.dir);
                    }
                });
                v.rect = getRect(v.ref);
            }
        });
    }

    function showCallout(control, element, ref, pos) {
        for (var i = 0; i < currentCallouts.length; i++) {
            if (currentCallouts[i].control !== control && !currentCallouts[i].control.parentOf(control)) {
                hideCallout(currentCallouts[i].control);
                break;
            }
        }
        var item = currentCallouts[0];
        if (!item || item.control !== control) {
            item = {};
            currentCallouts.unshift(item);
        }
        $.when(item.promise).always(function () {
            $(element).appendTo(document.body).css({
                position: 'fixed',
                zIndex: getZIndexOver(control.element)
            });
            item.control = control;
            item.element = element;
            item.focusedElement = Typer.is(document.activeElement, SELECTOR_FOCUSABLE);
            (isPlainObject(ref) ? snapToElement : typerUI.snap)(element, ref, pos || 'left bottom');
            item.promise = $.when(callThemeFunction(control, 'afterShow', item));
        });
    }

    function hideCallout(control) {
        for (var i = currentCallouts.length - 1; i >= 0 && control !== currentCallouts[i].control && !control.parentOf(currentCallouts[i].control); i--);
        $.each(currentCallouts.slice(0, i + 1), function (i, v) {
            if (v.promise.state() !== 'pending' && !v.isClosing) {
                typerUI.unsnap(v.element);
                v.isClosing = true;
                v.promise = $.when(callThemeFunction(v.control, 'beforeHide', v)).done(function () {
                    currentCallouts.splice(currentCallouts.indexOf(v), 1);
                    $(v.element).detach();
                });
            }
        });
    }

    function runInContext(control, callback) {
        try {
            callstack.unshift(control);
            return callback();
        } finally {
            callstack.shift();
        }
    }

    function callFunction(control, name, data, optArg, holder) {
        holder = holder || control;
        return !isFunction(holder[name]) ? void 0 : runInContext(control, function () {
            return holder[name](control.ui, control, data, optArg);
        });
    }

    function callThemeFunction(control, name, data) {
        return callFunction(control, name, data, null, definedThemes[control.ui.theme]);
    }

    function triggerEvent(control, name, data) {
        if (control.ui === control || matchWSDelim(name, ROOT_EVENTS)) {
            callFunction(control, name, data, null, control.ui);
            callThemeFunction(control, name, data);
        } else {
            var proto = control.constructor.prototype;
            if (control[name] !== proto[name]) {
                callFunction(control, name, data, null, proto);
            }
            callFunction(control, name, data);
            callThemeFunction(control, control.type + capfirst(name), data);
        }
    }

    function findControls(control, needle, defaultNS, haystack, exclusions) {
        haystack = haystack || control.all || control.contextualParent.all;
        if (!haystack._cache) {
            defineProperty(haystack, '_cache', 'c', {});
        }
        defaultNS = defaultNS || control.defaultNS;
        exclusions = exclusions || {};
        if (control.name && haystack !== control.contextualParent.all) {
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
        if (control.controls !== undefined) {
            contextualParent.all = contextualParent.all || {};
        }
        control.controls = $.map(control.controls || [], function (v, i) {
            var inst = Object.create(isString(v) ? definedControls[v] : v);
            var name = inst.name || isString(v) || randomId();
            if (name.indexOf(':') < 0 && control.defaultNS) {
                name = control.defaultNS + ':' + name;
            }
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

        control.element = replacePlaceholder(control.renderAs || control.type);
        $(control.element).attr('role', control.name).addClass(control.cssClass).data('typerControl', control);
        $.each(bindedProperties, function (i, v) {
            propertyChanged(i, control[i]);
        });
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
        var theme = definedThemes[ui.theme];

        var suppressStateChange;
        if (control.requireWidget || control.requireWidgetEnabled) {
            control.widget = ui._widgets[control.requireWidget || control.requireWidgetEnabled] || ui.widget;
            suppressStateChange = !control.widget;
        }
        if (!suppressStateChange && callstack.indexOf(control, 1) < 0) {
            if (control.getState(theme.controlErrorClass || 'error')) {
                validateControl(control);
            }
            triggerEvent(control, 'stateChange');
        }

        var disabled = !isEnabled(control);
        if (control.element.disabled !== undefined) {
            control.element.disabled = disabled;
        }
        control.setState(theme.controlDisabledClass || 'disabled', disabled);
        control.setState(theme.controlActiveClass || 'active', isActive(control));
        control.setState(theme.controlHiddenClass || 'hidden', (disabled && control.hiddenWhenDisabled) || control.visible === false || callFunction(control, 'visible') === false);
    }

    function executeControlWithFinal(control, callback, optArg) {
        try {
            callback(control, optArg);
            if (executionContext.indexOf(control) > 0) {
                return executionContext[0].promise;
            }
        } finally {
            if (executionContext[0] === control) {
                while ($.when(executionContext[0].promise).state() !== 'pending' && executionContext.shift() && executionContext[0]);
            }
        }
    }

    function executeControl(control) {
        var typer = control.ui.typer;
        if (typer) {
            if (isFunction(control.execute)) {
                typer.invoke(function (tx) {
                    callFunction(control, 'execute', tx, control.getValue());
                });
            } else if (typer.hasCommand(control.execute)) {
                typer.invoke(control.execute, control.getValue());
            }
        } else {
            callFunction(control, 'execute', null, control.getValue());
        }
        triggerEvent(control, 'executed');
    }

    function validateControl(control) {
        var errors = [];
        var flags = {};
        callFunction(control, 'validate', function (assertion, type, description) {
            if (!assertion) {
                type = type || 'generic';
                flags[type] = true;
                errors.push({
                    type: type,
                    description: description || ''
                });
            }
        });
        setState(control.element, definedThemes[control.ui.theme].controlErrorClass || 'error', Object.keys(flags));
        callThemeFunction(control, 'validate', errors);
        return errors[0] && control;
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
                submitControl = submitControl || ui.resolveOne(control.resolveBy);
                var promise = $.when(callFunction(control, 'submit', submitControl));
                if (promise.state() === 'pending') {
                    triggerEvent(control, 'waiting', submitControl);
                }
                promise.done(function (returnValue) {
                    triggerEvent(control, 'success', returnValue);
                    deferred.resolve(value);
                });
                promise.fail(function (err) {
                    triggerEvent(control, 'error', err);
                    typerUI.focus(control.element, true);
                });
            }
        };
        var defaultResolve = function () {
            var resolveWith = ui.resolveOne(control.resolveWith) || control;
            execute(resolveWith.getValue(), this);
        };
        var defaultReject = function () {
            deferred.reject();
        };
        control.resolve(control.resolveBy).forEach(function (v) {
            v.execute = defaultResolve;
        });
        control.resolve(control.rejectBy).forEach(function (v) {
            v.execute = defaultReject;
        });
        callFunction(control, 'setup', execute, defaultReject);
        return {
            promise: deferred.promise(),
            resolve: defaultResolve,
            reject: defaultReject
        };
    }

    function resolveControlParam(ui, control) {
        return isString(control) ? ui.resolveOne(control) : control || ui.controls[0];
    }

    function defineShortcut(keystroke, type, value) {
        definedShortcuts[keystroke] = definedShortcuts[keystroke] || {
            hooks: [],
            commands: []
        };
        definedShortcuts[keystroke][type].push(value);
    }

    function getElementContainers(control) {
        var arr = [control.element];
        foreachControl(control, function (v) {
            if (!containsOrEquals(v.element, v.parent.element) && containsOrEquals(document.body, v.element)) {
                for (var elm = v.element; elm.parentNode && !$.contains(elm.parentNode, arr[0]); elm = elm.parentNode);
                arr[arr.length] = elm;
            }
        });
        return $.unique(arr);
    }

    function elementOfControl(control, element) {
        return getElementContainers(control).some(function (v) {
            return containsOrEquals(v, element);
        });
    }

    var typerUI = Typer.ui = define('TyperUI', null, function (options, values) {
        if (isString(options)) {
            options = {
                controls: options
            };
        }
        var parentControl = callstack[0] || executionContext[0];
        if (parentControl) {
            $.extend(options, {
                theme: parentControl.ui.theme,
                typer: parentControl.ui.typer,
                widget: parentControl.ui.widget,
                parent: parentControl.ui,
                parentControl: parentControl
            });
        }
        var self = $.extend(this, options);
        self.ui = self;
        self.theme = self.theme || Object.keys(definedThemes)[0];
        self.all = {};
        createControls(self);
        renderControls(self);
        $(self.element).addClass('typer-ui typer-ui-' + self.theme);
        $(self.element).mousedown(function () {
            typerUI.focus(self.element);
        });
        foreachControl(self, triggerEvent, 'init');
        triggerEvent(self, 'init');
        if (self.typer) {
            self.retainFocus(self.typer);
        }
        if (isPlainObject(values)) {
            $.each(values, function (i, v) {
                self.setValue(i, v);
            });
        }
    });

    $.extend(typerUI.prototype, {
        language: 'en',
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
            var self = this;
            foreachControl(self, triggerEvent, 'destroy');
            typerUI.unsnap(self.element);
            $(self.element).remove();
        },
        getControl: function (element) {
            var parents = $(element).parents('[role]').addBack('[role]').get().reverse();
            return $.map(parents, function (v) {
                return $(v).data('typerControl');
            })[0];
        },
        resolve: function (control) {
            var cur = callstack[0];
            return resolveControls(cur && cur.ui === this ? cur : this, control);
        },
        trigger: function (control, event, data) {
            control = resolveControlParam(this, control);
            triggerEvent(control, event, data);
        },
        show: function (control, element, ref, pos) {
            if (!control || control.ui !== this) {
                showCallout(this, this.element, control, element);
            } else {
                control = resolveControlParam(this, control);
                showCallout(control, element, ref, pos);
            }
        },
        hide: function (control) {
            control = control === undefined ? this : resolveControlParam(this, control);
            return control && hideCallout(control);
        },
        enabled: function (control) {
            control = resolveControlParam(this, control);
            return control && isEnabled(control);
        },
        active: function (control) {
            control = resolveControlParam(this, control);
            return control && isActive(control);
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
        validate: function () {
            var failed, cur;
            foreachControl(this, function (control) {
                failed = (control.validate && isEnabled(control) && (cur = validateControl(control)), (failed || cur));
            });
            if (failed) {
                typerUI.focus(failed.element, true);
            }
            return !failed;
        },
        reset: function () {
            var self = this;
            var errorClass = definedThemes[self.theme].controlErrorClass || 'error';
            foreachControl(self, function (control) {
                if (control.validate) {
                    control.setState(errorClass, false);
                }
                triggerEvent(control, 'reset');
            });
            self.update();
        },
        getValue: function (control) {
            control = resolveControlParam(this, control);
            return control && control.getValue();
        },
        setValue: function (control, value) {
            if (arguments.length < 2) {
                return this.setValue(this.controls[0], control);
            }
            control = resolveControlParam(this, control);
            return control && control.setValue(value);
        },
        getState: function (control, name) {
            control = resolveControlParam(this, control);
            return control && control.getState(name);
        },
        setState: function (control, name, value) {
            this.resolve(control).forEach(function (v) {
                v.setState(name, value);
            });
        },
        set: function (control, prop, value) {
            this.resolve(control).forEach(function (v) {
                v.set(prop, value);
            });
        },
        execute: function (control, value) {
            control = resolveControlParam(this, control);
            if (control && executionContext.indexOf(control) < 0 && isEnabled(control)) {
                if (value !== undefined) {
                    control.setValue(value);
                }
                executionContext.unshift(control);
                triggerEvent(control, 'executing');
                if (isFunction(control.dialog)) {
                    var promise = control.promise = $.when(callFunction(control, 'dialog'));
                    promise.done(function (value) {
                        executeControlWithFinal(control, function () {
                            control.setValue(value);
                            executeControl(control);
                        });
                    });
                    promise.fail(function () {
                        executeControlWithFinal(control, triggerEvent, 'cancelled');
                    });
                    return promise;
                }
                return executeControlWithFinal(control, executeControl);
            }
        },
        focus: function () {
            typerUI.focus((resolveControlParam(this) || this).element);
        },
        retainFocus: function (typer) {
            var arr = getElementContainers(this);
            arr.forEach(typer.retainFocus.bind(typer));
        }
    });

    $.extend(typerUI, {
        isTouchDevice: IS_TOUCH,
        controls: definedControls,
        themes: definedThemes,
        controlExtensions: controlExtensions,
        matchWSDelim: matchWSDelim,
        getZIndex: getZIndex,
        getZIndexOver: getZIndexOver,
        getRect: getRect,
        listen: listen,
        cssFromPoint: cssFromPoint,
        cssFromRect: cssFromRect,
        getState: getState,
        setState: setState,
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
                defineShortcut(v, 'hooks', hook);
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
                    defineShortcut(v, 'commands', {
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
        snap: function (element, to, dir) {
            typerUI.unsnap(element);
            to = Typer.is(to, Node) || document.documentElement;
            var s = data(to).typerSnaps || (data(to).typerSnaps = snaps[snaps.push({ ref: to, list: [] }) - 1]);
            s.list.push({
                elm: element,
                dir: dir
            });
            snapToElement(element, to, dir);
        },
        unsnap: function (element) {
            for (var i = snaps.length - 1; i >= 0; i--) {
                for (var j = snaps[i].list.length - 1; j >= 0; j--) {
                    if (containsOrEquals(element, snaps[i].list[j].elm)) {
                        snaps[i].list.splice(j, 1);
                    }
                }
                if (!snaps[i].list[0]) {
                    delete data(snaps.splice(i, 1)[0].ref).typerSnaps;
                }
            }
        },
        focus: function (element, inputOnly) {
            if (!$.contains(element, document.activeElement) || (inputOnly && !$(document.activeElement).is(SELECTOR_INPUT))) {
                $(inputOnly ? SELECTOR_INPUT : SELECTOR_FOCUSABLE, element).not(':disabled, :hidden').andSelf()[0].focus();
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
        hint: function (message) {
            return typerUI('dialog:hint', {
                message: message
            }).execute();
        },
        getWheelDelta: function (e) {
            e = e.originalEvent || e;
            var dir = -e.wheelDeltaY || -e.wheelDelta || e.detail;
            return dir / Math.abs(dir) * (IS_MAC ? -1 : 1);
        }
    });

    $.extend(controlExtensions, {
        buttonsetGroup: 'left',
        cssClass: '',
        hiddenWhenDisabled: false,
        pinDirection: 'none',
        renderAs: '',
        requireChildControls: false,
        requireTyper: false,
        requireWidget: '',
        requireWidgetEnabled: '',
        showButtonLabel: true,
        hideCalloutOnExecute: true,
        is: function (type) {
            return type.charAt(0) === ':' ? getState(this.element, type) : matchWSDelim(this.type, type);
        },
        parentOf: function (control) {
            for (; control; control = control.parent) {
                if (this === control) {
                    return true;
                }
            }
            return false;
        },
        resolve: function (control) {
            return resolveControls(this, control);
        },
        resolveOne: function (control) {
            return this.resolve(control)[0];
        },
        set: function (prop, value) {
            var self = this;
            runInContext(self, function () {
                if (isString(prop)) {
                    self[prop] = value;
                } else {
                    for (var i in prop) {
                        self[i] = prop[i];
                    }
                }
            });
            updateControl(self);
        },
        getValue: function () {
            var self = this;
            return runInContext(self, function () {
                if (self.valueMap) {
                    var value = {};
                    $.each(self.valueMap, function (i, v) {
                        value[i] = self.ui.getValue(v);
                    });
                    return value;
                }
                return self.value;
            });
        },
        setValue: function (value) {
            var self = this;
            runInContext(self, function () {
                if (self.valueMap) {
                    $.each(self.valueMap, function (i, v) {
                        self.ui.setValue(v, (value || '')[i]);
                    });
                } else {
                    self.value = value;
                }
            });
            updateControl(self);
        },
        getState: function (name) {
            return getState(this.element, name);
        },
        setState: function (name, value) {
            return setState(this.element, name, value);
        }
    });

    typerUI.theme = define('TyperUITheme');
    typerUI.themeExtensions = typerUI.theme.prototype;

    $.extend(typerUI.themeExtensions, {
        textboxPresetOptions: null,
        bind: function (ui, control, value) {
            dummyDiv.textContent = ui.getLabel(value) || '';
            return dummyDiv.innerHTML.replace(/(^|\s)\*\*(.+)\*\*(?=\s|$)/g, '$1<b>$2</b>').replace('\n', '<br>');
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

    inheritProperty(controlExtensions, 'pinDirection');

    /* ********************************
     * Built-in Control Types
     * ********************************/

    typerUI.define({
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
            optionFilter: '(type:button) -(dropdownOption:exclude)',
            defaultEmpty: false,
            allowEmpty: false,
            selectedIndex: -1,
            requireChildControls: true,
            controls: '*',
            get value() {
                return this.selectedValue;
            },
            set value(value) {
                var self = this;
                self.selectedIndex = -1;
                $.each(self.resolve(self.optionFilter), function (i, v) {
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
                self.selectedText = self.label || self.name;
                $.each(self.resolve(self.optionFilter), function (i, v) {
                    v.active = function () {
                        return self.selectedIndex === i;
                    };
                    v.execute = function () {
                        self.value = v.value;
                        ui.execute(self);
                    };
                });
                $(self.element).click(function () {
                    if (isEnabled(self)) {
                        callThemeFunction(self, 'showCallout');
                    }
                });
            },
            stateChange: function (ui, self) {
                var children = self.resolve(self.optionFilter);
                if (self.selectedIndex < 0 || !isEnabled(children[self.selectedIndex])) {
                    if (!self.defaultEmpty) {
                        self.value = (children.filter(isEnabled)[0] || '').value;
                    } else if (self.selectedIndex >= 0) {
                        self.value = '';
                    }
                }
            },
            validate: function (ui, self, assert) {
                assert(self.allowEmpty || self.selectedIndex >= 0, 'required');
            },
            reset: function (ui, self) {
                self.value = self.defaultEmpty ? '' : (self.resolve(self.optionFilter).filter(isEnabled)[0] || '').value;
            }
        },
        callout: {
            allowButtonMode: false,
            controls: '*',
            stateChange: function (ui, self) {
                if (self.allowButtonMode) {
                    var enabled = self.resolve('*:*').filter(isEnabled);
                    if (enabled.length === 1) {
                        self.icon = enabled[0].icon;
                        self.label = enabled[0].label;
                    } else {
                        var proto = Object.getPrototypeOf(self);
                        self.icon = proto.icon || self.name;
                        self.label = proto.label || self.name;
                    }
                }
            },
            execute: function (ui, self) {
                if (self.allowButtonMode) {
                    var enabled = self.resolve('*:*').filter(isEnabled);
                    if (enabled.length === 1) {
                        ui.execute(enabled[0]);
                        return;
                    }
                }
                callThemeFunction(self, 'showCallout');
            }
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
        link: {},
        file: {},
        textbox: {
            preset: 'textbox',
            get value() {
                return this.preset.getValue();
            },
            set value(value) {
                this.preset.setValue(value);
            },
            validate: function (ui, self, assert) {
                self.preset.validate(assert);
            },
            reset: function (ui, self) {
                self.preset.setValue('');
            },
            init: function (ui, self) {
                var editable = $(definedThemes[ui.theme].textboxElement, self.element)[0];
                var presetOptions = $.extend({}, definedThemes[ui.theme].textboxPresetOptions, self.presetOptions, {
                    contentChange: function (e) {
                        validateControl(self);
                        if (e.typer.focused()) {
                            ui.execute(self);
                        }
                    }
                });
                self.preset = Typer.preset(editable, self.preset, presetOptions);
                self.preset.parentControl = self;
                self.presetOptions = self.preset.getStaticWidget('__preset__').options;
            }
        },
        checkbox: {
            required: false,
            validate: function (ui, self, assert) {
                assert(!self.required || self.value, 'required');
            },
            reset: function (ui, self) {
                self.value = false;
            }
        },
        dialog: {
            pinnable: false,
            modal: true,
            keyboardResolve: true,
            keyboardReject: true,
            resolveBy: 'dialog:buttonOK',
            rejectBy: 'dialog:buttonCancel',
            dialog: function (ui, self) {
                var previousDialog = currentDialog;
                var previousActiveElement = document.activeElement;
                var form = createForm(self);
                var data = {
                    control: self,
                    element: self.element
                };
                ui.update();
                $(ui.element).appendTo(document.body);
                setImmediate(function () {
                    callThemeFunction(self, 'afterShow', data);
                    typerUI.focus(self.element);
                });
                form.promise.always(function () {
                    $.when(callThemeFunction(self, 'beforeHide', data)).always(function () {
                        ui.destroy();
                    });
                    currentDialog = previousDialog;
                    if (previousActiveElement) {
                        previousActiveElement.focus();
                    }
                });
                typerUI.setZIndex(ui.element, document.body);
                currentDialog = {
                    control: self,
                    clickReject: !self.modal && form.reject,
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
        message: typerUI.label(),
        input: typerUI.textbox(),
        prompt: typerUI.dialog({
            pinnable: true,
            defaultNS: 'dialog',
            controls: 'message input buttonset',
            resolveWith: 'input'
        }),
        hint: typerUI.dialog({
            pinnable: true,
            modal: false,
            defaultNS: 'dialog',
            controls: 'message'
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
            var dict = definedShortcuts[e.data] || {};
            if (!e.isDefaultPrevented() && dict.commands) {
                $.each(dict.commands, function (i, v) {
                    if (e.typer.hasCommand(v.command)) {
                        e.typer.invoke(v.command, v.value);
                        e.preventDefault();
                        return false;
                    }
                });
            }
            $.each(dict.hooks || [], function (i, v) {
                v(e);
            });
        }
    };

    $(function () {
        $(window).keydown(function (e) {
            if (currentDialog && (e.which === 13 || e.which === 27)) {
                (currentDialog[e.which === 13 ? 'keyboardResolve' : 'keyboardReject'] || $.noop)();
            }
        });
        $(window).focusin(function (e) {
            if (currentDialog && e.relatedTarget && !elementOfControl(currentDialog.control, e.target)) {
                setImmediate(typerUI.focus, currentDialog.control.element);
            }
        });
        $(window).bind('resize scroll orientationchange', function () {
            setImmediateOnce(updateSnaps);
        });
        $(document.body).bind('mousemove mousewheel keyup touchend', function () {
            setImmediateOnce(updateSnaps);
        });
        $(document.body).on('click', 'label', function (e) {
            // IE does not focus on focusable element when clicking containing LABEL element
            $(SELECTOR_FOCUSABLE, e.currentTarget).not(':disabled, :hidden').eq(0).focus();
        });
        $(document.body).bind(IS_TOUCH ? 'touchstart' : 'mousedown', function (e) {
            if (currentDialog && currentDialog.clickReject && !elementOfControl(currentDialog.control, e.target)) {
                currentDialog.clickReject();
            }
            $.each(currentCallouts.slice(0), function (i, v) {
                if (!elementOfControl(v.control, e.target) && (!v.focusedElement || !containsOrEquals(v.focusedElement, e.target))) {
                    hideCallout(v.control);
                }
            });
        });

        if (IS_TOUCH) {
            // focusout event is not fired immediately after the element loses focus when user touches other element
            // manually blur and trigger focusout event to notify Typer and other component
            var lastActiveElement;
            $(document.body).bind('focusin focusout', function (e) {
                lastActiveElement = e.type === 'focusin' ? e.target : null;
            });
            $(document.body).bind('touchend', function (e) {
                if (lastActiveElement && !containsOrEquals(lastActiveElement, e.target)) {
                    lastActiveElement.blur();
                    $(lastActiveElement).trigger($.Event('focusout', {
                        relatedTarget: e.target
                    }));
                }
            });
        }

        // helper element for detecting fixed position offset to the client screen
        originDiv = $('<div style="position:fixed;top:0;left:0;">').appendTo(document.body)[0];
    });

}(jQuery, window.Typer, Object, RegExp, Node, window, document));

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
        beforeStateChange: function (e) {
            var elements = e.typer.getSelection().getSelectedElements();
            $.extend(e.widget, {
                bold: !!Typer.ui.matchWSDelim(computePropertyValue(elements, 'fontWeight'), 'bold 700'),
                italic: computePropertyValue(elements, 'fontStyle') === 'italic',
                underline: computePropertyValue(elements, 'textDecoration') === 'underline',
                strikeThrough: computePropertyValue(elements, 'textDecoration') === 'line-through',
                superscript: !!$(elements).filter('sup')[0],
                subscript: !!$(elements).filter('sub')[0],
                inlineClass: computePropertyValue($(elements).filter('span'), 'inlineClass')
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
            name: LIST_STYLE_TYPE[type],
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
            allowEmpty: true,
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
                return isEnabled(toolbar, false) && toolbar.typer.getSelection().widgetAllowed('list');
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
                return isEnabled(toolbar, false) && toolbar.typer.getSelection().widgetAllowed('list');
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

    Typer.ui.addLabels('en', 'typer:formatting:orderedList', {
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

    Typer.ui.addHook('tab', function (e) {
        if (!e.isDefaultPrevented() && e.typer.widgetEnabled('list')) {
            e.typer.invoke(indentCommand);
            e.preventDefault();
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
        'link:selectLink:text': Typer.ui.textbox({
            presetOptions: {
                required: true
            }
        }),
        'link:selectLink:url': Typer.ui.textbox({
            presetOptions: {
                required: true
            }
        }),
        'link:selectLink:blank': Typer.ui.checkbox(),
        'link:selectLink:buttonset': Typer.ui.group('dialog:buttonOK dialog:buttonCancel remove', 'buttonset'),
        'link:selectLink:buttonset:remove': Typer.ui.button({
            hiddenWhenDisabled: true,
            buttonsetGroup: 'left',
            cssClass: 'warn',
            enabled: function (ui) {
                return !!ui.parentControl.widget;
            }
        }),
        'link:selectLink': Typer.ui.dialog({
            controls: '*',
            valueMap: {
                text: 'text',
                href: 'url',
                blank: 'blank'
            },
            setup: function (ui, self, resolve, reject) {
                self.resolveOne('buttonset').resolveOne('remove').execute = function () {
                    ui.parentControl.widget.remove();
                    reject();
                };
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
        'link:selectLink:buttonset:remove': 'Remove'
    });

    Typer.ui.addIcons('material', 'typer', {
        'toolbar:link': '\ue250', // insert_link
        'link:url': '\ue250' // insert_link
    });

    Typer.ui.addHook('space enter', function (e) {
        if (e.typer.widgetEnabled('link')) {
            var originalSelection = e.typer.getSelection().clone();
            var selection = originalSelection.clone();
            if (e.data === 'enter') {
                selection.moveByCharacter(-1);
            }
            if (selection.getCaret('start').moveByWord(-1) && selection.focusNode.widget.id !== 'link' && /^(([a-z]+:)\/\/^s+|\S+@\S+\.\S+)/g.test(selection.getSelectedText())) {
                var link = (RegExp.$2 || 'mailto:') + RegExp.$1;
                e.typer.snapshot(true);
                e.typer.select(selection);
                e.typer.invoke(function (tx) {
                    tx.insertWidget('link', link);
                });
                e.typer.select(originalSelection);
                if (e.data === 'space') {
                    e.preventDefault();
                }
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
            dialog: function (toolbar) {
                if (typeof toolbar.options.selectMedia === 'function') {
                    return toolbar.options.selectMedia(type);
                }
                return toolbar.prompt('typer:media:selectImage');
            },
            execute: function (toolbar, self, tx, value) {
                tx.insertWidget('media', value);
            },
            enabled: function (toolbar) {
                return toolbar.typer.getSelection().widgetAllowed('media');
            },
            visible: function (toolbar) {
                return toolbar.typer.widgetEnabled('media');
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

    function toggleClass(widget, className, value) {
        $(widget.typer.element).parents(widget.options.target).andSelf().eq(0).toggleClass(widget.options[className], value);
    }

    Typer.widgets.stateclass = {
        options: {
            target: null,
            focused: 'focused',
            empty: 'empty'
        },
        focusin: function (e) {
            toggleClass(e.widget, 'focused', true);
        },
        focusout: function (e) {
            toggleClass(e.widget, 'focused', false);
        },
        contentChange: function (e) {
            toggleClass(e.widget, 'empty', !e.typer.hasContent());
        },
        init: function (e) {
            toggleClass(e.widget, 'empty', !e.typer.hasContent());
        }
    };

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
            $(self.element).click(function () {
                toolbar.execute(self);
            });
        }
    });

    Typer.ui.addControls('typer', {
        'insert:table': Typer.ui.callout({
            requireWidgetEnabled: 'table',
            enabled: function (toolbar) {
                return toolbar.typer.getSelection().widgetAllowed('table');
            },
            visible: function (toolbar) {
                return toolbar.typer.widgetEnabled('table');
            }
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
                        execute: function (toolbar, self, tx) {
                            self.widget.element.className = v;
                            tx.trackChange(self.widget.element);
                        }
                    });
                });
                var fallbackOption = Typer.ui.button({
                    requireWidget: 'table',
                    label: 'typer:table:styleDefault',
                    execute: function (toolbar, self, tx) {
                        self.widget.element.className = '';
                        tx.trackChange(self.widget.element);
                    }
                });
                return definedOptions.concat(fallbackOption);
            }
        }),
        'table:tableWidth': Typer.ui.callout(),
        'table:tableWidth:fitContent': Typer.ui.button({
            requireWidget: 'table',
            execute: function (toolbar, self, tx) {
                $(self.widget.element).removeAttr('width');
                tx.trackChange(self.widget.element);
            }
        }),
        'table:tableWidth:fullWidth': Typer.ui.button({
            requireWidget: 'table',
            execute: function (toolbar, self, tx) {
                $(self.widget.element).attr('width', '100%');
                tx.trackChange(self.widget.element);
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
                var rect = Typer.ui.getRect((toolbar.widget || toolbar.typer).element);
                if (rect.left === 0 && rect.top === 0 && rect.width === 0 && rect.height === 0) {
                    // invisible element or IE bug related - https://connect.microsoft.com/IE/feedback/details/881970
                    return;
                }
                position = {
                    position: 'fixed',
                    left: rect.left,
                    top: Math.max(0, rect.top - height - 10)
                };
            }
            if (position) {
                var range = toolbar.typer.getSelection().getRange();
                if (range) {
                    var r = range.getClientRects()[0] || Typer.ui.getRect(range);
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
            executed: function (ui, control) {
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
                setTimeout(function () {
                    // fix IE11 rendering issue when mousedown on contextmenu
                    // without moving focus beforehand
                    toolbar.element.focus();
                });
            });
            $(typer.element).bind('click', function (e) {
                if (e.which === 1)  {
                    toolbar.hide();
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
            '.N>div{position:fixed;}' +
            '.N>.border{box-sizing:border-box;border:1px solid rgba(0,31,81,0.2);}' +
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
        var bRect = Typer.ui.getRect(container.nodeType === 1 ? container : container.parentNode);
        var rects = $.map(range.getClientRects(), function (v) {
            return {
                top: v.top,
                left: v.left,
                right: v.right,
                bottom: v.bottom
            };
        });
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

            function drawLayer(className, rect, extraCSS) {
                var d = dom[domCount] = dom[domCount] || freeDiv.pop() || $('<div>')[0];
                d.className = className;
                d.removeAttribute('style');
                $(d).css(Typer.ui.cssFromRect(rect)).css(extraCSS || {});
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
                    var dom = drawLayer(type === 'text-fill' ? 'fill' : 'border', v);
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
                var bRect = Typer.ui.getRect(v.element);
                drawLayer('border', bRect);
                if (v.type === 'block') {
                    drawLayer('elm', bRect).setAttribute('elm', getElementMarker(v.element));
                } else if (v.type === 'block-fill') {
                    drawLayer('fill', bRect);
                } else if (v.type === 'block-margin') {
                    var style = window.getComputedStyle(v.element);
                    var s = {};
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
                    drawLayer('fill-margin', bRect, s);
                    $('br', v.element).each(function (i, v) {
                        drawLayer('newline', Typer.ui.getRect(v));
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
            var currentRect = Typer.ui.getRect(activeTyper.element);
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

(function ($, Typer, Date) {
    'use strict';

    var MS_PER_DAY = 86400000;
    var monthstr = 'January February March April May June July August September October November December'.split(' ');
    var shortWeekday = 'Su Mo Tu We Th Fr Sa'.split(' ');
    var activeTyper;
    var callout;

    function getFullYear(d) {
        return d.getFullYear();
    }

    function getMonth(d) {
        return d.getMonth();
    }

    function getDate(d) {
        return d.getDate();
    }

    function getHours(d) {
        return d.getHours();
    }

    function getMinutes(d) {
        return d.getMinutes();
    }

    function repeat(str, count) {
        return new Array(count + 1).join(str);
    }

    function sameMonth(x, y) {
        return getFullYear(x) === getFullYear(y) && getMonth(x) === getMonth(y);
    }

    function parseMaxima(d) {
        if (typeof d === 'string' && /^today|([+-]\d+)(day|week|month|year)?$/g.test(d)) {
            return RegExp.$1 ? stepDate(RegExp.$2 || 'day', new Date(), +RegExp.$1) : new Date();
        }
        d = d === null ? undefined : d instanceof Date ? d : new Date(d);
        return isNaN(d) ? undefined : d;
    }

    function makeTime(h, m) {
        var date = new Date();
        date.setHours(h, m, 0, 0);
        return date;
    }

    function normalizeDate(options, date) {
        var min = parseMaxima(options.min);
        var max = parseMaxima(options.max);
        date = new Date(+(date < min ? min : date > max ? max : date));
        switch (options.mode || options) {
            case 'week':
                date.setDate(getDate(date) - date.getDay());
                break;
            case 'month':
                date.setDate(1);
                break;
        }
        if ((options.mode || options) !== 'datetime') {
            date.setHours(0, 0, 0, 0);
        } else {
            date.setSeconds(0, 0);
        }
        return date;
    }

    function stepDate(mode, date, dir, step) {
        switch (mode) {
            case 'minute':
                var d = dir / Math.abs(dir);
                return new Date(+date + 60000 * ((((d > 0 ? step : 0) - (getMinutes(date) % step)) || (step * d)) + (step * (dir - d))));
            case 'day':
                return new Date(+date + MS_PER_DAY * dir);
            case 'week':
                return new Date(+date + MS_PER_DAY * 7 * dir);
            case 'month':
                return new Date(getFullYear(date), getMonth(date) + dir, getDate(date));
            case 'year':
                return new Date(getFullYear(date) + dir, getMonth(date), getDate(date));
        }
    }

    function formatDate(mode, date) {
        switch (mode) {
            case 'month':
                return monthstr[getMonth(date)] + ' ' + getFullYear(date);
            case 'week':
                var end = stepDate('day', date, 6);
                return monthstr[getMonth(date)] + ' ' + getDate(date) + ' - ' + (getMonth(end) !== getMonth(date) ? monthstr[getMonth(end)] + ' ' : '') + getDate(end) + ', ' + getFullYear(date);
        }
        var monthPart = monthstr[getMonth(date)] + ' ' + getDate(date) + ', ' + getFullYear(date);
        return mode === 'datetime' ? monthPart + ' ' + (getHours(date) || 12) + ':' + ('0' + getMinutes(date)).slice(-2) + ' ' + (getHours(date) >= 12 ? 'PM' : 'AM') : monthPart;
    }

    function initDatepicker() {
        callout = Typer.ui({
            type: 'contextmenu',
            controls: [Typer.ui.datepicker()],
            executed: function (ui, control) {
                if (activeTyper && control.is('calendar clock')) {
                    activeTyper.setValue(ui.getValue());
                    if (control.is('calendar')) {
                        ui.hide();
                    }
                }
            }
        });
    }

    Typer.ui.define('calendar', {
        type: 'calendar',
        defaultNS: 'calendar',
        controls: '*',
        showButtonLabel: false,
        mode: 'day',
        min: null,
        max: null,
        get value() {
            return normalizeDate(this, this.selectedDate);
        },
        set value(value) {
            this.selectedDate = normalizeDate(this, value);
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
                e.preventDefault();
            });
            $table.find('td').click(function () {
                var monthDelta = $(this).hasClass('prev') ? -1 : $(this).hasClass('next') ? 1 : 0;
                ui.execute(self, new Date(getFullYear(self.currentMonth), getMonth(self.currentMonth) + monthDelta, +this.textContent));
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
            var min = parseMaxima(self.min);
            var max = parseMaxima(self.max);
            var currentMonth = normalizeDate({
                mode: 'month',
                min: min,
                max: max
            }, date);
            var firstDay = currentMonth.getDay();
            var $buttons = $('td', self.element).removeClass('selected disabled');

            if (!self.currentMonth || !sameMonth(currentMonth, self.currentMonth)) {
                var y = getFullYear(currentMonth);
                var m = getMonth(currentMonth);
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
                if (sameMonth(currentMonth, today)) {
                    $buttons.eq(getDate(today) + firstDay - 1).addClass('today');
                }
                $('tr:last', self.element).toggle(firstDay + numDays > 35);

                var cy = ui.resolveOne('year');
                var cm = ui.resolveOne('month');
                $.each(cy.controls, function (i, v) {
                    v.label = v.value = y + i - 5;
                });
                cy.value = y;
                cm.value = m;
                self.currentMonth = currentMonth;
            }
            if (min && sameMonth(currentMonth, min)) {
                $buttons.slice(0, getDate(min) + firstDay - 1).addClass('disabled');
            }
            if (max && sameMonth(currentMonth, max)) {
                $buttons.slice(getDate(max) + firstDay).addClass('disabled');
            }
            var selected = sameMonth(currentMonth, self.value);
            if (selected || (self.mode === 'week' && sameMonth(currentMonth, stepDate('day', self.value, 6)))) {
                switch (self.mode) {
                    case 'day':
                        $buttons.eq(getDate(self.value) + firstDay - 1).addClass('selected');
                        break;
                    case 'week':
                        $buttons.slice(selected ? getDate(self.value) + firstDay - 1 : 0).slice(0, 7).addClass('selected');
                        break;
                    case 'month':
                        $buttons.filter('td.cur').addClass('selected');
                        break;
                }
            }
            $(self.element).toggleClass('select-range', self.mode !== 'day');
        }
    });

    Typer.ui.define('clock', {
        type: 'clock',
        defaultNS: 'clock',
        controls: '*',
        step: 1,
        init: function (ui, self) {
            // only allow minute interval that is a factor of 60
            // to maintain consistent step over hours
            if (60 % self.step > 0) {
                self.step = 1;
            }
            var $face = $('.typer-ui-clock-face', self.element);
            $(repeat('<i></i>', 12)).appendTo($face).each(function (i, v) {
                $(v).css('transform', 'rotate(' + (i * 30) + 'deg)');
            });
            $('s', self.element).bind('mousedown touchstart', function (e) {
                var elm = e.target;
                var center = Typer.ui.getRect(elm.parentNode);
                center = {
                    top: (center.top + center.bottom) / 2,
                    left: (center.left + center.right) / 2
                };
                var isTouch = e.type === 'touchstart';
                var handlers = {};
                handlers[isTouch ? 'touchmove' : 'mousemove'] = function (e) {
                    if (!isTouch && e.which !== 1) {
                        return handlers.mouseup();
                    }
                    var point = isTouch ? e.originalEvent.touches[0] : e;
                    var rad = Math.atan2(point.clientY - center.top, point.clientX - center.left) / Math.PI;
                    var curM = getMinutes(self.value);
                    var curH = getHours(self.value);
                    if (elm.getAttribute('hand') === 'm') {
                        var m = (Math.round((rad * 30 + 75) / self.step) * self.step) % 60;
                        if (m !== curM) {
                            var deltaH = Math.floor(Math.abs(curM - m) / 30) * (m > curM ? -1 : 1);
                            self.setValue(makeTime(curH + deltaH, m));
                        }
                    } else {
                        var h = Math.round(rad * 6 + 15) % 12 + (ui.getValue('meridiem') === 'am' ? 0 : 12);
                        if (h !== curH) {
                            self.setValue(makeTime(h, curM));
                        }
                    }
                };
                handlers[isTouch ? 'touchend' : 'mouseup'] = function () {
                    $(document.body).unbind(handlers);
                    ui.execute(self);
                };
                if (e.which === 1 || (e.originalEvent.touches || '').length === 1) {
                    $(document.body).bind(handlers);
                }
            });
            var mousewheelTimeout;
            $(self.element).bind('mousewheel', function (e) {
                self.setValue(stepDate('minute', self.value, Typer.ui.getWheelDelta(e), self.step));
                e.preventDefault();
                clearImmediate(mousewheelTimeout);
                mousewheelTimeout = setImmediate(function () {
                    ui.execute(self);
                });
            });
            self.setValue(new Date());
        },
        stateChange: function (ui, self) {
            var date = self.value;
            ui.resolveOne('minute').presetOptions.step = self.step;
            ui.setValue('hour', getHours(date));
            ui.setValue('minute', getMinutes(date));
            ui.setValue('meridiem', getHours(date) >= 12 ? 'pm' : 'am');
            $('s[hand="h"]', self.element).css('transform', 'rotate(' + (getHours(date) * 30 + getMinutes(date) * 0.5 - 90) + 'deg)');
            $('s[hand="m"]', self.element).css('transform', 'rotate(' + (getMinutes(date) * 6 - 90) + 'deg)');
        }
    });

    Typer.ui.define('datepicker', {
        renderAs: 'buttonset',
        mode: 'day',
        minuteStep: 1,
        min: null,
        max: null,
        controls: [
            Typer.ui.calendar({
                name: 'calendar'
            }),
            Typer.ui.clock({
                name: 'clock',
                hiddenWhenDisabled: true,
                enabled: function (ui, self) {
                    return self.contextualParent.mode === 'datetime';
                }
            })
        ],
        get value() {
            var date = this.ui.getValue('calendar');
            if (this.ui.enabled('clock')) {
                var time = this.ui.getValue('clock');
                date.setHours(getHours(time), getMinutes(time), 0, 0);
            }
            return date;
        },
        set value(value) {
            value = new Date(typeof value === 'string' ? value : +value);
            if (isNaN(+value)) {
                value = new Date();
            }
            this.ui.setValue('calendar', value);
            this.ui.setValue('clock', value);
        },
        stateChange: function (ui, self) {
            ui.set('calendar', {
                mode: self.mode === 'datetime' ? 'day' : self.mode,
                min: self.min,
                max: self.max
            });
            ui.set('clock', 'step', self.minuteStep);
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
                ui.trigger(self.contextualParent, 'showMonth', new Date(self.value, getMonth(self.contextualParent.currentMonth)));
            }
        }),
        month: Typer.ui.dropdown({
            execute: function (ui, self) {
                ui.trigger(self.contextualParent, 'showMonth', new Date(getFullYear(self.contextualParent.currentMonth), self.value));
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

    Typer.ui.addControls('clock', {
        hour: Typer.ui.textbox({
            preset: 'number',
            presetOptions: {
                min: 0,
                max: 23,
                loop: true
            },
            execute: function (ui, self) {
                ui.execute(self.contextualParent, makeTime(self.value, ui.getValue('clock:minute')));
            }
        }),
        timeSeperator: Typer.ui.label({
            value: ':'
        }),
        minute: Typer.ui.textbox({
            preset: 'number',
            presetOptions: {
                min: 0,
                max: 59,
                digits: 'fixed',
                loop: true
            },
            execute: function (ui, self) {
                ui.execute(self.contextualParent, makeTime(ui.getValue('clock:hour'), self.value));
            }
        }),
        meridiem: Typer.ui.button({
            execute: function (ui, self) {
                ui.setValue(self, self.value === 'am' ? 'pm' : 'am');
                ui.execute(self.contextualParent, makeTime(ui.getValue('clock:hour') % 12 + (self.value === 'am' ? 0 : 12), ui.getValue('clock:minute')));
            },
            stateChange: function (ui, self) {
                self.label = 'clock:meridiem:' + self.value;
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

    Typer.ui.addLabels('en', 'clock:meridiem', {
        am: 'AM',
        pm: 'PM'
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
        calendar: '<div class="typer-ui-calendar"><div class="typer-ui-calendar-header"><br x:t="buttonset"/></div><div class="typer-ui-calendar-body"><table></table></div></div>',
        clock: '<div class="typer-ui-clock"><div class="typer-ui-clock-face"><s hand="h"></s><s hand="m"></s></div><br x:t="buttonset"/></div>',
        formatDate: null
    });

    Typer.presets.datepicker = {
        options: {
            mode: 'day',
            minuteStep: 1,
            min: null,
            max: null,
            required: false,
            formatDate: null
        },
        overrides: {
            getValue: function (preset) {
                return preset.selectedDate ? normalizeDate(preset.options, preset.selectedDate) : null;
            },
            setValue: function (preset, date) {
                preset.selectedDate = date ? normalizeDate(preset.options, date) : null;
                preset.softSelectedDate = null;

                var text = '';
                if (date) {
                    var format = function (fn) {
                        return $.isFunction(fn) && fn(preset.options.mode, date);
                    };
                    text = format(preset.options.formatDate) ||
                           format(preset.typer.parentControl && Typer.ui.themes[preset.typer.parentControl.ui.theme].formatDate) ||
                           format(formatDate);
                }
                if (text !== this.extractText()) {
                    this.invoke(function (tx) {
                        tx.selection.selectAll();
                        tx.insertText(text);
                    });
                    if (this === activeTyper) {
                        callout.setValue(preset.selectedDate || new Date());
                    }
                }
            },
            hasContent: function (preset) {
                return !!this.extractText();
            },
            validate: function (preset, assert) {
                assert(!preset.options.required || !!preset.selectedDate, 'required');
            }
        },
        commands: {
            step: function (tx, value) {
                var options = tx.widget.options;
                var date = stepDate(options.mode === 'datetime' ? 'minute' : options.mode, tx.typer.getValue() || new Date(), value, options.minuteStep);
                tx.typer.setValue(date);
            }
        },
        contentChange: function (e) {
            if (e.typer === activeTyper && e.data !== 'script') {
                var date = new Date(e.typer.extractText());
                if (!isNaN(+date)) {
                    callout.setValue(normalizeDate(e.widget.options, date));
                }
                e.widget.softSelectedDate = date;
            }
        },
        click: function (e) {
            if (e.typer === activeTyper) {
                callout.show(e.typer.element);
            }
        },
        mousewheel: function (e) {
            e.typer.invoke('step', e.data);
            e.preventDefault();
        },
        upArrow: function (e) {
            e.typer.invoke('step', -1);
        },
        downArrow: function (e) {
            e.typer.invoke('step', 1);
        },
        focusin: function (e) {
            if (!callout) {
                initDatepicker();
            }
            callout.retainFocus(e.typer);
            activeTyper = e.typer;

            var options = e.widget.options;
            callout.set('(type:datepicker)', {
                mode: options.mode,
                minuteStep: options.minuteStep,
                min: options.min,
                max: options.max
            });
            callout.setValue(e.typer.getValue() || new Date());
            callout.show(e.typer.element);
            if (Typer.ui.isTouchDevice) {
                setImmediate(function () {
                    if (e.typer === activeTyper) {
                        callout.focus();
                    }
                });
            }
        },
        focusout: function (e) {
            setImmediate(function () {
                if (e.typer === activeTyper) {
                    activeTyper = null;
                    callout.hide();
                }
            });
            if (e.typer === activeTyper && e.widget.softSelectedDate) {
                e.typer.setValue(isNaN(+e.widget.softSelectedDate) ? e.widget.selectedDate : e.widget.softSelectedDate);
            }
        }
    };

}(jQuery, window.Typer, Date));

(function ($, Typer) {
    'use strict';

    function encode(v) {
        var a = document.createTextNode(v.replace(/\s/g, '\u00a0')),
            b = document.createElement('div');
        b.appendChild(a);
        return b.innerHTML;
    }

    function valueChanged(x, y) {
        var hash = {};
        x.forEach(function (v) {
            hash[v] = true;
        });
        y.forEach(function (v) {
            delete hash[v];
        });
        for (var i in hash) {
            return true;
        }
    }

    function fuzzyMatch(haystack, needle) {
        haystack = String(haystack || '');
        var vector = [];
        var str = haystack.toLowerCase();
        var j = 0;
        var lastpos = -1;
        for (var i = 0; i < needle.length; i++) {
            var l = needle.charAt(i).toLowerCase();
            if (l == ' ') {
                continue;
            }
            j = str.indexOf(l, j);
            if (j == -1) {
                return {
                    firstIndex: Infinity,
                    consecutiveMatches: -1,
                    formattedText: haystack
                };
            }
            vector[vector.length] = j - lastpos - 1;
            lastpos = j++;
        }
        var firstIndex = vector[0];
        var consecutiveMatches = /^(0+)/.test(vector.slice(0).sort().join('')) && RegExp.$1.length;
        var formattedText = '';
        j = 0;
        for (i = 0; i < vector.length; i++) {
            formattedText += encode(haystack.substr(j, vector[i])) + '<b>' + encode(haystack[j + vector[i]]) + '</b>';
            j += vector[i] + 1;
        }
        formattedText += encode(haystack.slice(j));
        return {
            firstIndex: firstIndex,
            consecutiveMatches: consecutiveMatches,
            formattedText: formattedText.replace(/<\/b><b>/g, '')
        };
    }

    function processSuggestions(suggestions, needle, count) {
        suggestions = suggestions.filter(function (v) {
            $.extend(v, fuzzyMatch(v.displayText, needle));
            var m = fuzzyMatch(v.value, needle);
            v.firstIndex = Math.min(v.firstIndex, m.firstIndex);
            v.consecutiveMatches = Math.max(v.consecutiveMatches, m.consecutiveMatches);
            if (v.matches) {
                v.matches.forEach(function (w) {
                    var m = fuzzyMatch(w, needle);
                    v.firstIndex = Math.min(v.firstIndex, m.firstIndex);
                    v.consecutiveMatches = Math.max(v.consecutiveMatches, m.consecutiveMatches);
                });
            }
            return v.firstIndex !== Infinity;
        });
        suggestions.sort(function (a, b) {
            return ((b.consecutiveMatches - a.consecutiveMatches) + (a.firstIndex - b.firstIndex)) || a.value.localeCompare(b.value);
        });
        return suggestions.slice(0, count);
    }

    function showSuggestions(preset) {
        var value = preset.typer.extractText();
        var suggestions = preset.options.suggestions || preset.options.allowedValues || [];
        if ($.isFunction(suggestions)) {
            suggestions = suggestions(value);
        }
        $.when(suggestions).done(function (suggestions) {
            suggestions = suggestions.map(function (v) {
                if (typeof v === 'string') {
                    return {
                        value: v,
                        displayText: v
                    };
                }
                return v;
            });
            suggestions.forEach(function (v) {
                preset.knownValues[v.value] = v.displayText;
            });

            var currentValues = preset.typer.getValue();
            suggestions = suggestions.filter(function (v) {
                return currentValues.indexOf(v.value) < 0;
            });
            suggestions = processSuggestions(suggestions, value, preset.options.suggestionCount);
            if (value && preset.options.allowFreeInput) {
                suggestions.push({
                    value: value,
                    displayText: value,
                    formattedText: '<i>' + encode(value) + '</i>'
                });
            }
            preset.suggestions = suggestions;

            var html;
            if (suggestions.length) {
                html = '<button>' + suggestions.map(function (v) {
                    return v.formattedText;
                }).join('</button><button>') + '</button>';
            } else {
                html = '<button class="disabled">No suggestions</button>';
            }
            $('.typer-ui-buttonlist', preset.callout.element).html(html);
        });
        setTimeout(function () {
            if (preset.typer.focused()) {
                preset.callout.show(preset.typer.element);
            }
        });
    }

    function validate(preset, value) {
        return (preset.options.allowFreeInput || preset.knownValues[value]) && preset.options.validate(value);
    }

    Typer.presets.keyword = {
        options: {
            required: false,
            allowFreeInput: true,
            allowedValues: null,
            suggestionCount: 5,
            suggestions: false,
            validate: function () {
                return true;
            }
        },
        overrides: {
            getValue: function (preset) {
                return $('span', this.element).map(function (i, v) {
                    return String($(v).data('value'));
                }).get();
            },
            setValue: function (preset, values) {
                values = ($.isArray(values) ? values : String(values).split(/\s+/)).filter(function (v) {
                    return v;
                });
                if (valueChanged(values, this.getValue())) {
                    this.invoke(function (tx) {
                        tx.selection.select(tx.typer.element, 'contents');
                        tx.insertText('');
                        values.forEach(function (v) {
                            tx.typer.invoke('add', v);
                        });
                    });
                }
            },
            hasContent: function () {
                return !!($('span', this.element)[0] || this.extractText());
            },
            validate: function (preset, assert) {
                assert(!preset.options.required || this.getValue().length, 'required');
                assert(!$('.invalid', this.element)[0], 'invalid-value');
            }
        },
        widgets: {
            tag: {
                element: 'span',
                inline: true,
                editable: 'none',
                insert: function (tx, value) {
                    tx.insertHtml('<span class="typer-ui-keyword" data-value="' + encode(value.value) + '">' + encode(value.displayText) + '<i>delete</i></span>');
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
                if (!value || tx.typer.getValue().indexOf(value.value || value) >= 0) {
                    return;
                }
                if (typeof value === 'string') {
                    value = {
                        value: value,
                        displayText: tx.widget.knownValues[value] || value
                    };
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
                if (!validate(tx.widget, value.value)) {
                    $(lastSpan).addClass('invalid');
                }
            }
        },
        init: function (e) {
            e.typer.getSelection().moveToText(e.typer.element, -0);
            e.widget.knownValues = {};
            e.widget.suggestions = [];
            e.widget.callout = Typer.ui({
                type: 'contextmenu',
                typer: e.typer
            });
            $(e.widget.callout.element).on('click', 'button', function (e2) {
                e.typer.invoke('add', e.widget.suggestions[$(this).index()]);
                e.typer.getSelection().focus();
                showSuggestions(e.widget);
            });
        },
        click: function (e) {
            e.widget.selectedIndex = -1;
        },
        focusin: function (e) {
            showSuggestions(e.widget);
        },
        focusout: function (e) {
            e.widget.selectedIndex = -1;
            e.widget.callout.hide();
            e.typer.invoke('add', e.typer.extractText());
        },
        upArrow: function (e) {
            if (e.widget.selectedIndex >= 0) {
                $('button', e.widget.callout.element).removeClass('active').eq(e.widget.selectedIndex--).prev().addClass('active');
            }
        },
        downArrow: function (e) {
            if (e.widget.selectedIndex < $('button', e.widget.callout.element).length - 1) {
                $('button', e.widget.callout.element).removeClass('active').eq(++e.widget.selectedIndex).addClass('active');
            }
        },
        enter: function (e) {
            if (e.widget.selectedIndex >= 0) {
                e.typer.invoke('add', e.widget.suggestions[e.widget.selectedIndex]);
                e.widget.selectedIndex = -1;
            } else {
                e.typer.invoke('add', e.typer.extractText());
            }
        },
        keystroke: function (e) {
            if (e.data === 'escape' && $.contains(document.body, e.widget.callout)) {
                e.widget.selectedIndex = -1;
                e.widget.callout.hide();
                e.preventDefault();
            }
        },
        contentChange: function (e) {
            if (e.data === 'textInput' || e.data === 'keystroke') {
                showSuggestions(e.widget);
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
            step: 1,
            loop: false
        },
        overrides: {
            getValue: function (preset) {
                return parseInt(this.extractText());
            },
            setValue: function (preset, value) {
                value = +value || 0;
                var min = preset.options.min;
                var max = preset.options.max;
                var loop = preset.options.loop && min !== null && max !== null;
                if ((loop && value < min) || (!loop && max !== null && value > max)) {
                    value = max;
                } else if ((loop && value > max) || (!loop &&  min !== null && value < min)) {
                    value = min;
                }
                value = String(+value || 0);
                if (preset.options.digits === 'fixed') {
                    var numOfDigits = String(+preset.options.max || 0).length;
                    value = (new Array(numOfDigits + 1).join('0') + value).substr(-numOfDigits);
                }
                if (value !== this.extractText()) {
                    this.invoke(function (tx) {
                        tx.selection.selectAll();
                        tx.insertText(value);
                    });
                }
            },
            hasContent: function () {
                return !!this.extractText();
            },
            validate: function (preset) {
                return true;
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
            validate: function (preset, assert) {
                assert(!preset.options.required || this.getValue(), 'required');
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
        var rect = Typer.ui.getRect(callout);
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

    function bindEvent(ui, element) {
        $(element || ui.element).click(function (e) {
            var control = ui.getControl(e.target);
            if (control) {
                if (control.is('checkbox')) {
                    ui.execute(control, !control.value);
                } else if (control.is('button callout')) {
                    ui.execute(control);
                }
            }
        });
    }

    function runCSSTransition(element, className, callback) {
        if (!$(element).hasClass(className)) {
            var deferred = $.Deferred();
            var handler = function (e) {
                if ($(element).hasClass(className)) {
                    $(element).toggleClass(className, !Typer.ui.matchWSDelim(e.type, ANIMATION_END));
                    $(element).unbind(TRANSITION_END + ' ' + ANIMATION_END, handler);
                    deferred.resolveWith(e.target);
                }
            };
            $(element).addClass(className).one(TRANSITION_END + ' ' + ANIMATION_END, handler);
            return deferred.promise().done(callback);
        }
        return $.when();
    }

    function detachCallout(control) {
        control.callout = $(control.element).children('.typer-ui-float').detach().addClass('typer-ui typer-ui-material is-' + control.type)[0];
        bindEvent(control.ui, control.callout);
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
        controlErrorClass: 'error',
        iconset: 'material',
        label: '<span class="typer-ui-label"><br x:t="labelIcon"/><br x:t="labelText"/></span>',
        labelText: function (ui, control) {
            if (control.is('textbox') || (!control.contextualParent.showButtonLabel && ui.getIcon(control))) {
                return '';
            }
            return '<span x:bind="(_:label)"></span>';
        },
        labelIcon: function (ui, control) {
            if (control.contextualParent.is('dropdown') || control.is('checkbox') || !ui.getIcon(control)) {
                return '';
            }
            return '<i class="material-icons" x:bind="(_:icon)"></i>';
        },
        buttonset: '<div class="typer-ui-buttonset"><br x:t="children(buttonsetGroup:left)"/><div class="typer-ui-buttonset-pad"></div><br x:t="children(buttonsetGroup:right)"/></div>',
        buttonlist: '<div class="typer-ui-buttonlist"><br x:t="children"/></div>',
        form: '<div class="typer-ui-form"><br x:t="children"/></div>',
        menupane: '<div class="typer-ui-float"><div class="typer-ui-buttonlist"><br x:t="children"/></div></div>',
        toolbar: '<div class="typer-ui-buttonset is-toolbar"><br x:t="children"/></div>',
        contextmenu: '<div class="typer-ui-float is-contextmenu anim-target"><div class="typer-ui-buttonlist"><br x:t="children"/></div></div>',
        group: '<div class="typer-ui-group"><br x:t="children"/></div>',
        groupStateChange: function (ui, control) {
            setImmediate(function () {
                control.setState('sep-before', !!$(control.element).prevAll(':not(.hidden)')[0]);
                control.setState('sep-after', !!$(control.element).nextAll(':not(.hidden):first:not(.typer-ui-group)')[0]);
            });
        },
        link: '<label class="has-clickeffect"><a x:bind="(href:value,title:label)"><br x:t="label"/><span class="typer-ui-label-annotation" role="shortcut" x:bind="(_:shortcut)"></span><span class="typer-ui-label-annotation" x:bind="(_:annotation)"></span></a></label>',
        button: '<button x:bind="(title:label)"><br x:t="label"/><span class="typer-ui-label-annotation" role="shortcut" x:bind="(_:shortcut)"></span><span class="typer-ui-label-annotation" x:bind="(_:annotation)"></span></button>',
        file: '<label class="has-clickeffect" x:bind="(title:label)"><input type="file"/><br x:t="label"/></label>',
        fileInit: function (ui, control) {
            $(control.element).find(':file').change(function (e) {
                ui.execute(control, e.target.files);
                setImmediate(function () {
                    var form = document.createElement('form');
                    form.appendChild(e.target);
                    form.reset();
                    $(e.target).prependTo(control.element);
                });
            });
        },
        callout: '<label class="typer-ui-callout" x:bind="(title:label)"><br x:t="button"/><br x:t="menupane"/></label>',
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
        checkboxStateChange: function (ui, control) {
            control.setState('checked', !!control.value);
        },
        textboxInner: '<div class="typer-ui-textbox-inner"><div contenteditable spellcheck="false"></div><div class="typer-ui-textbox-placeholder" x:bind="(_:label)"></div><div class="typer-ui-textbox-error"></div></div>',
        textbox: '<label class="typer-ui-textbox" x:bind="(title:label)"><br x:t="label"/><div class="typer-ui-textbox-wrapper"><br x:t="textboxInner"/></div></label>',
        textboxElement: '[contenteditable]',
        textboxPresetOptions: {
            stateclass: {
                target: '.typer-ui-textbox'
            }
        },
        dialog: '<div class="typer-ui-dialog-wrapper"><div class="typer-ui-dialog-pin"></div><div class="typer-ui-dialog"><div class="typer-ui-dialog-inner anim-target"><div class="typer-ui-form"><br x:t="children"></div></div></div></div>',
        dialogInit: function (ui, control) {
            var parent = ui.parentControl;
            var dir = control.pinnable && parent && Typer.ui.matchWSDelim(parent.pinDirection, 'left right top bottom');
            control.setState('is-modal', !!control.modal);
            ui.setState(control.resolveBy, 'pin-active', true);
            if (dir) {
                control.setState('pinned', dir);
                parent.setState('pin-active', true);
            }
        },
        dialogWaiting: function (ui, control) {
            control.setState('loading', true);
        },
        dialogError: function (ui, control) {
            control.setState('loading', false);
        },
        dialogDestroy: function (ui, control) {
            if (ui.parentControl) {
                ui.parentControl.setState('pin-active', false);
            }
        },
        showCallout: function (ui, control) {
            if (control.callout) {
                ui.show(control, control.callout, control.element, 'left bottom');
            }
        },
        afterShow: function (ui, control, data) {
            if (control.is('dialog')) {
                var parent = ui.parentControl;
                var dir = control.pinnable && parent && Typer.ui.matchWSDelim(parent.pinDirection, 'left right top bottom');
                var e1 = $(control.element).find('.typer-ui-dialog')[0];
                var e2 = $(control.element).find('.typer-ui-dialog-pin')[0];
                if (dir) {
                    Typer.ui.snap(e1, parent.element, dir + ' center');
                    Typer.ui.snap(e2, parent.element, dir + ' center inset');
                } else {
                    Typer.ui.snap(e1, window, 'center inset');
                }
            }
            return control.is('dialog contextmenu') && runCSSTransition($('.anim-target', data.element)[0] || data.element, 'open');
        },
        beforeHide: function (ui, control, data) {
            return control.is('dialog contextmenu') && runCSSTransition($('.anim-target', data.element)[0] || data.element, 'closing').done(function () {
                $(this).removeClass('open closing');
            });
        },
        executed: function (ui, control) {
            if (control.is('button') && control.contextualParent.is('callout dropdown contextmenu') && control.contextualParent.hideCalloutOnExecute !== false) {
                ui.hide(control.contextualParent);
            }
        },
        init: function (ui, control) {
            bindEvent(ui);
        }
    });

    $(function () {
        var SELECT_EFFECT = '.typer-ui-material button:not(.typer-ui-checkbox), .typer-ui-material .has-clickeffect';
        $(document.body).on('mousedown', SELECT_EFFECT, function (e) {
            var pos = Typer.ui.getRect(e.currentTarget);
            var $overlay = $('<div class="typer-ui-clickeffect"><i></i></div>').appendTo(e.currentTarget);
            var $anim = $overlay.children().css({
                top: e.clientY - pos.top,
                left: e.clientX - pos.left,
            });
            var p1 = Math.pow(e.clientY - pos.top, 2) + Math.pow(e.clientX - pos.left, 2);
            var p2 = Math.pow(e.clientY - pos.top, 2) + Math.pow(e.clientX - pos.right, 2);
            var p3 = Math.pow(e.clientY - pos.bottom, 2) + Math.pow(e.clientX - pos.left, 2);
            var p4 = Math.pow(e.clientY - pos.bottom, 2) + Math.pow(e.clientX - pos.right, 2);
            var scalePercent = 0.5 + 2 * Math.sqrt(Math.max(p1, p2, p3, p4)) / parseFloat($overlay.css('font-size'));
            setImmediate(function () {
                $anim.css('transform', $anim.css('transform') + ' scale(' + scalePercent + ')').addClass('animate-in');
            });
            $overlay.css('border-radius', $(e.currentTarget).css('border-radius'));
        });
        $(document.body).on('mouseup mouseleave', SELECT_EFFECT, function (e) {
            var $overlay = $('.typer-ui-clickeffect', e.currentTarget);
            runCSSTransition($overlay.children(':not(.animate-out)'), 'animate-out', function () {
                $overlay.remove();
            });
        });
        $(document.body).on('mouseover', '.typer-ui-callout:has(>.typer-ui-float)', function (e) {
            setMenuPosition(e.currentTarget);
        });
        $(document.body).on('click', '.typer-ui-dialog-wrapper', function (e) {
            runCSSTransition($(e.target).find('.typer-ui-dialog-inner'), 'pop');
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
