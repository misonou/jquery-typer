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
