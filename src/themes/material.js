(function ($, Typer) {
    'use strict';

    var $blockUI = $('<div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(255,255,255,0.5) url(data:image/gif;,);z-index:999;">');

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
            return hasIcon && ui.type === 'toolbar' && (control.type === 'textbox' || (control.parent || '').type !== 'callout') ? '' : '<span x:bind="(_:label)"></span>';
        },
        labelIcon: function (ui, control) {
            var icon = Typer.ui.getIcon(control, 'material');
            if ((control.parent || '').type === 'callout') {
                return control.type === 'checkbox' ? '' : icon.replace(/.*/, '<i class="material-icons">$&</i>');
            }
            return icon.replace(/.+/, '<i class="material-icons">$&</i>');
        },
        group: '<div class="typer-ui-group" x:bind="(role:name)"><br x:t="children"/></div>',
        label: '<span class="typer-ui-label"><br x:t="labelIcon"/><br x:t="labelText"/></span>',
        button: '<button x:bind="(title:label,role:name)"><br x:t="label"/><span class="typer-ui-menu-annotation" x:bind="(_:annotation)"></span></button>',
        buttonExecuteOn: 'click',
        callout: '<div class="typer-ui-menu" x:bind="(role:name)"><button x:bind="(title:label)"><br x:t="label"/></button><div class="typer-ui-menupane"><br x:t="children"></div></div>',
        calloutExecuteOn: {
            on: 'click',
            of: '>button'
        },
        dropdown: '<div class="typer-ui-dropdown typer-ui-menu" x:bind="(role:name)"><button x:bind="(title:label)"><span class="typer-ui-label"><br x:t="labelIcon"/><span x:bind="(_:selectedValue)"></span></span></button><div class="typer-ui-menupane"><br x:t="children(t:button)"></div></div>',
        checkbox: '<label class="typer-ui-checkbox" x:bind="(title:label,role:name)"><input type="checkbox" x:bind="(checked:value)"/><br x:t="label"/></label>',
        checkboxExecuteOn: {
            on: 'change',
            of: ':checkbox'
        },
        textbox: '<label class="typer-ui-textbox" x:bind="(role:name,title:label)"><br x:t="label"/><div contenteditable spellcheck="false" x:bind="(data-placeholder:label)"></div></label>',
        textboxInit: function (ui, control) {
            var $editable = $('[contenteditable]', control.element);
            $editable.typer('textbox', {
                enter: function () {
                    ui.execute('ui:button-ok');
                },
                escape: function () {
                    ui.execute('ui:button-cancel');
                }
            });
            $editable.bind('change', function () {
                ui.setValue(control, this.value);
                $(control.element).toggleClass('empty', !this.value);
            });
            $editable.bind('focusin focusout', function (e) {
                $(control.element).parents('.typer-ui-menu').toggleClass('open', e.type === 'focusin');
            });
        },
        textboxStateChange: function (toolbar, control) {
            $(control.element).toggleClass('empty', !control.value);
            $(control.element).find('[contenteditable]').prop('value', control.value || '');
        },
        dialog: '<div class="typer-ui-dialog"><h1><br x:t="label"/></h1><br x:t="children"></div>',
        dialogOpen: function (dialog, control) {
            $blockUI.appendTo(document.body);
            $(dialog.element).appendTo(document.body);
            setTimeout(function () {
                $(control.element).addClass('open');
                $('[contenteditable]:first', dialog.all['ui:prompt-input'].element).focus();
            });
        },
        dialogClose: function (dialog, control) {
            $blockUI.detach();
            $(control.element).removeClass('open').one('transitionend otransitionend webkitTransitionEnd', function () {
                $(dialog.element).remove();
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
            $(ui.element).on('click', '.typer-ui-menu>:not(.typer-ui-menupane)', function (e) {
                var thisMenu = e.currentTarget.parentNode;
                $('.typer-ui-menu.open', ui.element).not(thisMenu).removeClass('open');
                if ($(thisMenu).find('>.typer-ui-menupane>:not(.disabled)')[0]) {
                    $(thisMenu).toggleClass('open');
                    setTimeout(function () {
                        var callout = $('.typer-ui-menupane', thisMenu)[0];
                        var nested = !!$(thisMenu).parents('.typer-ui-menu')[0];
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
                    });
                }
                e.stopPropagation();
            });
        }
    };

} (jQuery, window.Typer));
