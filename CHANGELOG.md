## 0.9.1 / 2017-01-20

- Introduce shortcuts and hooks
- Allow rich-text copy and paste within the same window on IE and Firefox
- Improved handling on copying content
- Fix: many fixes to `TyperCaret` esp. traversal over characters and words
- Fix: incorrect position returned by `caretRangeFromPoint` polyfill
- Fix: `TyperDOMNodeIterator` erroneous iteration
- Fix: `TyperCaret.moveToPoint` moves to incorrect position when the point is visually covered by other elements
- Fix: focus lost from element with `retainFocus` called
- Fix: incorrect selection after `TyperTransaction.execCommand`

## 0.9.0 / 2017-01-12

- (Breaking) Rewrite `TyperSelection` and introduce `TyperCaret`
- (Breaking) Removed `Typer.select` and `Typer.moveCaret`, control selection by `Typer.getSelection()` instead
- (Breaking) Removed `TyperNode.childDOMNodes` ,`TyperNode.cloneDOMNodes`, `TyperNode.createTreeWalk` and `TyperNode.createDOMNodeIterator`
- (Breaking) Removed `TyperTransaction.restoreSelection`, selection wlill automatically restored
- (Breaking) Event data is provided in `TyperEvent.data` instead of as the second argument
- (Breaking) `Typer.getRangeFromMouseEvent` replaced by `Typer.caretRangeFromPoint`
- Add `defaultOptions` options, set to `false` to mute default options
- Add API to control caret over characters, words and lines
- Improved behavior when typing in IME mode
- Fix: better white-space handling in inserting content
- Fix: exceptions when disconnected nodes are encountered in `createRange`
- Fix: IE issue in clearing selection

## 0.9.0-beta / 2016-12-08

- Constructor change to `Typer(element, options)` with existing one compatible
- Introduce UI controls, themes and dialogs
- Introduce presets and `$.fn.typer(preset, options)`
- Add `typer.widgetEnabled()` and `typer.getStaticWidgets()`
- Add `disallowedElement` and `allowedWidgets` options
- (Breaking) Removed `controlClasses`, `controlElements` and `attributes` options
- (Breaking) `Typer.getRangeFromMouseEvent` replaced by `Typer.getRangeFromPoint`
- (Breaking) Deprecated node type `NODE_OUTER_PARAGRAPH`
- Improved response of change event
- Many fixes to single paragraph mode
- Fix: content inserted in incorrect location
- Fix: incorrect caret position after inserting content
- Fix: unintended non-breaking space (`&nbsp;`) between word boundaries when inserting contents
- Fix: various exceptions from `TyperDOMNodeIterator`
- Fix: `createRange` incorrectly returns collapsed range if `+startOffset` evaluates to a number
- Fix: `computeSelection` and window focus detection on IE
- Fix: `TyperSelection.widgets` does not return inline widgets
- Fix: `destroy` event incorrectly fired on widgets

## 0.8.3 / 2016-11-22

- Add support for single paragraph mode
- Updates on toolbar widget
- Fix: reference error for browser without native Map support
- Fix: issue on inserting new line
- Fix: issue related with copy and paste

## 0.8.2 / 2016-11-03

- Add widget events
- Add `typer.retainFocus()`
- Default build includes extensions in `src/extensions`
- Fix: reference error when placed above `<body>`
- Fix: insert content in empty editable area
- Fix: insert text content before or after widgets
- Fix: issue with jQuery < 1.12

## 0.8.1 / 2016-09-06

- Fix insert line issue on line end
- Fix extractContent, issue related with copy and paste
- Fix TyperDOMNodeIterator

## 0.8.0 / 2016-07-22

- Core rewrite
- (Breaking) TyperState retired, replaced with TyperSelection
- (Breaking) API changes on Typer and TyperTransaction
- Typer.moveCaret, Typer.hasCommand, Typer.getSelection
- Allow user options on widget
- Fix: incorrect behavior when typing fast

## 0.7.0 / 2016-07-13

- Improvement on (un)ordered list
- TyperTransaction.getSelectedText, TyperTransaction.isSingleEditable
- Style information on TyperState moved to toolbar widget
- Fix: issue on extracting/inserting content

## 0.6.0 / 2016-06-30

- Inline widget
- $.fn.typer
- (Breaking) Typer.commandFactory removed
- Fix: Issue when detect text nodes before or after BR
- Fix: Empty inline tag not cleaned
- Fix: Attributes not cleaned on outer paragraphs
- Fix: Cursor placed at wrong position when keying backspace or delete
- Fix: Issue on apply formatting as (un)ordered list

## 0.5.2 / 2015-08-25

- Initial release
