const modal_container = document.querySelector(".modal-container");
const encryptBtn = document.getElementById("encrypt");
const inputMessage = document.getElementById("message");
const inputPass = document.getElementById("pass");
const existingResult = modal_container.querySelector("p");

encrypt.addEventListener("click", async(e) => {
    e.preventDefault();

    const message = inputMessage.value;
    const pass = inputPass ? inputPass.value : "";

    if (!message || !pass) {
        alert("Please enter both a message and a password.");
        return;
    }

    try{
        const resultText = await encryptAESGCM(message, pass);
        const encryptedText = resultText.encrypted;
        console.log(encryptedText)
        const resultElement = modal_container.querySelector("p");
        if (resultElement) {
            resultElement.textContent = encryptedText;
        }

        modal_container.classList.add("show");
        bindModalButtons(encryptedText);
    
    }catch(error){
        console.log("encryption failed ",error)
    }
    
});

function bindModalButtons(textToCopy) {
    const copyBtn = document.getElementById("copy");
    const copiedSpan = document.getElementById("copiedBtn");
    const closeBtn = document.getElementById("close");
   

    if (copyBtn) {
        copyBtn.onclick = ()=>{
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
        closeBtn.onclick= () => {
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
        let binary = "";
        for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    return {
        encrypted: toBase64(new Uint8Array(encrypted))
    };
}

