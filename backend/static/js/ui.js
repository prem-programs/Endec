/**
 * ui.js — Shared UI helpers used by both encrypt and decrypt pages.
 * Depends on: crypto.js (must be loaded first)
 */

// ── Live cipher-scramble preview strip ───────────────────────────────────────
const _glyphs = '!<>-_\\/[]{}—=+*^?#$%';
let _scrambleTimer = null;

function _randomGlyphs(len) {
    let s = '';
    for (let i = 0; i < len; i++) s += _glyphs[Math.floor(Math.random() * _glyphs.length)];
    return s;
}

/**
 * Animate the cipher-strip element with a scramble effect.
 * @param {string} source - The raw input to visualise
 */
function runCipherPreview(source) {
    const el = document.getElementById('cipherText');
    if (!el) return;
    clearTimeout(_scrambleTimer);
    if (!source) { el.textContent = 'waiting for input…'; return; }

    const target = btoa(unescape(encodeURIComponent(source))).slice(0, 40);
    let frame = 0;
    const total = 10;

    (function tick() {
        if (frame >= total) {
            el.textContent = target + (source.length > 40 ? '…' : '');
            return;
        }
        const revealed = Math.floor((frame / total) * target.length);
        el.textContent = target.slice(0, revealed) + _randomGlyphs(target.length - revealed);
        frame++;
        _scrambleTimer = setTimeout(tick, 35);
    })();
}

// ── Expiry countdown formatter ────────────────────────────────────────────────
/**
 * Format an ISO timestamp into a human-readable "Expires in X" string.
 * @param {string|null} isoDateStr
 * @returns {string}
 */
function formatTimeRemaining(isoDateStr) {
    if (!isoDateStr) return 'Expires soon';
    const diff = new Date(isoDateStr).getTime() - Date.now();
    if (diff <= 0) return 'Expired';
    const mins  = Math.round(diff / 60_000);
    if (mins < 60)  return `Expires in ${mins} min${mins === 1 ? '' : 's'}`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `Expires in ${hours} hour${hours === 1 ? '' : 's'}`;
    const days  = Math.round(hours / 24);
    return `Expires in ${days} day${days === 1 ? '' : 's'}`;
}

// ── Decrypted content renderer ────────────────────────────────────────────────
/**
 * Render decrypted content into #dmessage.
 * Handles plain text and binary data-URL files (PDF, image, etc.).
 * @param {string} content
 */
function displayDecryptedMessage(content) {
    const el = document.getElementById('dmessage');
    if (!el) return;

    if (!content.startsWith('data:')) {
        el.textContent = content;
        return;
    }

    // File (data URL)
    let mimeType = 'application/octet-stream';
    let fileName = 'decrypted_file';
    const match = content.match(/^data:([^;]+)(?:;name=([^;]+))?;base64,/);
    if (match) {
        mimeType = match[1];
        fileName = match[2] ? decodeURIComponent(match[2])
                            : `decrypted_document.${mimeType.split('/')[1] || 'bin'}`;
    }

    const ICON_MAP = {
        'image/':           { color: '#10b981', svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#10b981" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>` },
        'application/pdf':  { color: '#ef4444', svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#ef4444" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>` },
        'audio/':           { color: '#8b5cf6', svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#8b5cf6" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>` },
        'video/':           { color: '#f59e0b', svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#f59e0b" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>` },
    };

    const DEFAULT_ICON = { color: '#3b82f6', svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#3b82f6" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>` };

    let icon = DEFAULT_ICON;
    for (const [prefix, val] of Object.entries(ICON_MAP)) {
        if (mimeType.startsWith(prefix) || mimeType === prefix) { icon = val; break; }
    }

    el.innerHTML = `
        <div class="pdf-download-container" style="border-left:4px solid ${icon.color}">
            <span class="pdf-icon">${icon.svg}</span>
            <div class="pdf-info">
                <span class="pdf-name" style="word-break:break-all">${fileName}</span>
            </div>
            <a href="${content}" download="${fileName}" class="pdf-dl-btn">
                <span>Download File</span>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
            </a>
        </div>`;
}

// ── Modal / result panel ──────────────────────────────────────────────────────
/**
 * Bind Copy and Close buttons inside the result panel.
 * @param {string|null} uid - Secret ID for cleanup after close (encrypt page doesn't need it)
 */
function bindModalButtons(uid = null) {
    // Copy buttons
    document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.onclick = () => {
            const text   = document.getElementById(btn.getAttribute('data-target'))?.textContent || '';
            const spanEl = document.getElementById(btn.getAttribute('data-span'));
            navigator.clipboard.writeText(text).then(() => {
                const orig = btn.innerHTML;
                btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>Copied';
                if (spanEl) spanEl.textContent = 'Copied!';
                setTimeout(() => { btn.innerHTML = orig; if (spanEl) spanEl.textContent = ''; }, 1600);
            }).catch(err => console.error('Clipboard error:', err));
        };
    });

    // Close / reset button
    const closeBtn = document.getElementById('close');
    if (!closeBtn) return;

    closeBtn.onclick = (e) => {
        // <a> tags on the decrypter page navigate away — let them
        if (closeBtn.tagName === 'A') return;
        e.preventDefault();
        _dismissModal();
        _resetEncryptForm();
    };
}

/** Hide the result panel and restore the encrypt form. */
function _dismissModal() {
    const modal = document.querySelector('.modal_content');
    const card  = document.getElementById('card');
    if (card)  card.classList.remove('result-mode');
    if (modal) modal.classList.remove('show');
}

function _resetEncryptForm() {
    const msg = document.getElementById('message');
    if (msg) {
        msg.value = '';
        delete msg.dataset.fileData;
        delete msg.dataset.pdfData;
        msg.style.display = 'block';
    }

    const pass = document.getElementById('pass');
    if (pass) {
        pass.value = '';
        const pill = document.getElementById('pwPill');
        if (pill) pill.classList.remove('expanded', 'has-password');
    }

    const fileInput = document.getElementById('pdf-select');
    if (fileInput) fileInput.value = '';

    const rawMessageBox = document.getElementById('rawMessageBox');
    if (rawMessageBox) rawMessageBox.hidden = false;

    ['expiryPill', 'burnPill'].forEach(id => {
        const option = document.getElementById(id);
        if (option) option.hidden = false;
    });

    const dropzone = document.getElementById('dropzone');
    if (dropzone) {
        dropzone.classList.remove('active');
        const sp = dropzone.querySelector('span');
        if (sp) sp.innerHTML = '<span class="browse">Choose a file</span> or drag it here';
    }

    const standardWrap = document.getElementById('standardEncryptWrap');
    if (standardWrap) standardWrap.style.display = 'block';

    document.querySelectorAll('.tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === 'text');
    });

    runCipherPreview('');
    if (msg) msg.focus();
}

// ── Global modal dismiss (backdrop click & Escape) ────────────────────────────
function initModalDismiss() {
    const modal = document.querySelector('.modal_content');
    if (modal) {
        modal.addEventListener('click', e => {
            if (e.target === modal) _dismissModal();
        });
    }
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') _dismissModal();
    });
}

// ── Nav active-link highlighter ───────────────────────────────────────────────
function initNavActiveLink() {
    const path = window.location.pathname;
    document.querySelectorAll('.nav-link').forEach(link => {
        const href = link.getAttribute('href') || '';
        const isEncrypt = path === '/' && href === '/';
        const isDecrypt = (path.includes('decoder') || path.includes('decrypter'))
                       && (href.includes('decoder') || href.includes('decrypter'));
        link.classList.toggle('active', isEncrypt || isDecrypt);
    });
}
