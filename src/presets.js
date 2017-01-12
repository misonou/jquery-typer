(function ($, Typer) {
    'use strict';

    Typer.presets = {
        textbox: {
            inline: true,
            defaultOptions: false,
            disallowedElement: '*',
            init: function (e) {
                e.typer.getSelection().moveToText(e.typer.element, -0);
                Object.defineProperty(e.typer.element, 'value', {
                    enumerable: true,
                    configurable: true,
                    get: function () {
                        return Typer.trim(this.textContent);
                    },
                    set: function (value) {
                        if (value !== this.value) {
                            this.textContent = value;
                            e.typer.getSelection().moveToText(this, -0);
                        }
                    }
                });
            },
            change: function (e) {
                $(e.typer.element).trigger('change');
            }
        }
    };

    $.fn.typer = function (preset, options) {
        options = typeof preset === 'string' ? $.extend({}, Typer.presets[preset], options) : preset;
        return this.each(function (i, v) {
            new Typer(v, options);
        });
    };

} (jQuery, window.Typer));
