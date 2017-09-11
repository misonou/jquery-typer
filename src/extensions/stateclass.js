(function ($, Typer) {
    'use strict';

    function toggleClass(widget, className, value) {
        $(widget.typer.element).parents(widget.options.target).andSelf().eq(0).toggleClass(widget.options[className], value);
    }

    Typer.widgets.stateclass = {
        inline: true,
        options: {
            target: null,
            focused: 'focused',
            empty: 'empty'
        },
        focusin: function (e) {
            toggleClass(e.widget, 'focused', true);
        },
        focusout: function (e) {
            toggleClass(e.widget, 'focused', false);
        },
        contentChange: function (e) {
            toggleClass(e.widget, 'empty', !e.typer.hasContent());
        },
        init: function (e) {
            toggleClass(e.widget, 'empty', !e.typer.hasContent());
        }
    };

}(jQuery, window.Typer));
