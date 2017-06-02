(function ($, Typer) {
    'use strict';

    function encode(v) {
        var a = document.createTextNode(v.replace(/\s/g, '\u00a0')),
            b = document.createElement('div');
        b.appendChild(a);
        return b.innerHTML;
    }

    function filter(suggestions, needle, count) {
        suggestions = suggestions.map(function (v) {
            return {
                value: String(v)
            };
        }).filter(function (v) {
            var vector = [];
            var str = v.value.toLowerCase();
            var j = 0,
                lastpos = -1;
            for (var i = 0; i < needle.length; i++) {
                var l = needle.charAt(i).toLowerCase();
                if (l == ' ') {
                    continue;
                }
                j = str.indexOf(l, j);
                if (j == -1) {
                    return false;
                }
                vector[vector.length] = j - lastpos - 1;
                lastpos = j++;
            }
            v.firstIndex = vector[0];
            v.consecutiveMatches = /^(0+)/.test(vector.slice(0).sort().join('')) && RegExp.$1.length;
            v.formattedText = '';
            j = 0;
            for (i = 0; i < vector.length; i++) {
                v.formattedText += encode(v.value.substr(j, vector[i])) + '<b>' + encode(v.value[j + vector[i]]) + '</b>';
                j += vector[i] + 1;
            }
            v.formattedText += encode(v.value.slice(j));
            v.formattedText = v.formattedText.replace(/<\/b><b>/g, '');
            return true;
        });
        suggestions.sort(function (a, b) {
            return ((b.consecutiveMatches - a.consecutiveMatches) + (a.firstIndex - b.firstIndex)) || a.value.localeCompare(b.value);
        });
        return suggestions.slice(0, count);
    }

    Typer.presets.keyword = {
        inline: true,
        defaultOptions: false,
        disallowedElement: '*',
        options: {
            allowFreeInput: true,
            suggestionCount: 5,
            suggestions: false,
            validate: function () {
                return true;
            }
        },
        overrides: {
            getValue: function () {
                return $('span', this.element).map(function (i, v) {
                    return v.childNodes[0].data;
                }).get();
            },
            setValue: function (values) {
                this.invoke(function (tx) {
                    function validateAndAdd(v) {
                        if (tx.typer.presetOptions.validate(v)) {
                            tx.insertWidget('tag', v);
                        }
                    }
                    tx.selection.select(tx.typer.element, 'contents');
                    tx.insertText('');
                    if ($.isArray(values)) {
                        $.map(values, validateAndAdd);
                    } else {
                        String(values).replace(/\S+/g, validateAndAdd);
                    }
                });
            },
            hasContent: function () {
                return !!($('span', this.element)[0] || this.extractText());
            },
            validate: function () {
                var value = this.getValue();
                if (this.presetOptions.required && !value.length) {
                    return false;
                }
                return !$('.invalid', this.element)[0];
            }
        },
        widgets: {
            tag: {
                element: 'span',
                inline: true,
                editable: 'none',
                insert: function (tx, value) {
                    tx.insertHtml('<span class="typer-ui-keyword">' + value + '<i>delete</i></span>');
                },
                click: function (e) {
                    if (e.target !== e.widget.element) {
                        e.widget.remove();
                    }
                }
            }
        },
        commands: {
            add: function (tx, value) {
                if (!value || tx.typer.getValue().indexOf(value) >= 0) {
                    return;
                }
                var lastSpan = $('span:last', tx.typer.element)[0];
                if (lastSpan) {
                    tx.selection.select(lastSpan, false);
                } else {
                    tx.selection.select(tx.typer.element, 0);
                }
                tx.insertWidget('tag', value);
                lastSpan = $('span:last', tx.typer.element)[0];
                tx.selection.select(Typer.createRange(lastSpan, false), Typer.createRange(tx.typer.element, -0));
                tx.insertText('');

                var preset = tx.typer.getStaticWidget('__preset__');
                $(lastSpan).toggleClass('invalid', (!preset.options.allowFreeInput && preset.allowedValues.indexOf(value) < 0));
            }
        },
        init: function (e) {
            e.typer.getSelection().moveToText(e.typer.element, -0);
            e.widget.callout = $('<div class="typer-ui typer-ui-float"><div class="typer-ui-buttonlist"></div></div>')[0];
            $(e.widget.callout).on('click', 'button', function (e2) {
                e.typer.invoke('add', $(e2.currentTarget).text());
                $(e.typer.element).focus();
                $(e.widget.callout).detach();
            });
            e.typer.retainFocus(e.widget.callout);
        },
        click: function (e) {
            e.widget.selectedIndex = -1;
        },
        focusout: function (e) {
            e.widget.selectedIndex = -1;
            $(e.widget.callout).detach();
            var value = Typer.trim(e.typer.extractText());
            if (value && e.widget.options.validate(value)) {
                e.typer.invoke('add', value);
            }
        },
        upArrow: function (e) {
            if (e.widget.selectedIndex >= 0) {
                $('button', e.widget.callout).removeClass('active').eq(e.widget.selectedIndex--).prev().addClass('active');
            }
        },
        downArrow: function (e) {
            if (e.widget.selectedIndex < $('button', e.widget.callout).length - 1) {
                $('button', e.widget.callout).removeClass('active').eq(++e.widget.selectedIndex).addClass('active');
            }
        },
        enter: function (e) {
            if (e.widget.selectedIndex >= 0) {
                e.typer.invoke('add', $('button', e.widget.callout).eq(e.widget.selectedIndex).text());
                e.widget.selectedIndex = -1;
            } else {
                var value = Typer.trim(e.typer.extractText());
                if (value && e.widget.options.validate(value)) {
                    e.typer.invoke('add', value);
                }
            }
        },
        keystroke: function (e) {
            if (e.data === 'escape' && $.contains(document.body, e.widget.callout)) {
                e.widget.selectedIndex = -1;
                $(e.widget.callout).detach();
                e.preventDefault();
            }
        },
        contentChange: function (e) {
            if (e.data === 'textInput' || e.data === 'keystroke') {
                var value = Typer.trim(e.typer.extractText());
                var suggestions = e.widget.options.suggestions || [];
                if ($.isFunction(suggestions)) {
                    suggestions = suggestions(value);
                }
                $.when(suggestions).done(function (suggestions) {
                    var currentValues = e.typer.getValue();
                    e.widget.allowedValues = suggestions;
                    suggestions = suggestions.filter(function (v) {
                        return currentValues.indexOf(v) < 0;
                    });
                    suggestions = filter(suggestions, value, e.widget.options.suggestionCount);
                    if (value && e.widget.options.allowFreeInput) {
                        suggestions.push({
                            formattedText: '<i>' + encode(value) + '</i>'
                        });
                    }
                    var html;
                    if (suggestions.length) {
                        html = '<button>' + suggestions.map(function (v) {
                            return v.formattedText;
                        }).join('</button><button>') + '</button>';
                    } else {
                        html = '<button class="disabled">No suggestions</button>';
                    }
                    $(e.widget.callout).children().html(html);
                });
                setTimeout(function () {
                    if (e.typer.focused() && !$.contains(document.body, e.widget.callout)) {
                        var r = e.typer.element.getBoundingClientRect();
                        $(e.widget.callout).appendTo(document.body).css({
                            position: 'fixed',
                            top: r.bottom,
                            left: r.left
                        });
                        Typer.ui.setZIndex(e.widget.callout, e.typer.element);
                    }
                });
            }
        }
    };

}(jQuery, window.Typer));
