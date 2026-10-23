/**
 * encrypter.js — Encrypt-page logic.
 * Depends on: crypto.js, ui.js (loaded before this file)
 *
 * Responsibilities:
 *  - Options pills: Password, Burn toggle, Expiry
 *  - Tabs: Message ↔ File upload
 *  - Encrypt button: client-side encrypt → POST /secret → show result modal
 */

// ── Options pills ─────────────────────────────────────────────────────────────
function initPasswordPill() {
    const pill        = document.getElementById('pwPill');
    const input       = document.getElementById('pass');
    const toggleEye   = document.getElementById('togglePwEye');

    if (!pill || !input) return;

    pill.addEventListener('click', e => {
        if (e.target.closest('#togglePwEye')) return;
        pill.classList.add('expanded');
        input.focus();
    });

    input.addEventListener('input', () => {
        pill.classList.toggle('has-password', Boolean(input.value.trim()));
    });

    input.addEventListener('blur', () => {
        if (!input.value.trim()) pill.classList.remove('expanded', 'has-password');
    });

    if (toggleEye) {
        toggleEye.addEventListener('click', e => {
            e.stopPropagation();
            const isHidden = input.type === 'password';
            input.type = isHidden ? 'text' : 'password';
            toggleEye.innerHTML = isHidden
                ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
                : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
        });
    }
}

function initBurnPill() {
    const pill     = document.getElementById('burnPill');
    const toggle   = document.getElementById('burnToggle');
    const checkbox = document.getElementById('burnToggleCheckbox');
    const label    = document.getElementById('burnLabel');

    if (!pill || !toggle) return;

    pill.addEventListener('click', () => {
        toggle.classList.toggle('on');
        const isOn = toggle.classList.contains('on');
        if (checkbox) checkbox.checked = isOn;
        if (label)    label.textContent = isOn ? 'Burn after reading' : 'Keep until expiry';
        pill.classList.toggle('active', isOn);
    });
}

function initExpiryPill() {
    const select = document.getElementById('expiry');
    const pill   = document.getElementById('expiryPill');
    if (!select || !pill) return;
    select.addEventListener('change', () => {
        pill.classList.add('active');
        setTimeout(() => pill.classList.remove('active'), 600);
    });
}

// ── Message ↔ File tabs ───────────────────────────────────────────────────────
function initTabs() {
    const tabs      = document.querySelectorAll('.tab');
    const msgInput  = document.getElementById('message');
    const dropzone  = document.getElementById('dropzone');
    const fileInput = document.getElementById('pdf-select');

    if (!tabs.length || !msgInput || !dropzone || !fileInput) return;

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            if (tab.dataset.tab === 'file') {
                msgInput.style.display = 'none';
                dropzone.classList.add('active');
                runCipherPreview(fileInput.files[0]?.name || '');
            } else {
                msgInput.style.display = 'block';
                dropzone.classList.remove('active');
                runCipherPreview(msgInput.value);
            }
        });
    });

    dropzone.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', () => {
        const file = fileInput.files[0];
        if (!file) return;

        dropzone.querySelector('span').innerHTML =
            `<span class="browse">${file.name}</span> selected (${Math.round(file.size / 1024)} KB)`;

        const reader = new FileReader();
        reader.onload = ev => {
            const dataUrl   = ev.target.result;
            const mimeType  = file.type || 'application/octet-stream';
            const base64    = dataUrl.split(',')[1];
            const customUrl = `data:${mimeType};name=${encodeURIComponent(file.name)};base64,${base64}`;

            msgInput.value            = `[File: ${file.name} (${Math.round(file.size / 1024)} KB)]`;
            msgInput.dataset.fileData = customUrl;
            runCipherPreview(file.name);
        };
        reader.readAsDataURL(file);
    });

    msgInput.addEventListener('input', () => runCipherPreview(msgInput.value));
}

// ── Encrypt button ────────────────────────────────────────────────────────────
function initEncryptButton() {
    const btn      = document.getElementById('encode');
    const msgInput = document.getElementById('message');
    const passInput = document.getElementById('pass');

    if (!btn) return;

    btn.addEventListener('click', async e => {
        e.preventDefault();

        const message      = msgInput?.dataset.fileData || msgInput?.dataset.pdfData || msgInput?.value.trim() || '';
        const rawPass      = passInput?.value.trim() || '';
        const hasCustomPass = Boolean(rawPass);
        const pass         = rawPass || generateRandomKey();

        if (!message) {
            alert('Please enter a message or attach a file.');
            msgInput?.focus();
            return;
        }

        const origHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-ring" style="width:16px;height:16px;margin:0;border-width:2px;display:inline-block;vertical-align:middle;margin-right:8px;"></span> Encrypting client-side…';

        try {
            const cipherText = await encryptAESGCM(message, pass);

            const expSelect = document.getElementById('expiry');
            const expValue  = expSelect?.value || '1';

            const burnCheckbox = document.getElementById('burnToggleCheckbox');
            const burnToggle   = document.getElementById('burnToggle');
            const isBurn = burnCheckbox
                ? burnCheckbox.checked
                : (burnToggle?.classList.contains('on') ?? true);

            const res  = await fetch('/secret', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: cipherText, expiry: expValue, burn: isBurn, has_password: hasCustomPass })
            });
            const data = await res.json();

            if (!data.id) throw new Error(data.message || 'Failed to create encrypted secret.');

            // Build shareable link
            const shareLink = hasCustomPass
                ? `${location.origin}/decrypter?id=${data.id}`
                : `${location.origin}/decrypter?id=${data.id}#${btoa(encodeURIComponent(pass))}`;

            _populateResultModal(shareLink, cipherText, hasCustomPass, isBurn, expSelect);
            bindModalButtons();
        } catch (err) {
            console.error('Encryption failed:', err);
            alert('Encryption error: ' + err.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = origHtml;
        }
    });
}

function _populateResultModal(shareLink, cipherText, hasCustomPass, isBurn, expSelect) {
    const modal = document.querySelector('.modal_content');
    const card  = document.getElementById('card');

    document.getElementById('shareable-link-p')?.setAttribute !== undefined &&
        (document.getElementById('shareable-link-p').textContent = shareLink);

    document.getElementById('raw-message-p') &&
        (document.getElementById('raw-message-p').textContent = cipherText);

    const resultTitle = document.getElementById('resultTitle');
    const resultSub   = document.getElementById('resultSub');
    if (hasCustomPass) {
        if (resultTitle) resultTitle.textContent = 'Locked with password. Link ready.';
        if (resultSub)   resultSub.textContent   = 'Share this link — only someone with your password can decrypt and read it.';
    } else {
        if (resultTitle) resultTitle.textContent = 'Locked. Your link is ready.';
        if (resultSub)   resultSub.textContent   = 'Share this link — anyone with the link can decrypt it automatically.';
    }

    const expiryChip = document.getElementById('expiryChipText');
    if (expiryChip && expSelect) expiryChip.textContent = expSelect.options[expSelect.selectedIndex].text;

    const pwChip     = document.getElementById('pwChip');
    const pwChipText = document.getElementById('pwChipText');
    if (pwChip) {
        pwChip.style.display = 'flex';
        if (pwChipText) pwChipText.textContent = hasCustomPass ? 'Password protected' : 'Auto-decrypt key included';
    }

    const burnChip     = document.getElementById('burnChip');
    const burnChipText = document.getElementById('burnChipText');
    if (burnChip) {
        burnChip.style.display = 'flex';
        if (burnChipText) burnChipText.textContent = isBurn ? 'Burns after reading' : 'Active until expiry';
    }

    if (card)  card.classList.add('result-mode');
    if (modal) modal.classList.add('show');
}

// ── Entry ─────────────────────────────────────────────────────────────────────
function initEncrypterPage() {
    initPasswordPill();
    initBurnPill();
    initExpiryPill();
    initTabs();
    initEncryptButton();
}
