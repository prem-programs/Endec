const modal_container = document.querySelector(".modal-container");
const encryptBtn = document.getElementById("encode");
const inputMessage = document.getElementById("message");
const inputPass = document.getElementById("pass");
const existingResult = modal_container.querySelector("p");

if (encryptBtn) {
    encryptBtn.addEventListener("click", async (e) => {
        e.preventDefault();

        const message = inputMessage.value;
        const pass = inputPass ? inputPass.value : " ";

        if (!message) {
            alert("Please enter a message .");
            return;
        }

        try {
            const resultText = await encryptAESGCM(message, pass); // actual encryption performs from here 
            const encryptedText = resultText;
            console.log(encryptedText)
            const resultElement = modal_container.querySelector("p");
            if (resultElement) {
                resultElement.textContent = encryptedText;
            }

            modal_container.classList.add("show");
            bindModalButtons(encryptedText);

            const data = await fetch('/secret',{
                method :"POST",
                headers :{
                    'Content-Type':'application/json'
                },
                body: JSON.stringify({
                    'message':encryptedText
                })
           });
           const result = await data.json()
           console.log("from backend",result)

        } catch (error) {
            console.log("encryption failed ", error)
        }

    });
}
const emessage = document.getElementById("emessage");
const decryptBtn = document.getElementById("decode");
const password = document.getElementById("ePassword");


if (decryptBtn) {
    decryptBtn.addEventListener("click", async (e) => {
        e.preventDefault();

        const message = emessage.value.trim();
        const pass = password.value.trim();

       
        try {
            const decryptedMessage = await decryptAESGCM(message, pass);

            const resultElement = document.getElementById("dmessage")

            if (resultElement) {
                resultElement.textContent = decryptedMessage;
            }

            console.log("Decrypted:", decryptedMessage);

            modal_container.classList.add("show");

            bindModalButtons(decryptedMessage);

        } catch (error) {
            console.error("Decryption failed:", error);
            alert("Wrong password or corrupted encrypted text");
        }
    });
}


function bindModalButtons(textToCopy) {
    const copyBtn = document.getElementById("copy");
    const copiedSpan = document.getElementById("copiedBtn");
    const closeBtn = document.getElementById("close");


    if (copyBtn) {
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(textToCopy).then(() => {
                if (copiedSpan) {
                    copiedSpan.innerText = "copied!";
                    setTimeout(() => {
                        copiedSpan.innerText = "";
                    }, 1000);
                }
            });
        };
    }

    if (closeBtn) {
        closeBtn.onclick = () => {
            modal_container.classList.remove("show");
        };
    }
}

const buttons = document.querySelectorAll(".switch-btn");
const currentPath = window.location.pathname;
// console.log(currentPath)
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
``
