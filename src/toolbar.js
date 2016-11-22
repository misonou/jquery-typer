(function ($, Typer) {
    'use strict';

    var definedControls = {};
    var activeToolbar;
    var toolbarTimeout;

    function define(base, params, init) {
        if (typeof params === 'function') {
            init = params;
            params = undefined;
        }
        init = init || function (options) {
            $.extend(this, options);
        };
        var privateInit = {};
        var _super = typeof base !== 'function' ? null : function () {
            base.apply(this, arguments);
        };
        var fn = function (options) {
            if (!(this instanceof fn)) {
                var inst = new fn(privateInit);
                fn.apply(inst, arguments);
                return inst;
            }
            if (options !== privateInit) {
                try {
                    this._super = _super;
                    init.apply(this, arguments);
                } finally {
                    this._super = null;
                }
            }
        };
        fn.prototype = _super ? new base(params) : base;
        return fn;
    }

    function parseCompactSyntax(str) {
        var m = /^([\w:]*)(?:\(([^}]+)\))?$/.exec(str);
        var params = null;
        try {
            params = m[2] && JSON.parse(('{' + m[2] + '}').replace(/([{:,])\s*([^\s:,}]+)/g, '$1"$2"'));
        } catch (e) { }
        return {
            name: m[1],
            params: params
        };
    }

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

    function resolveControls(toolbar, control) {
        control = control || toolbar;
        if (control.controls) {
            var tokens = control.controls.split(/\s+/);
            var controlsProto = {};
            $.each(tokens, function (i, v) {
                if (v.slice(-1) === '*') {
                    $.each(definedControls, function (i, w) {
                        if (i.slice(0, v.length - 1) === v.slice(0, -1) && tokens.indexOf('-' + i) < 0 && !controlsProto[i]) {
                            controlsProto[i] = Object.create(w);
                        }
                    });
                } else if (v.charAt(0) !== '-') {
                    var t = parseCompactSyntax(v);
                    if (definedControls[t.name] && tokens.indexOf('-' + t.name) < 0 && !controlsProto[t.name]) {
                        controlsProto[t.name] = $.extend(Object.create(definedControls[t.name]), t.params);
                    }
                }
            });
            var controls = [];
            $.each(controlsProto, function (i, v) {
                v.name = v.name || i;
                v.label = v.label || Typer.toolbar.labels[v.name] || v.name;
                controls.push(v);
            });
            control.controls = controls;
        } else if (typeof control.createChildren === 'function') {
            control.controls = control.createChildren(toolbar, control) || [];
        }
        $.each(control.controls || [], function (i, v) {
            v.parent = control;
            resolveControls(toolbar, v);
        });
        return control.controls;
    }

    function renderControl(toolbar, control, params) {
        control = control || toolbar;
        control.bindData = [];

        function bindPlaceholder(element) {
            $(element).find('*').andSelf().filter('[x\\:bind]').each(function (i, v) {
                var t = parseCompactSyntax($(v).attr('x:bind'));
                control.bindData.push([v, t.params]);
            }).removeAttr('x:bind');
        }

        function replacePlaceholder(t) {
            var element = $(toolbar.renderer[t] || '<div><br x:t="children"></div>')[0];
            bindPlaceholder(element);
            $('[x\\:t]', element).each(function (i, v) {
                var t = parseCompactSyntax($(v).attr('x:t'));
                var element;
                if (typeof toolbar.renderer[t.name] === 'function') {
                    element = $(toolbar.renderer[t.name](toolbar, control, t.params));
                    bindPlaceholder(element);
                } else {
                    element = replacePlaceholder(t.name);
                }
                $(v).replaceWith(element);
            });
            return element;
        }

        control.element = replacePlaceholder(control.type);
        $(control.element).bind(toolbar.renderer[control.type + 'ExecuteOn'], function () {
            toolbar.execute(control);
        });
        if (toolbar.renderer[control.type + 'Init']) {
            toolbar.renderer[control.type + 'Init'](toolbar, control);
        }
        return control.element;
    }

    function renderChildControls(toolbar, control, params) {
        return $.map(control.controls, function (v) {
            return renderControl(toolbar, v, params);
        });
    }

    function updateControl(toolbar, control) {
        $.each((control || toolbar).controls || [], function (i, v) {
            updateControl(toolbar, v);
        });
        if (control) {
            if (control.stateChange) {
                control.stateChange(toolbar, control);
                if (toolbar.renderer[control.type + 'StateChange']) {
                    toolbar.renderer[control.type + 'StateChange'](toolbar, control);
                }
            }
            var disabled = toolbar.enabled(control) === false;
            var visible = !control.hiddenWhenDisabled || !disabled;
            if (typeof control.dependsOn === 'string') {
                visible &= toolbar.typer.hasCommand(control.dependsOn);
            } else if (control.dependsOn) {
                visible &= !$.grep(control.dependsOn, function (v) {
                    return !toolbar.typer.hasCommand(v);
                })[0];
            }
            if (visible) {
                $.each(control.bindData, function (i, v) {
                    $.each(v[1], function (i, w) {
                        if (i === '_') {
                            $(v[0]).text(control[w] || '');
                        } else {
                            $(v[0]).attr(i, control[w] || '');
                        }
                    });
                });
            }

            var $elm = $(control.element);
            $elm.prop('disabled', disabled);
            if (toolbar.options.controlDisabledClass) {
                $elm.toggleClass(toolbar.options.controlDisabledClass, disabled);
            }
            if (toolbar.options.controlActiveClass) {
                $elm.toggleClass(toolbar.options.controlActiveClass, !!toolbar.active(control));
            }
            if (toolbar.options.controlHiddenClass) {
                $elm.toggleClass(toolbar.options.controlHiddenClass, !visible);
            } else if (!visible) {
                if ($elm.css('display') !== 'none') {
                    $elm.data('original-display', $elm.css('display'));
                }
                $elm.hide();
            } else if ($elm.data('original-display')) {
                $elm.css('display', $elm.data('original-display'));
            } else {
                $elm.show();
            }
        }
    }

    function initToolbar(toolbar, container) {
        resolveControls(toolbar);
        toolbar.element = renderControl(toolbar);

        var $elm = $(toolbar.element).addClass('typer-ui typer-ui-toolbar');
        if (container) {
            $elm.appendTo(container);
        } else {
            $elm.addClass('typer-ui-toolbar-floating').css('z-index', 1000);
            $elm.mousedown(function (e) {
                var pos = $elm.position();
                if (e.target === toolbar.element) {
                    var handler = function (e1) {
                        showToolbar(toolbar, {
                            top: pos.top + (e1.clientY - e.clientY),
                            left: pos.left + (e1.clientX - e.clientX)
                        });
                    };
                    $(document.body).mousemove(handler);
                    $(document.body).mouseup(function () {
                        $(document.body).unbind('mousemove', handler);
                    });
                }
                setTimeout(function () {
                    clearTimeout(toolbar.toolbarTimeout);
                });
            });
        }
        $.each('enabled active execute'.split(' '), function (i, v) {
            toolbar[v] = function (control) {
                if (typeof control[v] === 'function' && (v !== 'execute' || toolbar.enabled(v) !== false)) {
                    var args = Array.prototype.slice.apply(arguments);
                    args.unshift(toolbar);
                    return control[v].apply(control, args);
                }
            };
        });
        toolbar.typer.retainFocus(toolbar.element);
    }

    function showToolbar(toolbar, position) {
        if (toolbar.widget || !toolbar.options.container) {
            clearTimeout(toolbarTimeout);
            if (activeToolbar !== toolbar) {
                hideToolbar(true);
                activeToolbar = toolbar;
                $(toolbar.element).appendTo(document.body);
            }
            if (position) {
                toolbar.position = 'fixed';
                $(toolbar.element).css(position);
            } else if (toolbar.position !== 'fixed') {
                var rect = Typer.createRange(toolbar.typer.element).getBoundingClientRect();
                var height = $(toolbar.element).height();

                if (rect.top + rect.height > document.body.offsetHeight) {
                    toolbar.position = '';
                } else if (rect.top < height) {
                    toolbar.position = 'bottom';
                }
                $(toolbar.element).css({
                    left: rect.left + $(window).scrollLeft(),
                    top: (toolbar.position === 'bottom' ? (rect.top + rect.height) + 10 : rect.top - height - 10) + $(window).scrollTop()
                });
            }
        }
    }

    function hideToolbar(force) {
        clearTimeout(toolbarTimeout);
        if (force) {
            if (activeToolbar) {
                $(activeToolbar.element).detach();
                activeToolbar.position = '';
                activeToolbar = null;
            }
        } else {
            toolbarTimeout = setTimeout(function () {
                hideToolbar(true);
            }, 100);
        }
    }

    Typer.widgets.toolbar = {
        inline: true,
        options: {
            container: '',
            controlActiveClass: 'active',
            controlDisabledClass: 'disabled',
            controlHiddenClass: '',
            controls: '',
            renderer: null,
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
            prompt: nativePrompt,
            selectLink: function () {
                return this.prompt('Enter URL');
            },
            selectImage: function () {
                return this.prompt('Enter Image URL');
            }
        },
        init: function (e) {
            var toolbar = e.widget;
            toolbar.state = {};
            toolbar.controls = toolbar.options.controls || '__root__';
            toolbar.renderer = toolbarRenderer[toolbar.options.renderer] || toolbarRenderer.default;
            initToolbar(toolbar, toolbar.options.container);
        },
        widgetInit: function (e, widget) {
            widget.toolbar = {
                typer: e.typer,
                widget: widget,
                controls: 'g:widget',
                renderer: e.widget.renderer,
                options: e.widget.options
            };
            initToolbar(widget.toolbar);
        },
        focusin: function (e) {
            showToolbar(e.widget);
        },
        focusout: function (e) {
            setTimeout(hideToolbar);
        },
        widgetFocusin: function (e, widget) {
            showToolbar(widget.toolbar);
        },
        widgetFocusout: function (e, widget) {
            showToolbar(e.widget);
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
            if (activeToolbar) {
                updateControl(activeToolbar);
                showToolbar(activeToolbar);
            }
        }
    };

    /* ********************************
     * Controls Classes
     * ********************************/

    var toolbarButton = define({
        type: 'button'
    });

    var toolbarDropdown = define({
        type: 'dropdown',
        stateChange: function (toolbar, self) {
            $.each(self.controls, function (i, v) {
                if (toolbar.active(v)) {
                    $('select', self.element).prop('selectedIndex', i);
                    self.selectedIndex = i;
                    self.selectedValue = v.label || v.name;
                    return false;
                }
            });
        },
        execute: function (toolbar, self) {
            toolbar.execute(self.selectedIndex);
        },
        enabled: function (toolbar, self) {
            return self.controls.length > 0;
        }
    });

    var toolbarGroup = define({
        type: 'group',
        hiddenWhenDisabled: true
    }, function (controls, params) {
        this.controls = controls;
        $.extend(this, params);
    });

    var toolbarTextbox = define({
        type: 'textbox'
    });

    var formattingButton = define(toolbarButton, function (command) {
        this._super({
            dependsOn: command,
            execute: function (toolbar) {
                toolbar.typer.invoke(command);
            },
            active: function (toolbar) {
                return toolbar.state[command];
            },
            enabled: function (toolbar) {
                return !!toolbar.state.formatting && ((command !== 'indent' && command !== 'outdent') || toolbar.state.insertOrderedList || toolbar.state.insertUnorderedList);
            }
        });
    });

    var insertElementButton = define(toolbarButton, function (name, tagName, defaultAttr, callback) {
        this._super({
            execute: function (toolbar) {
                $.when((callback || defaultAttr)(toolbar)).done(function (attrs) {
                    toolbar.typer.invoke(function (tx) {
                        if (typeof attrs !== 'object') {
                            var value = attrs;
                            attrs = {};
                            attrs[defaultAttr] = value;
                        }
                        tx.insertHtml($('<' + tagName + '>', attrs)[0]);
                    });
                });
            }
        });
    });

    /* ********************************
     * Built-in Controls
     * ********************************/

    $.extend(definedControls, {
        // Basic controls groups
        '__root__': toolbarGroup('g:* -g:widget'),
        'g:history': toolbarGroup('history:*'),
        'g:insert': toolbarGroup('insert:*', {
            enabled: function (toolbar) {
                return toolbar.typer.document.rootNode.nodeType !== Typer.NODE_EDITABLE_INLINE;
            }
        }),
        'g:formatting': toolbarGroup('formatting:paragraph formatting:inlineStyle formatting:*', {
            enabled: function (toolbar) {
                return !!toolbar.state.formatting;
            }
        }),

        // Basic text style and formatting controls
        'formatting:bold': formattingButton('bold'),
        'formatting:italic': formattingButton('italic'),
        'formatting:underline': formattingButton('underline'),
        'formatting:unorderedList': formattingButton('insertUnorderedList'),
        'formatting:orderedList': formattingButton('insertOrderedList'),
        'formatting:indent': formattingButton('indent'),
        'formatting:outdent': formattingButton('outdent'),
        'formatting:justifyLeft': formattingButton('justifyLeft'),
        'formatting:justifyCenter': formattingButton('justifyCenter'),
        'formatting:justifyRight': formattingButton('justifyRight'),

        // Text style and formatting drop-down menus
        'formatting:paragraph': toolbarDropdown({
            dependsOn: 'formatting',
            hiddenWhenDisabled: true,
            createChildren: function (toolbar) {
                return $.map(Object.keys(toolbar.options.formattings || {}), function (v) {
                    return toolbarButton({
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
        'formatting:inlineStyle': toolbarDropdown({
            dependsOn: 'applyClass',
            hiddenWhenDisabled: true,
            createChildren: function (toolbar) {
                return $.map(Object.keys(toolbar.options.inlineClass || {}), function (v) {
                    return toolbarButton({
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

        // Basic element insertion controls
        'insert:anchor': insertElementButton('insertAnchor', 'a', 'name', function (toolbar) {
            return $.when(toolbar.options.prompt('Enter Anchor Name'));
        }),
        'insert:image': insertElementButton('insertImage', 'img', 'src', function (toolbar) {
            return $.when(toolbar.options.selectImage());
        }),
        'insert:link': toolbarButton({
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

        // History controls
        'history:undo': toolbarButton({
            execute: function (toolbar) {
                toolbar.typer.undo();
            },
            enabled: function (toolbar) {
                return toolbar.typer.canUndo();
            }
        }),
        'history:redo': toolbarButton({
            execute: function (toolbar) {
                toolbar.typer.redo();
            },
            enabled: function (toolbar) {
                return toolbar.typer.canRedo();
            }
        }),

        // Widget controls
        'g:widget': toolbarGroup('', {
            createChildren: function (toolbar, self) {
                if (toolbar.widget) {
                    var controls = [];
                    if ($(toolbar.widget.element).is('img')) {
                        controls.push('media:filePicker(icon:insertImage) media:*');
                    }
                    controls.push('widget:*');
                    self.controls = controls.join(' ');
                    return resolveControls(toolbar, self);
                }
            },
            enabled: function (toolbar) {
                return !!toolbar.widget;
            }
        }),
        'widget:delete': toolbarButton({
            execute: function (toolbar) {
                toolbar.widget.remove();
            },
            enabled: function (toolbar) {
                return !!toolbar.widget;
            }
        }),

        // Multimedia controls
        'media:filePicker': toolbarButton({
            stateChange: function (toolbar, self) {
                self.label = (/(?:^|\/)([^/]+)$/.exec($(toolbar.widget.element).attr('src')) || [])[1] || '';
            },
            execute: function (toolbar) {
                var currentValue = $(toolbar.widget.element).attr('src');
                $.when(toolbar.options.selectImage(currentValue)).then(function (value) {
                    toolbar.typer.invoke(function (tx) {
                        $(toolbar.widget.element).attr('src', value.src || value);
                    });
                });
            }
        })
    });

    /* ********************************
     * Built-in Renderers
     * ********************************/

    var toolbarRenderer = define({
        group: '<div class="typer-ui-group" x:bind="(role:name)"><br x:t="children"/></div>',
        label: '<span class="typer-ui-label"><br x:t="labelIcon"/><br x:t="labelText"/></span>',
        labelText: '<span x:bind="(_:label)"></span>',
        labelIcon: '',
        button: '<button x:bind="(title:label,role:name)"><br x:t="label"/></button>',
        buttonExecuteOn: 'click',
        dropdown: '<div class="typer-ui-dropdown" x:bind="(title:label,role:name)"><select><option x:t="children(t:dropdownItem)"/></select></div>',
        dropdownExecuteOn: 'change',
        dropdownItem: '<option x:bind="(value:name,_:label)"></option>',
        children: renderChildControls,
        getIcon: function (control, iconSet) {
            return (Typer.toolbar.icons[control.icon] || Typer.toolbar.icons[control.name] || '')[iconSet] || '';
        }
    });

    toolbarRenderer.default = toolbarRenderer();

    toolbarRenderer.material = toolbarRenderer({
        resources: [
            'https://fonts.googleapis.com/css?family=Roboto:400,500,700',
            'https://fonts.googleapis.com/icon?family=Material+Icons',
            'https://cdn.rawgit.com/misonou/jquery-typer/master/css/jquery.typer.material.css'
        ],
        labelText: function (toolbar, control) {
            return this.getIcon(control, 'material') ? '' : toolbarRenderer.default.labelText;
        },
        labelIcon: function (toolbar, control) {
            return this.getIcon(control, 'material').replace(/(.+)/, '<i class="material-icons">$1</i>');
        },
        dropdown: '<div class="typer-ui-dropdown typer-ui-menu" x:bind="(role:name)"><button x:bind="(title:label)"><span class="typer-ui-label"><br x:t="labelIcon"/><span x:bind="(_:selectedValue)"></span></span></button><div class="typer-ui-controlpane"><br x:t="children"></div></div>',
        textbox: '<div class="typer-ui-textbox" x:bind="(role:name)"><label><br x:t="label"/><div spellcheck="false"></div></label></div>',
        textboxInit: function (toolbar, control) {
            $(control.element).toggleClass('empty', !control.value);
            $('>label>div', control.element).text(control.value || '').typer({
                inline: true,
                lineBreak: false,
                change: function (e, value) {
                    control.value = value;
                    $(control.element).toggleClass('empty', !control.value);
                }
            });
        }
    });

    /* ********************************
     * Resources
     * ********************************/

    Typer.toolbar = {
        labels: {},
        icons: {},
        controls: definedControls,
        renderer: toolbarRenderer,
        button: toolbarButton,
        dropdown: toolbarDropdown,
        group: toolbarGroup,
        textbox: toolbarTextbox
    };

    $.extend(Typer.toolbar.labels, {
        'formatting:bold': 'Bold',
        'formatting:italic': 'Italic',
        'formatting:underline': 'Underlined',
        'formatting:unorderedList': 'Bullet List',
        'formatting:orderedList': 'Numbered List',
        'formatting:indent': 'Indent',
        'formatting:outdent': 'Outdent',
        'formatting:justifyLeft': 'Align Left',
        'formatting:justifyCenter': 'Align Center',
        'formatting:justifyRight': 'Align Right',
        'formatting:paragraph': 'Formatting',
        'formatting:inlineStyle': 'Text Style',
        'insert:anchor': 'Insert Anchor',
        'insert:image': 'Insert Photo',
        'insert:link': 'Insert Link',
        'history:undo': 'Undo',
        'history:redo': 'Redo',
        'widget:delete': 'Delete',
        'media:filePicker': 'Pick File'
    });

    $.each({
        'formatting:bold': 'format_bold',
        'formatting:italic': 'format_italic',
        'formatting:underline': 'format_underlined',
        'formatting:unorderedList': 'format_list_bulleted',
        'formatting:orderedList': 'format_list_numbered',
        'formatting:indent': 'format_indent_increase',
        'formatting:outdent': 'format_indent_decrease',
        'formatting:justifyLeft': 'format_align_left',
        'formatting:justifyCenter': 'format_align_center',
        'formatting:justifyRight': 'format_align_right',
        'insert:anchor': 'label',
        'insert:image': 'insert_photo',
        'insert:link': 'insert_link',
        'insert:video': 'videocam',
        'history:undo': 'undo',
        'history:redo': 'redo',
        'widget:delete': 'delete',
    }, function (i, v) {
        Typer.toolbar.icons[i] = {};
        Typer.toolbar.icons[i].material = v;
    });

} (jQuery, window.Typer));
