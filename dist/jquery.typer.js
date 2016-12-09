/*!
 * jQuery Typer Plugin v0.9.0-beta
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
    var INNER_PTAG = 'h1,h2,h3,h4,h5,h6,p,q,blockquote,pre,code,li,caption,figcaption,summary,dt';
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
            var selectDirection;
            if (currentSelection && currentSelection.isCaret && !range.collapsed) {
                var currentRange = createRange(currentSelection);
                selectDirection = range.compareBoundaryPoints(2, currentRange) > 0 ? 1 : range.compareBoundaryPoints(0, currentRange) < 0 ? -1 : 0;
            }
            return $.extend(new TyperSelection(), {
                isCaret: range.collapsed,
                caretPosition: range.collapsed && compareRangePosition(range, startPoint.node.element) || 0,
                selectDirection: selectDirection || (currentSelection || '').selectDirection || 0,
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
                var focusWidgetOptions = widgetOptions[state.focusNode.widget.id];
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
                    if (is(node, NODE_WIDGET | NODE_INLINE_WIDGET)) {
                        if (node.widget.id === '__unknown__' || (focusWidgetOptions.allowedWidgets !== undefined && String(focusWidgetOptions.allowedWidgets).split(' ').indexOf(node.widget.id) < 0)) {
                            node = new TyperNode(NODE_INLINE, wrapNode(createTextNode(extractText(node.element)), formattingNodes), node.parentNode.widget);
                        }
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
            var document = createTyperDocument(content);
            var iterator = new TyperTreeWalker(document.rootNode, NODE_PARAGRAPH | NODE_EDITABLE_PARAGRAPH | NODE_SHOW_EDITABLE);
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
                        var currentRange = createRange(currentSelection);
                        var currentPoint = createRange(currentRange, (currentSelection.selectDirection || direction) < 0);
                        var rect = currentPoint.getBoundingClientRect();
                        for (var y = rect.top + (direction > 0 && rect.height); true; y += 5 * direction) {
                            var newPoint = getRangeFromPoint(rect.left, y);
                            if (!newPoint || !containsOrEquals(topElement, newPoint.startContainer)) {
                                return false;
                            }
                            if (compareRangePosition(newPoint, currentPoint) && !is(typerDocument.getNode(newPoint.startContainer), NODE_WIDGET)) {
                                select(newPoint, eventName.charAt(0) !== 's' || createRange(currentRange, (currentSelection.selectDirection || direction) > 0));
                                return true;
                            }
                        }
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
                tx.select(self.element);
                tx.insertText();
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

(function ($, Typer) {
    'use strict';

    Typer.presets = {
        textbox: {
            inline: true,
            inlineStyle: false,
            lineBreak: false,
            toolbar: false,
            disallowedElement: '*',
            init: function (e) {
                e.typer.moveCaret(e.typer.element, -0);
                Object.defineProperty(e.typer.element, 'value', {
                    enumerable: true,
                    configurable: true,
                    get: function () {
                        return Typer.trim(this.textContent);
                    },
                    set: function (value) {
                        if (value !== this.value) {
                            this.textContent = value;
                            e.typer.moveCaret(this, -0);
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
                $.each(self.typer.getSelection().widgets.concat(self.typer.getStaticWidgets()), function (i, v) {
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
        $(state.selectedElements).each(function (i, v) {
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

    /* ********************************
     * Commands
     * ********************************/

    function justifyCommand(tx) {
        $(tx.selection.paragraphElements).attr('align', ALIGN_VALUE[tx.commandName]);
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

    function insertListCommand(tx, type) {
        var tagName = tx.commandName === 'insertOrderedList' || type ? 'ol' : 'ul';
        var html = '<' + tagName + (type || '').replace(/^.+/, ' type="$&"') + '>';
        var filter = function (i, v) {
            return v.tagName.toLowerCase() === tagName && ($(v).attr('type') || '') === (type || '');
        };
        $.each(tx.selection.paragraphElements, function (i, v) {
            if (v.tagName.toLowerCase() !== 'li') {
                var list = $(v).prev().filter(filter)[0] || $(v).next().filter(filter)[0] || $(html).insertAfter(v)[0];
                $(v).wrap('<li>').contents().unwrap().parent()[Typer.comparePosition(v, list) < 0 ? 'prependTo' : 'appendTo'](list);
            } else if (!$(v.parentNode).filter(filter)[0]) {
                $(v.parentNode).wrap(html).contents().unwrap();
            }
        });
        tx.restoreSelection();
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
                superscript: !!selection.getSelectedElements('sup')[0],
                subscript: !!selection.getSelectedElements('sub')[0],
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
                var paragraphs = tx.selection.paragraphElements;
                $(tx.getSelectedTextNodes()).wrap(createElementWithClassName('span', className));
                $('span:has(span)', paragraphs).each(function (i, v) {
                    $(v).contents().unwrap().filter(function (i, v) {
                        return v.nodeType === 3;
                    }).wrap(createElementWithClassName('span', v.className));
                });
                $('span[class=""]', paragraphs).contents().unwrap();
                tx.restoreSelection();
            }
        }
    };
    addCommandHotKeys('inlineStyle', 'ctrlB:bold ctrlI:italic ctrlU:underline');

    Typer.widgets.formatting = {
        beforeStateChange: function (e) {
            var selection = e.typer.getSelection();
            var element = selection.paragraphElements.slice(-1)[0];
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
                    $(tx.selection.paragraphElements).not('li').wrap(createElementWithClassName(m[1] || 'p', m[2])).contents().unwrap();
                }
                tx.restoreSelection();
            },
            insertLine: function (tx) {
                var selection = tx.selection;
                var nextElm = selection.isCaret && (selection.textEnd && $(selection.startTextNode).next('br')[0]) || (selection.textStart && $(selection.startTextNode).prev('br')[0]);
                tx.insertText('\n\n');
                if (nextElm) {
                    tx.remove(nextElm);
                }
            }
        }
    };
    addCommandHotKeys('formatting', 'enter:insertLine ctrlShiftL:justifyLeft ctrlShiftE:justifyCenter ctrlShiftR:justifyRight');

    Typer.widgets.lineBreak = {
        inline: true,
        commands: {
            insertLineBreak: function (tx) {
                tx.insertHtml('<br>' + (tx.selection.textEnd ? Typer.ZWSP_ENTITIY : ''));
            }
        }
    };
    addCommandHotKeys('lineBreak', 'shiftEnter:insertLineBreak');

    Typer.widgets.list = {
        element: 'ul,ol',
        editable: 'ul,ol',
        insert: insertListCommand,
        beforeStateChange: function (e) {
            var tagName = e.widget.element.tagName.toLowerCase();
            $.extend(e.widget, {
                insertUnorderedList: tagName === 'ul',
                insertOrderedList: tagName === 'ol',
                listType: $(e.widget.element).attr('type') || ''
            });
        },
        commands: {
            indent: function (tx) {
                $.each(tx.selection.paragraphElements, function (i, v) {
                    var list = $(v.parentNode).filter('ul,ol')[0];
                    var prevItem = $(v).prev('li')[0] || $('<li>').insertBefore(v)[0];
                    var newList = $(prevItem).children('ul,ol')[0] || $(list.cloneNode(false)).appendTo(prevItem)[0];
                    $('<li>').append(v.childNodes).appendTo(newList);
                    tx.remove(v);
                    if ($(newList).parent('li')[0] && !newList.previousSibling) {
                        $(Typer.createTextNode()).insertBefore(newList);
                    }
                });
                tx.restoreSelection();
            },
            outdent: function (tx) {
                $.each(tx.selection.paragraphElements, function (i, v) {
                    var list = $(v.parentNode).filter('ul,ol')[0];
                    var parentList = $(list).parent('li')[0];
                    if ($(v).next('li')[0]) {
                        if (parentList) {
                            $(list.cloneNode(false)).append($(v).nextAll()).appendTo(v);
                        } else {
                            $(list.cloneNode(false)).append($(v).nextAll()).insertAfter(list);
                            $(v).children('ul,ol').insertAfter(list);
                        }
                    }
                    $(createElementWithClassName(parentList ? 'li' : 'p')).append(v.childNodes).insertAfter(parentList || list);
                    tx.remove(v);
                });
                tx.restoreSelection();
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
            },
            enabled: function (toolbar, self) {
                return (command !== 'indent' && command !== 'outdent') || (self.widget);
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
                return !!toolbar.typer.getSelection().paragraphElements[0];
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
        commands: {
            setURL: function (tx, value) {
                tx.widget.element.href = value;
            },
            unlink: function (tx) {
                tx.select(tx.widget.element);
                tx.execCommand('unlink');
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

    var reMediaType = /\.(?:(jpg|jpeg|png|gif|webp)|(mp4|ogg|webm)|(mp3))$/gi;

    Typer.widgets.media = {
        element: 'img,audio,video,a:has(>img)',
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
        widgetInit: function (e, widget) {
            widget.toolbar = createToolbar(e.typer, e.widget.options, widget);
        },
        focusin: function (e) {
            showToolbar(e.widget.toolbar);
        },
        focusout: function (e) {
            setTimeout(hideToolbar);
        },
        widgetFocusin: function (e, widget) {
            if (widget.toolbar.all['toolbar:widget'].controls[0]) {
                showToolbar(widget.toolbar);
            }
        },
        widgetFocusout: function (e, widget) {
            showToolbar(e.widget.toolbar);
        },
        widgetDestroy: function (e, widget) {
            if (widget.toolbar) {
                widget.toolbar.destroy();
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
                return toolbar.typer.document.rootNode.nodeType !== Typer.NODE_EDITABLE_INLINE;
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
