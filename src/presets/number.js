(function ($, Typer) {
    'use strict';

    Typer.presets.number = {
        inline: true,
        defaultOptions: false,
        disallowedElement: '*',
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
            getValue: function () {
                return parseInt(this.extractText());
            },
            setValue: function (value) {
                value = +value || 0;
                if (this.presetOptions.max !== null && value > this.presetOptions.max) {
                    value = this.presetOptions.max;
                }
                if (this.presetOptions.min !== null && value < this.presetOptions.min) {
                    value = this.presetOptions.min;
                }
                value = String(+value || 0);
                if (this.presetOptions.digits === 'fixed') {
                    var numOfDigits = String(+this.presetOptions.max || 0).length;
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
        init: function (e) {
            $(e.typer.element).bind('mousewheel', function (ex) {
                if (e.typer.focused()) {
                    var dir = ex.originalEvent.wheelDeltaY || ex.originalEvent.wheelDelta || -ex.originalEvent.detail;
                    if (dir) {
                        e.typer.setValue(e.typer.getValue() + (dir / Math.abs(dir)) * e.widget.options.step);
                    }
                }
            });
        },
        focusout: function (e) {
            var value = parseInt(e.typer.extractText()) || 0;
            e.typer.setValue(value);
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
