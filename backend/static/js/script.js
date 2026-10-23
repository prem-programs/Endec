/**
 * script.js — Entry point.
 *
 * All scripts are loaded in order by the HTML templates:
 *   1. crypto.js    — AES-GCM encrypt/decrypt
 *   2. ui.js        — Shared UI helpers
 *   3. encrypter.js — Encrypt-page logic   (index.html only)
 *   4. decrypter.js — Decrypt-page logic   (decoder.html only)
 *   5. script.js    — This file: bootstraps the correct page
 *
 * Nothing is defined here; it only calls the right init function.
 */

document.addEventListener('DOMContentLoaded', () => {
    // Shared across all pages
    initModalDismiss();
    initNavActiveLink();

    // Page-specific
    const path = window.location.pathname;
    const isEncryptPage = path === '/' || path.endsWith('/index') || path.endsWith('/index.html');
    const isDecryptPage = path.includes('decoder') || path.includes('decrypter');

    if (isEncryptPage) {
        initEncrypterPage();
    }

    if (isDecryptPage) {
        initManualDecryptForm();     // Manual form (no ?id=)
        initDecrypterPage();         // URL-driven state machine (async, handles ?id=)
    }
});
