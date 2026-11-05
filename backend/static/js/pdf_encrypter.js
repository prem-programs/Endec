/**
 * pdf_encrypter.js — Handles server-side AES-256 PDF encryption via /api/upload-pdf
 * Connects with index.html (PDF tab, dropzone, password pill, and result modal)
 */

function initPdfEncrypter() {
    const pdfForm    = document.getElementById("pdfUploadForm");
    const fileInput  = document.getElementById("pdfFile");
    const passInput  = document.getElementById("pdfPassword");
    const dropzone   = document.getElementById("pdfDropzone");
    const statusText = document.getElementById("pdfStatus");
    const submitBtn  = document.getElementById("pdfSubmitBtn");

    if (!pdfForm || !fileInput || !passInput) return;

    // Prevent double binding
    if (pdfForm.dataset.initialized === "true") return;
    pdfForm.dataset.initialized = "true";

    // Update status text on file selection
    function updateFileLabel(file) {
        if (!file || !statusText) return;
        statusText.innerHTML = `<span class="browse">${file.name}</span> selected (${Math.round(file.size / 1024)} KB)`;
    }

    fileInput.addEventListener("change", () => {
        if (fileInput.files && fileInput.files[0]) {
            updateFileLabel(fileInput.files[0]);
        }
    });

    // Drag & drop support
    if (dropzone) {
        ['dragenter', 'dragover'].forEach(eventName => {
            dropzone.addEventListener(eventName, (e) => {
                e.preventDefault();
                dropzone.classList.add('dragover');
            });
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropzone.addEventListener(eventName, (e) => {
                e.preventDefault();
                dropzone.classList.remove('dragover');
            });
        });

        dropzone.addEventListener('drop', (e) => {
            if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
                const file = e.dataTransfer.files[0];
                fileInput.files = e.dataTransfer.files;
                updateFileLabel(file);
            }
        });
    }

    // Submit handler
    pdfForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const file = fileInput.files ? fileInput.files[0] : null;
        const pass = passInput.value.trim();

        if (!file) {
            alert("Please choose a PDF file to encrypt.");
            fileInput.click();
            return;
        }

        if (!file.name.toLowerCase().endsWith(".pdf")) {
            alert("Only PDF files (.pdf) are supported.");
            return;
        }

        if (!pass) {
            alert("Please enter a password to protect this PDF.");
            passInput.focus();
            return;
        }

        const origHtml = submitBtn ? submitBtn.innerHTML : "";
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spinner-ring" style="width:16px;height:16px;margin:0;border-width:2px;display:inline-block;vertical-align:middle;margin-right:8px;"></span> Encrypting PDF…';
        }

        const formData = new FormData();
        formData.append("file", file);
        formData.append("password", pass);

        try {
            const response = await fetch('/api/upload-pdf', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (!response.ok || data.error) {
                alert(data.error || "PDF encryption failed.");
                return;
            }

            // Display shareable link in result modal
            const card  = document.getElementById('card');
            const modal = document.getElementById('result');

            const linkEl = document.getElementById('shareable-link-p');
            if (linkEl) linkEl.textContent = data.link;

            const rawEl = document.getElementById('raw-message-p');
            if (rawEl) rawEl.textContent = `Encrypted PDF: ${file.name} (AES-256)`;

            const titleEl = document.getElementById('resultTitle');
            if (titleEl) titleEl.textContent = 'PDF Encrypted. Your link is ready.';

            const subEl = document.getElementById('resultSub');
            if (subEl) subEl.textContent = 'Share this one-time download link. The file burns immediately upon download.';

            const pwChip = document.getElementById('pwChip');
            const pwChipText = document.getElementById('pwChipText');
            if (pwChip) {
                pwChip.style.display = 'flex';
                if (pwChipText) pwChipText.textContent = 'Password protected (AES-256)';
            }

            const burnChip = document.getElementById('burnChip');
            const burnChipText = document.getElementById('burnChipText');
            if (burnChip) {
                burnChip.style.display = 'flex';
                if (burnChipText) burnChipText.textContent = 'Single-use download (burned immediately)';
            }

            if (card)  card.classList.add('result-mode');
            if (modal) modal.classList.add('show');

            if (typeof bindModalButtons === 'function') {
                bindModalButtons();
            }

        } catch (error) {
            console.error("PDF upload failed:", error);
            alert("Network error while uploading PDF.");
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = origHtml;
            }
        }
    });
}

// Ensure execution on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPdfEncrypter);
} else {
    initPdfEncrypter();
}


// Ensure execution on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPdfEncrypter);
} else {
    initPdfEncrypter();
}
