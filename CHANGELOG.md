## 0.11.1 / 2018-03-09

- Handle unicode bidirectionality, surrogates, combining marks and vertical writing modes
- Improve behavior for extracting and inserting list
- Avoid selection being changed while calling `getSelectedTextNodes` or `getSelectedElements`
- `TyperCaret.moveTo` now returns `false` if the given position is same as current position
- Drop `setImmediate` as no significant effect
- Fix: issue in scrolling caret into view
- Fix: caret anchored on invalid nodes inside inline widgets
- Fix: `click` and `dblclick` events fired on focused widget by text cursor instead of clicked widget
- Fix: invalid state caused by `extractContent` when inserting content
- Fix: `extract` event not fired for widget that has no internal structure (i.e. no node with type `NODE_WIDGET`)
- Fix: widget check for disallowed widget and `receive` handler issue when caret is inside an editable paragraph or nested widgets
- Fix: remove empty lines when inserting incompatible paragraph
- Fix: IE character input not properly default-prevented
- Fix: caret position not preserved after `receive` event
- Fix: extra text removed during composition event
- Fix: `moveToText` moves to incorrect position for offset larger than node
- Fix: `moveByCharacter` does not step on character right after `BR` element
- Fix: `getAbstractSide` incorrect value for `over`, `underline`, `line-left` and `line-right`
- Fix: `extractText` not returning text for last widget
- Fix: `getWidgets` should not return root node
- Fix: `Typer.getValue` not returning current content and unnecessary ZSWP not removed
- Fix: snapshot not delayed when argument given
- Fix: unknown widget incorrectly recognized as part of parent widget
- Fix: IE `extractText` issue due to lack of `DocumentFragment.children`
- Fix: `contentChange` event fired during init and normalization
- Fix: incorrect source value of `contentChange`length
- Fix: `NULL` character inserted if `e.charCode` is not available in input event
- Fix: incorrect caret position after text is composed during `compositionend` event
- Fix: click and text input event in iOS/Andriod device
- Fix: hide native formatting options in iOS
- Fix: ineditable node can be selected by `TyperCaret.moveTo`
- Fix: inconsistent caret position when selecting start/end of a widget

## 0.11.0 / 2018-02-23

- Add `Typer.createCaret`, `Typer.createSelection`, `TyperCaret.getRect` and `TyperNode.typer`
- Add `TyperUI.visible`
- Add high-res timestamp for `TyperEvent` and `TyperSelection`
- Add `allow` and `allowedIn` options
- Replace visualizer extension with `Typer.canvas` and add `dragwidget` extension
- Improved handling on extracting and inserting widgets (added `extract` and `receive` event)
- Handles text transform by CSS when extracting content
- `moveByCharacter` and `moveByLine` now step on block widget
- `nodeFromPoint` now returns nearest block
- `TyperTreeWalker` now always shows widget content (remove need of `NODE_SHOW_EDITABLE`)
- Keep formatting when inserting or combining paragraphs
- Merge inline elements when combining paragraphs
- Caters `strong` and `em` tags
- Scroll caret into view when selection is changed
- (Breaking) `e.data` is removed from `contentChange` event
- (Breaking) removed `widgetFocusin` and `widgetFocusout` event
- (Breaking) removed `TyperTransaction.execCommand` and `TyperSelection.getEditableRanges`
- (Breaking) removed `accept` and `disallowedWidget` options
- (Breaking) `compareAttr` replaced by `sameElementSpec`
- Fix: `drop` event not handled
- Fix: `init` and `destroy` event fired while inserting content
- Fix: `init` and `destroy` event fired multiple times when element is re-inserted within event loop
- Fix: `destroy` event not called for nested widget
- Fix: widget re-created after associated element is re-inserted
- Fix: incorrect widget and parent node of `TyperNode` for element which its ancestor are re-inserted
- Fix: incorrect order of nodes when element is moved
- Fix: incorrect node type under inline widget
- Fix: multiple `stateChange` event fired and snapshot created after an update cycle
- Fix: handle consecutive and dangling space character correctly
- Fix: extra snapshot created before normalization
- Fix: history snapshot triggered by `getValue()`
- Fix: history redo stack flushed by selection change
- Fix: failed to extract text from detached nodes (when inserting content)
- Fix: `getRect` returns incorrect position for root element
- Fix: `getRect` exception in IE 10 for detached element
- Fix: issue on inserting new line before widget by `Ctrl+Enter` key combination
- Fix: incorrect caret position when moved to non-editable text node
- Fix: clipboard issue on Edge browser
- Fix: CSS transition/animation end detection in Material theme
- Fix: empty paragraph not normalized
- Fix: `Ctrl`/`Alt` key combination issue in Firefox
- Fix: `TyperCaret` issue when pointed to inexist node
- Fix: selection not updated after native action (e.g. select all from browsers' native menu)
- Fix: UI control state checking
- Minor fix and update to keyword preset, toolbar, media and link widget

## 0.10.7 / 2018-01-04

- Add event source
- Add `getState` and `setState` to UI and controls
- Add `getRect`, `cssFromPoint`, `cssFromRect`
- (Breaking) Rewrite snapping to element (`snap` and `unsnap`)
- (Breaking) Update to hooks
- Handle single touch as click
- Add support to auto-hyperlink email address
- Remove necessity of `inline` options for static widgets
- Fix: forbid block widget to be insert to paragraph-mode editables
- Fix: incorrect caret position after deleting contents over multiple editables
- Fix: hidden content extracted or deleted
- Fix: missing related target in manually triggered `focusout` event
- Fix: focus issue on touch device
- Fix: `getParagraphElements` returns non-paragraphs
- Fix: `moveByCharacter` issue from skipping ZWSP (on Safari)
- Fix: `moveByWord` cannot select whole word on line end
- Fix: `TyperNode.widget` inconsistent to parent's node
- Fix: visualizer mis-positioned overlay on Chrome
- Fix: prevent datepicker textbox beind focused in touch device
- Fix: keyword preset duplicate values not propertly checked

## 0.10.6 / 2017-11-06

- Datepicker allow customizing date format
- Fix: visibility on root node of `TyperTreeWalker`
- Fix: unable to edit content after inserting content with trailing `<br>`
- Fix: ZWSP not inserted when splitting empty line
- Fix: `moveByCharacter` should count `<br>` as one character
- Fix: `moveToLineEnd` cannot move to line end on negative direction
- Fix: `getParagraphElements` returns incorrect set of elements
- Fix: improved caret position on inline style boundary
- Fix: preset function-valued options not passed

## 0.10.5 / 2017-10-12

- Fix: `removeElement` exception
- Fix: `TyperSelection.clone` exception
- Fix: cater ZWSP and avoid unnecessary splitting when splitting text nodes for current selection
- Fix: IE textInput event not triggered on root element
- Fix: caret position when inserting new paragraph
- Fix: avoid empty inline widget on the inserted new paragraph
- Fix: extra empty lines when extracting text
- Fix: detection for `textInput` event whether `Event.data` is provided
- Fix: formatting extension incorrect state
- Fix: table extension toolbar control
- Fix: IE11 rendering issue when clicking on custom context menu

## 0.10.4 / 2017-09-21

- Validate event
- New control type: `link`
- New extension: `stateclass`
- New method: `Typer.ui.hint`
- Update to link extension and datepicker preset
- UI code refactoring
- Fix: show/hide callouts with transition or animation
- Fix: `TyperCaret.moveByWord` avoid unnecessarily expanding selection over multiple text nodes or elements
- Fix: minor bugs in toolbar and visualizer

## 0.10.3 / 2017-09-08

- Datepicker control now supports min and max date
- Control `stateChange` event now propagates up control tree
- Fix: snapshot does not record selection range correctly (unexpected selection range after undo)
- Fix: `TyperCaret.getRange` returns selection range outside editable area which will trigger `focusout` event to Typer when applied
- Fix: orphaned text contents (text nodes under `TyperNode` of type `NODE_EDITABLE`) are not normalized to paragraph
- Fix: revert IE input event fix to earlier version
- Fix: UI control execution context
- Fix: infinite `focusin`/`focusout` loop due to focusing Typer instance and dialog at the same time
- Fix: `control.set` does not copy `null` or `undefined` values specified in object
- Fix: incorrect value assigned to textbox after reset
- Fix: keyword control displays value instead of display text after state change

## 0.10.2 / 2017-08-30

- Improved text extraction
- New methods for controls: `control.getControl`, `control.set`, `callout.allowButtonMode`
- New method for UI: `ui.reset`
- (Breaking) New UI events `executing`, `executed`, `cancelled` replacing `controlExecuting` and `controlExecuted`
- Number control now supports loop mode
- Datepicker control now supports time component
- Fix: detection for Edge browser
- Fix: snapshot not created after changes
- Fix: first tag is trimmed by `Typer.getValue`
- Fix: IE bug in `selection.addRange`
- Fix: IE not focusing containing focusable element when clicking `<label>`
- Fix: callout not showing up in focus event by mouse click
- Fix: presets should accept text only by default
- Fix: datepicker now hides calendar after selecting date
- Fix: table style and width change does not cause `contentChange`
- Fix: resolving correct controls specified by `dialog.resolveWith`

## 0.10.1 / 2017-08-07

- Add control options: `visible`
- Add validation on dropdown, datepicker and number control
- Allow boolean values in flag options (`enabled`, `active` and `visible`)
- Allow empty value for datepicker control
- Mimic native single-line input behavior when text overflow
- Fix: inverted direction of mousewheel event in Mac
- Fix: mouse click does not move caret to clicked position
- Fix: pressing `enter` breaking editable paragraph (insert `<br>` instead)
- Fix: incorrect source in `contentChange` event after inserting content
- Fix: `TyperSelection.getEditableRanges` returns overlapped ranges
- Fix: IE10 does not have `Object.setPrototypeOf`
- Fix: inifite recursion and duplicated control when resolving child controls
- Fix: callout placed partially outside visible area
- Fix: incorrect widget supplied for preset commands
- Fix: prevent validation on disabled controls

## 0.10.0 / 2017-07-14

- New methods: `setValue`, `hasContent`, `releaseFocus`, `selectAll`
- New events: `mousewheel`
- Improved handling on concatenating paragraphs with inline styles and widgets
- Improved selection highlight
- New helper methods: `getWheelDelta`, `parseOrigin`
- New UI components: `calendar`
- New presets: `datepicker`
- Improved control resolving syntax (default namespace and scopes)
- (Breaking) Removed `openDialog`, `alert`, `confirm` and `prompt` on `Typer.ui.prototype`
- (Breaking) parameter changes to preset override functions
- Updates to extensions: `formatting`, `link`, `media`
- Fix: `focusout` events incorrectly fired when focus moved to elements that are set to has retained focus
- Fix: incorrect value returned by `Typer.getValue`
- Fix: incorrect source in `contentChange` events
- Fix: unable to move to empty line separated by `<br>` in IE
- Fix: issue with `TyperChangeTracker`

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
