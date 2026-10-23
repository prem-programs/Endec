/**
 * decrypter.js — Decrypt-page logic (URL-state machine + manual decrypt form).
 * Depends on: crypto.js, ui.js (loaded before this file)
 *
 * States (auto-selected based on URL params & server response):
 *   Loading → one of:
 *     A) Password prompt  (has_password=true OR no #hash)
 *     B) Reveal button    (burn_after_reading=true + hash present)
 *     C) Auto-decrypt     (hash present + not burn)
 *     D) Unavailable      (expired / burned / not found)
 *   → Result modal
 *
 * Also handles the manual decrypt form (no ?id= in URL).
 */

// ── State helpers ─────────────────────────────────────────────────────────────
const _STATES = ['loadingState', 'passwordPromptState', 'revealPromptState', 'unavailableState', 'manualDecryptForm'];

function _hideAll() {
    _STATES.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
}

function _show(id) {
    _hideAll();
    const el = document.getElementById(id);
    if (el) el.style.display = 'block';
}

// ── Eye toggle helper ─────────────────────────────────────────────────────────
function _initEyeToggle(inputId, btnId) {
    const input = document.getElementById(inputId);
    const btn   = document.getElementById(btnId);
    if (!input || !btn) return;
    btn.onclick = () => {
        const hidden = input.type === 'password';
        input.type = hidden ? 'text' : 'password';
        btn.innerHTML = hidden
            ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
            : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
    };
}

// ── Show result panel ─────────────────────────────────────────────────────────
function _showResult(uid, burned, expiresAt) {
    _hideAll();
    const card  = document.getElementById('card');
    const modal = document.getElementById('result');
    if (card)  card.classList.add('result-mode');
    if (modal) modal.classList.add('show');

    const sub         = document.getElementById('resultStatusSub');
    const burnBadge   = document.getElementById('resultBurnBadge');
    const expiryBadge = document.getElementById('resultExpiryBadge');
    const expiryText  = document.getElementById('resultExpiryBadgeText');

    if (burned) {
        if (sub)         sub.textContent = 'This secret has been burned from the server and cannot be viewed again.';
        if (burnBadge)   burnBadge.style.display   = 'flex';
        if (expiryBadge) expiryBadge.style.display = 'none';
    } else {
        if (sub)         sub.textContent = 'The secret was successfully unlocked client-side.';
        if (burnBadge)   burnBadge.style.display   = 'none';
        if (expiryBadge) expiryBadge.style.display = 'flex';
        if (expiryText)  expiryText.textContent    = formatTimeRemaining(expiresAt);
    }

    bindModalButtons(uid);
}

// ── Decode the key from URL hash ──────────────────────────────────────────────
function _decodeHash(rawHash) {
    try   { return decodeURIComponent(atob(rawHash)); }
    catch { return decodeURIComponent(rawHash);       }
}

// ── State A: Password prompt ──────────────────────────────────────────────────
function _initPasswordPrompt(uid, cipherText, burnAfterReading, expiresAt) {
    _show('passwordPromptState');

    const expiryEl = document.getElementById('pwPromptExpiryText');
    const burnChip = document.getElementById('pwPromptBurnChip');
    if (expiryEl) expiryEl.textContent = formatTimeRemaining(expiresAt);
    if (burnChip) burnChip.style.display = burnAfterReading ? 'flex' : 'none';

    _initEyeToggle('promptPasswordInput', 'togglePromptEye');

    const input     = document.getElementById('promptPasswordInput');
    const unlockBtn = document.getElementById('promptUnlockBtn');
    const errEl     = document.getElementById('unlockError');

    if (input) input.focus();

    async function attemptUnlock() {
        const pass = input?.value.trim() || '';
        if (!pass) {
            if (errEl) { errEl.style.display = 'flex'; errEl.textContent = 'Please enter the password to decrypt this secret.'; }
            input?.focus();
            return;
        }
        if (errEl) errEl.style.display = 'none';

        const origHtml = unlockBtn.innerHTML;
        unlockBtn.disabled = true;
        unlockBtn.innerHTML = '<span class="spinner-ring" style="width:16px;height:16px;margin:0;border-width:2px;display:inline-block;vertical-align:middle;margin-right:8px;"></span> Decrypting…';

        try {
            const decrypted = await decryptAESGCM(cipherText, pass);
            if (burnAfterReading) await fetch(`/api/secret/${uid}/burn`, { method: 'POST' });
            displayDecryptedMessage(decrypted);
            _showResult(uid, burnAfterReading, expiresAt);
        } catch {
            if (errEl) { errEl.style.display = 'flex'; errEl.textContent = 'Incorrect password. Please verify and try again.'; }
            input?.focus();
            input?.select();
        } finally {
            unlockBtn.disabled = false;
            unlockBtn.innerHTML = origHtml;
        }
    }

    if (unlockBtn) unlockBtn.onclick = attemptUnlock;
    if (input) input.onkeydown = ev => { if (ev.key === 'Enter') { ev.preventDefault(); attemptUnlock(); } };
}

// ── State B: Reveal button (burn + hash) ──────────────────────────────────────
function _initRevealPrompt(uid, cipherText, rawHash, burnAfterReading, expiresAt) {
    _show('revealPromptState');

    const expiryEl = document.getElementById('revealExpiryText');
    if (expiryEl) expiryEl.textContent = formatTimeRemaining(expiresAt);

    const revealBtn = document.getElementById('revealSecretBtn');
    if (!revealBtn) return;

    revealBtn.onclick = async () => {
        const origHtml = revealBtn.innerHTML;
        revealBtn.disabled = true;
        revealBtn.innerHTML = '<span class="spinner-ring" style="width:16px;height:16px;margin:0;border-width:2px;display:inline-block;vertical-align:middle;margin-right:8px;"></span> Unlocking & burning…';

        const pass = _decodeHash(rawHash);
        try {
            let decrypted;
            try   { decrypted = await decryptAESGCM(cipherText, pass); }
            catch { decrypted = await decryptAESGCM(cipherText, decodeURIComponent(rawHash)); }

            await fetch(`/api/secret/${uid}/burn`, { method: 'POST' });
            history.replaceState(null, null, location.pathname + location.search);
            displayDecryptedMessage(decrypted);
            _showResult(uid, true, expiresAt);
        } catch {
            alert('Failed to decrypt secret with URL key.');
            revealBtn.disabled = false;
            revealBtn.innerHTML = origHtml;
        }
    };
}

// ── State C: Auto-decrypt immediately ────────────────────────────────────────
async function _autoDecrypt(uid, cipherText, rawHash, expiresAt) {
    const pass = _decodeHash(rawHash);
    try {
        let decrypted;
        try   { decrypted = await decryptAESGCM(cipherText, pass); }
        catch { decrypted = await decryptAESGCM(cipherText, decodeURIComponent(rawHash)); }

        history.replaceState(null, null, location.pathname + location.search);
        displayDecryptedMessage(decrypted);
        _showResult(uid, false, expiresAt);
    } catch (e) {
        console.error('Auto-decrypt failed:', e);
        // Fall back to password prompt
        _initPasswordPrompt(uid, cipherText, false, expiresAt);
    }
}

// ── State D: Unavailable ──────────────────────────────────────────────────────
function _showUnavailable(status, errorMsg) {
    _show('unavailableState');
    const titleEl = document.getElementById('unavailableTitle');
    const subEl   = document.getElementById('unavailableSub');
    if (status === 410) {
        if (titleEl) titleEl.textContent = 'Secret Expired';
        if (subEl)   subEl.textContent   = 'This secret reached its expiration time and was permanently deleted.';
    } else {
        if (titleEl) titleEl.textContent = 'Secret Unavailable';
        if (subEl)   subEl.textContent   = errorMsg || 'This secret does not exist or was already burned after being read.';
    }
}

// ── URL-state machine controller ──────────────────────────────────────────────
async function initDecrypterPage() {
    const params  = new URLSearchParams(location.search);
    const uid     = params.get('id');
    const rawHash = location.hash.substring(1);

    const isDecrypterPage = location.pathname.includes('decoder') || location.pathname.includes('decrypter');
    if (!uid || !isDecrypterPage) return;

    _show('loadingState');

    try {
        const res  = await fetch(`/api/secret/${uid}`);
        const data = await res.json();

        if (!res.ok || data.error || !data.emessage) {
            _showUnavailable(res.status, data.error);
            return;
        }

        const { emessage: cipherText, has_password, burn_after_reading, expires_at } = data;
        const hasPassword     = Boolean(has_password);
        const burnAfterReading = Boolean(burn_after_reading);

        const heroTitle = document.getElementById('decoderHeroTitle');
        if (heroTitle) heroTitle.innerHTML = 'Unlock your <span class="em">Secret</span>.';

        if (hasPassword || !rawHash) {
            // A: need password
            _initPasswordPrompt(uid, cipherText, burnAfterReading, expires_at);
        } else if (burnAfterReading) {
            // B: one-click reveal to prevent bot burns
            _initRevealPrompt(uid, cipherText, rawHash, burnAfterReading, expires_at);
        } else {
            // C: auto-decrypt
            await _autoDecrypt(uid, cipherText, rawHash, expires_at);
        }
    } catch (err) {
        console.error('Error fetching secret:', err);
        _showUnavailable(500, null);
    }
}

// ── Manual decrypt form (no ?id= present) ────────────────────────────────────
function initManualDecryptForm() {
    const btn      = document.getElementById('decode');
    const msgInput = document.getElementById('emessage');
    const passInput = document.getElementById('ePassword');
    const modal    = document.querySelector('.modal_content');

    if (!btn) return;

    btn.addEventListener('click', async e => {
        e.preventDefault();

        const cipherText = msgInput?.value.trim() || '';
        const pass       = passInput?.value.trim() || '';

        if (!cipherText) {
            alert('Please paste the ciphertext to decrypt.');
            msgInput?.focus();
            return;
        }

        const origHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-ring" style="width:16px;height:16px;margin:0;border-width:2px;display:inline-block;vertical-align:middle;margin-right:8px;"></span> Decrypting…';

        try {
            const decrypted = await decryptAESGCM(cipherText, pass);
            displayDecryptedMessage(decrypted);

            const card = document.getElementById('card');
            if (card)  card.classList.add('result-mode');
            if (modal) modal.classList.add('show');

            const form = document.getElementById('manualDecryptForm');
            if (form) form.style.display = 'none';
            bindModalButtons();
        } catch (err) {
            console.error('Decryption failed:', err);
            alert('Decryption failed. Please check your ciphertext and password.');
        } finally {
            btn.disabled = false;
            btn.innerHTML = origHtml;
        }
    });
}
