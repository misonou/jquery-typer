(function ($, Typer, Date) {
    'use strict';

    var MS_PER_DAY = 86400000;
    var monthstr = 'January February March April May June July August September October November December'.split(' ');
    var shortWeekday = 'Su Mo Tu We Th Fr Sa'.split(' ');
    var activeTyper;
    var callout;

    function getFullYear(d) {
        return d.getFullYear();
    }

    function getMonth(d) {
        return d.getMonth();
    }

    function getDate(d) {
        return d.getDate();
    }

    function getHours(d) {
        return d.getHours();
    }

    function getMinutes(d) {
        return d.getMinutes();
    }

    function repeat(str, count) {
        return new Array(count + 1).join(str);
    }

    function sameMonth(x, y) {
        return getFullYear(x) === getFullYear(y) && getMonth(x) === getMonth(y);
    }

    function parseMaxima(d) {
        if (typeof d === 'string' && /^today|([+-]\d+)(day|week|month|year)?$/g.test(d)) {
            return RegExp.$1 ? stepDate(RegExp.$2 || 'day', new Date(), +RegExp.$1) : new Date();
        }
        d = d === null ? undefined : d instanceof Date ? d : new Date(d);
        return isNaN(d) ? undefined : d;
    }

    function makeTime(h, m) {
        var date = new Date();
        date.setHours(h, m, 0, 0);
        return date;
    }

    function normalizeDate(options, date) {
        var min = parseMaxima(options.min);
        var max = parseMaxima(options.max);
        date = new Date(+(date < min ? min : date > max ? max : date));
        switch (options.mode || options) {
            case 'week':
                date.setDate(getDate(date) - date.getDay());
                break;
            case 'month':
                date.setDate(1);
                break;
        }
        if ((options.mode || options) !== 'datetime') {
            date.setHours(0, 0, 0, 0);
        } else {
            date.setSeconds(0, 0);
        }
        return date;
    }

    function stepDate(mode, date, dir, step) {
        switch (mode) {
            case 'minute':
                var d = dir / Math.abs(dir);
                return new Date(+date + 60000 * ((((d > 0 ? step : 0) - (getMinutes(date) % step)) || (step * d)) + (step * (dir - d))));
            case 'day':
                return new Date(+date + MS_PER_DAY * dir);
            case 'week':
                return new Date(+date + MS_PER_DAY * 7 * dir);
            case 'month':
                return new Date(getFullYear(date), getMonth(date) + dir, getDate(date));
            case 'year':
                return new Date(getFullYear(date) + dir, getMonth(date), getDate(date));
        }
    }

    function formatDate(mode, date) {
        switch (mode) {
            case 'month':
                return monthstr[getMonth(date)] + ' ' + getFullYear(date);
            case 'week':
                var end = stepDate('day', date, 6);
                return monthstr[getMonth(date)] + ' ' + getDate(date) + ' - ' + (getMonth(end) !== getMonth(date) ? monthstr[getMonth(end)] + ' ' : '') + getDate(end) + ', ' + getFullYear(date);
        }
        var monthPart = monthstr[getMonth(date)] + ' ' + getDate(date) + ', ' + getFullYear(date);
        return mode === 'datetime' ? monthPart + ' ' + (getHours(date) || 12) + ':' + ('0' + getMinutes(date)).slice(-2) + ' ' + (getHours(date) >= 12 ? 'PM' : 'AM') : monthPart;
    }

    function initDatepicker() {
        callout = Typer.ui({
            type: 'contextmenu',
            controls: [Typer.ui.datepicker()],
            executed: function (ui, control) {
                if (activeTyper && control.is('calendar clock')) {
                    activeTyper.setValue(ui.getValue());
                    if (control.is('calendar')) {
                        ui.hide();
                    }
                }
            }
        });
    }

    Typer.ui.define('calendar', {
        type: 'calendar',
        defaultNS: 'calendar',
        controls: '*',
        showButtonLabel: false,
        mode: 'day',
        min: null,
        max: null,
        get value() {
            return normalizeDate(this, this.selectedDate);
        },
        set value(value) {
            this.selectedDate = normalizeDate(this, value);
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
                e.preventDefault();
            });
            $table.find('td').click(function () {
                var monthDelta = $(this).hasClass('prev') ? -1 : $(this).hasClass('next') ? 1 : 0;
                ui.execute(self, new Date(getFullYear(self.currentMonth), getMonth(self.currentMonth) + monthDelta, +this.textContent));
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
            var min = parseMaxima(self.min);
            var max = parseMaxima(self.max);
            var currentMonth = normalizeDate({
                mode: 'month',
                min: min,
                max: max
            }, date);
            var firstDay = currentMonth.getDay();
            var $buttons = $('td', self.element).removeClass('selected disabled');

            if (!self.currentMonth || !sameMonth(currentMonth, self.currentMonth)) {
                var y = getFullYear(currentMonth);
                var m = getMonth(currentMonth);
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
                if (sameMonth(currentMonth, today)) {
                    $buttons.eq(getDate(today) + firstDay - 1).addClass('today');
                }
                $('tr:last', self.element).toggle(firstDay + numDays > 35);

                var cy = ui.resolveOne('year');
                var cm = ui.resolveOne('month');
                $.each(cy.controls, function (i, v) {
                    v.label = v.value = y + i - 5;
                });
                cy.value = y;
                cm.value = m;
                self.currentMonth = currentMonth;
            }
            if (min && sameMonth(currentMonth, min)) {
                $buttons.slice(0, getDate(min) + firstDay - 1).addClass('disabled');
            }
            if (max && sameMonth(currentMonth, max)) {
                $buttons.slice(getDate(max) + firstDay).addClass('disabled');
            }
            var selected = sameMonth(currentMonth, self.value);
            if (selected || (self.mode === 'week' && sameMonth(currentMonth, stepDate('day', self.value, 6)))) {
                switch (self.mode) {
                    case 'day':
                        $buttons.eq(getDate(self.value) + firstDay - 1).addClass('selected');
                        break;
                    case 'week':
                        $buttons.slice(selected ? getDate(self.value) + firstDay - 1 : 0).slice(0, 7).addClass('selected');
                        break;
                    case 'month':
                        $buttons.filter('td.cur').addClass('selected');
                        break;
                }
            }
            $(self.element).toggleClass('select-range', self.mode !== 'day');
        }
    });

    Typer.ui.define('clock', {
        type: 'clock',
        defaultNS: 'clock',
        controls: '*',
        step: 1,
        init: function (ui, self) {
            // only allow minute interval that is a factor of 60
            // to maintain consistent step over hours
            if (60 % self.step > 0) {
                self.step = 1;
            }
            var $face = $('.typer-ui-clock-face', self.element);
            $(repeat('<i></i>', 12)).appendTo($face).each(function (i, v) {
                $(v).css('transform', 'rotate(' + (i * 30) + 'deg)');
            });
            $('s', self.element).bind('mousedown touchstart', function (e) {
                var elm = e.target;
                var center = Typer.ui.getRect(elm.parentNode);
                center = {
                    top: (center.top + center.bottom) / 2,
                    left: (center.left + center.right) / 2
                };
                var isTouch = e.type === 'touchstart';
                var handlers = {};
                handlers[isTouch ? 'touchmove' : 'mousemove'] = function (e) {
                    if (!isTouch && e.which !== 1) {
                        return handlers.mouseup();
                    }
                    var point = isTouch ? e.originalEvent.touches[0] : e;
                    var rad = Math.atan2(point.clientY - center.top, point.clientX - center.left) / Math.PI;
                    var curM = getMinutes(self.value);
                    var curH = getHours(self.value);
                    if (elm.getAttribute('hand') === 'm') {
                        var m = (Math.round((rad * 30 + 75) / self.step) * self.step) % 60;
                        if (m !== curM) {
                            var deltaH = Math.floor(Math.abs(curM - m) / 30) * (m > curM ? -1 : 1);
                            self.setValue(makeTime(curH + deltaH, m));
                        }
                    } else {
                        var h = Math.round(rad * 6 + 15) % 12 + (ui.getValue('meridiem') === 'am' ? 0 : 12);
                        if (h !== curH) {
                            self.setValue(makeTime(h, curM));
                        }
                    }
                };
                handlers[isTouch ? 'touchend' : 'mouseup'] = function () {
                    $(document.body).unbind(handlers);
                    ui.execute(self);
                };
                if (e.which === 1 || (e.originalEvent.touches || '').length === 1) {
                    $(document.body).bind(handlers);
                }
            });
            var mousewheelTimeout;
            $(self.element).bind('mousewheel', function (e) {
                self.setValue(stepDate('minute', self.value, Typer.ui.getWheelDelta(e), self.step));
                e.preventDefault();
                clearImmediate(mousewheelTimeout);
                mousewheelTimeout = setImmediate(function () {
                    ui.execute(self);
                });
            });
            self.setValue(new Date());
        },
        stateChange: function (ui, self) {
            var date = self.value;
            ui.resolveOne('minute').presetOptions.step = self.step;
            ui.setValue('hour', getHours(date));
            ui.setValue('minute', getMinutes(date));
            ui.setValue('meridiem', getHours(date) >= 12 ? 'pm' : 'am');
            $('s[hand="h"]', self.element).css('transform', 'rotate(' + (getHours(date) * 30 + getMinutes(date) * 0.5 - 90) + 'deg)');
            $('s[hand="m"]', self.element).css('transform', 'rotate(' + (getMinutes(date) * 6 - 90) + 'deg)');
        }
    });

    Typer.ui.define('datepicker', {
        renderAs: 'buttonset',
        mode: 'day',
        minuteStep: 1,
        min: null,
        max: null,
        controls: [
            Typer.ui.calendar({
                name: 'calendar'
            }),
            Typer.ui.clock({
                name: 'clock',
                hiddenWhenDisabled: true,
                enabled: function (ui, self) {
                    return self.contextualParent.mode === 'datetime';
                }
            })
        ],
        get value() {
            var date = this.ui.getValue('calendar');
            if (this.ui.enabled('clock')) {
                var time = this.ui.getValue('clock');
                date.setHours(getHours(time), getMinutes(time), 0, 0);
            }
            return date;
        },
        set value(value) {
            value = new Date(typeof value === 'string' ? value : +value);
            if (isNaN(+value)) {
                value = new Date();
            }
            this.ui.setValue('calendar', value);
            this.ui.setValue('clock', value);
        },
        stateChange: function (ui, self) {
            ui.set('calendar', {
                mode: self.mode === 'datetime' ? 'day' : self.mode,
                min: self.min,
                max: self.max
            });
            ui.set('clock', 'step', self.minuteStep);
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
                ui.trigger(self.contextualParent, 'showMonth', new Date(self.value, getMonth(self.contextualParent.currentMonth)));
            }
        }),
        month: Typer.ui.dropdown({
            execute: function (ui, self) {
                ui.trigger(self.contextualParent, 'showMonth', new Date(getFullYear(self.contextualParent.currentMonth), self.value));
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

    Typer.ui.addControls('clock', {
        hour: Typer.ui.textbox({
            preset: 'number',
            presetOptions: {
                min: 0,
                max: 23,
                loop: true
            },
            execute: function (ui, self) {
                ui.execute(self.contextualParent, makeTime(self.value, ui.getValue('clock:minute')));
            }
        }),
        timeSeperator: Typer.ui.label({
            value: ':'
        }),
        minute: Typer.ui.textbox({
            preset: 'number',
            presetOptions: {
                min: 0,
                max: 59,
                digits: 'fixed',
                loop: true
            },
            execute: function (ui, self) {
                ui.execute(self.contextualParent, makeTime(ui.getValue('clock:hour'), self.value));
            }
        }),
        meridiem: Typer.ui.button({
            execute: function (ui, self) {
                ui.setValue(self, self.value === 'am' ? 'pm' : 'am');
                ui.execute(self.contextualParent, makeTime(ui.getValue('clock:hour') % 12 + (self.value === 'am' ? 0 : 12), ui.getValue('clock:minute')));
            },
            stateChange: function (ui, self) {
                self.label = 'clock:meridiem:' + self.value;
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

    Typer.ui.addLabels('en', 'clock:meridiem', {
        am: 'AM',
        pm: 'PM'
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
        calendar: '<div class="typer-ui-calendar"><div class="typer-ui-calendar-header"><br x:t="buttonset"/></div><div class="typer-ui-calendar-body"><table></table></div></div>',
        clock: '<div class="typer-ui-clock"><div class="typer-ui-clock-face"><s hand="h"></s><s hand="m"></s></div><br x:t="buttonset"/></div>',
        formatDate: null
    });

    Typer.presets.datepicker = {
        options: {
            mode: 'day',
            minuteStep: 1,
            min: null,
            max: null,
            required: false,
            formatDate: null
        },
        overrides: {
            getValue: function (preset) {
                return preset.selectedDate ? normalizeDate(preset.options, preset.selectedDate) : null;
            },
            setValue: function (preset, date) {
                preset.selectedDate = date ? normalizeDate(preset.options, date) : null;
                preset.softSelectedDate = null;

                var text = '';
                if (date) {
                    var format = function (fn) {
                        return $.isFunction(fn) && fn(preset.options.mode, date);
                    };
                    text = format(preset.options.formatDate) ||
                           format(preset.typer.parentControl && Typer.ui.themes[preset.typer.parentControl.ui.theme].formatDate) ||
                           format(formatDate);
                }
                if (text !== this.extractText()) {
                    this.invoke(function (tx) {
                        tx.selection.selectAll();
                        tx.insertText(text);
                    });
                    if (this === activeTyper) {
                        callout.setValue(preset.selectedDate || new Date());
                    }
                }
            },
            hasContent: function (preset) {
                return !!this.extractText();
            },
            validate: function (preset, assert) {
                assert(!preset.options.required || !!preset.selectedDate, 'required');
            }
        },
        commands: {
            step: function (tx, value) {
                var options = tx.widget.options;
                var date = stepDate(options.mode === 'datetime' ? 'minute' : options.mode, tx.typer.getValue() || new Date(), value, options.minuteStep);
                tx.typer.setValue(date);
            }
        },
        contentChange: function (e) {
            if (e.typer === activeTyper && e.data !== 'script') {
                var date = new Date(e.typer.extractText());
                if (!isNaN(+date)) {
                    callout.setValue(normalizeDate(e.widget.options, date));
                }
                e.widget.softSelectedDate = date;
            }
        },
        click: function (e) {
            if (e.typer === activeTyper) {
                callout.show(e.typer.element);
            }
        },
        mousewheel: function (e) {
            e.typer.invoke('step', e.data);
            e.preventDefault();
        },
        upArrow: function (e) {
            e.typer.invoke('step', -1);
        },
        downArrow: function (e) {
            e.typer.invoke('step', 1);
        },
        focusin: function (e) {
            if (!callout) {
                initDatepicker();
            }
            callout.retainFocus(e.typer);
            activeTyper = e.typer;

            var options = e.widget.options;
            callout.set('(type:datepicker)', {
                mode: options.mode,
                minuteStep: options.minuteStep,
                min: options.min,
                max: options.max
            });
            callout.setValue(e.typer.getValue() || new Date());
            callout.show(e.typer.element);
            if (Typer.ui.isTouchDevice) {
                setImmediate(function () {
                    if (e.typer === activeTyper) {
                        callout.focus();
                    }
                });
            }
        },
        focusout: function (e) {
            setImmediate(function () {
                if (e.typer === activeTyper) {
                    activeTyper = null;
                    callout.hide();
                }
            });
            if (e.typer === activeTyper && e.widget.softSelectedDate) {
                e.typer.setValue(isNaN(+e.widget.softSelectedDate) ? e.widget.selectedDate : e.widget.softSelectedDate);
            }
        }
    };

}(jQuery, window.Typer, Date));
