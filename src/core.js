(function ($, root, array) {
    'use strict';

    var KEYNAMES = JSON.parse('{"8":"backspace","9":"tab","13":"enter","16":"shift","17":"ctrl","18":"alt","19":"pause","20":"capsLock","27":"escape","32":"space","33":"pageUp","34":"pageDown","35":"end","36":"home","37":"leftArrow","38":"upArrow","39":"rightArrow","40":"downArrow","45":"insert","46":"delete","48":"0","49":"1","50":"2","51":"3","52":"4","53":"5","54":"6","55":"7","56":"8","57":"9","65":"a","66":"b","67":"c","68":"d","69":"e","70":"f","71":"g","72":"h","73":"i","74":"j","75":"k","76":"l","77":"m","78":"n","79":"o","80":"p","81":"q","82":"r","83":"s","84":"t","85":"u","86":"v","87":"w","88":"x","89":"y","90":"z","91":"leftWindow","92":"rightWindowKey","93":"select","96":"numpad0","97":"numpad1","98":"numpad2","99":"numpad3","100":"numpad4","101":"numpad5","102":"numpad6","103":"numpad7","104":"numpad8","105":"numpad9","106":"multiply","107":"add","109":"subtract","110":"decimalPoint","111":"divide","112":"f1","113":"f2","114":"f3","115":"f4","116":"f5","117":"f6","118":"f7","119":"f8","120":"f9","121":"f10","122":"f11","123":"f12","144":"numLock","145":"scrollLock","186":"semiColon","187":"equalSign","188":"comma","189":"dash","190":"period","191":"forwardSlash","192":"backtick","219":"openBracket","220":"backSlash","221":"closeBracket","222":"singleQuote"}');
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
    var NODE_INLINE = 16;
    var NODE_INLINE_WIDGET = 64;
    var NODE_INLINE_EDITABLE = 128;
    var NODE_SHOW_HIDDEN = 8192;
    var NODE_ANY_BLOCK_EDITABLE = NODE_EDITABLE | NODE_EDITABLE_PARAGRAPH;
    var NODE_ANY_BLOCK = NODE_WIDGET | NODE_PARAGRAPH | NODE_ANY_BLOCK_EDITABLE;
    var NODE_ANY_INLINE = NODE_INLINE | NODE_INLINE_WIDGET | NODE_INLINE_EDITABLE;
    var NODE_ANY_ALLOWTEXT = NODE_PARAGRAPH | NODE_EDITABLE_PARAGRAPH | NODE_INLINE | NODE_INLINE_EDITABLE;
    var EVENT_ALL = 1;
    var EVENT_STATIC = 2;
    var EVENT_HANDLER = 3;
    var EVENT_CURRENT = 4;
    var IS_IE10 = !!window.ActiveXObject;
    var IS_IE = IS_IE10 || root.style.msTouchAction !== undefined || root.style.msUserSelect !== undefined;

    // document.caretRangeFromPoint is still broken even in Edge browser
    // it does not return correct range for the points x or y larger than window's width or height
    var caretRangeFromPoint_ = IS_IE ? undefined : document.caretRangeFromPoint;
    var elementFromPoint_ = IS_IE ? undefined : document.elementFromPoint;
    var compareDocumentPosition_ = document.compareDocumentPosition;
    var compareBoundaryPoints_ = Range.prototype.compareBoundaryPoints;

    var isFunction = $.isFunction;
    var extend = $.extend;
    var selection = window.getSelection();
    var setImmediate = window.setImmediate;
    var clearImmediate = window.clearImmediate;
    var MutationObserver = shim.MutationObserver;
    var WeakMap = shim.WeakMap;
    var Set = shim.Set;

    var clipboard = {};
    var userFocus = new WeakMap();
    var selectionCache = new WeakMap();
    var detachedElements = new WeakMap();
    var dirtySelections = new Set();
    var windowFocusedOut;
    var permitFocusEvent;
    var supportTextInputEvent;
    var currentSource = [];
    var lastTouchedElement;
    var checkNativeUpdate;

    function TyperSelection(typer, range) {
        var self = this;
        selectionCache.set(self, {});
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

    function TyperDOMNodeIterator(iterator, whatToShow, filter) {
        var self = this;
        self.whatToShow = whatToShow;
        self.filter = filter || null;
        nodeIteratorInit(self, iterator);
    }

    function TyperCaret(typer, selection) {
        this.typer = typer;
        this.selection = selection || null;
    }

    function transaction(finalize) {
        var count = 0;
        return function run(callback, args, thisArg) {
            try {
                count++;
                return callback.apply(thisArg || this, args);
            } finally {
                if (--count === 0) {
                    finalize();
                }
            }
        };
    }

    function defineProperty(obj, name, value) {
        Object.defineProperty(obj, name, {
            configurable: true,
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

    function consume(set) {
        var arr;
        if (Array.from) {
            arr = Array.from(set);
        } else {
            arr = [];
            set.forEach(function (v) {
                arr[arr.length] = v;
            });
        }
        set.clear();
        return arr;
    }

    function trim(v) {
        return String(v || '').replace(/^[\s\u200b]+|[\s\u200b]+$/g, '');
    }

    function collapseWS(v) {
        return String(v || '').replace(/[^\S\u00a0]+/g, ' ');
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

    function isBR(v) {
        return tagName(v) === 'br' && v;
    }

    function isTextNodeEnd(v, offset, dir) {
        var str = v.data;
        return (dir >= 0 && (offset === v.length || str.slice(offset) === ZWSP)) ? 1 : (dir <= 0 && (!offset || str.slice(0, offset) === ZWSP)) ? -1 : 0;
    }

    function closest(node, type) {
        for (; node && !is(node, type); node = node.parentNode);
        return is(node, NODE_WIDGET) ? node.typer.getNode(node.widget.element) : node;
    }

    function compareAttrs(a, b) {
        var thisAttr = a.attributes;
        var prevAttr = b.attributes;
        return thisAttr.length === prevAttr.length && !any(thisAttr, function (v) {
            return !prevAttr[v.nodeName] || v.value !== prevAttr[v.nodeName].value;
        });
    }

    function sameElementSpec(a, b) {
        return tagName(a) === tagName(b) && compareAttrs(a, b);
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
        var iterator = new TyperDOMNodeIterator(new TyperTreeWalker(node, NODE_ANY_ALLOWTEXT), 5);
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

    function getRect(elm) {
        elm = elm || root;
        if (!containsOrEquals(root, elm)) {
            // IE10 throws Unspecified Error for detached elements
            return toPlainRect(0, 0, 0, 0);
        }
        return elm === root ? toPlainRect(0, 0, root.offsetWidth, root.offsetHeight) : toPlainRect(elm.getBoundingClientRect());
    }

    function toPlainRect(l, t, r, b) {
        if (l.top !== undefined) {
            return toPlainRect(l.left, l.top, l.right, l.bottom);
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
        return rect.width && rect.height && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    }

    function computeTextRects(node) {
        return $.map((is(node, Range) || createRange(node, 'contents')).getClientRects(), toPlainRect);
    }

    function rectFromPosition(node, offset) {
        if (offset && offset === node.length) {
            var rect = computeTextRects(createRange(node, offset - 1, node, offset))[0];
            return rect && toPlainRect(rect.right, rect.top, rect.right, rect.bottom);
        }
        return computeTextRects(createRange(node, offset))[0];
    }

    function getActiveRange(container) {
        if (selection.rangeCount) {
            var range = selection.getRangeAt(0);
            return containsOrEquals(container, range.commonAncestorContainer) && range;
        }
    }

    function caretRangeFromPoint(x, y, element) {
        var range = caretRangeFromPoint_.call(document, x, y);
        if (range && element && element !== document.body && pointInRect(x, y, getRect(element))) {
            var elm = [];
            try {
                var container;
                while (comparePosition(element, (container = range.startContainer), true)) {
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
        return range && containsOrEquals(element, range.startContainer) ? range : null;
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

    function scrollRectIntoView(element, rect) {
        for (; element !== root && window.getComputedStyle(element).overflow === 'visible'; element = element.offsetParent || element.parentNode);
        var elmRect = getRect(element);
        var deltaX = Math.max(0, rect.right - elmRect.right) || Math.min(rect.left - elmRect.left, 0);
        var deltaY = Math.max(0, rect.bottom - elmRect.bottom) || Math.min(rect.top - elmRect.top, 0);
        if (deltaX || deltaY) {
            if (element !== root) {
                element.scrollLeft += deltaX;
                element.scrollTop += deltaY;
            } else {
                window.scrollTo(root.scrollLeft + deltaX, root.scrollTop + deltaY);
            }
        }
        return {
            x: deltaX,
            y: deltaY
        };
    }

    function fixIEInputEvent(element, topElement) {
        // IE fires input and text-input event on the innermost element where the caret positions at
        // the event does not bubble up so need to trigger manually on the top element
        // also IE use all lowercase letter in the event name
        $(element).on('input textinput', function (e) {
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
        $(element).on('mousedown mouseup mousewheel keydown keyup keypress touchstart touchend', function (e) {
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
        var changedWidgets = new Set();
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
                typer.getNode(topElement);
                if (needSnapshot || changedWidgets.size) {
                    normalize(topElement);
                    undoable.snapshot();
                }
                var lastChanges = consume(changedWidgets);
                setImmediate(function () {
                    suppressTextEvent = false;
                    if (lastChanges[0]) {
                        codeUpdate(function () {
                            $.each(lastChanges, function (i, v) {
                                if (v.id !== WIDGET_ROOT) {
                                    triggerEvent(v, 'contentChange');
                                }
                            });
                            triggerEvent(EVENT_STATIC, 'contentChange');
                        });
                    }
                });
            });
            return function (callback, args, thisArg) {
                // IE fires textinput event on the parent element when the text node's value is modified
                // even if modification is done through JavaScript rather than user action
                suppressTextEvent = true;
                executing = true;
                setEventSource('script', typer);
                return run(callback, args, thisArg);
            };
        }());

        function TyperTransaction() { }

        function matchWidgetList(id, prop, needle) {
            var options = widgetOptions[id];
            return !(prop in options) || options[prop] === '*' || (' ' + options[prop] + ' ').indexOf(' ' + needle + ' ') >= 0;
        }

        function widgetAllowed(id, node) {
            node = closest(node, NODE_ANY_BLOCK_EDITABLE);
            return (widgetOptions[id].inline || !is(node, NODE_EDITABLE_PARAGRAPH)) && matchWidgetList(node.widget.id, 'allowedWidgets', id);
        }

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

        function triggerEvent(eventMode, eventName, data, props) {
            var widgets = $.makeArray(is(eventMode, TyperWidget) || getTargetedWidgets(eventMode)).filter(function (v) {
                return !v.destroyed && isFunction(widgetOptions[v.id][eventName]);
            });
            if (widgets[0]) {
                codeUpdate(function () {
                    $.each(widgets, function (i, v) {
                        widgetOptions[v.id][eventName](new TyperEvent(eventName, typer, v, data, props));
                        return eventMode !== EVENT_HANDLER;
                    });
                });
            }
            return !!widgets[0];
        }

        function triggerDefaultPreventableEvent(eventMode, eventName, data, props) {
            var eventObj = is(props, $.Event) || $.Event(eventName);
            triggerEvent(eventMode, eventName, data, extend({
                preventDefault: eventObj.preventDefault.bind(eventObj),
                isDefaultPrevented: function () {
                    return eventObj.isDefaultPrevented();
                }
            }, props !== eventObj ? props : null));
            return eventObj.isDefaultPrevented();
        }

        function trackChange(node) {
            changedWidgets.add(node.widget);
        }

        function createTyperDocument(rootElement, fireEvent) {
            var self = {};
            var nodeSource = containsOrEquals(topElement, rootElement) ? typer : self;
            var nodeMap = new WeakMap();
            var dirtyElements = new Set();
            var observer = new MutationObserver(handleMutations);

            function triggerWidgetEvent(widget, event) {
                if (fireEvent && widget.id !== WIDGET_UNKNOWN) {
                    if (widget.timeout) {
                        clearImmediate(widget.timeout);
                        delete widget.timeout;
                    } else {
                        widget.timeout = setImmediate(function () {
                            triggerEvent(widget, event);
                            triggerEvent(EVENT_STATIC, 'widget' + capfirst(event), null, {
                                targetWidget: widget
                            });
                            widget.destroyed = event === 'destroy';
                            delete widget.timeout;
                        });
                    }
                }
            }

            function triggerWidgetEventRecursive(node, event) {
                iterate(new TyperTreeWalker(node, -1), function (v) {
                    if (v.widget.element === v.element) {
                        triggerWidgetEvent(v.widget, event);
                    }
                });
            }

            function addChild(parent, node) {
                var arr = parent.childNodes;
                for (var index = arr.length; index && comparePosition(node.element, arr[index - 1].element) <= 0; index--);
                if (arr[index] !== node) {
                    if (node.parentNode) {
                        removeFromParent(node);
                    } else {
                        triggerWidgetEventRecursive(node, 'init');
                    }
                    arr.splice(index, 0, node);
                    node.parentNode = parent;
                    node.previousSibling = arr[index - 1] || null;
                    node.nextSibling = arr[index + 1] || null;
                    (node.previousSibling || {}).nextSibling = node;
                    (node.nextSibling || {}).previousSibling = node;
                }
            }

            function removeFromParent(node, destroyWidget) {
                var parentNode = node.parentNode;
                var arr = parentNode.childNodes;
                arr.splice(arr.indexOf(node), 1);
                (node.previousSibling || {}).nextSibling = node.nextSibling;
                (node.nextSibling || {}).previousSibling = node.previousSibling;
                node.parentNode = null;
                node.nextSibling = null;
                node.previousSibling = null;
                if (destroyWidget) {
                    triggerWidgetEventRecursive(node, 'destroy');
                    iterate(new TyperTreeWalker(node, -1), function (v) {
                        detachedElements.set(v.element, parentNode.element);
                    });
                }
            }

            function updateNode(node) {
                var context = node.parentNode || nodeMap.get(rootElement);
                if (!is(context, NODE_WIDGET) && (!node.widget || !is(node.element, widgetOptions[node.widget.id].element))) {
                    if (node.widget && node.widget.element === node.element) {
                        triggerWidgetEvent(node.widget, 'destroy');
                    }
                    $.each(widgetOptions, function (i, v) {
                        if (is(node.element, v.element)) {
                            node.widget = new TyperWidget(nodeSource, i, node.element, v.options);
                            triggerWidgetEvent(node.widget, 'init');
                            return false;
                        }
                    });
                }
                if (node.widget && node.widget.destroyed) {
                    delete node.widget;
                }
                if (!node.widget || node.widget.element !== node.element || (node.widget.id === WIDGET_UNKNOWN && !is(context, NODE_ANY_ALLOWTEXT))) {
                    node.widget = context.widget;
                }
                var widgetOption = widgetOptions[node.widget.id];
                if (node.widget === context.widget && !is(context, NODE_WIDGET | NODE_INLINE_WIDGET)) {
                    node.nodeType = is(node.element, INNER_PTAG) ? NODE_PARAGRAPH : NODE_INLINE;
                } else if (is(node.element, widgetOption.editable) || (widgetOption.inline && !widgetOption.editable)) {
                    node.nodeType = widgetOption.inline ? NODE_INLINE_EDITABLE : is(node.element, INNER_PTAG) ? NODE_EDITABLE_PARAGRAPH : NODE_EDITABLE;
                } else {
                    node.nodeType = widgetOption.inline && node.widget !== context.widget && is(context, NODE_ANY_ALLOWTEXT) ? NODE_INLINE_WIDGET : NODE_WIDGET;
                }
            }

            function visitElement(element) {
                var thisNode = nodeMap.get(element);
                $.each(thisNode.childNodes.slice(0), function (i, v) {
                    if (!containsOrEquals(element, v.element)) {
                        removeFromParent(v, true);
                    }
                });
                $(element.children).not('br').each(function (i, v) {
                    var node = nodeMap.get(v) || new TyperNode(nodeSource, 0, v);
                    var parentNode = node.parentNode;
                    addChild(thisNode, node);
                    updateNode(node);
                    nodeMap.set(v, node);
                    if (!parentNode || v.parentNode !== parentNode.element) {
                        visitElement(v);
                        if (IS_IE) {
                            fixIEInputEvent(v, topElement);
                        }
                    }
                });
            }

            function handleMutations(mutations) {
                $.each(mutations, function (i, v) {
                    if (!isBR(v.target)) {
                        if (v.addedNodes[0] || v.removedNodes[0]) {
                            dirtyElements.add(v.target);
                        } else if (v.target !== rootElement && v.attributeName !== 'id' && v.attributeName !== 'style' && nodeMap.has(v.target)) {
                            trackChange(nodeMap.get(v.target));
                        }
                    }
                });
            }

            function ensureState() {
                handleMutations(observer.takeRecords());
                if (dirtyElements.size) {
                    var arr = consume(dirtyElements);
                    arr.sort(function (a, b) {
                        return !connected(root, a) ? -1 : comparePosition(a, b);
                    });
                    $(rootElement.parentNode || rootElement).find(arr).each(function (i, v) {
                        visitElement(v);
                        trackChange(nodeMap.get(v));
                    });
                    if (currentSelection) {
                        selectionAtomic(function () {
                            caretEnsureState(currentSelection.baseCaret);
                            caretEnsureState(currentSelection.extendCaret);
                        });
                    }
                }
            }

            function getNode(element) {
                ensureState();
                if (isText(element) || isBR(element)) {
                    element = element.parentNode || element;
                }
                if (containsOrEquals(rootElement, element)) {
                    var node = nodeMap.get(element);
                    return is(node, NODE_WIDGET) ? nodeMap.get(node.widget.element) : node;
                }
            }

            if (!rootElement.parentNode) {
                rootElement = is(rootElement, DocumentFragment) || createDocumentFragment(rootElement);
            }
            if (fireEvent) {
                observer.observe(rootElement, {
                    subtree: true,
                    childList: true,
                    attributes: true
                });
            }
            var rootNode = new TyperNode(nodeSource, topNodeType, rootElement, new TyperWidget(nodeSource, WIDGET_ROOT, topElement, options));
            nodeMap.set(rootElement, rootNode);
            visitElement(rootElement);

            return extend(self, {
                rootNode: rootNode,
                getNode: getNode
            });
        }

        function normalizeWhitespace(node) {
            var textNodes = iterateToArray(createNodeIterator(node, 4));
            var wholeText = '';
            var index = [];
            $.each(textNodes, function (i, v) {
                wholeText = (wholeText + v.data).replace(/\u00a0{2}(?!\u0020?$)/g, '\u00a0 ').replace(/[^\S\u00a0]{2}/g, ' \u00a0').replace(/\u00a0[^\S\u00a0]\u00a0(\S)/g, '\u00a0\u00a0 $1').replace(/(\S)\u00a0(?!$)/g, '$1 ');
                index[i] = wholeText.length;
            });
            wholeText = wholeText.replace(/[^\S\u00a0]$/, '\u00a0');
            $.each(textNodes, function (i, v) {
                var text = wholeText.slice(index[i - 1] || 0, index[i]);
                if (v.data !== text) {
                    v.data = text;
                }
            });
        }

        function normalize(element) {
            iterate(new TyperTreeWalker(typer.getNode(element || topElement), NODE_ANY_ALLOWTEXT | NODE_EDITABLE | NODE_SHOW_HIDDEN), function (node) {
                var element = node.element;
                if (is(node, NODE_EDITABLE)) {
                    if (!node.firstChild) {
                        $(element).html('<p>' + (trim(element.textContent) || ZWSP_ENTITIY) + '</p>');
                        return;
                    }
                    $(element).contents().each(function (i, v) {
                        if (v.parentNode === element) {
                            var contents = [];
                            for (; v && (isText(v) || isBR(v) || is(typer.getNode(v), NODE_ANY_INLINE)); v = v.nextSibling) {
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
                    if (!element.firstChild) {
                        $(createTextNode()).appendTo(element);
                        return;
                    }
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
                    if (currentSelection.startNode !== node && currentSelection.endNode !== node) {
                        $.each(iterateToArray(createNodeIterator(element, 4)), function (i, v) {
                            v.data = collapseWS(v.data);
                            if (isText(v.nextSibling)) {
                                v.nextSibling.data = collapseWS(v.data + v.nextSibling.data);
                                removeNode(v);
                            }
                        });
                    }
                }
                if (is(node, NODE_INLINE) && currentSelection.startElement !== element && currentSelection.endElement !== element && !trim(element.textContent)) {
                    removeNode(element);
                }
                $('>br', element).each(function (i, v) {
                    if (!isText(v.nextSibling)) {
                        $(createTextNode()).insertAfter(v);
                    }
                });
            });
            // Mozilla adds <br type="_moz"> when a container is empty
            $('br[type="_moz"]', topElement).remove();
        }

        function extractContents(range, mode, callback) {
            var method = mode === 'cut' ? 'extractContents' : mode === 'paste' ? 'deleteContents' : 'cloneContents';
            var cloneNode = mode !== 'paste';
            var clearNode = mode !== 'copy';
            var fragment = document.createDocumentFragment();
            var state = is(range, TyperSelection) ? range.clone() : new TyperSelection(typer, range);
            var isSingleEditable = state.isSingleEditable;
            range = state.getRange();

            codeUpdate(function () {
                if (!state.isCaret) {
                    var stack = [[topElement, fragment]];
                    var shift = function () {
                        var item = stack.shift();
                        if (item[2] && item[2].element === item[0]) {
                            triggerEvent(item[2], 'extract', null, {
                                extractedNode: item[1]
                            });
                        }
                    };
                    iterate(state.createTreeWalker(-1, function (node) {
                        var element = node.element;
                        var handler = is(node, NODE_WIDGET | NODE_EDITABLE | NODE_EDITABLE_PARAGRAPH) && widgetOptions[node.widget.id].extract;
                        var isWidgetHead = node.widget.element === element;

                        if (node === state.focusNode && is(node, NODE_EDITABLE)) {
                            return 3;
                        }
                        if (!handler && !isWidgetHead && is(node, NODE_WIDGET | NODE_EDITABLE)) {
                            // ignore widget structure if the widget is partially selected
                            // and there is no extract event handler defined
                            return 3;
                        }
                        if (cloneNode) {
                            while (!containsOrEquals(stack[0][0], element)) {
                                shift();
                            }
                            if (handler && (!isWidgetHead || !rangeCovers(range, element))) {
                                (isWidgetHead ? $(element) : $(element).parentsUntil(stack[0][0]).addBack()).each(function (i, v) {
                                    stack.unshift([v, v.cloneNode(false), node.widget]);
                                    stack[1][1].appendChild(stack[0][1]);
                                });
                            }
                        }
                        if (rangeCovers(range, element)) {
                            if (cloneNode) {
                                var clone = element.cloneNode(true);
                                $(stack[0][1]).append(element === stack[0][0] ? clone.childNodes : clone);
                            }
                            if (clearNode) {
                                if (is(node, NODE_EDITABLE)) {
                                    $(element).html(EMPTY_LINE);
                                } else if (is(node, NODE_EDITABLE_PARAGRAPH)) {
                                    $(element).html(ZWSP_ENTITIY);
                                } else {
                                    removeNode(element);
                                }
                            }
                            return 2;
                        }
                        if (is(node, NODE_ANY_ALLOWTEXT)) {
                            var content = createRange(element, range)[method]();
                            if (cloneNode && content) {
                                var hasThisElement = is(is(content, DocumentFragment) ? content.firstChild : content, tagName(element));
                                if (!hasThisElement) {
                                    content = wrapNode(content, [is(node, NODE_EDITABLE_PARAGRAPH) ? createElement('p') : element]);
                                } else if (is(node, NODE_EDITABLE_PARAGRAPH)) {
                                    content = content.firstChild.childNodes;
                                }
                                $(stack[0][1]).append(content);
                            }
                            return 2;
                        }
                        return 1;
                    }));
                    for (; stack[0]; shift());
                }
                if (isFunction(callback)) {
                    if (!isSingleEditable) {
                        var iterator = state.createTreeWalker(NODE_ANY_BLOCK_EDITABLE, function (v) {
                            return widgetOptions[v.widget.id].textFlow ? 1 : 3;
                        });
                        var start = closest(state.baseCaret.node, NODE_ANY_BLOCK_EDITABLE);
                        var until = closest(state.extendCaret.node, NODE_ANY_BLOCK_EDITABLE);
                        iterator.currentNode = start;
                        while (iterator[state.direction > 0 ? 'nextNode' : 'previousNode']());
                        if (iterator.currentNode !== until) {
                            if (iterator.currentNode !== start) {
                                state.extendCaret.moveTo(iterator.currentNode.element, 0 * -state.direction);
                            } else {
                                state.collapse();
                            }
                        }
                    }
                    callback(state);
                }
            });
            $(fragment).find('[style]').removeAttr('style');
            return fragment;
        }

        function insertContents(range, content) {
            var textOnly;
            if (is(content, Node)) {
                if (containsOrEquals(topElement, content)) {
                    removeNode(content);
                }
                content = slice(createDocumentFragment(content).childNodes);
                textOnly = content.length === 1 && is(content[0], 'p:not([class])');
            } else {
                content = $.parseHTML(String(content || '').replace(/\u000d/g, '').replace(/</g, '&lt;').replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>').replace(/.*/, '<p>$&</p>').replace(/\s/g, '\u00a0'));
                textOnly = true;
            }
            extractContents(range, 'paste', function (state) {
                var startNode = state.startNode;
                var endNode = state.endNode;
                var allowedWidgets = ('__root__ ' + (widgetOptions[state.focusNode.widget.id].allowedWidgets || '*')).split(' ');
                var caretPoint = state.getCaret('start').clone();
                var startPoint = createRange(closest(startNode, NODE_ANY_BLOCK_EDITABLE).element, 0);
                var forcedInline = is(startNode, NODE_EDITABLE_PARAGRAPH);
                var insertAsInline = is(startNode, NODE_ANY_ALLOWTEXT);
                var paragraphAsInline = true;
                var hasInsertedBlock;
                var formattingNodes = [];

                var cur = typer.getNode(state.startElement);
                if (is(cur, NODE_ANY_INLINE)) {
                    for (; cur !== startNode; cur = cur.parentNode) {
                        if (is(cur, NODE_INLINE)) {
                            formattingNodes.push(cur.element);
                        }
                    }
                    formattingNodes.push(startNode.element);
                } else if (is(cur, NODE_PARAGRAPH)) {
                    formattingNodes[0] = startNode.element;
                } else if (!is(cur, NODE_EDITABLE_PARAGRAPH)) {
                    formattingNodes[0] = createElement('p');
                }

                content.forEach(function (nodeToInsert) {
                    var caretNode = typer.getNode(caretPoint.element);
                    var node = new TyperNode(typer, textOnly ? NODE_PARAGRAPH : NODE_INLINE, nodeToInsert);
                    var isLineBreak = isBR(nodeToInsert);
                    var needSplit = false;
                    var incompatParagraph = false;
                    var splitEnd;

                    if (!textOnly && !isLineBreak && isElm(nodeToInsert)) {
                        startPoint.insertNode(nodeToInsert);
                        node = typer.getNode(nodeToInsert);
                        removeNode(nodeToInsert);
                        if (!widgetAllowed(node.widget.id, caretNode)) {
                            nodeToInsert = createTextNode(node.widget.id === WIDGET_UNKNOWN ? collapseWS(trim(nodeToInsert.textContent)) : extractText(nodeToInsert));
                            node = new TyperNode(typer, NODE_INLINE, nodeToInsert);
                        }
                        if (content.length === 1 && is(node, NODE_WIDGET) && node.widget.id === caretNode.widget.id) {
                            if (triggerDefaultPreventableEvent(caretNode.widget, 'receive', null, {
                                receivedNode: nodeToInsert,
                                caret: caretPoint.clone()
                            })) {
                                return;
                            }
                        }
                    }
                    if (!is(caretNode, NODE_ANY_BLOCK_EDITABLE)) {
                        if (isLineBreak) {
                            needSplit = !is(caretNode, NODE_PARAGRAPH);
                            for (; is(caretNode.parentNode, NODE_ANY_INLINE); caretNode = caretNode.parentNode);
                            splitEnd = createRange(caretNode.element, false);
                        } else if (!is(node, NODE_ANY_INLINE)) {
                            caretNode = closest(caretNode, NODE_PARAGRAPH) || caretNode;
                            splitEnd = createRange(caretNode.element, false);
                            if (is(node, NODE_PARAGRAPH)) {
                                incompatParagraph = !textOnly && !forcedInline && is(caretNode, NODE_PARAGRAPH) && !sameElementSpec(node.element, caretNode.element) && trim(nodeToInsert.textContent);
                                needSplit = incompatParagraph || !paragraphAsInline;
                            } else if (trim(createRange(createRange(caretNode.element, true), createRange(caretPoint)))) {
                                needSplit = trim(createRange(splitEnd, createRange(caretPoint)));
                                if (!needSplit) {
                                    caretNode = caretNode.nextSibling || caretNode.parentNode;
                                    caretPoint.moveTo(splitEnd);
                                }
                            }
                        }
                        if (needSplit) {
                            var splitContent = createRange(createRange(caretPoint), splitEnd).extractContents();
                            if (!trim(splitContent.textContent)) {
                                // avoid unindented empty elements when splitting at end of line
                                splitContent = createDocumentFragment(wrapNode(createTextNode(), formattingNodes));
                            }
                            var splitFirstNode = splitContent.firstChild;
                            splitEnd.insertNode(splitContent);

                            for (var cur1 = typer.getNode(splitFirstNode); cur1 && !trim(cur1.element.textContent); cur1 = cur1.firstChild) {
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
                            if (is(caretNode, NODE_ANY_ALLOWTEXT) && !(caretNode.element.firstChild || '').length) {
                                $(createTextNode()).appendTo(caretNode.element);
                            }
                            if (trim(caretNode.element.textContent) && caretNode.element.textContent.slice(-1) === ' ') {
                                normalizeWhitespace(caretNode.element);
                            }
                            if (trim(splitFirstNode.textContent) && splitFirstNode.textContent.charAt(0) === ' ') {
                                normalizeWhitespace(splitFirstNode);
                            }
                            if (isLineBreak) {
                                createRange(splitFirstNode, true).insertNode(nodeToInsert);
                                caretPoint.moveTo(splitFirstNode, 0);
                                return;
                            }
                            caretNode = typer.getNode(splitFirstNode);
                            caretPoint.moveTo(splitFirstNode, 0);
                            paragraphAsInline = !incompatParagraph;
                            insertAsInline = insertAsInline && paragraphAsInline;
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
                            caretPoint.getRange().insertNode(nodeToInsert);
                            normalizeWhitespace(caretNode.element);
                            if (isLineBreak || is(node, NODE_INLINE_WIDGET)) {
                                // ensure there is a text insertion point after an inline widget
                                var textNode = createTextNode();
                                createRange(lastNode, false).insertNode(textNode);
                                caretPoint.moveTo(textNode, -0);
                            } else {
                                caretPoint.moveTo(lastNode, -0);
                            }
                        }
                        paragraphAsInline = forcedInline;
                    } else {
                        // check for the first block either if there is content or the insert point is a paragraph
                        // to avoid two empty lines inserted before block widget
                        if (hasInsertedBlock || !is(startNode, NODE_WIDGET) || trim(nodeToInsert.textContent)) {
                            if (is(caretNode, NODE_ANY_BLOCK_EDITABLE)) {
                                createRange(caretNode.element, -0).insertNode(nodeToInsert);
                            } else {
                                createRange(caretNode.element, true).insertNode(nodeToInsert);
                            }
                            insertAsInline = forcedInline || is(node, NODE_ANY_ALLOWTEXT | NODE_ANY_INLINE);
                            caretPoint.moveTo(lastNode, insertAsInline ? -0 : false);
                            paragraphAsInline = forcedInline || !insertAsInline;
                        }
                        hasInsertedBlock = true;
                    }
                });
                if (!hasInsertedBlock && startNode !== endNode) {
                    if (!extractText(startNode.element)) {
                        caretPoint.moveTo(endNode.element, is(endNode, NODE_ANY_ALLOWTEXT) ? 0 : true);
                        removeNode(startNode.element);
                    } else if (is(startNode, NODE_PARAGRAPH) && is(endNode, NODE_PARAGRAPH)) {
                        var glueContent = createDocumentFragment(createRange(endNode.element, 'contents').extractContents());
                        var glueFirstNode = glueContent.firstChild;
                        caretPoint.moveTo(startNode.element, -0);
                        createRange(startNode.element, -0).insertNode(glueContent);
                        removeNode(endNode.element);
                        while (isElm(glueFirstNode) && sameElementSpec(glueFirstNode, glueFirstNode.previousSibling)) {
                            var nodeToRemove = glueFirstNode;
                            glueFirstNode = $(glueFirstNode.childNodes).appendTo(glueFirstNode.previousSibling)[0];
                            removeNode(nodeToRemove);
                        }
                        normalizeWhitespace(startNode.element);
                    }
                }
                currentSelection.select(caretPoint);
            });
        }

        function extractText(content) {
            var range = createRange(content || topElement, 'contents');
            var iterator, doc;
            if (is(content, Node) && !connected(topElement, content)) {
                doc = createTyperDocument(content);
                iterator = new TyperDOMNodeIterator(new TyperTreeWalker(doc.rootNode, -1), 5);
            } else {
                iterator = new TyperDOMNodeIterator(new TyperSelection(typer, range).createTreeWalker(-1), 5, function (v) {
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
                    } else if (isBR(v)) {
                        text += '\n';
                    }
                }
            });
            return trim(text).replace(/\u200b/g, '').replace(/[^\S\n\u00a0]+|\u00a0/g, ' ');
        }

        function initUndoable() {
            var snapshots = [];
            var currentIndex = 0;
            var suppressUntil = 0;

            function triggerStateChange() {
                triggerEvent(EVENT_ALL, 'beforeStateChange');
                triggerEvent(EVENT_ALL, 'stateChange');
            }

            function saveCaret(caret) {
                var arr = [];
                for (var node = caret.node; node.parentNode; node = node.parentNode) {
                    arr.unshift(node.parentNode.childNodes.indexOf(node));
                }
                arr[arr.length] = caret.textNode ? caret.wholeTextOffset : caret.offset;
                return arr.join(' ');
            }

            function restoreCaret(caret, pos) {
                var arr = pos.split(' ');
                var element = topElement;
                var offset = arr.splice(-1)[0];
                arr.forEach(function (v) {
                    element = element.children[+v];
                });
                if (isNaN(offset)) {
                    caret.moveTo(element, offset === 'true');
                } else {
                    caret.moveToText(element, +offset);
                }
            }

            function takeSnapshot() {
                var value = trim(topElement.innerHTML.replace(/\s+(style)(="[^"]*")?|(?!>)\u200b(?!<\/)/g, ''));
                if (!snapshots[0] || value !== snapshots[currentIndex].value) {
                    snapshots.splice(0, currentIndex, {
                        value: value
                    });
                    snapshots.splice(Typer.historyLevel);
                    currentIndex = 0;
                }
                snapshots[currentIndex].basePos = saveCaret(currentSelection.baseCaret);
                snapshots[currentIndex].extendPos = saveCaret(currentSelection.extendCaret);
                snapshots[currentIndex].html = topElement.innerHTML;
                needSnapshot = false;
                setImmediateOnce(triggerStateChange);
            }

            function applySnapshot(state) {
                $self.html(state.html);
                restoreCaret(currentSelection, state.basePos);
                restoreCaret(currentSelection.extendCaret, state.extendPos);
                setImmediateOnce(triggerStateChange);
                needSnapshot = false;
            }

            extend(undoable, {
                getValue: function () {
                    return snapshots[currentIndex].value;
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

        function focusRetained(element) {
            for (; element; element = element.parentNode) {
                if (relatedElements.has(element)) {
                    userFocus.set(typer, element);
                    return true;
                }
            }
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

            function updateWidgetFocus() {
                var widget = currentSelection.focusNode.widget;
                if (activeWidget !== widget) {
                    if (activeWidget && !activeWidget.destroyed) {
                        triggerEvent(activeWidget, 'focusout');
                        activeWidget = null;
                    }
                    if (widget.id !== WIDGET_ROOT) {
                        activeWidget = widget;
                        triggerEvent(activeWidget, 'focusin');
                    }
                }
            }

            function triggerClick(e, point) {
                var props = {
                    clientX: (point || e).clientX,
                    clientY: (point || e).clientY,
                    target: e.target
                };
                triggerEvent(EVENT_HANDLER, getEventName(e, 'click'), null, props);
            }

            function updateFromNativeInput() {
                var activeRange = getActiveRange(topElement);
                if (!userFocus.has(typer) && activeRange && !rangeEquals(activeRange, createRange(currentSelection))) {
                    undoable.snapshot(200);
                    currentSelection.select(activeRange);
                    updateWidgetFocus();
                }
            }

            function deleteNextContent(e) {
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
                if (inputText && triggerDefaultPreventableEvent(EVENT_ALL, 'textInput', inputText)) {
                    return true;
                }
                if (compositionend || !currentSelection.startTextNode || !currentSelection.isCaret) {
                    insertContents(currentSelection, inputText);
                    return true;
                }
                setImmediate(function () {
                    setEventSource('input', typer);
                    updateFromNativeInput();
                    normalizeWhitespace(currentSelection.startElement);
                    currentSelection.focus();
                });
                trackChange(currentSelection.focusNode);
                codeUpdate($.noop);
            }

            function handleDataTransfer(clipboardData) {
                if ($.inArray('application/x-typer', clipboardData.types) >= 0) {
                    var html = clipboardData.getData('text/html');
                    var content = createDocumentFragment($(html).filter('#Typer').contents());
                    insertContents(currentSelection, content);
                } else {
                    var textContent = clipboardData.getData(IS_IE ? 'Text' : 'text/plain');
                    if (textContent === clipboard.textContent) {
                        insertContents(currentSelection, clipboard.content.cloneNode(true));
                    } else {
                        handleTextInput(textContent, true);
                    }
                }
            }

            $self.mousedown(function (e) {
                var extendCaret = currentSelection.extendCaret;
                var scrollTimeout;
                var handlers = {
                    mouseout: function (e) {
                        var lastX = e.clientX;
                        var lastY = e.clientY;
                        scrollTimeout = setInterval(function () {
                            scrollRectIntoView(topElement, toPlainRect(lastX - 50, lastY - 50, lastX + 50, lastY + 50));
                            if (!extendCaret.moveToPoint(lastX, lastY)) {
                                clearInterval(scrollTimeout);
                            }
                        }, 20);
                    },
                    mousemove: function (e) {
                        if (!e.which && mousedown) {
                            handlers.mouseup();
                            return;
                        }
                        clearInterval(scrollTimeout);
                        undoable.snapshot(200);
                        extendCaret.moveToPoint(e.clientX, e.clientY);
                        setImmediate(function () {
                            currentSelection.focus();
                        });
                        e.preventDefault();
                    },
                    mouseup: function (e2) {
                        mousedown = false;
                        clearInterval(scrollTimeout);
                        $(document.body).off(handlers);
                        if (e2 && e2.clientX === e.clientX && e2.clientY === e.clientY) {
                            var node = typer.getNode(e2.target);
                            if (is(node, NODE_WIDGET | NODE_INLINE_WIDGET)) {
                                currentSelection.select(node.widget.element);
                            }
                        }
                        updateWidgetFocus();
                    }
                };
                if (e.which === 1) {
                    (e.shiftKey ? extendCaret : currentSelection).moveToPoint(e.clientX, e.clientY);
                    currentSelection.focus();
                    $(document.body).on(handlers);
                    mousedown = true;
                }
                e.preventDefault();
            });

            $self.on('compositionstart compositionupdate compositionend', function (e) {
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

            $self.on('keydown keypress keyup', function (e) {
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
                        if (triggerEvent(EVENT_HANDLER, keyEventName)) {
                            e.preventDefault();
                        }
                        if (triggerDefaultPreventableEvent(EVENT_ALL, 'keystroke', keyEventName, e) || /ctrl(?![acfnprstvwx]|f5|shift[nt]$)|enter/i.test(keyEventName)) {
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

            $self.on('keypress input textInput', function (e) {
                if (!executing && !suppressTextEvent && (e.type === 'textInput' || !supportTextInputEvent) && (e.type !== 'keypress' || (!e.ctrlKey && !e.altKey && !e.metaKey))) {
                    if (handleTextInput(e.originalEvent.data || String.fromCharCode(e.charCode) || '')) {
                        e.preventDefault();
                    }
                }
            });

            $self.on('cut copy', function (e) {
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

            $self.on('paste', function (e) {
                setEventSource('paste', typer);
                handleDataTransfer(e.originalEvent.clipboardData || window.clipboardData);
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

            $self.on('drop', function (e) {
                setEventSource('drop', typer);
                if (currentSelection.moveToPoint(e.originalEvent.clientX, e.originalEvent.clientY)) {
                    handleDataTransfer(e.originalEvent.dataTransfer);
                }
                currentSelection.focus();
                e.preventDefault();
            });

            $self.on('touchstart touchmove touchend', function (e) {
                if (e.type === 'touchend' && touchObj) {
                    currentSelection.moveToPoint(touchObj.clientX, touchObj.clientY);
                    currentSelection.focus();
                    triggerClick(e, touchObj);
                    e.preventDefault();
                }
                var touches = e.originalEvent.touches;
                touchObj = e.type === 'touchstart' && !touches[1] && touches[0];
            });

            $self.on('contextmenu', function (e) {
                var range = caretRangeFromPoint(e.clientX, e.clientY, topElement);
                if (currentSelection.isCaret || !rangeIntersects(currentSelection, range)) {
                    currentSelection.select(range);
                }
            });

            $self.on('click', function (e) {
                triggerClick(e);
                e.preventDefault();
            });

            $self.on('dblclick', function (e) {
                if (!triggerEvent(EVENT_HANDLER, 'dblclick')) {
                    currentSelection.select('word');
                }
                e.preventDefault();
            });

            $self.on('mousewheel', function (e) {
                if (typerFocused && triggerDefaultPreventableEvent(EVENT_HANDLER, 'mousewheel', Typer.ui.getWheelDelta(e))) {
                    e.preventDefault();
                }
            });

            $self.on('focusin', function (e) {
                userFocus.delete(typer);
                // prevent focus event triggered due to content updates through code
                // when current editor is not focused
                if (typerFocused || (executing && !permitFocusEvent)) {
                    return;
                }
                permitFocusEvent = false;
                windowFocusedOut = false;
                checkNativeUpdate = updateFromNativeInput;
                if (!typerFocused) {
                    typerFocused = true;
                    triggerEvent(EVENT_ALL, 'focusin');
                    if (!mousedown) {
                        currentSelection.focus();
                    }
                }
            });

            $self.on('focusout', function (e) {
                if (document.activeElement !== topElement && typerFocused) {
                    if (e.relatedTarget === undefined) {
                        // Chrome triggers focusout event with relatedTarget equals undefined
                        // after contextmenu event by right mouse click
                        return;
                    }
                    if (!focusRetained(e.relatedTarget || lastTouchedElement)) {
                        typerFocused = false;
                        checkNativeUpdate = null;
                        updateWidgetFocus();
                        triggerEvent(EVENT_ALL, 'focusout');

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
                }
            });

            var defaultKeystroke = {
                ctrlZ: undoable.undo,
                ctrlY: undoable.redo,
                ctrlShiftZ: undoable.redo,
                backspace: deleteNextContent,
                delete: deleteNextContent,
                space: function () {
                    insertContents(currentSelection, ' ');
                },
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
            options.textFlow = true;

            var contentWidgets = Object.keys(widgetOptions).slice(0, -1).filter(function (v) {
                return widgetOptions[v].element;
            });
            contentWidgets.forEach(function (v) {
                widgetOptions[v].allowedWidgets = contentWidgets.filter(function (w) {
                    return w !== WIDGET_ROOT && matchWidgetList(w, 'allowedIn', v) && matchWidgetList(v, 'allow', w);
                }).join(' ');
            });
        }

        function retainFocusHandler(e) {
            var relatedTarget = e.relatedTarget || lastTouchedElement;
            if (!containsOrEquals(e.currentTarget, relatedTarget) && !focusRetained(relatedTarget)) {
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
            widgetAllowed: function (id, node) {
                node = is(node, TyperNode) || typer.getNode(node || topElement);
                return !!widgetAllowed(id, node);
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
            retainFocus: function (element) {
                if (!relatedElements.has(element)) {
                    relatedElements.set(element, true);
                    $(element).on('focusout', retainFocusHandler);
                }
            },
            releaseFocus: function (element) {
                relatedElements.delete(element);
                $(element).off('focusout', retainFocusHandler);
            },
            invoke: function (command, value) {
                var tx = new TyperTransaction();
                if (typeof command === 'string') {
                    tx.commandName = command;
                    tx.widget = findWidgetWithCommand(command);
                    command = tx.widget && widgetOptions[tx.widget.id].commands[command];
                }
                if (isFunction(command)) {
                    codeUpdate(function () {
                        command.call(typer, tx, value);
                        undoable.snapshot();
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
                insertContents(currentSelection, is(content, Node) || createDocumentFragment(content));
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
                removeNode(oldElement);
                return newElement;
            },
            removeElement: function (element) {
                removeNode(element);
            }
        });

        currentSelection = new TyperSelection(typer, createRange(topElement, 0));
        codeUpdate(normalize);
        triggerEvent(EVENT_STATIC, 'init');
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
        NODE_ANY_ALLOWTEXT: NODE_ANY_ALLOWTEXT,
        NODE_ANY_BLOCK_EDITABLE: NODE_ANY_BLOCK_EDITABLE,
        NODE_ANY_INLINE: NODE_ANY_INLINE,
        ZWSP: ZWSP,
        ZWSP_ENTITIY: ZWSP_ENTITIY,
        msie: IS_IE,
        msie10: IS_IE10,
        is: is,
        trim: trim,
        iterate: iterate,
        iterateToArray: iterateToArray,
        setImmediateOnce: setImmediateOnce,
        closest: closest,
        getCommonAncestor: getCommonAncestor,
        sameElementSpec: sameElementSpec,
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
        toPlainRect: toPlainRect,
        getRect: getRect,
        caretRangeFromPoint: caretRangeFromPoint,
        elementFromPoint: function (x, y) {
            return elementFromPoint_.call(document, x, y);
        },
        historyLevel: 100,
        defaultOptions: {
            widgets: {}
        },
        widgets: {}
    });

    definePrototype(Typer, {
        createCaret: function (node, offset) {
            var caret = new TyperCaret(this);
            if (node) {
                caret.moveTo(node, offset);
            }
            return caret;
        },
        createSelection: function (startNode, startOffset, endNode, endOffset) {
            return new TyperSelection(this, createRange(startNode, startOffset, endNode, endOffset));
        },
        nodeFromPoint: function (x, y, whatToShow) {
            var range = caretRangeFromPoint(x, y, this.element);
            if (range) {
                var node = this.getNode(range.startContainer);
                if (is(node, NODE_EDITABLE)) {
                    node = any(node.childNodes, function (v) {
                        var r = getRect(v.element);
                        return r.top <= y && r.bottom >= y;
                    }) || node;
                }
                return closest(node, whatToShow || -1);
            }
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
            var arr = this.childNodes;
            return arr[arr.length - 1] || null;
        }
    });

    function treeWalkerIsNodeVisible(inst, node) {
        return node && ((inst.whatToShow & NODE_SHOW_HIDDEN) || node.element.offsetWidth > 0 || node.element.offsetHeight > 0) && node;
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
        var typer = iterator.currentNode.typer;
        var iterator2 = document.createTreeWalker(iterator.root.element, inst.whatToShow | 1, function (v) {
            var node = typer.getNode(v);
            return (node.element !== (isElm(v) || v.parentNode) && !isBR(v)) || treeWalkerAcceptNode(iterator, node, true) !== 1 ? 3 : acceptNode(inst, v) | 1;
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
        return new TyperTreeWalker(inst.focusNode, whatToShow & ~NODE_SHOW_HIDDEN, function (v) {
            return !rangeIntersects(v.element, range) ? 2 : !filter ? 1 : filter(v);
        });
    }

    function selectionIterateTextNodes(inst) {
        return iterateToArray(new TyperDOMNodeIterator(selectionCreateTreeWalker(inst, NODE_ANY_ALLOWTEXT), 4), null, inst.startTextNode || inst.startElement, function (v) {
            return comparePosition(v, inst.endTextNode || inst.endElement) <= 0;
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
            selectionAtomic(function () {
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

    function selectionAtomic(callback, args, thisArg) {
        selectionAtomic.executing = true;
        return selectionAtomic.run(callback, args, thisArg);
    }
    selectionAtomic.run = transaction(function () {
        selectionAtomic.executing = false;
        dirtySelections.forEach(selectionUpdate);
        dirtySelections.clear();
    });

    function selectionUpdate(inst) {
        if (selectionAtomic.executing) {
            dirtySelections.add(inst);
            return;
        }
        inst.timestamp = performance.now();
        inst.direction = compareRangePosition(inst.extendCaret.getRange(), inst.baseCaret.getRange()) || 0;
        inst.isCaret = !inst.direction;
        for (var i = 0, p1 = inst.getCaret('start'), p2 = inst.getCaret('end'); i < 4; i++) {
            inst[selectionUpdate.NAMES[i + 4]] = p1[selectionUpdate.NAMES[i]];
            inst[selectionUpdate.NAMES[i + 8]] = p2[selectionUpdate.NAMES[i]];
        }
        var node = inst.typer.getNode(getCommonAncestor(inst.baseCaret.element, inst.extendCaret.element));
        inst.focusNode = closest(node, NODE_WIDGET | NODE_INLINE_WIDGET | NODE_ANY_BLOCK_EDITABLE | NODE_INLINE_EDITABLE);
        selectionCache.get(inst).m = 0;
        if (inst === inst.typer.getSelection()) {
            if (inst.typer.focused() && !userFocus.has(inst.typer)) {
                inst.focus();
            }
            inst.typer.snapshot();
        }
    }
    selectionUpdate.NAMES = 'node element textNode offset startNode startElement startTextNode startOffset endNode endElement endTextNode endOffset'.split(' ');

    definePrototype(TyperSelection, {
        get isSingleEditable() {
            return this.isCaret || !selectionCreateTreeWalker(this, NODE_ANY_BLOCK_EDITABLE).nextNode();
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
            return iterateToArray(new TyperTreeWalker(self.focusNode, NODE_PARAGRAPH), function (v) {
                return v.element;
            }, self.startNode, self.endNode);
        },
        getSelectedElements: function () {
            var self = this;
            if (self.isCaret) {
                return [self.startElement];
            }
            return $(selectionIterateTextNodes(self)).parent().get();
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
            return selectionIterateTextNodes(self);
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
            return selectionAtomic(function () {
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
                scrollRectIntoView(topElement, this.extendCaret.getRect());
            }
        },
        clone: function () {
            var self = this;
            var inst = new TyperSelection(self.typer);
            selectionAtomic(function () {
                inst.baseCaret.moveTo(self.baseCaret);
                inst.extendCaret.moveTo(self.extendCaret);
            });
            return inst;
        },
        widgetAllowed: function (id) {
            return this.typer.widgetAllowed(id, this.focusNode);
        }
    });

    $.each('moveTo moveToPoint moveToText moveByLine moveToLineEnd moveByWord moveByCharacter'.split(' '), function (i, v) {
        TyperSelection.prototype[v] = function () {
            var self = this;
            return selectionAtomic(function () {
                return TyperCaret.prototype[v].apply(self.extendCaret, arguments) + self.collapse('extend') > 0;
            }, slice(arguments));
        };
    });
    $.each('getWidgets getParagraphElements getSelectedElements getSelectedText getSelectedTextNodes'.split(' '), function (i, v) {
        var fn = TyperSelection.prototype[v];
        TyperSelection.prototype[v] = function () {
            var cache = selectionCache.get(this);
            if (!(cache.m & (1 << i))) {
                cache[v] = fn.apply(this, arguments);
                cache.m |= (1 << i);
            }
            return cache[v];
        };
    });

    function caretTextNodeIterator(inst, root, whatToShow) {
        var iterator = new TyperDOMNodeIterator(new TyperTreeWalker(root || inst.typer.rootNode, NODE_ANY_ALLOWTEXT | NODE_WIDGET), whatToShow | 4);
        iterator.currentNode = inst.textNode || inst.element;
        return iterator;
    }

    function caretAtomic(inst, callback) {
        return inst.selection ? selectionAtomic(callback, null, inst) : callback.call(inst);
    }

    function caretEnsureState(inst) {
        var root = inst.typer.element;
        var node = inst.textNode || inst.element;
        if (!containsOrEquals(root, node) || inst.offset > node.length) {
            if (!inst.node) {
                inst.moveTo(root, 0);
            } else if (containsOrEquals(root, inst.textNode) && inst.offset <= node.length) {
                inst.moveTo(node, inst.offset);
            } else if (containsOrEquals(root, inst.node.element)) {
                inst.moveToText(inst.node.element, inst.wholeTextOffset);
            } else {
                inst.typer.getNode(node);
                for (var replace = inst.element; detachedElements.has(replace); replace = detachedElements.get(replace));
                inst.moveTo(replace, false);
            }
        }
        return inst;
    }

    function caretSetPositionRaw(inst, node, element, textNode, offset) {
        inst.node = node;
        inst.element = element;
        inst.textNode = textNode || null;
        inst.offset = offset;
        inst.wholeTextOffset = (textNode ? inst.offset : 0) + getWholeTextOffset(node, textNode || element);
        if (inst.selection) {
            selectionUpdate(inst.selection);
        }
        return true;
    }

    function caretSetPosition(inst, element, offset) {
        var textNode, end;
        if (isBR(element)) {
            textNode = isText(element.nextSibling) || $(createTextNode()).insertAfter(element)[0];
            offset = 0;
        } else {
            if (element.firstChild) {
                end = offset === element.childNodes.length;
                element = element.childNodes[offset] || element.lastChild;
                offset = end ? element.length : 0;
            }
            textNode = isText(element);
        }
        var node = inst.typer.getNode(element);
        if (!is(node, NODE_ANY_ALLOWTEXT | NODE_WIDGET)) {
            var child = any(node.childNodes, function (v) {
                return comparePosition(textNode, v.element) < 0;
            });
            node = child || node.lastChild || node;
            textNode = null;
            end = !child;
        }
        if (inst.selection && inst === inst.selection.extendCaret && is(node.previousSibling, NODE_WIDGET) === inst.selection.baseCaret.node) {
            node = node.previousSibling;
            textNode = null;
            end = true;
        }
        if (!textNode && is(node, NODE_ANY_ALLOWTEXT)) {
            var iterator = new TyperDOMNodeIterator(new TyperTreeWalker(node, NODE_ANY_ALLOWTEXT), 4);
            while (iterator.nextNode() && end);
            textNode = isText(iterator.currentNode) || $(createTextNode())[end ? 'appendTo' : 'prependTo'](node.element)[0];
            offset = textNode && end ? textNode.length : 0;
        }
        if (textNode) {
            var moveToMostInner = function (dir, pSib, pChild, mInsert) {
                var next = isTextNodeEnd(textNode, offset, dir) && isElm(textNode[pSib]);
                if (next && !isBR(next) && is(inst.typer.getNode(next), NODE_ANY_ALLOWTEXT)) {
                    textNode = isText(next[pChild]) || $(createTextNode())[mInsert](next)[0];
                    offset = getOffset(textNode, 0 * dir);
                    return true;
                }
            };
            while (moveToMostInner(-1, 'previousSibling', 'lastChild', 'appendTo') || moveToMostInner(1, 'nextSibling', 'firstChild', 'prependTo'));
            if (!textNode.length) {
                textNode.data = ZWSP;
                offset = 1;
            }
        }
        return caretSetPositionRaw(inst, closest(node, NODE_ANY_BLOCK), textNode ? textNode.parentNode : node.element, textNode, textNode ? offset : !end);
    }

    definePrototype(TyperCaret, {
        getRect: function () {
            var self = caretEnsureState(this);
            if (!self.textNode) {
                var prop = self.offset ? 'left' : 'right';
                var elmRect = getRect(self.element);
                return toPlainRect(elmRect[prop], elmRect.top, elmRect[prop], elmRect.bottom);
            }
            var rect = rectFromPosition(self.textNode, self.offset);
            if (!rect || !rect.height) {
                // Mozilla returns a zero height rect and IE returns no rects for range collapsed at whitespace characters
                // infer the position by getting rect for preceding non-whitespace character
                var iterator = caretTextNodeIterator(self, self.node);
                do {
                    var r = rectFromPosition(iterator.currentNode, /(\s)$/.test(iterator.currentNode.data) ? -RegExp.$1.length : -0);
                    if (r && r.height) {
                        return rect ? toPlainRect(rect.left, r.top, rect.left, r.bottom) : r;
                    }
                } while (iterator.previousNode());
            }
            return rect || toPlainRect(0, 0, 0, 0);
        },
        getRange: function () {
            var self = caretEnsureState(this);
            var node = self.textNode || self.element;
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
            if (range && containsOrEquals(this.typer.element, range.startContainer)) {
                return caretSetPosition(this, range.startContainer, range.startOffset);
            }
            return false;
        },
        moveToPoint: function (x, y) {
            var range = caretRangeFromPoint(x, y, this.typer.element);
            if (range) {
                var node = this.typer.getNode(range.startContainer);
                if (is(node, NODE_WIDGET)) {
                    // range returned is anchored at the closest text node which may or may not be at the point (x, y)
                    // avoid moving caret to widget element that does not actually cover that point
                    if (!pointInRect(x, y, getRect(node.element))) {
                        range = createRange(node.element, false);
                    }
                }
                return this.moveTo(range);
            }
            return false;
        },
        moveToText: function (node, offset) {
            if (node.nodeType !== 3) {
                var iterator = new TyperDOMNodeIterator(new TyperTreeWalker(this.typer.getNode(node), NODE_ANY_ALLOWTEXT), 4);
                if (1 / offset > 0) {
                    for (; iterator.nextNode() && offset > iterator.currentNode.length; offset -= iterator.currentNode.length);
                } else {
                    while (iterator.nextNode());
                }
                node = iterator.currentNode;
            }
            return !!node && caretSetPosition(this, node, getOffset(node, offset));
        },
        moveToLineEnd: function (direction) {
            var self = caretEnsureState(this);
            var iterator = caretTextNodeIterator(self, self.node);
            var rect = self.getRect();
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
            var iterator = new TyperTreeWalker(self.typer.rootNode, NODE_PARAGRAPH | NODE_EDITABLE_PARAGRAPH | NODE_WIDGET);
            var rect = self.getRect();
            var node = self.node;
            var deltaX = Infinity;
            var untilY = Infinity * direction;
            var nextBlock;
            var newRect;

            iterator.currentNode = node;
            do {
                if (is(node, NODE_WIDGET)) {
                    if (!containsOrEquals(node.element, self.element)) {
                        nextBlock = nextBlock || node.element;
                    }
                } else {
                    var elmRect = getRect(node.element);
                    if (direction > 0 ? elmRect.top > untilY : elmRect.bottom < untilY) {
                        break;
                    }
                    var rects = computeTextRects(node.element);
                    $.each(direction < 0 ? slice(rects).reverse() : rects, function (i, v) {
                        if (direction < 0 ? v.bottom <= rect.top : v.top >= rect.bottom) {
                            if ((v.top + v.bottom) / 2 * direction > untilY * direction) {
                                return false;
                            }
                            untilY = direction > 0 ? v.bottom : v.top;
                            if (v.right >= rect.left && v.left <= rect.left) {
                                deltaX = 0;
                                newRect = v;
                            } else if (Math.abs(v.right - rect.left) < Math.abs(deltaX)) {
                                deltaX = v.right - rect.left;
                                newRect = v;
                            } else if (Math.abs(v.left - rect.left) < Math.abs(deltaX)) {
                                deltaX = v.left - rect.left;
                                newRect = v;
                            }
                        }
                    });
                }
            } while (deltaX && (node = iterator[direction < 0 ? 'previousNode' : 'nextNode']()) && (!nextBlock || containsOrEquals(nextBlock, node.element)));

            if (newRect) {
                var delta = scrollRectIntoView(self.typer.element, newRect);
                return self.moveToPoint(rect.left + deltaX - delta.x, (newRect.top + newRect.bottom) / 2 - delta.y);
            }
            if (nextBlock) {
                return self.moveTo(nextBlock, true);
            }
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
            var rect = self.getRect();
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
                        if (is(self.typer.getNode(node), NODE_WIDGET) && !containsOrEquals(node, self.element)) {
                            return self.moveToText(node, 0 * direction) || self.moveTo(node, direction < 0);
                        }
                        overBr |= isBR(node);
                    }
                    offset = (direction < 0 ? node.length : 0) + ((overBr || !containsOrEquals(self.node.element, node)) && -direction);
                }
                offset += direction;
                var newRect = node.data.charAt(offset) !== ZWSP && rectFromPosition(node, offset);
                if (newRect && !rectEquals(rect, newRect)) {
                    return self.moveToText(node, offset);
                }
            }
        }
    });

    $.each('moveByLine moveByWord moveByCharacter'.split(' '), function (i, v) {
        var fn = TyperCaret.prototype[v];
        TyperCaret.prototype[v] = function (direction) {
            var self = caretEnsureState(this);
            return caretAtomic(self, function () {
                for (var step = direction; step && fn.call(self, direction / Math.abs(direction)); step += step > 0 ? -1 : 1);
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

    setInterval(function () {
        if (!windowFocusedOut && checkNativeUpdate) {
            checkNativeUpdate();
        }
    }, 100);

    $(window).on('focusin focusout', function (e) {
        // IE raise event on the current active element instead of window object when browser loses focus
        // need to check if there is related target instead
        if (IS_IE ? !e.relatedTarget : e.target === window) {
            windowFocusedOut = e.type === 'focusout';
        }
    });

    $(function () {
        trackEventSource(document.body);
    });

    // polyfill for document.elementFromPoint and especially for IE
    if (!elementFromPoint_) {
        elementFromPoint_ = function (x, y) {
            function hitTestChildElements(node) {
                var currentZIndex;
                var target;
                $(node).children().each(function (i, v) {
                    var style = window.getComputedStyle(v);
                    var zIndex = style.position === 'static' ? undefined : parseInt(style.zIndex) || 0;
                    if (style.pointerEvents !== 'none' && (currentZIndex === undefined || zIndex >= currentZIndex)) {
                        var containsPoint = any(style.display === 'inline' ? v.getClientRects() : [getRect(v)], function (v) {
                            return pointInRect(x, y, v);
                        });
                        if (containsPoint) {
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
            var element = IS_IE10 ? document.body : document.elementFromPoint(x, y);
            for (var child = element; child; element = child || element) {
                child = hitTestChildElements(element);
            }
            return element;
        };
    }

    // polyfill for document.caretRangeFromPoint
    if (!caretRangeFromPoint_) {
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
                    // IE11 (update version 11.0.38) crashes with memory access violation when
                    // Range.getClientRects() is called on a whitespace neignboring a non-static positioned element
                    // https://jsfiddle.net/b6q4p664/
                    while (/[^\S\u00a0]/.test(node.data.charAt(index)) && --index);
                    var rect = rectFromPosition(node, index);
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

                var newY = y;
                var element = elementFromPoint_.call(document, x, y);
                for (var target = element, distY, lastDistY; isElm(target); element = target || element) {
                    distY = Infinity;
                    target = null;
                    $(element).contents().each(function (i, v) {
                        var rects;
                        if (isText(v)) {
                            rects = computeTextRects(v);
                        } else if (isElm(v) && $(v).css('pointer-events') !== 'none') {
                            rects = [getRect(v)];
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

}(jQuery, document.documentElement, Array.prototype));
