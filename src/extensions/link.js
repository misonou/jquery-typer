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
            value = normalizeUrl(value || (/^[a-z]+:\/\//g.test(tx.selection.getSelectedText()) && RegExp.input));
            if (tx.selection.isCaret) {
                var element = $('<a>').text(value).attr('href', value)[0];
                tx.insertHtml(element);
            } else {
                tx.execCommand('createLink', value);
                tx.selection.collapse('end');
            }
        },
        remove: 'keepText',
        ctrlClick: function (e) {
            window.open(e.widget.element.href);
        },
        commands: {
            setURL: function (tx, value) {
                tx.widget.element.href = normalizeUrl(value);
                tx.trackChange(tx.widget.element);
            },
            unlink: function (tx) {
                tx.removeWidget(tx.widget);
            }
        }
    };

    Typer.defaultOptions.link = true;

    $.extend(Typer.ui.controls, {
        'toolbar:link': Typer.ui.button({
            after: 'toolbar:insert',
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
                return toolbar.openDialog('dialog:selectLink', currentValue);
            },
            execute: function (toolbar, self, tx, value) {
                if (!value) {
                    return null;
                }
                var href = value.href || value;
                var text = value.text || href;
                if (self.widget) {
                    $(self.widget.element).text(text);
                    tx.typer.invoke('setURL', href);
                    if (value.blank) {
                        $(self.widget.element).attr('target', '_blank');
                    } else {
                        $(self.widget.element).removeAttr('target');
                    }
                } else {
                    var textNode = Typer.createTextNode(text);
                    tx.insertHtml(textNode);
                    tx.selection.select(textNode);
                    tx.insertWidget('link', href);
                    if (tx.selection.focusNode.widget.id === 'link') {
                        if (value.blank) {
                            $(tx.selection.focusNode.widget.element).attr('target', '_blank');
                        } else {
                            $(tx.selection.focusNode.widget.element).removeAttr('target');
                        }
                    }
                }
                tx.trackChange(self.widget.element);
            },
            active: function (toolbar, self) {
                return self.widget;
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
        'dialog:selectLink:text': Typer.ui.textbox(),
        'dialog:selectLink:url': Typer.ui.textbox(),
        'dialog:selectLink:blank': Typer.ui.checkbox(),
        'dialog:selectLink': Typer.ui.dialog({
            controls: 'dialog:selectLink:* ui:prompt-buttonset',
            valueMap: {
                text: 'dialog:selectLink:text',
                href: 'dialog:selectLink:url',
                blank: 'dialog:selectLink:blank'
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
        'dialog:selectLink:text': 'Text',
        'dialog:selectLink:url': 'URL',
        'dialog:selectLink:blank': 'Open in new window',
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
