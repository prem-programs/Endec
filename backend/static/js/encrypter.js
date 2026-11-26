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

function isPdfFile(file) {
    return file.name.toLowerCase().endsWith('.pdf');
}

// ── File attachment (merged into message input div via plus icon) ────────────
function _ensureMessageInputSupport(msgInput) {
    if (!msgInput) return;
    if (!('value' in msgInput)) {
        Object.defineProperty(msgInput, 'value', {
            get() {
                return this.innerText || this.textContent || '';
            },
            set(val) {
                this.innerText = val || '';
                if (!val) this.textContent = '';
            },
            configurable: true
        });
    }
}

function initFileAttachment() {
    const fileInput = document.getElementById('pdf-select');
    const filePill = document.getElementById('filePill');
    const filePillName = document.getElementById('filePillName');
    const removeFileBtn = document.getElementById('removeFileBtn');
    const msgInput = document.getElementById('message');
    const msgContainer = document.getElementById('messageInputContainer');
    const fieldWrap = document.getElementById('fieldWrap');
    const expiryPill = document.getElementById('expiryPill');
    const burnPill = document.getElementById('burnPill');

    if (!fileInput || !msgInput) return;
    _ensureMessageInputSupport(msgInput);

    if (msgContainer) {
        msgContainer.addEventListener('click', (e) => {
            if (!e.target.closest('#attachBtn') && !e.target.closest('#removeFileBtn') && !e.target.closest('.file-pill')) {
                msgInput.focus();
            }
        });
    }

    function updatePdfOptions() {
        // Expiry and Burn-after-read are supported for all payloads and uploads.
        if (expiryPill) expiryPill.hidden = false;
        if (burnPill) burnPill.hidden = false;
    }

    function handleSelectedFile(file) {
        if (!file) return;
        delete msgInput.dataset.fileData;

        const sizeKb = Math.round(file.size / 1024);
        if (filePill && filePillName) {
            filePillName.textContent = `${file.name} (${sizeKb} KB)`;
            const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf';
            filePill.classList.toggle('is-pdf', isPdf);
            filePill.style.display = 'flex';
        }

        runCipherPreview(file.name);
        updatePdfOptions();

        const reader = new FileReader();
        reader.onload = ev => {
            if (fileInput.files[0] !== file) return;
            const dataUrl   = String(ev.target.result || '');
            const mimeType  = file.type || 'application/octet-stream';
            const base64    = dataUrl.split(',')[1];
            if (!base64) {
                alert('Could not read the selected file.');
                return;
            }
            const customUrl = `data:${mimeType};name=${encodeURIComponent(file.name)};base64,${base64}`;
            msgInput.dataset.fileData = customUrl;
        };
        reader.onerror = () => {
            if (fileInput.files[0] === file) alert('Could not read the selected file.');
        };
        reader.readAsDataURL(file);
    }

    fileInput.addEventListener('change', () => {
        if (fileInput.files && fileInput.files[0]) {
            handleSelectedFile(fileInput.files[0]);
        }
    });

    if (removeFileBtn) {
        removeFileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            fileInput.value = '';
            delete msgInput.dataset.fileData;
            delete msgInput.dataset.pdfData;
            if (filePill) filePill.style.display = 'none';
            updatePdfOptions();
            runCipherPreview(msgInput.value);
        });
    }

    if (fieldWrap) {
        fieldWrap.addEventListener('dragover', (e) => {
            e.preventDefault();
            fieldWrap.classList.add('drag-over');
        });
        fieldWrap.addEventListener('dragleave', () => {
            fieldWrap.classList.remove('drag-over');
        });
        fieldWrap.addEventListener('drop', (e) => {
            e.preventDefault();
            fieldWrap.classList.remove('drag-over');
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                fileInput.files = e.dataTransfer.files;
                handleSelectedFile(fileInput.files[0]);
            }
        });
    }

    msgInput.addEventListener('input', () => {
        if (!fileInput.files?.[0]) {
            runCipherPreview(msgInput.value);
        }
    });
}

// ── Message ↔ Image tabs ──────────────────────────────────────────────────────
function initTabs() {
    const tabs = document.querySelectorAll('.tab');
    const msgInput = document.getElementById('message');
    const stegDropzone = document.getElementById('stegDropzone');
    const inputActionsBar = document.getElementById('inputActionsBar');
    const encodeBtn = document.getElementById('encode');

    if (!tabs.length || !msgInput) return;

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const standardWrap = document.getElementById('standardEncryptWrap');
            const stegWrap = document.getElementById('stegEncryptWrap');

            if (tab.dataset.tab === 'image') {
                if (standardWrap) standardWrap.style.display = 'none';
                if (stegWrap) stegWrap.style.display = 'flex';

                if (encodeBtn) {
                    encodeBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg> Hide Secret in Image &amp; Download';
                }
            } else {
                if (standardWrap) standardWrap.style.display = 'block';
                if (stegWrap) stegWrap.style.display = 'none';

                if (encodeBtn) {
                    encodeBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg> Encrypt &amp; create link';
                }
                const file = document.getElementById('pdf-select')?.files?.[0];
                runCipherPreview(file?.name || msgInput.value || msgInput.innerText || '');
            }
        });
    });
}

// ── Encrypt button ────────────────────────────────────────────────────────────
function initEncryptButton() {
    const btn      = document.getElementById('encode');
    const msgInput = document.getElementById('message');
    const passInput = document.getElementById('pass');
    const fileInput = document.getElementById('pdf-select');

    if (!btn) return;

    btn.addEventListener('click', async (e) => {
        e.preventDefault();

        const activeTab = document.querySelector('.tab.active')?.dataset.tab;
        if (activeTab === 'image') {
            await encryptStegImage();
            return;
        }

        const selectedFile = fileInput?.files?.[0] || null;
        const textMessage = (msgInput?.value || msgInput?.innerText || '').trim();
        const fileData = msgInput?.dataset.fileData || null;
        const rawPass = passInput?.value.trim() || '';
        const hasCustomPass = Boolean(rawPass);
        const pass = rawPass || generateRandomKey();

        if (selectedFile && !fileData && !(isPdfFile(selectedFile) && !textMessage && rawPass)) {
            alert('Please wait for the attached file to finish loading, then try again.');
            return;
        }

        // Native PDF encryption only when user provides password for standalone PDF without message
        if (selectedFile && isPdfFile(selectedFile) && !textMessage && rawPass) {
            const origHtml = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-ring" style="width:16px;height:16px;margin:0;border-width:2px;display:inline-block;vertical-align:middle;margin-right:8px;"></span> Encrypting PDF…';
            try {
                const expSelect = document.getElementById('expiry');
                const expHours = expSelect ? expSelect.value : 1;
                await encryptPdfFile(selectedFile, rawPass, expHours);
            } catch (err) {
                alert(err.message || 'PDF encryption failed.');
            } finally {
                btn.disabled = false;
                btn.innerHTML = origHtml;
            }
            return;
        }

        let payload;
        if (fileData && textMessage) {
            payload = JSON.stringify({ file: fileData, text: textMessage });
        } else if (fileData) {
            payload = JSON.stringify({ file: fileData });
        } else if (textMessage) {
            payload = textMessage;
        } else {
            alert('Please enter a message or attach a file.');
            msgInput?.focus();
            return;
        }

        const origHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-ring" style="width:16px;height:16px;margin:0;border-width:2px;display:inline-block;vertical-align:middle;margin-right:8px;"></span> Encrypting client-side…';

        try {
            const cipherText = await encryptAESGCM(payload, pass);

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
    const rawMessageBox = document.getElementById('rawMessageBox');

    if (rawMessageBox) rawMessageBox.hidden = false;
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
    initFileAttachment();
    if (typeof initStegDropzone === 'function') {
        initStegDropzone();
    }
    initEncryptButton();
}
