(function ($, Typer) {
    'use strict';

    Typer.presets = {
        textbox: {
            inline: true,
            defaultOptions: false,
            disallowedElement: '*',
            prototype: {
                getValue: function () {
                    return Typer.trim(this.typer.element.textContent);
                },
                setValue: function (value) {
                    if (value !== Typer.trim(this.typer.element.textContent)) {
                        this.typer.element.textContent = value;
                        this.typer.getSelection().moveToText(this.typer.element, -0);
                    }
                }
            },
            init: function (e) {
                e.typer.getSelection().moveToText(e.typer.element, -0);
            }
        }
    };

    Typer.preset = function (element, name, options) {
        var preset = Typer.presets[name];
        var presetObject = Object.create(preset.prototype || {});
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
            presetObject.typer = e.typer;
            e.typer.preset = presetObject;
            if (typeof originalInit === 'function') {
                originalInit.call(options, e);
            }
        };
        options.widgets.__preset__ = presetDefinition;
        presetDefinition.inline = true;
        new Typer(element, options);
        return presetObject;
    };

    $.fn.typer = function (options) {
        return this.each(function (i, v) {
            new Typer(v, options);
        });
    };

} (jQuery, window.Typer));
