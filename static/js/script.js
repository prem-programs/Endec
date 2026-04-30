const modal_container = document.querySelector(".modal-container");
const encrypt = document.getElementById("encrypt");
const input = document.getElementById("message");

// Auto-show modal if server rendered a result (page reload after POST)
const existingResult = modal_container.querySelector("p");
if (existingResult && existingResult.textContent.trim()) {
    modal_container.classList.add("show");
    bindModalButtons();
}

// Handle form submission via fetch (no page reload)
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

// Bind copy & close buttons inside the modal
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
