(function ($, Typer) {
    'use strict';

    var TD_HTML = '<td></td>';
    var TH_HTML = '<th></th>';
    var TR_HTML = '<tr>%</tr>';
    var TR_SELECTOR = '>tbody>tr';
    var X_ATTR_MODE = 'x-table-copymode';
    var MODE_ROW = 1;
    var MODE_COLUMN = 2;
    var MODE_TABLE = 3;

    var visualRange;
    var removeBeforeInsert;

    function CellSelection(widget, minRow, minCol, maxRow, maxCol) {
        var self = this;
        self.widget = widget;
        self.element = widget.element;
        self.minCol = minCol;
        self.minRow = minRow;
        self.maxCol = maxCol;
        self.maxRow = maxRow;
    }

    function getCellSelection(selection) {
        var widget = selection.focusNode.widget;
        if (widget.id === 'table') {
            var $c1 = $(selection.startElement).parentsUntil(widget.element).addBack();
            var $c2 = $(selection.endElement).parentsUntil(widget.element).addBack();
            return new CellSelection(widget, $c1.eq(1).index(), $c1.eq(2).index(), $c2.eq(1).index(), $c2.eq(2).index());
        }
    }

    function repeat(str, count) {
        return new Array(count + 1).join(str);
    }

    function removeElement(element) {
        $(element).remove();
    }

    function getRow(widget, row) {
        return $(TR_SELECTOR, widget.element || widget)[row];
    }

    function getCell(widget, row, col) {
        if (typeof row === 'string') {
            return getCell(widget, Math.min(widget[row + 'Row'], countRows(widget) - 1), Math.min(widget[row + 'Col'], countColumns(widget) - 1));
        }
        return getRow(widget, row).children[col];
    }

    function countRows(widget) {
        return $(TR_SELECTOR, widget.element || widget).length;
    }

    function countColumns(widget) {
        return getRow(widget, 0).childElementCount;
    }

    function hasTableHeader(widget) {
        return !!Typer.is(getCell(widget, 0, 0), 'th');
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

    function selectCells(widget, row, col, numRow, numCol) {
        widget.typer.select(new CellSelection(widget, row, col, row + numRow - 1, col + numCol - 1));
    }

    function insertColumn(widget, index, count, before) {
        var s = typeof index === 'string' ? index + '-child' : 'nth-child(' + (index + 1) + ')';
        var m = before ? 'before' : 'after';
        $(widget.element || widget).find(TR_SELECTOR + '>th:' + s)[m](repeat(TH_HTML, count));
        $(widget.element || widget).find(TR_SELECTOR + '>td:' + s)[m](repeat(TD_HTML, count));
        setEditorStyle(widget);
    }

    function insertRow(widget, index, count, kind, before) {
        $(getRow(widget, index === 'last' ? countRows(widget) - 1 : index))[before ? 'before' : 'after'](repeat(TR_HTML.replace('%', repeat(kind, countColumns(widget))), count));
        setEditorStyle(widget);
    }

    function toggleHeader(widget, value) {
        var hasHeader = hasTableHeader(widget);
        if (hasHeader && !value) {
            $('>th', getRow(widget, 0)).wrapInner('<p>').each(function (i, v) {
                $(v).replaceWith($(TD_HTML).append(v.childNodes));
            });
            setEditorStyle(widget);
        } else if (!hasHeader && (value || value === undefined)) {
            insertRow(widget, 0, 1, TH_HTML, true);
        }
    }

    function findIndex(widget, isColumn, pos) {
        var $cell = $(isColumn ? TR_SELECTOR + ':first>*' : TR_SELECTOR, widget.element);
        for (var i = $cell.length - 1; i >= 0; i--) {
            var r = Typer.getRect($cell[i]);
            if ((isColumn ? r.left : r.top) < pos) {
                return i;
            }
        }
        return 0;
    }

    CellSelection.prototype = {
        get numCol() {
            return Math.abs(this.maxCol - this.minCol) + 1;
        },
        get numRow() {
            return Math.abs(this.maxRow - this.minRow) + 1;
        },
        get mode() {
            return (this.numCol === countColumns(this)) + (this.numRow === countRows(this)) * 2;
        },
        rows: function (callback) {
            $(TR_SELECTOR, this.element).splice(this.minRow, this.numRow).forEach(callback);
        },
        cells: function (callback) {
            var self = this;
            self.rows(function (v, i) {
                 $(v.children).splice(self.minCol, self.numCol).forEach(function (v, j) {
                    callback(v, i, j);
                });
            });
        },
        getRange: function () {
            return Typer.createRange(getCell(this, 'min'), 0, getCell(this, 'max'), -0);
        },
        acceptNode: function (node) {
            var result = false;
            if (node.element === this.element) {
                return 1;
            }
            this.cells(function (v) {
                result |= Typer.containsOrEquals(v, node.element);
            });
            return result || 2;
        },
        remove: function (mode) {
            var self = this;
            if (mode === MODE_ROW) {
                self.rows(removeElement);
            } else if (mode === MODE_COLUMN) {
                self.cells(removeElement);
            }
            self.widget.typer.select(getCell(self, 'min'), -0);
        }
    };

    Typer.widgets.table = {
        element: 'table',
        editable: 'th,td',
        create: function (tx, options) {
            options = options || {};
            tx.insertHtml('<table>' + repeat(TR_HTML.replace('%', repeat(TD_HTML, options.columns || 2)), options.rows || 2) + '</table>');
        },
        init: function (e) {
            $(e.widget.element).removeAttr(X_ATTR_MODE);
            setEditorStyle(e.widget);
        },
        extract: function (e) {
            var src = e.widget.element;
            var dst = e.extractedNode;
            if (visualRange && visualRange.widget === e.widget) {
                var mode = visualRange.mode;
                if (mode === MODE_ROW || mode === MODE_COLUMN) {
                    $(dst).attr(X_ATTR_MODE, mode);
                    if (e.source === 'paste' || e.source === 'cut') {
                        visualRange.remove(mode);
                    }
                }
            } else if (countRows(dst) > 1) {
                var count = countColumns(src);
                $(TR_SELECTOR, dst).each(function (i, v) {
                    if (v.childElementCount < count) {
                        $(repeat($('>th', v)[0] ? TH_HTML : TD_HTML, count - v.childElementCount))[i ? 'appendTo' : 'prependTo'](v);
                    }
                });
            }
        },
        receive: function (e) {
            var mode = +$(e.receivedNode).attr(X_ATTR_MODE);
            if (!mode && e.source !== 'paste') {
                return;
            }

            var selection = e.typer.getSelection();
            var info = visualRange && visualRange.widget === e.widget ? visualRange : getCellSelection(selection);
            var src = e.widget.element;
            var dst = e.receivedNode;
            var hasHeader = hasTableHeader(src);
            toggleHeader(dst, mode === MODE_ROW ? false : mode === MODE_COLUMN ? hasHeader : info.minRow === 0 && hasHeader);

            var dstRows = countRows(dst);
            var dstCols = countColumns(dst);
            var srcRows = countRows(src);
            var srcCols = countColumns(src);
            var insertAfter = mode === MODE_ROW ? info.minRow === srcRows : info.minCol === srcCols;

            if (mode === MODE_COLUMN) {
                insertRow(dstRows > srcRows ? src : dst, 'last', Math.abs(dstRows - srcRows), TD_HTML, false);
                $(TR_SELECTOR, dst).each(function (i, v) {
                    $(v.children)[insertAfter ? 'insertAfter' : 'insertBefore'](getCell(src, i, info.minCol - insertAfter));
                });
                selectCells(e.widget, 0, info.minCol, countRows(src), dstCols);
            } else if (mode === MODE_ROW) {
                if (info.minRow === 0 && hasHeader) {
                    info.minRow++;
                }
                insertColumn(dstCols > srcCols ? src : dst, 'last', Math.abs(dstCols - srcCols), false);
                $(TR_SELECTOR, dst)[insertAfter ? 'insertAfter' : 'insertBefore'](getRow(src, info.minRow - insertAfter));
                selectCells(e.widget, info.minRow, 0, dstRows, countColumns(src));
            } else {
                if (info.numRow === 1 && info.numCol === 1) {
                    info.maxCol = info.minCol + dstCols - 1;
                    info.maxRow = info.minRow + dstRows - 1;
                    if (info.maxRow > srcRows - 1) {
                        insertRow(src, 'last', info.maxRow - srcRows + 1, TD_HTML, false);
                    }
                    if (info.maxCol > srcCols - 1) {
                        insertColumn(src, 'last',  info.maxCol - srcCols + 1, false);
                    }
                }
                info.cells(function (v, i, j) {
                    $(v).replaceWith(getCell(dst, i % dstRows, j % dstCols).cloneNode(true));
                });
                selection.select(info);
            }
            setEditorStyle(src);
            e.preventDefault();
        },
        tab: function (e) {
            tabNextCell(e.typer.getSelection(), 'next', ':first-child');
        },
        shiftTab: function (e) {
            tabNextCell(e.typer.getSelection(), 'prev', ':last-child');
        },
        keystroke: function (e) {
            if (visualRange && visualRange.widget === e.widget && (e.data === 'backspace' || e.data === 'delete')) {
                var mode = visualRange.mode;
                if (mode === MODE_ROW || mode === MODE_COLUMN) {
                    e.preventDefault();
                    visualRange.remove(mode);
                }
            }
        },
        commands: {
            addColumnBefore: function (tx) {
                var info = getCellSelection(tx.selection);
                insertColumn(tx.widget, info.minCol, info.numCol, true);
            },
            addColumnAfter: function (tx) {
                var info = getCellSelection(tx.selection);
                insertColumn(tx.widget, info.maxCol, info.numCol, false);
            },
            addRowAbove: function (tx) {
                var info = getCellSelection(tx.selection);
                insertRow(tx.widget, info.minRow, info.numRow, TD_HTML, true);
            },
            addRowBelow: function (tx) {
                var info = getCellSelection(tx.selection);
                insertRow(tx.widget, info.maxRow, info.numRow, TD_HTML, false);
            },
            removeColumn: function (tx) {
                var info = getCellSelection(tx.selection);
                info.remove(MODE_COLUMN);
            },
            removeRow: function (tx) {
                var info = getCellSelection(tx.selection);
                info.remove(MODE_ROW);
            },
            toggleTableHeader: function (tx) {
                toggleHeader(tx.widget);
                $('>th', getRow(tx.widget, 0)).text(function (i, v) {
                    return v || 'Column ' + (i + 1);
                });
            }
        }
    };

    Typer.ui.define('tableGrid', {
        type: 'tableGrid'
    });

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
                return !hasTableHeader(self.widget) || getCellSelection(toolbar.typer.getSelection()).minRow > 0;
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

    var selectHandleX = Typer.canvas.handle('cell');
    var selectHandleY = Typer.canvas.handle('cell');
    var updateOnMouseup;

    Typer.canvas.addLayer('table', function (canvas) {
        var widget = canvas.hoverNode && canvas.hoverNode.widget;
        if (widget && widget.id === 'table') {
            var rect = Typer.getRect(widget);
            canvas.drawLine(rect.left, rect.top, rect.right, rect.top, 10, 'transparent', 'solid', selectHandleX);
            canvas.drawLine(rect.left, rect.top, rect.left, rect.bottom, 10, 'transparent', 'solid', selectHandleY);
        }

        var selection = canvas.typer.getSelection();
        var handle = canvas.activeHandle;
        if (handle === selectHandleX || handle === selectHandleY) {
            var isColumnMode = handle === selectHandleX;
            var index = findIndex(updateOnMouseup ? visualRange : widget, isColumnMode, isColumnMode ? canvas.pointerX : canvas.pointerY);
            if (!updateOnMouseup) {
                visualRange = new CellSelection(widget, 0, 0, countRows(widget) - 1, countColumns(widget) - 1);
                visualRange[isColumnMode ? 'minCol' : 'minRow'] = index;
            }
            visualRange[isColumnMode ? 'maxCol' : 'maxRow'] = index;
            updateOnMouseup = true;
        } else if (canvas.selectionChanged) {
            visualRange = getCellSelection(selection);
            if (!visualRange || (visualRange.numRow === 1 && visualRange.numCol === 1)) {
                visualRange = null;
                updateOnMouseup = false;
            } else {
                updateOnMouseup = true;
            }
        }
        if (updateOnMouseup && !canvas.mousedown) {
            updateOnMouseup = false;
            if (visualRange.mode === MODE_TABLE) {
                selection.select(visualRange.element);
                visualRange = null;
            } else {
                selectCells(visualRange.widget, Math.min(visualRange.minRow, visualRange.maxRow), Math.min(visualRange.minCol, visualRange.maxCol), visualRange.numRow, visualRange.numCol);
            }
        }

        if (visualRange) {
            var c1 = getCell(visualRange, 'min');
            var c2 = getCell(visualRange, 'max');
            canvas.fill(Typer.mergeRect(Typer.getRect(c1), Typer.getRect(c2)));
        }
        canvas.toggleLayer('selection', !visualRange);
    });

}(jQuery, Typer));
