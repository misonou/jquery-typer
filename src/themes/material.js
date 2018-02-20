(function ($, Typer) {
    'use strict';

    var ANIMATION_END = 'animationend oanimationend webkitAnimationEnd';
    var TRANSITION_END = 'transitionend otransitionend webkitTransitionEnd';

    function setMenuPosition(thisMenu) {
        var callout = $('.typer-ui-float', thisMenu)[0];
        var rect = Typer.getRect(callout);
        if (rect.bottom > $(window).height()) {
            $(callout).addClass('float-top');
        } else if (rect.top < 0) {
            $(callout).removeClass('float-top');
        }
        if (rect.right > $(window).width()) {
            $(callout).addClass('float-left');
        } else if (rect.left < 0) {
            $(callout).removeClass('float-left');
        }
    }

    function bindEvent(ui, element) {
        $(element || ui.element).click(function (e) {
            var control = ui.getControl(e.target);
            if (control) {
                if (control.is('checkbox')) {
                    ui.execute(control, !control.value);
                } else if (control.is('button callout')) {
                    ui.execute(control);
                }
            }
        });
    }

    function runCSSTransition(element, className, callback) {
        var arr = $(element).not('.' + className).map(function (i, v) {
            var deferred = $.Deferred();
            var handler = function (e) {
                if ($(v).hasClass(className) && e.target === v) {
                    $(v).toggleClass(className, !Typer.ui.matchWSDelim(e.type, ANIMATION_END));
                    $(v).off(TRANSITION_END + ' ' + ANIMATION_END, handler);
                    deferred.resolveWith(v);
                }
            };
            $(element).addClass(className).on(TRANSITION_END + ' ' + ANIMATION_END, handler);
            return deferred.promise().done(callback);
        });
        return $.when.apply(null, arr.get());
    }

    function detachCallout(control) {
        control.callout = $(control.element).children('.typer-ui-float').detach().addClass('typer-ui typer-ui-material is-' + control.type)[0];
        bindEvent(control.ui, control.callout);
    }

    Typer.ui.themes.material = Typer.ui.theme({
        resources: [
            'https://fonts.googleapis.com/css?family=Roboto:400,500,700',
            'https://fonts.googleapis.com/icon?family=Material+Icons',
            'https://cdn.rawgit.com/misonou/jquery-typer/master/css/jquery.typer.material.css'
        ],
        controlActiveClass: 'active',
        controlDisabledClass: 'disabled',
        controlHiddenClass: 'hidden',
        controlErrorClass: 'error',
        iconset: 'material',
        label: '<span class="typer-ui-label"><br x:t="labelIcon"/><br x:t="labelText"/></span>',
        labelText: function (ui, control) {
            if (control.is('textbox') || (!control.contextualParent.showButtonLabel && ui.getIcon(control))) {
                return '';
            }
            return '<span x:bind="(_:label)"></span>';
        },
        labelIcon: function (ui, control) {
            if (control.contextualParent.is('dropdown') || control.is('checkbox') || !ui.getIcon(control)) {
                return '';
            }
            return '<i class="material-icons" x:bind="(_:icon)"></i>';
        },
        buttonset: '<div class="typer-ui-buttonset"><br x:t="children(buttonsetGroup:left)"/><div class="typer-ui-buttonset-pad"></div><br x:t="children(buttonsetGroup:right)"/></div>',
        buttonlist: '<div class="typer-ui-buttonlist"><br x:t="children"/></div>',
        form: '<div class="typer-ui-form"><br x:t="children"/></div>',
        menupane: '<div class="typer-ui-float"><div class="typer-ui-buttonlist"><br x:t="children"/></div></div>',
        toolbar: '<div class="typer-ui-buttonset is-toolbar"><br x:t="children"/></div>',
        contextmenu: '<div class="typer-ui-float is-contextmenu anim-target"><div class="typer-ui-buttonlist"><br x:t="children"/></div></div>',
        group: '<div class="typer-ui-group"><br x:t="children"/></div>',
        groupStateChange: function (ui, control) {
            setImmediate(function () {
                control.setState('sep-before', !!$(control.element).prevAll(':not(.hidden)')[0]);
                control.setState('sep-after', !!$(control.element).nextAll(':not(.hidden):first:not(.typer-ui-group)')[0]);
            });
        },
        link: '<label class="has-clickeffect"><a x:bind="(href:value,title:label)"><br x:t="label"/><span class="typer-ui-label-annotation" role="shortcut" x:bind="(_:shortcut)"></span><span class="typer-ui-label-annotation" x:bind="(_:annotation)"></span></a></label>',
        button: '<button x:bind="(title:label)"><br x:t="label"/><span class="typer-ui-label-annotation" role="shortcut" x:bind="(_:shortcut)"></span><span class="typer-ui-label-annotation" x:bind="(_:annotation)"></span></button>',
        file: '<label class="has-clickeffect" x:bind="(title:label)"><input type="file"/><br x:t="label"/></label>',
        fileInit: function (ui, control) {
            $(control.element).find(':file').change(function (e) {
                ui.execute(control, e.target.files);
                setImmediate(function () {
                    var form = document.createElement('form');
                    form.appendChild(e.target);
                    form.reset();
                    $(e.target).prependTo(control.element);
                });
            });
        },
        callout: '<label class="typer-ui-callout" x:bind="(title:label)"><br x:t="button"/><br x:t="menupane"/></label>',
        calloutInit: function (ui, control) {
            if (!control.contextualParent.is('callout contextmenu')) {
                detachCallout(control);
            }
        },
        dropdown: '<label class="typer-ui-dropdown" x:bind="(title:label)"><button><span class="typer-ui-label"><br x:t="labelIcon"/><span x:bind="(_:selectedText)"></span></span></button><br x:t="menupane"/></button>',
        dropdownInit: function (ui, control) {
            if (!control.contextualParent.is('callout contextmenu')) {
                detachCallout(control);
            }
        },
        checkbox: '<button class="typer-ui-checkbox" x:bind="(title:label)"><br x:t="label"/></button>',
        checkboxStateChange: function (ui, control) {
            control.setState('checked', !!control.value);
        },
        textboxInner: '<div class="typer-ui-textbox-inner"><div contenteditable spellcheck="false"></div><div class="typer-ui-textbox-placeholder" x:bind="(_:label)"></div><div class="typer-ui-textbox-error"></div></div>',
        textbox: '<label class="typer-ui-textbox" x:bind="(title:label)"><br x:t="label"/><div class="typer-ui-textbox-wrapper"><br x:t="textboxInner"/></div></label>',
        textboxElement: '[contenteditable]',
        textboxPresetOptions: {
            stateclass: {
                target: '.typer-ui-textbox'
            }
        },
        dialog: '<div class="typer-ui-dialog-wrapper"><div class="typer-ui-dialog-pin"></div><div class="typer-ui-dialog"><div class="typer-ui-dialog-inner anim-target"><div class="typer-ui-form"><br x:t="children"></div></div></div></div>',
        dialogInit: function (ui, control) {
            var parent = ui.parentControl;
            var dir = control.pinnable && parent && Typer.ui.matchWSDelim(parent.pinDirection, 'left right top bottom');
            control.setState('is-modal', !!control.modal);
            ui.setState(control.resolveBy, 'pin-active', true);
            if (dir) {
                control.setState('pinned', dir);
                parent.setState('pin-active', true);
            }
        },
        dialogWaiting: function (ui, control) {
            control.setState('loading', true);
        },
        dialogError: function (ui, control) {
            control.setState('loading', false);
        },
        dialogDestroy: function (ui, control) {
            if (ui.parentControl) {
                ui.parentControl.setState('pin-active', false);
            }
        },
        showCallout: function (ui, control) {
            if (control.callout) {
                ui.show(control, control.callout, control.element, 'left bottom');
            }
        },
        afterShow: function (ui, control, data) {
            if (control.is('dialog')) {
                var parent = ui.parentControl;
                var dir = control.pinnable && parent && Typer.ui.matchWSDelim(parent.pinDirection, 'left right top bottom');
                var e1 = $(control.element).find('.typer-ui-dialog')[0];
                var e2 = $(control.element).find('.typer-ui-dialog-pin')[0];
                if (dir) {
                    Typer.ui.snap(e1, parent.element, dir + ' center');
                    Typer.ui.snap(e2, parent.element, dir + ' center inset');
                } else {
                    Typer.ui.snap(e1, window, 'center inset');
                }
            }
            return control.is('dialog contextmenu') && runCSSTransition($('.anim-target', data.element)[0] || data.element, 'open');
        },
        beforeHide: function (ui, control, data) {
            return control.is('dialog contextmenu') && runCSSTransition($('.anim-target', data.element)[0] || data.element, 'closing').done(function () {
                $(this).removeClass('open closing');
            });
        },
        executed: function (ui, control) {
            if (!control.is('textbox') && (ui.is('contextmenu') || (control.contextualParent.is('callout dropdown') && control.contextualParent.hideCalloutOnExecute !== false))) {
                ui.hide(ui.is('contextmenu') ? null : control.contextualParent);
            }
        },
        init: function (ui, control) {
            bindEvent(ui);
        }
    });

    $(function () {
        var SELECT_EFFECT = '.typer-ui-material button:not(.typer-ui-checkbox), .typer-ui-material .has-clickeffect';
        $(document.body).on('mousedown', SELECT_EFFECT, function (e) {
            var pos = Typer.getRect(e.currentTarget);
            var $overlay = $('<div class="typer-ui-clickeffect"><i></i></div>').appendTo(e.currentTarget);
            var $anim = $overlay.children().css({
                top: e.clientY - pos.top,
                left: e.clientX - pos.left,
            });
            var p1 = Math.pow(e.clientY - pos.top, 2) + Math.pow(e.clientX - pos.left, 2);
            var p2 = Math.pow(e.clientY - pos.top, 2) + Math.pow(e.clientX - pos.right, 2);
            var p3 = Math.pow(e.clientY - pos.bottom, 2) + Math.pow(e.clientX - pos.left, 2);
            var p4 = Math.pow(e.clientY - pos.bottom, 2) + Math.pow(e.clientX - pos.right, 2);
            var scalePercent = 0.5 + 2 * Math.sqrt(Math.max(p1, p2, p3, p4)) / parseFloat($overlay.css('font-size'));
            setImmediate(function () {
                $anim.css('transform', $anim.css('transform') + ' scale(' + scalePercent + ')').addClass('animate-in');
            });
            $overlay.css('border-radius', $(e.currentTarget).css('border-radius'));
        });
        $(document.body).on('mouseup mouseleave', SELECT_EFFECT, function (e) {
            var $overlay = $('.typer-ui-clickeffect', e.currentTarget);
            runCSSTransition($overlay.children(), 'animate-out', function () {
                $(this).parent().remove();
            });
        });
        $(document.body).on('mouseover', 'label:has(>.typer-ui-float)', function (e) {
            setMenuPosition(e.currentTarget);
        });
        $(document.body).on('click', '.typer-ui-dialog-wrapper', function (e) {
            runCSSTransition($(e.target).find('.typer-ui-dialog-inner'), 'pop');
        });
    });

}(jQuery, Typer));
