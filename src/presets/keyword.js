(function ($, Typer) {
    'use strict';

    function encode(v) {
        var a = document.createTextNode(v.replace(/\s/g, '\u00a0')),
            b = document.createElement('div');
        b.appendChild(a);
        return b.innerHTML;
    }

    function valueChanged(x, y) {
        var hash = {};
        x.forEach(function (v) {
            hash[v] = true;
        });
        y.forEach(function (v) {
            delete hash[v];
        });
        for (var i in hash) {
            return true;
        }
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

    function showSuggestions(preset) {
        var value = preset.typer.extractText();
        var suggestions = preset.options.suggestions || preset.options.allowedValues || [];
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
                preset.knownValues[v.value] = v.displayText;
            });

            var currentValues = preset.typer.getValue();
            suggestions = suggestions.filter(function (v) {
                return currentValues.indexOf(v.value) < 0;
            });
            suggestions = processSuggestions(suggestions, value, preset.options.suggestionCount);
            if (value && preset.options.allowFreeInput) {
                suggestions.push({
                    value: value,
                    displayText: value,
                    formattedText: '<i>' + encode(value) + '</i>'
                });
            }
            preset.suggestions = suggestions;

            var html;
            if (suggestions.length) {
                html = '<button>' + suggestions.map(function (v) {
                    return v.formattedText;
                }).join('</button><button>') + '</button>';
            } else {
                html = '<button class="disabled">No suggestions</button>';
            }
            $('.typer-ui-buttonlist', preset.callout.element).html(html);
        });
        setTimeout(function () {
            if (preset.typer.focused()) {
                preset.callout.show(preset.typer.element);
            }
        });
    }

    function validate(preset, value) {
        return (preset.options.allowFreeInput || preset.knownValues[value]) && preset.options.validate(value);
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
                    return String($(v).data('value'));
                }).get();
            },
            setValue: function (preset, values) {
                values = ($.isArray(values) ? values : String(values).split(/\s+/)).filter(function (v) {
                    return v;
                });
                if (valueChanged(values, this.getValue())) {
                    this.invoke(function (tx) {
                        tx.selection.select(tx.typer.element, 'contents');
                        tx.insertText('');
                        values.forEach(function (v) {
                            tx.typer.invoke('add', v);
                        });
                    });
                }
            },
            hasContent: function () {
                return !!($('span', this.element)[0] || this.extractText());
            },
            validate: function (preset, assert) {
                assert(!preset.options.required || this.getValue().length, 'required');
                assert(!$('.invalid', this.element)[0], 'invalid-value');
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
                        displayText: tx.widget.knownValues[value] || value
                    };
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
                if (!validate(tx.widget, value.value)) {
                    $(lastSpan).addClass('invalid');
                }
            }
        },
        init: function (e) {
            e.typer.getSelection().moveToText(e.typer.element, -0);
            e.widget.knownValues = {};
            e.widget.suggestions = [];
            e.widget.callout = Typer.ui({
                type: 'contextmenu',
                typer: e.typer
            });
            $(e.widget.callout.element).on('click', 'button', function (e2) {
                e.typer.invoke('add', e.widget.suggestions[$(this).index()]);
                e.typer.getSelection().focus();
                showSuggestions(e.widget);
            });
        },
        click: function (e) {
            e.widget.selectedIndex = -1;
        },
        focusin: function (e) {
            showSuggestions(e.widget);
        },
        focusout: function (e) {
            e.widget.selectedIndex = -1;
            e.widget.callout.hide();
            e.typer.invoke('add', e.typer.extractText());
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
                e.typer.invoke('add', e.typer.extractText());
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
            if (e.source === 'input' || e.source === 'keyboard') {
                showSuggestions(e.widget);
            }
        }
    };

}(jQuery, window.Typer));
