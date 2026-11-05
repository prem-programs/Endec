const pdfForm = document.getElementById("pdfUploadForm");

if (pdfForm) {
    pdfForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const fileInput = document.getElementById("pdfFile");
        const passInput = document.getElementById("pdfPassword");
        const statusElement = document.getElementById("pdfStatus");

        if (!fileInput.files[0] || !passInput.value.trim()) {
            alert("Please select a PDF file and set a password.");
            return;
        }

        const formData = new FormData();
        formData.append("file", fileInput.files[0]);
        formData.append("password", passInput.value.trim());

        try {
            const response = await fetch('/api/upload-pdf', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (!response.ok || data.error) {
                alert(data.error || "Upload failed.");
                return;
            }

            // Display shareable link in your output modal
            const outputElement = document.getElementById("dmessage");
            if (outputElement) {
                outputElement.textContent = data.link;
            }

            const modalContainer = document.querySelector(".modal-container");
            if (modalContainer) {
                modalContainer.classList.add("show");
            }

            bindModalButtons(data.link);

        } catch (error) {
            console.error("PDF upload failed:", error);
            alert("Network error while uploading PDF.");
        }
    });
}