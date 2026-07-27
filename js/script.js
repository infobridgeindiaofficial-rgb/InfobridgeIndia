const menuButton = document.getElementById("menuButton");
const navMenu = document.getElementById("navMenu");
const scrollTopButton = document.getElementById("scrollTop");
const faqQuestions = document.querySelectorAll(".faq-question");
const navLinks = document.querySelectorAll(".nav-menu a");

menuButton.addEventListener("click", () => {
    navMenu.classList.toggle("open");
});

navLinks.forEach((link) => {
    link.addEventListener("click", () => {
        navMenu.classList.remove("open");
    });
});

faqQuestions.forEach((question) => {
    question.addEventListener("click", () => {
        const faqItem = question.parentElement;

        document.querySelectorAll(".faq-item").forEach((item) => {
            if (item !== faqItem) {
                item.classList.remove("active");
            }
        });

        faqItem.classList.toggle("active");
    });
});

window.addEventListener("scroll", () => {
    if (window.scrollY > 450) {
        scrollTopButton.classList.add("show");
    } else {
        scrollTopButton.classList.remove("show");
    }
});

scrollTopButton.addEventListener("click", () => {
    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
});
// ================================
// INFOBRIDGEINDIA GST ENGINE V1
// ================================

const salesInput = document.getElementById("salesReport");
const returnInput = document.getElementById("returnReport");

const validateBtn = document.getElementById("validateBtn");
const generateBtn = document.getElementById("generateBtn");

const statusBox = document.getElementById("statusBox");

if (validateBtn) {

    generateBtn.disabled = true;

    validateBtn.addEventListener("click", () => {

        if (!salesInput.files.length) {
            showStatus("Please select Sales Report.", "error");
            return;
        }

        if (!returnInput.files.length) {
            showStatus("Please select Return Report.", "error");
            return;
        }

        showStatus("Reports validated successfully ✅", "success");

        generateBtn.disabled = false;

    });

    generateBtn.addEventListener("click", () => {

        showStatus("GST Engine will be connected in the next step... ⚙️", "loading");

    });

}
function showStatus(message, type) {

    statusBox.className = "";

    if (type === "success")
        statusBox.classList.add("status-success");

    if (type === "error")
        statusBox.classList.add("status-error");

    if (type === "loading")
        statusBox.classList.add("status-loading");

    statusBox.innerHTML = message;
}