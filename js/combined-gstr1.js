document.addEventListener("DOMContentLoaded", () => {
    "use strict";

    /*
     * PREVIEW / SHELL ONLY.
     *
     * The combined Meesho + Flipkart GSTR-1 calculation logic and the
     * official GSTN GSTR-1 JSON mapping have not been approved yet.
     * This script intentionally only wires up the upload fields and
     * basic validation. It does not calculate GST, does not build a
     * workbook, and does not produce any Excel or JSON output.
     */

    const meeshoSalesInput = document.getElementById("meeshoSalesReport");
    const meeshoReturnInput = document.getElementById("meeshoReturnReport");
    const flipkartSalesInput = document.getElementById("flipkartSalesReport");
    const flipkartReturnInput = document.getElementById("flipkartReturnReport");

    const validateBtn = document.getElementById("validateBtn");
    const generateBtn = document.getElementById("generateBtn");
    const statusBox = document.getElementById("statusBox");
    const downloadSection = document.getElementById("downloadSection");
    const downloadExcelBtn = document.getElementById("downloadExcelBtn");
    const downloadJsonBtn = document.getElementById("downloadJsonBtn");

    if (
        !meeshoSalesInput ||
        !meeshoReturnInput ||
        !flipkartSalesInput ||
        !flipkartReturnInput ||
        !validateBtn ||
        !generateBtn ||
        !statusBox ||
        !downloadSection ||
        !downloadExcelBtn ||
        !downloadJsonBtn
    ) {
        console.error("Required Combined GSTR-1 page elements were not found.");
        return;
    }

    let filesValidated = false;

    generateBtn.disabled = true;
    downloadExcelBtn.disabled = true;
    downloadJsonBtn.disabled = true;

    [
        meeshoSalesInput,
        meeshoReturnInput,
        flipkartSalesInput,
        flipkartReturnInput
    ].forEach((input) => input.addEventListener("change", resetEngine));

    validateBtn.addEventListener("click", () => {
        resetEngine();

        const meeshoSales = meeshoSalesInput.files[0];
        const meeshoReturn = meeshoReturnInput.files[0];
        const flipkartSales = flipkartSalesInput.files[0];
        const flipkartReturn = flipkartReturnInput.files[0];

        if (!meeshoSales && !flipkartSales) {
            showStatus(
                "Please upload at least one marketplace Sales Report (Meesho or Flipkart).",
                "error"
            );
            return;
        }

        const selectedFiles = [
            meeshoSales,
            meeshoReturn,
            flipkartSales,
            flipkartReturn
        ].filter(Boolean);

        const invalidFile = selectedFiles.find(
            (file) => !isExcelFile(file.name)
        );

        if (invalidFile) {
            showStatus(
                "Only .xlsx and .xls files are supported.",
                "error"
            );
            return;
        }

        filesValidated = true;
        generateBtn.disabled = false;

        showStatus(
            `
            <strong>Files received.</strong>
            <br><br>
            Meesho Sales: <strong>${meeshoSales ? escapeHtml(meeshoSales.name) : "Not provided"}</strong>
            <br>
            Meesho Return: <strong>${meeshoReturn ? escapeHtml(meeshoReturn.name) : "Not provided"}</strong>
            <br>
            Flipkart Sales: <strong>${flipkartSales ? escapeHtml(flipkartSales.name) : "Not provided"}</strong>
            <br>
            Flipkart Return: <strong>${flipkartReturn ? escapeHtml(flipkartReturn.name) : "Not provided"}</strong>
            <br><br>
            The Combined GSTR-1 calculation engine is still in development, so no report can be
            generated yet. This preview confirms your files are recognised and ready for when the
            feature is released.
            `,
            "success"
        );
    });

    generateBtn.addEventListener("click", () => {
        if (!filesValidated) {
            showStatus(
                "Validate your reports before generating the Combined GSTR-1.",
                "error"
            );
            return;
        }

        showStatus(
            "Combined GSTR-1 generation is coming soon. The calculation logic and official GSTN " +
            "GSTR-1 JSON mapping have not been approved yet, so no report has been generated.",
            "error"
        );
    });

    function resetEngine() {
        filesValidated = false;
        generateBtn.disabled = true;

        downloadSection.hidden = true;
        downloadExcelBtn.disabled = true;
        downloadJsonBtn.disabled = true;

        statusBox.className = "";
        statusBox.innerHTML = "";
        statusBox.style.display = "none";
    }

    function showStatus(message, type) {
        statusBox.className = "";

        if (type === "success") {
            statusBox.classList.add("status-success");
        } else if (type === "error") {
            statusBox.classList.add("status-error");
        } else {
            statusBox.classList.add("status-loading");
        }

        statusBox.innerHTML = message;
        statusBox.style.display = "block";
        statusBox.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    function isExcelFile(fileName) {
        return /\.(xlsx|xls)$/i.test(fileName);
    }

    function escapeHtml(value) {
        const element = document.createElement("div");
        element.textContent = String(value);
        return element.innerHTML;
    }
});
