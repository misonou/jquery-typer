## 0.9.7 / 2017-06-17

- Fix: unable to focus editable regions in FireFox
- Fix: avoid `contentChange` events fired multiple times after user or code edit

## 0.9.6 / 2017-06-14

- New presets: `number` and `keywords`
- New extensions: `validation`
- New UI components
- Updates to extensions: `toolbar`, `formatting` and `table`
- Fix: `contentChange` event not fired in some circumstances
- Fix: non-editable elements inside widgets errneously treated as separate unknown widgets
- Fix: cannot insert content after an inline widget in IE
- Fix: caret being set to incorrect position when clicking empty spaces
- Fix: `Typer.getValue` returns incorrect value
- Fix: potential exception when iterating nodes
- Fix: potential exception when using polyfill for `WeakMap`
- Fix: IE11 crashed at `caretRangeFromPoint`

## 0.9.5 / 2017-03-15

- (Breaking) Major updates to `Typer.ui`
- Some events become preventable
- Fix: issues on inserting contents
- Fix: various issues on focus/blur
- Fix: widget unindentedly destroyed

## 0.9.4 / 2017-02-14

- Improved UI dialog handling
- Fix: `focusin` and `focusout` events fired twice
- Fix: event handlers from options are fired twice for some events
- Fix: stack overflow when the editable element is detached
- Fix: incorrect selection after `execCommand`

## 0.9.3 / 2017-02-04

- Add Typer events for mouse clicks
- Improved handling of subtree modification that affect caret anchors
- Use `setImmediate` from [https://github.com/yuzujs/setImmediate]
- Fix unindented effects when normalization
- Fix issues in IE polyfill of caretRangeFromPoint
- Fix IE quirks on caret position
- Fix events fired even after widget is destroyed
- Various improvements and bug fixing on extensions

## 0.9.2 / 2017-01-26

- (Breaking) Parameter change for `Typer.createRange`
- Handles right mouse click and context menu
- Allow sorting of UI controls by specifying `before` and `allow`
- Allow more common browser shortcuts enabled when editing content
- Minor changes to event propagations
- Updates on UI components and enhance async support
- Fix: IE10- hit test issue on `pointer-events: none`
- Fix: computation on text rects
- Fix: extra newlines when extracting text from selection
- Fix: floating point issue of `rectEquals` on transformed element
- Fix: `TyperCaret` issue on detached element

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
