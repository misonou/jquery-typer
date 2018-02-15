(function ($, Typer) {
    'use strict';

    Typer.presets.textbox = {
        options: {
            required: false
        },
        overrides: {
            getValue: function (preset) {
                return this.extractText();
            },
            setValue: function (preset, value) {
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
            validate: function (preset, assert) {
                assert(!preset.options.required || this.getValue(), 'required');
            }
        },
        init: function (e) {
            e.typer.getSelection().moveToText(e.typer.element, -0);
        }
    };

}(jQuery, Typer));
