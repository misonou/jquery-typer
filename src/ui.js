(function ($, Typer, Object, RegExp, window, document) {
    'use strict';

    var SELECTOR_INPUT = ':text, :password, :checkbox, :radio, textarea, [contenteditable]';
    var SELECTOR_FOCUSABLE = ':input, [contenteditable], a[href], area[href], iframe';
    var BOOL_ATTRS = 'checked selected disabled readonly multiple ismap';
    var ROOT_EVENTS = 'executing executed cancelled';

    var isFunction = $.isFunction;
    var isPlainObject = $.isPlainObject;
    var getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
    var defineProperty = Object.defineProperty;

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
    var callstack = [];
    var snaps = [];
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
        var baseFn = function () { };
        baseFn.prototype = controlExtensions;
        fn.prototype = new baseFn();
        Object.getOwnPropertyNames(base || {}).forEach(function (v) {
            defineProperty(fn.prototype, v, getOwnPropertyDescriptor(base, v));
        });
        defineHiddenProperty(fn.prototype, 'constructor', fn);
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

    function toggleClass(element, prefix, values) {
        var re = new RegExp('\\s*\\b' + prefix + '(-\\S+|\\b)|\\s*$', 'ig');
        var replacement = values && values[0] ? ' ' + prefix + [''].concat(values).join(' ' + prefix + '-') : '';
        $(element).attr('class', function (i, v) {
            var replaced = 0;
            return (v || '').replace(re, function () {
                return replaced++ ? '' : replacement;
            });
        });
    }

    function updatePinnedPositions() {
        var windowSize = getBoundingClientRect();

        $.each(snaps, function (i, v) {
            var dialog = $(v.element).find('.typer-ui-dialog')[0];
            var dialogSize = getBoundingClientRect(dialog);
            var rect = getBoundingClientRect(v.reference);
            var stick = {};

            $(v.element).css({
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

    function getFullClientRect(element) {
        var rect = getBoundingClientRect(element);
        if (rect.width && rect.height) {
            return rect;
        }
        rect = $.extend({}, rect);
        $(element).children().each(function (i, v) {
            var r = getBoundingClientRect(v);
            rect.top = Math.min(rect.top, r.top);
            rect.left = Math.min(rect.left, r.left);
            rect.right = Math.max(rect.right, r.right);
            rect.bottom = Math.max(rect.bottom, r.bottom);
        });
        rect.width = rect.right - rect.left;
        rect.height = rect.bottom - rect.top;
        return rect;
    }

    function showCallout(control, element, ref, pos) {
        for (var i = 0; i < currentCallouts.length; i++) {
            if (currentCallouts[i].control !== control && !currentCallouts[i].control.parentOf(control)) {
                hideCallout(currentCallouts[i].control);
                break;
            }
        }

        var rect = currentCallouts[0];
        if (!rect || rect.control !== control) {
            rect = {};
            currentCallouts.unshift(rect);
        } else if (rect.promise.state() === 'pending') {
            rect.promise.always(function () {
                showCallout(control, element, ref, pos);
            });
            return;
        }
        rect = $.extend(rect, {
            control: control,
            element: element,
            focusedElement: Typer.is(document.activeElement, SELECTOR_FOCUSABLE)
        });

        $(element).appendTo(document.body).css({
            position: 'fixed',
            zIndex: getZIndexOver(currentCallouts[0] ? currentCallouts[0].element : document.body)
        });
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
        var elmRect = getFullClientRect(element);
        $(element).css({
            left: (rect.left + elmRect.width > winRect.width ? rect.right - elmRect.width : rect.left) + 'px',
            top: (rect.top + elmRect.height > winRect.height ? rect.bottom - elmRect.height : rect.top) + 'px'
        });
        rect.promise = $.when(callThemeFunction(control, 'afterShow', rect));
    }

    function hideCallout(control) {
        for (var i = currentCallouts.length - 1; i >= 0 && control !== currentCallouts[i].control && !control.parentOf(currentCallouts[i].control); i--);
        $.each(currentCallouts.slice(0, i + 1), function (i, v) {
            if (v.promise.state() !== 'pending' && !v.isClosing) {
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
            defineHiddenProperty(haystack, '_cache', {});
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
        var $elm = $(control.element);

        var suppressStateChange;
        if (control.requireWidget || control.requireWidgetEnabled) {
            control.widget = ui._widgets[control.requireWidget || control.requireWidgetEnabled] || ui.widget;
            suppressStateChange = !control.widget;
        }
        if (!suppressStateChange && callstack.indexOf(control, 1) < 0) {
            if ($elm.hasClass(theme.controlErrorClass)) {
                validateControl(control);
            }
            triggerEvent(control, 'stateChange');
        }

        var disabled = !isEnabled(control);
        var visible = (!control.hiddenWhenDisabled || !disabled) && control.visible !== false && callFunction(control, 'visible') !== false;

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
        toggleClass(control.element, definedThemes[control.ui.theme].controlErrorClass, Object.keys(flags));
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
        if (self.typer) {
            self.typer.retainFocus(self.element);
        }
        foreachControl(self, triggerEvent, 'init');
        triggerEvent(self, 'init');
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
            for (var i = snaps.length - 1; i >= 0; i--) {
                if (snaps[i].control.ui === self) {
                    $(snaps.splice(i, 1)[0].reference).removeClass(definedThemes[self.theme].controlPinActiveClass);
                }
            }
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
            var theme = definedThemes[self.theme];
            foreachControl(self, function (control) {
                if (control.validate) {
                    toggleClass(control.element, theme.controlErrorClass);
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
        }
    });

    $.extend(typerUI, {
        controls: definedControls,
        themes: definedThemes,
        controlExtensions: controlExtensions,
        matchWSDelim: matchWSDelim,
        getZIndex: getZIndex,
        getZIndexOver: getZIndexOver,
        listen: listen,
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
        pin: function (control, reference, direction) {
            var theme = definedThemes[control.ui.theme];
            snaps.push({
                control: control,
                element: control.element,
                reference: reference,
                direction: direction
            });
            toggleClass(control.element, theme.controlPinnedClass, [direction]);
            $(reference).addClass(theme.controlPinActiveClass);
            updatePinnedPositions();
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
        hint: function (message) {
            return typerUI('dialog:hint', {
                message: message
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
        cssClass: '',
        hiddenWhenDisabled: false,
        markdown: false,
        renderAs: '',
        requireChildControls: false,
        requireTyper: false,
        requireWidget: '',
        requireWidgetEnabled: '',
        showButtonLabel: true,
        hideCalloutOnExecute: true,
        is: function (type) {
            return matchWSDelim(this.type, type);
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
        }
    });

    typerUI.theme = define('TyperUITheme');
    typerUI.themeExtensions = typerUI.theme.prototype;

    $.extend(typerUI.themeExtensions, {
        textboxPresetOptions: null,
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
                    var parent = ui.parentControl;
                    var dir = parent && matchWSDelim(parent.pinDirection || parent.contextualParent.pinDirection || parent.ui.pinDirection, 'left right top bottom');
                    if (self.pinnable && dir) {
                        Typer.ui.pin(self, parent.element, dir);
                    }
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
                    element: self.element,
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
        message: typerUI.label({
            markdown: true
        }),
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
                setImmediate(typerUI.focus, currentDialog.element);
            }
        });
        $(window).bind('resize scroll orientationchange', function (e) {
            updatePinnedPositions();
        });
        $(document.body).on('click', 'label', function (e) {
            // IE does not focus on focusable element when clicking containing LABEL element
            $(SELECTOR_FOCUSABLE, e.currentTarget).not(':disabled, :hidden').eq(0).focus();
        });
        $(document.body).mousedown(function (e) {
            if (currentDialog && currentDialog.clickReject && !Typer.containsOrEquals(currentDialog.element, e.target)) {
                currentDialog.clickReject();
            }
            $.each(currentCallouts.slice(0), function (i, v) {
                if (!Typer.containsOrEquals(v.element, e.target) && (!v.focusedElement || !Typer.containsOrEquals(v.focusedElement, e.target))) {
                    hideCallout(v.control);
                }
            });
        });
    });

}(jQuery, window.Typer, Object, RegExp, window, document));
