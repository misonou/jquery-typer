(function ($, Typer) {
    'use strict';

    var isFunction = $.isFunction;
    var boolAttrs = 'checked selected disabled readonly multiple ismap'.split(' ');

    var definedControls = {};
    var definedIcons = {};
    var definedLabels = {};
    var definedThemes = {};
    var definedShortcuts = {};
    var bindTransforms = {};
    var expandCache = {};

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

    function listen(obj, prop, callback) {
        var myValue = obj[prop];
        Object.defineProperty(obj, prop, {
            enumerable: true,
            configurable: true,
            get: function () {
                return myValue;
            },
            set: function (value) {
                if (myValue !== value) {
                    myValue = value;
                    callback.call(this, prop, value);
                }
            }
        });
    }

    function expandControls(ui, str, controls) {
        controls = controls || definedControls;

        var cacheKey = (str || '') + (controls.expandedFrom ? ' @ ' + controls.expandedFrom : '') + ' @ ' + (ui.type || '');
        if (expandCache[cacheKey]) {
            return expandCache[cacheKey].slice(0);
        }

        var tokens = (str || '').split(/\s+/);
        var arr = [];
        var allowed = function (name) {
            return (!controls[name].context || controls[name].context.indexOf(ui.type) >= 0) && tokens.indexOf('-' + name) < 0 && arr.indexOf(name) < 0;
        };
        $.each(tokens, function (i, v) {
            if (v.slice(-1) === '*') {
                $.each(controls, function (i) {
                    if (i.slice(0, v.length - 1) === v.slice(0, -1) && i.indexOf(':', v.length) < 0 && allowed(i)) {
                        arr[arr.length] = i;
                    }
                });
            } else if (v.charAt(0) !== '-' && controls[v] && allowed(v)) {
                arr[arr.length] = v;
            }
        });
        expandCache[cacheKey] = arr.slice(0);
        return arr;
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
        if (isFunction(control[name])) {
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
            control.controls = control.controls(ui, control);
        }
        if (typeof control.controls === 'string') {
            control.controls = expandControls(ui, control.controls);
        }

        var defaultOrder = {};
        control.controls = $.map(control.controls || [], function (v, i) {
            var inst = Object.create(typeof v === 'string' ? definedControls[v] : v);
            inst.parent = control;
            inst.name = inst.name || (typeof v === 'string' ? v : 'noname:' + (Math.random().toString(36).substr(2, 8)));
            if (inst.label === undefined) {
                inst.label = inst.name;
            }
            defaultOrder[inst.name] = i;
            ui.all[inst.name] = inst;
            resolveControls(ui, inst);
            return inst;
        });
        control.controls.sort(function (a, b) {
            function m(a, b, prop, mult) {
                return !a[prop] || (b[prop] && b[prop].indexOf(a.name)) ? 0 : mult * (a[prop].indexOf(b.name) >= 0 ? 1 : -1);
            }
            return m(a, b, 'after', 1) || m(a, b, 'before', -1) || m(b, a, 'after', -1) || m(b, a, 'before', 1) || defaultOrder[a.name] - defaultOrder[b.name];
        });
        return control.controls;
    }

    function renderControl(ui, control, params) {
        control = control || ui;
        var bindedProperties = {};

        function propertyChanged(prop, value) {
            value = (bindTransforms[prop] || bindTransforms.__default__)(value);
            $.each(bindedProperties[prop], function (i, v) {
                if (v[1] === '_') {
                    $(v[0]).text(value || '');
                } else if (boolAttrs.indexOf(v[1]) >= 0) {
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
            if ($(e.target).is(':checkbox')) {
                setTimeout(function () {
                    ui.setValue(control, !!e.target.checked);
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
        triggerEvent(ui, ui, 'controlExecuted', control);
    }

    function foreachControl(ui, fn, optArg) {
        $.each(Object.keys(ui.all).reverse(), function (i, v) {
            fn(ui, ui.all[v], optArg);
        });
    }

    Typer.ui = define('TyperUI', null, function (options, parentUI) {
        if (parentUI) {
            options = {
                theme: parentUI.theme,
                typer: parentUI.typer,
                widget: parentUI.widget,
                controls: options,
                parentUI: parentUI
            };
        }
        var self = $.extend(this, options);
        self.all = {};
        Object.defineProperty(self.all, 'expandedFrom', {
            value: self.controls
        });
        self.controls = resolveControls(self);
        self.element = renderControl(self);
        $(self.element).addClass('typer-ui typer-ui-' + options.theme);
        if (self.typer) {
            self.typer.retainFocus(self.element);
        }
        callFunction(self, definedThemes[self.theme], 'init');
        foreachControl(self, triggerEvent, 'init');
        triggerEvent(self, self, 'init');
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
            foreachControl(this, triggerEvent, 'destroy');
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
        resolve: function (control) {
            var self = this;
            return $.map(expandControls(this, control, self.all), function (v) {
                return self.all[v];
            });
        },
        getValue: function (control) {
            var self = this;
            if (typeof control === 'string') {
                control = self.all[control] || {};
            }
            if (!control.valueMap) {
                return control.value;
            }
            var value = {};
            $.each(control.valueMap, function (i, v) {
                value[i] = self.getValue(v);
            });
            return value;
        },
        setValue: function (control, value) {
            var self = this;
            if (typeof control === 'string') {
                control = self.all[control] || {};
            }
            if (control.valueMap) {
                var map = control.valueMap || {};
                $.each(value, function (i, v) {
                    $.each(self.resolve(map[i]), function (i, w) {
                        self.setValue(w, v);
                    });
                });
                return;
            }
            control.value = value;
            if (control.executeOnSetValue && self.enabled(control)) {
                executeControl(self, control);
            }
        },
        execute: function (control) {
            var self = this;
            if (typeof control === 'string') {
                control = self.all[control] || {};
            } else if (!control) {
                control = self.controls[0];
            }
            if (self.enabled(control)) {
                if (isFunction(control.dialog)) {
                    var promise = $.when(control.dialog(self, control));
                    promise.done(function (value) {
                        if (value !== undefined) {
                            self.setValue(control, value);
                        }
                        executeControl(self, control);
                    });
                    return promise;
                } else {
                    executeControl(self, control);
                }
            }
        },
        spawn: function (control, value) {
            var ui = Typer.ui(control, this);
            ui.setValue(control, value);
            return ui.execute();
        },
        alert: function (message) {
            var dialog = Typer.ui('ui:alert', this);
            dialog.all['ui:alert'].label = message;
            return dialog.execute();
        },
        confirm: function (message) {
            var dialog = Typer.ui('ui:confirm', this);
            dialog.all['ui:confirm'].label = message;
            return dialog.execute();
        },
        prompt: function (message, value) {
            var dialog = Typer.ui('ui:prompt', this);
            dialog.all['ui:prompt'].label = message;
            dialog.all['ui:prompt'].value = value;
            return dialog.execute();
        }
    });

    $.extend(Typer.ui, {
        controls: definedControls,
        themes: definedThemes,
        getIcon: function (control, iconSet) {
            return (definedIcons[control.icon] || definedIcons[control.name] || '')[iconSet] || '';
        },
        getShortcut: function (command) {
            var current = definedShortcuts._map[command];
            return current && current[0];
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
        addHook: function (keystroke, hook) {
            if (typeof keystroke === 'object') {
                $.each(keystroke, Typer.ui.addHook);
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
            if (typeof command === 'object') {
                $.each(command, Typer.ui.setShortcut);
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
            if ($(element).css('position') === 'static') {
                element.style.position = 'relative';
            }
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
            hiddenWhenDisabled: true,
            enabled: function (ui, self) {
                return !!$.grep(self.controls, function (v) {
                    return ui.enabled(v);
                })[0];
            }
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
            type: 'dialog',
            resolve: 'ui:button-ok',
            reject: 'ui:button-cancel'
        }, function (options) {
            $.extend(this, options);
            this.dialog = function (ui, self) {
                var deferred = $.Deferred();
                $.each(ui.resolve(self.resolve), function (i, v) {
                    v.execute = function () {
                        deferred.resolve(ui.getValue(self.resolveValue || self));
                    };
                });
                $.each(ui.resolve(self.reject), function (i, v) {
                    v.execute = function () {
                        deferred.reject();
                    };
                });
                if (isFunction(self.setup)) {
                    self.setup(ui, self, deferred.resolve.bind(deferred), deferred.reject.bind(deferred));
                }
                ui.update();
                ui.trigger(self, 'open');
                deferred.always(function () {
                    ui.trigger(self, 'close');
                    ui.destroy();
                });
                if (ui.parentUI) {
                    Typer.ui.setZIndex(ui.element, ui.parentUI.element);
                }
                return deferred.promise();
            };
        })
    });

    /* ********************************
     * Built-in Controls and Resources
     * ********************************/

    $.extend(definedControls, {
        'ui:button-ok': Typer.ui.button(),
        'ui:button-cancel': Typer.ui.button(),
        'ui:prompt-input': Typer.ui.textbox({
            label: '',
            executeOnSetValue: false
        }),
        'ui:prompt-buttonset': Typer.ui.group('ui:button-ok ui:button-cancel'),
        'ui:prompt': Typer.ui.dialog({
            controls: 'ui:prompt-input ui:prompt-buttonset',
            resolveValue: 'ui:prompt-input',
            setup: function (ui, self) {
                ui.setValue('ui:prompt-input', self.value);
            }
        }),
        'ui:confirm-buttonset': Typer.ui.group('ui:button-ok ui:button-cancel'),
        'ui:confirm': Typer.ui.dialog({
            controls: 'ui:confirm-buttonset'
        }),
        'ui:alert-buttonset': Typer.ui.group('ui:button-ok'),
        'ui:alert': Typer.ui.dialog({
            controls: 'ui:alert-buttonset'
        }),
    });

    Typer.ui.addLabels('en', {
        'ui:button-ok': 'OK',
        'ui:button-cancel': 'Cancel'
    });

    Typer.ui.addIcons('material', {
        'ui:button-ok': '\ue876',
        'ui:button-cancel': '\ue5cd'
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

    bindTransforms.__default__ = function (value) {
        return typeof value === 'string' && value in definedLabels ? definedLabels[value] : value;
    };
    bindTransforms.shortcut = function (value) {
        return (value || '').replace(/ctrl|alt|shift/gi, function (v) {
            return v.charAt(0).toUpperCase() + v.slice(1) + '+';
        });
    };

} (jQuery, window.Typer));
