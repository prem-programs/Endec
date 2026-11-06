/**
 * PDF-specific upload flow. Other file types are encrypted client-side.
 */
async function encryptPdfFile(file, password) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('password', password);

    const response = await fetch('/api/upload-pdf', {
        method: 'POST',
        body: formData
    });

    let data;
    try {
        data = await response.json();
    } catch {
        throw new Error('The server returned an invalid response while encrypting the PDF.');
    }

    if (!data || typeof data !== 'object' || !response.ok || data.error ||
        typeof data.link !== 'string' || !data.link) {
        throw new Error(data?.error || 'PDF encryption failed.');
    }

    const card = document.getElementById('card');
    const modal = document.getElementById('result');
    const linkEl = document.getElementById('shareable-link-p');
    const rawEl = document.getElementById('raw-message-p');
    const rawMessageBox = document.getElementById('rawMessageBox');
    const titleEl = document.getElementById('resultTitle');
    const subEl = document.getElementById('resultSub');
    const expiryChipText = document.getElementById('expiryChipText');
    const pwChip = document.getElementById('pwChip');
    const pwChipText = document.getElementById('pwChipText');
    const burnChipText = document.getElementById('burnChipText');

    if (linkEl) linkEl.textContent = data.link;
    if (rawEl) rawEl.textContent = `Password-protected PDF: ${file.name} (AES-256)`;
    if (rawMessageBox) rawMessageBox.hidden = true;
    if (titleEl) titleEl.textContent = 'Password-protected PDF ready.';
    if (subEl) {
        subEl.textContent = 'Share this one-time download link and send the PDF password separately. The recipient will need the password to open the downloaded PDF.';
    }
    if (expiryChipText) expiryChipText.textContent = 'One-time download';
    if (pwChip) {
        pwChip.style.display = 'flex';
        if (pwChipText) pwChipText.textContent = 'PDF password required';
    }
    if (burnChipText) burnChipText.textContent = 'Single-use download';

    if (card) card.classList.add('result-mode');
    if (modal) modal.classList.add('show');
    bindModalButtons();
}
