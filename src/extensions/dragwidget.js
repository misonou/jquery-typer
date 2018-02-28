(function ($, Typer) {
    'use strict';

    var activeNode;
    var isDragging;
    var insertPoint;

    Typer.canvas.addLayer('dragWidget', function (canvas) {
        canvas.clear();
        if (!isDragging && canvas.pointerMoved) {
            activeNode = canvas.typer.nodeFromPoint(canvas.pointerX, canvas.pointerY, Typer.NODE_WIDGET) || activeNode;
        }
        if (activeNode && activeNode.typer === canvas.typer) {
            var rect = Typer.getRect(activeNode.element);
            if (Typer.pointInRect(canvas.pointerX, canvas.pointerY, rect, 10)) {
                canvas.addControlPoint(activeNode.element, 'move', function (d) {
                    d.progress(function () {
                        isDragging = true;
                    });
                    d.done(function () {
                        if (isDragging && insertPoint) {
                            canvas.typer.invoke(function (tx) {
                                tx.selection.select(insertPoint);
                                tx.insertHtml(activeNode.element);
                            });
                        } else {
                            canvas.typer.select(activeNode.element);
                        }
                        isDragging = false;
                        insertPoint = null;
                        canvas.refresh();
                    });
                });
            }
        }
        if (isDragging) {
            var node = canvas.typer.nodeFromPoint(canvas.pointerX, canvas.pointerY, Typer.NODE_PARAGRAPH | Typer.NODE_WIDGET);
            if (node && !Typer.containsOrEquals(activeNode.element, node.element)) {
                var rectA = Typer.getRect(node.element);
                var rectC = Typer.getRect(Typer.closest(node, Typer.NODE_EDITABLE).element);
                var before = canvas.pointerY < rectA.centerY;
                var nextNode = before ? node.previousSibling : node.nextSibling;
                if (nextNode !== activeNode && canvas.typer.widgetAllowed(activeNode.widget.id, node)) {
                    var y;
                    if (nextNode) {
                        var rectB = Typer.getRect(nextNode.element);
                        y = (rectA.bottom <= rectB.top ? rectA.bottom + rectB.top : rectB.bottom + rectA.top) / 2;
                    } else {
                        y = rectA[before ? 'top' : 'bottom'] + (Math.max(0, parseFloat(window.getComputedStyle(node.element)[before ? 'marginTop' : 'marginBottom'])) / 2) * (before ? -1 : 1);
                    }
                    canvas.drawLine(rectC.left, y, rectC.right, y, 1, 'red', 'dashed');
                    insertPoint = canvas.typer.createCaret(node.element, before);
                    return;
                }
            }
            insertPoint = null;
        }
    });

})(jQuery, Typer);
