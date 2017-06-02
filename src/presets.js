(function ($, Typer) {
    'use strict';

    Typer.presets = {};

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
