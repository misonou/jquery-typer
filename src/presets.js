(function ($, Typer) {
    'use strict';

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
