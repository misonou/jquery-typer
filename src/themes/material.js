(function ($, Typer) {
    'use strict';

    var currentMenu;
    var currentDialogPositions = [];

    function showContextMenu(element, pos) {
        if (currentMenu !== element) {
            hideContextMenu();
            currentMenu = element;
            $(element).appendTo(document.body).css('position', 'fixed');
            Typer.ui.setZIndex(element, document.body);
        }
        if (pos.getBoundingClientRect) {
            var rect = pos.getBoundingClientRect();
            pos = {
                x: rect.left,
                y: rect.bottom
            };
        }
        if (pos.x + $(element).width() > $(window).width()) {
            pos.x -= $(element).width();
        }
        if (pos.y + $(element).height() > $(window).height()) {
            pos.y -= $(element).height();
        }
        $(element).css({
            left: pos.x,
            top: pos.y
        });
    }

    function hideContextMenu() {
        $(currentMenu).detach();
        currentMenu = null;
    }

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

    function updateDialogPositions() {
        $.each(currentDialogPositions, function (i, v) {
            var rect = v.reference.getBoundingClientRect();
            $(v.target).css({
                top: rect.top,
                left: rect.left,
                width: rect.width,
                height: rect.height
            });
        });
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
        label: '<span class="typer-ui-label"><br x:t="labelIcon"/><br x:t="labelText"/></span>',
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
        textboxStateChange: function (ui, control) {
            control.preset.setValue(control.value || '');
        },
        dialog: '<div class="typer-ui-dialog-wrapper"><div class="typer-ui-dialog-pin"></div><div class="typer-ui-dialog"><div class="typer-ui-dialog-content"><br x:t="children"></div></div></div>',
        dialogOpen: function (ui, control) {
            var resolveButton = ui.resolve(control.resolve)[0];
            var parentControl = ui.parentUI && ui.parentUI.getExecutingControl();
            var $wrapper = $(ui.element).find('.typer-ui-dialog-wrapper');
            var $content = $(ui.element).find('.typer-ui-dialog-content');
            var $blocker = $('<div style="position:fixed;top:0;left:0;right:0;bottom:0;background:url(data:image/gif;,);">');

            $(ui.element).appendTo(document.body);
            $blocker.prependTo(ui.element).click(function () {
                $content.addClass('pop');
            });
            $content.bind('animationend oanimationend webkitAnimationEnd', function () {
                $content.removeClass('pop');
            });
            if (resolveButton) {
                $(resolveButton.element).addClass('pin-active');
            }
            setImmediate(function () {
                $(control.element).addClass('open');
                if (/top|bottom|left|right/.test(ui.pinToParent) && document.activeElement !== document.body) {
                    var pinElement = parentControl ? parentControl.element : document.activeElement;
                    $wrapper.addClass('pinned pinned-' + ui.pinToParent);
                    $(pinElement).addClass('pin-active');
                    currentDialogPositions.push({
                        dialog: ui,
                        reference: pinElement,
                        target: $wrapper[0]
                    });
                    updateDialogPositions();
                }
            });
        },
        dialogClose: function (ui, control) {
            $(control.element).addClass('closing').one('transitionend otransitionend webkitTransitionEnd', function () {
                $(ui.element).remove();
                $.each(currentDialogPositions, function (i, v) {
                    if (v.dialog === ui) {
                        $(v.reference).removeClass('pin-active');
                        currentDialogPositions.splice(i, 1);
                        return false;
                    }
                });
            });
        },
        init: function (ui) {
            $(ui.element).on('mouseover', '.typer-ui-menu:has(>.typer-ui-float)', function (e) {
                setMenuPosition(e.currentTarget);
            });
            $.each(ui.all, function (i, v) {
                if (/callout|dropdown/.test(v.type) && v.contextualParent.type !== 'callout' && v.contextualParent.type !== 'contextmenu') {
                    var callout = $('<div class="typer-ui typer-ui-material">').append($(v.element).children('.typer-ui-float').addClass('parent-is-' + v.type))[0];
                    if (ui.typer) {
                        ui.typer.retainFocus(callout);
                    }
                    $(v.element).click(function (e) {
                        showContextMenu(callout, v.element);
                    });
                }
            });
        },
        show: function (ui, control, pos) {
            if (ui.type === 'contextmenu') {
                showContextMenu(ui.element, pos);
            }
        },
        controlExecuted: function (ui, control, executed) {
            if (/callout|dropdown|contextmenu/.test(executed.contextualParent.type)) {
                hideContextMenu();
            }
        }
    };

    $(function () {
        $(document.body).on('mousedown', '.typer-ui-material button, .typer-ui-material .has-clickeffect', function (e) {
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
        $(document.body).on('mouseup mouseleave', '.typer-ui-material button, .typer-ui-material .has-clickeffect', function (e) {
            var $overlay = $('.typer-ui-clickeffect', e.currentTarget);
            $overlay.addClass('animate-out');
            $overlay.bind('transitionend otransitionend webkitTransitionEnd', function () {
                $overlay.remove();
            });
        });
        $(document.body).mousedown(function (e) {
            if (currentMenu && !Typer.containsOrEquals(currentMenu, e.target)) {
                hideContextMenu();
            }
        });
        $(window).bind('resize scroll orientationchange', function (e) {
            updateDialogPositions();
        });
    });

} (jQuery, window.Typer));
