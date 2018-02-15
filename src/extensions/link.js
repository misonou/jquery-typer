(function ($, Typer) {
    'use strict';

    function normalizeUrl(url) {
        var anchor = document.createElement('A');
        anchor.href = url || '';
        if (location.protocol === anchor.protocol && location.hostname === anchor.hostname && (location.port === anchor.port || (location.port === '' && anchor.port === (location.protocol === 'https:' ? '443' : '80')))) {
            // for browsers incorrectly report URL components with a relative path
            // the supplied value must be at least an absolute path on the origin
            return anchor.pathname.replace(/^(?!\/)/, '/') + anchor.search + anchor.hash;
        }
        return url;
    }

    Typer.widgets.link = {
        element: 'a[href]',
        inline: true,
        insert: function (tx, value) {
            value = normalizeUrl(value);
            if (tx.selection.focusNode.widget.id === 'link') {
                tx.invoke('setURL', value);
            } else {
                tx.insertHtml($('<a>').text(tx.selection.getSelectedText() || value).attr('href', value)[0]);
            }
        },
        remove: 'keepText',
        init: function (e) {
            $(e.widget.element).css('cursor', 'text');
        },
        ctrlClick: function (e) {
            window.open(e.widget.element.href);
        },
        commands: {
            setURL: function (tx, value) {
                tx.widget.element.href = normalizeUrl(value);
            },
            unlink: function (tx) {
                tx.removeWidget(tx.widget);
            }
        }
    };

    Typer.defaultOptions.link = true;

    Typer.ui.addControls('typer', {
        'toolbar:link': Typer.ui.button({
            after: 'insert',
            requireWidgetEnabled: 'link',
            hiddenWhenDisabled: true,
            dialog: function (toolbar, self) {
                var selectedText = self.widget || toolbar.typer.getSelection().getSelectedText();
                var currentValue = {
                    href: self.widget ? $(self.widget.element).attr('href') : /^[a-z]+:\/\//g.test(selectedText) ? selectedText : '',
                    text: self.widget ? $(self.widget.element).text() : selectedText,
                    blank: self.widget ? $(self.widget.element).attr('target') === '_blank' : false
                };
                if (typeof toolbar.options.selectLink === 'function') {
                    return toolbar.options.selectLink(currentValue);
                }
                return Typer.ui('typer:link:selectLink', {
                    'typer:link:selectLink': currentValue
                }).execute();
            },
            execute: function (toolbar, self, tx, value) {
                if (!value) {
                    return null;
                }
                var href = value.href || value;
                var text = value.text || href;
                var element;
                if (self.widget) {
                    element = self.widget.element;
                } else {
                    element = $('<a href="">').text(text)[0];
                    tx.insertHtml(element);
                    tx.selection.select(element, 'contents');
                }
                $(element).text(text);
                tx.typer.invoke('setURL', href);
                if (value.blank) {
                    $(element).attr('target', '_blank');
                } else {
                    $(element).removeAttr('target');
                }
            },
            active: function (toolbar, self) {
                return toolbar.is('toolbar') ? self.widget : false;
            },
            visible: function (toolbar, self) {
                return toolbar.is('toolbar') || !!self.widget;
            },
            stateChange: function (toolbar, self) {
                self.label = self.widget ? 'typer:toolbar:link:edit' : 'typer:toolbar:link';
            }
        }),
        'contextmenu:link': Typer.ui.group('typer:toolbar:link typer:link:*(type:button)'),
        'link:open': Typer.ui.button({
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
        'link:selectLink:text': Typer.ui.textbox({
            presetOptions: {
                required: true
            }
        }),
        'link:selectLink:url': Typer.ui.textbox({
            presetOptions: {
                required: true
            }
        }),
        'link:selectLink:blank': Typer.ui.checkbox(),
        'link:selectLink:buttonset': Typer.ui.group('dialog:buttonOK dialog:buttonCancel remove', 'buttonset'),
        'link:selectLink:buttonset:remove': Typer.ui.button({
            hiddenWhenDisabled: true,
            buttonsetGroup: 'left',
            cssClass: 'warn',
            enabled: function (ui) {
                return !!ui.parentControl.widget;
            }
        }),
        'link:selectLink': Typer.ui.dialog({
            controls: '*',
            valueMap: {
                text: 'text',
                href: 'url',
                blank: 'blank'
            },
            setup: function (ui, self, resolve, reject) {
                self.resolveOne('buttonset').resolveOne('remove').execute = function () {
                    ui.parentControl.widget.remove();
                    reject();
                };
            }
        })
    });

    Typer.ui.addLabels('en', 'typer', {
        'toolbar:link': 'Insert hyperlink',
        'toolbar:link:edit': 'Edit hyperlink',
        'link:url': 'Link URL',
        'link:blank': 'Open in new window',
        'link:open': 'Open hyperlink',
        'link:unlink': 'Remove hyperlink',
        'link:selectLink': 'Create hyperlink',
        'link:selectLink:text': 'Text',
        'link:selectLink:url': 'URL',
        'link:selectLink:blank': 'Open in new window',
        'link:selectLink:buttonset:remove': 'Remove'
    });

    Typer.ui.addIcons('material', 'typer', {
        'toolbar:link': '\ue250', // insert_link
        'link:url': '\ue250' // insert_link
    });

    Typer.ui.addHook('space enter', function (e) {
        if (e.typer.widgetEnabled('link')) {
            var originalSelection = e.typer.getSelection().clone();
            var selection = originalSelection.clone();
            if (e.data === 'enter') {
                selection.moveByCharacter(-1);
            }
            if (selection.getCaret('start').moveByWord(-1) && selection.focusNode.widget.id !== 'link' && /^([a-z]+:\/\/\S+)|(\S+@\S+\.\S+)/g.test(selection.getSelectedText())) {
                var link = RegExp.$1 || ('mailto:' + RegExp.$2);
                e.typer.snapshot(true);
                e.typer.select(selection);
                e.typer.invoke(function (tx) {
                    tx.insertWidget('link', link);
                });
                e.typer.select(originalSelection);
                if (e.data === 'space') {
                    e.preventDefault();
                }
            }
        }
    });

}(jQuery, Typer));
