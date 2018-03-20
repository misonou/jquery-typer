(function ($, Typer) {
    'use strict';

    var TD_HTML = '<td></td>';
    var TH_HTML = '<th></th>';
    var TR_HTML = '<tr>%</tr>';
    var TR_SELECTOR = '>tbody>tr';

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

    function getRow(widget, index) {
        return $(TR_SELECTOR, widget.element || widget)[index];
    }

    function countColumns(widget) {
        return getRow(widget, 0).childElementCount;
    }

    function tabNextCell(selection, dir, selector) {
        if (selection.isSingleEditable) {
            var nextCell = $(selection.focusNode.element)[dir]()[0] || $(selection.focusNode.element).parent()[dir]().children(selector)[0];
            if (nextCell) {
                selection.moveToText(nextCell, -0);
            }
        }
    }

    function setEditorStyle(widget) {
        $('td,th', widget.element || widget).css({
            outline: '1px dotted rgba(0,0,0,0.3)',
            minWidth: '3em'
        });
    }

    function insertColumn(widget, index, count, before) {
        var s = typeof index === 'string' ? index + '-child' : 'nth-child(' + (index + 1) + ')';
        var m = before ? 'before' : 'after';
        $(widget.element || widget).find(TR_SELECTOR + '>th:' + s)[m](repeat(TH_HTML, count));
        $(widget.element || widget).find(TR_SELECTOR + '>td:' + s)[m](repeat(TD_HTML, count));
        setEditorStyle(widget);
    }

    function insertRow(widget, index, kind, before) {
        $(getRow(widget, index))[before ? 'before' : 'after'](TR_HTML.replace('%', repeat(kind, countColumns(widget))));
        setEditorStyle(widget);
    }

    Typer.ui.define('tableGrid', {
        type: 'tableGrid'
    });

    Typer.widgets.table = {
        element: 'table',
        editable: 'th,td',
        insert: function (tx, options) {
            options = options || {};
            tx.insertHtml('<table>' + repeat(TR_HTML.replace('%', repeat(TD_HTML, options.columns || 2)), options.rows || 2) + '</table>');
        },
        init: function (e) {
            setEditorStyle(e.widget);
        },
        extract: function (e) {
            var $row = $(TR_SELECTOR, e.extractedNode);
            if ($row[1]) {
                var count = countColumns(e.widget);
                $row.each(function (i, v) {
                    if (v.childElementCount < count) {
                        $(repeat($('>th', v)[0] ? TH_HTML : TD_HTML, count - v.childElementCount))[i ? 'appendTo' : 'prependTo'](v);
                    }
                });
            }
        },
        receive: function (e) {
            if (e.source === 'paste') {
                var missCount = countColumns(e.receivedNode) - countColumns(e.widget);
                if (missCount > 0) {
                    insertColumn(e.widget, 'last', missCount, false);
                } else if (missCount < 0) {
                    insertColumn(e.receivedNode, 'last', -missCount, false);
                }
                $(TR_SELECTOR, e.receivedNode).insertBefore($(e.caret.element).closest('tr')).children('th').wrapInner('<p>').each(function (i, v) {
                    $(v).replaceWith($(TD_HTML).append(v.childNodes));
                });
                setEditorStyle(e.widget);
                e.preventDefault();
            }
        },
        tab: function (e) {
            tabNextCell(e.typer.getSelection(), 'next', ':first-child');
        },
        shiftTab: function (e) {
            tabNextCell(e.typer.getSelection(), 'prev', ':last-child');
        },
        commands: {
            addColumnBefore: function (tx) {
                var info = getSelectionInfo(tx.selection);
                insertColumn(tx.widget, info.minColumn, 1, true);
            },
            addColumnAfter: function (tx) {
                var info = getSelectionInfo(tx.selection);
                insertColumn(tx.widget, info.maxColumn, 1, false);
            },
            addRowAbove: function (tx) {
                var info = getSelectionInfo(tx.selection);
                insertRow(tx.widget, info.minRow, TD_HTML, true);
            },
            addRowBelow: function (tx) {
                var info = getSelectionInfo(tx.selection);
                insertRow(tx.widget, info.maxRow, TD_HTML, false);
            },
            removeColumn: function (tx) {
                var info = getSelectionInfo(tx.selection);
                $(TR_SELECTOR, tx.widget.element).each(function (i, v) {
                    $(v).children().splice(info.minColumn, info.maxColumn - info.minColumn + 1).remove();
                });
                tx.selection.moveTo(getRow(tx.widget, info.minRow).children[Math.max(0, info.minColumn - 1)], -0);
            },
            removeRow: function (tx) {
                var info = getSelectionInfo(tx.selection);
                $(TR_SELECTOR, tx.widget.element).splice(info.minRow, info.maxRow - info.minRow + 1).remove();
                tx.selection.moveTo(getRow(tx.widget, Math.max(0, info.minRow - 1)).children[info.minColumn], -0);
            },
            toggleTableHeader: function (tx) {
                var $header = $(TR_SELECTOR + '>th', tx.widget.element);
                if ($header[0]) {
                    $header.wrapInner('<p>').each(function (i, v) {
                        tx.replaceElement(v, 'td');
                    });
                } else {
                    insertRow(tx.widget, 0, TH_HTML, true);
                    $('>*', getRow(tx.widget, 0)).text(function (i) {
                        return 'Column ' + (i + 1);
                    });
                }
                setEditorStyle(tx.widget);
            }
        }
    };

    $.extend(Typer.ui.themeExtensions, {
        tableGrid: '<div class="typer-ui-grid"><div class="typer-ui-grid-wrapper"></div><br x:t="label"/></div>',
        tableGridInit: function (toolbar, self) {
            var $self = $(self.element);
            $self.find('.typer-ui-grid-wrapper').append(repeat('<div class="typer-ui-grid-row">' + repeat('<div class="typer-ui-grid-cell"></div>', 7) + '</div>', 7));
            $self.find('.typer-ui-grid-cell').mouseover(function () {
                self.value.rows = $(this).parent().index() + 1;
                self.value.columns = $(this).index() + 1;
                self.label = self.value.rows + ' \u00d7 ' + self.value.columns;
                $self.find('.typer-ui-grid-cell').removeClass('active');
                $self.find('.typer-ui-grid-row:lt(' + self.value.rows + ')').find('.typer-ui-grid-cell:nth-child(' + self.value.columns + ')').prevAll().addBack().addClass('active');
            });
            self.label = '0 \u00d7 0';
            self.value = {};
            $self.click(function () {
                toolbar.execute(self);
            });
        }
    });

    Typer.ui.addControls('typer', {
        'insert:table': Typer.ui.callout({
            requireWidgetEnabled: 'table',
            enabled: function (toolbar) {
                return toolbar.typer.getSelection().widgetAllowed('table');
            },
            visible: function (toolbar) {
                return toolbar.typer.widgetEnabled('table');
            }
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
        'table:toggleTableHeader': Typer.ui.checkbox({
            requireWidget: 'table',
            execute: 'toggleTableHeader',
            stateChange: function (toolbar, self) {
                self.value = !!$(self.widget.element).find('th')[0];
            }
        }),
        'table:style': Typer.ui.dropdown({
            requireWidget: 'table',
            controls: function (toolbar, self) {
                var definedOptions = $.map(Object.keys(toolbar.options.tableStyles || {}), function (v) {
                    return Typer.ui.button({
                        value: v,
                        label: toolbar.options.tableStyles[v]
                    });
                });
                var fallbackOption = Typer.ui.button({
                    value: '',
                    label: 'typer:table:styleDefault'
                });
                return definedOptions.concat(fallbackOption);
            },
            execute: function (toolbar, self, tx) {
                self.widget.element.className = self.value || '';
            },
            stateChange: function (toolbar, self) {
                self.value = self.widget.element.className || '';
                self.selectedText = self.label;
            }
        }),
        'table:tableWidth': Typer.ui.dropdown({
            requireWidget: 'table',
            execute: function (toolbar, self, tx) {
                if (self.value) {
                    $(self.widget.element).attr('width', '100%');
                } else {
                    $(self.widget.element).removeAttr('width');
                }
            },
            stateChange: function (toolbar, self) {
                self.value = $(self.widget.element).attr('width') || '';
                self.selectedText = self.label;
            }
        }),
        'table:tableWidth:fitContent': Typer.ui.button({
            value: ''
        }),
        'table:tableWidth:fullWidth': Typer.ui.button({
            value: '100%'
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
            execute: 'addRowAbove',
            enabled: function (toolbar, self) {
                return !$(TR_SELECTOR, self.widget.element).has('th')[0] || getSelectionInfo(toolbar.typer.getSelection()).minRow > 0;
            }
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
        'table:toggleTableHeader': 'Show header',
        'table:style': 'Table style',
        'table:styleDefault': 'Default',
        'table:addRemoveCell:addColumnBefore': 'Add column before',
        'table:addRemoveCell:addColumnAfter': 'Add column after',
        'table:addRemoveCell:addRowAbove': 'Add row above',
        'table:addRemoveCell:addRowBelow': 'Add row below',
        'table:addRemoveCell:removeColumn': 'Remove column',
        'table:addRemoveCell:removeRow': 'Remove row',
        'table:tableWidth': 'Table width',
        'table:tableWidth:fitContent': 'Fit to content',
        'table:tableWidth:fullWidth': 'Full width'
    });

}(jQuery, Typer));
