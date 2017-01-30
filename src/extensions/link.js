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
                tx.selection.collapse('end');
            }
        },
        remove: 'keepText',
        click: function () { },
        ctrlClick: function (e) {
            window.open(e.widget.element.href);
        },
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
            after: 'toolbar:insert',
            requireWidgetEnabled: 'link',
            hiddenWhenDisabled: true,
            dialog: function (toolbar, self) {
                if (self.widget) {
                    return null;
                }
                var selectedText = self.widget || toolbar.typer.getSelection().getSelectedText();
                var currentValue = {
                    href: self.widget ? $(self.widget.element).attr('href') : /^[a-z]+:\/\//g.test(selectedText) ? selectedText : '',
                    text: self.widget ? $(self.widget.element).text() : selectedText
                };
                if (typeof toolbar.options.selectLink === 'function') {
                    return toolbar.options.selectLink(currentValue);
                }
                return toolbar.spawn('dialog:selectLink', currentValue);
            },
            execute: function (toolbar, self, tx, value) {
                if (!value) {
                    return null;
                }
                var href = value.href || value;
                var text = value.text || href;
                if (self.widget) {
                    $(self.element).text(text);
                    tx.typer.invoke('setURL', href);
                } else {
                    var textNode = Typer.createTextNode(text);
                    tx.insertHtml(textNode);
                    tx.selection.select(textNode);
                    tx.insertWidget('link', href);
                }
            },
            active: function (toolbar, self) {
                return self.widget;
            }
        }),
        'link:url': Typer.ui.textbox({
            context: 'toolbar',
            hiddenWhenDisabled: true,
            requireWidget: 'link',
            execute: 'setURL',
            stateChange: function (toolbar, self) {
                self.value = $(self.widget.element).attr('href');
            }
        }),
        'link:blank': Typer.ui.checkbox({
            context: 'toolbar',
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
        'link:open': Typer.ui.button({
            context: 'contextmenu',
            requireWidget: 'link',
            hiddenWhenDisabled: true,
            shortcut: 'ctrlClick',
            execute: function (toolbar, self) {
                window.open(self.widget.element.href);
            }
        }),
        'link:unlink': Typer.ui.button({
            hiddenWhenDisabled: true,
            requireWidget: 'link',
            execute: 'unlink'
        }),
        'contextmenu:link': Typer.ui.group('link:*'),
        'dialog-control:selectLink-text': Typer.ui.textbox(),
        'dialog-control:selectLink-url': Typer.ui.textbox(),
        'dialog:selectLink': Typer.ui.dialog({
            controls: 'dialog-control:selectLink-text dialog-control:selectLink-url ui:prompt-buttonset',
            valueMap: {
                text: 'dialog-control:selectLink-text',
                href: 'dialog-control:selectLink-url'
            }
        })
    });

    Typer.ui.addLabels('en', {
        'toolbar:link': 'Insert hyperlink',
        'link:url': 'Link URL',
        'link:blank': 'Open in new window',
        'link:open': 'Open hyperlink',
        'link:unlink': 'Remove hyperlink',
        'dialog:selectLink': 'Create hyperlink',
        'dialog-control:selectLink-text': 'Text',
        'dialog-control:selectLink-url': 'URL'
    });

    Typer.ui.addIcons('material', {
        'toolbar:link': '\ue250',  // insert_link
        'link:url': '\ue250'       // insert_link
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
