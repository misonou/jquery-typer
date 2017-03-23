(function ($, window, document, String, Node, Range, DocumentFragment, WeakMap, array) {
    'use strict';

    var KEYNAMES = JSON.parse('{"8":"backspace","9":"tab","13":"enter","16":"shift","17":"ctrl","18":"alt","19":"pause","20":"capsLock","27":"escape","32":"space","33":"pageUp","34":"pageDown","35":"end","36":"home","37":"leftArrow","38":"upArrow","39":"rightArrow","40":"downArrow","45":"insert","46":"delete","48":"0","49":"1","50":"2","51":"3","52":"4","53":"5","54":"6","55":"7","56":"8","57":"9","65":"a","66":"b","67":"c","68":"d","69":"e","70":"f","71":"g","72":"h","73":"i","74":"j","75":"k","76":"l","77":"m","78":"n","79":"o","80":"p","81":"q","82":"r","83":"s","84":"t","85":"u","86":"v","87":"w","88":"x","89":"y","90":"z","91":"leftWindow","92":"rightWindowKey","93":"select","96":"numpad0","97":"numpad1","98":"numpad2","99":"numpad3","100":"numpad4","101":"numpad5","102":"numpad6","103":"numpad7","104":"numpad8","105":"numpad9","106":"multiply","107":"add","109":"subtract","110":"decimalPoint","111":"divide","112":"f1","113":"f2","114":"f3","115":"f4","116":"f5","117":"f6","118":"f7","119":"f8","120":"f9","121":"f10","122":"f11","123":"f12","144":"numLock","145":"scrollLock","186":"semiColon","187":"equalSign","188":"comma","189":"dash","190":"period","191":"forwardSlash","192":"backtick","219":"openBracket","220":"backSlash","221":"closeBracket","222":"singleQuote"}');
    var VOID_TAGS = 'area base br col command embed hr img input keygen link meta param source track wbr'.split(' ');
    var INNER_PTAG = 'h1,h2,h3,h4,h5,h6,p,q,blockquote,pre,code,li,caption,figcaption,summary,dt,th';
    var ZWSP = '\u200b';
    var ZWSP_ENTITIY = '&#8203;';
    var EMPTY_LINE = '<p>&#8203;</p>';
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

    var isFunction = $.isFunction;
    var selection = window.getSelection();
    var caretRangeFromPoint_ = document.caretRangeFromPoint;
    var clipboard = {};
    var userFocus;
    var caretNotification;
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
        function check(prop) {
            return Math.abs(a[prop] - b[prop]) < 1;
        }
        return check('left') && check('top') && check('bottom') && check('right');
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
        if (element && element !== document.body && pointInRect(x, y, element.getBoundingClientRect())) {
            var elm = [];
            try {
                while (comparePosition(element, range.commonAncestorContainer, true)) {
                    var target = $(range.commonAncestorContainer).parentsUntil(getCommonAncestor(element, range.commonAncestorContainer)).slice(-1)[0] || range.commonAncestorContainer;
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
        var undoable = {};
        var currentSelection;
        var typerDocument;
        var typerFocused = false;
        var $self = $(topElement);

        var codeUpdate = transaction(function () {
            if (codeUpdate.needSnapshot) {
                undoable.snapshot();
            }
            // IE fires textinput event on the parent element when the text node's value is modified
            // even if modification is done through JavaScript rather than user action
            codeUpdate.suppressTextEvent = true;
            setImmediate(function () {
                codeUpdate.suppressTextEvent = false;
            });
        });

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

        function triggerEvent(eventMode, eventName, data, props) {
            var widgets = $.makeArray(is(eventMode, TyperWidget) || getTargetedWidgets(eventMode));
            var handlerCalled;
            codeUpdate(function () {
                $.each(widgets, function (i, v) {
                    var options = widgetOptions[v.id];
                    if (!v.destroyed && isFunction(options[eventName])) {
                        handlerCalled = true;
                        options[eventName].call(options, new TyperEvent(eventName, typer, v, data, props));
                        return eventMode !== EVENT_HANDLER;
                    }
                });
            });
            if (is(eventMode, TyperWidget)) {
                setTimeout(function () {
                    triggerEvent(EVENT_STATIC, 'widget' + capfirst(eventName), null, {
                        targetWidget: eventMode
                    });
                });
            }
            return handlerCalled;
        }

        function triggerDefaultPreventableEvent(eventMode, eventName, data, eventObj) {
            eventObj = eventObj || $.Event(eventName);
            triggerEvent(eventMode, eventName, data, {
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
                            triggerEvent(node.widget, 'destroy');
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
                        triggerEvent(node.widget, 'destroy');
                    }
                    delete node.widget;
                    $.each(widgetOptions, function (i, v) {
                        if (is(node.element, v.element)) {
                            node.widget = new TyperWidget(nodeSource, i, node.element, v.options);
                            return false;
                        }
                    });
                    if (fireEvent && node.widget) {
                        triggerEvent(node.widget, 'init');
                    }
                }
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
            nodeMap.set(rootElement, new TyperNode(topNodeType, rootElement, new TyperWidget(nodeSource, '__root__', topElement, options)));
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

        function checkEditable(range) {
            var selection = new TyperSelection(typer, range);
            if (is(selection.focusNode, NODE_EDITABLE) && !selection.focusNode.childNodes[0]) {
                $(EMPTY_LINE).appendTo(selection.focusNode.element);
                return;
            }
            if (is(selection.focusNode, NODE_EDITABLE_PARAGRAPH) && !selection.focusNode.element.childNodes[0]) {
                $(createTextNode()).appendTo(selection.focusNode.element);
                return;
            }
        }

        function textNodeFreezed(textNode) {
            var t1 = currentSelection.baseCaret, t2 = currentSelection.extendCaret;
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
            codeUpdate(function () {
                checkEditable(range);
                iterate(new TyperSelection(typer, range).createTreeWalker(NODE_ANY_ALLOWTEXT | NODE_EDITABLE | NODE_SHOW_EDITABLE), function (node) {
                    if (is(node, NODE_ANY_INLINE) && !is(node.parentNode, NODE_ANY_ALLOWTEXT)) {
                        $(node.element).wrap('<p>');
                    }
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
                    } else if (!node.element.childNodes[0]) {
                        $(EMPTY_LINE).appendTo(node.element);
                    } else {
                        $(node.element).contents().each(function (i, v) {
                            if (v.nodeType === 3 && trim(v.nodeValue)) {
                                $(v).wrap('<p>');
                            }
                        });
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
                            if (!codeUpdate.executing && !codeUpdate.suppressTextEvent) {
                                $self.trigger(e);
                            }
                        });
                    }
                });
            });
        }

        function extractContents(range, mode, source, callback) {
            range = is(range, Range) || createRange(range);

            var method = mode === 'cut' ? 'extractContents' : mode === 'paste' ? 'deleteContents' : 'cloneContents';
            var cloneNode = mode !== 'paste';
            var clearNode = mode !== 'copy';
            var fragment = document.createDocumentFragment();
            var contentChangedWidgets = [];
            var state = new TyperSelection(typer, range);
            var allowTextFlow = state.isSingleEditable || ((state.startNode.widget.id === '__root__' || widgetOptions[state.startNode.widget.id].textFlow) && (state.endNode.widget.id === '__root__' || widgetOptions[state.endNode.widget.id].textFlow));

            var contentEvent = {
                addTarget: function (node) {
                    node = is(node, TyperNode) || typer.getNode(node);
                    if (contentChangedWidgets.indexOf(node.widget) < 0) {
                        contentChangedWidgets.push(node.widget);
                    }
                }
            };
            codeUpdate(function () {
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
                                    contentEvent.addTarget(node);
                                } else if (is(node, NODE_EDITABLE_PARAGRAPH)) {
                                    $(node.element).html(ZWSP_ENTITIY);
                                    contentEvent.addTarget(node);
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
                            contentEvent.addTarget(node);
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
                    if (is(newState.startNode, NODE_ANY_BLOCK_EDITABLE) && newState.startNode === newState.endNode && checkEditable(range)) {
                        newState = new TyperSelection(typer, createRange(newState.startNode.element, 'contents'));
                    }
                    // ensure start point lies within valid selection
                    if (compareRangePosition(startPoint, newState.startNode.element) < 0) {
                        startPoint = createRange(newState.startNode.element, 0);
                    }
                    callback(newState, startPoint, endPoint, contentEvent);
                }
                if (contentChangedWidgets[0]) {
                    $.each(contentChangedWidgets, function (i, v) {
                        triggerEvent(v, 'contentChange', source);
                    });
                    triggerEvent(EVENT_STATIC, 'contentChange', source);
                }
                normalize(range);
            });
            return fragment;
        }

        function insertContents(range, content, source) {
            if (!is(content, Node)) {
                content = String(content || '').replace(/\u000d/g, '').replace(/</g, '&lt;').replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>').replace(/.*/, '<p>$&</p>');
            }
            content = slice(createDocumentFragment(content).childNodes);

            extractContents(range, 'paste', source, function (state, startPoint, endPoint, contentEvent) {
                var allowedWidgets = ('__root__ ' + (widgetOptions[state.focusNode.widget.id].allowedWidgets || '*')).split(' ');
                var caretPoint = startPoint.cloneRange();
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
                    if (nodeToInsert.nodeType === 1 && tagName(nodeToInsert) !== 'br') {
                        startPoint.insertNode(nodeToInsert);
                        node = typerDocument.getNode(nodeToInsert);
                        removeNode(nodeToInsert);
                        if (node.widget.id === '__unknown__' || (allowedWidgets[1] !== '*' && allowedWidgets.indexOf(node.widget.id) < 0)) {
                            nodeToInsert = createTextNode(node.widget.id === '__unknown__' ? nodeToInsert.textContent : extractText(nodeToInsert));
                            node = new TyperNode(NODE_INLINE, nodeToInsert);
                        }
                    }
                    if (!is(node, NODE_ANY_ALLOWTEXT | NODE_INLINE_WIDGET) || (!is(node, NODE_ANY_INLINE) && !paragraphAsInline)) {
                        var splitLastNode = typerDocument.getEditableNode(caretPoint.startContainer);
                        while (!is(splitLastNode.parentNode, NODE_ANY_BLOCK_EDITABLE)) {
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
                        contentEvent.addTarget(splitEnd.startContainer);

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
                        caretPoint = splitFirstNode ? createRange(splitFirstNode, 0) : createRange(splitEnd, false);
                        endPoint = createRange(splitEnd, false);
                        paragraphAsInline = true;
                        hasInsertedBlock = true;
                    }
                    insertAsInline = insertAsInline && is(node, NODE_ANY_ALLOWTEXT | NODE_INLINE_WIDGET);
                    if (is(node, NODE_ANY_INLINE)) {
                        nodeToInsert = createDocumentFragment(wrapNode(nodeToInsert, insertAsInline ? formattingNodes.slice(0, -1) : formattingNodes));
                    } else if (insertAsInline && paragraphAsInline) {
                        nodeToInsert = createDocumentFragment(nodeToInsert.childNodes);
                    }
                    var lastNode = createDocumentFragment(nodeToInsert).lastChild;
                    if (insertAsInline) {
                        if (lastNode) {
                            caretPoint.insertNode(nodeToInsert);
                            caretPoint = is(node, NODE_INLINE_WIDGET) ? createRange(lastNode, false) : createRange(lastNode, -0);
                        }
                        paragraphAsInline = false;
                    } else {
                        var caretNode = typerDocument.getEditableNode(caretPoint.startContainer);
                        if (is(caretNode, NODE_ANY_BLOCK_EDITABLE)) {
                            caretPoint.insertNode(nodeToInsert);
                        } else {
                            createRange(caretNode.element, true).insertNode(nodeToInsert);
                        }
                        insertAsInline = is(node, NODE_ANY_ALLOWTEXT | NODE_INLINE_WIDGET);
                        caretPoint = insertAsInline ? createRange(lastNode, -0) : createRange(lastNode, false);
                        paragraphAsInline = !insertAsInline;
                        hasInsertedBlock = true;
                    }
                    contentEvent.addTarget(caretPoint.startContainer);
                }
                if (!hasInsertedBlock && state.startNode !== state.endNode && is(state.startNode, NODE_PARAGRAPH) && is(state.endNode, NODE_PARAGRAPH)) {
                    createRange(state.startNode.element, -0).insertNode(createRange(state.endNode.element, 'contents').extractContents());
                    removeNode(state.endNode.element);
                    contentEvent.addTarget(state.endNode);
                    contentEvent.addTarget(state.startNode);
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
            var snapshots = [lastValue];
            var currentIndex = 0;
            var snapshotTimeout;

            function triggerStateChange() {
                setTimeout(function () {
                    triggerEvent(EVENT_ALL, 'beforeStateChange');
                    triggerEvent(EVENT_ALL, 'stateChange');
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
                    triggerEvent(widget, 'focusout');
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
                    insertContents(currentSelection, '', 'keystroke');
                } else {
                    var selection = currentSelection.clone();
                    if (selection.extendCaret.moveByCharacter(e.data === 'backspace' ? -1 : 1)) {
                        insertContents(selection, '', 'keystroke');
                    }
                }
            }

            function handleTextInput(inputText, compositionend) {
                if (inputText && triggerDefaultPreventableEvent(EVENT_ALL, 'textInput', inputText)) {
                    return true;
                }
                if (compositionend || !currentSelection.startTextNode || !currentSelection.isCaret) {
                    insertContents(currentSelection, inputText, 'textInput');
                    return true;
                }
                setImmediate(function () {
                    updateFromNativeInput();
                    triggerEvent(EVENT_CURRENT, 'contentChange', 'textInput');
                    triggerEvent(EVENT_STATIC, 'contentChange', 'textInput');
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
                        if (triggerEvent(EVENT_HANDLER, keyEventName)) {
                            e.preventDefault();
                        }
                        if (triggerDefaultPreventableEvent(EVENT_ALL, 'keystroke', keyEventName, e) || /ctrl(?![acfnprstvwx]|f5|shift[nt]$)|enter/i.test(keyEventName)) {
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

            $self.bind('keypress textInput textinput', function (e) {
                if (!codeUpdate.executing && (e.type === 'keypress' || !codeUpdate.suppressTextEvent)) {
                    if (handleTextInput(e.originalEvent.data || String.fromCharCode(e.charCode) || '')) {
                        e.preventDefault();
                    }
                }
            });

            $self.bind('dragstart', function (e) {
                var selectedRange = createRange(currentSelection);
                var handlers = {
                    drop: function (e) {
                        var range = caretRangeFromPoint(e.originalEvent.clientX, e.originalEvent.clientY);
                        var content = extractContents(selectedRange, e.ctrlKey ? 'copy' : 'cut', e.type);
                        insertContents(range, content, e.type);
                        e.preventDefault();
                        $self.unbind(handlers);
                    }
                };
                $self.bind(handlers);
            });

            $self.bind('cut copy', function (e) {
                var clipboardData = e.originalEvent.clipboardData || window.clipboardData;
                clipboard.content = extractContents(currentSelection, e.type, e.type);
                clipboard.textContent = extractText(clipboard.content);
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
                    insertContents(currentSelection, content, e.type);
                } else {
                    var textContent = clipboardData.getData(window.clipboardData ? 'Text' : 'text/plain');
                    if (acceptHtml && textContent === clipboard.textContent) {
                        insertContents(currentSelection, clipboard.content.cloneNode(true), e.type);
                    } else if (!triggerDefaultPreventableEvent(EVENT_ALL, 'textInput', textContent)) {
                        insertContents(currentSelection, textContent, e.type);
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
                        triggerEvent(node.widget, 'focusin');
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
                triggerEvent(EVENT_HANDLER, getEventName(e, 'click'), null, props);
                e.preventDefault();
            });

            $self.bind('dblclick', function (e) {
                if (!triggerEvent(EVENT_HANDLER, 'dblclick')) {
                    currentSelection.select('word');
                }
                e.preventDefault();
            });

            $self.bind('focusin', function (e) {
                // prevent focus event triggered due to content updates through code
                // when current editor is not focused
                if (typerFocused || codeUpdate.executing) {
                    return;
                }
                if (!userFocus.has(typer)) {
                    typerFocused = true;
                    triggerEvent(EVENT_ALL, 'focusin');
                    if (!mousedown) {
                        currentSelection.focus();
                    }
                }
                windowFocusedOut = false;
                userFocus.delete(typer);
            });

            $self.bind('focusout', function (e) {
                if (document.activeElement !== topElement && typerFocused) {
                    for (var element = e.relatedTarget; element; element = element.parentNode) {
                        if (relatedElements.has(element)) {
                            userFocus.set(typer, element);
                            return;
                        }
                    }
                    typerFocused = false;
                    triggerWidgetFocusout();
                    triggerEvent(EVENT_ALL, 'focusout');
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
                    var direction = (j & 1) ? 1 : -1, extend = !!(j & 2);
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
            widgets[0] = new TyperWidget(typer, '__root__');
            $.each(options.widgets || {}, activateWidget);
            $.each(Typer.widgets, activateWidget);
            widgets[widgets.length] = new TyperWidget(typer, '__core__');

            widgetOptions.__root__ = options;
            widgetOptions.__core__ = {};
            widgetOptions.__unknown__ = {
                // make all other tags that are not considered paragraphs and inlines to be widgets
                // to avoid unknown behavior while editing
                element: options.disallowedElement || ':not(' + INNER_PTAG + ',br,b,em,i,u,strike,small,strong,sub,sup,ins,del,mark,span)'
            };
        }

        var retainFocusHandlers = {
            focusout: function (e) {
                if (!containsOrEquals(e.currentTarget, e.relatedTarget) && userFocus.get(typer) === e.currentTarget && !getActiveRange(topElement)) {
                    userFocus.delete(typer);
                    $self.trigger('focusout');
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
                relatedElements.set(element, true);
                $(element).bind(retainFocusHandlers);
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
        triggerEvent(EVENT_STATIC, 'init');
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
        innermost: function (elements) {
            return $.grep(elements, function (v) {
                return !any(elements, function (w) {
                    return $.contains(v, w);
                });
            });
        },
        outermost: function (elements) {
            return $.grep(elements, function (v) {
                return !any(elements, function (w) {
                    return $.contains(w, v);
                });
            });
        },
        replaceElement: function (oldElement, newElement) {
            newElement = is(newElement, Node) || createElement(newElement);
            $(newElement).append(oldElement.childNodes).insertBefore(oldElement);
            caretNotification.update(oldElement, newElement);
            removeNode(oldElement, false);
            return newElement;
        },
        removeElement: function (element) {
            removeNode(element);
        },
        historyLevel: 100,
        defaultOptions: {
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

    function nodeIteratorInit(inst, iterator) {
        var typer = iterator.currentNode.widget.typer;
        var iterator2 = document.createTreeWalker(iterator.root.element, inst.whatToShow | 1, function (v) {
            return treeWalkerAcceptNode(iterator, typer.getNode(v), true) !== 1 ? 3 : acceptNode(inst, v) | 1;
        }, false);
        defineProperty(inst, 'iterator', iterator2, false);
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
        focus: function () {
            if (containsOrEquals(document, this.typer.element)) {
                userFocus.delete(this.typer);
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
                        var n3 = containsOrEquals(oldElement, caret.textNode) ? null : caret.textNode;
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
            return this.moveTo(caretRangeFromPoint(x, y, this.typer.element));
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
                    var b0 = 0, b1 = node.length;
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

} (jQuery, window, document, String, Node, Range, DocumentFragment, window.WeakMap, Array.prototype));
