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
