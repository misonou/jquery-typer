(function ($, Typer) {
    'use strict';

    var reMediaType = /\.(?:(jpg|jpeg|png|gif|webp)|(mp4|ogg|webm)|(mp3))(?:\?.*)?$/i;

    Typer.widgets.media = {
        element: 'img,audio,video,a:has(>img)',
        text: function (widget) {
            return widget.element.src;
        },
        insert: function (tx, options) {
            var element = Typer.createElement(reMediaType.test(options.src || options) ? (RegExp.$2 ? 'video' : RegExp.$3 ? 'audio' : 'img') : 'img');
            element.src = options.src || options;
            if (Typer.is(element, 'video')) {
                $(element).attr('controls', '');
            }
            tx.insertHtml(element);
        }
    };

    Typer.defaultOptions.media = true;

    function insertMediaButton(type) {
        return Typer.ui.button({
            requireWidgetEnabled: 'media',
            dialog: function (toolbar) {
                if (typeof toolbar.options.selectMedia === 'function') {
                    return toolbar.options.selectMedia(type);
                }
                return Typer.ui.prompt('typer:media:selectImage');
            },
            execute: function (toolbar, self, tx, value) {
                tx.insertWidget('media', value);
            },
            enabled: function (toolbar) {
                return toolbar.typer.getSelection().widgetAllowed('media');
            },
            visible: function (toolbar) {
                return toolbar.typer.widgetEnabled('media');
            }
        });
    }

    Typer.ui.addControls('typer', {
        'widget:media': Typer.ui.group('typer:media:*'),
        'insert:image': insertMediaButton('image'),
        'insert:video': insertMediaButton('video'),
        'media:filePicker': Typer.ui.button({
            requireWidget: 'media',
            stateChange: function (toolbar, self) {
                self.value = $(self.widget.element).attr('src');
                self.label = (/(?:^|\/)([^/?#]+)(?:\?.+)?$/.exec(self.value) || [])[1] || '';
            },
            dialog: function (toolbar, self) {
                if (typeof toolbar.options.selectMedia === 'function') {
                    var mediaType = reMediaType.exec(self.label) && (RegExp.$1 ? 'image' : RegExp.$2 ? 'video' : 'audio');
                    return toolbar.options.selectMedia(mediaType, self.value);
                }
                return Typer.ui.prompt('dialog:selectImage', self.value);
            },
            execute: function (toolbar, self, tx, value) {
                $(self.widget.element).attr('src', value.src || value);
            }
        }),
        'media:altText': Typer.ui.textbox({
            requireWidget: 'media',
            hiddenWhenDisabled: true,
            stateChange: function (toolbar, self) {
                self.value = $(self.widget.element).attr('alt');
            },
            execute: function (toolbar, self, tx) {
                $(self.widget.element).attr('alt', self.value).attr('title', self.value);
            }
        })
    });

    Typer.ui.addLabels('en', 'typer', {
        'insert:image': 'Image',
        'insert:video': 'Video',
        'media:altText': 'Alternate text',
        'media:selectImage': 'Enter image URL'
    });

    Typer.ui.addIcons('material', 'typer', {
        'insert:image': '\ue251',  // insert_photo
        'insert:video': '\ue04b',  // videocam
        'media:altText': '\ue0b9'  // comment
    });

}(jQuery, Typer));
