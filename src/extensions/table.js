(function ($, Typer) {
    'use strict';

    var TD_HTML = '<td></td>';
    var TH_HTML = '<th></th>';
    var TR_HTML = '<tr>%</tr>';

    function repeat(str, count) {
        return new Array(count + 1).join(str);
    }

    function getSelectionInfo(selection) {
        var rows = [];
        var cols = [];
        Typer.iterate(selection.createTreeWalker(Typer.NODE_EDITABLE | Typer.NODE_EDITABLE_PARAGRAPH), function (v) {
            rows[rows.length] = $(v).parent().index();
            cols[cols.length] = $(v).index();
        });
        return {
            minRow: Math.min.apply(null, rows),
            maxRow: Math.max.apply(null, rows),
            minColumn: Math.min.apply(null, cols),
            maxColumn: Math.max.apply(null, cols)
        };
    }

    function tabNextCell(selection, dir, selector) {
        if (selection.isSingleEditable) {
            var nextCell = $(selection.focusNode.element)[dir]()[0] || $(selection.focusNode.element).parent()[dir]().children(selector)[0];
            if (nextCell) {
                selection.moveToText(nextCell, -0);
            }
        }
    }

    Typer.widgets.table = {
        element: 'table',
        editable: 'th,td',
        insert: function (tx, options) {
            options = $.extend({
                rows: 2,
                columns: 2
            }, options);
            tx.insertHtml('<table>' + repeat(TR_HTML.replace('%', repeat(TD_HTML, options.columns)), options.rows) + '</table>');
        },
        tab: function (e) {
            tabNextCell(e.typer.getSelection(), 'next', ':first-child');
        },
        shiftTab: function (e) {
            tabNextCell(e.typer.getSelection(), 'prev', ':last-child');
        },
        ctrlEnter: function (e) {
            e.typer.invoke(function (tx) {
                tx.selection.select(tx.widget.element, Typer.COLLAPSE_START_OUTSIDE);
                tx.insertText('');
            });
        },
        commands: {
            addColumnBefore: function (tx) {
                var info = getSelectionInfo(tx.selection);
                $(tx.widget.element).find('>tbody>tr>th:nth-child(' + (info.minColumn + 1) + ')').before(TH_HTML);
                $(tx.widget.element).find('>tbody>tr>td:nth-child(' + (info.minColumn + 1) + ')').before(TD_HTML);
            },
            addColumnAfter: function (tx) {
                var info = getSelectionInfo(tx.selection);
                $(tx.widget.element).find('>tbody>tr>th:nth-child(' + (info.maxColumn + 1) + ')').after(TH_HTML);
                $(tx.widget.element).find('>tbody>tr>td:nth-child(' + (info.maxColumn + 1) + ')').after(TD_HTML);
            },
            addRowAbove: function (tx) {
                var info = getSelectionInfo(tx.selection);
                var tableRow = $(tx.widget.element).find('>tbody>tr')[info.minRow];
                $(tableRow).before(TR_HTML.replace('%', repeat(TD_HTML, tableRow.childElementCount)));
            },
            addRowBelow: function (tx) {
                var info = getSelectionInfo(tx.selection);
                var tableRow = $(tx.widget.element).find('>tbody>tr')[info.maxRow];
                $(tableRow).after(TR_HTML.replace('%', repeat(TD_HTML, tableRow.childElementCount)));
            },
            removeColumn: function (tx) {
                var info = getSelectionInfo(tx.selection);
                $(tx.widget.element).find('>tbody>tr').each(function (i, v) {
                    $($(v).children().splice(info.minColumn, info.maxColumn - info.minColumn + 1)).remove();
                });
            },
            removeRow: function (tx) {
                var info = getSelectionInfo(tx.selection);
                $($(tx.widget.element).find('>tbody>tr').splice(info.minRow, info.maxRow - info.minRow + 1)).remove();
            },
            toggleTableHeader: function (tx) {
                if ($(tx.widget.element).find('th')[0]) {
                    $(tx.widget.element).find('th').wrap('<td>').contents().unwrap();
                } else {
                    var columnCount = $(tx.widget.element).find('>tbody>tr')[0].childElementCount;
                    $(tx.widget.element).find('tbody').prepend(TR_HTML.replace('%', repeat(TH_HTML, columnCount)));
                }
            }
        }
    };

    $.extend(Typer.ui.controls, {
        'insert:table': Typer.ui.button({
            requireWidgetEnabled: 'table',
            hiddenWhenDisabled: true,
            execute: function (toolbar, self, tx) {
                tx.insertWidget('table');
            }
        }),
        'contextmenu:table': Typer.ui.callout({
            controls: 'table:*',
            requireWidget: 'table',
            hiddenWhenDisabled: true
        }),
        'table:toggleTableHeader': Typer.ui.checkbox({
            requireWidget: 'table',
            execute: 'toggleTableHeader',
            stateChange: function (toolbar, self) {
                self.value = !!$(self.widget.element).find('th')[0];
            }
        }),
        'table:addColumnBefore': Typer.ui.button({
            requireWidget: 'table',
            execute: 'addColumnBefore'
        }),
        'table:addColumnAfter': Typer.ui.button({
            requireWidget: 'table',
            execute: 'addColumnAfter'
        }),
        'table:addRowAbove': Typer.ui.button({
            requireWidget: 'table',
            execute: 'addRowAbove'
        }),
        'table:addRowBelow': Typer.ui.button({
            requireWidget: 'table',
            execute: 'addRowBelow'
        }),
        'table:removeColumn': Typer.ui.button({
            requireWidget: 'table',
            execute: 'removeColumn'
        }),
        'table:removeRow': Typer.ui.button({
            requireWidget: 'table',
            execute: 'removeRow'
        })
    });

    Typer.ui.addLabels('en', {
        'insert:table': 'Table',
        'contextmenu:table': 'Modify table',
        'table:toggleTableHeader': 'Toggle header',
        'table:addColumnBefore': 'Add column before',
        'table:addColumnAfter': 'Add column after',
        'table:addRowAbove': 'Add row above',
        'table:addRowBelow': 'Add row below',
        'table:removeColumn': 'Remove column',
        'table:removeRow': 'Remove row'
    });

} (jQuery, window.Typer));
