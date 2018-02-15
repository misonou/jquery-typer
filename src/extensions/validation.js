(function ($, Typer) {
    'use strict';

    Typer.widgets.validation = {
        init: function (e) {
            var options = e.widget.options;
            if (options.invalidChars) {
                options.invalidCharsRegex = new RegExp('[' + options.invalidChars.replace(/[\[\]\\^]/g, '\\$&') + ']', 'g');
            }
            if (options.allowChars) {
                options.invalidCharsRegex = new RegExp('[^' + options.allowChars.replace(/[\[\]\\^]/g, '\\$&') + ']', 'g');
            }
        },
        textInput: function (e) {
            var options = e.widget.options;
            var filteredText = e.data;
            if (options.invalidCharsRegex) {
                var o = filteredText;
                filteredText = filteredText.replace(options.invalidCharsRegex, '');
            }
            if (options.maxlength) {
                var room = options.maxlength - e.typer.extractText().length;
                if (filteredText.length > room) {
                    filteredText = filteredText.substr(0, room);
                }
            }
            if (filteredText !== e.data) {
                e.preventDefault();
                if (filteredText) {
                    e.typer.invoke(function (tx) {
                        tx.insertText(filteredText);
                    });
                }
            }
        }
    };

}(jQuery, Typer));
