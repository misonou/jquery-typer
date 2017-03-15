(function ($, Typer) {
    'use strict';

    Typer.presets = {
        textbox: {
            inline: true,
            defaultOptions: false,
            disallowedElement: '*',
            accept: 'text',
            overrides: {
                getValue: function () {
                    return this.extractText();
                },
                setValue: function (value) {
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
                validate: function () {
                    var value = this.getValue();
                    if (this.presetOptions.required && !value) {
                        return false;
                    }
                    return true;
                }
            },
            init: function (e) {
                e.typer.getSelection().moveToText(e.typer.element, -0);
            }
        }
    };

    Typer.preset = function (element, name, options) {
        var preset = Typer.presets[name];
        var presetDefinition = {};
        options = {
            __preset__: options || {},
            widgets: {}
        };
        $.each(preset, function (i, v) {
            (typeof v === 'function' || i === 'options' ? presetDefinition : options)[i] = v;
        });
        $.each(options.__preset__, function (i, v) {
            if (typeof v === 'function' || !presetDefinition.options || !(i in presetDefinition.options)) {
                options[i] = v;
                delete this[i];
            }
        });

        var originalInit = options.init;
        options.init = function (e) {
            $.extend(e.typer, preset.overrides);
            e.typer.presetOptions = e.typer.getStaticWidget('__preset__').options;
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
