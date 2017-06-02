(function ($, Typer) {
    'use strict';

    Typer.presets.textbox = {
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
    };

} (jQuery, window.Typer));
