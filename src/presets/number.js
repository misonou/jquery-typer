(function ($, Typer) {
    'use strict';

    Typer.presets.number = {
        validation: {
            allowChars: '0-9'
        },
        options: {
            max: null,
            min: null,
            digits: 'auto',
            step: 1
        },
        overrides: {
            getValue: function (preset) {
                return parseInt(this.extractText());
            },
            setValue: function (preset, value) {
                value = +value || 0;
                if (preset.options.max !== null && value > preset.options.max) {
                    value = preset.options.max;
                }
                if (preset.options.min !== null && value < preset.options.min) {
                    value = preset.options.min;
                }
                value = String(+value || 0);
                if (preset.options.digits === 'fixed') {
                    var numOfDigits = String(+preset.options.max || 0).length;
                    value = (new Array(numOfDigits + 1).join('0') + value).substr(-numOfDigits);
                }
                if (value !== this.extractText()) {
                    this.invoke(function (tx) {
                        tx.selection.select(this.element, 'contents');
                        tx.insertText(String(value));
                    });
                }
            },
            hasContent: function () {
                return !!this.extractText();
            }
        },
        focusout: function (e) {
            var value = parseInt(e.typer.extractText()) || 0;
            e.typer.setValue(value);
        },
        mousewheel: function (e) {
            e.typer.setValue(e.typer.getValue() - e.data * e.widget.options.step);
            e.preventDefault();
        },
        upArrow: function (e) {
            var value = parseInt(e.typer.extractText()) || 0;
            e.typer.setValue(value + e.widget.options.step);
        },
        downArrow: function (e) {
            var value = parseInt(e.typer.extractText()) || 0;
            e.typer.setValue(value - e.widget.options.step);
        },
        contentChange: function (e) {
            if (e.data !== 'keystroke') {
                var value = parseInt(e.typer.extractText()) || 0;
                e.typer.setValue(value);
            }
        }
    };

} (jQuery, window.Typer));
