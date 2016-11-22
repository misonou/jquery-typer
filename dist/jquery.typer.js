/*!
 * jQuery Typer Plugin v0.8.3
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

(function ($, window, document, String, Node, Range, DocumentFragment, Map, array) {
    'use strict';

    var KEYNAMES = JSON.parse('{"8":"backspace","9":"tab","13":"enter","16":"shift","17":"ctrl","18":"alt","19":"pause","20":"capsLock","27":"escape","33":"pageUp","34":"pageDown","35":"end","36":"home","37":"leftArrow","38":"upArrow","39":"rightArrow","40":"downArrow","45":"insert","46":"delete","48":"0","49":"1","50":"2","51":"3","52":"4","53":"5","54":"6","55":"7","56":"8","57":"9","65":"a","66":"b","67":"c","68":"d","69":"e","70":"f","71":"g","72":"h","73":"i","74":"j","75":"k","76":"l","77":"m","78":"n","79":"o","80":"p","81":"q","82":"r","83":"s","84":"t","85":"u","86":"v","87":"w","88":"x","89":"y","90":"z","91":"leftWindow","92":"rightWindowKey","93":"select","96":"numpad0","97":"numpad1","98":"numpad2","99":"numpad3","100":"numpad4","101":"numpad5","102":"numpad6","103":"numpad7","104":"numpad8","105":"numpad9","106":"multiply","107":"add","109":"subtract","110":"decimalPoint","111":"divide","112":"f1","113":"f2","114":"f3","115":"f4","116":"f5","117":"f6","118":"f7","119":"f8","120":"f9","121":"f10","122":"f11","123":"f12","144":"numLock","145":"scrollLock","186":"semiColon","187":"equalSign","188":"comma","189":"dash","190":"period","191":"forwardSlash","192":"backtick","219":"openBracket","220":"backSlash","221":"closeBracket","222":"singleQuote"}');
    var VOID_TAGS = 'area base br col command embed hr img input keygen link meta param source track wbr'.split(' ');
    var INNER_PTAG = 'h1,h2,h3,h4,h5,h6,p,ul,ol,li,q,blockquote,pre,code';
    var OUTER_PTAG = 'ul,ol';
    var ZWSP = '\u200b';
    var ZWSP_ENTITIY = '&#8203;';
    var EMPTY_LINE = '<p>&#8203;</p>';
    var COLLAPSE_START_INSIDE = 7;
    var COLLAPSE_START_OUTSIDE = 6;
    var COLLAPSE_END_INSIDE = 3;
    var COLLAPSE_END_OUTSIDE = 2;
    var NODE_WIDGET = 1;
    var NODE_EDITABLE = 2;
    var NODE_PARAGRAPH = 4;
    var NODE_OUTER_PARAGRAPH = 8;
    var NODE_INLINE = 16;
    var NODE_EDITABLE_INLINE = 32;
    var NODE_SHOW_EDITABLE = 4096;
    var EVENT_ALL = 1;
    var EVENT_STATIC = 2;
    var EVENT_HANDLER = 3;
    var EVENT_CURRENT = 4;
    var IS_IE = !!window.ActiveXObject || document.documentElement.style.msTouchAction !== undefined;

    var isFunction = $.isFunction;
    var selection = window.getSelection();
    var suppressIETextInput;

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
        this.typerNodeIterator = is(root, TyperTreeWalker) || new TyperTreeWalker(root, NODE_PARAGRAPH | NODE_INLINE | NODE_WIDGET);
    }

    function replaceTimeout(source, fn, milliseconds) {
        clearTimeout(replaceTimeout[source.name]);
        replaceTimeout[source.name] = fn && setTimeout(fn, milliseconds);
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

    function variadic(args, pos) {
        if ($.isArray(args[pos])) {
            return args[pos];
        }
        return slice(args, pos);
    }

    function any(arr, callback) {
        var result;
        var args = [0].concat(variadic(arguments, 2));
        $.each(arr, function (i, v) {
            args[0] = v;
            result = callback.apply(this, args) && v;
            return !result;
        });
        return result;
    }

    function acceptNode(iterator, node) {
        var nodeType = (node || iterator.currentNode).nodeType;
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

    function isParagraphOrInline(node) {
        return is(node, NODE_PARAGRAPH | NODE_INLINE | NODE_EDITABLE_INLINE);
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
        var range;
        if (is(startNode, Node)) {
            range = document.createRange();
            if (endNode) {
                if (+startOffset === startOffset) {
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
                range[startOffset & 1 ? 'selectNodeContents' : 'selectNode'](startNode);
                if (startOffset & 2) {
                    range.collapse(!!(startOffset & 4));
                }
            }
        } else if (is(startNode, Range)) {
            range = startNode.cloneRange();
            if (!range.collapsed) {
                if (typeof startOffset === 'boolean') {
                    range.collapse(startOffset);
                } else if (startOffset & 2) {
                    range.collapse(!!(startOffset & 4));
                }
            }
        }
        if (is(startOffset, Range)) {
            if (range.collapsed && startOffset.collapsed) {
                range.setEnd(startOffset.endContainer, startOffset.endOffset);
            } else {
                if (range.compareBoundaryPoints(0, startOffset) <= 0) {
                    range.setStart(startOffset.startContainer, startOffset.startOffset);
                }
                if (range.compareBoundaryPoints(2, startOffset) >= 0) {
                    range.setEnd(startOffset.endContainer, startOffset.endOffset);
                }
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

    function getRangeFromMouseEvent(e) {
        if (document.caretRangeFromPoint) {
            return document.caretRangeFromPoint(e.clientX, e.clientY);
        }
        if (e.rangeParent) {
            return createRange(e.rangeParent, e.rangeOffset, true);
        }
        if (document.body.createTextRange) {
            var currentRange = selection.rangeCount && selection.getRangeAt(0);
            var textRange = document.body.createTextRange();
            textRange.moveToPoint(e.clientX, e.clientY);
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

    function createElement(name, className) {
        var node = document.createElement(name);
        if (className) {
            node.className = className;
        }
        return node;
    }

    function wrapNode(content, parentNodes) {
        $.each(parentNodes, function (i, v) {
            content = $(v.cloneNode(false)).append(content)[0];
        });
        return is(content, Node) || createDocumentFragment(content);
    }

    function Typer(options) {
        options = $.extend({
            element: null,
            controlClasses: '',
            controlElements: '',
            attributes: 'title target href src align name class width height',
            historyLevel: 100,
            widgets: [],
            inline: false,
            lineBreak: true,
            inlineStyle: true,
            formatting: true,
            list: true,
            link: true,
            change: null,
            beforeStateChange: null,
            stateChange: null
        }, options);

        var typer = this;
        var typerDocument;
        var topElement = options.element;
        var topNodeType = options.inline || is(topElement, INNER_PTAG) ? NODE_EDITABLE_INLINE : NODE_EDITABLE;
        var widgets = [];
        var widgetOptions = [options].concat(options.widgets);
        var currentSelection;
        var undoable = {};
        var userRange;
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

        function triggerEvent(eventMode, eventName) {
            var args = [0].concat(variadic(arguments, 2));
            var widgets = $.makeArray(is(eventMode, TyperWidget) || getTargetedWidgets(eventMode));
            var handlerCalled;
            $.each(widgets, function (i, v) {
                var options = widgetOptions[v.id];
                if (isFunction(options[eventName])) {
                    args[0] = new TyperEvent(eventName, typer, v);
                    handlerCalled = true;
                    return options[eventName].apply(options, args) !== false || eventMode !== EVENT_HANDLER;
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

        function createTyperDocument(rootElement) {
            var nodeMap = new Map();
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

            function removeFromParent(node, noevent) {
                if (node.parentNode) {
                    var index = node.parentNode.childNodes.indexOf(node);
                    if (index >= 0) {
                        if (!noevent && node.widget.element === node.element && containsOrEquals(document, rootElement)) {
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
                var pseudoElements = [];

                function getWidget(node) {
                    if (!node.widget || !is(node.element, widgetOptions[node.widget.id].element)) {
                        if (node.widget && containsOrEquals(document, rootElement)) {
                            node.widget.destroyed = true;
                            triggerEvent(node.widget, 'destroy');
                        }
                        delete node.widget;
                        $.each(widgetOptions, function (i, v) {
                            if (is(node.element, v.element)) {
                                node.widget = new TyperWidget(typer, i, node.element, v.options);
                                if (containsOrEquals(document, rootElement)) {
                                    triggerEvent(node.widget, 'init');
                                }
                                return false;
                            }
                        });
                    }
                    return node.widget;
                }

                function updateNodeFromElement(node) {
                    if (tagName(node.element) === 'li') {
                        if ($(node.element).children(OUTER_PTAG)[0]) {
                            node.nodeType = NODE_OUTER_PARAGRAPH;
                            var startIndex = 0;
                            $(node.element).contents().each(function (i, v) {
                                if (is(v, OUTER_PTAG) && (i > startIndex || !i)) {
                                    pseudoElements.push(createRange(node.element, startIndex, node.element, i));
                                    startIndex = i + 1;
                                }
                            });
                        } else {
                            node.nodeType = NODE_PARAGRAPH;
                        }
                    }
                    $.each(node.childNodes.slice(0), function (i, v) {
                        if (is(v.element, Range) || !containsOrEquals(rootElement, v.element)) {
                            removeFromParent(v);
                            nodeMap.delete(v.element);
                        }
                    });
                }

                updateNodeFromElement(stack[0]);

                // jQuery prior to 1.12.0 cannot directly apply selector to DocumentFragment
                var $children = childOnly ? $(element).children() : is(element, DocumentFragment) ? $(element).children().find('*').andSelf() : $('*', element);
                $children.each(function (i, v) {
                    while (pseudoElements[0] && comparePosition(pseudoElements[0].startContainer.childNodes[pseudoElements[0].startOffset], v) < 0) {
                        stack.unshift(new TyperNode(NODE_PARAGRAPH, pseudoElements.shift(), stack[0].widget));
                        addChild(stack[1], stack[0]);
                    }
                    while (!rangeCovers(stack[0].element, v)) {
                        stack.shift();
                    }
                    if (tagName(v) === 'br') {
                        if (nodeMap.has(v) && isParagraphOrInline(stack[0])) {
                            removeFromParent(nodeMap.get(v));
                            nodeMap.delete(v);
                        }
                        return;
                    }

                    var unvisited = !nodeMap.has(v);
                    var node = nodeMap.get(v) || new TyperNode(0, v);
                    node.widget = !is(stack[0], NODE_WIDGET) && getWidget(node) || stack[0].widget;

                    var widgetOption = widgetOptions[node.widget.id];
                    if (widgetOption.inline || (node.widget === stack[0].widget && !is(stack[0], NODE_WIDGET))) {
                        node.nodeType = is(v, OUTER_PTAG) ? NODE_OUTER_PARAGRAPH : is(v, INNER_PTAG) ? NODE_PARAGRAPH : NODE_INLINE;
                    } else if (is(v, widgetOption.editable)) {
                        node.nodeType = is(v, INNER_PTAG) ? NODE_EDITABLE_INLINE : NODE_EDITABLE;
                    } else {
                        node.nodeType = NODE_WIDGET;
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
            if (window.MutationObserver && containsOrEquals(document, rootElement)) {
                observer = new MutationObserver(handleMutations);
                observer.observe(rootElement, {
                    subtree: true,
                    childList: true
                });
            }
            nodeMap.set(rootElement, new TyperNode(topNodeType, rootElement, new TyperWidget(typer, 0, topElement, options)));
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
            selection.removeAllRanges();
            if (range && containsOrEquals(topElement, range.commonAncestorContainer)) {
                selection.addRange(range);
                userRange = range;
                currentSelection.dirty = true;
            }
        }

        function moveCaret(node, offset) {
            if (node && node.nodeType !== 3) {
                var iterator = new TyperDOMNodeIterator(typerDocument.getNode(node), 4);
                if (offset) {
                    for (; iterator.nextNode() && offset > iterator.currentNode.length; offset -= iterator.currentNode.length);
                } else if (1 / offset < 0) {
                    while (iterator.nextNode());
                    offset = iterator.currentNode.length;
                } else {
                    iterator.nextNode();
                }
                node = iterator.currentNode;
            }
            select(node, offset || 0, node, offset || 0);
        }

        function computeSelection(range) {
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
                        offset = 0;
                    }
                }
                if (element.nodeType === 3) {
                    textNode = element;
                    element = element.parentNode;
                }
                var node = typerDocument.getNode(element);
                if (is(node, NODE_OUTER_PARAGRAPH) && !is(node.containingElement, OUTER_PTAG) && textNode) {
                    node = any(node.childNodes, function (v) {
                        return rangeCovers(v.element, textNode);
                    }) || node;
                }
                while (is(node, NODE_INLINE) && !is(node.parentNode, NODE_EDITABLE | NODE_EDITABLE_INLINE)) {
                    node = node.parentNode;
                }
                if (is(node, NODE_WIDGET | NODE_EDITABLE)) {
                    element = node.widget.element;
                    textNode = null;
                } else if (!textNode && element.nodeType === 1) {
                    var iterator2 = new TyperDOMNodeIterator(node, 4);
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

            if (!is(range, Range)) {
                range = createRange.apply(null, variadic(arguments));
            }
            var focusElement = range.commonAncestorContainer;
            if (range.startContainer === range.endContainer && range.startOffset === range.endOffset - 1) {
                focusElement = is(focusElement.childNodes[range.startOffset], Element) || focusElement;
            }
            if (!containsOrEquals(topElement, focusElement)) {
                focusElement = topElement;
            }
            var focusNode = typerDocument.getNode(focusElement);
            if (is(focusNode, NODE_WIDGET)) {
                focusNode = typerDocument.getNode(focusNode.widget.element);
            }
            var startPoint = getBoundary(range.startContainer, range.startOffset);
            var endPoint = range.collapsed ? startPoint : getBoundary(range.endContainer, range.endOffset, true);

            return $.extend(new TyperSelection(), {
                isCaret: range.collapsed,
                caretPosition: range.collapsed && compareRangePosition(range, startPoint.node.element),
                focusNode: focusNode,
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
            userRange = getActiveRange() || userRange;
            if (userRange) {
                currentSelection = computeSelection(userRange);
                if (fireEvent !== false) {
                    var stateObject = {};
                    triggerEvent(EVENT_ALL, 'beforeStateChange', stateObject);
                    triggerEvent(EVENT_ALL, 'stateChange', stateObject);
                }
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
                var allowedAttributes = String(options.attributes || '').split(' ');
                var selection = computeSelection(range);
                if (is(selection.focusNode, NODE_EDITABLE) && !selection.focusNode.childNodes[0]) {
                    $(EMPTY_LINE).appendTo(selection.focusNode.element);
                    return;
                }
                if (is(selection.focusNode, NODE_EDITABLE_INLINE) && !selection.focusNode.childDOMNodes[0]) {
                    $(createTextNode(ZWSP)).appendTo(selection.focusNode.element);
                    return;
                }
                iterate(selection.createTreeWalker(-1), function (node) {
                    if (isParagraphOrInline(node)) {
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
                                if (!trim(v.nodeValue)) {
                                    if ((!v.previousSibling && !v.nextSibling) || tagName(v.previousSibling) === 'br') {
                                        v.nodeValue = ZWSP;
                                    } else if (!userRange || compareRangePosition(v, userRange, true)) {
                                        removeNode(v);
                                    }
                                } else if (v.nodeValue.charAt(0) === ZWSP) {
                                    v = v.splitText(1);
                                    removeNode(v.previousSibling);
                                } else if (v.nodeValue.slice(-1) === ZWSP) {
                                    v.splitText(v.length - 1);
                                    removeNode(v.nextSibling);
                                }
                                hasTextNodes = true;
                            }
                        });
                        if (!hasTextNodes) {
                            (node.element.appendChild || node.element.insertNode).call(node.element, createTextNode());
                        }
                    }
                    if (is(node.element, Node)) {
                        if (is(node, NODE_OUTER_PARAGRAPH | NODE_PARAGRAPH | NODE_INLINE)) {
                            $.each(attrs(node.element), function (i) {
                                if ($.inArray(i, allowedAttributes) < 0) {
                                    $(node.element).removeAttr(i);
                                }
                            });
                        }
                        if (!is(node, NODE_WIDGET) && (!userRange || !rangeIntersects(userRange, node.element))) {
                            node.element.normalize();
                            if (is(node, NODE_INLINE)) {
                                if (tagName(node.element.previousSibling) === tagName(node.element) && compareAttrs(node.element, node.element.previousSibling)) {
                                    $(node.element).contents().appendTo(node.element.previousSibling);
                                    removeNode(node.element);
                                } else if (VOID_TAGS.indexOf(tagName(node.element)) < 0 && node.element.childElementCount === 0 && !trim(node.element.textContent)) {
                                    removeNode(node.element);
                                }
                            } else if (is(node, NODE_EDITABLE) || (is(node, NODE_OUTER_PARAGRAPH) && is(node.element, OUTER_PTAG))) {
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
                            } else if (is(node, NODE_EDITABLE_INLINE)) {
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
                        $(v).bind('input', function (e) {
                            if (!suppressIETextInput) {
                                $self.trigger($.Event('input', e));
                            }
                        });
                        $(v).bind('textinput', function (e) {
                            if (!suppressIETextInput) {
                                $self.trigger($.Event('textInput', e));
                            }
                        });
                    }
                });
            });
        }

        function extractContents(range, callback) {
            var mode = (callback || range) === true ? 'extractContents' : isFunction(callback || range) ? 'deleteContents' : 'cloneContents';
            var cloneNode = mode.indexOf('de') < 0;
            var clearNode = mode.indexOf('cl') < 0;
            var fragment = document.createDocumentFragment();
            var startPoint, endPoint;

            if (currentSelection.dirty) {
                updateState(false);
            }
            callback = is(callback || range, Function);
            range = is(range, Range) || createRange(is(range, Node) || currentSelection);

            function getInsertionPoint(node) {
                return createRange(node, (compareRangePosition(range, node) < 0 ? COLLAPSE_START_OUTSIDE : COLLAPSE_END_OUTSIDE) | (node !== typerDocument.getNode(node).widget.element && node.nodeType === 1));
            }

            if (!range.collapsed) {
                var state = computeSelection(range);
                if (isFunction(callback)) {
                    startPoint = getInsertionPoint(state.startTextNode || state.startElement);
                    endPoint = state.isSingleEditable ? getInsertionPoint(state.endTextNode || state.endElement) : startPoint;
                }
                var stack = [[topElement, fragment]];
                iterate(state.createTreeWalker(-1, function (node) {
                    if (is(node.element, Node) && !containsOrEquals(stack[0][0], node.element)) {
                        stack.shift();
                    }
                    if (rangeCovers(range, node.element)) {
                        if (cloneNode) {
                            $(stack[0][1]).append(node.cloneDOMNodes(true));
                        }
                        if (clearNode) {
                            if (is(node, NODE_EDITABLE)) {
                                $(node.element).html(EMPTY_LINE);
                            } else if (is(node, NODE_EDITABLE_INLINE)) {
                                $(node.element).html(ZWSP_ENTITIY);
                            } else {
                                removeNode(node.element);
                            }
                        }
                        return 2;
                    }
                    var content = isParagraphOrInline(node) && createRange(node.element, range)[mode]();
                    if (cloneNode) {
                        if (is(node, NODE_WIDGET | NODE_OUTER_PARAGRAPH) || (is(node, NODE_EDITABLE | NODE_EDITABLE_INLINE) && node.element !== topElement) || (content && tagName(content.firstChild) !== tagName(node.element))) {
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
                    return isParagraphOrInline(node) ? 2 : 1;
                }));
            }
            if (isFunction(callback)) {
                callback(startPoint || createRange(range, true), endPoint || createRange(range, false));
            } else {
                normalize(range);
            }
            updateState(false);
            return fragment;
        }

        function normalizeRawContents(content) {
            if (typeof content !== 'string' || content.charAt(0) !== '<') {
                content = String(content).replace(/\u000d/g, '').replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>').replace(/<p>(<|$)/g, '<p>' + ZWSP_ENTITIY + '$1') || ZWSP_ENTITIY;
                return $.parseHTML('<p>' + content + '</p>');
            }
            return $.map($.parseHTML(content), function (v) {
                // make sure no dangling text exists in the inserting document
                return v.nodeType === 3 ? $(v).wrap('<p>').parent()[0] : v;
            });
        }

        function insertContents(content, range) {
            content = is(content, Node) || normalizeRawContents(content);
            if (range !== undefined && !is(range, Range)) {
                range = createRange.apply(null, variadic(arguments, 1));
            }

            extractContents(range, function (startPoint, endPoint) {
                var range = createRange(startPoint, endPoint);
                var state = computeSelection(range);

                // check if current insertion point is an empty editable element
                // normalize before inserting content
                if (is(state.startNode, NODE_EDITABLE) && state.startNode === state.endNode) {
                    normalize(range);
                    state = computeSelection(createRange(state.startNode.element, true));
                }

                var startNode = state.startNode;
                var endNode = state.endNode;
                var outerEndNode = is(endNode.parentNode, NODE_OUTER_PARAGRAPH) ? endNode.parentNode : endNode;
                var newPoint;

                var formattingNodes;
                if (is(startNode, NODE_PARAGRAPH)) {
                    formattingNodes = [state.startElement];
                } else if (is(startNode, NODE_INLINE)) {
                    var until = is(startNode.containingElement.parentNode, OUTER_PTAG) || startNode.containingElement || typerDocument.getNode(startNode.containingElement).widget.element;
                    formattingNodes = $(state.startElement).parentsUntil(until).andSelf().get().reverse();
                } else {
                    formattingNodes = [createElement('p')];
                }

                var document = createTyperDocument(content);
                var nodes = document.rootNode.childNodes.slice(0);
                var needGlue = !nodes[1] && (!nodes[0] || isParagraphOrInline(nodes[0])) && startNode !== endNode;
                var hasInsertedText;

                while (nodes[0]) {
                    var node = nodes.pop();
                    if (is(node, NODE_OUTER_PARAGRAPH) && tagName(endNode.containingElement) === 'li') {
                        array.push.apply(nodes, slice(node.childNodes));
                        continue;
                    }
                    var inlineNodes = is(node, NODE_INLINE) ? [node.element] : node.childDOMNodes.slice(0);
                    var splitOuter = is(node, NODE_WIDGET) || !isParagraphOrInline(endNode);
                    var splitInner = nodes[0] && !hasInsertedText && !is(endNode, NODE_EDITABLE_INLINE);

                    if (splitOuter || splitInner) {
                        var splitEnd = createRange((splitOuter ? outerEndNode : endNode).element, COLLAPSE_END_OUTSIDE);
                        var splitContent = createRange(endPoint, splitEnd).extractContents();
                        var splitFirstNode = splitContent.childNodes[0];

                        if (splitContent.textContent || (splitFirstNode && (!isParagraphOrInline(node) || inlineNodes[0]))) {
                            splitEnd.insertNode(splitContent);
                            endNode = computeSelection(splitEnd).focusNode;
                            outerEndNode = splitOuter ? endNode : outerEndNode;
                            endPoint = splitEnd;
                            newPoint = newPoint || createRange(endNode.element, COLLAPSE_START_INSIDE);
                        }
                        // insert the last paragraph of text being inserted to the newly created paragraph if any
                        if (isParagraphOrInline(node)) {
                            if (inlineNodes[0]) {
                                if (isParagraphOrInline(endNode)) {
                                    (createRange(splitFirstNode, COLLAPSE_START_INSIDE) || endPoint).insertNode(wrapNode(inlineNodes, formattingNodes.slice(0, -1)));
                                } else {
                                    splitEnd.insertNode(wrapNode(inlineNodes, formattingNodes));
                                }
                                newPoint = newPoint || createRange(inlineNodes[0], COLLAPSE_END_INSIDE);
                                hasInsertedText = true;
                            }
                            continue;
                        }
                    }
                    var lastNode = inlineNodes.slice(-1)[0];
                    if (is(node, NODE_WIDGET | NODE_OUTER_PARAGRAPH)) {
                        endPoint.insertNode(node.element);
                        newPoint = newPoint || createRange(node.element, COLLAPSE_END_OUTSIDE);
                    } else if (nodes[0]) {
                        endPoint.insertNode(wrapNode(inlineNodes, hasInsertedText ? formattingNodes : formattingNodes.slice(0, -1)));
                        newPoint = newPoint || createRange(lastNode, COLLAPSE_END_INSIDE);
                        hasInsertedText = true;
                    } else if (inlineNodes[0]) {
                        startPoint.insertNode(startNode ? createDocumentFragment(inlineNodes) : wrapNode(inlineNodes, formattingNodes));
                        startPoint = createRange(lastNode, COLLAPSE_END_OUTSIDE);
                        newPoint = newPoint || createRange(lastNode, COLLAPSE_END_INSIDE);
                    }
                }
                if (needGlue) {
                    newPoint = newPoint || startPoint.cloneRange();
                    startPoint.insertNode(createRange(endNode.element, true).extractContents());
                    removeNode(endNode.element);
                }
                normalize(createRange(startPoint, newPoint || endPoint));
                select(newPoint || endPoint);
            });
        }

        function extractText(content) {
            var document = createTyperDocument(content);
            var iterator = new TyperTreeWalker(document.rootNode, NODE_PARAGRAPH);
            var text = iterateToArray(iterator, function (v) {
                var iterator = new TyperDOMNodeIterator(v, 5, function (v) {
                    return v.nodeValue || tagName(v) === 'br' ? 1 : 3;
                });
                return iterateToArray(iterator, function (v) {
                    return v.nodeValue || '\n';
                }).join('');
            });
            return text.join('\n\n');
        }

        function handleKeyStroke(eventName) {
            if (triggerEvent(EVENT_HANDLER, eventName)) {
                return true;
            }
            if (eventName === 'backspace' || eventName === 'delete') {
                var preventDefault;
                if (currentSelection.isCaret) {
                    var direction = eventName === 'backspace' ? -1 : 1;
                    var nextTextNode = direction < 0 ? currentSelection.previousTextNode : currentSelection.nextTextNode;
                    var textEnd = direction < 0 ? currentSelection.textStart : currentSelection.textEnd;
                    if (!nextTextNode && textEnd) {
                        if (currentSelection.textStart && currentSelection.textEnd) {
                            removeNode(currentSelection.startElement);
                        }
                        select(direction < 0 ? currentSelection.previousNode.element : currentSelection.nextNode.element);
                        preventDefault = true;
                    } else if (!currentSelection.startTextNode) {
                        if (currentSelection.caretPosition === direction) {
                            select(nextTextNode, direction < 0 ? COLLAPSE_END_INSIDE : COLLAPSE_START_INSIDE);
                        } else {
                            select(currentSelection.startElement);
                            preventDefault = true;
                        }
                    } else if (textEnd) {
                        var currentListItem = currentSelection.getSelectedElements('li')[0];
                        var nextNode = direction < 0 ? currentSelection.previousNode : currentSelection.nextNode;
                        if (is(currentListItem, 'li:' + (direction < 0 ? 'first-child' : 'last-child')) && tagName(nextNode.containingElement) === 'li' && !containsOrEquals(currentListItem.parentNode, nextNode.containingElement)) {
                            var listItems = ($.uniqueSort || $.unique)([currentListItem.parentNode, nextNode.containingElement.parentNode]);
                            $(listItems[1]).appendTo(listItems[0]).children().unwrap();
                            select(currentSelection);
                        } else if (direction < 0) {
                            insertContents('', nextTextNode, -0, currentSelection.startTextNode, 0);
                        } else {
                            insertContents('', currentSelection.startTextNode, -0, nextTextNode, 0);
                        }
                        preventDefault = true;
                    }
                } else {
                    insertContents('');
                    preventDefault = true;
                }
                if (preventDefault) {
                    undoable.snapshot();
                    return true;
                }
            }
            return /ctrl(?![axcvr]$)|alt|enter/i.test(eventName);
        }

        function initUndoable() {
            var WEDGE_START = '<span id="Typer_RangeStart"></span>';
            var WEDGE_END = '<span id="Typer_RangeEnd"></span>';
            var S_WEDGE = '#Typer_RangeStart,#Typer_RangeEnd';
            var lastValue = trim(topElement.innerHTML);
            var snapshots = [lastValue];
            var currentIndex = 0;

            function checkActualChange(value) {
                value = trim(value.replace(WEDGE_START, '').replace(WEDGE_END, '').replace(/(?!>)\u200b(?!<\/)/g, ''));
                if (value !== lastValue) {
                    var $temp = $('<div>').html(value);
                    $(options.controlElements, $temp).remove();
                    $(String(options.controlClasses || '').replace(/\b(\S+)/g, '.$1').replace(/\s+\./g, ',.'), $temp).removeClass(options.controlClasses);
                    triggerEvent(EVENT_ALL, 'change', $temp.html());
                    lastValue = value;
                    return true;
                }
            }

            function takeSnapshot() {
                codeUpdate(function () {
                    var hasFocus = getActiveRange();
                    var extraNodeStart;
                    var extraNodeEnd;
                    if (currentSelection.dirty) {
                        updateState();
                    }
                    if (currentSelection.startTextNode) {
                        if (currentSelection.startOffset > 0) {
                            extraNodeStart = currentSelection.startTextNode.splitText(currentSelection.startOffset);
                        }
                        $(WEDGE_START).insertBefore(extraNodeStart || currentSelection.startTextNode);
                    } else if (currentSelection.startElement) {
                        $(WEDGE_START).insertBefore(currentSelection.startElement);
                    }
                    if (!currentSelection.isCaret) {
                        if (currentSelection.endTextNode) {
                            if (currentSelection.endOffset < currentSelection.endTextNode.length) {
                                extraNodeEnd = currentSelection.endTextNode.splitText(currentSelection.endOffset);
                            }
                            $(WEDGE_END).insertAfter(currentSelection.endTextNode);
                        } else if (currentSelection.endElement) {
                            $(WEDGE_END).insertAfter(currentSelection.endElement);
                        }
                    }
                    var newValue = topElement.innerHTML;
                    if (newValue !== snapshots[0]) {
                        var hasChange = checkActualChange(newValue);
                        snapshots.splice(0, currentIndex + !hasChange, newValue);
                        snapshots.splice(options.historyLevel);
                        currentIndex = 0;
                    }
                    $(S_WEDGE).remove();
                    if (extraNodeStart) {
                        currentSelection.startTextNode.nodeValue += extraNodeStart.nodeValue;
                        $(extraNodeStart).remove();
                    }
                    if (extraNodeEnd) {
                        currentSelection.endTextNode.nodeValue += extraNodeEnd.nodeValue;
                        $(extraNodeEnd).remove();
                    }
                    if (hasFocus) {
                        select(currentSelection);
                    }
                });
            }

            function applySnapshot(value) {
                $self.html(value);
                var $wedges = $(S_WEDGE);
                if ($wedges[0]) {
                    var range = createRange($wedges[0], !$wedges[1] && COLLAPSE_END_OUTSIDE, $wedges[1], true);
                    $wedges.remove();
                    select(range);
                    updateState();
                }
                checkActualChange(value);
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

            $self.mousedown(function (e) {
                e.stopPropagation();
                mousedown = true;
                var handlers = {
                    mousemove: function (e) {
                        if (!e.which && mousedown) {
                            handlers.mouseup();
                            return;
                        }
                        replaceTimeout(normalizeInputEvent, updateState);
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
                        if (handleKeyStroke(keyEventName)) {
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
                        undoable.snapshot(50);
                    }
                }
            });

            $self.bind('textInput', function () {
                e.stopPropagation();
                if (!hasKeyEvent) {
                    undoable.snapshot(50);
                }
            });

            $self.bind('compositionstart keypress textInput', function (e) {
                undoable.snapshot(false);
                if (!currentSelection.startTextNode || currentSelection.paragraphElements[1]) {
                    if (e.type !== 'compositionstart') {
                        e.preventDefault();
                    }
                    var inputText = e.originalEvent.data || String.fromCharCode(e.charCode) || '';
                    if (currentSelection.startTextNode || !triggerEvent(EVENT_CURRENT, 'textInput', inputText)) {
                        insertContents(inputText);
                        undoable.snapshot();
                    }
                }
            });

            $self.bind('dragstart', function (e) {
                e.stopPropagation();
                var handlers = {
                    drop: function (e) {
                        var content = extractContents(!e.ctrlKey);
                        var range = getRangeFromMouseEvent(e.originalEvent);
                        insertContents(content, range);
                        undoable.snapshot();
                        e.preventDefault();
                        $self.unbind(handlers);
                    }
                };
                $self.bind(handlers);
            });

            $self.bind('cut copy', function (e) {
                var clipboardData = e.originalEvent.clipboardData || window.clipboardData;
                var content = extractContents(e.type === 'cut');
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
                    insertContents(content);
                } else if ($.inArray('text/plain', clipboardData.types) >= 0) {
                    insertContents(clipboardData.getData('text/plain'));
                } else if (window.clipboardData) {
                    insertContents(clipboardData.getData('Text'));
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

            $self.bind('mouseup', function (e) {
                // disable resize handle on image element on IE and Firefox
                // also select the whole widget when clicking on uneditable elements
                var node = typerDocument.getNode(e.target);
                if (activeWidget !== node.widget) {
                    triggerWidgetFocusout();
                }
                if (is(node, NODE_WIDGET)) {
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

            $self.bind('focusin focusout', function (e) {
                setTimeout(function () {
                    if (!userFocus) {
                        if (e.type === 'focusout') {
                            triggerWidgetFocusout();
                        }
                        triggerEvent(EVENT_ALL, e.type);
                    }
                });
            });
        }

        initUndoable();
        normalizeInputEvent();

        $.each(Typer.widgets, function (i, v) {
            if ((options[i] === true || $.isPlainObject(options[i])) && (v.inline || topNodeType !== NODE_EDITABLE_INLINE)) {
                var inst = Object.create(v);
                inst.options = Object.create(inst.options || null);
                $.extend(inst.options, options[i]);
                widgetOptions.push(inst);
            }
        });
        widgetOptions.push({
            // make all other tags that are not considered paragraphs and inlines to be widgets
            // to avoid unknown behavior while editing
            element: ':not(' + INNER_PTAG + ',br,a,b,em,i,u,small,strong,sub,sup,ins,del,mark,span)'
        }, {
                ctrlZ: undoable.undo,
                ctrlY: undoable.redo,
                ctrlShiftZ: undoable.redo
            });
        $.each(widgetOptions, function (i, v) {
            if (!v.element) {
                widgets.push(new TyperWidget(typer, i, null, v.options));
            }
        });

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

        $.extend(this, {
            element: topElement,
            canUndo: undoable.canUndo,
            canRedo: undoable.canRedo,
            undo: undoable.undo,
            redo: undoable.redo,
            hasCommand: function (command) {
                return !!findWidgetWithCommand(command);
            },
            getSelection: function () {
                return new TyperSelection(currentSelection);
            },
            select: function (startNode, startOffset, endNode, endOffset) {
                select(startNode, startOffset, endNode, endOffset);
                undoable.snapshot();
            },
            moveCaret: function (node, offset) {
                moveCaret(node, offset);
                undoable.snapshot();
            },
            retainFocus: function (element) {
                $(element).bind(retainFocusHandlers);
            },
            invoke: function (command) {
                var self = this;
                var args = [new TyperTransaction()].concat(variadic(arguments, 1));
                codeUpdate(function () {
                    if (typeof command === 'string') {
                        args[0].commandName = command;
                        args[0].widget = findWidgetWithCommand(command);
                        command = args[0].widget && widgetOptions[args[0].widget.id].commands[command];
                    }
                    if (isFunction(command)) {
                        command.apply(self, args);
                    }
                });
                updateState();
                undoable.snapshot();
            }
        });

        TyperTransaction.prototype = {
            widget: null,
            remove: removeNode,
            normalize: normalize,
            invoke: typer.invoke,
            hasCommand: typer.hasCommand,
            insertText: function (text) {
                insertContents(String(text || ''));
            },
            insertHtml: function (content) {
                insertContents(content);
            },
            execCommand: function (commandName, value) {
                document.execCommand(commandName, false, value || '');
                updateState(false);
            },
            getSelectedText: function () {
                var content = extractContents();
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
                moveCaret(node, offset);
                updateState(false);
            },
            restoreSelection: function () {
                select(this.originalSelection);
                updateState(false);
            }
        };

        defineLazyProperties(TyperTransaction.prototype, {
            selection: function () {
                return new TyperSelection(currentSelection);
            }
        });

        $self.attr('contenteditable', 'true');
        typerDocument = this.document = createTyperDocument(topElement);
        triggerEvent(EVENT_STATIC, 'init');
        currentSelection = computeSelection(topElement, COLLAPSE_START_INSIDE);
        normalize();
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
        NODE_EDITABLE_INLINE: NODE_EDITABLE_INLINE,
        NODE_INLINE: NODE_INLINE,
        NODE_OUTER_PARAGRAPH: NODE_OUTER_PARAGRAPH,
        NODE_SHOW_EDITABLE: NODE_SHOW_EDITABLE,
        ZWSP: ZWSP,
        ZWSP_ENTITIY: ZWSP_ENTITIY,
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
        getRangeFromMouseEvent: getRangeFromMouseEvent,
        widgets: {}
    });

    TyperNode.prototype = {
        get containingElement() {
            return this.element.commonAncestorContainer || this.element;
        },
        get childDOMNodes() {
            return is(this.element, Range) ? slice(this.element.commonAncestorContainer.childNodes, this.element.startOffset, this.element.endOffset) : slice(this.element.childNodes);
        },
        get firstChild() {
            return this.childNodes[0] || null;
        },
        get lastChild() {
            return this.childNodes.slice(-1)[0] || null;
        },
        selectedInRange: function (range) {
            return rangeCovers(range, this.element) ||
                !!any(this.childNodes, function (v) {
                    return rangeCovers(range, v.element);
                }) ||
                !!any(this.childDOMNodes, function (v) {
                    return v.nodeType === 3 && rangeIntersects(range, v);
                });
        },
        createRange: function (collapse) {
            if (+collapse === collapse) {
                return createRange(this.element, is(this.element, Range) ? !!(collapse & 4) : collapse);
            }
            return is(this.element, Range) ? this.element.cloneRange() : createRange(this.element, !!collapse);
        },
        createDOMNodeIterator: function (whatToShow, filter) {
            return new TyperDOMNodeIterator(this, whatToShow, filter);
        },
        cloneDOMNodes: function (deep) {
            if (is(this.element, Range)) {
                return createDocumentFragment($.map(this.childDOMNodes, function (v) {
                    return v.cloneNode(deep);
                }));
            }
            return this.element.cloneNode(deep);
        }
    };

    function treeWalkerIsNodeVisible(inst, node) {
        return node && ((inst.whatToShow & NODE_SHOW_EDITABLE) || !is(node, NODE_WIDGET | NODE_EDITABLE | NODE_EDITABLE_INLINE));
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
                if (treeWalkerAcceptNode.returnValue === 2 || !sibling[pChild]) {
                    sibling = sibling[pSib];
                } else {
                    sibling = sibling[pChild];
                }
            }
            node = treeWalkerIsNodeVisible(inst, node.parentNode) && node.parentNode;
            if (!node || node === inst.root || treeWalkerAcceptNode(inst, node, true) === 1) {
                return null;
            }
        }
    }

    TyperTreeWalker.prototype = {
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
    };

    function nodeIteratorCreateNodeIterator(inst, dir) {
        var node = inst.typerNodeIterator.currentNode;
        if (!isParagraphOrInline(node)) {
            return document.createNodeIterator(is(node.element, Node) || node.containingElement, 0);
        }
        var range = is(node.element, Range);
        var iterator = document.createTreeWalker(range ? node.containingElement : node.element, inst.whatToShow | 1, function (v) {
            return v.nodeType === 1 || (range && !rangeIntersects(range, v)) ? 2 : acceptNode(inst, v) | 1;
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
            if (inst.currentNode[dir === 'nextNode' ? 'previousSibling' : 'nextSibling'] !== before) {
                if (inst.typerNodeIterator[dir]()) {
                    inst.iteratorStack.unshift({
                        dir: dir,
                        iterator: inst.iterator
                    });
                    inst.iterator = nodeIteratorCreateNodeIterator(inst, dir);
                    if (acceptNode(inst.iterator) === 1 || inst.iterator[dir]()) {
                        return inst.currentNode;
                    }
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

    TyperDOMNodeIterator.prototype = {
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
    };

    defineLazyProperties(TyperDOMNodeIterator.prototype, {
        iterator: function () {
            var t = this.typerNodeIterator;
            if (!isParagraphOrInline(t.currentNode)) {
                t.nextNode();
            }
            this.iteratorStack = [];
            return nodeIteratorCreateNodeIterator(this);
        }
    });

    function typerSelectionDeepIterator(inst, whatToShow, filter) {
        var range = createRange(inst);
        return new TyperTreeWalker(inst.focusNode, whatToShow | NODE_SHOW_EDITABLE, function (v) {
            return !rangeIntersects(v.element, range) ? 2 : !v.selectedInRange(range) ? 3 : !filter ? 1 : filter(v);
        });
    }

    function typerSelectionSiblingIterator(node, whatToShow, startDOMNode) {
        for (var root = node; root && !is(root, NODE_EDITABLE | NODE_EDITABLE_INLINE); root = root.parentNode);
        var iterator = new TyperTreeWalker(root, whatToShow);
        iterator.currentNode = node;
        if (startDOMNode) {
            iterator = new TyperDOMNodeIterator(iterator, 4);
            iterator.currentNode = startDOMNode;
        }
        return iterator;
    }

    function typerSelectionGetParents(inst) {
        var nodes = [];
        for (var node = inst.focusNode; node; node = node.parentNode) {
            if (is(node, NODE_EDITABLE | NODE_EDITABLE_INLINE)) {
                nodes.unshift(node);
            }
        }
        return nodes;
    }

    TyperSelection.prototype = {
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
            return new TyperDOMNodeIterator(typerSelectionDeepIterator(this, NODE_PARAGRAPH | NODE_INLINE | NODE_WIDGET), whatToShow, filter);
        }
    };

    defineLazyProperties(TyperSelection.prototype, {
        widgets: function () {
            return $.map(typerSelectionGetParents(this), function (v) {
                return v.widget;
            });
        },
        editableElements: function () {
            return $.map(typerSelectionGetParents(this).concat(iterateToArray(typerSelectionDeepIterator(this, NODE_EDITABLE | NODE_EDITABLE_INLINE))), function (v) {
                return v.containingElement;
            });
        },
        paragraphElements: function () {
            var iterator = new TyperTreeWalker(this.focusNode, NODE_PARAGRAPH | NODE_SHOW_EDITABLE);
            var nodes = iterateToArray(iterator, null, this.startNode);
            nodes.splice(nodes.indexOf(this.endNode) + 1);
            return $.map(nodes, function (v) {
                return v.containingElement;
            });
        },
        selectedElements: function () {
            return iterateToArray(typerSelectionDeepIterator(this, NODE_PARAGRAPH | NODE_INLINE), function (v) {
                return v.containingElement;
            });
        },
        previousNode: function () {
            return typerSelectionSiblingIterator(this.startNode, NODE_PARAGRAPH | NODE_WIDGET).previousNode() || null;
        },
        nextNode: function () {
            return typerSelectionSiblingIterator(this.endNode, NODE_PARAGRAPH | NODE_WIDGET).nextNode() || null;
        },
        previousTextNode: function () {
            return typerSelectionSiblingIterator(this.startNode, NODE_PARAGRAPH, this.startTextNode || this.startElement).previousNode() || null;
        },
        nextTextNode: function () {
            return typerSelectionSiblingIterator(this.endNode, NODE_PARAGRAPH, this.endTextNode || this.endElement).nextNode() || null;
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
            return !iterateToArray(typerSelectionDeepIterator(this, NODE_EDITABLE | NODE_EDITABLE_INLINE))[1];
        }
    });

    TyperWidget.prototype = {
        remove: function () {
            var self = this;
            self.typer.invoke(function (tx) {
                tx.select(self.element);
                tx.insertText();
            });
        }
    };

    $.fn.typer = function (options) {
        return this.each(function (i, v) {
            new Typer($.extend({}, options, {
                element: v
            }));
        });
    };

    // disable Mozilla and IE object resizing and inline table editing controls
    if (!IS_IE) {
        try {
            document.designMode = 'on';
            document.execCommand('enableObjectResizing', false, false);
            document.execCommand('enableInlineTableEditing', false, false);
        } catch (e) { }
        document.designMode = 'off';
    }
    $(document.body).bind('mscontrolselect', function (e) {
        e.preventDefault();
    });

    // polyfill for Map
    // simple and good enough as we only need to associate data to a DOM object
    if (typeof Map === 'undefined') {
        Map = function () {
            Object.defineProperty(this, '__dataKey__', {
                value: 'typer' + Math.random().toString(36).substr(2, 8)
            });
        };
        Map.prototype = {
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
        };
    }

} (jQuery, window, document, String, Node, Range, DocumentFragment, window.Map, []));

(function ($, Typer) {
    'use strict';

    var INNER_PTAG = 'h1,h2,h3,h4,h5,h6,p,ul,ol,li,q,blockquote,pre,code';
    var OUTER_PTAG = 'ul,ol';

    var aligns = {
        justifyLeft: 'left',
        justifyRight: 'right',
        justifyCenter: 'center',
        justifyFull: 'justify'
    };

    var inlineStyleTagNames = {
        bold: 'b',
        italic: 'i',
        underline: 'u',
        superscript: 'sup',
        subscript: 'sub'
    };

    var createElement = Typer.createElement;

    function justifyCommand(tx) {
        $(tx.selection.paragraphElements).attr('align', aligns[tx.commandName]);
    }

    function inlineStyleCommand(tx) {
        if (tx.selection.isCaret) {
            tx.insertHtml(createElement(inlineStyleTagNames[tx.commandName]));
        } else {
            // IE will nest <sub> and <sup> elements on the subscript and superscript command
            // clear the subscript or superscript format before applying the opposite command
            if (tx.selection.subscript && tx.commandName === 'superscript') {
                tx.execCommand('subscript');
            } else if (tx.selection.superscript && tx.commandName === 'subscript') {
                tx.execCommand('superscript');
            }
            tx.execCommand(tx.commandName);
        }
    }

    function insertListCommand(tx, tagName, className) {
        tagName = tagName || (tx.commandName === 'insertOrderedList' ? 'ol' : 'ul');
        $.each(tx.selection.paragraphElements, function (i, v) {
            var selector = tagName + (className || '').replace(/^(.)/, '.$1');
            if (v.tagName.toLowerCase() !== 'li') {
                var list = $(v).prev(selector)[0] || $(v).next(selector)[0] || $(createElement(tagName, className)).insertAfter(v)[0];
                $(v).wrap('<li>').contents().unwrap().parent()[Typer.comparePosition(v, list) < 0 ? 'prependTo' : 'appendTo'](list);
            } else if (!$(v.parentNode).is(selector)) {
                $(v.parentNode).wrap(createElement(tagName, className)).contents().unwrap();
            }
        });
        tx.restoreSelection();
    }

    function addCommandWidget(name, commands, hotkeys) {
        Typer.widgets[name] = {
            commands: commands
        };
        (hotkeys || '').replace(/(\w+):(\w+)/g, function (v, a, b) {
            Typer.widgets[name][a] = function (e) {
                e.typer.invoke(b);
            };
        });
    }

    addCommandWidget('inlineStyle', {
        bold: inlineStyleCommand,
        italic: inlineStyleCommand,
        underline: inlineStyleCommand,
        superscript: inlineStyleCommand,
        subscript: inlineStyleCommand,
        applyClass: function (tx, className) {
            var paragraphs = tx.selection.paragraphElements;
            $(tx.getSelectedTextNodes()).wrap(createElement('span', className));
            $('span:has(span)', paragraphs).each(function (i, v) {
                $(v).contents().unwrap().filter(function (i, v) {
                    return v.nodeType === 3;
                }).wrap(createElement('span', v.className));
            });
            $('span[class=""]', paragraphs).contents().unwrap();
            tx.restoreSelection();
        }
    }, 'ctrlB:bold ctrlI:italic ctrlU:underline');

    addCommandWidget('formatting', {
        justifyCenter: justifyCommand,
        justifyFull: justifyCommand,
        justifyLeft: justifyCommand,
        justifyRight: justifyCommand,
        formatting: function (tx, value) {
            var m = /^([^.]*)(?:\.(.+))?/.exec(value) || [];
            if (m[1] === 'ol' || m[1] === 'ul') {
                insertListCommand(tx, m[1], m[2]);
            } else {
                $(tx.selection.paragraphElements).not('li').wrap(createElement(m[1] || 'p', m[2])).contents().unwrap();
            }
            tx.restoreSelection();
        },
        insertLine: function (tx) {
            tx.insertText('\n\n');
        }
    }, 'enter:insertLine ctrlShiftL:justifyLeft ctrlShiftE:justifyCenter ctrlShiftR:justifyRight');

    addCommandWidget('lineBreak', {
        insertLineBreak: function (tx) {
            tx.insertHtml('<br>' + (tx.selection.textEnd ? Typer.ZWSP_ENTITIY : ''));
        }
    }, 'shiftEnter:insertLineBreak');

    addCommandWidget('list', {
        insertOrderedList: insertListCommand,
        insertUnorderedList: insertListCommand,
        indent: function (tx) {
            $.each(tx.selection.paragraphElements, function (i, v) {
                var list = $(v.parentNode).filter(OUTER_PTAG)[0];
                var prevItem = $(v).prev('li')[0] || $('<li>').insertBefore(v)[0];
                var newList = $(prevItem).children(OUTER_PTAG)[0] || $(list.cloneNode(false)).appendTo(prevItem)[0];
                $('<li>').append(v.childNodes).appendTo(newList);
                tx.remove(v);
            });
        },
        outdent: function (tx) {
            $.each(tx.selection.paragraphElements, function (i, v) {
                var list = $(v.parentNode).filter(OUTER_PTAG)[0];
                var parentList = $(list).parent('li')[0];
                if ($(v).next('li')[0]) {
                    if (parentList) {
                        $(list.cloneNode(false)).append($(v).nextAll()).appendTo(v);
                    } else {
                        $(list.cloneNode(false)).append($(v).nextAll()).insertAfter(list);
                        $(v).children(OUTER_PTAG).insertAfter(list);
                    }
                }
                $(createElement(parentList ? 'li' : 'p')).append(v.childNodes).insertAfter(parentList || list);
                tx.remove(v);
            });
        },
    });

    addCommandWidget('link', {
        createLink: function (tx, value) {
            value = value || (/^[a-z]+:\/\//g.test(tx.getSelectedText()) && RegExp.input) || '#';
            tx.select(tx.selection.getSelectedElements('a')[0] || tx.selection);
            tx.execCommand('createLink', value);
        },
        unlink: function (tx) {
            var linkElement = tx.selection.getSelectedElements('a')[0];
            if (linkElement) {
                tx.select(linkElement);
                tx.execCommand('unlink');
            }
        }
    });
    
    $.each('inlineStyle lineBreak link'.split(' '), function (i, v) {
        Typer.widgets[v].inline = true;
    });

} (jQuery, window.Typer));

(function ($, Typer) {
    'use strict';

    var definedControls = {};
    var activeToolbar;
    var toolbarTimeout;

    function define(base, params, init) {
        if (typeof params === 'function') {
            init = params;
            params = undefined;
        }
        init = init || function (options) {
            $.extend(this, options);
        };
        var privateInit = {};
        var _super = typeof base !== 'function' ? null : function () {
            base.apply(this, arguments);
        };
        var fn = function (options) {
            if (!(this instanceof fn)) {
                var inst = new fn(privateInit);
                fn.apply(inst, arguments);
                return inst;
            }
            if (options !== privateInit) {
                try {
                    this._super = _super;
                    init.apply(this, arguments);
                } finally {
                    this._super = null;
                }
            }
        };
        fn.prototype = _super ? new base(params) : base;
        return fn;
    }

    function parseCompactSyntax(str) {
        var m = /^([\w:]*)(?:\(([^}]+)\))?$/.exec(str);
        var params = null;
        try {
            params = m[2] && JSON.parse(('{' + m[2] + '}').replace(/([{:,])\s*([^\s:,}]+)/g, '$1"$2"'));
        } catch (e) { }
        return {
            name: m[1],
            params: params
        };
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

    function nativePrompt(message, value) {
        value = window.prompt(message, value);
        if (value !== null) {
            return $.when(value);
        }
        return $.Deferred().reject().promise();
    }

    function resolveControls(toolbar, control) {
        control = control || toolbar;
        if (control.controls) {
            var tokens = control.controls.split(/\s+/);
            var controlsProto = {};
            $.each(tokens, function (i, v) {
                if (v.slice(-1) === '*') {
                    $.each(definedControls, function (i, w) {
                        if (i.slice(0, v.length - 1) === v.slice(0, -1) && tokens.indexOf('-' + i) < 0 && !controlsProto[i]) {
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
            var controls = [];
            $.each(controlsProto, function (i, v) {
                v.name = v.name || i;
                v.label = v.label || Typer.toolbar.labels[v.name] || v.name;
                controls.push(v);
            });
            control.controls = controls;
        } else if (typeof control.createChildren === 'function') {
            control.controls = control.createChildren(toolbar, control) || [];
        }
        $.each(control.controls || [], function (i, v) {
            v.parent = control;
            resolveControls(toolbar, v);
        });
        return control.controls;
    }

    function renderControl(toolbar, control, params) {
        control = control || toolbar;
        control.bindData = [];

        function bindPlaceholder(element) {
            $(element).find('*').andSelf().filter('[x\\:bind]').each(function (i, v) {
                var t = parseCompactSyntax($(v).attr('x:bind'));
                control.bindData.push([v, t.params]);
            }).removeAttr('x:bind');
        }

        function replacePlaceholder(t) {
            var element = $(toolbar.renderer[t] || '<div><br x:t="children"></div>')[0];
            bindPlaceholder(element);
            $('[x\\:t]', element).each(function (i, v) {
                var t = parseCompactSyntax($(v).attr('x:t'));
                var element;
                if (typeof toolbar.renderer[t.name] === 'function') {
                    element = $(toolbar.renderer[t.name](toolbar, control, t.params));
                    bindPlaceholder(element);
                } else {
                    element = replacePlaceholder(t.name);
                }
                $(v).replaceWith(element);
            });
            return element;
        }

        control.element = replacePlaceholder(control.type);
        $(control.element).bind(toolbar.renderer[control.type + 'ExecuteOn'], function () {
            toolbar.execute(control);
        });
        if (toolbar.renderer[control.type + 'Init']) {
            toolbar.renderer[control.type + 'Init'](toolbar, control);
        }
        return control.element;
    }

    function renderChildControls(toolbar, control, params) {
        return $.map(control.controls, function (v) {
            return renderControl(toolbar, v, params);
        });
    }

    function updateControl(toolbar, control) {
        $.each((control || toolbar).controls || [], function (i, v) {
            updateControl(toolbar, v);
        });
        if (control) {
            if (control.stateChange) {
                control.stateChange(toolbar, control);
                if (toolbar.renderer[control.type + 'StateChange']) {
                    toolbar.renderer[control.type + 'StateChange'](toolbar, control);
                }
            }
            var disabled = toolbar.enabled(control) === false;
            var visible = !control.hiddenWhenDisabled || !disabled;
            if (typeof control.dependsOn === 'string') {
                visible &= toolbar.typer.hasCommand(control.dependsOn);
            } else if (control.dependsOn) {
                visible &= !$.grep(control.dependsOn, function (v) {
                    return !toolbar.typer.hasCommand(v);
                })[0];
            }
            if (visible) {
                $.each(control.bindData, function (i, v) {
                    $.each(v[1], function (i, w) {
                        if (i === '_') {
                            $(v[0]).text(control[w] || '');
                        } else {
                            $(v[0]).attr(i, control[w] || '');
                        }
                    });
                });
            }

            var $elm = $(control.element);
            $elm.prop('disabled', disabled);
            if (toolbar.options.controlDisabledClass) {
                $elm.toggleClass(toolbar.options.controlDisabledClass, disabled);
            }
            if (toolbar.options.controlActiveClass) {
                $elm.toggleClass(toolbar.options.controlActiveClass, !!toolbar.active(control));
            }
            if (toolbar.options.controlHiddenClass) {
                $elm.toggleClass(toolbar.options.controlHiddenClass, !visible);
            } else if (!visible) {
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
    }

    function initToolbar(toolbar, container) {
        resolveControls(toolbar);
        toolbar.element = renderControl(toolbar);

        var $elm = $(toolbar.element).addClass('typer-ui typer-ui-toolbar');
        if (container) {
            $elm.appendTo(container);
        } else {
            $elm.addClass('typer-ui-toolbar-floating').css('z-index', 1000);
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
                setTimeout(function () {
                    clearTimeout(toolbar.toolbarTimeout);
                });
            });
        }
        $.each('enabled active execute'.split(' '), function (i, v) {
            toolbar[v] = function (control) {
                if (typeof control[v] === 'function' && (v !== 'execute' || toolbar.enabled(v) !== false)) {
                    var args = Array.prototype.slice.apply(arguments);
                    args.unshift(toolbar);
                    return control[v].apply(control, args);
                }
            };
        });
        toolbar.typer.retainFocus(toolbar.element);
    }

    function showToolbar(toolbar, position) {
        if (toolbar.widget || !toolbar.options.container) {
            clearTimeout(toolbarTimeout);
            if (activeToolbar !== toolbar) {
                hideToolbar(true);
                activeToolbar = toolbar;
                $(toolbar.element).appendTo(document.body);
            }
            if (position) {
                toolbar.position = 'fixed';
                $(toolbar.element).css(position);
            } else if (toolbar.position !== 'fixed') {
                var rect = Typer.createRange(toolbar.typer.element).getBoundingClientRect();
                var height = $(toolbar.element).height();

                if (rect.top + rect.height > document.body.offsetHeight) {
                    toolbar.position = '';
                } else if (rect.top < height) {
                    toolbar.position = 'bottom';
                }
                $(toolbar.element).css({
                    left: rect.left + $(window).scrollLeft(),
                    top: (toolbar.position === 'bottom' ? (rect.top + rect.height) + 10 : rect.top - height - 10) + $(window).scrollTop()
                });
            }
        }
    }

    function hideToolbar(force) {
        clearTimeout(toolbarTimeout);
        if (force) {
            if (activeToolbar) {
                $(activeToolbar.element).detach();
                activeToolbar.position = '';
                activeToolbar = null;
            }
        } else {
            toolbarTimeout = setTimeout(function () {
                hideToolbar(true);
            }, 100);
        }
    }

    Typer.widgets.toolbar = {
        inline: true,
        options: {
            container: '',
            controlActiveClass: 'active',
            controlDisabledClass: 'disabled',
            controlHiddenClass: '',
            controls: '',
            renderer: null,
            formattings: {
                h1: 'Heading 1',
                h2: 'Heading 2',
                h3: 'Heading 3',
                h4: 'Heading 4',
                p: 'Paragraph',
                ul: 'Unordered List',
                ol: 'Ordered List'
            },
            inlineClasses: {},
            prompt: nativePrompt,
            selectLink: function () {
                return this.prompt('Enter URL');
            },
            selectImage: function () {
                return this.prompt('Enter Image URL');
            }
        },
        init: function (e) {
            var toolbar = e.widget;
            toolbar.state = {};
            toolbar.controls = toolbar.options.controls || '__root__';
            toolbar.renderer = toolbarRenderer[toolbar.options.renderer] || toolbarRenderer.default;
            initToolbar(toolbar, toolbar.options.container);
        },
        widgetInit: function (e, widget) {
            widget.toolbar = {
                typer: e.typer,
                widget: widget,
                controls: 'g:widget',
                renderer: e.widget.renderer,
                options: e.widget.options
            };
            initToolbar(widget.toolbar);
        },
        focusin: function (e) {
            showToolbar(e.widget);
        },
        focusout: function (e) {
            setTimeout(hideToolbar);
        },
        widgetFocusin: function (e, widget) {
            showToolbar(widget.toolbar);
        },
        widgetFocusout: function (e, widget) {
            showToolbar(e.widget);
        },
        beforeStateChange: function (e) {
            var selection = e.typer.getSelection();
            // traverse the selected region to compute the actual style
            // style with mixed values across selected region is marked with empty string ("")
            var style = {
                fontWeight: null,
                fontStyle: null,
                textDecoration: null,
                textAlign: null,
                inlineClass: null
            };
            $(selection.selectedElements).each(function (i, element) {
                $.each(style, function (i, v) {
                    var my;
                    if (i === 'textAlign') {
                        my = getTextAlign(element);
                    } else if (i === 'inlineClass') {
                        my = $(element).filter('span').attr('class') || '';
                    } else {
                        my = $(element).css(i);
                    }
                    style[i] = (v === '' || (v && v !== my)) ? '' : my;
                });
            });

            var element = selection.paragraphElements.slice(-1)[0];
            if ($(element).is('li')) {
                element = $(element).closest('ol, ul')[0] || element;
            }
            var tagName = element && element.tagName.toLowerCase();
            var tagNameWithClasses = tagName + ($(element).attr('class') || '').replace(/^(.)/, '.$1');
            e.widget.state = {
                linkElement: selection.getSelectedElements('a')[0] || null,
                bold: style.fontWeight === 'bold' || style.fontWeight === '700',
                italic: style.fontStyle === 'italic',
                underline: style.textDecoration === 'underline',
                superscript: selection.getSelectedElements('sup').length > 0,
                subscript: selection.getSelectedElements('sub').length > 0,
                insertUnorderedList: tagName === 'ul',
                insertOrderedList: tagName === 'ol',
                justifyLeft: style.textAlign === 'left',
                justifyCenter: style.textAlign === 'center',
                justifyRight: style.textAlign === 'right',
                inlineClass: style.inlineClass,
                formatting: tagName,
                formattingWithClassName: tagNameWithClasses
            };
        },
        stateChange: function (e) {
            if (activeToolbar) {
                updateControl(activeToolbar);
                showToolbar(activeToolbar);
            }
        }
    };

    /* ********************************
     * Controls Classes
     * ********************************/

    var toolbarButton = define({
        type: 'button'
    });

    var toolbarDropdown = define({
        type: 'dropdown',
        stateChange: function (toolbar, self) {
            $.each(self.controls, function (i, v) {
                if (toolbar.active(v)) {
                    $('select', self.element).prop('selectedIndex', i);
                    self.selectedIndex = i;
                    self.selectedValue = v.label || v.name;
                    return false;
                }
            });
        },
        execute: function (toolbar, self) {
            toolbar.execute(self.selectedIndex);
        },
        enabled: function (toolbar, self) {
            return self.controls.length > 0;
        }
    });

    var toolbarGroup = define({
        type: 'group',
        hiddenWhenDisabled: true
    }, function (controls, params) {
        this.controls = controls;
        $.extend(this, params);
    });

    var toolbarTextbox = define({
        type: 'textbox'
    });

    var formattingButton = define(toolbarButton, function (command) {
        this._super({
            dependsOn: command,
            execute: function (toolbar) {
                toolbar.typer.invoke(command);
            },
            active: function (toolbar) {
                return toolbar.state[command];
            },
            enabled: function (toolbar) {
                return !!toolbar.state.formatting && ((command !== 'indent' && command !== 'outdent') || toolbar.state.insertOrderedList || toolbar.state.insertUnorderedList);
            }
        });
    });

    var insertElementButton = define(toolbarButton, function (name, tagName, defaultAttr, callback) {
        this._super({
            execute: function (toolbar) {
                $.when((callback || defaultAttr)(toolbar)).done(function (attrs) {
                    toolbar.typer.invoke(function (tx) {
                        if (typeof attrs !== 'object') {
                            var value = attrs;
                            attrs = {};
                            attrs[defaultAttr] = value;
                        }
                        tx.insertHtml($('<' + tagName + '>', attrs)[0]);
                    });
                });
            }
        });
    });

    /* ********************************
     * Built-in Controls
     * ********************************/

    $.extend(definedControls, {
        // Basic controls groups
        '__root__': toolbarGroup('g:* -g:widget'),
        'g:history': toolbarGroup('history:*'),
        'g:insert': toolbarGroup('insert:*', {
            enabled: function (toolbar) {
                return toolbar.typer.document.rootNode.nodeType !== Typer.NODE_EDITABLE_INLINE;
            }
        }),
        'g:formatting': toolbarGroup('formatting:paragraph formatting:inlineStyle formatting:*', {
            enabled: function (toolbar) {
                return !!toolbar.state.formatting;
            }
        }),

        // Basic text style and formatting controls
        'formatting:bold': formattingButton('bold'),
        'formatting:italic': formattingButton('italic'),
        'formatting:underline': formattingButton('underline'),
        'formatting:unorderedList': formattingButton('insertUnorderedList'),
        'formatting:orderedList': formattingButton('insertOrderedList'),
        'formatting:indent': formattingButton('indent'),
        'formatting:outdent': formattingButton('outdent'),
        'formatting:justifyLeft': formattingButton('justifyLeft'),
        'formatting:justifyCenter': formattingButton('justifyCenter'),
        'formatting:justifyRight': formattingButton('justifyRight'),

        // Text style and formatting drop-down menus
        'formatting:paragraph': toolbarDropdown({
            dependsOn: 'formatting',
            hiddenWhenDisabled: true,
            createChildren: function (toolbar) {
                return $.map(Object.keys(toolbar.options.formattings || {}), function (v) {
                    return toolbarButton({
                        name: v,
                        label: toolbar.options.formattings[v],
                        execute: function () {
                            toolbar.typer.invoke('formatting', v);
                        },
                        active: function () {
                            return toolbar.state.formattingWithClassName === v || toolbar.state.formatting === v;
                        }
                    });
                });
            }
        }),
        'formatting:inlineStyle': toolbarDropdown({
            dependsOn: 'applyClass',
            hiddenWhenDisabled: true,
            createChildren: function (toolbar) {
                return $.map(Object.keys(toolbar.options.inlineClass || {}), function (v) {
                    return toolbarButton({
                        name: v,
                        label: toolbar.options.inlineClass[v],
                        execute: function () {
                            toolbar.typer.invoke('applyClass', v);
                        },
                        active: function () {
                            return toolbar.state.inlineClass === v;
                        }
                    });
                });
            }
        }),

        // Basic element insertion controls
        'insert:anchor': insertElementButton('insertAnchor', 'a', 'name', function (toolbar) {
            return $.when(toolbar.options.prompt('Enter Anchor Name'));
        }),
        'insert:image': insertElementButton('insertImage', 'img', 'src', function (toolbar) {
            return $.when(toolbar.options.selectImage());
        }),
        'insert:link': toolbarButton({
            dependsOn: 'createLink',
            execute: function (toolbar) {
                $.when(toolbar.options.selectLink({
                    href: $(toolbar.state.linkElement).attr('href'),
                    target: $(toolbar.state.linkElement).attr('target')
                })).done(function (value) {
                    toolbar.typer.invoke('createLink', value);
                });
            },
            active: function (toolbar) {
                return !!toolbar.state.linkElement;
            }
        }),

        // History controls
        'history:undo': toolbarButton({
            execute: function (toolbar) {
                toolbar.typer.undo();
            },
            enabled: function (toolbar) {
                return toolbar.typer.canUndo();
            }
        }),
        'history:redo': toolbarButton({
            execute: function (toolbar) {
                toolbar.typer.redo();
            },
            enabled: function (toolbar) {
                return toolbar.typer.canRedo();
            }
        }),

        // Widget controls
        'g:widget': toolbarGroup('', {
            createChildren: function (toolbar, self) {
                if (toolbar.widget) {
                    var controls = [];
                    if ($(toolbar.widget.element).is('img')) {
                        controls.push('media:filePicker(icon:insertImage) media:*');
                    }
                    controls.push('widget:*');
                    self.controls = controls.join(' ');
                    return resolveControls(toolbar, self);
                }
            },
            enabled: function (toolbar) {
                return !!toolbar.widget;
            }
        }),
        'widget:delete': toolbarButton({
            execute: function (toolbar) {
                toolbar.widget.remove();
            },
            enabled: function (toolbar) {
                return !!toolbar.widget;
            }
        }),

        // Multimedia controls
        'media:filePicker': toolbarButton({
            stateChange: function (toolbar, self) {
                self.label = (/(?:^|\/)([^/]+)$/.exec($(toolbar.widget.element).attr('src')) || [])[1] || '';
            },
            execute: function (toolbar) {
                var currentValue = $(toolbar.widget.element).attr('src');
                $.when(toolbar.options.selectImage(currentValue)).then(function (value) {
                    toolbar.typer.invoke(function (tx) {
                        $(toolbar.widget.element).attr('src', value.src || value);
                    });
                });
            }
        })
    });

    /* ********************************
     * Built-in Renderers
     * ********************************/

    var toolbarRenderer = define({
        group: '<div class="typer-ui-group" x:bind="(role:name)"><br x:t="children"/></div>',
        label: '<span class="typer-ui-label"><br x:t="labelIcon"/><br x:t="labelText"/></span>',
        labelText: '<span x:bind="(_:label)"></span>',
        labelIcon: '',
        button: '<button x:bind="(title:label,role:name)"><br x:t="label"/></button>',
        buttonExecuteOn: 'click',
        dropdown: '<div class="typer-ui-dropdown" x:bind="(title:label,role:name)"><select><option x:t="children(t:dropdownItem)"/></select></div>',
        dropdownExecuteOn: 'change',
        dropdownItem: '<option x:bind="(value:name,_:label)"></option>',
        children: renderChildControls,
        getIcon: function (control, iconSet) {
            return (Typer.toolbar.icons[control.icon] || Typer.toolbar.icons[control.name] || '')[iconSet] || '';
        }
    });

    toolbarRenderer.default = toolbarRenderer();

    toolbarRenderer.material = toolbarRenderer({
        resources: [
            'https://fonts.googleapis.com/css?family=Roboto:400,500,700',
            'https://fonts.googleapis.com/icon?family=Material+Icons',
            'https://cdn.rawgit.com/misonou/jquery-typer/master/css/jquery.typer.material.css'
        ],
        labelText: function (toolbar, control) {
            return this.getIcon(control, 'material') ? '' : toolbarRenderer.default.labelText;
        },
        labelIcon: function (toolbar, control) {
            return this.getIcon(control, 'material').replace(/(.+)/, '<i class="material-icons">$1</i>');
        },
        dropdown: '<div class="typer-ui-dropdown typer-ui-menu" x:bind="(role:name)"><button x:bind="(title:label)"><span class="typer-ui-label"><br x:t="labelIcon"/><span x:bind="(_:selectedValue)"></span></span></button><div class="typer-ui-controlpane"><br x:t="children"></div></div>',
        textbox: '<div class="typer-ui-textbox" x:bind="(role:name)"><label><br x:t="label"/><div spellcheck="false"></div></label></div>',
        textboxInit: function (toolbar, control) {
            $(control.element).toggleClass('empty', !control.value);
            $('>label>div', control.element).text(control.value || '').typer({
                inline: true,
                lineBreak: false,
                change: function (e, value) {
                    control.value = value;
                    $(control.element).toggleClass('empty', !control.value);
                }
            });
        }
    });

    /* ********************************
     * Resources
     * ********************************/

    Typer.toolbar = {
        labels: {},
        icons: {},
        controls: definedControls,
        renderer: toolbarRenderer,
        button: toolbarButton,
        dropdown: toolbarDropdown,
        group: toolbarGroup,
        textbox: toolbarTextbox
    };

    $.extend(Typer.toolbar.labels, {
        'formatting:bold': 'Bold',
        'formatting:italic': 'Italic',
        'formatting:underline': 'Underlined',
        'formatting:unorderedList': 'Bullet List',
        'formatting:orderedList': 'Numbered List',
        'formatting:indent': 'Indent',
        'formatting:outdent': 'Outdent',
        'formatting:justifyLeft': 'Align Left',
        'formatting:justifyCenter': 'Align Center',
        'formatting:justifyRight': 'Align Right',
        'formatting:paragraph': 'Formatting',
        'formatting:inlineStyle': 'Text Style',
        'insert:anchor': 'Insert Anchor',
        'insert:image': 'Insert Photo',
        'insert:link': 'Insert Link',
        'history:undo': 'Undo',
        'history:redo': 'Redo',
        'widget:delete': 'Delete',
        'media:filePicker': 'Pick File'
    });

    $.each({
        'formatting:bold': 'format_bold',
        'formatting:italic': 'format_italic',
        'formatting:underline': 'format_underlined',
        'formatting:unorderedList': 'format_list_bulleted',
        'formatting:orderedList': 'format_list_numbered',
        'formatting:indent': 'format_indent_increase',
        'formatting:outdent': 'format_indent_decrease',
        'formatting:justifyLeft': 'format_align_left',
        'formatting:justifyCenter': 'format_align_center',
        'formatting:justifyRight': 'format_align_right',
        'insert:anchor': 'label',
        'insert:image': 'insert_photo',
        'insert:link': 'insert_link',
        'insert:video': 'videocam',
        'history:undo': 'undo',
        'history:redo': 'redo',
        'widget:delete': 'delete',
    }, function (i, v) {
        Typer.toolbar.icons[i] = {};
        Typer.toolbar.icons[i].material = v;
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

}(jQuery, window.Typer));
