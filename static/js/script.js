const modal_container = document.querySelector(".modal-container");
const encrypt = document.getElementById("encrypt");
const input = document.getElementById("message");


const existingResult = modal_container.querySelector("p");
if (existingResult && existingResult.textContent.trim()) {
    modal_container.classList.add("show");
    bindModalButtons();
}
encrypt.addEventListener("click", (e) => {
    e.preventDefault();
    const formData = new FormData(document.querySelector("form"));
    const currentUrl = window.location.pathname;

    fetch(currentUrl, {
        method: "POST",
        body: formData,
    })
        .then((res) => res.text())
        .then((html) => {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");
            const newModal = doc.querySelector(".modal-content");
            if (newModal) {
                modal_container.querySelector(".modal-content").innerHTML =
                    newModal.innerHTML;
                bindModalButtons();
            }
            modal_container.classList.add("show");
        });
});

function bindModalButtons() {
    const copyBtn = document.getElementById("copy");
    const copiedSpan = document.getElementById("copiedBtn");
    const closeBtn = document.getElementById("close");
    const resultText = modal_container.querySelector("p");

    if (copyBtn && resultText) {
        copyBtn.addEventListener("click", () => {
            navigator.clipboard.writeText(resultText.textContent.trim());
            copiedSpan.innerText = "copied!";
            setTimeout(() => {
                copiedSpan.innerText = "";
            }, 1000);
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener("click", () => {
            modal_container.classList.remove("show");
        });
    }
}

const buttons = document.querySelectorAll(".switch-btn");


const currentPath = window.location.pathname;
console.log(currentPath)
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