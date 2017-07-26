(function ($, Typer) {
    'use strict';

    var MS_PER_DAY = 86400000;
    var monthstr = 'January February March April May June July August September October November December'.split(' ');
    var shortWeekday = 'Su Mo Tu We Th Fr Sa'.split(' ');
    var activeTyper;
    var datepickerMenuUI;

    function repeat(str, count) {
        return new Array(count + 1).join(str);
    }

    function normalizeDate(mode, date) {
        date = new Date(+date);
        date.setHours(0, 0, 0, 0);
        switch (mode) {
            case 'week':
                date.setDate(date.getDate() - date.getDay());
                break;
            case 'month':
                date.setDate(1);
                break;
        }
        return date;
    }

    function stepDate(mode, date, dir) {
        switch (mode) {
            case 'day':
                return new Date(+date + MS_PER_DAY * dir);
            case 'week':
                return new Date(+date + MS_PER_DAY * 7 * dir);
            case 'month':
                return new Date(date.getFullYear(), date.getMonth() + dir, date.getDate());
            case 'year':
                return new Date(date.getFullYear() + dir, date.getMonth(), date.getDate());
        }
    }

    function formatDate(mode, date) {
        switch (mode) {
            case 'month':
                return monthstr[date.getMonth()] + ' ' + date.getFullYear();
            case 'week':
                var end = stepDate('day', date, 6);
                return monthstr[date.getMonth()] + ' ' + date.getDate() + ' - ' + (end.getMonth() !== date.getMonth() ? monthstr[end.getMonth()] + ' ' : '') + end.getDate() + ', ' + date.getFullYear();
        }
        return monthstr[date.getMonth()] + ' ' + date.getDate() + ', ' + date.getFullYear();
    }

    function initDatapicker() {
        datepickerMenuUI = Typer.ui({
            type: 'contextmenu',
            controls: [Typer.ui.calendar({
                name: 'calendar'
            })],
            controlExecuted: function (ui, control) {
                if (control.is('calendar')) {
                    activeTyper.setValue(ui.getValue(control));
                }
            }
        });
    }

    Typer.ui.define('calendar', {
        type: 'calendar',
        defaultNS: 'calendar',
        controls: '*',
        showButtonLabel: false,
        get value() {
            return normalizeDate(this.mode, this.selectedDate);
        },
        set value(value) {
            this.selectedDate = normalizeDate(this.mode, value);
            this.ui.trigger(this, 'showMonth', this.selectedDate);
        },
        init: function (ui, self) {
            var $table = $('table', self.element);
            $(repeat('<tr></tr>', 7)).appendTo($table);
            $(repeat('<th></th>', 7)).appendTo($table.find('tr:first'));
            $(repeat('<td></td>', 7)).appendTo($table.find('tr+tr'));
            $('<button>').appendTo($table.find('td'));
            $table.find('th').text(function (i) {
                return shortWeekday[i];
            });
            $table.bind('mousewheel', function (e) {
                ui.trigger(self, 'showMonth', Typer.ui.getWheelDelta(e));
            });
            $table.find('td').click(function () {
                var monthDelta = $(this).hasClass('prev') ? -1 : $(this).hasClass('next') ? 1 : 0;
                ui.setValue(self, new Date(self.currentMonth.getFullYear(), self.currentMonth.getMonth() + monthDelta, +this.textContent));
                ui.execute(self);
            });
        },
        stateChange: function (ui, self) {
            ui.trigger(self, 'showMonth', self.currentMonth || self.value || new Date());
        },
        showMonth: function (ui, self, date) {
            if (isNaN(+date)) {
                return;
            }
            if (typeof date === 'number') {
                date = stepDate('month', self.currentMonth, date);
            }
            var y = date.getFullYear();
            var m = date.getMonth();
            var currentMonth = new Date(y, m);
            var firstDay = currentMonth.getDay();
            var $buttons = $('td', self.element).removeClass('selected');

            if (currentMonth !== self.currentMonth) {
                var numDays = new Date(y, m + 1, 0).getDate();
                var numDaysLast = new Date(y, m, 0).getDate();
                $buttons.removeClass('prev cur next today');
                $buttons.each(function (i, v) {
                    if (i < firstDay) {
                        $(v).children().text(i + 1 - firstDay + numDaysLast).end().addClass('prev');
                    } else if (i >= numDays + firstDay) {
                        $(v).children().text(i + 1 - firstDay - numDays).end().addClass('next');
                    } else {
                        $(v).children().text(i + 1 - firstDay).end().addClass('cur');
                    }
                });
                var today = new Date();
                if (today.getFullYear() === y && today.getMonth() === m) {
                    $buttons.filter('.cur').eq(today.getDate() - 1).addClass('today');
                }
                $('tr:last', self.element).toggle(firstDay + numDays > 35);

                var cy = self.resolve('year')[0];
                var cm = self.resolve('month')[0];
                $.each(cy.controls, function (i, v) {
                    v.label = v.value = y + i - 5;
                });
                cy.value = y;
                cm.value = m;
                self.currentMonth = currentMonth;
            }
            if (self.value.getFullYear() === y && self.value.getMonth() === m) {
                switch (self.mode) {
                    case 'day':
                        $buttons.eq(self.value.getDate() + firstDay - 1).addClass('selected');
                        break;
                    case 'week':
                        $buttons.slice(self.value.getDate() + firstDay - 1, self.value.getDate() + firstDay + 6).addClass('selected');
                        break;
                    case 'month':
                        $buttons.filter('td.cur').addClass('selected');
                        break;
                }
            }
            $(self.element).toggleClass('select-range', self.mode !== 'day');
        }
    });

    Typer.ui.addControls('calendar', {
        year: Typer.ui.dropdown({
            controls: function () {
                var arr = [];
                for (var i = 0; i < 11; i++) {
                    arr[i] = Typer.ui.button();
                }
                return arr;
            },
            execute: function (ui, self) {
                ui.trigger(self.contextualParent, 'showMonth', new Date(self.value, ui.getValue('calendar:month')));
            }
        }),
        month: Typer.ui.dropdown({
            execute: function (ui, self) {
                ui.trigger(self.contextualParent, 'showMonth', new Date(ui.getValue('calendar:year'), self.value));
            }
        }),
        prev: Typer.ui.button({
            buttonsetGroup: 'right',
            execute: function (ui, self) {
                ui.trigger(self.contextualParent, 'showMonth', -1);
            }
        }),
        today: Typer.ui.button({
            buttonsetGroup: 'right',
            execute: function (ui, self) {
                ui.setValue(self.contextualParent, new Date());
            }
        }),
        next: Typer.ui.button({
            buttonsetGroup: 'right',
            execute: function (ui, self) {
                ui.trigger(self.contextualParent, 'showMonth', 1);
            }
        })
    });

    Typer.ui.addIcons('material', 'calendar', {
        today: '\ue8df', // today
        prev: '\ue314', // keyboard_arrow_left
        next: '\ue315', // keyboard_arrow_right
    });

    Typer.ui.addLabels('en', 'calendar', {
        today: 'Today',
        prev: 'Previous month',
        next: 'Next month'
    });

    var monthLabels = {};
    var monthControls = {};
    for (var i = 0; i < 12; i++) {
        monthLabels[monthstr[i].toLowerCase()] = monthstr[i];
        monthControls[monthstr[i].toLowerCase()] = Typer.ui.button({
            value: i
        });
    }
    Typer.ui.addControls('calendar:month', monthControls);
    Typer.ui.addLabels('en', 'calendar:month', monthLabels);

    $.extend(Typer.ui.themeExtensions, {
        calendar: '<div class="typer-ui-calendar"><div class="typer-ui-calendar-header"><br x:t="buttonset"/></div><div class="typer-ui-calendar-body"><table></table></div></div>'
    });

    Typer.presets.datepicker = {
        options: {
            mode: 'day',
            required: false
        },
        overrides: {
            getValue: function (preset) {
                return preset.selectedDate ? normalizeDate(preset.options.mode, preset.selectedDate) : null;
            },
            setValue: function (preset, date) {
                preset.selectedDate = date && normalizeDate(preset.options.mode, date);
                this.selectAll();
                this.invoke(function (tx) {
                    tx.insertText(date ? formatDate(preset.options.mode, preset.selectedDate) : '');
                });
                if (this === activeTyper) {
                    datepickerMenuUI.setValue('calendar', preset.selectedDate || new Date());
                }
            },
            hasContent: function (preset) {
                return !!preset.selectedDate;
            },
            validate: function (preset) {
                return !preset.options.required || !!preset.selectedDate;
            }
        },
        contentChange: function (e) {
            if (e.typer === activeTyper && e.data !== 'script') {
                var date = new Date(e.typer.extractText());
                if (!isNaN(+date)) {
                    datepickerMenuUI.setValue('calendar', normalizeDate(e.widget.options.mode, date));
                }
            }
        },
        click: function (e) {
            if (e.typer === activeTyper) {
                datepickerMenuUI.show(e.typer.element);
            }
        },
        mousewheel: function (e) {
            e.typer.setValue(stepDate(e.widget.options.mode, e.typer.getValue(), e.data));
            e.preventDefault();
        },
        upArrow: function (e) {
            e.typer.setValue(stepDate(e.widget.options.mode, e.typer.getValue(), -1));
        },
        downArrow: function (e) {
            e.typer.setValue(stepDate(e.widget.options.mode, e.typer.getValue(), 1));
        },
        focusin: function (e) {
            if (!datepickerMenuUI) {
                initDatapicker();
            }
            e.typer.retainFocus(datepickerMenuUI.element);
            activeTyper = e.typer;
            datepickerMenuUI.setValue('calendar', 'mode', e.widget.options.mode);
            datepickerMenuUI.setValue('calendar', e.typer.getValue() || new Date());
            datepickerMenuUI.show(e.typer.element);
        },
        focusout: function (e) {
            if (e.typer === activeTyper) {
                e.typer.setValue(datepickerMenuUI.getValue('calendar'));
            }
            datepickerMenuUI.hide();
        }
    };

}(jQuery, window.Typer));
