// Endec — Client-side Zero-Knowledge Encryption & Secret Sharing

const modal_container = document.querySelector(".modal_content");
const encryptBtn = document.getElementById("encode");
const inputMessage = document.getElementById("message");
const inputPass = document.getElementById("pass");

// Format remaining time from ISO timestamp
function formatTimeRemaining(isoDateStr) {
    if (!isoDateStr) return "Expires soon";
    const expiresAt = new Date(isoDateStr).getTime();
    const now = Date.now();
    const diffMs = expiresAt - now;
    if (diffMs <= 0) return "Expired";
    const diffMins = Math.round(diffMs / 60000);
    if (diffMins < 60) return `Expires in ${diffMins} min${diffMins === 1 ? '' : 's'}`;
    const diffHours = Math.round(diffMins / 60);
    if (diffHours < 24) return `Expires in ${diffHours} hour${diffHours === 1 ? '' : 's'}`;
    const diffDays = Math.round(diffHours / 24);
    return `Expires in ${diffDays} day${diffDays === 1 ? '' : 's'}`;
}

// ----------------- ENCRYPTION FLOW -----------------
if (encryptBtn) {
    encryptBtn.addEventListener("click", async (e) => {
        e.preventDefault();

        const message = inputMessage.dataset.fileData || inputMessage.dataset.pdfData || (inputMessage ? inputMessage.value.trim() : "");
        const rawPass = inputPass ? inputPass.value.trim() : "";
        const hasCustomPass = Boolean(rawPass);
        let pass = rawPass;

        if (!message) {
            alert("Please enter a message or attach a file.");
            if (inputMessage) inputMessage.focus();
            return;
        }

        // If no password set by user, generate a secure random 128-bit key for zero-knowledge link
        if (!pass) {
            const randomBytes = crypto.getRandomValues(new Uint8Array(16));
            pass = btoa(String.fromCharCode(...randomBytes));
        }

        try {
            encryptBtn.disabled = true;
            const originalBtnHtml = encryptBtn.innerHTML;
            encryptBtn.innerHTML = '<span class="spinner-ring" style="width:16px;height:16px;margin:0;border-width:2px;display:inline-block;vertical-align:middle;margin-right:8px;"></span> Encrypting client-side…';

            const encryptedText = await encryptAESGCM(message, pass);
            const expSelect = document.getElementById('expiry');
            const expValue = expSelect ? expSelect.value : '1';

            const burnToggle = document.getElementById("burnToggle");
            const burnCheckbox = document.getElementById("burnToggleCheckbox");
            const isBurn = burnCheckbox ? burnCheckbox.checked : (burnToggle ? burnToggle.classList.contains("on") : true);

            // Send encrypted ciphertext & metadata to backend (plaintext and password never leave browser)
            const response = await fetch('/secret', {
                method: "POST",
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: encryptedText,
                    expiry: expValue,
                    burn: isBurn,
                    has_password: hasCustomPass
                })
            });

            const result = await response.json();

            if (result.id) {
                // IMPORTANT: If user set a custom password, DO NOT put it in the URL hash!
                // The recipient must be asked for the password on /decrypter.
                // If auto-generated, put the key in the #hash for seamless direct link sharing.
                let shareableLink;
                if (hasCustomPass) {
                    shareableLink = `${window.location.origin}/decrypter?id=${result.id}`;
                } else {
                    shareableLink = `${window.location.origin}/decrypter?id=${result.id}#${btoa(encodeURIComponent(pass))}`;
                }

                const linkElement = document.getElementById("shareable-link-p");
                if (linkElement) linkElement.textContent = shareableLink;

                const rawElement = document.getElementById("raw-message-p");
                if (rawElement) rawElement.textContent = encryptedText;

                const resultTitle = document.getElementById("resultTitle");
                const resultSub = document.getElementById("resultSub");
                if (hasCustomPass) {
                    if (resultTitle) resultTitle.textContent = "Locked with password. Link ready.";
                    if (resultSub) resultSub.textContent = "Share this link — only someone with your password can decrypt and read it.";
                } else {
                    if (resultTitle) resultTitle.textContent = "Locked. Your link is ready.";
                    if (resultSub) resultSub.textContent = "Share this link — anyone with the link can decrypt it automatically.";
                }

                // Show metadata chips in result modal
                const expiryChipText = document.getElementById("expiryChipText");
                if (expiryChipText && expSelect) {
                    expiryChipText.textContent = expSelect.options[expSelect.selectedIndex].text;
                }

                const pwChip = document.getElementById("pwChip");
                const pwChipText = document.getElementById("pwChipText");
                if (pwChip) {
                    pwChip.style.display = "flex";
                    if (hasCustomPass) {
                        if (pwChipText) pwChipText.textContent = "Password protected";
                    } else {
                        if (pwChipText) pwChipText.textContent = "Auto-decrypt key included";
                    }
                }

                const burnChip = document.getElementById("burnChip");
                const burnChipText = document.getElementById("burnChipText");
                if (burnChip) {
                    burnChip.style.display = "flex";
                    if (isBurn) {
                        if (burnChipText) burnChipText.textContent = "Burns after reading";
                    } else {
                        if (burnChipText) burnChipText.textContent = "Active until expiry";
                    }
                }

                const card = document.getElementById("card");
                if (card) card.classList.add("result-mode");
                if (modal_container) modal_container.classList.add("show");
                bindModalButtons();
            } else {
                alert(result.message || "Failed to create encrypted secret.");
            }

            encryptBtn.disabled = false;
            encryptBtn.innerHTML = originalBtnHtml;
        } catch (error) {
            console.error("Encryption failed:", error);
            alert("Encryption error: " + error.message);
            if (encryptBtn) encryptBtn.disabled = false;
        }
    });
}

// ----------------- DISPLAY DECRYPTED CONTENT -----------------
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

        let iconColor = "#3b82f6";
        let iconSvg = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
            </svg>
        `;

        if (mimeType.startsWith("image/")) {
            iconColor = "#10b981";
            iconSvg = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <circle cx="8.5" cy="8.5" r="1.5"></circle>
                    <polyline points="21 15 16 10 5 21"></polyline>
                </svg>
            `;
        } else if (mimeType === "application/pdf") {
            iconColor = "#ef4444";
            iconSvg = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                </svg>
            `;
        }

        resultElement.innerHTML = `
            <div class="pdf-download-container" style="border-left: 4px solid ${iconColor};">
                <span class="pdf-icon">${iconSvg}</span>
                <div class="pdf-info">
                    <span class="pdf-name" style="word-break: break-all;">${fileName}</span>
                </div>
                <a href="${downloadUrl}" download="${fileName}" class="pdf-dl-btn">
                    <span>Download File</span>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
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

// ----------------- DECRYPTER PAGE CONTROLLER -----------------
document.addEventListener("DOMContentLoaded", async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const uid = urlParams.get('id');
    const rawHash = window.location.hash.substring(1);

    const loadingState = document.getElementById("loadingState");
    const passwordPromptState = document.getElementById("passwordPromptState");
    const revealPromptState = document.getElementById("revealPromptState");
    const unavailableState = document.getElementById("unavailableState");
    const manualDecryptForm = document.getElementById("manualDecryptForm");
    const resultModal = document.getElementById("result");
    const card = document.getElementById("card");

    function hideAllStates() {
        if (loadingState) loadingState.style.display = "none";
        if (passwordPromptState) passwordPromptState.style.display = "none";
        if (revealPromptState) revealPromptState.style.display = "none";
        if (unavailableState) unavailableState.style.display = "none";
        if (manualDecryptForm) manualDecryptForm.style.display = "none";
    }

    function showResult(burned, expiresAt) {
        hideAllStates();
        if (card) card.classList.add("result-mode");
        if (resultModal) resultModal.classList.add("show");

        const resultStatusSub = document.getElementById("resultStatusSub");
        const resultBurnBadge = document.getElementById("resultBurnBadge");
        const resultExpiryBadge = document.getElementById("resultExpiryBadge");
        const resultExpiryBadgeText = document.getElementById("resultExpiryBadgeText");

        if (burned) {
            if (resultStatusSub) resultStatusSub.textContent = "This secret has been burned from the server and cannot be viewed again.";
            if (resultBurnBadge) resultBurnBadge.style.display = "flex";
            if (resultExpiryBadge) resultExpiryBadge.style.display = "none";
        } else {
            if (resultStatusSub) resultStatusSub.textContent = "The secret was successfully unlocked client-side.";
            if (resultBurnBadge) resultBurnBadge.style.display = "none";
            if (resultExpiryBadge) {
                resultExpiryBadge.style.display = "flex";
                if (resultExpiryBadgeText) resultExpiryBadgeText.textContent = formatTimeRemaining(expiresAt);
            }
        }
        bindModalButtons(uid);
    }

    // Only run special link loader if uid is in URL
    if (uid && (window.location.pathname.includes("decoder") || window.location.pathname.includes("decrypter"))) {
        hideAllStates();
        if (loadingState) loadingState.style.display = "block";

        try {
            const response = await fetch(`/api/secret/${uid}`);
            const data = await response.json();

            if (!response.ok || data.error || !data.emessage) {
                hideAllStates();
                if (unavailableState) {
                    unavailableState.style.display = "block";
                    const titleEl = document.getElementById("unavailableTitle");
                    const subEl = document.getElementById("unavailableSub");
                    if (response.status === 410) {
                        if (titleEl) titleEl.textContent = "Secret Expired";
                        if (subEl) subEl.textContent = "This secret reached its expiration time and was permanently deleted.";
                    } else {
                        if (titleEl) titleEl.textContent = "Secret Unavailable";
                        if (subEl) subEl.textContent = data.error || "This secret does not exist or was already burned after being read.";
                    }
                }
                return;
            }

            const cipherText = data.emessage;
            const hasPassword = Boolean(data.has_password);
            const burnAfterReading = Boolean(data.burn_after_reading);
            const expiresAt = data.expires_at;

            // Update hero title and subtitle
            const heroTitle = document.getElementById("decoderHeroTitle");
            const heroSub = document.getElementById("decoderHeroSub");
            if (heroTitle) heroTitle.innerHTML = 'Unlock your <span class="em">Secret</span>.';

            // CASE 1: Password is required before revealing
            // (either sender marked has_password = true, or no decryption key is present in hash)
            if (hasPassword || !rawHash) {
                hideAllStates();
                if (passwordPromptState) {
                    passwordPromptState.style.display = "block";

                    const pwExpiryText = document.getElementById("pwPromptExpiryText");
                    if (pwExpiryText) pwExpiryText.textContent = formatTimeRemaining(expiresAt);

                    const pwBurnChip = document.getElementById("pwPromptBurnChip");
                    if (pwBurnChip) {
                        pwBurnChip.style.display = burnAfterReading ? "flex" : "none";
                    }

                    const promptPassInput = document.getElementById("promptPasswordInput");
                    const promptUnlockBtn = document.getElementById("promptUnlockBtn");
                    const unlockError = document.getElementById("unlockError");
                    const togglePromptEye = document.getElementById("togglePromptEye");

                    if (togglePromptEye && promptPassInput) {
                        togglePromptEye.onclick = () => {
                            if (promptPassInput.type === "password") {
                                promptPassInput.type = "text";
                                togglePromptEye.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
                            } else {
                                promptPassInput.type = "password";
                                togglePromptEye.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
                            }
                        };
                    }

                    if (promptPassInput) promptPassInput.focus();

                    const attemptUnlock = async () => {
                        const enteredPass = promptPassInput ? promptPassInput.value.trim() : "";
                        if (!enteredPass) {
                            if (unlockError) {
                                unlockError.style.display = "flex";
                                unlockError.textContent = "Please enter the password to decrypt this secret.";
                            }
                            if (promptPassInput) promptPassInput.focus();
                            return;
                        }

                        if (unlockError) unlockError.style.display = "none";
                        promptUnlockBtn.disabled = true;
                        const origBtnText = promptUnlockBtn.innerHTML;
                        promptUnlockBtn.innerHTML = '<span class="spinner-ring" style="width:16px;height:16px;margin:0;border-width:2px;display:inline-block;vertical-align:middle;margin-right:8px;"></span> Decrypting…';

                        try {
                            const decrypted = await decryptAESGCM(cipherText, enteredPass);

                            // If burn_after_reading is set, burn on server upon successful decryption
                            if (burnAfterReading) {
                                await fetch(`/api/secret/${uid}/burn`, { method: "POST" });
                            }

                            displayDecryptedMessage(decrypted);
                            showResult(burnAfterReading, expiresAt);
                        } catch (decryptErr) {
                            console.error("Password decryption failed:", decryptErr);
                            if (unlockError) {
                                unlockError.style.display = "flex";
                                unlockError.textContent = "Incorrect password. Please verify and try again.";
                            }
                            if (promptPassInput) {
                                promptPassInput.focus();
                                promptPassInput.select();
                            }
                        } finally {
                            promptUnlockBtn.disabled = false;
                            promptUnlockBtn.innerHTML = origBtnText;
                        }
                    };

                    if (promptUnlockBtn) promptUnlockBtn.onclick = attemptUnlock;
                    if (promptPassInput) {
                        promptPassInput.onkeydown = (ev) => {
                            if (ev.key === "Enter") {
                                ev.preventDefault();
                                attemptUnlock();
                            }
                        };
                    }
                }
            }
            // CASE 2: Key was included in URL hash (#key) AND burn_after_reading is true
            // To prevent crawlers/preview bots from burning the secret, show a "Reveal Secret" button
            else if (burnAfterReading) {
                hideAllStates();
                if (revealPromptState) {
                    revealPromptState.style.display = "block";
                    const revealExpiryText = document.getElementById("revealExpiryText");
                    if (revealExpiryText) revealExpiryText.textContent = formatTimeRemaining(expiresAt);

                    const revealBtn = document.getElementById("revealSecretBtn");
                    if (revealBtn) {
                        revealBtn.onclick = async () => {
                            revealBtn.disabled = true;
                            revealBtn.innerHTML = '<span class="spinner-ring" style="width:16px;height:16px;margin:0;border-width:2px;display:inline-block;vertical-align:middle;margin-right:8px;"></span> Unlocking & burning…';

                            let pass;
                            try {
                                pass = decodeURIComponent(atob(rawHash));
                            } catch (e) {
                                pass = decodeURIComponent(rawHash);
                            }

                            try {
                                let decrypted;
                                try {
                                    decrypted = await decryptAESGCM(cipherText, pass);
                                } catch (e1) {
                                    decrypted = await decryptAESGCM(cipherText, decodeURIComponent(rawHash));
                                }

                                // Burn on server!
                                await fetch(`/api/secret/${uid}/burn`, { method: "POST" });

                                // Clear hash from URL so password isn't visible in browser history
                                history.replaceState(null, null, window.location.pathname + window.location.search);

                                displayDecryptedMessage(decrypted);
                                showResult(true, expiresAt);
                            } catch (e) {
                                alert("Failed to decrypt secret with URL key.");
                                revealBtn.disabled = false;
                                revealBtn.textContent = "Reveal Secret Now";
                            }
                        };
                    }
                }
            }
            // CASE 3: Key is in URL hash AND burn_after_reading is false
            // Can decrypt immediately!
            else {
                let pass;
                try {
                    pass = decodeURIComponent(atob(rawHash));
                } catch (e) {
                    pass = decodeURIComponent(rawHash);
                }

                try {
                    let decrypted;
                    try {
                        decrypted = await decryptAESGCM(cipherText, pass);
                    } catch (e1) {
                        decrypted = await decryptAESGCM(cipherText, decodeURIComponent(rawHash));
                    }

                    // Clear hash from URL
                    history.replaceState(null, null, window.location.pathname + window.location.search);

                    displayDecryptedMessage(decrypted);
                    showResult(false, expiresAt);
                } catch (e) {
                    console.error("Auto-decrypt failed:", e);
                    // Fall back to password prompt
                    hideAllStates();
                    if (passwordPromptState) passwordPromptState.style.display = "block";
                }
            }
        } catch (fetchErr) {
            console.error("Error fetching secret:", fetchErr);
            hideAllStates();
            if (unavailableState) unavailableState.style.display = "block";
        }
    }
});

// ----------------- MANUAL DECRYPT BUTTON (WHEN NO ?id=) -----------------
const decryptBtn = document.getElementById("decode");
const emessage = document.getElementById("emessage");
const manualPassword = document.getElementById("ePassword");

if (decryptBtn) {
    decryptBtn.addEventListener("click", async (e) => {
        e.preventDefault();

        const messageText = emessage ? emessage.value.trim() : "";
        const passText = manualPassword ? manualPassword.value.trim() : "";

        if (!messageText) {
            alert("Please paste the ciphertext to decrypt.");
            if (emessage) emessage.focus();
            return;
        }

        try {
            decryptBtn.disabled = true;
            const origText = decryptBtn.innerHTML;
            decryptBtn.innerHTML = '<span class="spinner-ring" style="width:16px;height:16px;margin:0;border-width:2px;display:inline-block;vertical-align:middle;margin-right:8px;"></span> Decrypting…';

            const decryptedMessage = await decryptAESGCM(messageText, passText);

            displayDecryptedMessage(decryptedMessage);

            const card = document.getElementById("card");
            if (card) card.classList.add("result-mode");
            if (modal_container) modal_container.classList.add("show");

            const manualDecryptForm = document.getElementById("manualDecryptForm");
            if (manualDecryptForm) manualDecryptForm.style.display = "none";

            bindModalButtons();
            decryptBtn.disabled = false;
            decryptBtn.innerHTML = origText;
        } catch (error) {
            console.error("Decryption failed:", error);
            alert("Decryption failed. Please check your ciphertext and password.");
            decryptBtn.disabled = false;
            decryptBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Decrypt Secret';
        }
    });
}

// ----------------- MODAL BUTTON BINDINGS -----------------
function bindModalButtons(uid = null) {
    const copyBtns = document.querySelectorAll(".copy-btn");

    copyBtns.forEach(btn => {
        btn.onclick = () => {
            const targetId = btn.getAttribute("data-target");
            const textToCopy = document.getElementById(targetId)?.textContent || "";
            const spanId = btn.getAttribute("data-span");
            const copiedSpan = document.getElementById(spanId);

            navigator.clipboard.writeText(textToCopy).then(() => {
                const originalText = btn.innerHTML;
                btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>Copied';
                if (copiedSpan) copiedSpan.textContent = "Copied!";
                setTimeout(() => {
                    btn.innerHTML = originalText;
                    if (copiedSpan) copiedSpan.textContent = "";
                }, 1600);
            }).catch(err => {
                console.error("Clipboard copy error:", err);
            });
        };
    });
}

// ----------------- NAVIGATION ACTIVE LINK LOGIC -----------------
document.addEventListener("DOMContentLoaded", () => {
    const navLinks = document.querySelectorAll(".nav-link");
    const currentPath = window.location.pathname;

    navLinks.forEach(link => {
        const href = link.getAttribute("href");
        if (currentPath === "/" && href === "/") {
            link.classList.add("active");
        } else if ((currentPath.includes("decoder") || currentPath.includes("decrypter")) && (href.includes("decoder") || href.includes("decrypter"))) {
            link.classList.add("active");
        } else {
            link.classList.remove("active");
        }
    });
});

// ----------------- OPTIONS PILLS & TOGGLES (INDEX PAGE) -----------------
document.addEventListener("DOMContentLoaded", () => {
    // Password pill toggle & eye
    const pwPill = document.getElementById('pwPill');
    const pwInput = document.getElementById('pass');
    const togglePwEye = document.getElementById('togglePwEye');

    if (pwPill && pwInput) {
        pwPill.addEventListener('click', (e) => {
            if (e.target.closest('#togglePwEye')) return;
            pwPill.classList.add('expanded');
            pwInput.focus();
        });

        pwInput.addEventListener('input', () => {
            if (pwInput.value.trim()) {
                pwPill.classList.add('has-password');
            } else {
                pwPill.classList.remove('has-password');
            }
        });

        pwInput.addEventListener('blur', () => {
            if (!pwInput.value.trim()) {
                pwPill.classList.remove('expanded');
                pwPill.classList.remove('has-password');
            }
        });

        if (togglePwEye) {
            togglePwEye.addEventListener('click', (e) => {
                e.stopPropagation();
                if (pwInput.type === "password") {
                    pwInput.type = "text";
                    togglePwEye.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
                } else {
                    pwInput.type = "password";
                    togglePwEye.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
                }
            });
        }
    }

    // Burn toggle pill
    const burnPill = document.getElementById('burnPill');
    const burnToggle = document.getElementById('burnToggle');
    const burnCheckbox = document.getElementById('burnToggleCheckbox');
    const burnLabel = document.getElementById('burnLabel');

    if (burnPill && burnToggle) {
        burnPill.addEventListener('click', () => {
            burnToggle.classList.toggle('on');
            const isOn = burnToggle.classList.contains('on');
            if (burnCheckbox) burnCheckbox.checked = isOn;
            if (burnLabel) {
                burnLabel.textContent = isOn ? "Burn after reading" : "Keep until expiry";
            }
            burnPill.classList.toggle('active', isOn);
        });
    }

    // Expiry change pill listener
    const expirySelect = document.getElementById('expiry');
    const expiryPill = document.getElementById('expiryPill');
    if (expirySelect && expiryPill) {
        expirySelect.addEventListener('change', () => {
            expiryPill.classList.add('active');
            setTimeout(() => expiryPill.classList.remove('active'), 600);
        });
    }
});

// ----------------- TABS: MESSAGE / FILE -----------------
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

        dropzone.addEventListener('click', () => fileInput.click());

        fileInput.addEventListener('change', () => {
            const file = fileInput.files[0];
            if (file) {
                dropzone.querySelector('span').innerHTML = `<span class="browse">${file.name}</span> selected (${Math.round(file.size / 1024)} KB)`;

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

        inputMessage.addEventListener('input', () => runCipherPreview(inputMessage.value));
    }
});

// ----------------- LIVE CIPHER SCRAMBLE SIGNATURE -----------------
const glyphs = '!<>-_\\/[]{}—=+*^?#$%';
let scrambleTimer = null;

function randomGlyphString(len) {
    let s = '';
    for (let i = 0; i < len; i++) s += glyphs[Math.floor(Math.random() * glyphs.length)];
    return s;
}

function runCipherPreview(source) {
    const cipherText = document.getElementById('cipherText');
    if (!cipherText) return;
    clearTimeout(scrambleTimer);
    if (!source) {
        cipherText.textContent = 'waiting for input…';
        return;
    }
    const target = btoa(unescape(encodeURIComponent(source))).slice(0, 40);
    let frame = 0;
    const totalFrames = 10;
    function tick() {
        if (frame >= totalFrames) {
            cipherText.textContent = target + (source.length > 40 ? '…' : '');
            return;
        }
        const revealCount = Math.floor((frame / totalFrames) * target.length);
        let out = target.slice(0, revealCount) + randomGlyphString(Math.max(0, target.length - revealCount));
        cipherText.textContent = out;
        frame++;
        scrambleTimer = setTimeout(tick, 35);
    }
    tick();
}

// ----------------- CRYPTOGRAPHY: AES-GCM & PBKDF2 -----------------
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

    return `${saltBase64}:${ivBase64}:${encryptedBase64}`;
}

async function decryptAESGCM(data, password) {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

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
        { name: "AES-GCM", iv },
        key,
        encrypted
    );

    return decoder.decode(decrypted);
}
