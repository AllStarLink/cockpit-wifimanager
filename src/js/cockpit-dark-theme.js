/*
 * Copyright (C) 2022 Red Hat, Inc.
 * SPDX-License-Identifier: LGPL-2.1-or-later
 *
 * Vendored from cockpit's pkg/lib/cockpit-dark-theme.ts with the TypeScript
 * annotations removed.  Cockpit's shell keeps the selected theme in the
 * "shell:style" localStorage key and fires a "cockpit-style" event when the
 * user flips the switch; plugins are expected to mirror that onto their own
 * document so PatternFly's dark tokens take effect inside the plugin iframe.
 *
 * Load this in <head>, before the stylesheet renders, to avoid a white flash.
 */

function changeDarkThemeClass(documentElement, dark_mode) {
    if (dark_mode) {
        documentElement.classList.add('pf-v6-theme-dark');
    } else {
        documentElement.classList.remove('pf-v6-theme-dark');
    }
}

function _setDarkMode(_style) {
    const style = _style || localStorage.getItem('shell:style') || 'auto';
    let dark_mode;
    // If a user sets an explicit theme, ignore system changes.
    if ((window.matchMedia?.('(prefers-color-scheme: dark)').matches && style === "auto") || style === "dark") {
        dark_mode = true;
    } else {
        dark_mode = false;
    }
    changeDarkThemeClass(document.documentElement, dark_mode);
}

window.addEventListener("storage", event => {
    if (event.key === "shell:style")
        _setDarkMode();
});

// When changing the theme from the shell switcher the localstorage change will not fire for the same page (aka shell)
// so we need to listen for the event on the window object.
window.addEventListener("cockpit-style", event => {
    if (event instanceof CustomEvent)
        _setDarkMode(event.detail.style);
});

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    _setDarkMode();
});

_setDarkMode();
