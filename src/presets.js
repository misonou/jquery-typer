(function ($, Typer) {
    'use strict';

    Typer.presets = {
        textbox: {
            inline: true,
            defaultOptions: false,
            disallowedElement: '*',
            overrides: {
                getValue: function () {
                    return Typer.trim(this.element.textContent);
                },
                setValue: function (value) {
                    if (value !== this.getValue()) {
                        this.invoke(function (tx) {
                            tx.selection.select(this.element, 'contents');
                            tx.insertText(value);
                        });
                    }
                }
            },
            init: function (e) {
                e.typer.getSelection().moveToText(e.typer.element, -0);
            },
            contentChange: function (e) {
                $(e.typer.element).toggleClass('has-value', !!e.typer.getValue());
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
            if (!presetDefinition.options || !(i in presetDefinition.options)) {
                options[i] = v;
                delete this[i];
            }
        });

        var originalInit = options.init;
        options.init = function (e) {
            $.extend(e.typer, preset.overrides);
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
