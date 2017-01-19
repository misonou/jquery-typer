(function ($, Typer) {
    'use strict';

    Typer.widgets.link = {
        element: 'a[href]',
        inline: true,
        insert: function (tx, value) {
            value = value || (/^[a-z]+:\/\//g.test(tx.selection.getSelectedText()) && RegExp.input) || '#';
            if (tx.selection.isCaret) {
                var element = $('<a>').text(value).attr('href', value)[0];
                tx.insertHtml(element);
            } else {
                tx.execCommand('createLink', value);
            }
        },
        remove: 'keepText',
        commands: {
            setURL: function (tx, value) {
                tx.widget.element.href = value;
            },
            unlink: function (tx) {
                tx.removeWidget(tx.widget);
            }
        }
    };

    Typer.defaultOptions.link = true;

    $.extend(Typer.ui.controls, {
        'toolbar:link': Typer.ui.callout({
            controls: 'link:*',
            requireWidgetEnabled: 'link',
            hiddenWhenDisabled: true,
            dialog: function (toolbar, self) {
                if (self.widget) {
                    return null;
                }
                var currentValue = self.widget ? $(self.widget.element).attr('href') : /^[a-z]+:\/\//g.test(toolbar.typer.getSelection().getSelectedText()) ? RegExp.input : '';
                if (typeof toolbar.options.selectLink === 'function') {
                    return toolbar.options.selectLink(currentValue);
                }
                return toolbar.prompt('dialog:selectLink', currentValue);
            },
            execute: function (toolbar, self, tx, value) {
                if (!value) {
                    return null;
                }
                if (self.widget) {
                    tx.typer.invoke('setURL', value);
                } else {
                    tx.insertWidget('link', value);
                }
            },
            active: function (toolbar, self) {
                return self.widget;
            }
        }),
        'link:url': Typer.ui.textbox({
            hiddenWhenDisabled: true,
            requireWidget: 'link',
            execute: 'setURL',
            stateChange: function (toolbar, self) {
                self.value = $(self.widget.element).attr('href');
            }
        }),
        'link:blank': Typer.ui.checkbox({
            hiddenWhenDisabled: true,
            requireWidget: 'link',
            stateChange: function (toolbar, self) {
                self.value = $(self.widget.element).attr('target') === '_blank';
            },
            execute: function (toolbar, self) {
                if (self.value) {
                    $(self.widget.element).attr('target', '_blank');
                } else {
                    $(self.widget.element).removeAttr('target');
                }
            }
        }),
        'link:unlink': Typer.ui.button({
            hiddenWhenDisabled: true,
            requireWidget: 'link',
            execute: 'unlink'
        })
    });

    Typer.ui.addLabels('en', {
        'toolbar:link': 'Insert Link',
        'link:url': 'Link URL',
        'link:blank': 'Open in New Window',
        'link:unlink': 'Remove Link',
        'dialog:selectLink': 'Enter URL'
    });

    Typer.ui.addIcons('material', {
        'toolbar:link': 'insert_link',
        'link:url': 'insert_link'
    });

    Typer.ui.addHook('space', function (typer) {
        if (typer.widgetEnabled('link')) {
            var selection = typer.getSelection().clone();
            if (selection.getCaret('start').moveByWord(-1) && selection.focusNode.widget.id !== 'link' && /^[a-z]+:\/\//g.test(selection.getSelectedText())) {
                typer.snapshot(true);
                typer.getSelection().select(selection);
                typer.invoke(function (tx) {
                    tx.insertWidget('link');
                });
                typer.getSelection().collapse('end');
            }
        }
    });

} (jQuery, window.Typer));
