(function ($, Typer) {
    'use strict';

    function setMenuPosition(thisMenu) {
        var callout = $('.typer-ui-float', thisMenu)[0];
        var nested = !!$(thisMenu).parents('.typer-ui-float')[0];
        var rect = callout.getBoundingClientRect();
        if (rect.bottom > $(window).height()) {
            $(callout).css('bottom', nested ? '0' : '100%');
        } else if (rect.top < 0) {
            $(callout).css('bottom', 'auto');
        }
        if (rect.right > $(window).width()) {
            $(callout).css('right', nested ? '100%' : '0');
        } else if (rect.left < 0) {
            $(callout).css('right', 'auto');
        }
    }

    function pinDialogPosition(dialog) {
        var rect = dialog.parentControl.element.getBoundingClientRect();

        function updatePosition() {
            var w = $(dialog.element).outerWidth();
            var h = $(dialog.element).outerHeight();
            $(dialog.element).addClass('pinned pinned-top').css({
                top: rect.bottom + h / 2,
                left: Math.max(10, rect.left + rect.width / 2 - w / 2) + w / 2
            });
        }

        $(dialog.element).bind('transitionend otransitionend webkitTransitionEnd', updatePosition);
        updatePosition();
    }

    Typer.ui.themes.material = {
        resources: [
            'https://fonts.googleapis.com/css?family=Roboto:400,500,700',
            'https://fonts.googleapis.com/icon?family=Material+Icons',
            'https://cdn.rawgit.com/misonou/jquery-typer/master/css/jquery.typer.material.css'
        ],
        controlActiveClass: 'active',
        controlDisabledClass: 'disabled',
        controlHiddenClass: 'hidden',
        labelText: function (ui, control) {
            var hasIcon = !!Typer.ui.getIcon(control, 'material');
            return (control.type === 'textbox' || (hasIcon && ui.type === 'toolbar' && (control.parent || '').type !== 'callout')) ? '' : '<span x:bind="(_:label)"></span>';
        },
        labelIcon: function (ui, control) {
            var icon = Typer.ui.getIcon(control, 'material');
            if ((control.parent || ui).type === 'dropdown') {
                return '';
            }
            if ((control.parent || ui).type === 'callout' || ui.type === 'contextmenu') {
                return control.type === 'checkbox' ? '' : icon.replace(/.*/, '<i class="material-icons">$&</i>');
            }
            return icon.replace(/.+/, '<i class="material-icons">$&</i>');
        },
        buttonset: '<div class="typer-ui-buttonset"><br x:t="children"/></div>',
        buttonlist: '<div class="typer-ui-buttonlist"><br x:t="children"/></div>',
        menupane: '<div class="typer-ui-float"><div class="typer-ui-buttonlist"><br x:t="children(t:button)"/></div></div>',
        toolbar: '<div class="typer-ui-toolbar"><div class="typer-ui-buttonset"><br x:t="children"/></div></div>',
        contextmenu: '<div class="typer-ui-float typer-ui-contextmenu"><div class="typer-ui-buttonlist"><br x:t="children(t:button)"/></div></div>',
        group: '<div class="typer-ui-group"><br x:t="children"/></div>',
        groupStateChange: function (ui, control) {
            setImmediate(function () {
                $(control.element).toggleClass('sep-before', !!$(control.element).prevAll(':not(.hidden)')[0]);
                $(control.element).toggleClass('sep-after', !!$(control.element).nextAll(':not(.hidden):first:not(.typer-ui-group)')[0]);
            });
        },
        label: '<span class="typer-ui-label"><br x:t="labelIcon"/><br x:t="labelText"/></span>',
        button: '<button x:bind="(title:label)"><br x:t="label"/><span class="typer-ui-label-annotation" role="shortcut" x:bind="(_:shortcut)"></span><span class="typer-ui-label-annotation" x:bind="(_:annotation)"></span></button>',
        buttonExecuteOn: 'click',
        file: '<label class="has-clickeffect" x:bind="(title:label)"><input type="file"/><br x:t="label"/></label>',
        fileInit: function (ui, control) {
            $(control.element).find(':file').change(function (e) {
                control.value = e.target.dataTransfer;
                ui.execute(control);
                setImmediate(function () {
                    var form = document.createElement('form');
                    form.appendChild(e.target);
                    form.reset();
                    $(e.target).prependTo(control.element);
                });
            });
        },
        callout: '<div class="typer-ui-menu"><button x:bind="(title:label)"><br x:t="label"/></button><br x:t="menupane"/></div>',
        calloutExecuteOn: {
            on: 'click',
            of: '>button'
        },
        dropdown: '<div class="typer-ui-dropdown typer-ui-menu"><button x:bind="(title:label)"><span class="typer-ui-label"><br x:t="labelIcon"/><span x:bind="(_:selectedText)"></span></span></button><br x:t="menupane"/></div>',
        checkbox: '<label class="typer-ui-checkbox" x:bind="(title:label)"><input type="checkbox" x:bind="(checked:value)"/><br x:t="label"/></label>',
        checkboxExecuteOn: {
            on: 'change',
            of: ':checkbox'
        },
        textbox: '<label x:bind="(title:label)"><div class="typer-ui-textbox"><br x:t="label"/><div class="typer-ui-textbox-wrapper"><div contenteditable spellcheck="false"></div><div class="typer-ui-textbox-placeholder" x:bind="(_:label)"></div></div></div></label>',
        textboxInit: function (ui, control) {
            var $parent = $(control.element).parents('.typer-ui-menu');
            var editable = $('[contenteditable]', control.element)[0];
            control.preset = Typer.preset(editable, control.preset, $.extend({}, control.presetOptions, {
                focusin: function () {
                    $parent.addClass('open');
                },
                focusout: function () {
                    $parent.removeClass('open');
                },
                contentChange: function (e) {
                    if (e.typer.focused()) {
                        control.value = control.preset.getValue();
                        ui.execute(control);
                    }
                }
            }));
        },
        textboxStateChange: function (toolbar, control) {
            control.preset.setValue(control.value || '');
        },
        dialog: '<div class="typer-ui-dialog"><div class="typer-ui-dialog-pin"></div><br x:t="children"></div>',
        dialogOpen: function (dialog, control) {
            $('<div style="position:fixed;top:0;left:0;right:0;bottom:0;background:url(data:image/gif;,);">').prependTo(dialog.element).click(function () {
                $(control.element).addClass('pop');
            });
            $(dialog.element).appendTo(document.body);
            $(control.element).bind('animationend oanimationend webkitAnimationEnd', function () {
                $(control.element).removeClass('pop');
            });
            var resolveButton = dialog.resolve(control.resolve)[0];
            if (resolveButton) {
                $(resolveButton.element).addClass('pin-active');
            }
            control.parentControl = dialog.parentUI && dialog.parentUI.getExecutingControl();
            setImmediate(function () {
                $(control.element).addClass('open');
                if (control.pinToParent && control.parentControl) {
                    pinDialogPosition(control);
                    $(control.parentControl.element).addClass('pin-active');
                }
            });
        },
        dialogClose: function (dialog, control) {
            $(control.element).addClass('closing').one('transitionend otransitionend webkitTransitionEnd', function () {
                $(dialog.element).remove();
                if (control.parentControl) {
                    $(control.parentControl.element).removeClass('pin-active');
                }
            });
        },
        init: function (ui) {
            $(ui.element).click(function (e) {
                $('.typer-ui-menu.open', ui.element).not($(e.target).parentsUntil(ui.element)).removeClass('open');
            });
            $(ui.element).focusout(function (e) {
                if (!$.contains(ui.element, e.relatedTarget)) {
                    $('.typer-ui-menu.open', ui.element).removeClass('open');
                }
            });
            $(ui.element).on('click', '.typer-ui-dropdown .typer-ui-float', function (e) {
                $(e.currentTarget).parents('.typer-ui-dropdown').removeClass('open');
            });
            $(ui.element).on('click', '.typer-ui-menu > button', function (e) {
                var thisMenu = e.currentTarget.parentNode;
                $('.typer-ui-menu.open', ui.element).not(thisMenu).removeClass('open');
                if ($(thisMenu).find('>.typer-ui-float>:not(.disabled)')[0]) {
                    $(thisMenu).toggleClass('open');
                    setImmediate(function () {
                        setMenuPosition(thisMenu);
                    });
                }
            });
            $(ui.element).on('mouseover', '.typer-ui-menu', function (e) {
                setMenuPosition(e.currentTarget);
            });
            $(ui.element).on('mousedown', 'button, .has-clickeffect', function (e) {
                var pos = e.currentTarget.getBoundingClientRect();
                var $overlay = $('<div class="typer-ui-clickeffect">').appendTo(e.currentTarget).css({
                    top: e.clientY - pos.top,
                    left: e.clientX - pos.left
                });
                var p1 = Math.pow(e.clientY - pos.top, 2) + Math.pow(e.clientX - pos.left, 2);
                var p2 = Math.pow(e.clientY - pos.top, 2) + Math.pow(e.clientX - pos.right, 2);
                var p3 = Math.pow(e.clientY - pos.bottom, 2) + Math.pow(e.clientX - pos.left, 2);
                var p4 = Math.pow(e.clientY - pos.bottom, 2) + Math.pow(e.clientX - pos.right, 2);
                var scalePercent = 0.5 + 2 * Math.sqrt(Math.max.call(null, p1, p2, p3, p4)) / parseFloat($overlay.css('font-size'));
                setImmediate(function () {
                    $overlay.css('transform', $overlay.css('transform') + ' scale(' + scalePercent + ')').addClass('animate-in');
                });
            });
            $(ui.element).on('mouseup mouseleave', 'button, .has-clickeffect', function (e) {
                var $overlay = $('.typer-ui-clickeffect', e.currentTarget);
                $overlay.addClass('animate-out');
                $overlay.bind('transitionend otransitionend webkitTransitionEnd', function () {
                    $overlay.remove();
                });
            });
        }
    };

} (jQuery, window.Typer));
