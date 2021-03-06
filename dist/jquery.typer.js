/*!
 * jQuery Typer Plugin v0.11.3
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

(function (jQuery, window, document, Object, String, Array, Math, Node, Range, DocumentFragment, RegExp, parseFloat, setTimeout, clearTimeout, shim) {
'use strict';

// source: src/core.js
(function ($, root, array) {
    var KEYNAMES = JSON.parse('{"8":"backspace","9":"tab","13":"enter","16":"shift","17":"ctrl","18":"alt","19":"pause","20":"capsLock","27":"escape","32":"space","33":"pageUp","34":"pageDown","35":"end","36":"home","37":"leftArrow","38":"upArrow","39":"rightArrow","40":"downArrow","45":"insert","46":"delete","48":"0","49":"1","50":"2","51":"3","52":"4","53":"5","54":"6","55":"7","56":"8","57":"9","65":"a","66":"b","67":"c","68":"d","69":"e","70":"f","71":"g","72":"h","73":"i","74":"j","75":"k","76":"l","77":"m","78":"n","79":"o","80":"p","81":"q","82":"r","83":"s","84":"t","85":"u","86":"v","87":"w","88":"x","89":"y","90":"z","91":"leftWindow","92":"rightWindowKey","93":"select","96":"numpad0","97":"numpad1","98":"numpad2","99":"numpad3","100":"numpad4","101":"numpad5","102":"numpad6","103":"numpad7","104":"numpad8","105":"numpad9","106":"multiply","107":"add","109":"subtract","110":"decimalPoint","111":"divide","112":"f1","113":"f2","114":"f3","115":"f4","116":"f5","117":"f6","118":"f7","119":"f8","120":"f9","121":"f10","122":"f11","123":"f12","144":"numLock","145":"scrollLock","186":"semiColon","187":"equalSign","188":"comma","189":"dash","190":"period","191":"forwardSlash","192":"backtick","219":"openBracket","220":"backSlash","221":"closeBracket","222":"singleQuote"}');
    var INNER_PTAG = 'h1,h2,h3,h4,h5,h6,p,q,blockquote,pre,code,li,caption,figcaption,summary,dt,th';
    var SOURCE_PRIORITY = 'script mouse touch keyboard input drop cut copy paste'.split(' ');
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
    var IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    var IS_IE10 = !!window.ActiveXObject;
    var IS_IE = IS_IE10 || root.style.msTouchAction !== undefined || root.style.msUserSelect !== undefined;

    var FLIP_POS = {
        top: 'bottom',
        left: 'right',
        right: 'left',
        bottom: 'top'
    };
    var WRITING_MODES = {
        'horizontal-tb': 0,
        'vertical-rl': 5,
        'vertical-lr': 1,
        'sideways-rl': 5,
        'sideways-lr': 11,
        'lr': 0,
        'rl': 0,
        'tb': 5,
        'lr-tb': 0,
        'lr-bt': 4,
        'rl-tb': 0,
        'rl-bt': 4,
        'tb-rl': 5,
        'bt-rl': 5,
        'tb-lr': 1,
        'bt-lr': 1
    };

    // each element represent two masks for each abstract box side pair
    // incicate writing modes that the abstract start side maps to side with larger coordinate (right or bottom)
    var RECT_COLLAPSE_MASK = [0x0f0, 0xccc, 0x5aa, 0xf00];
    var RECT_SIDE = 'block-start block-end inline-start inline-end over under line-left line-right'.split(' ');

    var CHARSET_RTL = '\u0590-\u07ff\u200f\u202b\u202e\ufb1d-\ufdfd\ufe70-\ufefc';
    var RE_RTL = new RegExp('([' + CHARSET_RTL + '])');
    var RE_LTR = new RegExp('([^\\s' + CHARSET_RTL + '])');
    var RE_N_RTL = new RegExp('(\\s|[' + CHARSET_RTL + '])');
    var RE_N_LTR = new RegExp('(\\s|[^' + CHARSET_RTL + '])');

    // unicode codepoints that caret position should not anchored on
    // ZWSP, lower surrogates, diacritical and half marks, and combining marks (Arabic, Hebrew and Japanese)
    var RE_SKIP = /[\u200b\u0300-\u036f\u1ab0-\u1aff\u1dc0-\u1dff\u20d0-\u20ff\ufe20-\ufe2f\udc00-\udcff\u0591-\u05bd\u05bf\u05c1\u05c2\u05c4\u05c5\u05c7\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06dc\u06df-\u06e4\u06e7\u06e8\u06ea-\u06ed\u08d4-\u08e1\u08e3-\u08ff\u0900-\u0903\u093a-\u093c\u093e-\u094f\u0951-\u0957\u0962\u0963\u3099\u309a]/;

    var elementsFromPoint_ = document.msElementsFromPoint || document.elementsFromPoint;
    var compareDocumentPosition_ = document.compareDocumentPosition;
    var compareBoundaryPoints_ = Range.prototype.compareBoundaryPoints;

    var isFunction = $.isFunction;
    var extend = $.extend;
    var selection = window.getSelection();
    var getComputedStyle = window.getComputedStyle;
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
    var supportTextInputEvent = true;
    var currentSource = [];
    var lastTouchedElement;
    var checkNativeUpdate;
    var scrollbarWidth;

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

    function TyperRect(l, t, r, b) {
        var self = this;
        self.left = l;
        self.top = t;
        self.right = r;
        self.bottom = b;
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

    function any(arr, callback) {
        var result;
        $.each(arr, function (i, v) {
            result = callback.call(this, v, i) && v;
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

    function next(iterator, direction) {
        return iterator[direction < 0 ? 'previousNode' : 'nextNode']();
    }

    function consume(set, callback) {
        var arr = [];
        set.forEach(function (v) {
            arr[arr.length] = v;
        });
        set.clear();
        arr.forEach(callback);
    }

    function trim(v) {
        return String(v || '').replace(/^(?:\u200b|[^\S\u00a0])+|(?:\u200b|[^\S\u00a0])+$/g, '');
    }

    function collapseWS(v) {
        return String(v || '').replace(/[^\S\u00a0]+/g, ' ').replace(/\u200b/g, '');
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

    function isRTL(ch, baseRTL) {
        return RE_RTL.test(ch) ? true : /[^\s!-\/:-@\[\]^_`{|}~]/.test(ch) ? false : baseRTL;
    }

    function getWritingMode(elm) {
        var style = getComputedStyle(isElm(elm) || elm.parentNode);
        return WRITING_MODES[style.getPropertyValue('writing-mode')] ^ (style.direction === 'rtl' ? 2 : 0);
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
        container = (container || '').element || container;
        contained = (contained || '').element || contained;
        return container === contained || $.contains(container, contained);
    }

    function getCommonAncestor(a, b) {
        for (b = b || a; a && a !== b && compareDocumentPosition_.call(a, b) !== 20; a = a.parentNode);
        return a;
    }

    function getOffset(node, offset) {
        var len = node.length || node.childNodes.length;
        return 1 / offset < 0 ? Math.max(0, len + offset) : Math.min(len, offset);
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

    function getRect(elm, includeMargin) {
        var rect;
        elm = elm || root;
        if (elm.getRect) {
            return elm.getRect();
        }
        elm = elm.element || elm;
        if (elm === root) {
            rect = toPlainRect(0, 0, root.offsetWidth, root.offsetHeight);
        } else if (!containsOrEquals(root, elm)) {
            // IE10 throws Unspecified Error for detached elements
            rect = toPlainRect(0, 0, 0, 0);
        } else {
            rect = toPlainRect(elm.getBoundingClientRect());
            if (includeMargin) {
                var style = getComputedStyle(elm);
                rect.top -= Math.max(0, parseFloat(style.marginTop));
                rect.left -= Math.max(0, parseFloat(style.marginLeft));
                rect.right += Math.max(0, parseFloat(style.marginRight));
                rect.bottom += Math.max(0, parseFloat(style.marginBottom));
            }
        }
        return rect;
    }

    function toPlainRect(l, t, r, b) {
        function clip(v) {
            // IE provides precision up to 0.05 but with floating point errors that hinder comparisons
            return Math.round(v * 1000) / 1000;
        }
        if (l.top !== undefined) {
            return new TyperRect(clip(l.left), clip(l.top), clip(l.right), clip(l.bottom));
        }
        if (r === undefined) {
            return new TyperRect(l, t, l, t);
        }
        return new TyperRect(l, t, r, b);
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

    function pointInRect(x, y, rect, within) {
        within = within || 0;
        return rect.width && rect.height && x - rect.left >= -within && x - rect.right <= within && y - rect.top >= -within && y - rect.bottom <= within;
    }

    function mergeRect(a, b) {
        return toPlainRect(Math.min(a.left, b.left), Math.min(a.top, b.top), Math.max(a.right, b.right), Math.max(a.bottom, b.bottom));
    }

    function getRects(range) {
        return $.map((is(range, Range) || createRange(range, 'contents')).getClientRects(), toPlainRect);
    }

    function getAbstractRect(rect, mode) {
        var sign = mode / Math.abs(mode);
        rect = is(rect, TyperRect) || getRect(rect);
        mode /= sign;
        var signX = mode & 2 ? -1 : 1;
        var signY = mode & 4 ? -1 : 1;
        if (sign > 0 && (mode & 1)) {
            signX ^= signY;
            signY ^= signX;
            signX ^= signY;
        }
        var propX = signX < 0 ? 'right' : 'left';
        var propY = signY < 0 ? 'bottom' : 'top';
        if (mode & 1) {
            rect = toPlainRect(rect[propY] * signY, rect[propX] * signX, rect[FLIP_POS[propY]] * signY, rect[FLIP_POS[propX]] * signX);
        } else {
            rect = toPlainRect(rect[propX] * signX, rect[propY] * signY, rect[FLIP_POS[propX]] * signX, rect[FLIP_POS[propY]] * signY);
        }
        return rect;
    }

    function getAbstractSide(side, mode) {
        mode = +mode === mode ? mode : getWritingMode(mode);
        side = +side === side ? side : RECT_SIDE.indexOf(side);
        var prop = (side >> 1 & 1) ^ (mode & 1) ? 'left' : 'top';
        return !!(RECT_COLLAPSE_MASK[side >> 1] & (1 << mode)) ^ (side & 1) ? FLIP_POS[prop] : prop;
    }

    function getActiveRange(container) {
        if (selection.rangeCount) {
            var range = selection.getRangeAt(0);
            return containsOrEquals(container, range.commonAncestorContainer) && range;
        }
    }

    function elementFromPoint(x, y, container) {
        container = container || document.body;
        if (elementsFromPoint_) {
            return any(elementsFromPoint_.call(document, x, y), function (v) {
                return containsOrEquals(container, v) && $.css(v, 'pointer-events') !== 'none';
            }) || null;
        }
        var element = document.elementFromPoint(x, y);
        if (!containsOrEquals(container, element) && pointInRect(x, y, getRect(container))) {
            var tmp = [];
            try {
                while (comparePosition(container, element, true)) {
                    var target = $(element).parentsUntil(getCommonAncestor(container, element)).slice(-1)[0] || element;
                    if (target === tmp[tmp.length - 1]) {
                        return null;
                    }
                    target.style.pointerEvents = 'none';
                    tmp[tmp.length] = target;
                    element = document.elementFromPoint(x, y);
                }
            } finally {
                $(tmp).css('pointer-events', '');
            }
        }
        return containsOrEquals(container, element) ? element : null;
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

    function transformText(text, transform) {
        switch (transform) {
            case 'uppercase':
                return text.toUpperCase();
            case 'lowercase':
                return text.toLowerCase();
            case 'capitalize':
                return text.replace(/\b(.)/g, function (v) {
                    return v.toUpperCase();
                });
        }
        return text;
    }

    function updateTextNodeData(node, text) {
        if (node.data !== text) {
            node.data = text;
        }
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

    function getScrollParent(element) {
        for (; element !== root && $.css(element, 'overflow') === 'visible'; element = element.parentNode);
        return element;
    }

    function scrollRectIntoView(element, rect) {
        var parent = getScrollParent(element);
        var parentRect = getRect(parent === document.body ? root : parent);
        var style = getComputedStyle(parent);
        var winOrElm = parent === root || parent === document.body ? window : parent;
        var origX = $(winOrElm).scrollLeft();
        var origY = $(winOrElm).scrollTop();
        var deltaX = Math.max(0, rect.right - (parentRect.right - (style.overflowY === 'scroll' || (style.overflowY === 'auto' && parent.scrollHeight > parent.offsetHeight) ? scrollbarWidth : 0))) || Math.min(rect.left - parentRect.left, 0);
        var deltaY = Math.max(0, rect.bottom - (parentRect.bottom - (style.overflowX === 'scroll' || (style.overflowY === 'auto' && parent.scrollWidth > parent.offsetWidth) ? scrollbarWidth : 0))) || Math.min(rect.top - parentRect.top, 0);
        if (deltaX || deltaY) {
            if (winOrElm.scrollTo) {
                winOrElm.scrollTo(origX + deltaX, origY + deltaY);
            } else {
                winOrElm.scrollLeft = origX + deltaX;
                winOrElm.scrollTop = origY + deltaY;
            }
        }
        var result = {
            x: $(winOrElm).scrollLeft() - origX,
            y: $(winOrElm).scrollTop() - origY
        };
        if (winOrElm !== window) {
            var parentResult = scrollRectIntoView(parent.parentNode, rect.translate(result.x, result.y));
            if (parentResult) {
                result.x += parentResult.x;
                result.y += parentResult.y;
            }
        }
        return (result.x || result.y) ? result : false;
    }

    function getFontMetric(elm) {
        var cache = getFontMetric.cache || (getFontMetric.cache = {});
        var style = getComputedStyle(isElm(elm) || elm.parentNode);
        var key = [style.fontFamily, style.fontWeight, style.fontStyle].join('|');
        if (!cache[key]) {
            var $dummy = $('<div style="position:fixed;font-size:1000px;"><span style="display:inline-block;width:0;height:0;"></span>&nbsp;</div>').css({
                fontFamily: style.fontFamily,
                fontWeight: style.fontWeight,
                fontStyle: style.fontStyle
            }).appendTo(document.body);
            var $img = $dummy.children();
            var offset = getRect($dummy[0]).top;
            cache[key] = {
                baseline: (getRect($img.css('vertical-align', 'baseline')[0]).top - offset) / 1000,
                height: (getRect($img.css('vertical-align', 'text-bottom')[0]).top - offset) / 1000,
                middle: (getRect($img.css('vertical-align', 'middle')[0]).top - offset) / 1000,
                wsWidth: $dummy.width() / 1000
            };
            $dummy.remove();
        }
        var fontSize = parseFloat(style.fontSize);
        return {
            fontSize: fontSize,
            baseline: cache[key].baseline * fontSize,
            height: cache[key].height * fontSize,
            middle: cache[key].middle * fontSize,
            wsWidth: cache[key].wsWidth * fontSize
        };
    }

    function setTimeoutOnce(fn) {
        clearTimeout(fn._timeout);
        fn._timeout = setTimeout.apply(null, arguments);
    }

    function setEventSource(source, typer) {
        if (!currentSource[0]) {
            setTimeout(function () {
                currentSource = [];
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

    function combineNodeFilters() {
        var args = $.grep(arguments, $.isFunction);
        return function (node) {
            var result = 1;
            for (var i = 0, len = args.length; i < len; i++) {
                var value = args[i](node);
                if (value === 2) {
                    return 2;
                }
                result |= value;
            }
            return result;
        };
    }

    function draggable(e, scrollElement, callback) {
        var deferred = $.Deferred();
        var lastPos = e;
        var scrollParent = getScrollParent(isElm(scrollElement) || e.target);
        var scrollTimeout;

        var handlers = {
            keydown: function (e) {
                if (e.which === 27) {
                    deferred.reject();
                    handlers.mouseup(e);
                }
            },
            mousemove: function (e) {
                if (!e.which) {
                    handlers.mouseup(e);
                    return;
                }
                if (e.clientX !== lastPos.clientX || e.clientY !== lastPos.clientY) {
                    lastPos = e;
                    deferred.notify(e.clientX, e.clientY);
                }
                e.preventDefault();
            },
            mouseup: function (e) {
                clearInterval(scrollTimeout);
                $(document.body).off(handlers);
                $(scrollParent).off(scrollParentHandlers);
                deferred.resolve();
            }
        };
        var scrollParentHandlers = {
            mouseout: function (e) {
                if (!scrollTimeout && (!containsOrEquals(scrollParent, e.relatedTarget) || (scrollParent === root && e.relatedTarget === root))) {
                    scrollTimeout = setInterval(function () {
                        if (scrollRectIntoView(scrollParent, toPlainRect(lastPos.clientX - 50, lastPos.clientY - 50, lastPos.clientX + 50, lastPos.clientY + 50))) {
                            deferred.notify(lastPos.clientX, lastPos.clientY);
                        } else {
                            clearInterval(scrollTimeout);
                            scrollTimeout = null;
                        }
                    }, 20);
                }
            },
            mouseover: function (e) {
                if (e.target !== root) {
                    clearInterval(scrollTimeout);
                    scrollTimeout = null;
                }
            }
        };
        $(document.body).on(handlers);
        $(scrollParent).on(scrollParentHandlers);
        return deferred.promise().progress(callback || scrollElement);
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
        var undoable = {};
        var currentSelection;
        var executing;
        var muteChanges;
        var needNormalize = true;
        var typerFocused = false;
        var $self = $(topElement);

        var codeUpdate = (function () {
            var run = transaction(function () {
                normalize();
                executing = false;
            });
            return function (callback, args, thisArg) {
                executing = true;
                setEventSource('script', typer);
                run(callback, args, thisArg);
                typer.getNode();
            };
        }());

        function TyperTransaction(widget) {
            this.widget = widget || null;
        }

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
                case EVENT_STATIC:
                    return widgets;
                case EVENT_HANDLER:
                case EVENT_ALL:
                    return currentSelection.getWidgets().reverse().concat(widgets);
            }
        }

        function findWidgetWithCommand(name) {
            return any(getTargetedWidgets(EVENT_HANDLER), function (v) {
                var options = widgetOptions[v.id];
                return options.commands && isFunction(options.commands[name]);
            });
        }

        function triggerEvent(eventMode, eventName, data, props) {
            if (eventMode.id === WIDGET_ROOT) {
                // root widget should not be considered as content widget although it appears in node
                return false;
            }
            var widgets = (getTargetedWidgets(eventMode) || $.makeArray(eventMode)).filter(function (v) {
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

        function createTyperDocument(rootElement, fireEvent) {
            var self = {};
            var nodeSource = containsOrEquals(topElement, rootElement) ? typer : self;
            var nodeMap = new WeakMap();
            var changedWidgets = new Set();
            var initOrDestroyWidgets = new Set();
            var observer = new MutationObserver(handleMutations);

            function triggerWidgetEvents(source) {
                setEventSource.apply(null, source);
                if (needNormalize) {
                    normalize();
                }
                codeUpdate(function () {
                    consume(initOrDestroyWidgets, function (v) {
                        triggerEvent(v, v._event);
                        triggerEvent(EVENT_STATIC, 'widget' + capfirst(v._event), null, {
                            targetWidget: v
                        });
                        v.destroyed = v._event === 'destroy';
                        delete v._event;
                    });
                    if (changedWidgets.size) {
                        consume(changedWidgets, function (v) {
                            triggerEvent(v, 'contentChange');
                        });
                        triggerEvent(EVENT_STATIC, 'contentChange');
                    }
                });
                undoable.snapshot();
            }

            function registerWidgetEvent(widget, event) {
                if (fireEvent && widget.id !== WIDGET_UNKNOWN) {
                    if (initOrDestroyWidgets.has(widget)) {
                        initOrDestroyWidgets.delete(widget);
                        delete widget._event;
                    } else {
                        initOrDestroyWidgets.add(widget);
                        defineProperty(widget, '_event', event);
                        setTimeoutOnce(triggerWidgetEvents, 0, currentSource.slice(0));
                    }
                }
            }

            function addChild(parent, node) {
                var arr = parent.childNodes;
                for (var index = arr.length; index && comparePosition(node.element, arr[index - 1].element) <= 0; index--);
                if (arr[index] !== node) {
                    if (node.parentNode) {
                        removeFromParent(node);
                    } else {
                        // revoke any destroy event registered previously when being removed from old parent
                        iterate(new TyperTreeWalker(node, -1), function (v) {
                            detachedElements.delete(v.element);
                            if (v.widget.element === v.element) {
                                registerWidgetEvent(v.widget, 'init');
                            }
                        });
                    }
                    arr.splice(index, 0, node);
                    node.parentNode = parent;
                    node.previousSibling = arr[index - 1] || null;
                    node.nextSibling = arr[index + 1] || null;
                    (node.previousSibling || {}).nextSibling = node;
                    (node.nextSibling || {}).previousSibling = node;
                    return true;
                }
            }

            function removeFromParent(node, destroyWidget) {
                var parent = node.parentNode;
                var prev = node.previousSibling;
                var next = node.nextSibling;
                parent.childNodes.splice(parent.childNodes.indexOf(node), 1);
                (prev || {}).nextSibling = next;
                (next || {}).previousSibling = prev;
                node.parentNode = null;
                node.nextSibling = null;
                node.previousSibling = null;
                if (destroyWidget) {
                    iterate(new TyperTreeWalker(node, -1), function (v) {
                        detachedElements.set(v.element, {
                            node: (prev || next || parent).element,
                            offset: prev ? false : next ? true : 0
                        });
                        if (v.widget.element === v.element) {
                            registerWidgetEvent(v.widget, 'destroy');
                        }
                    });
                }
            }

            function updateNode(node) {
                var oldWidget = node.widget;
                var parent = node.parentNode;

                node.widget = (oldWidget || '').element !== node.element ? parent.widget : oldWidget;
                if (!is(parent, NODE_WIDGET | NODE_INLINE_WIDGET)) {
                    var matchedId;
                    var matched = any(widgetOptions, function (v, i) {
                        return is(node.element, v.element) && (matchedId = i);
                    });
                    if (matched && (node.widget === parent.widget || node.widget.id !== matchedId)) {
                        node.widget = new TyperWidget(nodeSource, matchedId, node.element, matched.options);
                        registerWidgetEvent(node.widget, 'init');
                    }
                }
                if (oldWidget && oldWidget !== node.widget) {
                    registerWidgetEvent(oldWidget, 'destroy');
                }
                var widgetOption = widgetOptions[node.widget.id];
                if (node.widget === parent.widget && !is(parent, NODE_WIDGET | NODE_INLINE_WIDGET)) {
                    node.nodeType = is(node.element, INNER_PTAG) ? NODE_PARAGRAPH : NODE_INLINE;
                } else if (is(node.element, widgetOption.editable) || (widgetOption.inline && !widgetOption.editable)) {
                    node.nodeType = widgetOption.inline ? NODE_INLINE_EDITABLE : is(node.element, INNER_PTAG) ? NODE_EDITABLE_PARAGRAPH : NODE_EDITABLE;
                } else {
                    node.nodeType = widgetOption.inline && node.widget !== parent.widget && is(parent, NODE_ANY_ALLOWTEXT) ? NODE_INLINE_WIDGET : NODE_WIDGET;
                }
            }

            function visitNode(thisNode, visitChild) {
                $.each(thisNode.childNodes.slice(0), function (i, v) {
                    if (!containsOrEquals(thisNode, v)) {
                        removeFromParent(v, true);
                    }
                });
                $(thisNode.element).children().not('br').each(function (i, v) {
                    var node = nodeMap.get(v) || new TyperNode(nodeSource, 0, v);
                    nodeMap.set(v, node);
                    if (addChild(thisNode, node) || visitChild) {
                        updateNode(node);
                        visitNode(node, true);
                    }
                });
            }

            function handleMutations(mutations) {
                var trackChange = currentSelection && !muteChanges;
                var beforeSize = changedWidgets.size;
                var dirtyNodes = new Set();

                $.each(mutations, function (i, v) {
                    var node = nodeMap.get(isElm(v.target) || v.target.parentNode);
                    if (node) {
                        if (v.addedNodes[0] || v.removedNodes[0]) {
                            dirtyNodes.add(node);
                        } else if (trackChange && (!v.attributeName || (v.target !== rootElement && v.attributeName !== 'id' && v.attributeName !== 'style'))) {
                            changedWidgets.add(node.widget);
                        }
                    }
                });
                dirtyNodes.forEach(function (v) {
                    if (containsOrEquals(rootElement, v.element)) {
                        visitNode(v);
                        if (trackChange) {
                            changedWidgets.add(v.widget);
                        }
                    }
                });
                if (dirtyNodes.size && currentSelection) {
                    selectionAtomic(function () {
                        var range = currentSelection.getRange();
                        var needUpdate;
                        dirtyNodes.forEach(function (v) {
                            needUpdate |= rangeIntersects(range, v.element);
                        });
                        if (needUpdate) {
                            selectionUpdate(currentSelection);
                        }
                    });
                }
                if (beforeSize !== changedWidgets.size) {
                    needNormalize = true;
                    setTimeoutOnce(triggerWidgetEvents, 0, currentSource.slice(0));
                }
            }

            function getNode(element) {
                var mutations = observer.takeRecords();
                if (mutations[0]) {
                    handleMutations(mutations);
                }
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
                    attributes: true,
                    characterData: true
                });
            }
            var rootNode = new TyperNode(nodeSource, topNodeType, rootElement, new TyperWidget(nodeSource, WIDGET_ROOT, topElement, options));
            nodeMap.set(rootElement, rootNode);
            visitNode(rootNode);

            return extend(self, {
                rootNode: rootNode,
                getNode: getNode
            });
        }

        function updateWholeText(node, reduce, transform) {
            var textNodes = iterateToArray(createNodeIterator(node, 4));
            var wholeText = '';
            var index = [];
            reduce = reduce || function (v, a) {
                return v + a;
            };
            $.each(textNodes, function (i, v) {
                wholeText = reduce(wholeText, v.data);
                index[i] = wholeText.length;
            });
            wholeText = transform(wholeText);
            $.each(textNodes, function (i, v) {
                updateTextNodeData(v, wholeText.slice(index[i - 1] || 0, index[i]));
            });
        }

        function normalizeWhitespace(node) {
            updateWholeText(node, function (v, a) {
                return (v + a).replace(/\u00a0{2}(?!\u0020?$)/g, '\u00a0 ').replace(/[^\S\u00a0]{2}/g, ' \u00a0').replace(/\u00a0[^\S\u00a0]\u00a0(\S)/g, '\u00a0\u00a0 $1').replace(/(\S)\u00a0(?!$)/g, '$1 ');
            }, function (v) {
                return v.replace(/[^\S\u00a0]$/, '\u00a0');
            });
        }

        function normalize() {
            // flush any previous changes so that they would not be muted away
            typer.getNode();
            if (!needNormalize) {
                return;
            }
            muteChanges = true;
            iterate(new TyperTreeWalker(typer.rootNode, NODE_ANY_ALLOWTEXT | NODE_EDITABLE | NODE_SHOW_HIDDEN), function (node) {
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
                    if (!currentSelection || (currentSelection.startNode !== node && currentSelection.endNode !== node)) {
                        $.each(iterateToArray(createNodeIterator(element, 4)), function (i, v) {
                            updateTextNodeData(v, collapseWS(v.data) || ZWSP);
                            if (isText(v.nextSibling)) {
                                v.nextSibling.data = collapseWS(v.data + v.nextSibling.data);
                                removeNode(v);
                            }
                        });
                    }
                }
                if (is(node, NODE_INLINE) && (!currentSelection || (currentSelection.startElement !== element && currentSelection.endElement !== element)) && !trim(element.textContent)) {
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
            // flush any changes due to normalization so that they will not be included nor cause recursion
            typer.getNode();
            muteChanges = false;
            needNormalize = false;
        }

        function extractContents(range, mode, callback) {
            var method = mode === 'cut' ? 'extractContents' : mode === 'paste' ? 'deleteContents' : 'cloneContents';
            var cloneNode = mode !== 'paste';
            var clearNode = mode !== 'copy';
            var fragment = document.createDocumentFragment();
            var state = is(range, TyperSelection) ? range.clone() : new TyperSelection(typer, range);
            var timestamp = currentSelection.timestamp;
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

                        if ((!handler || node === state.focusNode) && !isWidgetHead && is(node, NODE_EDITABLE)) {
                            // ignore widget structure if the widget is partially selected
                            // and there is no extract event handler defined
                            return 3;
                        }
                        while (!containsOrEquals(stack[0][0], element)) {
                            shift();
                        }
                        if (handler && (!isWidgetHead || !rangeCovers(range, element))) {
                            (isWidgetHead ? $(element) : $(element).parentsUntil(stack[0][0]).addBack()).each(function (i, v) {
                                stack.unshift([v, v.cloneNode(false), node.widget]);
                                stack[1][1].appendChild(stack[0][1]);
                            });
                        }
                        if (rangeCovers(range, element)) {
                            var appendChild = element === stack[0][0];
                            var clone = clearNode ? element : element.cloneNode(true);
                            if (clearNode && !appendChild && is(node, NODE_EDITABLE_PARAGRAPH)) {
                                // prevent editable paragraph being removed
                                clone = $(element.cloneNode(false)).append(element.childNodes[0]);
                            }
                            $(stack[0][1]).append(appendChild ? clone.childNodes : clone);
                            return 2;
                        }
                        if (is(node, NODE_ANY_ALLOWTEXT)) {
                            var content = createRange(element, range)[method]();
                            var firstChild = is(content, DocumentFragment) ? content.firstChild : content;
                            var hasThisElement = is(firstChild, tagName(element));
                            var reqThisElement = !handler;
                            if (cloneNode && firstChild) {
                                if (!hasThisElement && reqThisElement) {
                                    content = wrapNode(content, [is(node, NODE_EDITABLE_PARAGRAPH) ? createElement('p') : element]);
                                } else if (hasThisElement && !reqThisElement) {
                                    content = createDocumentFragment(firstChild.childNodes);
                                }
                                if (!handler) {
                                    updateWholeText(content, null, function (v) {
                                        return transformText(v, $.css(element, 'text-transform'));
                                    });
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
                    // explicitly update the selection
                    if (currentSelection.timestamp !== timestamp) {
                        state = currentSelection;
                    } else if (state.direction > 0) {
                        state.select(range);
                    } else {
                        state.select(createRange(range, false));
                        state.extendCaret.moveTo(createRange(range, true));
                    }
                    if (!state.isSingleEditable) {
                        var iterator = state.createTreeWalker(NODE_ANY_BLOCK_EDITABLE, function (v) {
                            return widgetOptions[v.widget.id].textFlow ? 1 : 3;
                        });
                        var start = closest(state.baseCaret.node, NODE_ANY_BLOCK_EDITABLE);
                        var until = closest(state.extendCaret.node, NODE_ANY_BLOCK_EDITABLE);
                        iterator.currentNode = start;
                        while (next(iterator, state.direction));
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
                content = $.makeArray(createDocumentFragment(content).childNodes);
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
                var forcedInline = !!is(startNode, NODE_EDITABLE_PARAGRAPH);
                var insertAsInline = !!is(startNode, NODE_ANY_ALLOWTEXT);
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
                    var isLineBreak = !!isBR(nodeToInsert);
                    var needSplit = false;
                    var incompatParagraph = false;
                    var splitEnd;

                    if (!textOnly && !isLineBreak && isElm(nodeToInsert)) {
                        startPoint.insertNode(nodeToInsert);
                        node = typer.getNode(nodeToInsert);
                        removeNode(nodeToInsert);
                        if (node.widget !== caretNode.widget) {
                            for (var widgetNode = caretNode; is(widgetNode, NODE_ANY_INLINE | NODE_PARAGRAPH) || (is(widgetNode, NODE_EDITABLE_PARAGRAPH) && widgetNode === caretNode); widgetNode = widgetNode.parentNode) {
                                if (content.length === 1 && node.widget.id === widgetNode.widget.id) {
                                    var prop = {
                                        receivedNode: nodeToInsert,
                                        caret: caretPoint.clone()
                                    };
                                    if (triggerDefaultPreventableEvent(widgetNode.widget, 'receive', null, prop)) {
                                        caretPoint = currentSelection.clone();
                                        hasInsertedBlock = true;
                                        return;
                                    }
                                }
                                if (!widgetAllowed(node.widget.id, widgetNode)) {
                                    nodeToInsert = createTextNode(node.widget.id === WIDGET_UNKNOWN ? collapseWS(trim(nodeToInsert.textContent)) : extractText(nodeToInsert));
                                    node = new TyperNode(typer, NODE_INLINE, nodeToInsert);
                                    break;
                                }
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
                                incompatParagraph = !textOnly && !forcedInline && is(caretNode, NODE_PARAGRAPH) && !sameElementSpec(node.element, caretNode.element) && !!trim(nodeToInsert.textContent);
                                needSplit = !paragraphAsInline || (incompatParagraph && !!trim(createRange(createRange(caretNode.element, true), createRange(caretPoint))));
                                paragraphAsInline = !incompatParagraph;
                                insertAsInline = insertAsInline && paragraphAsInline;
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
                                    $(cur1.element.childNodes).insertBefore(cur1.element);
                                    removeNode(cur1.element);
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
                                var textNode = $(createTextNode()).insertAfter(lastNode)[0];
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
                            if (is(caretNode, NODE_ANY_BLOCK_EDITABLE) && !is(caretNode.parentNode, NODE_ANY_BLOCK_EDITABLE)) {
                                $(nodeToInsert).appendTo(caretNode.element);
                            } else {
                                $(nodeToInsert).insertBefore(caretNode.element);
                            }
                            insertAsInline = !!is(node, NODE_ANY_ALLOWTEXT | NODE_ANY_INLINE);
                            paragraphAsInline = incompatParagraph || !insertAsInline;
                            caretPoint.moveTo(lastNode, paragraphAsInline ? false : -0);
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
                iterator = new TyperDOMNodeIterator((is(content, TyperSelection) || new TyperSelection(typer, range)).createTreeWalker(-1), 5, function (v) {
                    return rangeIntersects(range, createRange(v, 'contents')) ? 1 : 2;
                });
            }

            var lastNode, textTransform, handler, text = '', innerText = '';
            iterate(iterator, function (v) {
                var node = (doc || typer).getNode(v);
                handler = widgetOptions[node.widget.id].text;
                if (node !== lastNode) {
                    if (lastNode) {
                        text += transformText(innerText, textTransform);
                        innerText = '';
                        if (is(lastNode, NODE_ANY_BLOCK) && is(node, NODE_ANY_BLOCK) && text.slice(-2) !== '\n\n') {
                            text += '\n\n';
                        }
                        if (node.widget !== lastNode.widget && handler) {
                            text += handler(node.widget);
                        }
                    }
                    lastNode = node;
                    textTransform = $.css(node.element, 'text-transform');
                }
                if (is(node, NODE_ANY_ALLOWTEXT) && !handler) {
                    if (isText(v)) {
                        var value = v.data;
                        if (v === range.endContainer) {
                            value = value.slice(0, range.endOffset);
                        }
                        if (v === range.startContainer) {
                            value = value.slice(range.startOffset);
                        }
                        innerText += value.replace(' ', '\u00a0');
                    } else if (isBR(v)) {
                        innerText += '\n';
                    }
                }
            });
            text += handler ? handler(lastNode.widget) : transformText(innerText, textTransform);
            return trim(text).replace(/\u00a0/g, ' ');
        }

        function initUndoable() {
            var snapshots = [];
            var currentIndex = 0;
            var suppressUntil = 0;
            var activeWidget;
            var timeout;

            function triggerStateChange() {
                var widget = currentSelection.focusNode.widget;
                if (activeWidget !== widget) {
                    if (activeWidget) {
                        triggerEvent(activeWidget, 'focusout');
                    }
                    activeWidget = widget;
                    triggerEvent(activeWidget, 'focusin');
                }
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
                var value = undoable.getValue();
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
                triggerStateChange();
                clearTimeout(timeout);
            }

            function applySnapshot(state) {
                $self.html(state.html);
                restoreCaret(currentSelection, state.basePos);
                restoreCaret(currentSelection.extendCaret, state.extendPos);
                triggerStateChange();
                clearTimeout(timeout);
            }

            extend(undoable, {
                getValue: function () {
                    return trim(topElement.innerHTML.replace(/\s+style(?:="[^"]*")?|\u200b+(?!<\/)|(^|[^>])\u200b+/g, '$1'));
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
                    var cur = +new Date();
                    clearTimeout(timeout);
                    if (ms === true) {
                        takeSnapshot();
                    } else {
                        suppressUntil = Math.max(suppressUntil, cur + (ms || 0));
                        timeout = setTimeout(takeSnapshot, suppressUntil - cur);
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
            var composition;
            var modifierCount;
            var modifiedKeyCode;
            var touchObj;

            function getEventName(e, suffix) {
                var mod = ((e.ctrlKey || e.metaKey) ? 'Ctrl' : '') + (e.altKey ? 'Alt' : '') + (e.shiftKey ? 'Shift' : '');
                return mod ? lowfirst(mod + capfirst(suffix)) : suffix;
            }

            function updateFromNativeInput() {
                var activeRange = getActiveRange(topElement);
                if (!userFocus.has(typer) && activeRange && !rangeEquals(activeRange, createRange(currentSelection))) {
                    undoable.snapshot(200);
                    currentSelection.select(activeRange);
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

            function handleClick(e, point, eventName) {
                var node = typer.getNode(e.target);
                var props = {
                    clientX: (point || e).clientX,
                    clientY: (point || e).clientY,
                    target: e.target
                };
                if (is(node, NODE_WIDGET | NODE_INLINE_WIDGET)) {
                    currentSelection.select(node.widget.element);
                } else {
                    currentSelection.moveToPoint(props.clientX, props.clientY);
                }
                currentSelection.focus();
                undoable.snapshot();
                triggerEvent(is(node, NODE_WIDGET | NODE_INLINE_WIDGET) ? node.widget : EVENT_STATIC, getEventName(e, eventName || e.type), null, props);
            }

            function handleTextInput(inputText) {
                setEventSource('input', typer);
                if (inputText && (triggerDefaultPreventableEvent(currentSelection.focusNode.widget, 'textInput', inputText) || triggerDefaultPreventableEvent(EVENT_STATIC, 'textInput', inputText))) {
                    return;
                }
                if (!currentSelection.startTextNode || !currentSelection.isCaret) {
                    insertContents(currentSelection, inputText);
                } else if (inputText) {
                    codeUpdate(function () {
                        var curTextNode = currentSelection.startTextNode;
                        curTextNode.data = curTextNode.data.substr(0, currentSelection.startOffset) + inputText + curTextNode.data.slice(currentSelection.startOffset);
                        normalizeWhitespace(currentSelection.startNode.element);
                        currentSelection.moveToText(curTextNode, currentSelection.startOffset + inputText.length);
                        undoable.snapshot(200);
                    });
                }
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
                        handleTextInput(textContent);
                    }
                }
            }

            $self.on('mousedown', function (e) {
                if (e.which === 1) {
                    var pointerMoved;
                    var promise = draggable(e, function (x, y) {
                        pointerMoved = true;
                        undoable.snapshot(200);
                        currentSelection.extendCaret.moveToPoint(x, y);
                    });
                    promise.done(function () {
                        if (!pointerMoved) {
                            handleClick(e, null, 'click');
                        }
                    });
                    (e.shiftKey ? currentSelection.extendCaret : currentSelection).moveToPoint(e.clientX, e.clientY);
                }
                currentSelection.focus();
            });

            $self.on('compositionstart compositionend', function (e) {
                var previous = composition;
                var range = getActiveRange(topElement);
                var node = range.startContainer;
                var offset = range.startOffset;
                if (isElm(node)) {
                    node = node.childNodes[offset] || node.lastChild;
                    offset = node.length;
                }
                composition = e.type.slice(-1) === 't' && {};
                muteChanges = !!composition;
                if (composition) {
                    composition.node = node;
                    composition.offset = offset;
                } else {
                    var text = e.originalEvent.data || previous.node.data.slice(previous.offset - offset);
                    createRange(node, offset - text.length, node, offset).deleteContents();
                    currentSelection.select(node, offset - text.length);
                    handleTextInput(text);
                }
            });

            $self.on('keydown keyup', function (e) {
                if (!composition) {
                    var isModifierKey = ($.inArray(e.keyCode, [16, 17, 18, 91, 93]) >= 0);
                    if (e.type === 'keydown') {
                        var isSpecialKey = !isModifierKey && (KEYNAMES[e.keyCode] || '').length > 1;
                        modifierCount = e.ctrlKey + e.shiftKey + e.altKey + e.metaKey + !isModifierKey;
                        modifierCount *= isSpecialKey || ((modifierCount > 2 || (modifierCount > 1 && !e.shiftKey)) && !isModifierKey);
                        modifiedKeyCode = e.keyCode;
                        if (modifierCount) {
                            var keyEventName = getEventName(e, KEYNAMES[modifiedKeyCode] || e.key);
                            if (triggerEvent(EVENT_HANDLER, keyEventName)) {
                                e.preventDefault();
                            }
                            if (triggerDefaultPreventableEvent(EVENT_ALL, 'keystroke', keyEventName, e) || /ctrl(?![acfnprstvwx]|f5|shift[nt]$)|enter/i.test(keyEventName)) {
                                e.preventDefault();
                            }
                        }
                    } else if (e.keyCode === modifiedKeyCode || isModifierKey) {
                        modifierCount--;
                    }
                }
            });

            $self.on('keypress beforeinput', function (e) {
                if (!composition && !modifierCount && (e.type === 'beforeinput' || e.originalEvent.synthetic || !('onbeforeinput' in topElement))) {
                    handleTextInput(e.originalEvent.data || e.char || e.key || String.fromCharCode(e.charCode));
                    e.preventDefault();
                }
            });

            $self.on('cut copy', function (e) {
                var clipboardData = e.originalEvent.clipboardData || window.clipboardData;
                setEventSource(e.type, typer);
                clipboard.content = extractContents(currentSelection, e.type);
                clipboard.textContent = extractText(clipboard.content);
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
                    setTimeout(function () {
                        currentSelection.select(selection);
                    });
                }
            });

            $self.on('drop', function (e) {
                setEventSource('drop', typer);
                if (currentSelection.moveToPoint(e.clientX, e.clientY)) {
                    handleDataTransfer(e.originalEvent.dataTransfer);
                }
                currentSelection.focus();
                e.preventDefault();
            });

            $self.on('touchstart touchmove touchend', function (e) {
                if (e.type === 'touchend' && touchObj) {
                    handleClick(e, touchObj, 'click');
                }
                var touches = e.originalEvent.touches || e;
                touchObj = e.type === 'touchstart' && !touches[1] && touches[0];
            });

            $self.on('contextmenu', function (e) {
                var caret = new TyperCaret(typer);
                caret.moveToPoint(e.clientX, e.clientY);
                if (currentSelection.isCaret || !rangeIntersects(currentSelection, caret)) {
                    currentSelection.select(caret);
                }
            });

            $self.on('dblclick', function (e) {
                handleClick(e);
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
                    currentSelection.focus();
                    triggerEvent(EVENT_ALL, 'focusin');
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
            extend(widgetOptions[WIDGET_CORE], {
                dblclick: function (e) {
                    currentSelection.select('word');
                },
                keystroke: function (e) {
                    if (!e.isDefaultPrevented() && (e.data in defaultKeystroke)) {
                        e.preventDefault();
                        defaultKeystroke[e.data](e);
                    }
                }
            });
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
        if (IS_IOS) {
            // remove formatting options from iOS popout
            $self.css('-webkit-user-modify', 'read-write-plaintext-only');
        }

        extend(typer, undoable, createTyperDocument(topElement, true), {
            element: topElement,
            hasCommand: function (command) {
                return !!findWidgetWithCommand(command);
            },
            focused: function (strict) {
                return typerFocused && (!strict || containsOrEquals(topElement, document.activeElement));
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
                var handler = (widgetOptions[name] || '').create;
                if (isFunction(handler)) {
                    handler.call(typer, this, options);
                }
            },
            removeWidget: function (widget) {
                var handler = widgetOptions[widget.id].remove;
                if (isFunction(handler)) {
                    handler.call(typer, new TyperTransaction(widget));
                } else if (handler === 'keepText') {
                    var textContent = extractText(widget.element);
                    insertContents(createRange(widget.element, true), textContent);
                    removeNode(widget.element);
                } else {
                    insertContents(createRange(widget.element), '');
                }
            }
        });

        normalize();
        currentSelection = new TyperSelection(typer, createRange(topElement, 0));
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
        setTimeoutOnce: setTimeoutOnce,
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
        mergeRect: mergeRect,
        getRect: getRect,
        getRects: getRects,
        getAbstractSide: getAbstractSide,
        elementFromPoint: elementFromPoint,
        draggable: draggable,
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
        createTreeWalker: function (root, whatToShow, filter) {
            return new TyperTreeWalker(root || this.rootNode, whatToShow, filter);
        },
        nodeFromPoint: function (x, y, whatToShow) {
            var element = elementFromPoint(x, y, this.element);
            if (element) {
                var node = this.getNode(element);
                if (is(node, NODE_EDITABLE)) {
                    var mode = getWritingMode(element);
                    var point = getAbstractRect(toPlainRect(x, y), mode);
                    node = any(node.childNodes, function (v) {
                        var rect = getAbstractRect(getRect(v.element, true), mode);
                        return rect.top <= point.top && rect.bottom >= point.top;
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
            if (!treeWalkerNodeAccepted(iterator, node, true)) {
                return treeWalkerAcceptNode.returnValue;
            }
            if ((isText(v) || isBR(v)) && !is(node, NODE_ANY_ALLOWTEXT)) {
                return 2;
            }
            return acceptNode(inst, v) | 1;
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
        var d = selectionCache.get(inst).d;
        var defaultFilter = function (v) {
            return !rangeIntersects(v.element, range) ? 2 : 1;
        };
        return new TyperTreeWalker(inst.focusNode, whatToShow & ~NODE_SHOW_HIDDEN, combineNodeFilters(defaultFilter, d && d.acceptNode && d.acceptNode.bind(d), filter));
    }

    function selectionIterateTextNodes(inst) {
        var iterator = new TyperDOMNodeIterator(selectionCreateTreeWalker(inst, NODE_ANY_ALLOWTEXT), 4);
        iterator.currentNode = inst.startTextNode || inst.startElement;
        if (inst.startOffset === (inst.startTextNode || '').length) {
            iterator.nextNode();
        }
        return iterateToArray(iterator, null, null, function (v) {
            return comparePosition(v, inst.endTextNode || inst.endElement) <= (inst.endOffset !== 0 ? 0 : -1);
        });
    }

    function selectionSplitText(inst) {
        var p1 = inst.getCaret('start');
        var p2 = inst.getCaret('end');
        if (p2.textNode && !isTextNodeEnd(p2.textNode, p2.offset, 1)) {
            p2.textNode.splitText(p2.offset);
        }
        if (p1.textNode && !isTextNodeEnd(p1.textNode, p1.offset, -1)) {
            caretSetPositionRaw(p1, p1.node, p1.element, p1.textNode.splitText(p1.offset), 0);
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
        var cache = selectionCache.get(inst);
        cache.d = null;
        cache.m = 0;
        inst.timestamp = performance.now();
        inst.direction = compareRangePosition(inst.extendCaret.getRange(), inst.baseCaret.getRange()) || 0;
        inst.isCaret = !inst.direction;
        for (var i = 0, p1 = inst.getCaret('start'), p2 = inst.getCaret('end'); i < 4; i++) {
            inst[selectionUpdate.NAMES[i + 4]] = p1[selectionUpdate.NAMES[i]];
            inst[selectionUpdate.NAMES[i + 8]] = p2[selectionUpdate.NAMES[i]];
        }
        var node = inst.typer.getNode(getCommonAncestor(inst.baseCaret.element, inst.extendCaret.element));
        inst.focusNode = closest(node, NODE_WIDGET | NODE_INLINE_WIDGET | NODE_ANY_BLOCK_EDITABLE | NODE_INLINE_EDITABLE);
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
            for (var node = this.focusNode; node.widget.id !== WIDGET_ROOT; node = node.parentNode) {
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
            return iterateToArray(selectionCreateTreeWalker(self, NODE_PARAGRAPH), function (v) {
                return v.element;
            });
        },
        getSelectedElements: function () {
            var self = this;
            if (self.isCaret) {
                return [self.startElement];
            }
            return $(selectionIterateTextNodes(self)).parent().get();
        },
        getSelectedText: function () {
            return this.typer.extractText(this);
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
            var result;
            selectionAtomic(function () {
                if (startNode === 'word') {
                    result = self.getCaret('start').moveByWord(-1) + self.getCaret('end').moveByWord(1) > 0;
                } else {
                    var range = createRange(startNode, startOffset, endNode, endOffset);
                    result = self.baseCaret.moveTo(range, true) + self.extendCaret.moveTo(range, false) > 0;
                }
            });
            if (startNode.acceptNode) {
                selectionCache.get(self).d = startNode;
            }
            return result;
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
            selectionCache.get(inst).d = selectionCache.get(self).d;
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
                return TyperCaret.prototype[v].apply(self.baseCaret, arguments) + self.collapse('base') > 0;
            }, arguments);
        };
    });
    $.each('getWidgets getParagraphElements getSelectedElements getSelectedText getSelectedTextNodes'.split(' '), function (i, v) {
        var fn = TyperSelection.prototype[v];
        TyperSelection.prototype[v] = function () {
            var cache = selectionCache.get(this);
            if (!(cache.m & (1 << i))) {
                cache[v] = cache.d && cache.d[v] ? cache.d[v](this) : fn.apply(this);
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
                var replace = {
                    node: inst.element
                };
                inst.typer.getNode(node);
                for (; !containsOrEquals(root, replace.node) && detachedElements.has(replace.node); replace = detachedElements.get(replace.node));
                inst.moveTo(replace.node, replace.offset);
            }
        }
        return inst;
    }

    function caretSetPositionRaw(inst, node, element, textNode, offset, beforeSoftBreak) {
        var oldNode = inst.textNode || inst.element;
        var oldOffset = inst.offset;
        inst.node = node;
        inst.element = element;
        inst.textNode = textNode || null;
        inst.offset = offset;
        inst.wholeTextOffset = (textNode ? inst.offset : 0) + getWholeTextOffset(node, textNode || element);
        inst.beforeSoftBreak = !!beforeSoftBreak;
        var updated = oldNode !== (textNode || element) || oldOffset !== offset;
        if (updated && inst.selection) {
            selectionUpdate(inst.selection);
        }
        return updated;
    }

    function caretSetPosition(inst, element, offset, beforeSoftBreak) {
        var textNode, end;
        if (!isBR(element)) {
            if (element.firstChild) {
                end = offset === element.childNodes.length;
                element = element.childNodes[offset] || element.lastChild;
                offset = end ? element.length : 0;
            }
            textNode = isText(element);
        }
        var node = inst.typer.getNode(element);
        if (is(node, NODE_WIDGET | NODE_INLINE_WIDGET)) {
            element = node.element;
            textNode = null;
        }
        if (!is(node, NODE_ANY_ALLOWTEXT | NODE_WIDGET | NODE_INLINE_WIDGET)) {
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
        if (textNode && !beforeSoftBreak) {
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
        return caretSetPositionRaw(inst, closest(node, NODE_ANY_BLOCK), textNode ? textNode.parentNode : node.element, textNode, textNode ? offset : !end, beforeSoftBreak);
    }

    function caretRectFromPosition(node, offset, beforeSoftBreak, visual) {
        var mode = getWritingMode(node);
        var invert = offset === node.length || (!!beforeSoftBreak && offset > 0);
        var baseRTL = !!(mode & 2);
        var ch = node.data.charAt(offset - invert);

        if (isRTL(ch) !== baseRTL && $.css(node.parentNode, 'unicode-bidi').slice(-8) !== 'override') {
            // bidi paragraph are isolated by block boundaries or boxes styled with isolate or isolate-override
            var root = node.parentNode;
            for (; $.css(root, 'display') === 'inline' && $.css(root, 'unicode-bidi').slice(0, 7) !== 'isolate'; root = root.parentNode);

            // only check adjacent directionality if there is strongly trans-directioned character
            if ((baseRTL ? RE_LTR : RE_RTL).test(root.textContent)) {
                var checkAdjacent = function (node, offset, direction) {
                    var iterator = document.createTreeWalker(root, 5, function (v) {
                        if (isElm(v) && !isBR(v)) {
                            // any non-inline and replaced elements are considered neutral
                            if ($.css(v, 'display') !== 'inline' || is(v, 'audio,canvas,embed,iframe,img,input,object,video')) {
                                return 2;
                            }
                            switch ($.css(v, 'unicode-bidi')) {
                                case 'normal':
                                case 'plaintext':
                                    return 3;
                                case 'isolate':
                                case 'isolate-override':
                                    // isolated bidi sequences are considered neutral
                                    return 2;
                            }
                        }
                        return 1;
                    }, false);
                    iterator.currentNode = node;
                    while (isText(node)) {
                        while (offset !== getOffset(node, 0 * -direction)) {
                            offset += direction;
                            if (/(\S)/.test(node.data.charAt(offset))) {
                                return isRTL(RegExp.$1, baseRTL);
                            }
                        }
                        node = next(iterator, direction);
                        offset = direction > 0 ? -1 : (node || '').length;
                    }
                    return !node || isBR(node) ? baseRTL : $.css(node, 'direction') === 'rtl';
                };
                var prevRTL = checkAdjacent(node, offset - invert, -1);
                var nextRTL = checkAdjacent(node, offset - invert, 1);
                var curRTL = prevRTL === nextRTL && /\s/.test(ch) ? prevRTL : isRTL(ch, baseRTL);
                if (!invert && curRTL !== baseRTL && prevRTL === baseRTL) {
                    // sticks at the end of cis-directioned text sequence at cis/trans boundary
                    invert = true;
                    curRTL = prevRTL;
                }
                mode = (mode & ~2) | (curRTL ? 2 : 0);
            }
        }

        var rect = getRects(createRange(node, offset - invert, node, offset + !invert))[0] || toPlainRect(0, 0);
        if (visual && invert && /\s/.test(node.data.charAt(offset - invert)) && !getAbstractRect(rect, mode).width) {
            // Firefox returns zero-width rect when whitespace character acts as soft paragraph break
            rect[getAbstractSide(3, mode)] += getFontMetric(node).wsWidth;
        }
        return rect.collapse(getAbstractSide(2 | invert, mode));
    }

    function caretMoveToPoint(inst, textNode, point, dirX, dirY) {
        var container = closest(inst.typer.getNode(textNode), NODE_ANY_BLOCK);
        var mode = getWritingMode(textNode);
        var mCacheElm = [];
        var mCacheProp = [];
        var lastDist = -Infinity;
        var newPoint;

        function getTextProperties(elm) {
            var index = mCacheElm.indexOf(elm);
            if (index >= 0) {
                return mCacheProp[index];
            }
            var style = getComputedStyle(elm);
            var container = elm;
            for (; $.css(container, 'display') === 'inline'; container = container.parentNode);

            var obj = mCacheProp[mCacheElm.push(elm) - 1] = getFontMetric(elm);
            obj.lineHeight = style.lineHeight.slice(-2) === 'px' ? parseFloat(style.lineHeight) : (style.lineHeight === 'normal' ? 1.15 : style.lineHeight) * obj.fontSize;
            obj.verticalAlign = style.verticalAlign;
            obj.baselineOffset = obj.baseline - obj.height + getBaselineOffset(elm, container);
            return obj;
        }

        function getBaselineOffset(elm, parent) {
            if (elm === parent) {
                return 0;
            }
            if (elm.parentNode !== parent) {
                return getBaselineOffset(elm, elm.parentNode) + getBaselineOffset(elm.parentNode, parent);
            }
            var m = getTextProperties(elm);
            switch (m.verticalAlign) {
                case 'baseline':
                    return 0;
                case 'middle':
                    var m1 = getTextProperties(elm.parentNode);
                    return -m.height / 2 + (m1.baseline - m1.middle);
                case 'top':
                case 'bottom':
                    return NaN;
                case 'text-top':
                    return (m.lineHeight - m.height) / 2;
                case 'text-bottom':
                    return (m.lineHeight + m.height) / 2 - getTextProperties(elm.parentNode).height;
                case 'sub':
                    return -0.21 * m.fontSize;
                case 'super':
                    return 0.34 * m.fontSize;
            }
            return isNaN(m.verticalAlign) ? parseFloat(m.verticalAlign) / 100 * m.lineHeight : +m.verticalAlign || 0;
        }

        function checkRect(rect) {
            var dist, newX;
            if (dirX) {
                newX = dirX > 0 ? rect.right : rect.left;
                dist = (newX - point.left) * dirX;
            } else {
                dist = Math.min(0, rect.right - point.left) || Math.max(0, rect.left - point.left);
                newX = point.left + dist;
            }
            if (dirX ? dist > lastDist : Math.abs(dist) < Math.abs(lastDist)) {
                lastDist = dist;
                textNode = rect.node;
                newPoint = getAbstractRect(toPlainRect(newX, rect.centerY), -mode);
            }
        }

        function findNearsetPoint(container, textNode, dir, scanCount, untilY) {
            var iterator = new TyperDOMNodeIterator(new TyperTreeWalker(container, NODE_ANY_ALLOWTEXT), 4);
            var prop = dir > 0 ? 'bottom' : 'top';
            var linebox = point;
            var pending = [];
            var baseline;

            if (!isText(textNode)) {
                while (iterator.nextNode() && dir < 0);
                textNode = iterator.currentNode;
                if (!isText(textNode)) {
                    return linebox[prop];
                }
            } else {
                iterator.currentNode = textNode;
            }
            do {
                var m = getTextProperties(textNode.parentNode);
                var rects = getRects(textNode);
                if (dir < 0) {
                    rects.reverse();
                }
                for (var i = 0, len = rects.length; i < len; i++) {
                    var curRect = getAbstractRect(rects[i], mode);
                    var halfLead = (m.lineHeight - curRect.height) >> 1;
                    var curLinebox = toPlainRect(curRect.left, curRect.top - halfLead, curRect.right, curRect.bottom + halfLead);
                    var curBaseline = curRect.bottom + m.baselineOffset;
                    var isSameLine = false;
                    curLinebox.node = textNode;

                    // skip rects until we reach our starting Y-position
                    if (baseline === undefined && curLinebox[prop] * dir < linebox[FLIP_POS[prop]] * dir) {
                        continue;
                    }
                    if (isNaN(baseline) || Math.abs(curBaseline - baseline) < 1 || (curLinebox.top < linebox.bottom && curLinebox.bottom > linebox.top)) {
                        isSameLine = true;
                    } else if (isNaN(curBaseline)) {
                        if (m.verticalAlign === FLIP_POS[prop]) {
                            // we can safely determine if the vertical align is opposite to scanning direction (i.e. top for scanning down)
                            // since it is on the same line iff it overlaps the current line box
                            isSameLine = curLinebox[FLIP_POS[prop]] * dir <= linebox[prop] * dir;
                        } else if (!pending[0] || curLinebox[prop] === pending[0][prop]) {
                            pending.push(curLinebox);
                            continue;
                        } else {
                            // not aligning with previous box with the same vertical align
                            // push previous pending box into result if it aligns with the current line box edge
                            var arr = pending.splice(0, pending.length, curLinebox);
                            if (arr[0][prop] === linebox[prop]) {
                                arr.forEach(checkRect);
                            }
                        }
                    }
                    if (baseline === undefined || !isNaN(curBaseline)) {
                        baseline = curBaseline;
                    }
                    if ((!isSameLine && !--scanCount) || baseline * dir > untilY * dir) {
                        return linebox[prop];
                    }
                    linebox = mergeRect(linebox, curLinebox);
                    if (scanCount === 1) {
                        pending.splice(0).forEach(checkRect);
                        checkRect(curLinebox);
                    }
                }
            } while ((textNode = next(iterator, dir)));
            return linebox[prop];
        }

        function findOffset(textNode, newPoint, mode, beforeSoftBreak) {
            var b0 = 0;
            var b1 = textNode.length;

            function distanceFromCharacter(index) {
                // IE11 (update version 11.0.38) crashes with memory access violation when
                // Range.getClientRects() is called on a whitespace neignboring a non-static positioned element
                // https://jsfiddle.net/b6q4p664/
                // while (/[^\S\u00a0]/.test(node.data.charAt(index)) && --index);
                var rect = getAbstractRect(caretRectFromPosition(textNode, index, beforeSoftBreak), mode);
                return ((rect.centerY - newPoint.centerY) | 0) * Infinity || ((rect.left - newPoint.left) | 0);
            }

            // determine directionality at the given point if there is characters with different directionality
            if ($.css(textNode.parentNode, 'unicode-bidi').slice(-8) !== 'override' && (mode & 2 ? RE_LTR : RE_RTL).test(textNode.data)) {
                var re = mode & 2 ? [RE_LTR, RE_N_RTL] : [RE_RTL, RE_N_LTR];
                var i = 0, containsPoint;
                b1 = -1;
                while (!containsPoint && re[++i & 1].test(textNode.data.slice(b1 + 1))) {
                    b0 = Math.max(0, b1);
                    b1 = textNode.data.indexOf(RegExp.$1, b1 + 1);
                    containsPoint = any(getRects(createRange(textNode, b0, textNode, b1)), function (v) {
                        // do not use pointInRect as we need to match zero-width rect
                        return v.top <= newPoint.top && v.bottom >= newPoint.top && v.left <= newPoint.left && v.right >= newPoint.left;
                    });
                }
                mode ^= (i & 1) ? 2 : 0;
                if (!containsPoint) {
                    b1 = textNode.length;
                }
            }
            newPoint = getAbstractRect(newPoint, mode);
            while (b1 - b0 > 1) {
                var mid = (b1 + b0) >> 1;
                var p = distanceFromCharacter(mid) <= 0;
                b0 = p ? mid : b0;
                b1 = p ? b1 : mid;
            }
            return Math.abs(distanceFromCharacter(b0)) < Math.abs(distanceFromCharacter(b1)) ? b0 : b1;
        }

        point = getAbstractRect(toPlainRect(point.centerX, point.centerY), mode);
        if (inst.softPoint) {
            point.left = point.right = getAbstractRect(inst.softPoint, mode).left;
        }
        if (dirY) {
            var startY = findNearsetPoint(container, textNode, dirY, 2);
            if (!newPoint) {
                var iterator = new TyperTreeWalker(inst.typer.rootNode, NODE_ANY_BLOCK);
                iterator.currentNode = container;
                var untilY;
                while ((container = next(iterator, dirY))) {
                    var containerRect = getAbstractRect(getRect(container.element), mode);
                    var prop = dirY > 0 ? 'bottom' : 'top';
                    if (containerRect[FLIP_POS[prop]] * dirY < startY * dirY) {
                        continue;
                    }
                    if (containerRect[FLIP_POS[prop]] * dirY >= untilY * dirY) {
                        break;
                    }
                    findNearsetPoint(container, null, dirY, 1, untilY);
                    untilY = containerRect[prop];
                }
                if (!newPoint && untilY !== undefined) {
                    return caretSetPosition(inst, iterator.currentNode.element, 0);
                }
            }
        } else {
            findNearsetPoint(container, textNode, (dirX || 1) * (mode & 2 ? -1 : 1), 1);
        }
        if (newPoint) {
            var beforeSoftBreak = dirX > 0 || lastDist < 0;
            var offset = findOffset(textNode, newPoint, mode, beforeSoftBreak);
            inst.softPoint = dirY ? getAbstractRect(toPlainRect(point.left, getAbstractRect(newPoint, mode).centerY), -mode) : null;
            return caretSetPosition(inst, textNode, offset, beforeSoftBreak);
        }
        return false;
    }

    definePrototype(TyperCaret, {
        getRect: function () {
            var self = caretEnsureState(this);
            if (!self.textNode) {
                var elmRect = getRect(self.element);
                return elmRect.collapse(getAbstractSide(2 | !self.offset, getWritingMode(self.element)));
            }
            return caretRectFromPosition(self.textNode, self.offset, self.beforeSoftBreak, true);
        },
        getRange: function () {
            var self = caretEnsureState(this);
            var node = self.textNode || self.element;
            var offset = self.offset;
            if (node === self.typer.element) {
                // avoid creating range that is outside the content editable area
                return createRange(node, offset ? 0 : -0);
            }
            if (offset % node.length === 0) {
                // set the created range before or after the text node
                // to reduce chances of empty text node created during manipulation
                return createRange(node, !offset);
            }
            return createRange(node, offset);
        },
        clone: function () {
            var self = caretEnsureState(this);
            return extend(new TyperCaret(self.typer), self);
        },
        moveTo: function (node, offset) {
            if (is(node, TyperCaret)) {
                return caretSetPositionRaw(this, node.node, node.element, node.textNode, node.offset, node.beforeSoftBreak);
            }
            var range = createRange(node, offset);
            if (range && containsOrEquals(this.typer.element, range.startContainer)) {
                return caretSetPosition(this, range.startContainer, range.startOffset);
            }
            return false;
        },
        moveToPoint: function (x, y) {
            var self = this;
            var node = self.typer.nodeFromPoint(x, y);
            return !!node && caretMoveToPoint(self, node.element, toPlainRect(x, y));
        },
        moveToText: function (node, offset) {
            if (node.nodeType !== 3) {
                var iterator = new TyperDOMNodeIterator(new TyperTreeWalker(this.typer.getNode(node), NODE_ANY_ALLOWTEXT), 4);
                if (1 / offset > 0) {
                    for (; offset >= 0 && iterator.nextNode(); offset -= iterator.currentNode.length);
                } else {
                    while (iterator.nextNode());
                }
                node = iterator.currentNode;
                offset = node && Math.min(offset + node.length, node.length);
            }
            return !!node && caretSetPosition(this, node, getOffset(node, offset));
        },
        moveToLineEnd: function (direction) {
            var self = caretEnsureState(this);
            return caretMoveToPoint(self, self.textNode || self.element, self.getRect(), direction, 0);
        },
        moveByLine: function (direction) {
            var self = this;
            return caretMoveToPoint(self, self.textNode || self.element, self.getRect(), 0, direction) || self.moveToLineEnd(direction);
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
            while ((node = next(iterator, direction))) {
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
            var mode = getWritingMode(self.element);
            var rect = getAbstractRect(self, mode);
            var iterator = caretTextNodeIterator(self, null, 5);
            var node = isText(iterator.currentNode);
            var offset = self.offset;
            var overBr = false;
            while (true) {
                if (!node || offset === getOffset(node, 0 * -direction)) {
                    while (!(node = next(iterator, direction)) || !node.length) {
                        if (!node) {
                            return false;
                        }
                        if (is(self.typer.getNode(node), NODE_WIDGET) && !containsOrEquals(node, self.element)) {
                            return self.moveToText(node, 0 * direction) || self.moveTo(node, direction < 0);
                        }
                        overBr |= !!isBR(node);
                    }
                    offset = (direction < 0 ? node.length : 0) + ((overBr || !containsOrEquals(self.node.element, node)) && -direction);
                }
                offset += direction;
                if (!RE_SKIP.test(node.data.charAt(offset))) {
                    var newRect = getAbstractRect(caretRectFromPosition(node, offset), mode);
                    if (!rectEquals(rect, newRect)) {
                        return caretSetPosition(self, node, offset, direction > 0 && rect.centerY !== newRect.centerY);
                    }
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

    definePrototype(TyperRect, {
        get width() {
            return this.right - this.left;
        },
        get height() {
            return this.bottom - this.top;
        },
        get centerX() {
            return (this.left + this.right) / 2;
        },
        get centerY() {
            return (this.top + this.bottom) / 2;
        },
        collapse: function (side) {
            var rect = this;
            return side === 'left' || side === 'right' ? toPlainRect(rect[side], rect.top, rect[side], rect.bottom) : toPlainRect(rect.left, rect[side], rect.right, rect[side]);
        },
        translate: function (x, y) {
            var self = this;
            return toPlainRect(self.left + x, self.top + y, self.right + x, self.bottom + y);
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

        // detect native scrollbar size
        // height being picked because scrollbar may not be shown if container is too short
        var $d = $('<div style="overflow:scroll;height:80px"><div style="height:100px"></div></div>').appendTo(document.body);
        scrollbarWidth = $d.width() - $d.children().width();
        $d.remove();
    });

}(jQuery, document.documentElement, Array.prototype));

// source: src/presets.js
(function ($, Typer) {
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

}(jQuery, Typer));

// source: src/ui.js
(function ($, Typer) {
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
    var getRect = Typer.getRect;
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

    function cssFromRect(rect, parent) {
        var style = cssFromPoint(rect, null, parent);
        style.width = (rect.width | 0) + 'px';
        style.height = (rect.height | 0) + 'px';
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
        var elmRect = getRect(elm, true);
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

        var elmRectNoMargin = getRect(elm);
        Object.keys(FLIP_POS).forEach(function (v) {
            margin[v] = elmRect[v] - elmRectNoMargin[v];
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
            defineProperty(inst, '_m', 'c', 0);
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
            $(element).find('*').addBack().filter('[x\\:bind]').each(function (i, v) {
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

    function ensureFlag(control, flag, callback) {
        var mask = flag << 8;
        if (!(control._m & mask)) {
            control._m |= mask | (callback() * flag);
        }
        return (control._m & flag) > 0;
    }

    function isEnabled(control) {
        return ensureFlag(control, 0x01, function () {
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
            if (control.requireChildControls === true && (!control.controls.some(isEnabled) || control.controls.every(isHidden))) {
                return false;
            }
            return control.enabled !== false && callFunction(control, 'enabled') !== false;
        });
    }

    function isActive(control) {
        return ensureFlag(control, 0x02, function () {
            return control.active === true || !!callFunction(control, 'active');
        });
    }

    function isHidden(control) {
        return ensureFlag(control, 0x04, function () {
            return (!isEnabled(control) && control.hiddenWhenDisabled) || control.visible === false || callFunction(control, 'visible') === false;
        });
    }

    function updateControl(control) {
        var ui = control.ui;
        var theme = definedThemes[ui.theme];
        control._m = 0;

        var suppressStateChange;
        if (control.requireWidget || control.requireWidgetEnabled) {
            control.widget = ui._widgets[control.requireWidget || control.requireWidgetEnabled] || ui.widget;
            suppressStateChange = control.requireWidget && !control.widget;
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
        control.setState(theme.controlHiddenClass || 'hidden', isHidden(control));
    }

    function executeControlWithFinal(control, callback, optArg) {
        try {
            callback(control, optArg);
            if (executionContext.indexOf(control) > 0) {
                return executionContext[0].promise;
            }
        } finally {
            if (executionContext[0] === control) {
                while ((!executionContext[0].promise || executionContext[0].promise.state() !== 'pending') && executionContext.shift() && executionContext[0]);
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
            if (!containsOrEquals(v, v.parent)) {
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
            control = !control ? this : resolveControlParam(this, control);
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
        visible: function (control) {
            control = resolveControlParam(this, control);
            return control && !isHidden(control);
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
                $(inputOnly ? SELECTOR_INPUT : SELECTOR_FOCUSABLE, element).not(':disabled, :hidden').addBack()[0].focus();
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
                setTimeout(function () {
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
                setTimeout(typerUI.focus, 0, currentDialog.control.element);
            }
        });
        $(window).on('resize scroll orientationchange', function () {
            Typer.setTimeoutOnce(updateSnaps);
        });
        $(document.body).on('mousemove mousewheel keyup touchend', function () {
            Typer.setTimeoutOnce(updateSnaps);
        });
        $(document.body).on('click', 'label', function (e) {
            // IE does not focus on focusable element when clicking containing LABEL element
            $(SELECTOR_FOCUSABLE, e.currentTarget).not(':disabled, :hidden').eq(0).focus();
        });
        $(document.body).on(IS_TOUCH ? 'touchstart' : 'mousedown', function (e) {
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
            $(document.body).on('focusin focusout', function (e) {
                lastActiveElement = e.type === 'focusin' ? e.target : null;
            });
            $(document.body).on('touchend', function (e) {
                if (lastActiveElement && !containsOrEquals(lastActiveElement, e.target)) {
                    lastActiveElement.blur();
                    $(lastActiveElement).trigger($.Event('focusout', {
                        relatedTarget: e.target
                    }));
                }
            });
        }

        function handlePointerEventNone(e) {
            if (window.getComputedStyle(e.target).pointerEvents === 'none') {
                e.stopPropagation();
                var event = document.createEvent('MouseEvent');
                event.initMouseEvent(e.type, e.bubbles, e.cancelable, e.view, e.detail, e.screenX, e.screenY, e.clientX, e.clientY, e.ctrlKey, e.altKey, e.shiftKey, e.metaKey, e.button, e.relatedTarget);
                Typer.elementFromPoint(e.clientX, e.clientY).dispatchEvent(event);
            }
        }

        if (Typer.msie10) {
            $.each('mousedown mouseup mousemove click'.split(' '), function (i, v) {
                document.body.addEventListener(v, handlePointerEventNone, true);
            });
        }

        // helper element for detecting fixed position offset to the client screen
        originDiv = $('<div style="position:fixed;top:0;left:0;">').appendTo(document.body)[0];
    });

}(jQuery, Typer));

// source: src/canvas.js
(function ($, Typer) {
    var root = document.documentElement;
    var getRect = Typer.getRect;

    var container = $('<div style="position:absolute;top:0;left:0;">')[0];
    var handles = new shim.WeakMap();
    var allLayers = {};
    var freeDiv = [];
    var state = {};
    var lastState = {};
    var mousedown = false;
    var activeTyper;
    var activeHandle;
    var hoverNode;
    var oldLayers;
    var newLayers;
    var timeout;

    function TyperCanvas() {
        state.timestamp = activeTyper.getSelection().timestamp;
        state.rect = getRect(activeTyper).translate(root.scrollLeft, root.scrollTop);
        $.extend(this, {
            typer: activeTyper,
            pointerX: state.x || 0,
            pointerY: state.y || 0,
            mousedown: mousedown,
            hoverNode: hoverNode || null,
            activeHandle: activeHandle || null,
            editorReflow: !lastState.rect || !Typer.rectEquals(lastState.rect, state.rect),
            pointerMoved: lastState.x != state.x || lastState.y != state.y,
            selectionChanged: lastState.timestamp !== state.timestamp
        });
        $.extend(lastState, state);
    }

    function TyperCanvasHandle(cursor, done) {
        this.cursor = cursor || 'pointer';
        this.done = done;
    }

    function init() {
        var repl = {
            N: 'typer-visualizer',
            G: 'background',
            S: 'selection',
            X: 'transparent'
        };
        var style = '<style>.has-N{caret-color:X;}.has-N:focus{outline:none;}.has-N::S,.has-N ::S{G:X;}.has-N::-moz-S,.has-N ::-moz-S{G:X;}@keyframes caret{0%{opacity:1;}100%{opacity:0;}}</style>';
        $(document.body).append(style.replace(/\b[A-Z]/g, function (v) {
            return repl[v] || v;
        })).append(container);

        $(container).mousedown(function (e) {
            if (e.buttons & 1) {
                activeHandle = handles.get(e.target);
                Typer.draggable(e, activeTyper.element).always(function () {
                    (activeHandle.done || $.noop).call(activeHandle);
                    activeHandle = null;
                });
                e.preventDefault();
            }
        });
        $(document.body).on('mousedown mousemove mouseup', function (e) {
            state.x = e.clientX;
            state.y = e.clientY;
            hoverNode = activeTyper && activeTyper.nodeFromPoint(state.x, state.y);
            clearTimeout(timeout);
            if (e.type === 'mousemove') {
                timeout = setTimeout(refresh, 0);
            } else {
                mousedown = e.buttons & 1;
                timeout = setTimeout(refresh, 0, true);
            }
        });
        $(window).on('scroll resize orientationchange focus', refresh);
    }

    function computeFillRects(range) {
        var start = Typer.getAbstractSide('inline-start', range.startContainer);
        var end = Typer.getAbstractSide('inline-end', range.startContainer);
        var result = [];
        $.each(Typer.getRects(range), function (i, v) {
            if (Math.abs(v[start] - v[end]) <= 1) {
                v[end] += 5;
            }
            result.forEach(function (prev) {
                if (Math.abs(v.left - prev.right) <= 1) {
                    prev.right = v.left;
                }
                if (Math.abs(v.top - prev.bottom) <= 1) {
                    prev.bottom = v.top;
                }
            });
            result.unshift(v);
        });
        return result;
    }

    function addLayer(name, callback) {
        allLayers[name] = [callback, [], {}, true];
    }

    function addObject(kind, state, rect, css, handle) {
        for (var i = 0, len = oldLayers.length; i < len; i++) {
            if (oldLayers[i].state === state && oldLayers[i].kind === kind) {
                newLayers[newLayers.length] = oldLayers.splice(i, 1)[0];
                return;
            }
        }
        newLayers[newLayers.length] = {
            kind: kind,
            state: state,
            rect: rect || ('top' in state ? state : Typer.getRect),
            css: css,
            handle: handle
        };
    }

    function refresh(force) {
        force = force === true;
        clearTimeout(timeout);
        if (activeTyper && (force || activeTyper.focused(true))) {
            var canvas = new TyperCanvas();
            if (force || canvas.editorReflow || canvas.selectionChanged || canvas.pointerMoved) {
                $.each(allLayers, function (i, v) {
                    newLayers = v[1];
                    oldLayers = newLayers.splice(0);
                    if (v[3] !== false) {
                        v[0].call(null, canvas, v[2]);
                    }
                    oldLayers.forEach(function (v) {
                        freeDiv[freeDiv.length] = $(v.dom).detach().removeAttr('style')[0];
                        handles.delete(v.dom);
                    });
                    newLayers.forEach(function (v) {
                        if (force || !v.dom || canvas.editorReflow || $.isFunction(v.rect)) {
                            var dom = v.dom || (v.dom = $(freeDiv.pop() || document.createElement('div')).appendTo(container)[0]);
                            $(dom).css($.extend({
                                position: 'absolute',
                                cursor: (v.handle || '').cursor,
                                pointerEvents: v.handle ? 'all' : 'none'
                            }, v.css, Typer.ui.cssFromRect('top' in v.rect ? v.rect : v.rect(v.state), container)));
                            handles.set(dom, v.handle);
                        }
                    });
                });
            }
        }
    }

    $.extend(TyperCanvas.prototype, {
        refresh: function () {
            setTimeout(refresh, 0, true);
        },
        toggleLayer: function (name, visible) {
            var needRefresh = false;
            name.split(' ').forEach(function (v) {
                needRefresh |= visible ^ (allLayers[v] || '')[3];
                (allLayers[v] || {})[3] = visible;
            });
            if (needRefresh) {
                setTimeout(refresh, 0, true);
            }
        },
        fill: function (range, color, handle) {
            var style = {};
            style.background = color || 'rgba(0,31,81,0.2)';
            if (range instanceof Node || 'top' in range) {
                addObject('f', range, null, style, handle);
            } else {
                var arr = [];
                Typer.iterate(activeTyper.createSelection(range).createTreeWalker(-1, function (v) {
                    if (Typer.rangeCovers(range, v.element)) {
                        arr[arr.length] = getRect(v);
                        return 2;
                    }
                    if (Typer.is(v, Typer.NODE_ANY_ALLOWTEXT)) {
                        arr.push.apply(arr, computeFillRects(Typer.createRange(range, Typer.createRange(v.element, 'content'))));
                        return 2;
                    }
                    return 1;
                }));
                arr.forEach(function (v) {
                    addObject('f', v, null, style, handle);
                });
            }
        },
        drawCaret: function (caret) {
            addObject('k', caret, null, {
                animation: 'caret 0.5s infinite alternate ease-in',
                outline: '1px solid rgba(0,31,81,0.8)'
            });
        },
        drawBorder: function (element, width, color, lineStyle, inset) {
            var style = {};
            style.border = parseFloat(width) + 'px ' + (lineStyle || 'solid') + ' ' + (color || 'black');
            style.margin = inset ? '0px' : -parseFloat(width) + 'px';
            style.boxSizing = inset ? 'border-box' : 'auto';
            addObject('b', element, null, style);
        },
        drawLine: function (x1, y1, x2, y2, width, color, lineStyle, handle) {
            var dx = x2 - x1;
            var dy = y2 - y1;
            var style = {};
            style.borderTop = parseFloat(width) + 'px ' + (lineStyle || 'solid') + ' ' + (color || 'black');
            style.transformOrigin = '0% 50%';
            style.transform = 'translateY(-50%) rotate(' + Math.atan2(dy, dx) + 'rad)';
            addObject('l', Typer.toPlainRect(x1, y1, x1 + (Math.sqrt(dy * dy + dx * dx)), y1), null, style, handle);
        },
        drawHandle: function (element, pos, size, image, handle) {
            var style = {};
            style.border = '1px solid #999';
            style.background = 'white' + (image ? ' url("' + image + '")' : '');
            size = size || 8;
            addObject('c', element, function () {
                var r = getRect(element);
                var x = Typer.ui.matchWSDelim(pos, 'left right') || 'centerX';
                var y = Typer.ui.matchWSDelim(pos, 'top bottom') || 'centerY';
                r.left -= size;
                r.top -= size;
                return Typer.toPlainRect(r[x], r[y], r[x] + size, r[y] + size);
            }, style, handle);
        }
    });

    addLayer('selection', function (canvas) {
        var selection = canvas.typer.getSelection();
        var startNode = selection.startNode;
        if (selection.isCaret) {
            if ('caretColor' in root.style) {
                canvas.drawCaret(selection.baseCaret);
            }
        } else if (Typer.is(startNode, Typer.NODE_WIDGET) === selection.focusNode) {
            canvas.fill(startNode.element);
        } else {
            canvas.fill(selection.getRange());
        }
    });

    Typer.widgets.visualizer = {
        init: function (e) {
            $(e.typer.element).addClass('has-typer-visualizer');
            if (!init.init) {
                init();
                init.init = true;
            }
        },
        focusin: function (e) {
            activeTyper = e.typer;
            Typer.ui.setZIndex(container, activeTyper.element);
            refresh(true);
        },
        focusout: function (e) {
            activeTyper = null;
            $(container).children().detach();
        },
        contentChange: function (e) {
            refresh(true);
        },
        stateChange: function (e) {
            refresh();
        }
    };

    Typer.defaultOptions.visualizer = true;

    Typer.canvas = {
        addLayer: addLayer,
        handle: function (cursor, done) {
            return new TyperCanvasHandle(cursor, done);
        }
    };

})(jQuery, Typer);

// source: src/extensions/dragwidget.js
(function ($, Typer) {
    var getRect = Typer.getRect;
    var containsOrEquals = Typer.containsOrEquals;
    var activeNode;
    var insertPoint;

    var handle = Typer.canvas.handle('move', function () {
        if (activeNode && insertPoint) {
            activeNode.typer.invoke(function (tx) {
                tx.selection.select(insertPoint);
                tx.insertHtml(activeNode.element);
            });
        }
    });
    Typer.canvas.addLayer('dragWidget', function (canvas) {
        var hoverNode = canvas.hoverNode;
        if (canvas.activeHandle === handle) {
            var node = Typer.closest(hoverNode, Typer.NODE_PARAGRAPH | Typer.NODE_WIDGET);
            insertPoint = null;
            if (node && !containsOrEquals(activeNode, node)) {
                var rectA = getRect(node);
                var rectC = getRect(Typer.closest(node, Typer.NODE_EDITABLE));
                var before = canvas.pointerY < rectA.centerY;
                var nextNode = before ? node.previousSibling : node.nextSibling;
                if (nextNode !== activeNode && canvas.typer.widgetAllowed(activeNode.widget.id, node)) {
                    var y;
                    if (nextNode) {
                        var rectB = getRect(nextNode);
                        y = (rectA.bottom <= rectB.top ? rectA.bottom + rectB.top : rectB.bottom + rectA.top) / 2;
                    } else {
                        y = getRect(node, true)[before ? 'top' : 'bottom'];
                    }
                    canvas.drawLine(rectC.left, y, rectC.right, y, 1, 'red', 'dashed');
                    insertPoint = canvas.typer.createCaret(node.element, before);
                }
            }
            canvas.fill(activeNode.element);
        } else if (hoverNode && (!activeNode || containsOrEquals(activeNode, hoverNode) || !Typer.pointInRect(canvas.pointerX, canvas.pointerY, getRect(activeNode), 10))) {
            activeNode = Typer.closest(hoverNode, Typer.NODE_WIDGET);
        }
        if (activeNode) {
            canvas.drawHandle(activeNode, 'top left', 11, 'data:image/gif;base64,R0lGODlhCwALAKEBAE1PUP///////////yH5BAEKAAIALAAAAAALAAsAAAIUjI8ZoAffDFOzuoexk5zGBUXTlxQAOw==', handle);
        }
    });

})(jQuery, Typer);

// source: src/extensions/formatting.js
(function ($, Typer) {
    var ALIGN_VALUE = {
        justifyLeft: 'left',
        justifyRight: 'right',
        justifyCenter: 'center',
        justifyFull: 'justify'
    };
    var STYLE_TAGNAME = {
        bold: 'b,strong',
        italic: 'i,em',
        underline: 'u',
        strikeThrough: 'strike'
    };
    var STYLE_CHECK = {
        bold: ['fontWeight', 'bold 700'],
        italic: ['fontStyle', 'italic'],
        underline: ['textDecoration', 'underline'],
        strikeThrough: ['textDecoration', 'line-through']
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
            case '-webkit-right':
            case '-webkit-center':
                return textAlign.slice(8);
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

    function replaceElement(oldElement, newElement) {
        newElement = Typer.is(newElement, Node) || createElementWithClassName(newElement);
        return $(newElement).append(oldElement.childNodes).replaceAll(oldElement)[0];
    }

    function applyInlineStyle(tx, wrapElm, unwrapSpec, currentState, styleCheck) {
        var selection = tx.selection;
        var paragraphs = selection.getParagraphElements();
        if (selection.isCaret && !currentState) {
            tx.insertHtml(wrapElm);
            wrapElm.appendChild(Typer.createTextNode());
            selection.moveToText(wrapElm, -0);
        } else {
            var textNodes = selection.getSelectedTextNodes();
            paragraphs.forEach(function (v) {
                if (!styleCheck || !Typer.ui.matchWSDelim(window.getComputedStyle(v)[styleCheck[0]], styleCheck[1])) {
                    if (!currentState) {
                        $(v).find(textNodes).wrap(wrapElm);
                    } else {
                        var $unwrapNodes = $(textNodes, v).parentsUntil(v).filter(unwrapSpec);
                        var $rewrapNodes = $unwrapNodes.contents().filter(function (i, v) {
                            return textNodes.every(function (w) {
                                return !Typer.containsOrEquals(v, w);
                            });
                        });
                        $unwrapNodes.contents().unwrap();
                        $rewrapNodes.wrap(wrapElm);
                    }
                }
            });
            selection.select(textNodes[0], 0, textNodes[textNodes.length - 1], -0);
        }
        $(paragraphs).find(unwrapSpec).filter(':has(' + unwrapSpec + ')').each(function (i, v) {
            $(v).contents().unwrap().filter(function (i, v) {
                return v.nodeType === 3;
            }).wrap(v);
        });
        $(paragraphs).find('span[class=""],span:not([class])').contents().unwrap();
        $(paragraphs).find(unwrapSpec).each(function (i, v) {
            if (Typer.sameElementSpec(v.previousSibling, v)) {
                $(v.childNodes).appendTo(v.previousSibling);
                $(v).remove();
            }
        });
    }

    /* ********************************
     * Commands
     * ********************************/

    function justifyCommand(tx) {
        $(tx.selection.getParagraphElements()).attr('align', ALIGN_VALUE[tx.commandName]);
    }

    function inlineStyleCommand(tx) {
        var kind = tx.commandName;
        applyInlineStyle(tx, createElementWithClassName(STYLE_TAGNAME[kind].split(',')[0]), STYLE_TAGNAME[kind], tx.widget[kind], STYLE_CHECK[kind]);
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
                replaceElement(v, 'li');
                lists.push(list);
            } else if (!$(v.parentNode).filter(filter)[0]) {
                replaceElement(v.parentNode, $(html)[0]);
                lists.push(v.parentNode);
            } else if ($(v).is('li') && $.inArray(v.parentNode, lists) < 0) {
                outdentCommand(tx, [v]);
            }
        });
    }

    function indentCommand(tx, elements) {
        elements = $.makeArray(elements || outermost(tx.selection.getParagraphElements()));
        $.each(elements, function (i, v) {
            var list = $(v).parent('ul,ol')[0] || $(v).prev('ul,ol')[0] || $('<ul>').insertBefore(v)[0];
            var newList = list;
            if (newList === v.parentNode) {
                var prevItem = $(v).prev('li')[0] || $('<li>').insertBefore(v)[0];
                newList = $(prevItem).children('ul,ol')[0] || $(list.cloneNode(false)).appendTo(prevItem)[0];
            }
            $(replaceElement(v, 'li')).appendTo(newList);
            if ($(newList).parent('li')[0]) {
                $(Typer.createTextNode('\u00a0')).insertBefore(newList);
            }
            if (!list.children[0]) {
                $(list).remove();
            }
        });
    }

    function outdentCommand(tx, elements) {
        elements = $.makeArray(elements || outermost(tx.selection.getParagraphElements()));
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
                    $(parentList).remove();
                }
            } else {
                $(replaceElement(v, 'p')).insertAfter(list);
            }
            if (!list.children[0]) {
                $(list).remove();
            }
        });
    }

    Typer.widgets.inlineStyle = {
        beforeStateChange: function (e) {
            var elements = e.typer.getSelection().getSelectedElements();
            e.widget.inlineClass = computePropertyValue($(elements).filter('span'), 'inlineClass');
            $.each(STYLE_CHECK, function (i, v) {
                e.widget[i] = !!Typer.ui.matchWSDelim(computePropertyValue(elements, v[0]), v[1]);
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
                applyInlineStyle(tx, createElementWithClassName('span', className), 'span');
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
                            replaceElement(v, createElementWithClassName(m[1] || 'p', m[2]));
                        } else {
                            v.className = m[2] || '';
                        }
                    });
                }
            },
            insertLine: function (tx) {
                tx.insertText('\n\n');
            },
            insertLineBefore: function (tx) {
                var widget = tx.selection.focusNode.widget;
                if (widget.id !== '__root__') {
                    tx.selection.select(widget.element, true);
                    tx.insertText('\n\n');
                }
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
        textFlow: true,
        create: listCommand,
        remove: function (tx) {
            outdentCommand(tx, tx.widget.element.children);
        },
        extract: function (e) {
            // ensure the list element (UL/OL) is extracted
            // nothing actually to be done
        },
        receive: function (e) {
            if (Typer.sameElementSpec(e.widget.element, e.receivedNode)) {
                e.preventDefault();
                e.typer.invoke(function (tx) {
                    tx.insertHtml(e.receivedNode.childNodes);
                });
            }
        },
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
                    $(e.widget.element).remove();
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
        justifyRight: 'ctrlShiftR',
        insertLineBefore: 'ctrlEnter'
    });

    Typer.ui.addHook('tab', function (e) {
        if (!e.isDefaultPrevented() && e.typer.widgetEnabled('list')) {
            e.typer.invoke(indentCommand);
            e.preventDefault();
        }
    });

}(jQuery, Typer));

// source: src/extensions/link.js
(function ($, Typer) {
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
        create: function (tx, value) {
            value = normalizeUrl(value);
            if (tx.selection.focusNode.widget.id === 'link') {
                tx.invoke('setURL', value);
            } else {
                tx.insertHtml($('<a>').text(tx.selection.getSelectedText() || value).attr('href', value)[0]);
            }
        },
        remove: 'keepText',
        init: function (e) {
            $(e.widget.element).css('cursor', 'text');
        },
        ctrlClick: function (e) {
            window.open(e.widget.element.href);
        },
        commands: {
            setURL: function (tx, value) {
                tx.widget.element.href = normalizeUrl(value);
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
                var element;
                if (self.widget) {
                    element = self.widget.element;
                } else {
                    element = $('<a href="">').text(text)[0];
                    tx.insertHtml(element);
                    tx.selection.select(element, 'contents');
                }
                $(element).text(text);
                tx.typer.invoke('setURL', href);
                if (value.blank) {
                    $(element).attr('target', '_blank');
                } else {
                    $(element).removeAttr('target');
                }
            },
            active: function (toolbar, self) {
                return toolbar.is('toolbar') ? self.widget : false;
            },
            visible: function (toolbar, self) {
                return toolbar.is('toolbar') || !!self.widget;
            },
            stateChange: function (toolbar, self) {
                self.label = self.widget ? 'typer:toolbar:link:edit' : 'typer:toolbar:link';
            }
        }),
        'contextmenu:link': Typer.ui.group('typer:toolbar:link typer:link:*(type:button)'),
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
        'toolbar:link:edit': 'Edit hyperlink',
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
            var selection = e.typer.getSelection().clone();
            if (e.data === 'enter') {
                selection.moveByCharacter(-1);
            }
            if (selection.getCaret('start').moveByWord(-1) && selection.focusNode.widget.id !== 'link' && /^([a-z]+:\/\/\S+)|(\S+@\S+\.\S+)/g.test(selection.getSelectedText())) {
                var link = RegExp.$1 || ('mailto:' + RegExp.$2);
                e.typer.invoke(function (tx) {
                    if (e.data === 'space') {
                        tx.insertText(' ');
                    }
                    var originalSelection = tx.selection.clone();
                    e.typer.snapshot(true);
                    e.typer.select(selection);
                    tx.insertWidget('link', link);
                    e.typer.select(originalSelection);
                });
                e.preventDefault();
            }
        }
    });

}(jQuery, Typer));

// source: src/extensions/media.js
(function ($, Typer) {
    var reMediaType = /\.(?:(jpg|jpeg|png|gif|webp)|(mp4|ogg|webm)|(mp3))(?:\?.*)?$/i;

    Typer.widgets.media = {
        element: 'img,audio,video,a:has(>img)',
        text: function (widget) {
            return widget.element.src;
        },
        create: function (tx, options) {
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
                return Typer.ui.prompt('typer:media:selectImage');
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

}(jQuery, Typer));

// source: src/extensions/stateclass.js
(function ($, Typer) {
    function toggleClass(widget, className, value) {
        $(widget.typer.element).parents(widget.options.target).addBack().eq(0).toggleClass(widget.options[className], value);
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

}(jQuery, Typer));

// source: src/extensions/table.js
(function ($, Typer) {
    var TD_HTML = '<td></td>';
    var TH_HTML = '<th></th>';
    var TR_HTML = '<tr>%</tr>';
    var TR_SELECTOR = '>tbody>tr';
    var X_ATTR_MODE = 'x-table-copymode';
    var MODE_ROW = 1;
    var MODE_COLUMN = 2;
    var MODE_TABLE = 3;

    var visualRange;
    var removeBeforeInsert;

    function CellSelection(widget, minRow, minCol, maxRow, maxCol) {
        var self = this;
        self.widget = widget;
        self.element = widget.element;
        self.minCol = minCol;
        self.minRow = minRow;
        self.maxCol = maxCol;
        self.maxRow = maxRow;
    }

    function getCellSelection(selection) {
        var widget = selection.focusNode.widget;
        if (widget.id === 'table') {
            var $c1 = $(selection.startElement).parentsUntil(widget.element).addBack();
            var $c2 = $(selection.endElement).parentsUntil(widget.element).addBack();
            return new CellSelection(widget, $c1.eq(1).index(), $c1.eq(2).index(), $c2.eq(1).index(), $c2.eq(2).index());
        }
    }

    function repeat(str, count) {
        return new Array(count + 1).join(str);
    }

    function removeElement(element) {
        $(element).remove();
    }

    function getRow(widget, row) {
        return $(TR_SELECTOR, widget.element || widget)[row];
    }

    function getCell(widget, row, col) {
        if (typeof row === 'string') {
            return getCell(widget, Math.min(widget[row + 'Row'], countRows(widget) - 1), Math.min(widget[row + 'Col'], countColumns(widget) - 1));
        }
        return getRow(widget, row).children[col];
    }

    function countRows(widget) {
        return $(TR_SELECTOR, widget.element || widget).length;
    }

    function countColumns(widget) {
        return getRow(widget, 0).childElementCount;
    }

    function hasTableHeader(widget) {
        return !!Typer.is(getCell(widget, 0, 0), 'th');
    }

    function tabNextCell(selection, dir, selector) {
        if (selection.isSingleEditable) {
            var nextCell = $(selection.focusNode.element)[dir]()[0] || $(selection.focusNode.element).parent()[dir]().children(selector)[0];
            if (nextCell) {
                selection.moveToText(nextCell, -0);
            }
        }
    }

    function setEditorStyle(widget) {
        $('td,th', widget.element || widget).css({
            outline: '1px dotted rgba(0,0,0,0.3)',
            minWidth: '3em'
        });
    }

    function selectCells(widget, row, col, numRow, numCol) {
        widget.typer.select(new CellSelection(widget, row, col, row + numRow - 1, col + numCol - 1));
    }

    function insertColumn(widget, index, count, before) {
        var s = typeof index === 'string' ? index + '-child' : 'nth-child(' + (index + 1) + ')';
        var m = before ? 'before' : 'after';
        $(widget.element || widget).find(TR_SELECTOR + '>th:' + s)[m](repeat(TH_HTML, count));
        $(widget.element || widget).find(TR_SELECTOR + '>td:' + s)[m](repeat(TD_HTML, count));
        setEditorStyle(widget);
    }

    function insertRow(widget, index, count, kind, before) {
        $(getRow(widget, index === 'last' ? countRows(widget) - 1 : index))[before ? 'before' : 'after'](repeat(TR_HTML.replace('%', repeat(kind, countColumns(widget))), count));
        setEditorStyle(widget);
    }

    function toggleHeader(widget, value) {
        var hasHeader = hasTableHeader(widget);
        if (hasHeader && !value) {
            $('>th', getRow(widget, 0)).wrapInner('<p>').each(function (i, v) {
                $(v).replaceWith($(TD_HTML).append(v.childNodes));
            });
            setEditorStyle(widget);
        } else if (!hasHeader && (value || value === undefined)) {
            insertRow(widget, 0, 1, TH_HTML, true);
        }
    }

    function findIndex(widget, isColumn, pos) {
        var $cell = $(isColumn ? TR_SELECTOR + ':first>*' : TR_SELECTOR, widget.element);
        for (var i = $cell.length - 1; i >= 0; i--) {
            var r = Typer.getRect($cell[i]);
            if ((isColumn ? r.left : r.top) < pos) {
                return i;
            }
        }
        return 0;
    }

    CellSelection.prototype = {
        get numCol() {
            return Math.abs(this.maxCol - this.minCol) + 1;
        },
        get numRow() {
            return Math.abs(this.maxRow - this.minRow) + 1;
        },
        get mode() {
            return (this.numCol === countColumns(this)) + (this.numRow === countRows(this)) * 2;
        },
        rows: function (callback) {
            $(TR_SELECTOR, this.element).splice(this.minRow, this.numRow).forEach(callback);
        },
        cells: function (callback) {
            var self = this;
            self.rows(function (v, i) {
                 $(v.children).splice(self.minCol, self.numCol).forEach(function (v, j) {
                    callback(v, i, j);
                });
            });
        },
        getRange: function () {
            return Typer.createRange(getCell(this, 'min'), 0, getCell(this, 'max'), -0);
        },
        acceptNode: function (node) {
            var result = false;
            if (node.element === this.element) {
                return 1;
            }
            this.cells(function (v) {
                result |= Typer.containsOrEquals(v, node.element);
            });
            return result || 2;
        },
        remove: function (mode) {
            var self = this;
            if (mode === MODE_ROW) {
                self.rows(removeElement);
            } else if (mode === MODE_COLUMN) {
                self.cells(removeElement);
            }
            self.widget.typer.select(getCell(self, 'min'), -0);
        }
    };

    Typer.widgets.table = {
        element: 'table',
        editable: 'th,td',
        create: function (tx, options) {
            options = options || {};
            tx.insertHtml('<table>' + repeat(TR_HTML.replace('%', repeat(TD_HTML, options.columns || 2)), options.rows || 2) + '</table>');
        },
        init: function (e) {
            $(e.widget.element).removeAttr(X_ATTR_MODE);
            setEditorStyle(e.widget);
        },
        extract: function (e) {
            var src = e.widget.element;
            var dst = e.extractedNode;
            if (visualRange && visualRange.widget === e.widget) {
                var mode = visualRange.mode;
                if (mode === MODE_ROW || mode === MODE_COLUMN) {
                    $(dst).attr(X_ATTR_MODE, mode);
                    if (e.source === 'paste' || e.source === 'cut') {
                        visualRange.remove(mode);
                    }
                }
            } else if (countRows(dst) > 1) {
                var count = countColumns(src);
                $(TR_SELECTOR, dst).each(function (i, v) {
                    if (v.childElementCount < count) {
                        $(repeat($('>th', v)[0] ? TH_HTML : TD_HTML, count - v.childElementCount))[i ? 'appendTo' : 'prependTo'](v);
                    }
                });
            }
        },
        receive: function (e) {
            var mode = +$(e.receivedNode).attr(X_ATTR_MODE);
            if (!mode && e.source !== 'paste') {
                return;
            }

            var selection = e.typer.getSelection();
            var info = visualRange && visualRange.widget === e.widget ? visualRange : getCellSelection(selection);
            var src = e.widget.element;
            var dst = e.receivedNode;
            var hasHeader = hasTableHeader(src);
            toggleHeader(dst, mode === MODE_ROW ? false : mode === MODE_COLUMN ? hasHeader : info.minRow === 0 && hasHeader);

            var dstRows = countRows(dst);
            var dstCols = countColumns(dst);
            var srcRows = countRows(src);
            var srcCols = countColumns(src);
            var insertAfter = mode === MODE_ROW ? info.minRow === srcRows : info.minCol === srcCols;

            if (mode === MODE_COLUMN) {
                insertRow(dstRows > srcRows ? src : dst, 'last', Math.abs(dstRows - srcRows), TD_HTML, false);
                $(TR_SELECTOR, dst).each(function (i, v) {
                    $(v.children)[insertAfter ? 'insertAfter' : 'insertBefore'](getCell(src, i, info.minCol - insertAfter));
                });
                selectCells(e.widget, 0, info.minCol, countRows(src), dstCols);
            } else if (mode === MODE_ROW) {
                if (info.minRow === 0 && hasHeader) {
                    info.minRow++;
                }
                insertColumn(dstCols > srcCols ? src : dst, 'last', Math.abs(dstCols - srcCols), false);
                $(TR_SELECTOR, dst)[insertAfter ? 'insertAfter' : 'insertBefore'](getRow(src, info.minRow - insertAfter));
                selectCells(e.widget, info.minRow, 0, dstRows, countColumns(src));
            } else {
                if (info.numRow === 1 && info.numCol === 1) {
                    info.maxCol = info.minCol + dstCols - 1;
                    info.maxRow = info.minRow + dstRows - 1;
                    if (info.maxRow > srcRows - 1) {
                        insertRow(src, 'last', info.maxRow - srcRows + 1, TD_HTML, false);
                    }
                    if (info.maxCol > srcCols - 1) {
                        insertColumn(src, 'last',  info.maxCol - srcCols + 1, false);
                    }
                }
                info.cells(function (v, i, j) {
                    $(v).replaceWith(getCell(dst, i % dstRows, j % dstCols).cloneNode(true));
                });
                selection.select(info);
            }
            setEditorStyle(src);
            e.preventDefault();
        },
        tab: function (e) {
            tabNextCell(e.typer.getSelection(), 'next', ':first-child');
        },
        shiftTab: function (e) {
            tabNextCell(e.typer.getSelection(), 'prev', ':last-child');
        },
        keystroke: function (e) {
            if (visualRange && visualRange.widget === e.widget && (e.data === 'backspace' || e.data === 'delete')) {
                var mode = visualRange.mode;
                if (mode === MODE_ROW || mode === MODE_COLUMN) {
                    e.preventDefault();
                    visualRange.remove(mode);
                }
            }
        },
        commands: {
            addColumnBefore: function (tx) {
                var info = getCellSelection(tx.selection);
                insertColumn(tx.widget, info.minCol, info.numCol, true);
            },
            addColumnAfter: function (tx) {
                var info = getCellSelection(tx.selection);
                insertColumn(tx.widget, info.maxCol, info.numCol, false);
            },
            addRowAbove: function (tx) {
                var info = getCellSelection(tx.selection);
                insertRow(tx.widget, info.minRow, info.numRow, TD_HTML, true);
            },
            addRowBelow: function (tx) {
                var info = getCellSelection(tx.selection);
                insertRow(tx.widget, info.maxRow, info.numRow, TD_HTML, false);
            },
            removeColumn: function (tx) {
                var info = getCellSelection(tx.selection);
                info.remove(MODE_COLUMN);
            },
            removeRow: function (tx) {
                var info = getCellSelection(tx.selection);
                info.remove(MODE_ROW);
            },
            toggleTableHeader: function (tx) {
                toggleHeader(tx.widget);
                $('>th', getRow(tx.widget, 0)).text(function (i, v) {
                    return v || 'Column ' + (i + 1);
                });
            }
        }
    };

    Typer.ui.define('tableGrid', {
        type: 'tableGrid'
    });

    $.extend(Typer.ui.themeExtensions, {
        tableGrid: '<div class="typer-ui-grid"><div class="typer-ui-grid-wrapper"></div><br x:t="label"/></div>',
        tableGridInit: function (toolbar, self) {
            var $self = $(self.element);
            $self.find('.typer-ui-grid-wrapper').append(repeat('<div class="typer-ui-grid-row">' + repeat('<div class="typer-ui-grid-cell"></div>', 7) + '</div>', 7));
            $self.find('.typer-ui-grid-cell').mouseover(function () {
                self.value.rows = $(this).parent().index() + 1;
                self.value.columns = $(this).index() + 1;
                self.label = self.value.rows + ' \u00d7 ' + self.value.columns;
                $self.find('.typer-ui-grid-cell').removeClass('active');
                $self.find('.typer-ui-grid-row:lt(' + self.value.rows + ')').find('.typer-ui-grid-cell:nth-child(' + self.value.columns + ')').prevAll().addBack().addClass('active');
            });
            self.label = '0 \u00d7 0';
            self.value = {};
            $self.click(function () {
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
        'table:toggleTableHeader': Typer.ui.checkbox({
            requireWidget: 'table',
            execute: 'toggleTableHeader',
            stateChange: function (toolbar, self) {
                self.value = !!$(self.widget.element).find('th')[0];
            }
        }),
        'table:style': Typer.ui.dropdown({
            requireWidget: 'table',
            controls: function (toolbar, self) {
                var definedOptions = $.map(Object.keys(toolbar.options.tableStyles || {}), function (v) {
                    return Typer.ui.button({
                        value: v,
                        label: toolbar.options.tableStyles[v]
                    });
                });
                var fallbackOption = Typer.ui.button({
                    value: '',
                    label: 'typer:table:styleDefault'
                });
                return definedOptions.concat(fallbackOption);
            },
            execute: function (toolbar, self, tx) {
                self.widget.element.className = self.value || '';
            },
            stateChange: function (toolbar, self) {
                self.value = self.widget.element.className || '';
                self.selectedText = self.label;
            }
        }),
        'table:tableWidth': Typer.ui.dropdown({
            requireWidget: 'table',
            execute: function (toolbar, self, tx) {
                if (self.value) {
                    $(self.widget.element).attr('width', '100%');
                } else {
                    $(self.widget.element).removeAttr('width');
                }
            },
            stateChange: function (toolbar, self) {
                self.value = $(self.widget.element).attr('width') || '';
                self.selectedText = self.label;
            }
        }),
        'table:tableWidth:fitContent': Typer.ui.button({
            value: ''
        }),
        'table:tableWidth:fullWidth': Typer.ui.button({
            value: '100%'
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
            execute: 'addRowAbove',
            enabled: function (toolbar, self) {
                return !hasTableHeader(self.widget) || getCellSelection(toolbar.typer.getSelection()).minRow > 0;
            }
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
        'table:toggleTableHeader': 'Show header',
        'table:style': 'Table style',
        'table:styleDefault': 'Default',
        'table:addRemoveCell:addColumnBefore': 'Add column before',
        'table:addRemoveCell:addColumnAfter': 'Add column after',
        'table:addRemoveCell:addRowAbove': 'Add row above',
        'table:addRemoveCell:addRowBelow': 'Add row below',
        'table:addRemoveCell:removeColumn': 'Remove column',
        'table:addRemoveCell:removeRow': 'Remove row',
        'table:tableWidth': 'Table width',
        'table:tableWidth:fitContent': 'Fit to content',
        'table:tableWidth:fullWidth': 'Full width'
    });

    var selectHandleX = Typer.canvas.handle('cell');
    var selectHandleY = Typer.canvas.handle('cell');
    var updateOnMouseup;

    Typer.canvas.addLayer('table', function (canvas) {
        var widget = canvas.hoverNode && canvas.hoverNode.widget;
        if (widget && widget.id === 'table') {
            var rect = Typer.getRect(widget);
            canvas.drawLine(rect.left, rect.top, rect.right, rect.top, 10, 'transparent', 'solid', selectHandleX);
            canvas.drawLine(rect.left, rect.top, rect.left, rect.bottom, 10, 'transparent', 'solid', selectHandleY);
        }

        var selection = canvas.typer.getSelection();
        var handle = canvas.activeHandle;
        if (handle === selectHandleX || handle === selectHandleY) {
            var isColumnMode = handle === selectHandleX;
            var index = findIndex(updateOnMouseup ? visualRange : widget, isColumnMode, isColumnMode ? canvas.pointerX : canvas.pointerY);
            if (!updateOnMouseup) {
                visualRange = new CellSelection(widget, 0, 0, countRows(widget) - 1, countColumns(widget) - 1);
                visualRange[isColumnMode ? 'minCol' : 'minRow'] = index;
            }
            visualRange[isColumnMode ? 'maxCol' : 'maxRow'] = index;
            updateOnMouseup = true;
        } else if (canvas.selectionChanged) {
            visualRange = getCellSelection(selection);
            if (!visualRange || (visualRange.numRow === 1 && visualRange.numCol === 1)) {
                visualRange = null;
                updateOnMouseup = false;
            } else {
                updateOnMouseup = true;
            }
        }
        if (updateOnMouseup && !canvas.mousedown) {
            updateOnMouseup = false;
            if (visualRange.mode === MODE_TABLE) {
                selection.select(visualRange.element);
                visualRange = null;
            } else {
                selectCells(visualRange.widget, Math.min(visualRange.minRow, visualRange.maxRow), Math.min(visualRange.minCol, visualRange.maxCol), visualRange.numRow, visualRange.numCol);
            }
        }

        if (visualRange) {
            var c1 = getCell(visualRange, 'min');
            var c2 = getCell(visualRange, 'max');
            canvas.fill(Typer.mergeRect(Typer.getRect(c1), Typer.getRect(c2)));
        }
        canvas.toggleLayer('selection', !visualRange);
    });

}(jQuery, Typer));

// source: src/extensions/toolbar.js
(function ($, Typer) {
    var activeToolbar;

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
                $(document).off('paste', handler);
                if (!detectClipboardInaccessible.value) {
                    detectClipboardInaccessible.value = false;
                    callback();
                }
            });
        }
    }

    function positionToolbar(toolbar, position) {
        var height = $(toolbar.element).height();
        if (position) {
            toolbar.position = 'fixed';
        } else if (toolbar.position !== 'fixed') {
            var rect = Typer.getRect(toolbar.widget || toolbar.typer);
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
            var r = toolbar.typer.getSelection().extendCaret.getRect();
            if (r.top >= position.top && r.top <= position.top + height) {
                position.top = r.bottom + 10;
            }
            $(toolbar.element).css(position);
        }
    }

    function showToolbar(toolbar, position) {
        toolbar.update();
        if (toolbar.widget || !toolbar.options.container) {
            if (activeToolbar !== toolbar) {
                hideToolbar();
                activeToolbar = toolbar;
                $(toolbar.element).appendTo(document.body);
                Typer.ui.setZIndex(toolbar.element, toolbar.typer.element);
            }
            positionToolbar(toolbar, position);
        }
    }

    function hideToolbar(typer) {
        if (activeToolbar && (!typer || activeToolbar.typer === typer)) {
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
                if (!control.is('textbox')) {
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
                        $(document.body).off('mousemove', handler);
                    });
                }
            });
        }
        if (type === 'contextmenu') {
            $(typer.element).on('contextmenu', function (e) {
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
            $(typer.element).on('click', function (e) {
                if (e.which === 1) {
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
            e.widget.toolbars = {};
        },
        focusin: function (e) {
            showToolbar(e.widget.toolbar);
        },
        focusout: function (e) {
            hideToolbar(e.typer);
        },
        stateChange: function (e) {
            if (activeToolbar && activeToolbar.typer === e.typer) {
                var toolbar = e.widget.toolbar;
                var selection = e.typer.getSelection();
                var currentWidget = selection.focusNode.widget;
                if (currentWidget.id !== '__root__' && selection.focusNode.element === currentWidget.element) {
                    if (Typer.ui.controls['typer:widget:' + currentWidget.id]) {
                        toolbar = e.widget.toolbars[currentWidget.id] || (e.widget.toolbars[currentWidget.id] = createToolbar(e.typer, e.widget.options, currentWidget));
                        toolbar.widget = currentWidget;
                    }
                }
                showToolbar(toolbar);
            }
        }
    };

    $(window).scroll(function () {
        if (activeToolbar) {
            positionToolbar(activeToolbar);
        }
    });

    /* ********************************
     * Built-in Controls
     * ********************************/

    Typer.ui.addControls('typer', {
        'contextmenu': Typer.ui.group('history selection clipboard insert *'),
        'contextmenu:history': Typer.ui.group('typer:history:* *'),
        'contextmenu:selection': Typer.ui.group('typer:selection:* *'),
        'contextmenu:clipboard': Typer.ui.group('typer:clipboard:* *'),
        'contextmenu:insert': Typer.ui.group('typer:toolbar:insert *'),
        'toolbar': Typer.ui.group(),
        'toolbar:insert': Typer.ui.callout({
            before: '*',
            controls: 'typer:insert:*',
            requireChildControls: true
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

}(jQuery, Typer));

// source: src/extensions/validation.js
(function ($, Typer) {
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

}(jQuery, Typer));

// source: src/presets/datepicker.js
(function ($, Typer, Date) {
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
            $table.on('mousewheel', function (e) {
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
            $('s', self.element).on('mousedown touchstart', function (e) {
                var elm = e.target;
                var rect = Typer.getRect(elm.parentNode);
                var isTouch = e.type === 'touchstart';
                var handlers = {};
                handlers[isTouch ? 'touchmove' : 'mousemove'] = function (e) {
                    if (!isTouch && e.which !== 1) {
                        return handlers.mouseup();
                    }
                    var point = isTouch ? e.originalEvent.touches[0] : e;
                    var rad = Math.atan2(point.clientY - rect.centerY, point.clientX - rect.centerX) / Math.PI;
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
                    $(document.body).off(handlers);
                    ui.execute(self);
                };
                if (e.which === 1 || (e.originalEvent.touches || '').length === 1) {
                    $(document.body).on(handlers);
                }
            });
            var mousewheelTimeout;
            $(self.element).on('mousewheel', function (e) {
                self.setValue(stepDate('minute', self.value, Typer.ui.getWheelDelta(e), self.step));
                e.preventDefault();
                clearTimeout(mousewheelTimeout);
                mousewheelTimeout = setTimeout(function () {
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
            if (e.typer === activeTyper && e.source !== 'script') {
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
                setTimeout(function () {
                    if (e.typer === activeTyper) {
                        callout.focus();
                    }
                });
            }
        },
        focusout: function (e) {
            setTimeout(function () {
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

}(jQuery, Typer, Date));

// source: src/presets/keyword.js
(function ($, Typer) {
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
                create: function (tx, value) {
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
            if (e.source !== 'script') {
                showSuggestions(e.widget);
            }
        }
    };

}(jQuery, Typer));

// source: src/presets/number.js
(function ($, Typer) {
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
            e.typer.setValue(e.typer.getValue() || 0);
        },
        mousewheel: function (e) {
            e.typer.setValue((e.typer.getValue() || 0) - e.data * e.widget.options.step);
            e.preventDefault();
        },
        upArrow: function (e) {
            e.typer.setValue((e.typer.getValue() || 0) + e.widget.options.step);
        },
        downArrow: function (e) {
            e.typer.setValue((e.typer.getValue() || 0) - e.widget.options.step);
        },
        contentChange: function (e) {
            if (e.source !== 'keyboard') {
                e.typer.setValue(e.typer.getValue() || 0);
            }
        }
    };

}(jQuery, Typer));

// source: src/presets/textbox.js
(function ($, Typer) {
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

}(jQuery, Typer));

// source: src/themes/material.js
(function ($, Typer) {
    var ANIMATION_END = 'animationend oanimationend webkitAnimationEnd';
    var TRANSITION_END = 'transitionend otransitionend webkitTransitionEnd';

    function setMenuPosition(thisMenu) {
        var callout = $('.typer-ui-float', thisMenu)[0];
        var rect = Typer.getRect(callout);
        if (rect.bottom > $(window).height()) {
            $(callout).addClass('float-top');
        } else if (rect.top < 0) {
            $(callout).removeClass('float-top');
        }
        if (rect.right > $(window).width()) {
            $(callout).addClass('float-left');
        } else if (rect.left < 0) {
            $(callout).removeClass('float-left');
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
        var arr = $(element).not('.' + className).map(function (i, v) {
            var deferred = $.Deferred();
            var handler = function (e) {
                if ($(v).hasClass(className) && e.target === v) {
                    $(v).toggleClass(className, !Typer.ui.matchWSDelim(e.type, ANIMATION_END));
                    $(v).off(TRANSITION_END + ' ' + ANIMATION_END, handler);
                    deferred.resolveWith(v);
                }
            };
            $(element).addClass(className).on(TRANSITION_END + ' ' + ANIMATION_END, handler);
            return deferred.promise().done(callback);
        });
        return $.when.apply(null, arr.get());
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
            setTimeout(function () {
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
                setTimeout(function () {
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
        dropdown: '<label class="typer-ui-dropdown" x:bind="(title:label)"><button><span class="typer-ui-label"><br x:t="labelIcon"/><span x:bind="(_:selectedText)"></span></span></button><br x:t="menupane"/></button>',
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
            if (!control.is('textbox') && (ui.is('contextmenu') || (control.contextualParent.is('callout dropdown') && control.contextualParent.hideCalloutOnExecute !== false))) {
                ui.hide(ui.is('contextmenu') ? null : control.contextualParent);
            }
        },
        init: function (ui, control) {
            bindEvent(ui);
        }
    });

    $(function () {
        var SELECT_EFFECT = '.typer-ui-material button:not(.typer-ui-checkbox), .typer-ui-material .has-clickeffect';
        $(document.body).on('mousedown', SELECT_EFFECT, function (e) {
            var pos = Typer.getRect(e.currentTarget);
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
            setTimeout(function () {
                $anim.css('transform', $anim.css('transform') + ' scale(' + scalePercent + ')').addClass('animate-in');
            });
            $overlay.css('border-radius', $(e.currentTarget).css('border-radius'));
        });
        $(document.body).on('mouseup mouseleave', SELECT_EFFECT, function (e) {
            var $overlay = $('.typer-ui-clickeffect', e.currentTarget);
            runCSSTransition($overlay.children(), 'animate-out', function () {
                $(this).parent().remove();
            });
        });
        $(document.body).on('mouseover', 'label:has(>.typer-ui-float)', function (e) {
            setMenuPosition(e.currentTarget);
        });
        $(document.body).on('click', '.typer-ui-dialog-wrapper', function (e) {
            runCSSTransition($(e.target).find('.typer-ui-dialog-inner'), 'pop');
        });
    });

}(jQuery, Typer));

}(jQuery, window, document, Object, String, Array, Math, Node, Range, DocumentFragment, RegExp, parseFloat, setTimeout, clearTimeout, new (function () {

// source: src/shim/MutationObserver.js
this.MutationObserver = window.MutationObserver || (function () {
    function MutationObserver(handler) {
        this.records = [];
        this.handler = handler;
    }
    MutationObserver.prototype = {
        observe: function (element, init) {
            var self = this;
            $(element).on('DOMNodeInserted DOMNodeRemoved DOMAttrModified DOMCharacterDataModified', function (e) {
                var type = e.type.charAt(7);
                var record = {};
                record.addedNodes = [];
                record.removedNodes = [];
                if (type === 'M') {
                    record.type = 'attributes';
                    record.target = e.target;
                    record.attributeName = e.originalEvent.attrName;
                } else if (type === 'a') {
                    record.type = 'characterData';
                    record.target = e.originalEvent.target;
                } else {
                    record.type = 'childList';
                    record.target = e.target.parentNode;
                    record[type === 'I' ? 'addedNodes' : 'removedNodes'][0] = e.target;
                }
                if (init[record.type] && (init.subtree || record.target === element)) {
                    self.records[self.records.length] = record;
                    clearTimeout(self.timeout);
                    self.timeout = setTimeout(function () {
                        self.handler(self.takeRecords());
                    });
                }
            });
        },
        takeRecords: function () {
            return this.records.splice(0);
        }
    };
    return MutationObserver;
}());

// source: src/shim/Set.js
this.Set = window.Set || (function () {
    function Set() {
        this.items = [];
    }
    Set.prototype = {
        get size() {
            return this.items.length;
        },
        has: function (v) {
            return this.items.indexOf(v) >= 0;
        },
        add: function (v) {
            var items = this.items;
            if (items.indexOf(v) < 0) {
                items.push(v);
            }
            return this;
        },
        delete: function (v) {
            var index = this.items.indexOf(v);
            if (index >= 0) {
                this.items.splice(index, 1);
            }
            return index >= 0;
        },
        forEach: function (callback, thisArg) {
            var self = this;
            self.items.forEach(function (v) {
                callback.call(thisArg, v, v, self);
            });
        },
        clear: function () {
            this.items.splice(0);
        }
    };
    return Set;
}());

// source: src/shim/WeakMap.js
this.WeakMap = window.WeakMap || (function () {
    var num = 0;
    function WeakMap() {
        this.key = '__WeakMap' + (++num);
    }
    WeakMap.prototype = {
        get: function (key) {
            return key && key[this.key];
        },
        set: function (key, value) {
            key[this.key] = value;
        },
        has: function (key) {
            return key && this.key in key;
        },
        delete: function (key) {
            delete key[this.key];
        }
    };
    return WeakMap;
}());

})));
