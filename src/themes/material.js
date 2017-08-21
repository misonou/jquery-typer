(function ($, Typer, window, document) {
    'use strict';

    var ANIMATION_END = 'animationend oanimationend webkitAnimationEnd';
    var TRANSITION_END = 'transitionend otransitionend webkitTransitionEnd';

    function setMenuPosition(thisMenu) {
        var callout = $('.typer-ui-float', thisMenu)[0];
        var nested = !!$(thisMenu).parents('.typer-ui-float')[0];
        var rect = callout.getBoundingClientRect();
        if (rect.bottom > $(window).height()) {
            $(callout).removeClass('float-top float-bottom').addClass('float-top');
        } else if (rect.top < 0) {
            $(callout).removeClass('float-top float-bottom').addClass('float-bottom');
        }
        if (rect.right > $(window).width()) {
            $(callout).removeClass('float-left float-right').addClass('float-left');
        } else if (rect.left < 0) {
            $(callout).removeClass('float-left float-right').addClass('float-right');
        }
    }

    function detachCallout(control) {
        control.callout = $('<div class="typer-ui typer-ui-material">').append($(control.element).children('.typer-ui-float').addClass('is-' + control.type))[0];
        if (control.ui.typer) {
            control.ui.typer.retainFocus(control.callout);
        }
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
        controlPinActiveClass: 'pin-active',
        controlErrorClass: 'error',
        iconset: 'material',
        label: '<span class="typer-ui-label"><br x:t="labelIcon"/><br x:t="labelText"/></span>',
        labelText: function (ui, control) {
            if (control.is('textbox')) {
                return '';
            }
            if (!(control.contextualParent || ui).is('callout') && ui.getIcon(control)) {
                if (!control.showButtonLabel || !control.contextualParent.showButtonLabel || !ui.showButtonLabel) {
                    return '';
                }
            }
            return '<span x:bind="(_:label)"></span>';
        },
        labelIcon: function (ui, control) {
            if ((control.contextualParent || ui).is('dropdown') || control.is('checkbox') || !ui.getIcon(control)) {
                return '';
            }
            return '<i class="material-icons" x:bind="(_:icon)"></i>';
        },
        buttonset: '<div class="typer-ui-buttonset"><br x:t="children(buttonsetGroup:left)"/><div class="typer-ui-buttonset-pad"></div><br x:t="children(buttonsetGroup:right)"/></div>',
        buttonlist: '<div class="typer-ui-buttonlist"><br x:t="children"/></div>',
        form: '<div class="typer-ui-form"><br x:t="children"/></div>',
        menupane: '<div class="typer-ui-float"><div class="typer-ui-buttonlist"><br x:t="children"/></div></div>',
        toolbar: '<div class="typer-ui-buttonset is-toolbar"><br x:t="children"/></div>',
        contextmenu: '<div class="typer-ui-float is-contextmenu"><div class="typer-ui-buttonlist"><br x:t="children"/></div></div>',
        group: '<div class="typer-ui-group"><br x:t="children"/></div>',
        groupStateChange: function (ui, control) {
            setImmediate(function () {
                $(control.element).toggleClass('sep-before', !!$(control.element).prevAll(':not(.hidden)')[0]);
                $(control.element).toggleClass('sep-after', !!$(control.element).nextAll(':not(.hidden):first:not(.typer-ui-group)')[0]);
            });
        },
        button: '<button x:bind="(title:label)"><br x:t="label"/><span class="typer-ui-label-annotation" role="shortcut" x:bind="(_:shortcut)"></span><span class="typer-ui-label-annotation" x:bind="(_:annotation)"></span></button>',
        buttonExecuteOn: 'click',
        file: '<label class="has-clickeffect" x:bind="(title:label)"><input type="file"/><br x:t="label"/></label>',
        fileInit: function (ui, control) {
            $(control.element).find(':file').change(function (e) {
                control.value = e.target.files;
                ui.execute(control);
                setImmediate(function () {
                    var form = document.createElement('form');
                    form.appendChild(e.target);
                    form.reset();
                    $(e.target).prependTo(control.element);
                });
            });
        },
        callout: '<label class="typer-ui-callout" x:bind="(title:label)"><br x:t="button"/><br x:t="menupane"/></label>',
        calloutExecuteOn: 'click',
        calloutInit: function (ui, control) {
            if (!control.contextualParent.is('callout contextmenu')) {
                detachCallout(control);
            }
        },
        dropdown: '<button class="typer-ui-dropdown" x:bind="(title:label)"><span class="typer-ui-label"><br x:t="labelIcon"/><span x:bind="(_:selectedText)"></span></span><br x:t="menupane"/></button>',
        dropdownInit: function (ui, control) {
            if (!control.contextualParent.is('callout contextmenu')) {
                detachCallout(control);
            }
        },
        checkbox: '<button class="typer-ui-checkbox" x:bind="(title:label)"><br x:t="label"/></button>',
        checkboxInit: function (ui, control) {
            $(control.element).click(function () {
                control.value = $(this).toggleClass('checked').hasClass('checked');
                ui.execute(control);
            });
        },
        checkboxStateChange: function (ui, control) {
            $(control.element).toggleClass('checked', !!control.value);
        },
        textboxInner: '<div class="typer-ui-textbox-inner"><div contenteditable spellcheck="false"></div><div class="typer-ui-textbox-placeholder" x:bind="(_:label)"></div><div class="typer-ui-textbox-error"></div></div>',
        textboxCombo: '<label class="typer-ui-textbox typer-ui-textbox-combo" x:bind="(title:label)"><br x:t="label"/><div class="typer-ui-textbox-wrapper"><br x:t="children(textbox:textboxInner)"/></div></label>',
        textbox: '<label class="typer-ui-textbox" x:bind="(title:label)"><br x:t="label"/><div class="typer-ui-textbox-wrapper"><br x:t="textboxInner"/></div></label>',
        textboxInit: function (ui, control) {
            var editable = $('[contenteditable]', control.element)[0];
            control.preset = Typer.preset(editable, control.preset, $.extend({}, control.presetOptions, {
                focusin: function (e) {
                    $(control.element).closest('.typer-ui-textbox').addClass('focused');
                },
                focusout: function (e) {
                    $(control.element).closest('.typer-ui-textbox').removeClass('focused');
                },
                stateChange: function (e) {
                    var topElement = e.typer.element;
                    var style = window.getComputedStyle(topElement);
                    if (style.whiteSpace === 'nowrap' && style.overflow === 'hidden') {
                        var rect = topElement.getBoundingClientRect();
                        var pos = e.typer.getSelection().extendCaret.getRange().getBoundingClientRect();
                        if (pos.left > rect.right) {
                            topElement.style.textIndent = parseInt(style.textIndent) - (pos.left - rect.right + 5) + 'px';
                        } else if (pos.left < rect.left) {
                            topElement.style.textIndent = Math.min(0, parseInt(style.textIndent) + (rect.left - pos.left + 5)) + 'px';
                        }
                    }
                },
                contentChange: function (e) {
                    control.value = control.preset.getValue();
                    $(control.element).toggleClass('empty', !control.preset.hasContent()).removeClass('error');
                    if (e.typer.focused()) {
                        ui.execute(control);
                    }
                }
            }));
            control.preset.parentControl = control;
            control.presetOptions = control.preset.getStaticWidget('__preset__').options;
            $(control.element).toggleClass('empty', !control.preset.hasContent());
        },
        textboxValidate: function (ui, control, opt) {
            if (!control.preset.validate()) {
                opt.fail();
            }
        },
        textboxStateChange: function (ui, control) {
            control.preset.setValue(control.value || '');
        },
        dialog: '<div class="typer-ui-dialog-wrapper"><div class="typer-ui-dialog-pin"></div><div class="typer-ui-dialog"><div class="typer-ui-dialog-content typer-ui-form"><br x:t="children"></div></div></div>',
        dialogOpen: function (ui, control) {
            var resolveButton = control.getControl(control.resolveBy);
            var $wrapper = $(ui.element).find('.typer-ui-dialog-wrapper');
            var $content = $(ui.element).find('.typer-ui-dialog-content');

            $(ui.element).appendTo(document.body);
            $wrapper.click(function (e) {
                if (e.target === $wrapper[0]) {
                    $content.addClass('pop');
                }
            });
            $content.bind(ANIMATION_END, function () {
                $content.removeClass('pop');
            });
            if (resolveButton) {
                $(resolveButton.element).addClass('pin-active');
            }
            setImmediate(function () {
                $(control.element).addClass('open');
                if (control.pinnable && ui.parentControl && Typer.ui.matchWSDelim(ui.parentControl.pinDirection, 'left right top bottom')) {
                    $wrapper.addClass('pinned pinned-' + ui.parentControl.pinDirection);
                    $(ui.parentControl.element).addClass('pin-active');
                    Typer.ui.pin(control, $wrapper[0], ui.parentControl.element, ui.parentControl.pinDirection);
                }
            });
        },
        dialogWaiting: function (ui, control) {
            $(control.element).addClass('loading');
        },
        dialogError: function (ui, control) {
            $(control.element).removeClass('loading');
        },
        dialogClose: function (ui, control) {
            $(control.element).addClass('closing').one(TRANSITION_END, function () {
                $(ui.element).remove();
                if (control.pinnable && ui.parentControl) {
                    $(ui.parentControl.element).removeClass('pin-active');
                    Typer.ui.unpin(control);
                }
            });
        },
        showCallout: function (ui, control) {
            if (control.callout) {
                ui.show(control, control.callout, control.element, 'left bottom');
            }
        },
        afterShow: function (ui, control, data) {
            if (control.is('dialog contextmenu')) {
                $(data.element).removeClass('closing').addClass('open');
            }
        },
        beforeHide: function (ui, control, data) {
            if (control.is('dialog contextmenu')) {
                var deferred = $.Deferred();
                $(data.element).addClass('closing').one(TRANSITION_END, function () {
                    if ($(this).hasClass('closing')) {
                        $(this).removeClass('open closing');
                        deferred.resolve();
                    }
                });
                return deferred.promise();
            }
        },
        positionUpdate: function (ui, control, data) {
            $.each(['left', 'right', 'top', 'bottom'], function (i, v) {
                $(data.element).toggleClass('stick-' + v, !!data.stick[v]);
            });
        },
        executed: function (ui, control) {
            if (control.is('button') && control.contextualParent.is('callout dropdown contextmenu')) {
                ui.hide(control.contextualParent);
            }
        }
    });

    $(function () {
        var SELECT_EFFECT = '.typer-ui-material button:not(.typer-ui-checkbox), .typer-ui-material .has-clickeffect';
        $(document.body).on('mousedown', SELECT_EFFECT, function (e) {
            var pos = e.currentTarget.getBoundingClientRect();
            var $overlay = $('<div class="typer-ui-clickeffect"><i></i></div>').appendTo(e.currentTarget).children().css({
                top: e.clientY - pos.top,
                left: e.clientX - pos.left,
            });
            var p1 = Math.pow(e.clientY - pos.top, 2) + Math.pow(e.clientX - pos.left, 2);
            var p2 = Math.pow(e.clientY - pos.top, 2) + Math.pow(e.clientX - pos.right, 2);
            var p3 = Math.pow(e.clientY - pos.bottom, 2) + Math.pow(e.clientX - pos.left, 2);
            var p4 = Math.pow(e.clientY - pos.bottom, 2) + Math.pow(e.clientX - pos.right, 2);
            var scalePercent = 0.5 + 2 * Math.sqrt(Math.max(p1, p2, p3, p4)) / parseFloat($overlay.css('font-size'));
            setImmediate(function () {
                $overlay.css('transform', $overlay.css('transform') + ' scale(' + scalePercent + ')').addClass('animate-in');
            });
            $overlay.parent().css('border-radius', $(e.currentTarget).css('border-radius'));
        });
        $(document.body).on('mouseup mouseleave', SELECT_EFFECT, function (e) {
            var $overlay = $('.typer-ui-clickeffect', e.currentTarget);
            $overlay.children().addClass('animate-out').bind(TRANSITION_END, function () {
                $overlay.remove();
            });
        });
        $(document.body).on('mouseover', '.typer-ui-callout:has(>.typer-ui-float)', function (e) {
            setMenuPosition(e.currentTarget);
        });
    });

}(jQuery, window.Typer, window, document));
