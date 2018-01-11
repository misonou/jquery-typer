(function ($, window, document, String, Node, Range, DocumentFragment, WeakMap, array, RegExp) {
    'use strict';

    var KEYNAMES = JSON.parse('{"8":"backspace","9":"tab","13":"enter","16":"shift","17":"ctrl","18":"alt","19":"pause","20":"capsLock","27":"escape","32":"space","33":"pageUp","34":"pageDown","35":"end","36":"home","37":"leftArrow","38":"upArrow","39":"rightArrow","40":"downArrow","45":"insert","46":"delete","48":"0","49":"1","50":"2","51":"3","52":"4","53":"5","54":"6","55":"7","56":"8","57":"9","65":"a","66":"b","67":"c","68":"d","69":"e","70":"f","71":"g","72":"h","73":"i","74":"j","75":"k","76":"l","77":"m","78":"n","79":"o","80":"p","81":"q","82":"r","83":"s","84":"t","85":"u","86":"v","87":"w","88":"x","89":"y","90":"z","91":"leftWindow","92":"rightWindowKey","93":"select","96":"numpad0","97":"numpad1","98":"numpad2","99":"numpad3","100":"numpad4","101":"numpad5","102":"numpad6","103":"numpad7","104":"numpad8","105":"numpad9","106":"multiply","107":"add","109":"subtract","110":"decimalPoint","111":"divide","112":"f1","113":"f2","114":"f3","115":"f4","116":"f5","117":"f6","118":"f7","119":"f8","120":"f9","121":"f10","122":"f11","123":"f12","144":"numLock","145":"scrollLock","186":"semiColon","187":"equalSign","188":"comma","189":"dash","190":"period","191":"forwardSlash","192":"backtick","219":"openBracket","220":"backSlash","221":"closeBracket","222":"singleQuote"}');
    var VOID_TAGS = 'area base br col command embed hr img input keygen link meta param source track wbr'.split(' ');
    var INNER_PTAG = 'h1,h2,h3,h4,h5,h6,p,q,blockquote,pre,code,li,caption,figcaption,summary,dt,th';
    var SOURCE_PRIORITY = 'script keyboard mouse touch input drop cut paste'.split(' ');
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
        self.source = currentSource[1] === typer ? currentSource[0] : 'script';
        self.timestamp = performance.now();
        self.typer = typer;
        self.widget = widget || null;
        self.data = data !== undefined ? data : null;
    }

    function TyperNode(typer, nodeType, element, widget) {
        var self = this;
        self.typer = typer;
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

    function toRect(l, t, r, b) {
        if (l.top !== undefined) {
            return toRect(l.left, l.top, l.right, l.bottom);
        }
        return {
            top: t,
            left: l,
            right: r,
            bottom: b,
            width: r - l,
            height: b - t
        };
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
                        return [toRect(rect.right, rect.top, rect.right, rect.bottom)];
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

    function setImmediateOnce(fn) {
        clearImmediate(fn._timeout);
        fn._timeout = setImmediate(fn.bind.apply(fn, arguments));
    }

    function setEventSource(source, typer) {
        if (!currentSource[0]) {
            setImmediate(function () {
                // allow the event source to be accessible in immediate async event in the first round
                setImmediate(function () {
                    currentSource = [];
                });
            });
        }
        if ((currentSource[1] || typer) === typer && SOURCE_PRIORITY.indexOf(source) > SOURCE_PRIORITY.indexOf(currentSource[0])) {
            currentSource = [source, typer];
        }
    }

    function trackEventSource(element, typer) {
        $(element).bind('mousedown mouseup mousewheel keydown keyup keypress touchstart touchend', function (e) {
            var ch = e.type.charAt(0);
            setEventSource(ch === 'k' ? 'keyboard' : ch === 't' ? 'touch' : 'mouse', typer);

            // document.activeElement or FocusEvent.relatedTarget does not report non-focusable element
            lastTouchedElement = e.target;
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
        var changes = [];
        var undoable = {};
        var currentSelection;
        var executing;
        var needSnapshot;
        var suppressTextEvent;
        var typerFocused = false;
        var $self = $(topElement);

        var codeUpdate = (function () {
            var run = transaction(function () {
                executing = false;
                if (needSnapshot || changes[0]) {
                    undoable.snapshot();
                }
                setImmediate(function () {
                    suppressTextEvent = false;
                    if (changes[0]) {
                        codeUpdate(null, function () {
                            $.each(changes.splice(0), function (i, v) {
                                normalize(v.element);
                                if (v.id !== WIDGET_ROOT) {
                                    triggerEvent(null, v, 'contentChange');
                                }
                            });
                            triggerEvent(null, EVENT_STATIC, 'contentChange');
                        });
                    }
                });
            });
            return function (source, callback, args, thisArg) {
                // IE fires textinput event on the parent element when the text node's value is modified
                // even if modification is done through JavaScript rather than user action
                suppressTextEvent = true;
                executing = true;
                setEventSource(source, typer);
                return run(callback, args, thisArg);
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

        function triggerEvent(source, eventMode, eventName, data, props) {
            var widgets = $.makeArray(is(eventMode, TyperWidget) || getTargetedWidgets(eventMode)).filter(function (v) {
                return !v.destroyed && isFunction(widgetOptions[v.id][eventName]);
            });
            if (widgets[0]) {
                codeUpdate(source, function () {
                    $.each(widgets, function (i, v) {
                        widgetOptions[v.id][eventName](new TyperEvent(eventName, typer, v, data, props));
                        return eventMode !== EVENT_HANDLER;
                    });
                });
            }
            if (is(eventMode, TyperWidget)) {
                setImmediate(function () {
                    triggerEvent(source, EVENT_STATIC, 'widget' + capfirst(eventName), null, {
                        targetWidget: eventMode
                    });
                });
            }
            return !!widgets[0];
        }

        function triggerDefaultPreventableEvent(source, eventMode, eventName, data, eventObj) {
            eventObj = eventObj || $.Event(eventName);
            triggerEvent(source, eventMode, eventName, data, {
                preventDefault: eventObj.preventDefault.bind(eventObj),
                isDefaultPrevented: function () {
                    return eventObj.isDefaultPrevented();
                }
            });
            return eventObj.isDefaultPrevented();
        }

        function trackChange(node) {
            node = is(node, TyperNode) || typer.getNode(node);
            if (node && changes.indexOf(node.widget) < 0) {
                changes.push(node.widget);
            }
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
                    var node = nodeMap.get(v) || new TyperNode(typer, 0, v);
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
            nodeMap.set(rootElement, new TyperNode(typer, topNodeType, rootElement, new TyperWidget(nodeSource, WIDGET_ROOT, topElement, options)));
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
            if (is(node, NODE_EDITABLE_PARAGRAPH | NODE_PARAGRAPH) && !node.element.firstChild) {
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
                                    trackChange(node);
                                } else if (is(node, NODE_EDITABLE_PARAGRAPH)) {
                                    $(element).html(ZWSP_ENTITIY);
                                    trackChange(node);
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
                            trackChange(node);
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
                    callback(newState);
                }
            });
            return fragment;
        }

        function insertContents(range, content) {
            var textOnly = !is(content, Node);
            content = is(content, Node) || $.parseHTML(String(content || '').replace(/\u000d/g, '').replace(/</g, '&lt;').replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>').replace(/.*/, '<p>$&</p>'));
            content = slice(createDocumentFragment(content).childNodes);

            extractContents(range, 'paste', function (state) {
                var allowedWidgets = ('__root__ ' + (widgetOptions[state.focusNode.widget.id].allowedWidgets || '*')).split(' ');
                var caretPoint = state.getCaret('start').getRange();
                var startPoint = caretPoint.cloneRange();
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
                    var caretNode = typer.getEditableNode(caretPoint.startContainer);
                    var node = new TyperNode(typer, NODE_INLINE, nodeToInsert);
                    var isLineBreak = tagName(nodeToInsert) === 'br';

                    if (isElm(nodeToInsert) && !isLineBreak) {
                        startPoint.insertNode(nodeToInsert);
                        node = typer.getNode(nodeToInsert);
                        removeNode(nodeToInsert);
                        if (node.widget.id === WIDGET_UNKNOWN || (forcedInline && !widgetOptions[node.widget.id].inline) || (allowedWidgets[1] !== '*' && allowedWidgets.indexOf(node.widget.id) < 0)) {
                            nodeToInsert = createTextNode(node.widget.id === WIDGET_UNKNOWN ? nodeToInsert.textContent : extractText(nodeToInsert));
                            node = new TyperNode(typer, NODE_INLINE, nodeToInsert);
                        }
                    }
                    if (!is(caretNode, NODE_ANY_BLOCK_EDITABLE)) {
                        var incompatParagraph = !textOnly && !forcedInline && is(node, NODE_PARAGRAPH) && is(caretNode, NODE_PARAGRAPH) && (tagName(node.element) !== tagName(caretNode.element) || node.element.className !== caretNode.element.className) && extractText(nodeToInsert);
                        if (incompatParagraph || (isLineBreak && !is(caretNode, NODE_PARAGRAPH)) || !is(node, NODE_ANY_ALLOWTEXT | NODE_ANY_INLINE) || (!paragraphAsInline && !is(node, NODE_ANY_INLINE))) {
                            while (!is(caretNode.parentNode, isLineBreak ? NODE_PARAGRAPH : NODE_ANY_BLOCK_EDITABLE)) {
                                caretNode = caretNode.parentNode;
                            }
                            var splitEnd = createRange(caretNode.element, false);
                            var splitContent = createRange(caretPoint, splitEnd).extractContents();
                            if (!splitContent.firstChild) {
                                // avoid unindented empty elements when splitting at end of line
                                splitContent = createDocumentFragment(wrapNode(createTextNode(), formattingNodes));
                            }
                            var splitFirstNode = splitContent.firstChild;
                            splitEnd.insertNode(splitContent);
                            trackChange(splitEnd.startContainer);

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
                            if (is(caretNode, NODE_ANY_ALLOWTEXT) && !caretNode.element.firstChild) {
                                $(createTextNode()).appendTo(caretNode.element);
                            }
                            if (caretNode.element.textContent.slice(-1) === ' ') {
                                var n1 = iterateToArray(createNodeIterator(caretNode.element, 4)).filter(mapFn('data')).slice(-1)[0];
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
                                caretNode = w.currentNode;
                                caretPoint = createRange(caretNode.element, 0);
                                paragraphAsInline = !incompatParagraph;
                                insertAsInline = insertAsInline && paragraphAsInline;
                                hasInsertedBlock = true;
                            }
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
                    trackChange(caretPoint.startContainer);
                });
                if (!hasInsertedBlock && state.startNode !== state.endNode && is(state.startNode, NODE_PARAGRAPH) && is(state.endNode, NODE_PARAGRAPH)) {
                    if (!extractText(state.startNode.element)) {
                        caretPoint = createRange(state.endNode.element, 0);
                        removeNode(state.startNode.element);
                    } else {
                        if (caretPoint) {
                            var caretNode = closest(typer.getNode(caretPoint.startContainer), -1 & ~NODE_ANY_INLINE);
                            caretPoint = createRange(caretNode.element, -0);
                        } else {
                            caretPoint = createRange(state.startNode.element, -0);
                        }
                        caretPoint.insertNode(createRange(state.endNode.element, 'contents').extractContents());
                        caretPoint.collapse(true);
                        removeNode(state.endNode.element);
                    }
                    trackChange(state.endNode);
                    trackChange(state.startNode);
                }
                currentSelection.select(caretPoint);
            });
        }

        function extractText(content) {
            var range = createRange(content || topElement);
            var iterator, doc;
            if (is(content, Node) && !connected(topElement, content)) {
                doc = createTyperDocument(content);
                iterator = new TyperDOMNodeIterator(new TyperTreeWalker(doc.getNode(content), -1), 5);
            } else {
                iterator = new TyperDOMNodeIterator(new TyperSelection(typer, range).createTreeWalker(NODE_ALL_VISIBLE), 5, function (v) {
                    return rangeIntersects(range, createRange(v, 'contents')) ? 1 : 2;
                });
            }

            var lastNode, lastWidget, text = '';
            iterate(iterator, function (v) {
                var node = (doc || typer).getNode(v);
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
            var suppressUntil = 0;

            function triggerStateChange() {
                triggerEvent(null, EVENT_ALL, 'beforeStateChange');
                triggerEvent(null, EVENT_ALL, 'stateChange');
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
                setImmediateOnce(triggerStateChange);
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
                needSnapshot = false;
            }

            function applySnapshot(value) {
                var content = $.parseHTML(value)[0];
                $self.empty().append(content.childNodes).attr(attrs(content));
                currentSelection.select(getRangeFromMarker(true), getRangeFromMarker(false));
                setImmediateOnce(triggerStateChange);
                checkActualChange();
            }

            extend(undoable, {
                getValue: function () {
                    if (needSnapshot) {
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
                snapshot: function (ms) {
                    suppressUntil = (+new Date() + ms) || suppressUntil;
                    if (!executing && suppressUntil < +new Date()) {
                        takeSnapshot();
                    } else {
                        needSnapshot = true;
                        setImmediateOnce(triggerStateChange);
                    }
                }
            });
        }

        function normalizeInputEvent() {
            var mousedown;
            var composition;
            var modifierCount;
            var modifiedKeyCode;
            var keyDefaultPrevented;
            var hasKeyEvent;
            var touchObj;
            var activeWidget;

            function getEventName(e, suffix) {
                var mod = ((e.ctrlKey || e.metaKey) ? 'Ctrl' : '') + (e.altKey ? 'Alt' : '') + (e.shiftKey ? 'Shift' : '');
                return mod ? lowfirst(mod + capfirst(suffix)) : suffix;
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

            function updateFromNativeInput() {
                var activeRange = getActiveRange(topElement);
                if (!userFocus.has(typer) && activeRange && !rangeEquals(activeRange, createRange(currentSelection))) {
                    undoable.snapshot(200);
                    currentSelection.select(activeRange);
                    if (currentSelection.focusNode.widget !== activeWidget) {
                        triggerWidgetFocusout('input');
                    }
                }
            }

            function deleteNextContent(e) {
                setEventSource('keyboard', typer);
                if (!currentSelection.isCaret) {
                    insertContents(currentSelection, '');
                } else {
                    var selection = currentSelection.clone();
                    if (selection.extendCaret.moveByCharacter(e.data === 'backspace' ? -1 : 1)) {
                        insertContents(selection, '');
                    }
                }
            }

            function handleTextInput(inputText, compositionend) {
                setEventSource('input', typer);
                if (inputText && triggerDefaultPreventableEvent('input', EVENT_ALL, 'textInput', inputText)) {
                    return true;
                }
                if (compositionend || !currentSelection.startTextNode || !currentSelection.isCaret) {
                    insertContents(currentSelection, inputText);
                    return true;
                }
                setImmediate(function () {
                    updateFromNativeInput();
                    if (getTargetedWidgets(EVENT_CURRENT).id !== WIDGET_ROOT) {
                        triggerEvent('input', EVENT_CURRENT, 'contentChange');
                    }
                    triggerEvent('input', EVENT_STATIC, 'contentChange');
                });
            }

            $self.mousedown(function (e) {
                var handlers = {
                    mousemove: function (e) {
                        if (!e.which && mousedown) {
                            handlers.mouseup();
                            return;
                        }
                        undoable.snapshot(200);
                        currentSelection.extendCaret.moveToPoint(e.clientX, e.clientY);
                        setImmediate(function () {
                            setEventSource('mouse', typer);
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
                    currentSelection.focus();
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
                        if (triggerEvent('keyboard', EVENT_HANDLER, keyEventName)) {
                            e.preventDefault();
                        }
                        if (triggerDefaultPreventableEvent('keyboard', EVENT_ALL, 'keystroke', keyEventName, e) || /ctrl(?![acfnprstvwx]|f5|shift[nt]$)|enter/i.test(keyEventName)) {
                            e.preventDefault();
                        }
                    }
                    keyDefaultPrevented = e.isDefaultPrevented();
                    if (!keyDefaultPrevented) {
                        suppressTextEvent = false;
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
                if (!executing && !suppressTextEvent && (e.type === 'textInput' || !supportTextInputEvent) && (e.type !== 'keypress' || (!e.ctrlKey && !e.altKey && !e.metaKey))) {
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
                setEventSource('cut', typer);
                clipboard.content = extractContents(currentSelection, e.type);
                clipboard.textContent = extractText(currentSelection);
                if (IS_IE) {
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
                setEventSource('paste', typer);
                if (acceptHtml && $.inArray('application/x-typer', clipboardData.types) >= 0) {
                    var html = clipboardData.getData('text/html');
                    var content = createDocumentFragment($(html).filter('#Typer').contents());
                    insertContents(currentSelection, content);
                } else {
                    var textContent = clipboardData.getData(IS_IE ? 'Text' : 'text/plain');
                    if (acceptHtml && textContent === clipboard.textContent) {
                        insertContents(currentSelection, clipboard.content.cloneNode(true));
                    } else if (!triggerDefaultPreventableEvent('paste', EVENT_ALL, 'textInput', textContent)) {
                        insertContents(currentSelection, textContent);
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
                        currentSelection.focus();
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
                    currentSelection.focus();
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
                if (typerFocused || (executing && !permitFocusEvent)) {
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

        trackEventSource(topElement, typer);
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
                trackChange(newElement.parentNode);
                return newElement;
            },
            removeElement: function (element) {
                trackChange(element.parentNode);
                removeNode(element);
            },
            trackChange: function (node) {
                trackChange(node);
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
        closest: closest,
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
        toRect: toRect,
        caretRangeFromPoint: caretRangeFromPoint,
        historyLevel: 100,
        defaultOptions: {
            disallowedWidgets: 'keepText',
            widgets: {}
        },
        widgets: {}
    });

    definePrototype(Typer, {
        createCaret: function (node, offset) {
            var caret = new TyperCaret(this);
            caret.moveTo(node, offset);
            return caret;
        },
        createSelection: function (startNode, startOffset, endNode, endOffset) {
            return new TyperSelection(this, createRange(startNode, startOffset, endNode, endOffset));
        },
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
        return new TyperTreeWalker(inst.focusNode, (whatToShow | NODE_SHOW_EDITABLE) & NODE_ALL_VISIBLE, function (v) {
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
        inst.timestamp = performance.now();
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
                end = comparePosition(element, textNode) < 0;
                textNode = null;
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
        getRect: function () {
            return computeTextRects(this)[0];
        },
        getRange: function () {
            var self = this;
            var node = self.textNode || self.element;
            if (!containsOrEquals(self.typer.element, node) || (isText(node) && self.offset > node.length)) {
                if (!self.node.parentNode && self.node.element !== self.typer.element) {
                    self.moveTo(self.typer.element, 0);
                } else {
                    // use calculated text offset from paragraph node in case anchored text node is detached from DOM
                    // assuming that there is no unmanaged edit after the previous selection
                    self.moveToText(self.node.element, self.wholeTextOffset);
                }
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

    $(function () {
        trackEventSource(document.body);
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
                        rect = rect && toRect(rect.right, rect.top, rect.right, rect.bottom);
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
