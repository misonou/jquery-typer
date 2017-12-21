(function ($, Typer) {
    'use strict';

    function fixTextOverflow(typer) {
        var topElement = typer.element;
        var style = window.getComputedStyle(topElement);
        if (style.whiteSpace === 'nowrap' && style.overflow === 'hidden') {
            var rect = Typer.ui.getRect(topElement);
            var pos = Typer.ui.getRect(typer.getSelection().extendCaret.getRange());
            if (pos.left - rect.right >= 1) {
                topElement.style.textIndent = parseInt(style.textIndent) - (pos.left - rect.right + 5) + 'px';
            } else if (rect.left - pos.left >= 1) {
                topElement.style.textIndent = Math.min(0, parseInt(style.textIndent) + (rect.left - pos.left + 5)) + 'px';
            }
        }
    }

    Typer.presets = {};

    Typer.preset = function (element, name, options) {
        var preset = Typer.presets[name];
        var presetDefinition = {};
        var presetWidget;

        options = {
            inline: true,
            accept: 'text',
            defaultOptions: false,
            disallowedElement: '*',
            widgets: {},
            stateChange: function (e) {
                fixTextOverflow(e.typer);
            },
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

} (jQuery, window.Typer));
