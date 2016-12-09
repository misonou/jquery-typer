(function ($, Typer) {
    'use strict';

    var TD_HTML = '<td></td>';
    var TH_HTML = '<th></th>';
    var TR_HTML = '<tr>%</tr>';

    function repeat(str, count) {
        return new Array(count + 1).join(str);
    }

    function moveToCell(tx, dx, dy) {
        var cell = $('>tbody>tr', tx.widget.element).eq(Math.max(0, tx.widget.row + dx)).children()[Math.max(0, tx.widget.column + dy)];
        tx.normalize(tx.widget.element);
        tx.moveCaret(cell, -0);
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
        beforeStateChange: function (e) {
            var selection = e.typer.getSelection();
            var selectedCells = selection.getEditableElements(e.widget);
            var c = selectedCells.length > 1 ? -1 : $(selectedCells).index();
            var r = selectedCells.length > 1 ? -1 : $(selectedCells).parent().index();
            $.extend(e.widget, {
                row: r,
                rowCount: $('>tbody>tr', e.widget.element).length,
                rowCells: $('>tbody>tr:nth-child(' + (r + 1) + ')>*', e.widget.element).get(),
                column: c,
                columnCount: $('>tbody>tr:first>*', e.widget.element).length,
                columnCells: $('>tbody>tr>*:nth-child(' + (c + 1) + ')', e.widget.element).get()
            });
        },
        tab: function (e) {
            var cells = $('>tbody>tr>*', e.widget.element).get();
            var currentIndex = e.widget.row * e.widget.columnCount + e.widget.column;
            if (currentIndex < cells.length - 1) {
                e.typer.moveCaret(cells[currentIndex + 1]);
            }
        },
        shiftTab: function (e) {
            var cells = $('>tbody>tr>*', e.widget.element).get();
            var currentIndex = e.widget.row * e.widget.columnCount + e.widget.column;
            if (currentIndex > 0) {
                e.typer.moveCaret(cells[currentIndex - 1], -0);
            }
        },
        ctrlEnter: function (e) {
            if (e.widget.row === 0 && e.widget.column === 0) {
                e.typer.invoke('insertSpaceBefore');
            } else if (e.widget.row === e.widget.rowCount - 1 && e.widget.column === e.widget.columnCount - 1) {
                e.typer.invoke('insertSpaceAfter');
            }
        },
        commands: {
            justifyLeft: function (tx) {
                $(tx.selection.getEditableElements(tx.widget)).attr('align', 'left');
            },
            justifyCenter: function (tx) {
                $(tx.selection.getEditableElements(tx.widget)).attr('align', 'center');
            },
            justifyRight: function (tx) {
                $(tx.selection.getEditableElements(tx.widget)).attr('align', 'right');
            },
            addColumnBefore: function (tx) {
                $(tx.widget.columnCells).filter('th').before(TH_HTML);
                $(tx.widget.columnCells).filter('td').before(TD_HTML);
                moveToCell(tx, 0, 0);
            },
            addColumnAfter: function (tx) {
                $(tx.widget.columnCells).filter('th').after(TH_HTML);
                $(tx.widget.columnCells).filter('td').after(TD_HTML);
                moveToCell(tx, 0, 1);
            },
            addRowAbove: function (tx) {
                $(tx.widget.rowCells).before(TR_HTML.replace('%', repeat(TD_HTML, tx.widget.columnCount)));
                moveToCell(tx, 0, 0);
            },
            addRowBelow: function (tx) {
                $(tx.widget.rowCells).after(TR_HTML.replace('%', repeat(TD_HTML, tx.widget.columnCount)));
                moveToCell(tx, 1, 0);
            },
            removeColumn: function (tx) {
                $(tx.widget.columnCells).remove();
                moveToCell(tx, 0, -1);
            },
            removeRow: function (tx) {
                $(tx.widget.rowCells).remove();
                moveToCell(tx, -1, 0);
            },
            toggleTableHeader: function (tx) {
                if ($(tx.widget.element).find('th')[0]) {
                    $(tx.widget.element).find('tr:has(th)').remove();
                    if (tx.widget.row === 0) {
                        moveToCell(tx, 0, 0);
                    }
                } else {
                    $(tx.widget.element).find('tbody').prepend(TR_HTML.replace('%', repeat(TH_HTML, tx.widget.columnCount)));
                    moveToCell(tx, -tx.widget.row, -tx.widget.column);
                }
            },
            insertSpaceBefore: function (tx) {
                tx.select(tx.widget.element, Typer.COLLAPSE_START_OUTSIDE);
                tx.insertText('');
            },
            insertSpaceAfter: function (tx) {
                tx.select(tx.widget.element, Typer.COLLAPSE_END_OUTSIDE);
                tx.insertText('');
            }
        }
    };

    $.extend(Typer.ui.controls, {
        'insert:table': Typer.ui.callout({
            controls: 'table:*',
            requireWidgetEnabled: 'table',
            hiddenWhenDisabled: true,
            execute: function (toolbar, self, tx) {
                tx.insertWidget('table');
            },
            active: function (toolbar, self) {
                return self.widget;
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
        'table:addColumnBefore': 'Add Column Before',
        'table:addColumnAfter': 'Add Column After',
        'table:addRowAbove': 'Add Row Above',
        'table:addRowBelow': 'Add Row Below',
        'table:removeColumn': 'Remove Column',
        'table:removeRow': 'Remove Row'
    });

    Typer.ui.addIcons('material', {
        'insert:table': 'border_all'
    });

} (jQuery, window.Typer));
