/**
 * steg_encrypter.js — Image steganography encryption & decryption handling.
 * Embeds secret UID into carrier image pixels and retrieves secrets from encoded images.
 * Depends on: crypto.js, ui.js
 */

// ── Dropzone Setup for Steganography (Encrypt page) ─────────────────────────
function initStegDropzone() {
    const stegCoverCard = document.getElementById('stegCoverCard') || document.getElementById('stegDropzone');
    const stegFileInput = document.getElementById('steg-select');
    const sampleBtn = document.getElementById('loadSampleCoverBtn');
    const stegMsg = document.getElementById('stegMessage');
    const stegBytes = document.getElementById('stegBoundBytes');

    if (stegCoverCard && stegFileInput) {
        stegCoverCard.addEventListener('click', (e) => {
            if (e.target.closest('#loadSampleCoverBtn')) return;
            stegFileInput.click();
        });

        stegCoverCard.addEventListener('dragover', (e) => {
            e.preventDefault();
            stegCoverCard.classList.add('drag-over');
        });

        stegCoverCard.addEventListener('dragleave', () => {
            stegCoverCard.classList.remove('drag-over');
        });

        stegCoverCard.addEventListener('drop', (e) => {
            e.preventDefault();
            stegCoverCard.classList.remove('drag-over');
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                const dt = new DataTransfer();
                dt.items.add(e.dataTransfer.files[0]);
                stegFileInput.files = dt.files;
                _handleStegFileSelected(e.dataTransfer.files[0]);
            }
        });

        stegFileInput.addEventListener('change', () => {
            if (stegFileInput.files && stegFileInput.files[0]) {
                _handleStegFileSelected(stegFileInput.files[0]);
            }
        });
    }

    if (sampleBtn && stegFileInput) {
        sampleBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            try {
                const origText = sampleBtn.textContent;
                sampleBtn.textContent = 'Loading…';
                const resp = await fetch('/static/img/sample_cover.png');
                if (!resp.ok) throw new Error('Sample cover image not found.');
                const blob = await resp.blob();
                const file = new File([blob], 'sample_cover.png', { type: 'image/png' });

                const dt = new DataTransfer();
                dt.items.add(file);
                stegFileInput.files = dt.files;

                _handleStegFileSelected(file);
                sampleBtn.textContent = 'Loaded ✓';
                setTimeout(() => { sampleBtn.textContent = origText; }, 1800);
            } catch (err) {
                console.error('Error loading sample cover:', err);
                sampleBtn.textContent = 'Failed';
                setTimeout(() => { sampleBtn.textContent = 'Load Sample Cover'; }, 1800);
            }
        });
    }

    if (stegMsg && stegBytes) {
        stegMsg.addEventListener('input', () => {
            const val = stegMsg.value || '';
            const bytes = new TextEncoder().encode(val).length;
            if (bytes < 1024) {
                stegBytes.textContent = `${bytes} B bound`;
            } else {
                stegBytes.textContent = `${(bytes / 1024).toFixed(1)} KB bound`;
            }
        });
    }
}

function _handleStegFileSelected(file) {
    const sizeKb = Math.round(file.size / 1024);
    const stegTitle = document.getElementById('stegCoverTitleText');
    const stegSub = document.getElementById('stegCoverSubText');
    const stegText = document.getElementById('stegDropzoneText');

    if (stegTitle) {
        stegTitle.innerHTML = `<span style="color:var(--accent); font-weight:600;">${file.name}</span> selected`;
    }
    if (stegSub) {
        stegSub.textContent = `${sizeKb} KB · Ready to bind secret message`;
    }
    if (stegText) {
        stegText.innerHTML = `<span class="browse">${file.name}</span> selected (${sizeKb} KB)`;
    }

    const stegCoverCard = document.getElementById('stegCoverCard');
    if (stegCoverCard) stegCoverCard.classList.add('has-file');

    const stegDropzone = document.getElementById('stegDropzone');
    if (stegDropzone) stegDropzone.classList.add('has-file');
}

// ── Stegano Encrypt Flow ─────────────────────────────────────────────────────
async function encryptStegImage() {
    const stegMsgInput = document.getElementById('stegMessage');
    const msgInput = document.getElementById('message');
    const stegFileInput = document.getElementById('steg-select');
    const btn = document.getElementById('encode');

    const message = (stegMsgInput?.value ?? msgInput?.value ?? msgInput?.innerText ?? '').trim();
    const carrierFile = stegFileInput?.files?.[0] || null;

    if (!message) {
        alert('Please enter a secret message to hide inside the image.');
        msgInput?.focus();
        return;
    }

    if (!carrierFile) {
        alert('Please choose a carrier image (PNG, JPG, etc.) to embed the secret in.');
        stegFileInput?.click();
        return;
    }

    const origBtnHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-ring" style="width:16px;height:16px;margin:0;border-width:2px;display:inline-block;vertical-align:middle;margin-right:8px;"></span> Embedding secret in pixels…';
    }

    try {
        const formData = new FormData();
        formData.append('image', carrierFile);
        formData.append('message', message);
        formData.append('expiry', '24');
        formData.append('burn', 'false');
        formData.append('has_password', 'false');

        const res = await fetch('/api/steg/enc', {
            method: 'POST',
            body: formData
        });
        
        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Server returned status ${res.status}: ${errorText.substring(0, 100)}`);
        }
        const data = await res.json();

        // Direct automatic download of the encoded image (no link needed)
        const dlLink = document.createElement('a');
        dlLink.href = data.download_url;
        dlLink.download = data.filename || 'endec_secret.png';
        document.body.appendChild(dlLink);
        dlLink.click();
        dlLink.remove();

        _populateStegResultModal(data);
        bindModalButtons();
    } catch (err) {
        console.error('Steganography error:', err);
        alert('Image steganography error: ' + err.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = origBtnHtml;
        }
    }
}

function _populateStegResultModal(data) {
    const modal = document.querySelector('.modal_content');
    const card = document.getElementById('card');
    const titleEl = document.getElementById('resultTitle');
    const subEl = document.getElementById('resultSub');
    const rawMessageBox = document.getElementById('rawMessageBox');
    const imageDownloadBox = document.getElementById('imageDownloadBox');
    const downloadImageBtn = document.getElementById('downloadImageBtn');
    const imageDownloadName = document.getElementById('imageDownloadName');
    const shareableLinkBox = document.getElementById('shareableLinkBox');
    const metaRow = document.querySelector('.modal_content .meta-row');

    if (titleEl) titleEl.textContent = 'Secret hidden inside image.';
    if (subEl) {
        subEl.textContent = 'The secret message is embedded inside the image. Share the image with the recipient, who can retrieve the hidden message by uploading it to the Decrypt section.';
    }

    if (imageDownloadBox && downloadImageBtn) {
        imageDownloadBox.style.display = 'flex';
        downloadImageBtn.href = data.download_url;
        downloadImageBtn.download = data.filename || 'endec_secret.png';
        if (imageDownloadName) {
            imageDownloadName.textContent = data.filename || 'endec_secret.png';
        }
    }

    // No need of creating link in image section
    if (shareableLinkBox) {
        shareableLinkBox.style.display = 'none';
    }

    if (rawMessageBox) {
        rawMessageBox.hidden = true;
        rawMessageBox.style.display = 'none';
    }
    if (metaRow) {
        metaRow.hidden = true;
        metaRow.style.display = 'none';
    }

    if (card) card.classList.add('result-mode');
    if (modal) modal.classList.add('show');
}

// ── Stegano Decrypt Flow (Decrypt page) ──────────────────────────────────────
function initStegDecoder() {
    const stegDropzone = document.getElementById('stegDecDropzone');
    const stegFileInput = document.getElementById('steg-decode-select');

    if (stegDropzone && stegFileInput) {
        stegDropzone.addEventListener('click', () => stegFileInput.click());

        stegDropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            stegDropzone.classList.add('drag-over');
        });

        stegDropzone.addEventListener('dragleave', () => {
            stegDropzone.classList.remove('drag-over');
        });

        stegDropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            stegDropzone.classList.remove('drag-over');
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                const dt = new DataTransfer();
                dt.items.add(e.dataTransfer.files[0]);
                stegFileInput.files = dt.files;
                _handleStegDecFile(e.dataTransfer.files[0]);
            }
        });

        stegFileInput.addEventListener('change', () => {
            if (stegFileInput.files && stegFileInput.files[0]) {
                _handleStegDecFile(stegFileInput.files[0]);
            }
        });
    }
}

function _handleStegDecFile(file) {
    const textEl = document.getElementById('stegDecDropText');
    if (textEl) {
        const sizeKb = Math.round(file.size / 1024);
        textEl.innerHTML = `<span class="browse">${file.name}</span> selected (${sizeKb} KB)`;
    }
    const dropzone = document.getElementById('stegDecDropzone');
    if (dropzone) dropzone.classList.add('has-file');
}

async function decodeStegImage() {
    const stegFileInput = document.getElementById('steg-decode-select');
    const passInput = document.getElementById('ePassword');
    const btn = document.getElementById('decode');

    const file = stegFileInput?.files?.[0];
    if (!file) {
        alert('Please choose an encoded image to extract and decrypt.');
        stegFileInput?.click();
        return;
    }

    const origBtnHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-ring" style="width:16px;height:16px;margin:0;border-width:2px;display:inline-block;vertical-align:middle;margin-right:8px;"></span> Extracting secret from image…';
    }

    try {
        const formData = new FormData();
        formData.append('image', file);

        const res = await fetch('/api/steg/dec', {
            method: 'POST',
            body: formData
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
            throw new Error(data.error || 'Failed to extract secret from image.');
        }

        const secret = data.secret;
        const enteredPassword = passInput?.value.trim() || '';

        if (secret.has_password) {
            if (enteredPassword) {
                const plainText = await decryptAESGCM(secret.emessage, enteredPassword);
                if (secret.burn_after_reading) {
                    await fetch(`/api/secret/${secret.id}/burn`, { method: 'POST' }).catch(() => {});
                }
                displayDecryptedMessage(plainText);
                _showResult(secret.id, secret.burn_after_reading, secret.expires_at);
            } else {
                _initPasswordPrompt(secret.id, secret.emessage, secret.burn_after_reading, secret.expires_at);
            }
        } else {
            const plainText = secret.emessage;
            if (secret.burn_after_reading) {
                await fetch(`/api/secret/${secret.id}/burn`, { method: 'POST' }).catch(() => {});
            }
            displayDecryptedMessage(plainText);
            _showResult(secret.id, secret.burn_after_reading, secret.expires_at);
        }
    } catch (err) {
        console.error('Steganography decode error:', err);
        alert('Decryption error: ' + (err.message || 'Incorrect password or invalid image.'));
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = origBtnHtml;
        }
    }
}
