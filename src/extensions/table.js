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
            rows[rows.length] = $(v.element).parent().index();
            cols[cols.length] = $(v.element).index();
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

    function setEditorStyle(element) {
        $('td,th', element).css({
            outline: '1px dotted black',
            minWidth: '3em'
        });
    }

    Typer.ui.define('tableGrid', {
        type: 'tableGrid'
    });

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
        init: function (e) {
            setEditorStyle(e.widget.element);
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
                setEditorStyle(tx.widget.element);
                tx.trackChange(tx.widget.element);
            },
            addColumnAfter: function (tx) {
                var info = getSelectionInfo(tx.selection);
                $(tx.widget.element).find('>tbody>tr>th:nth-child(' + (info.maxColumn + 1) + ')').after(TH_HTML);
                $(tx.widget.element).find('>tbody>tr>td:nth-child(' + (info.maxColumn + 1) + ')').after(TD_HTML);
                setEditorStyle(tx.widget.element);
                tx.trackChange(tx.widget.element);
            },
            addRowAbove: function (tx) {
                var info = getSelectionInfo(tx.selection);
                var tableRow = $(tx.widget.element).find('>tbody>tr')[info.minRow];
                $(tableRow).before(TR_HTML.replace('%', repeat(TD_HTML, tableRow.childElementCount)));
                setEditorStyle(tx.widget.element);
                tx.trackChange(tx.widget.element);
            },
            addRowBelow: function (tx) {
                var info = getSelectionInfo(tx.selection);
                var tableRow = $(tx.widget.element).find('>tbody>tr')[info.maxRow];
                $(tableRow).after(TR_HTML.replace('%', repeat(TD_HTML, tableRow.childElementCount)));
                setEditorStyle(tx.widget.element);
                tx.trackChange(tx.widget.element);
            },
            removeColumn: function (tx) {
                var info = getSelectionInfo(tx.selection);
                $(tx.widget.element).find('>tbody>tr').each(function (i, v) {
                    $($(v).children().splice(info.minColumn, info.maxColumn - info.minColumn + 1)).remove();
                });
                tx.trackChange(tx.widget.element);
            },
            removeRow: function (tx) {
                var info = getSelectionInfo(tx.selection);
                $($(tx.widget.element).find('>tbody>tr').splice(info.minRow, info.maxRow - info.minRow + 1)).remove();
                tx.trackChange(tx.widget.element);
            },
            toggleTableHeader: function (tx) {
                if ($(tx.widget.element).find('th')[0]) {
                    $(tx.widget.element).find('th').wrapInner('<p>').each(function (i, v) {
                        tx.replaceElement(v, 'td');
                    });
                } else {
                    var columnCount = $(tx.widget.element).find('>tbody>tr')[0].childElementCount;
                    $(tx.widget.element).find('tbody').prepend(TR_HTML.replace('%', repeat(TH_HTML, columnCount)));
                    $(tx.widget.element).find('th').text(function (i, v) {
                        return 'Column ' + (i + 1);
                    });
                }
                setEditorStyle(tx.widget.element);
                tx.trackChange(tx.widget.element);
            }
        }
    };

    $.extend(Typer.ui.themeExtensions, {
        tableGrid: '<div class="typer-ui-grid"><div class="typer-ui-grid-wrapper"></div><br x:t="label"/></div>',
        tableGridInit: function (toolbar, self) {
            var html = repeat('<div class="typer-ui-grid-row">' + repeat('<div class="typer-ui-grid-cell"></div>', 7) + '</div>', 7);
            $(self.element).find('.typer-ui-grid-wrapper').append(html);
            $(self.element).find('.typer-ui-grid-cell').mouseover(function () {
                self.value.rows = $(this).parent().index() + 1;
                self.value.columns = $(this).index() + 1;
                self.label = self.value.rows + ' \u00d7 ' + self.value.columns;
                $(self.element).find('.typer-ui-grid-cell').removeClass('active');
                $(self.element).find('.typer-ui-grid-row:lt(' + self.value.rows + ')').find('.typer-ui-grid-cell:nth-child(' + self.value.columns + ')').prevAll().andSelf().addClass('active');
            });
            self.label = '0 \u00d7 0';
            self.value = {};
            $(self.element).click(function () {
                toolbar.execute(self);
            });
        }
    });

    Typer.ui.addControls('typer', {
        'insert:table': Typer.ui.callout({
            requireWidgetEnabled: 'table',
            hiddenWhenDisabled: true
        }),
        'insert:table:create': Typer.ui.tableGrid({
            execute: function (toolbar, self, tx) {
                tx.insertWidget('table', self.value);
            }
        }),
        'contextmenu:table': Typer.ui.callout({
            requireWidget: 'table',
            hiddenWhenDisabled: true,
            defaultNS: 'typer:table'
        }),
        'selection:selectTable': Typer.ui.button({
            requireWidget: 'table',
            hiddenWhenDisabled: true,
            execute: function (toolbar, self) {
                var selection = toolbar.typer.getSelection();
                selection.select(self.widget.element);
                selection.focus();
            }
        }),
        'table:toggleTableHeader': Typer.ui.checkbox({
            requireWidget: 'table',
            execute: 'toggleTableHeader',
            stateChange: function (toolbar, self) {
                self.value = !!$(self.widget.element).find('th')[0];
            }
        }),
        'table:style': Typer.ui.callout({
            requireWidget: 'table',
            controls: function (toolbar, self) {
                var definedOptions = $.map(Object.keys(toolbar.options.tableStyles || {}), function (v) {
                    return Typer.ui.button({
                        requireWidget: 'table',
                        value: v,
                        label: toolbar.options.tableStyles[v],
                        execute: function (toolbar, self, tx) {
                            self.widget.element.className = v;
                            tx.trackChange(self.widget.element);
                        }
                    });
                });
                var fallbackOption = Typer.ui.button({
                    requireWidget: 'table',
                    label: 'typer:table:styleDefault',
                    execute: function (toolbar, self, tx) {
                        self.widget.element.className = '';
                        tx.trackChange(self.widget.element);
                    }
                });
                return definedOptions.concat(fallbackOption);
            }
        }),
        'table:tableWidth': Typer.ui.callout(),
        'table:tableWidth:fitContent': Typer.ui.button({
            requireWidget: 'table',
            execute: function (toolbar, self, tx) {
                $(self.widget.element).removeAttr('width');
                tx.trackChange(self.widget.element);
            }
        }),
        'table:tableWidth:fullWidth': Typer.ui.button({
            requireWidget: 'table',
            execute: function (toolbar, self, tx) {
                $(self.widget.element).attr('width', '100%');
                tx.trackChange(self.widget.element);
            }
        }),
        'table:addRemoveCell': Typer.ui.group(),
        'table:addRemoveCell:addColumnBefore': Typer.ui.button({
            requireWidget: 'table',
            execute: 'addColumnBefore'
        }),
        'table:addRemoveCell:addColumnAfter': Typer.ui.button({
            requireWidget: 'table',
            execute: 'addColumnAfter'
        }),
        'table:addRemoveCell:addRowAbove': Typer.ui.button({
            requireWidget: 'table',
            execute: 'addRowAbove'
        }),
        'table:addRemoveCell:addRowBelow': Typer.ui.button({
            requireWidget: 'table',
            execute: 'addRowBelow'
        }),
        'table:addRemoveCell:removeColumn': Typer.ui.button({
            requireWidget: 'table',
            execute: 'removeColumn'
        }),
        'table:addRemoveCell:removeRow': Typer.ui.button({
            requireWidget: 'table',
            execute: 'removeRow'
        })
    });

    Typer.ui.addLabels('en', 'typer', {
        'insert:table': 'Table',
        'contextmenu:table': 'Modify table',
        'selection:selectTable': 'Select table',
        'table:toggleTableHeader': 'Show header',
        'table:columnWidth': 'Set column width',
        'table:tableWidth': 'Set table width',
        'table:style': 'Set table style',
        'table:styleDefault': 'Default',
        'table:addRemoveCell:addColumnBefore': 'Add column before',
        'table:addRemoveCell:addColumnAfter': 'Add column after',
        'table:addRemoveCell:addRowAbove': 'Add row above',
        'table:addRemoveCell:addRowBelow': 'Add row below',
        'table:addRemoveCell:removeColumn': 'Remove column',
        'table:addRemoveCell:removeRow': 'Remove row',
        'table:tableWidth:fitContent': 'Fit to content',
        'table:tableWidth:fullWidth': 'Full width'
    });

}(jQuery, window.Typer));
