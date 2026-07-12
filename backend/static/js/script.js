const modal_container = document.querySelector(".modal_content");
const encryptBtn = document.getElementById("encode");
const inputMessage = document.getElementById("message");
const inputPass = document.getElementById("pass");
const existingResult = document.getElementById("dmessage");

if (encryptBtn) {
    encryptBtn.addEventListener("click", async (e) => {
        e.preventDefault();

        const message = inputMessage.dataset.fileData || inputMessage.dataset.pdfData || inputMessage.value;
        let pass = inputPass.value.trim();

        if (!message) {
            alert("Please enter a message or attach a file.");
            return;
        }
        if (!pass) {
            const randomBytes = crypto.getRandomValues(new Uint8Array(12));
            pass = btoa(String.fromCharCode(...randomBytes));
        }

        try {
            const resultText = await encryptAESGCM(message, pass); // actual encryption performs from here 
            const encryptedText = resultText;
            let exp = document.getElementById('expiry');

            // sending encryptedText to flask which will send encrypted text to database
            const data = await fetch('/secret', {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    'message': encryptedText,
                    'expiry': exp.value
                })
            });
            const result = await data.json();

            if (result.id) {
                const shareableLink = `${window.location.origin}/decoder?id=${result.id}#${btoa(encodeURIComponent(pass))}`;

                const linkElement = modal_container.querySelector("#shareable-link-p");
                if (linkElement) {
                    linkElement.textContent = shareableLink;
                }

                const rawElement = modal_container.querySelector("#raw-message-p");
                if (rawElement) {
                    rawElement.textContent = encryptedText;
                }

                // Show metadata chips in the result
                const expirySelect = document.getElementById("expiry");
                const expiryChipText = document.getElementById("expiryChipText");
                if (expirySelect && expiryChipText) {
                    expiryChipText.textContent = "Expires in " + expirySelect.options[expirySelect.selectedIndex].text.toLowerCase().replace("expires in ", "");
                }

                const pwChip = document.getElementById("pwChip");
                if (pwChip) {
                    const pwPill = document.getElementById("pwPill");
                    pwChip.style.display = (pwPill && pwPill.classList.contains("expanded") && inputPass.value) ? "flex" : "none";
                }

                const burnToggle = document.getElementById("burnToggle");
                const burnChip = document.getElementById("burnChip");
                if (burnChip) {
                    burnChip.style.display = (burnToggle && burnToggle.classList.contains("on")) ? "flex" : "none";
                }

                const card = document.getElementById("card");
                if (card) {
                    card.classList.add("result-mode");
                }
                modal_container.classList.add("show");
                bindModalButtons();
            }
        } catch (error) {
            console.log("encryption failed ", error);
        }
    });
}

const emessage = document.getElementById("emessage");
const decryptBtn = document.getElementById("decode");
const password = document.getElementById("ePassword");

function displayDecryptedMessage(decrypted_message) {
    const resultElement = document.getElementById("dmessage");
    if (!resultElement) return;

    if (decrypted_message.startsWith("data:")) {
        let mimeType = "application/octet-stream";
        let fileName = "decrypted_file";
        let downloadUrl = decrypted_message;

        const match = decrypted_message.match(/^data:([^;]+)(?:;name=([^;]+))?;base64,/);
        if (match) {
            mimeType = match[1];
            if (match[2]) {
                fileName = decodeURIComponent(match[2]);
            } else {
                const ext = mimeType.split("/")[1] || "bin";
                fileName = `decrypted_document.${ext}`;
            }
        }

        // Determine icon SVG and color based on mime type
        let iconSvg = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
        `;
        let iconColor = "#3b82f6"; // Blue default

        if (mimeType.startsWith("image/")) {
            iconSvg = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <circle cx="8.5" cy="8.5" r="1.5"></circle>
                    <polyline points="21 15 16 10 5 21"></polyline>
                </svg>
            `;
            iconColor = "#10b981"; // Green
        } else if (mimeType === "application/pdf") {
            iconSvg = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
            `;
            iconColor = "#ef4444"; // Red
        } else if (mimeType.startsWith("audio/")) {
            iconSvg = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="#8b5cf6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M9 18V5l12-2v13"></path>
                    <circle cx="6" cy="18" r="3"></circle>
                    <circle cx="18" cy="16" r="3"></circle>
                </svg>
            `;
            iconColor = "#8b5cf6"; // Purple
        } else if (mimeType.startsWith("video/")) {
            iconSvg = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="23 7 16 12 23 17 23 7"></polygon>
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                </svg>
            `;
            iconColor = "#f59e0b"; // Amber
        }

        resultElement.innerHTML = `
            <div class="pdf-download-container" style="border-left: 4px solid ${iconColor};">
                <span class="pdf-icon">
                    ${iconSvg}
                </span>
                <div class="pdf-info">
                    <span class="pdf-name" style="word-break: break-all;">${fileName}</span>
                </div>
                <a href="${downloadUrl}" download="${fileName}" class="pdf-dl-btn">
                    <span>Download File</span>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                </a>
            </div>
        `;
    } else {
        resultElement.textContent = decrypted_message;
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    // exact id from url
    const urlParams = new URLSearchParams(window.location.search);
    const uid = urlParams.get('id'); // gets id if any presents 
    const hashPass = window.location.hash.substring(1);

    if (uid) {
        const response = await fetch(`/api/secret/${uid}`);
        const data = await response.json();

        if (!response.ok || data.error) {
            alert(data.error || "Message could not be retrieved or was already destroyed.");
            return;
        }

        const message = data.emessage;

        if (hashPass) {
            const pass = atob(decodeURIComponent(hashPass)); // this decodes url ; %20 => space 
            const decrypted_message = await decryptAESGCM(message, pass);

            displayDecryptedMessage(decrypted_message);

            const card = document.getElementById("card");
            if (card) {
                card.classList.add("result-mode");
            }
            if (modal_container) {
                modal_container.classList.add("show");
            }
            bindModalButtons(uid);

            // Clean the URL to hide the password from the address bar
            history.replaceState(null, null, ' ');
        } else {
            // Ciphertext is loaded but needs a password manually
            const emsgInput = document.getElementById("emessage");
            if (emsgInput) {
                emsgInput.value = message;
                emsgInput.readOnly = true;
                emsgInput.placeholder = "Secret loaded. Enter password below to decrypt.";
                emsgInput.style.opacity = "0.7";
            }
            const heroSub = document.querySelector("header.hero .sub");
            if (heroSub) {
                heroSub.textContent = "This secret is password-protected. Enter the decryption password below.";
            }
        }
    }
});

// manual decrypt btn
if (decryptBtn) {
    decryptBtn.addEventListener("click", async (e) => {
        e.preventDefault();

        const messageText = emessage.value.trim();
        const passText = password.value.trim();

        if (!messageText) {
            alert("Please enter the encrypted message.");
            return;
        }

        try {
            const decryptedMessage = await decryptAESGCM(messageText, passText);

            displayDecryptedMessage(decryptedMessage);

            const card = document.getElementById("card");
            if (card) {
                card.classList.add("result-mode");
            }
            if (modal_container) {
                modal_container.classList.add("show");
            }
            const urlParams = new URLSearchParams(window.location.search);
            const uid = urlParams.get('id');
            bindModalButtons(uid);

        } catch (error) {
            console.error("Decryption failed:", error);
            alert("Wrong password or corrupted encrypted text.");
        }
    });
}

async function cleanData(uid) {
    if (!uid) return;
    try {
        const response = await fetch(`/api/del/${uid}`, { method: 'DELETE' });
        console.log(await response.json());
    } catch (e) {
        console.error("Cleanup failed", e);
    }
}

function bindModalButtons(uid = null) {
    const copyBtns = document.querySelectorAll(".copy-btn");
    const closeBtn = document.getElementById("close");

    copyBtns.forEach(btn => {
        btn.onclick = () => {
            const targetId = btn.getAttribute("data-target");
            const textToCopy = document.getElementById(targetId)?.textContent || "";
            const spanId = btn.getAttribute("data-span");
            const copiedSpan = document.getElementById(spanId);

            navigator.clipboard.writeText(textToCopy).then(() => {
                if (copiedSpan) {
                    const originalText = btn.innerHTML;
                    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>Copied';
                    setTimeout(() => {
                        btn.innerHTML = originalText;
                    }, 1500);
                }
            });
        };
    });
    if (closeBtn) {
        closeBtn.onclick = () => {
            window.location = "/";
            cleanData(uid);
        };
    }
}

const globalCloseBtn = document.getElementById("close");
if (globalCloseBtn) {
    globalCloseBtn.addEventListener("click", (e) => {
        e.preventDefault();
        const card = document.getElementById("card");
        if (card) {
            card.classList.remove("result-mode");
        }
        if (modal_container) {
            modal_container.classList.remove("show");
        }
    });
}

if (modal_container) {
    modal_container.addEventListener("click", (e) => {
        if (e.target === modal_container) {
            const card = document.getElementById("card");
            if (card) {
                card.classList.remove("result-mode");
            }
            modal_container.classList.remove("show");
        }
    });
}

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
        const card = document.getElementById("card");
        if (card) {
            card.classList.remove("result-mode");
        }
        if (modal_container) {
            modal_container.classList.remove("show");
        }
    }
});

// Active Nav Link Logic
document.addEventListener("DOMContentLoaded", () => {
    const navLinks = document.querySelectorAll(".nav-link");
    const currentPath = window.location.pathname;
    navLinks.forEach(link => {
        const href = link.getAttribute("href");
        if ((currentPath === "/" && href === "/") || (currentPath.includes("decoder") && href.includes("decoder"))) {
            link.classList.add("active");
        } else {
            link.classList.remove("active");
        }
    });
});

// ----- Tabs: text / file -----
document.addEventListener("DOMContentLoaded", () => {
    const tabs = document.querySelectorAll('.tab');
    const inputMessage = document.getElementById('message');
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('pdf-select');

    if (tabs.length && inputMessage && dropzone && fileInput) {
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                if (tab.dataset.tab === 'file') {
                    inputMessage.style.display = 'none';
                    dropzone.classList.add('active');
                    runCipherPreview(fileInput.files[0] ? fileInput.files[0].name : "");
                } else {
                    inputMessage.style.display = 'block';
                    dropzone.classList.remove('active');
                    runCipherPreview(inputMessage.value);
                }
            });
        });
    }

    if (dropzone && fileInput && inputMessage) {
        dropzone.addEventListener('click', () => {
            fileInput.click();
        });

        fileInput.addEventListener('change', () => {
            const file = fileInput.files[0];
            if (file) {
                dropzone.querySelector('span').innerHTML = `<span class="browse">${file.name}</span> selected`;
                
                const reader = new FileReader();
                reader.onload = (event) => {
                    const dataUrl = event.target.result;
                    const mimeType = file.type || "application/octet-stream";
                    const base64Part = dataUrl.split(",")[1];
                    const customDataUrl = `data:${mimeType};name=${encodeURIComponent(file.name)};base64,${base64Part}`;
                    
                    inputMessage.value = `[File: ${file.name} (${Math.round(file.size / 1024)} KB)]`;
                    inputMessage.dataset.fileData = customDataUrl;
                    runCipherPreview(file.name);
                };
                reader.readAsDataURL(file);
            }
        });
    }

    if (inputMessage) {
        inputMessage.addEventListener('input', () => runCipherPreview(inputMessage.value));
    }
});

// ----- Signature element: live cipher scramble preview -----
const glyphs = '!<>-_\\/[]{}—=+*^?#$%';
let scrambleTimer = null;

function randomGlyphString(len){
    let s = '';
    for(let i=0;i<len;i++) s += glyphs[Math.floor(Math.random()*glyphs.length)];
    return s;
}

function runCipherPreview(source){
    const cipherText = document.getElementById('cipherText');
    if (!cipherText) return;
    clearTimeout(scrambleTimer);
    if(!source){
        cipherText.textContent = 'waiting for input…';
        return;
    }
    const target = btoa(unescape(encodeURIComponent(source))).slice(0, 40);
    let frame = 0;
    const totalFrames = 10;
    function tick(){
        if(frame >= totalFrames){
            cipherText.textContent = target + (source.length > 40 ? '…' : '');
            return;
        }
        const revealCount = Math.floor((frame/totalFrames) * target.length);
        let out = target.slice(0, revealCount) + randomGlyphString(Math.max(0, target.length - revealCount));
        cipherText.textContent = out;
        frame++;
        scrambleTimer = setTimeout(tick, 35);
    }
    tick();
}

// ----- Password pill expand -----
document.addEventListener("DOMContentLoaded", () => {
    const pwPill = document.getElementById('pwPill');
    if (pwPill) {
        const pwInput = pwPill.querySelector('input');
        pwPill.addEventListener('click', (e) => {
            if(e.target.tagName !== 'INPUT'){
                pwPill.classList.add('expanded');
                if (pwInput) pwInput.focus();
            }
        });
        if (pwInput) {
            pwInput.addEventListener('blur', () => {
                if(!pwInput.value) pwPill.classList.remove('expanded');
            });
        }
    }
});

// ----- Burn toggle -----
document.addEventListener("DOMContentLoaded", () => {
    const burnPill = document.getElementById('burnPill');
    const burnToggle = document.getElementById('burnToggle');
    const burnCheckbox = document.getElementById('burnToggleCheckbox');
    if (burnPill && burnToggle) {
        burnPill.addEventListener('click', () => {
            burnToggle.classList.toggle('on');
            if (burnCheckbox) {
                burnCheckbox.checked = burnToggle.classList.contains('on');
            }
        });
    }
});

//client side encryption 
async function encryptAESGCM(message, password) {
    const encoder = new TextEncoder();

    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        encoder.encode(password),
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
    );

    const key = await crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: salt,
            iterations: 100000,
            hash: "SHA-256"
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt"]
    );

    const encrypted = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        encoder.encode(message)
    );

    function toBase64(bytes) {
        return btoa(String.fromCharCode(...bytes));
    }

    const encryptedBase64 = toBase64(new Uint8Array(encrypted));
    const saltBase64 = toBase64(salt);
    const ivBase64 = toBase64(iv);

    // combine into one string
    return `${saltBase64}:${ivBase64}:${encryptedBase64}`;
}

//client side decryption
async function decryptAESGCM(data, password) {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    // converts base 64 to bytes
    function fromBase64(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }

    const [saltBase64, ivBase64, encryptedBase64] = data.split(":");

    if (!saltBase64 || !ivBase64 || !encryptedBase64) {
        throw new Error("Invalid encrypted format");
    }

    const salt = fromBase64(saltBase64);
    const iv = fromBase64(ivBase64);
    const encrypted = fromBase64(encryptedBase64);

    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        encoder.encode(password),
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
    );

    const key = await crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: salt,
            iterations: 100000,
            hash: "SHA-256"
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["decrypt"]
    );

    const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv },
        key,
        encrypted
    );

    return decoder.decode(decrypted);
}
