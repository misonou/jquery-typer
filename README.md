# Installation

```html
<script type="text/javascript" src="//code.jquery.com/jquery-1.12.4.min.js"></script> 
<script type="text/javascript" src="jquery.typer.js"></script> 
```

## Compatibility

The plugin works with IE9+ and other modern browsers and jQuery 1.10+.

# Usage

To initialize the elements as an editable region simple call:

```javascript
$('.richtext').typer(options);
```

If the plugin API access is needed, instantiate the `Typer` object for each element:

```javascript
$('.richtext').each(function () {
    var typer = new Typer({
        // now the `element` option is required
        // and it should be only a single element node
        element: this
    });
    // now you can work with the Typer object explicitly
});
```

For full documentation please visit the [project wiki](https://github.com/misonou/jquery-typer/wiki).

## Options

```javascript
{
    // required if `new Typer` is called explicitly
    element: Element,

    // to exclude supplementary CSS classes that are solely for editing purpose
    // those CSS classes are stripped when outputing HTML code
    controlClasses: 'classes to stripped separated by spaces',

    // to exclude supplementary HTML elements that are solely for editing purpose
    // those elements are stripped when outputing HTML code
    controlElements: '.a-valid-jQuery-selector',

    // to whitelist atttributes that are allowed on the element
    // any attributes not on the whitelist is removed when pasting content to the editor
    // default value is 'title target href src align name class width height'
    attributes: 'attribute names separated by spaces',

    // how many level user can undo
    historyLevel: 100,

    // custom extensions to use
    // for more information see documentation on project wiki 
    widgets: [ /* ... */ ],

    // two classes of options of can also be passed to the constructor
    // -- events
    //    'init', 'focusin', 'focusout', 'change', 'beforeStateChange', 'statechange'
    init: function (e) { /* ... */ },

    // -- keystroke events can be listened by key names or compound key names
    //    for more information see documentation on project wiki 
    //    for example Ctrl/Cmd+Alt+S can be listened by:
    ctrlAltS: function (e) { /* ... */ },

    // -- extensions options
    //    built-in extension enabled by default: 'inlineStyle', 'formatting', 'list', 'link'
    //    the following will disable hyperlinks:
    link: false,

    //    complex extension options may need to extra options
    //    to pass options specifically for toolbar extension:
    toolbar: { /* ... */ }
}
```
