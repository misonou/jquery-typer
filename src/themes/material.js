(function ($, Typer) {
    'use strict';

    var ANIMATION_END = 'animationend oanimationend webkitAnimationEnd';
    var TRANSITION_END = 'transitionend otransitionend webkitTransitionEnd';
    var FLIP_POS = {
        left: 'right',
        right: 'left',
        top: 'bottom',
        bottom: 'top'
    };

    var currentMenu;
    var currentDialogPositions = [];

    function showContextMenu(element, node, pos) {
        if (currentMenu !== element) {
            hideContextMenu();
            currentMenu = element;
            $(element).appendTo(document.body).css('position', 'fixed');
            Typer.ui.setZIndex(element, document.body);
        }
        var rect = {};
        if (node.getBoundingClientRect) {
            var xrel = /\b(left|right)\b/.test(pos) ? RegExp.$1 : 'left';
            var yrel = /\b(top|bottom)\b/.test(pos) ? RegExp.$1 : 'top';
            var rectb = node.getBoundingClientRect();
            rect[xrel] = rectb.left;
            rect[yrel] = rectb.top;
            rect[FLIP_POS[xrel]] = rectb.right;
            rect[FLIP_POS[yrel]] = rectb.bottom;
        } else {
            rect.left = rect.right = node.x;
            rect.top = rect.bottom = node.y;
        }
        $(element).css({
            left: rect.left + $(element).outerWidth() > $(window).width() ? rect.right - $(element).outerWidth() : rect.left,
            top: rect.top + $(element).outerHeight() > $(window).height() ? rect.bottom - $(element).outerHeight() : rect.top
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
        var windowSize = document.documentElement.getBoundingClientRect();

        $.each(currentDialogPositions, function (i, v) {
            var dialog = $(v.target).find('.typer-ui-dialog')[0];
            var dialogSize = dialog.getBoundingClientRect();
            var rect = v.reference.getBoundingClientRect();
            var stick = {};

            var $r = $(v.target).css({
                top: rect.top,
                left: rect.left,
                width: rect.width,
                height: rect.height
            });
            if (v.pinToParent === 'bottom' || v.pinToParent === 'top') {
                stick.left = rect.left + rect.width / 2 < dialogSize.width / 2;
                stick.right = windowSize.width - rect.left - rect.width / 2 < dialogSize.width / 2;
            }
            if (v.pinToParent === 'left' || v.pinToParent === 'right') {
                stick.top = rect.top + rect.height / 2 < dialogSize.height / 2;
                stick.bottom = windowSize.height - rect.top - rect.height / 2 < dialogSize.height / 2;
            }
            $.each(['left', 'right', 'top', 'bottom'], function (i, v) {
                $r.toggleClass('stick-' + v, !!stick[v]);
                dialog.style[v] = stick[v] ? -(Math.abs(windowSize[v] - rect[v]) - 10) + 'px' : '';
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
        iconset: 'material',
        label: '<span class="typer-ui-label"><br x:t="labelIcon"/><br x:t="labelText"/></span>',
        labelText: function (ui, control) {
            var hasIcon = !!Typer.ui.getIcon(control, 'material');
            return (control.type === 'textbox' || (hasIcon && ui.type === 'toolbar' && !ui.showButtonLabel && (control.parent || '').type !== 'callout')) ? '' : '<span x:bind="(_:label)"></span>';
        },
        labelIcon: function (ui, control) {
            if ((control.parent || ui).type === 'dropdown' || control.type === 'checkbox' || !Typer.ui.getIcon(control, 'material')) {
                return '';
            }
            return '<i class="material-icons" x:bind="(_:icon)"></i>';
        },
        buttonset: '<div class="typer-ui-buttonset"><div class="typer-ui-buttonset-pad"></div><br x:t="children"/></div>',
        buttonlist: '<div class="typer-ui-buttonlist"><br x:t="children"/></div>',
        form: '<div class="typer-ui-form"><br x:t="children"/></div>',
        menupane: '<div class="typer-ui-float"><div class="typer-ui-buttonlist"><br x:t="children(t:button)"/></div></div>',
        toolbar: '<div class="typer-ui-toolbar"><br x:t="children"/></div>',
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
        callout: '<button class="typer-ui-callout" x:bind="(title:label)"><br x:t="label"/><br x:t="menupane"/></button>',
        calloutExecuteOn: 'click',
        dropdown: '<button class="typer-ui-dropdown" x:bind="(title:label)"><span class="typer-ui-label"><br x:t="labelIcon"/><span x:bind="(_:selectedText)"></span></span><br x:t="menupane"/></button>',
        checkbox: '<label class="typer-ui-checkbox" x:bind="(title:label)"><br x:t="label"/></label>',
        checkboxInit: function (ui, control) {
            $(control.element).change(function () {
                control.value = $(this).hasClass('checked');
                ui.execute(control);
            });
        },
        checkboxStateChange: function (ui, control) {
            $(control.element).toggleClass('checked', !!control.value);
        },
        textbox: '<label x:bind="(title:label)"><div class="typer-ui-textbox"><br x:t="label"/><div class="typer-ui-textbox-wrapper"><div contenteditable spellcheck="false"></div><div class="typer-ui-textbox-placeholder" x:bind="(_:label)"></div><div class="typer-ui-textbox-error"></div></div></div></label>',
        textboxInit: function (ui, control) {
            var editable = $('[contenteditable]', control.element)[0];
            control.preset = Typer.preset(editable, control.preset, $.extend({}, control.presetOptions, {
                contentChange: function (e) {
                    if (e.typer.focused()) {
                        control.value = control.preset.getValue();
                        ui.execute(control);
                    }
                    $('.typer-ui-textbox', control.element).toggleClass('empty', !control.preset.hasContent()).removeClass('error');
                }
            }));
        },
        textboxValidate: function (ui, control, opt) {
            var valid = control.preset.validate() !== false;
            $('.typer-ui-textbox', control.element).toggleClass('error', !valid);
            if (!valid) {
                opt.fail();
            }
        },
        textboxStateChange: function (ui, control) {
            control.preset.setValue(control.value || '');
            control.value = control.preset.getValue();
            $('.typer-ui-textbox', control.element).toggleClass('empty', !control.preset.hasContent());
        },
        dialog: '<div class="typer-ui-dialog-wrapper"><div class="typer-ui-dialog-pin"></div><div class="typer-ui-dialog"><div class="typer-ui-dialog-content"><br x:t="children"></div></div></div>',
        dialogOpen: function (ui, control) {
            var resolveButton = ui.resolve(control.resolve)[0];
            var parentControl = ui.parentUI && ui.parentUI.getExecutingControl();
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
                if (/top|bottom|left|right/.test(ui.pinToParent) && document.activeElement !== document.body) {
                    var pinElement = parentControl ? parentControl.element : document.activeElement;
                    $wrapper.addClass('pinned pinned-' + ui.pinToParent);
                    if (parentControl) {
                        $(pinElement).addClass('pin-active');
                    }
                    currentDialogPositions.push({
                        dialog: ui,
                        reference: pinElement,
                        target: $wrapper[0],
                        pinToParent: ui.pinToParent
                    });
                    updateDialogPositions();
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
            $(ui.element).on('mouseover', '.typer-ui-callout:has(>.typer-ui-float)', function (e) {
                setMenuPosition(e.currentTarget);
            });
            $.each(ui.all, function (i, v) {
                if (/callout|dropdown/.test(v.type) && v.contextualParent.type !== 'callout' && v.contextualParent.type !== 'contextmenu') {
                    var callout = $('<div class="typer-ui typer-ui-material">').append($(v.element).children('.typer-ui-float').addClass('parent-is-' + v.type))[0];
                    if (ui.typer) {
                        ui.typer.retainFocus(callout);
                    }
                    $(v.element).click(function (e) {
                        showContextMenu(callout, v.element, 'left bottom');
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
        $(document.body).on('click', '.typer-ui-material .typer-ui-checkbox', function (e) {
            $(this).toggleClass('checked').trigger('change');
        });
        $(document.body).on('mousedown', '.typer-ui-material button, .typer-ui-material .has-clickeffect', function (e) {
            var pos = e.currentTarget.getBoundingClientRect();
            var $overlay = $('<div class="typer-ui-clickeffect"><i></i></div>').appendTo(e.currentTarget).children().css({
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
            e.stopPropagation();
        });
        $(document.body).on('mouseup mouseleave', '.typer-ui-material button, .typer-ui-material .has-clickeffect', function (e) {
            var $overlay = $('.typer-ui-clickeffect', e.currentTarget);
            $overlay.children().addClass('animate-out').bind(TRANSITION_END, function () {
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
