/*jshint regexp:true,browser:true,jquery:true,debug:true,-W083 */

(function ($, Typer) {
    'use strict';

    var DEFAULT_BUTTONS_LABEL = {
        createLink: 'Insert Link',
        bold: 'Bold',
        insertAnchor: 'Insert Anchor',
        insertImage: 'Insert Photo',
        italic: 'Italic',
        indent: 'Indent',
        insertUnorderedList: 'Bullet List',
        insertOrderedList: 'Numbered List',
        justifyCenter: 'Align Center',
        justifyLeft: 'Align Left',
        justifyRight: 'Align Right',
        outdent: 'Outdent',
        redo: 'Redo',
        underline: 'Underlined',
        undo: 'Undo'
    };

    var definedControls = {};

    function getTextAlign(element) {
        var textAlign = $(element).css('text-align');
        var direction = $(element).css('direction');
        switch (textAlign) {
        case '-webkit-left':
            return 'left';
        case '-webkit-right':
            return 'right';
        case 'start':
            return direction === 'ltr' ? 'left' : 'right';
        case 'end':
            return direction === 'ltr' ? 'right' : 'left';
        default:
            return textAlign;
        }
    }

    function nativePrompt(message, value) {
        value = window.prompt(message, value);
        if (value !== null) {
            return $.when(value);
        }
        return $.Deferred().reject().promise();
    }

    function resolveControls(str) {
        var tokens = (str || '').split(/\s+/);
        var controls = [];
        $.each(tokens, function (i, v) {
            if (v.slice(-1) === '*') {
                $.each(definedControls, function (i, w) {
                    if (i.slice(0, v.length - 1) === v.slice(0, -1) && tokens.indexOf('-' + i) < 0 && controls.indexOf(w) < 0) {
                        controls.push(w);
                    }
                });
            } else if (definedControls[v] && tokens.indexOf('-' + v) < 0 && controls.indexOf(definedControls[v]) < 0) {
                controls.push(definedControls[v]);
            }
        });
        return $.map(controls, Object.create);
    }

    function initControl(toolbar, control, container) {
        control.controls = control.createChildren(toolbar, control) || resolveControls(control.controls);
        control.init(toolbar, control);
        if (toolbar.options.controlInit) {
            toolbar.options.controlInit(toolbar, control);
        }
        $.each(control.controls, function (i, v) {
            initControl(toolbar, v, control.container || control.element || container);
        });
        $(control.element).appendTo(container);
        return control;
    }

    function updateControl(toolbar, control) {
        $.each((control || toolbar).controls || [], function (i, v) {
            updateControl(toolbar, v);
        });
        if (control instanceof TyperToolbarControl) {
            var options = toolbar.options;
            var disabled = toolbar.enabled(control) === false;
            var visible = true;
            if (typeof control.dependsOn === 'string') {
                visible = toolbar.typer.hasCommand(control.dependsOn);
            } else if (control.dependsOn) {
                visible = !$.grep(control.dependsOn, function (v) {
                    return !toolbar.typer.hasCommand(v);
                })[0];
            }
            $(control.element).prop('disabled', disabled);
            if (options.controlDisabledClass) {
                $(control.element).toggleClass(options.controlDisabledClass, disabled);
            }
            if (options.controlActiveClass) {
                $(control.element).toggleClass(options.controlActiveClass, !!toolbar.active(control));
            }
            if (options.controlHiddenClass) {
                $(control.element).toggleClass(options.controlHiddenClass, !visible);
            } else {
                $(control.element).toggle(visible);
            }
            control.stateChange(toolbar, control);
            if (options.controlStateChange) {
                options.controlStateChange(toolbar, control);
            }
        }
    }

    Typer.widgets.toolbar = {
        options: {
            container: '',
            toolbarClass: '',
            controlActiveClass: 'active',
            controlDisabledClass: 'disabled',
            controlHiddenClass: '',
            controlInit: null,
            controlStateChange: null,
            formattings: {
                h1: 'Heading 1',
                h2: 'Heading 2',
                h3: 'Heading 3',
                h4: 'Heading 4',
                p: 'Paragraph',
                ul: 'Unordered List',
                ol: 'Ordered List'
            },
            inlineClasses: {},
            controls: '',
            prompt: nativePrompt,
            selectLink: function () {
                return this.prompt('Enter URL');
            },
            selectImage: function () {
                return this.prompt('Enter Image URL');
            }
        },
        init: function (e) {
            var options = e.widget.options;
            var container = $('<div>').addClass(options.toolbarClass)[0];

            $.each('enabled active execute executeUI'.split(' '), function (i, v) {
                e.widget[v] = function (control) {
                    var args = Array.prototype.slice.apply(arguments);
                    args.unshift(e.widget);
                    return control[v].apply(control, args);
                };
            });
            $(container).mousedown(function () {
                setTimeout(function () {
                    clearTimeout(e.widget.toolbarTimeout);
                });
            });
            e.widget.container = container;
            e.widget.controls = resolveControls(options.controls || 'g:*');
            $.each(e.widget.controls, function (i, v) {
                initControl(e.widget, v, container);
            });
            if (options.container) {
                $(options.container).eq(0).append(container);
            }
        },
        focusin: function (e) {
            if (!e.widget.options.container) {
                clearTimeout(e.widget.toolbarTimeout);
                $(e.widget.container).appendTo(document.body).position({
                    my: 'left bottom',
                    at: 'left top',
                    of: e.typer.element,
                    within: window,
                    collision: 'fit'
                });
            }
        },
        focusout: function (e) {
            if (!e.widget.options.container) {
                clearTimeout(e.widget.toolbarTimeout);
                e.widget.toolbarTimeout = setTimeout(function () {
                    $(e.widget.container).detach();
                }, 100);
            }
        },
        beforeStateChange: function (e) {
            var selection = e.typer.getSelection();
            // traverse the selected region to compute the actual style
            // style with mixed values across selected region is marked with empty string ("")
            var style = {
                fontWeight: null,
                fontStyle: null,
                textDecoration: null,
                textAlign: null,
                inlineClass: null
            };
            $(selection.selectedElements).each(function (i, element) {
                $.each(style, function (i, v) {
                    var my;
                    if (i === 'textAlign') {
                        my = getTextAlign(element);
                    } else if (i === 'inlineClass') {
                        my = $(element).filter('span').attr('class') || '';
                    } else {
                        my = $(element).css(i);
                    }
                    style[i] = (v === '' || (v && v !== my)) ? '' : my;
                });
            });

            var element = selection.paragraphElements.slice(-1)[0];
            if ($(element).is('li')) {
                element = $(element).closest('ol, ul')[0] || element;
            }
            var tagName = element && element.tagName.toLowerCase();
            var tagNameWithClasses = tagName + ($(element).attr('class') || '').replace(/^(.)/, '.$1');
            e.widget.state = {
                linkElement: selection.getSelectedElements('a')[0] || null,
                bold: style.fontWeight === 'bold' || style.fontWeight === '700',
                italic: style.fontStyle === 'italic',
                underline: style.textDecoration === 'underline',
                superscript: selection.getSelectedElements('sup').length > 0,
                subscript: selection.getSelectedElements('sub').length > 0,
                insertUnorderedList: tagName === 'ul',
                insertOrderedList: tagName === 'ol',
                justifyLeft: style.textAlign === 'left',
                justifyCenter: style.textAlign === 'center',
                justifyRight: style.textAlign === 'right',
                inlineClass: style.inlineClass,
                formatting: tagName,
                formattingWithClassName: tagNameWithClasses
            };
        },
        stateChange: function (e) {
            updateControl(e.widget);
        }
    };

    function TyperToolbarControl(options) {
        $.extend(this, options);
    }

    function TyperToolbarButton(options) {
        $.extend(this, options);
    }

    function TyperToolbarDropDown(options) {
        $.extend(this, options);
    }

    function TyperToolbarGroup(controls) {
        this.controls = controls;
    }

    TyperToolbarControl.prototype = {
        init: function () {},
        createChildren: function () {},
        stateChange: function () {},
        enabled: function () {},
        active: function () {},
        execute: function () {},
        executeUI: function (toolbar, self) {
            if (toolbar.enabled(self) !== false) {
                self.execute.apply(self, arguments);
            }
        }
    };

    TyperToolbarButton.prototype = new TyperToolbarControl({
        type: 'button',
        init: function (toolbar, self) {
            self.element = $('<button>').text(self.label).attr('title', self.label).click(function () {
                toolbar.executeUI(self);
            })[0];
        }
    });

    TyperToolbarDropDown.prototype = new TyperToolbarControl({
        type: 'dropDown',
        init: function (toolbar, self) {
            self.element = $('<select>').change(function () {
                toolbar.executeUI(self, this.selectedIndex);
            })[0];
            $.each(self.controls, function (i, v) {
                $('<option>').text(v.label).attr('value', v.name).appendTo(self.element);
            });
        },
        stateChange: function (toolbar, self) {
            $.each(self.controls, function (i, v) {
                if (toolbar.active(v)) {
                    self.selectedIndex = i;
                    self.element.selectedIndex = i;
                    return false;
                }
            });
        },
        execute: function (toolbar, self, index) {
            toolbar.executeUI(self.controls[index]);
        }
    });

    TyperToolbarGroup.prototype = new TyperToolbarControl({
        type: 'group'
    });

    function execCommandButton(command) {
        return new TyperToolbarButton({
            name: command,
            label: DEFAULT_BUTTONS_LABEL[command],
            dependsOn: command,
            execute: function (toolbar) {
                toolbar.typer.invoke(command);
            },
            active: function (toolbar) {
                return toolbar.state[command];
            },
            enabled: function (toolbar) {
                return (command === 'indent' || command === 'outdent') ? toolbar.state.insertOrderedList || toolbar.state.insertUnorderedList : true;
            }
        });
    }

    function insertElementButton(name, tagName, callback) {
        return new TyperToolbarButton({
            name: name,
            label: DEFAULT_BUTTONS_LABEL[name],
            execute: function (toolbar) {
                $.when(callback(toolbar)).done(function (attrs) {
                    toolbar.typer.invoke(function (tx) {
                        tx.insertHtml($('<' + tagName + '>', attrs)[0]);
                    });
                });
            }
        });
    }

    $.extend(definedControls, {
        'g:history': new TyperToolbarGroup('history:*'),
        'g:insert': new TyperToolbarGroup('insert:*'),
        'g:formatting': new TyperToolbarGroup('formatting:paragraph textStyle:inlineStyle textStyle:* formatting:*'),
        'textStyle:bold': execCommandButton('bold'),
        'textStyle:italic': execCommandButton('italic'),
        'textStyle:underline': execCommandButton('underline'),
        'formatting:unorderedList': execCommandButton('insertUnorderedList'),
        'formatting:orderedList': execCommandButton('insertOrderedList'),
        'formatting:indent': execCommandButton('indent'),
        'formatting:outdent': execCommandButton('outdent'),
        'formatting:justifyLeft': execCommandButton('justifyLeft'),
        'formatting:justifyCenter': execCommandButton('justifyCenter'),
        'formatting:justifyRight': execCommandButton('justifyRight'),
        'formatting:paragraph': new TyperToolbarDropDown({
            dependsOn: 'formatting',
            createChildren: function (toolbar) {
                return $.map(Object.keys(toolbar.options.formattings || {}), function (v) {
                    return new TyperToolbarButton({
                        name: v,
                        label: toolbar.options.formattings[v],
                        execute: function () {
                            toolbar.typer.invoke('formatting', v);
                        },
                        active: function () {
                            return toolbar.state.formattingWithClassName === v || toolbar.state.formatting === v;
                        }
                    });
                });
            }
        }),
        'textStyle:inlineStyle': new TyperToolbarDropDown({
            dependsOn: 'applyClass',
            createChildren: function (toolbar) {
                return $.map(Object.keys(toolbar.options.inlineClass || {}), function (v) {
                    return new TyperToolbarButton({
                        name: v,
                        label: toolbar.options.inlineClass[v],
                        execute: function () {
                            toolbar.typer.invoke('applyClass', v);
                        },
                        active: function () {
                            return toolbar.state.inlineClass === v;
                        }
                    });
                });
            }
        }),
        'insert:insertAnchor': insertElementButton('insertAnchor', 'a', function (toolbar) {
            return $.when(toolbar.options.prompt('Enter Anchor Name')).then(function (value) {
                return {
                    name: value
                };
            });
        }),
        'insert:insertImage': insertElementButton('insertImage', 'img', function (toolbar) {
            return $.when(toolbar.options.selectImage()).then(function (value) {
                return {
                    src: value
                };
            });
        }),
        'insert:insertLink': new TyperToolbarButton({
            name: 'insertLink',
            label: DEFAULT_BUTTONS_LABEL.createLink,
            dependsOn: 'createLink',
            execute: function (toolbar) {
                $.when(toolbar.options.selectLink({
                    href: $(toolbar.state.linkElement).attr('href'),
                    target: $(toolbar.state.linkElement).attr('target')
                })).done(function (value) {
                    toolbar.typer.invoke('createLink', value);
                });
            },
            active: function (toolbar) {
                return !!toolbar.state.linkElement;
            }
        }),
        'history:undo': new TyperToolbarButton({
            name: 'undo',
            label: DEFAULT_BUTTONS_LABEL.undo,
            execute: function (toolbar) {
                toolbar.typer.undo();
            },
            enabled: function (toolbar) {
                return toolbar.typer.canUndo();
            }
        }),
        'history:redo': new TyperToolbarButton({
            name: 'redo',
            label: DEFAULT_BUTTONS_LABEL.redo,
            execute: function (toolbar) {
                toolbar.typer.redo();
            },
            enabled: function (toolbar) {
                return toolbar.typer.canRedo();
            }
        })
    });

}(jQuery, window.Typer));
