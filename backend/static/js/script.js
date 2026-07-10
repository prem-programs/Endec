const modal_container = document.querySelector(".modal_content");
const encryptBtn = document.getElementById("encode");
const inputMessage = document.getElementById("message");
const inputPass = document.getElementById("pass");
const existingResult = document.getElementById("dmessage")

// Encode the password so special characters don't break the URL
// const shareableLink = `${window.location.origin}/secret/${data.id}#${encodeURIComponent(pass)}`;
if (encryptBtn) {
    encryptBtn.addEventListener("click", async (e) => {
        e.preventDefault();

        const message = inputMessage.dataset.pdfData || inputMessage.value;
        let pass = inputPass.value.trim();

        if (!message) {
            alert("Please enter a message or select a PDF.");
            return;
        }
        if (!pass) {
            const randomBytes = crypto.getRandomValues(new Uint8Array(12));
            pass = btoa(String.fromCharCode(...randomBytes));
        }

        try {
            const resultText = await encryptAESGCM(message, pass); // actual encryption performs from here 
            const encryptedText = resultText;
            let exp = document.getElementById('expiry')

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
            const result = await data.json()

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

                modal_container.classList.add("show");
                bindModalButtons();
            }
        } catch (error) {
            console.log("encryption failed ", error)
        }

    });
}
const emessage = document.getElementById("emessage");
const decryptBtn = document.getElementById("decode");
const password = document.getElementById("ePassword");


function displayDecryptedMessage(decrypted_message) {
    const resultElement = document.getElementById("dmessage");
    if (!resultElement) return;

    if (decrypted_message.startsWith("data:application/pdf;base64,")) {
        resultElement.innerHTML = `
            <div class="pdf-download-container">
                <span class="pdf-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                        <polyline points="10 9 9 9 8 9"></polyline>
                    </svg>
                </span>
                <div class="pdf-info">
                    <span class="pdf-name">Decrypted Document.pdf</span>
                </div>
                <a href="${decrypted_message}" download="decrypted_document.pdf" class="pdf-dl-btn">
                    <span>Download PDF</span>
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

            // user_pass = document.querySelector('#inp_password').textContent
            const pass = atob(decodeURIComponent(hashPass)) // this decodes url ; %20 => space 
            const decrypted_message = await decryptAESGCM(message, pass);

            displayDecryptedMessage(decrypted_message);

            modal_container.classList.add("show");
            bindModalButtons(uid);

            // Clean the URL to hide the password from the address bar
            history.replaceState(null, null, ' ');
        }
    }
})




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

            modal_container.classList.add("show");
            bindModalButtons();

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
                    copiedSpan.innerText = "copied!";
                    setTimeout(() => {
                        copiedSpan.innerText = "";
                    }, 1000);
                }
            });
        };
    });
    if (closeBtn) {
        closeBtn.onclick = () => {
            window.location = "/"
            cleanData(uid);
        };
    }

}

const globalCloseBtn = document.getElementById("close");
if (globalCloseBtn) {
    globalCloseBtn.addEventListener("click", (e) => {
        e.preventDefault();
        modal_container.classList.remove("show");


    });
}

if (modal_container) {
    modal_container.addEventListener("click", (e) => {
        if (e.target === modal_container) {
            modal_container.classList.remove("show");
        }
    });
}
if (modal_container) {
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            modal_container.classList.remove("show");

        }
    })
}

const buttons = document.querySelectorAll(".switch-btn");
const currentPath = window.location.pathname;
buttons.forEach(btn => {
    const mode = btn.dataset.mode.toLowerCase();
    if ((currentPath === "/" && mode === "encrypt") || (currentPath.includes("decoder") && mode === "decrypt")) {
        btn.classList.add("active");
    }


    btn.addEventListener("click", () => {

        if ((currentPath === "/" && mode === "encrypt") || (currentPath.includes("decoder") && mode === "decrypt")) {
            return;
        }


        if (mode === "encrypt") {
            window.location.href = "/";
        } else {
            window.location.href = "/decoder";
        }
    });
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
    const encoder = new TextEncoder()
    const decoder = new TextDecoder()
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



// Advanced Features Toggle Logic
document.addEventListener("DOMContentLoaded", () => {
    const advancedToggle = document.getElementById("advancedToggle");
    const advancedFeatures = document.getElementById("advancedFeatures");

    if (advancedToggle && advancedFeatures) {
        advancedToggle.addEventListener("click", () => {
            advancedToggle.classList.toggle("open");
            if (advancedFeatures.style.display === "none") {
                advancedFeatures.style.display = "flex";
            } else {
                advancedFeatures.style.display = "none";
            }
        });
    }

    // Toggle switch text logic
    const burnToggle = document.getElementById("burnToggle");
    const toggleText = document.querySelector(".toggle-text");
    if (burnToggle && toggleText) {
        burnToggle.addEventListener("change", () => {
            toggleText.textContent = burnToggle.checked ? "ON" : "OFF";
        });
    }
});

// PDF file selection logic
document.addEventListener("DOMContentLoaded", () => {
    const pdfAddBtn = document.getElementById("pdf-add-btn");
    const pdfSelect = document.getElementById("pdf-select");
    const inputMessage = document.getElementById("message");

    if (pdfAddBtn && pdfSelect && inputMessage) {
        pdfAddBtn.addEventListener("click", (e) => {
            e.preventDefault();
            if (pdfAddBtn.classList.contains("active")) {
                // Clear selection
                pdfSelect.value = "";
                inputMessage.value = "";
                inputMessage.readOnly = false;
                delete inputMessage.dataset.pdfData;
                pdfAddBtn.classList.remove("active");
                pdfAddBtn.title = "Add PDF file";
            } else {
                // Trigger select
                pdfSelect.click();
            }
        });

        pdfSelect.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (file) {
                if (file.type !== "application/pdf") {
                    alert("Please select a PDF file.");
                    return;
                }
                const reader = new FileReader();
                reader.onload = (event) => {
                    const dataUrl = event.target.result;
                    inputMessage.value = `[PDF Document: ${file.name} (${Math.round(file.size / 1024)} KB)]`;
                    inputMessage.readOnly = true;
                    inputMessage.dataset.pdfData = dataUrl;
                    pdfAddBtn.classList.add("active");
                    pdfAddBtn.title = "Remove PDF file";
                };
                reader.readAsDataURL(file);
            }
        });
    }
});

