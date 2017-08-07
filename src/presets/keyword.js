(function ($, Typer) {
    'use strict';

    function encode(v) {
        var a = document.createTextNode(v.replace(/\s/g, '\u00a0')),
            b = document.createElement('div');
        b.appendChild(a);
        return b.innerHTML;
    }

    function fuzzyMatch(haystack, needle) {
        haystack = String(haystack || '');
        var vector = [];
        var str = haystack.toLowerCase();
        var j = 0;
        var lastpos = -1;
        for (var i = 0; i < needle.length; i++) {
            var l = needle.charAt(i).toLowerCase();
            if (l == ' ') {
                continue;
            }
            j = str.indexOf(l, j);
            if (j == -1) {
                return {
                    firstIndex: Infinity,
                    consecutiveMatches: -1,
                    formattedText: haystack
                };
            }
            vector[vector.length] = j - lastpos - 1;
            lastpos = j++;
        }
        var firstIndex = vector[0];
        var consecutiveMatches = /^(0+)/.test(vector.slice(0).sort().join('')) && RegExp.$1.length;
        var formattedText = '';
        j = 0;
        for (i = 0; i < vector.length; i++) {
            formattedText += encode(haystack.substr(j, vector[i])) + '<b>' + encode(haystack[j + vector[i]]) + '</b>';
            j += vector[i] + 1;
        }
        formattedText += encode(haystack.slice(j));
        return {
            firstIndex: firstIndex,
            consecutiveMatches: consecutiveMatches,
            formattedText: formattedText.replace(/<\/b><b>/g, '')
        };
    }

    function processSuggestions(suggestions, needle, count) {
        suggestions = suggestions.filter(function (v) {
            $.extend(v, fuzzyMatch(v.displayText, needle));
            var m = fuzzyMatch(v.value, needle);
            v.firstIndex = Math.min(v.firstIndex, m.firstIndex);
            v.consecutiveMatches = Math.max(v.consecutiveMatches, m.consecutiveMatches);
            if (v.matches) {
                v.matches.forEach(function (w) {
                    var m = fuzzyMatch(w, needle);
                    v.firstIndex = Math.min(v.firstIndex, m.firstIndex);
                    v.consecutiveMatches = Math.max(v.consecutiveMatches, m.consecutiveMatches);
                });
            }
            return v.firstIndex !== Infinity;
        });
        suggestions.sort(function (a, b) {
            return ((b.consecutiveMatches - a.consecutiveMatches) + (a.firstIndex - b.firstIndex)) || a.value.localeCompare(b.value);
        });
        return suggestions.slice(0, count);
    }

    Typer.presets.keyword = {
        options: {
            required: false,
            allowFreeInput: true,
            allowedValues: null,
            suggestionCount: 5,
            suggestions: false,
            validate: function () {
                return true;
            }
        },
        overrides: {
            getValue: function (preset) {
                return $('span', this.element).map(function (i, v) {
                    return $(v).data('value');
                }).get();
            },
            setValue: function (preset, values) {
                this.invoke(function (tx) {
                    var add = tx.typer.invoke.bind(tx.typer, 'add');
                    tx.selection.select(tx.typer.element, 'contents');
                    tx.insertText('');
                    if ($.isArray(values)) {
                        $.map(values, add);
                    } else {
                        String(values).replace(/\S+/g, add);
                    }
                });
            },
            hasContent: function () {
                return !!($('span', this.element)[0] || this.extractText());
            },
            validate: function (preset) {
                var value = this.getValue();
                if (preset.options.required && !value.length) {
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
                    tx.insertHtml('<span class="typer-ui-keyword" data-value="' + encode(value.value) + '">' + encode(value.displayText) + '<i>delete</i></span>');
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
                if (!value || tx.typer.getValue().indexOf(value.value || value) >= 0) {
                    return;
                }
                if (typeof value === 'string') {
                    value = {
                        value: value,
                        displayText: value
                    };
                }
                // TODO: map display text from previous suggestions
                // and validate from suggestions

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
                if ((!preset.options.allowFreeInput && preset.allowedValues.indexOf(value.value) < 0) || !preset.options.validate(value.value)) {
                    $(lastSpan).addClass('invalid');
                }
            }
        },
        init: function (e) {
            e.typer.getSelection().moveToText(e.typer.element, -0);
            e.widget.allowedValues = [];
            e.widget.suggestions = [];
            e.widget.callout = Typer.ui({
                type: 'contextmenu',
                typer: e.typer
            });
            $(e.widget.callout.element).on('click', 'button', function (e2) {
                e.typer.invoke('add', e.widget.suggestions[$(this).index()]);
                e.typer.getSelection().focus();
                e.widget.callout.hide();
            });
        },
        click: function (e) {
            e.widget.selectedIndex = -1;
        },
        focusout: function (e) {
            e.widget.selectedIndex = -1;
            e.widget.callout.hide();
            var value = Typer.trim(e.typer.extractText());
            if (value && e.widget.options.validate(value)) {
                e.typer.invoke('add', value);
            }
        },
        upArrow: function (e) {
            if (e.widget.selectedIndex >= 0) {
                $('button', e.widget.callout.element).removeClass('active').eq(e.widget.selectedIndex--).prev().addClass('active');
            }
        },
        downArrow: function (e) {
            if (e.widget.selectedIndex < $('button', e.widget.callout.element).length - 1) {
                $('button', e.widget.callout.element).removeClass('active').eq(++e.widget.selectedIndex).addClass('active');
            }
        },
        enter: function (e) {
            if (e.widget.selectedIndex >= 0) {
                e.typer.invoke('add', e.widget.suggestions[e.widget.selectedIndex]);
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
                e.widget.callout.hide();
                e.preventDefault();
            }
        },
        contentChange: function (e) {
            if (e.data === 'textInput' || e.data === 'keystroke') {
                var value = Typer.trim(e.typer.extractText());
                var suggestions = e.widget.options.suggestions || e.widget.options.allowedValues || [];
                if ($.isFunction(suggestions)) {
                    suggestions = suggestions(value);
                }
                $.when(suggestions).done(function (suggestions) {
                    suggestions = suggestions.map(function (v) {
                        if (typeof v === 'string') {
                            return {
                                value: v,
                                displayText: v
                            };
                        }
                        return v;
                    });
                    suggestions.forEach(function (v) {
                        if (e.widget.allowedValues.indexOf(v.value) <= 0) {
                            e.widget.allowedValues.push(v.value);
                        }
                    });

                    var currentValues = e.typer.getValue();
                    suggestions = suggestions.filter(function (v) {
                        return currentValues.indexOf(v.value) < 0;
                    });
                    suggestions = processSuggestions(suggestions, value, e.widget.options.suggestionCount);
                    if (value && e.widget.options.allowFreeInput) {
                        suggestions.push({
                            value: value,
                            displayText: value,
                            formattedText: '<i>' + encode(value) + '</i>'
                        });
                    }
                    e.widget.suggestions = suggestions;

                    var html;
                    if (suggestions.length) {
                        html = '<button>' + suggestions.map(function (v) {
                            return v.formattedText;
                        }).join('</button><button>') + '</button>';
                    } else {
                        html = '<button class="disabled">No suggestions</button>';
                    }
                    $('.typer-ui-buttonlist', e.widget.callout.element).html(html);
                });
                setTimeout(function () {
                    if (e.typer.focused()) {
                        e.widget.callout.show(e.typer.element);
                    }
                });
            }
        }
    };

}(jQuery, window.Typer));
