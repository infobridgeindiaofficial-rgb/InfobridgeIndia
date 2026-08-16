document.addEventListener("DOMContentLoaded", () => {
    "use strict";

    /*
     * COMBINED MEESHO + FLIPKART GSTR-1 GENERATOR
     *
     * This file is independent of js/meesho.js and js/flipkart.js (those
     * files are not modified and not imported - everything needed here is
     * ported from their already-working column lists / state tables /
     * calculation rules). It builds ONE normalized transaction list from
     * whichever marketplace reports are supplied, then derives B2CS / HSN /
     * ECO groupings from that single list. Both the Excel workbook and the
     * GSTR-1 JSON are produced from those same grouped objects, so the two
     * outputs cannot disagree with each other.
     *
     * JSON output follows the structure of the reference GSTR-1 JSON file
     * supplied for this feature (top-level gstin/fp/version/hash/b2cs/hsn/
     * nil/supeco/doc_issue). "nil" and "doc_issue" cannot be populated from
     * Meesho/Flipkart marketplace reports (no nil-rated classification and
     * no self-maintained tax invoice series is present in either report),
     * so they are emitted using the schema's own valid empty/zero shape
     * rather than invented values.
     */

    const meeshoSalesInput = document.getElementById("meeshoSalesReport");
    const meeshoReturnInput = document.getElementById("meeshoReturnReport");
    const flipkartSalesInput = document.getElementById("flipkartSalesReport");
    const flipkartReturnInput = document.getElementById("flipkartReturnReport");
    const gstinInput = document.getElementById("combinedGSTIN");
    const periodInput = document.getElementById("combinedFilingPeriod");

    const validateBtn = document.getElementById("validateBtn");
    const generateBtn = document.getElementById("generateBtn");
    const statusBox = document.getElementById("statusBox");
    const downloadSection = document.getElementById("downloadSection");
    const downloadExcelBtn = document.getElementById("downloadExcelBtn");
    const downloadJsonBtn = document.getElementById("downloadJsonBtn");

    if (
        !meeshoSalesInput || !meeshoReturnInput ||
        !flipkartSalesInput || !flipkartReturnInput ||
        !gstinInput || !periodInput ||
        !validateBtn || !generateBtn || !statusBox ||
        !downloadSection || !downloadExcelBtn || !downloadJsonBtn
    ) {
        console.error("Required Combined GSTR-1 page elements were not found.");
        return;
    }

    /* ---------------------------------------------------------------
       CONFIG (ported from js/meesho.js and js/flipkart.js)
       --------------------------------------------------------------- */

    const MEESHO_SALES_REQUIRED = [
        "sub_order_num", "order_date", "hsn_code", "gst_rate",
        "total_taxable_sale_value", "end_customer_state_new"
    ];

    const MEESHO_RETURN_REQUIRED = [
        "sub_order_num", "cancel_return_date", "hsn_code", "gst_rate",
        "total_taxable_sale_value", "end_customer_state_new"
    ];

    const MEESHO_DEFAULT_ECO_GSTIN = "33AARCM9332R1CV";

    const FLIPKART_REQUIRED = [
        "seller_gstin", "order_id", "order_item_id", "hsn_code", "event_type",
        "order_date", "item_quantity", "taxable_value_final_invoice_amount_taxes",
        "igst_rate", "igst_amount", "cgst_rate", "cgst_amount",
        "sgst_rate_or_utgst_as_applicable", "sgst_amount_or_utgst_as_applicable",
        "customer_s_delivery_state"
    ];

    const FLIPKART_ECO_BY_STATE = {
        "33": { gstin: "33AACCF0683K1CZ", tradeName: "FLIPKART INTERNET PRIVATE LIMITED" }
    };

    const STATE_CODES = {
        "JAMMU AND KASHMIR": "01", "HIMACHAL PRADESH": "02", "PUNJAB": "03",
        "CHANDIGARH": "04", "UTTARAKHAND": "05", "HARYANA": "06", "DELHI": "07",
        "RAJASTHAN": "08", "UTTAR PRADESH": "09", "BIHAR": "10", "SIKKIM": "11",
        "ARUNACHAL PRADESH": "12", "NAGALAND": "13", "MANIPUR": "14",
        "MIZORAM": "15", "TRIPURA": "16", "MEGHALAYA": "17", "ASSAM": "18",
        "WEST BENGAL": "19", "JHARKHAND": "20", "ODISHA": "21",
        "CHHATTISGARH": "22", "MADHYA PRADESH": "23", "GUJARAT": "24",
        "DADRA AND NAGAR HAVELI AND DAMAN AND DIU": "26", "MAHARASHTRA": "27",
        "KARNATAKA": "29", "GOA": "30", "LAKSHADWEEP": "31", "KERALA": "32",
        "TAMIL NADU": "33", "PUDUCHERRY": "34",
        "ANDAMAN AND NICOBAR ISLANDS": "35", "TELANGANA": "36",
        "ANDHRA PRADESH": "37", "LADAKH": "38", "OTHER TERRITORY": "97",
        "CENTRE JURISDICTION": "99"
    };

    const STATE_ALIASES = {
        "ANDAMAN & NICOBAR ISLANDS": "ANDAMAN AND NICOBAR ISLANDS",
        "ANDAMAN NICOBAR": "ANDAMAN AND NICOBAR ISLANDS",
        "ANDHRA": "ANDHRA PRADESH",
        "ARUNACHAL": "ARUNACHAL PRADESH",
        "CHATTISGARH": "CHHATTISGARH",
        "DADRA & NAGAR HAVELI AND DAMAN & DIU": "DADRA AND NAGAR HAVELI AND DAMAN AND DIU",
        "DADRA AND NAGAR HAVELI": "DADRA AND NAGAR HAVELI AND DAMAN AND DIU",
        "DAMAN AND DIU": "DADRA AND NAGAR HAVELI AND DAMAN AND DIU",
        "JAMMU & KASHMIR": "JAMMU AND KASHMIR",
        "NEW DELHI": "DELHI",
        "ORISSA": "ODISHA",
        "PONDICHERRY": "PUDUCHERRY",
        "TAMILNADU": "TAMIL NADU",
        "UTTARANCHAL": "UTTARAKHAND",
        "WESTBENGAL": "WEST BENGAL"
    };

    /* ---------------------------------------------------------------
       STATE
       --------------------------------------------------------------- */

    let validated = false;
    let combinedTransactions = [];
    let validationWarnings = [];
    let resolvedGSTIN = "";
    let resolvedPeriod = { fp: "", label: "" };
    let lastWorkbook = null;
    let lastExcelFileName = "";
    let lastJson = null;
    let lastJsonFileName = "";

    generateBtn.disabled = true;

    [
        meeshoSalesInput, meeshoReturnInput,
        flipkartSalesInput, flipkartReturnInput
    ].forEach((input) => input.addEventListener("change", resetEngine));

    [gstinInput, periodInput].forEach((input) => {
        input.addEventListener("input", resetEngine);
        input.addEventListener("change", resetEngine);
    });

    /* ---------------------------------------------------------------
       VALIDATE
       --------------------------------------------------------------- */

    validateBtn.addEventListener("click", async () => {
        try {
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

            const selectedFiles = [meeshoSales, meeshoReturn, flipkartSales, flipkartReturn]
                .filter(Boolean);

            const invalidFile = selectedFiles.find((file) => !isExcelFile(file.name));

            if (invalidFile) {
                showStatus("Only .xlsx and .xls files are supported.", "error");
                return;
            }

            const duplicateName = findDuplicateFile(selectedFiles);

            if (duplicateName) {
                showStatus(
                    `"${escapeHtml(duplicateName)}" appears to be selected in more than one upload field. Please choose the correct file for each field.`,
                    "error"
                );
                return;
            }

            const gstin = normalizeGSTIN(gstinInput.value);

            if (!gstin) {
                showStatus(
                    "Please enter a valid 15-character GSTIN (e.g. 33AACCF0683K1CZ).",
                    "error"
                );
                return;
            }

            const period = toFilingPeriod(periodInput.value);

            if (!period) {
                showStatus("Please select the filing period (month and year).", "error");
                return;
            }

            if (typeof XLSX === "undefined") {
                showStatus(
                    "The Excel processing library could not be loaded. Check your internet connection and try again.",
                    "error"
                );
                return;
            }

            validateBtn.disabled = true;
            showStatus("Validating Meesho and Flipkart reports...", "loading");

            const supplierStateCode = gstin.slice(0, 2);
            const warnings = [];
            const transactions = [];
            let meeshoSalesCount = 0;
            let meeshoReturnCount = 0;
            let flipkartSalesCount = 0;
            let flipkartReturnCount = 0;

            if (meeshoSales) {
                const salesResult = await readBestSheet(meeshoSales);
                const salesRows = normalizeRows(salesResult.rows);
                validateColumns(salesRows, MEESHO_SALES_REQUIRED, "Meesho Sales");
                warnings.push(...checkNumericColumn(salesRows, "total_taxable_sale_value", "Meesho Sales"));

                let returnRows = [];
                if (meeshoReturn) {
                    const returnResult = await readBestSheet(meeshoReturn);
                    returnRows = normalizeRows(returnResult.rows);
                    validateColumns(returnRows, MEESHO_RETURN_REQUIRED, "Meesho Return");
                    warnings.push(...checkNumericColumn(returnRows, "total_taxable_sale_value", "Meesho Return"));
                }

                const meeshoTx = [
                    ...salesRows.map((row) => prepareMeeshoTransaction(row, "SALE", supplierStateCode)),
                    ...returnRows.map((row) => prepareMeeshoTransaction(row, "RETURN", supplierStateCode))
                ].filter(isUsableTransaction);

                if (!meeshoTx.length) {
                    throw new Error("The Meesho reports do not contain usable transaction rows.");
                }

                resolveMeeshoEcoGSTIN(meeshoTx);

                meeshoSalesCount = meeshoTx.filter((t) => t.type === "SALE").length;
                meeshoReturnCount = meeshoTx.filter((t) => t.type === "RETURN").length;
                transactions.push(...meeshoTx);
            }

            if (flipkartSales) {
                const salesResult = await readFlipkartSheet(flipkartSales);
                const salesRows = normalizeRows(salesResult.rows);
                validateFlipkartColumns(salesRows);
                warnings.push(...checkNumericColumn(salesRows, "taxable_value_final_invoice_amount_taxes", "Flipkart Sales"));

                let returnRows = [];
                if (flipkartReturn) {
                    const returnResult = await readFlipkartSheet(flipkartReturn);
                    returnRows = normalizeRows(returnResult.rows);
                    warnings.push(...checkNumericColumn(returnRows, "taxable_value_final_invoice_amount_taxes", "Flipkart Return"));
                }

                const flipkartTx = [
                    ...salesRows.map((row, i) => prepareFlipkartTransaction(row, i + 2, supplierStateCode)),
                    ...returnRows.map((row, i) => prepareFlipkartTransaction(row, i + 2, supplierStateCode))
                ].filter(Boolean);

                if (!flipkartTx.length) {
                    throw new Error("The Flipkart reports do not contain usable Sale or Return transactions.");
                }

                resolveFlipkartEcoGSTIN(flipkartTx);

                flipkartSalesCount = flipkartTx.filter((t) => t.type === "SALE").length;
                flipkartReturnCount = flipkartTx.filter((t) => t.type === "RETURN").length;
                transactions.push(...flipkartTx);
            }

            combinedTransactions = transactions;
            validationWarnings = warnings;
            resolvedGSTIN = gstin;
            resolvedPeriod = period;
            validated = true;

            generateBtn.disabled = false;

            const warningHtml = warnings.length
                ? `<br>⚠ ${warnings.length} row(s) had a non-numeric value and were treated as ₹0. Please double check the source file(s).`
                : "";

            showStatus(
                `
                <strong>Reports validated successfully.</strong>
                <br><br>
                Meesho: <strong>${meeshoSalesCount} sale row(s), ${meeshoReturnCount} return row(s)</strong>
                <br>
                Flipkart: <strong>${flipkartSalesCount} sale row(s), ${flipkartReturnCount} return row(s)</strong>
                <br><br>
                GSTIN: <strong>${escapeHtml(gstin)}</strong>
                <br>
                Filing period: <strong>${escapeHtml(period.label)} (${escapeHtml(period.fp)})</strong>
                ${warningHtml}
                <br><br>
                Ready to generate the Combined GSTR-1.
                `,
                "success"
            );
        } catch (error) {
            console.error(error);
            generateBtn.disabled = true;
            showStatus(error.message || "The reports could not be validated.", "error");
        } finally {
            validateBtn.disabled = false;
        }
    });

    /* ---------------------------------------------------------------
       GENERATE
       --------------------------------------------------------------- */

    generateBtn.addEventListener("click", () => {
        try {
            if (!validated || !combinedTransactions.length) {
                showStatus("Validate your reports before generating the Combined GSTR-1.", "error");
                return;
            }

            generateBtn.disabled = true;
            downloadSection.hidden = true;
            downloadExcelBtn.disabled = true;
            downloadJsonBtn.disabled = true;
            lastWorkbook = null;
            lastJson = null;

            showStatus("Preparing the Combined GST report...", "loading");

            const b2cGroups = groupB2C(combinedTransactions);
            const hsnGroups = groupHSN(combinedTransactions);
            const ecoGroups = groupECO(combinedTransactions);

            const summary = combinedTransactions.reduce(
                (total, tx) => {
                    total.netTaxable += tx.taxableValue;
                    total.netIGST += tx.igst;
                    total.netCGST += tx.cgst;
                    total.netSGST += tx.sgst;
                    total.netCess += tx.cess;
                    return total;
                },
                { netTaxable: 0, netIGST: 0, netCGST: 0, netSGST: 0, netCess: 0 }
            );

            Object.keys(summary).forEach((key) => { summary[key] = round2(summary[key]); });

            const marketplaceOverview = buildMarketplaceOverview(combinedTransactions);

            const workbook = buildWorkbook(b2cGroups, hsnGroups, ecoGroups, marketplaceOverview);
            const gstr1Json = buildGstr1Json(b2cGroups, hsnGroups, ecoGroups, resolvedGSTIN, resolvedPeriod.fp);

            const safePeriod = resolvedPeriod.fp || "period";

            lastWorkbook = workbook;
            lastExcelFileName = `InfoBridgeIndia_Combined_GSTR1_${safePeriod}.xlsx`;

            lastJson = gstr1Json;
            lastJsonFileName = `GSTR1_returns_${resolvedGSTIN}_monthly_${safePeriod}.json`;

            downloadSection.hidden = false;
            downloadExcelBtn.disabled = false;
            downloadJsonBtn.disabled = false;

            showStatus(
                `
                <div class="result-heading">
                    <span class="result-check">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                    </span>
                    Combined GSTR-1 Ready
                </div>
                <div class="result-rows">
                    <div class="result-row"><span>Net Taxable Value</span><strong>₹${formatMoney(summary.netTaxable)}</strong></div>
                    <div class="result-row"><span>IGST</span><strong>₹${formatMoney(summary.netIGST)}</strong></div>
                    <div class="result-row"><span>CGST</span><strong>₹${formatMoney(summary.netCGST)}</strong></div>
                    <div class="result-row"><span>SGST</span><strong>₹${formatMoney(summary.netSGST)}</strong></div>
                </div>
                `,
                "success"
            );
        } catch (error) {
            console.error(error);
            downloadSection.hidden = true;
            downloadExcelBtn.disabled = true;
            downloadJsonBtn.disabled = true;
            lastWorkbook = null;
            lastJson = null;
            showStatus(error.message || "The Combined GSTR-1 could not be generated.", "error");
        } finally {
            generateBtn.disabled = false;
        }
    });

    downloadExcelBtn.addEventListener("click", () => {
        if (!lastWorkbook || !lastExcelFileName) {
            showStatus("Generate the Combined GSTR-1 before downloading.", "error");
            return;
        }
        XLSX.writeFile(lastWorkbook, lastExcelFileName);
    });

    downloadJsonBtn.addEventListener("click", () => {
        if (!lastJson || !lastJsonFileName) {
            showStatus("Generate the Combined GSTR-1 before downloading.", "error");
            return;
        }
        downloadJsonFile(lastJsonFileName, lastJson);
    });

    /* ---------------------------------------------------------------
       FILE READING
       --------------------------------------------------------------- */

    async function readBestSheet(file) {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array", cellDates: true });

        if (!workbook.SheetNames.length) {
            throw new Error(`${file.name} does not contain a worksheet.`);
        }

        let selectedSheetName = workbook.SheetNames[0];
        let selectedRows = [];

        workbook.SheetNames.forEach((sheetName) => {
            const worksheet = workbook.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "", raw: true });
            if (rows.length > selectedRows.length) {
                selectedSheetName = sheetName;
                selectedRows = rows;
            }
        });

        if (!selectedRows.length) {
            throw new Error(`${file.name} does not contain data rows.`);
        }

        return { sheetName: selectedSheetName, rows: selectedRows };
    }

    async function readFlipkartSheet(file) {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array", cellDates: true });

        if (!workbook.SheetNames.length) {
            throw new Error(`${file.name} does not contain a worksheet.`);
        }

        const preferredName = workbook.SheetNames.find(
            (name) => normalizeKey(name) === "sales_report"
        );

        const sheetName = preferredName || workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "", raw: true });

        if (!rows.length) {
            throw new Error(`${file.name} does not contain data rows.`);
        }

        return { sheetName, rows };
    }

    function normalizeRows(rows) {
        return rows.map((row) => {
            const normalized = {};
            Object.keys(row).forEach((key) => { normalized[normalizeKey(key)] = row[key]; });
            return normalized;
        });
    }

    function normalizeKey(value) {
        return String(value)
            .trim()
            .toLowerCase()
            .replace(/&/g, "and")
            .replace(/[^a-z0-9]+/g, "_")
            .replace(/^_+|_+$/g, "");
    }

    function validateColumns(rows, requiredColumns, reportName) {
        if (!rows.length) {
            throw new Error(`The ${reportName} Report does not contain data rows.`);
        }

        const availableColumns = new Set();
        rows.slice(0, 20).forEach((row) => {
            Object.keys(row).forEach((column) => availableColumns.add(column));
        });

        const missing = requiredColumns.filter((column) => !availableColumns.has(column));

        if (missing.length) {
            throw new Error(`Wrong ${reportName} Report. Missing columns: ${missing.join(", ")}`);
        }
    }

    function validateFlipkartColumns(rows) {
        if (!rows.length) {
            throw new Error("The Flipkart Report does not contain data rows.");
        }

        const availableColumns = new Set();
        rows.slice(0, 20).forEach((row) => {
            Object.keys(row).forEach((column) => availableColumns.add(column));
        });

        const missing = FLIPKART_REQUIRED.filter((column) => !availableColumns.has(column));

        if (missing.length) {
            throw new Error(`Wrong Flipkart Report. Missing columns: ${missing.join(", ")}`);
        }

        const usableRows = rows.filter((row) => {
            const eventType = cleanText(row.event_type).toUpperCase();
            return eventType === "SALE" || eventType === "RETURN";
        });

        if (!usableRows.length) {
            throw new Error("No usable Sale or Return transactions were found in the Flipkart Report.");
        }
    }

    function checkNumericColumn(rows, column, reportName) {
        const warnings = [];
        rows.forEach((row) => {
            const raw = row[column];
            const text = cleanText(raw).toLowerCase();
            if (text === "" || text === "0" || text === "nil" || text === "na" || text === "n/a") return;
            if (toNumber(raw) === 0 && !/^-?0(\.0+)?$/.test(text)) {
                if (Number.isNaN(Number(String(raw).replace(/[₹,\s]/g, "")))) {
                    warnings.push(`${reportName}: non-numeric ${column}`);
                }
            }
        });
        return warnings;
    }

    function findDuplicateFile(files) {
        const seen = new Set();
        for (const file of files) {
            const key = `${file.name.toLowerCase()}|${file.size}`;
            if (seen.has(key)) return file.name;
            seen.add(key);
        }
        return null;
    }

    /* ---------------------------------------------------------------
       MEESHO TRANSACTION PREP (ported from js/meesho.js)
       --------------------------------------------------------------- */

    function prepareMeeshoTransaction(row, type, supplierStateCode) {
        const gstRate = round2(Math.abs(toNumber(row.gst_rate)));
        const absTaxable = Math.abs(toNumber(row.total_taxable_sale_value));

        const state = normalizeStateName(
            cleanText(row.end_customer_state_new) ||
            cleanText(row.place_of_supply) ||
            cleanText(row.customer_state)
        );
        const stateCode = getStateCode(state);

        let igst = Math.abs(toNumber(firstValue(row, ["igst", "igst_amount", "integrated_tax"])));
        let cgst = Math.abs(toNumber(firstValue(row, ["cgst", "cgst_amount", "central_tax"])));
        let sgst = Math.abs(toNumber(firstValue(row, ["sgst", "sgst_amount", "utgst", "utgst_amount", "state_tax"])));
        let cess = Math.abs(toNumber(firstValue(row, ["cess", "cess_amount"])));
        const reportTax = Math.abs(toNumber(firstValue(row, ["tax_amount", "total_tax_amount", "total_gst_amount", "gst_amount"])));
        const hasComponentTax = (igst + cgst + sgst + cess) > 0;

        const intra = isIntraStateMeesho(row, state, stateCode, supplierStateCode);

        if (!hasComponentTax && gstRate > 0 && absTaxable !== 0) {
            const computedTax = reportTax !== 0 ? reportTax : (absTaxable * gstRate / 100);
            if (intra) {
                cgst = computedTax / 2;
                sgst = computedTax / 2;
                igst = 0;
            } else {
                igst = computedTax;
                cgst = 0;
                sgst = 0;
            }
        }

        const quantityRaw = Math.abs(toNumber(firstValue(row, [
            "quantity", "qty", "item_quantity", "ordered_quantity", "product_quantity"
        ]))) || 1;

        const sign = type === "RETURN" ? -1 : 1;

        const ecoGSTIN = normalizeGSTIN(firstValue(row, [
            "eco_tcs_gstin", "ecommerce_gstin", "e_commerce_gstin",
            "e_commerce_operator_gstin", "eco_gstin", "operator_gstin", "marketplace_gstin"
        ])) || MEESHO_DEFAULT_ECO_GSTIN;

        const invoiceNumber = cleanText(firstValue(row, [
            "invoice_number", "invoice_no", "supplier_invoice_number", "tax_invoice_number"
        ]));

        const subOrderNumber = cleanText(row.sub_order_num);
        const uqcRaw = cleanText(firstValue(row, ["uqc", "unit", "unit_of_measurement"])) || "NOS-NUMBERS";

        return {
            marketplace: "MEESHO",
            type,
            documentNumber: invoiceNumber || subOrderNumber,
            orderDate: parseReportDate(row.order_date) || parseReportDate(row.cancel_return_date),
            hsnCode: cleanText(row.hsn_code),
            uqcLong: uqcRaw,
            uqcShort: shortUQC(uqcRaw),
            gstRate,
            supplyType: intra ? "INTRA" : "INTER",
            stateCode: stateCode || "",
            state: state || "Unknown",
            quantity: round2(sign * quantityRaw),
            taxableValue: round2(sign * absTaxable),
            igst: round2(sign * igst),
            cgst: round2(sign * cgst),
            sgst: round2(sign * sgst),
            cess: round2(sign * cess),
            ecoGSTIN,
            ecoTradeName: "MEESHO"
        };
    }

    function isIntraStateMeesho(row, customerState, customerStateCode, supplierStateCode) {
        const supplierStateFromRow = normalizeStateName(
            firstValue(row, ["supplier_state", "seller_state", "gstin_state", "merchant_state"])
        );

        if (supplierStateFromRow && customerState) {
            return supplierStateFromRow === customerState;
        }

        const rowGSTIN = cleanText(
            firstValue(row, ["gstin", "seller_gstin", "supplier_gstin", "merchant_gstin"])
        ).toUpperCase().replace(/\s+/g, "");

        const rowSupplierStateCode = /^\d{2}/.test(rowGSTIN) ? rowGSTIN.slice(0, 2) : "";

        if (rowSupplierStateCode && customerStateCode) {
            return rowSupplierStateCode === customerStateCode;
        }

        if (supplierStateCode && customerStateCode) {
            return supplierStateCode === customerStateCode;
        }

        return customerStateCode === "33";
    }

    function resolveMeeshoEcoGSTIN(transactions) {
        const resolved = transactions.map((t) => t.ecoGSTIN).find(Boolean) || MEESHO_DEFAULT_ECO_GSTIN;
        transactions.forEach((t) => { t.ecoGSTIN = resolved; t.ecoTradeName = "MEESHO"; });
    }

    function isUsableTransaction(tx) {
        return Boolean(
            tx.documentNumber || tx.hsnCode ||
            tx.taxableValue !== 0 || tx.igst !== 0 || tx.cgst !== 0 || tx.sgst !== 0
        );
    }

    /* ---------------------------------------------------------------
       FLIPKART TRANSACTION PREP (ported from js/flipkart.js)
       --------------------------------------------------------------- */

    function prepareFlipkartTransaction(row, sourceRow, supplierStateCode) {
        const eventType = cleanText(row.event_type).toUpperCase();

        if (eventType !== "SALE" && eventType !== "RETURN") {
            return null;
        }

        const absTaxable = Math.abs(toNumber(row.taxable_value_final_invoice_amount_taxes));
        const igst = Math.abs(toNumber(row.igst_amount));
        const cgst = Math.abs(toNumber(row.cgst_amount));
        const sgst = Math.abs(toNumber(row.sgst_amount_or_utgst_as_applicable));
        const cess = Math.abs(toNumber(firstValue(row, ["luxury_cess_amount", "cess_amount"])));

        const gstRate = detectFlipkartGSTRate(row);
        const state = normalizeStateName(row.customer_s_delivery_state);
        const stateCode = getStateCode(state);
        const quantity = Math.abs(toNumber(row.item_quantity)) || 1;

        const rowSellerGSTIN = normalizeGSTIN(row.seller_gstin);
        const sellerStateCode = rowSellerGSTIN ? rowSellerGSTIN.slice(0, 2) : (supplierStateCode || "");

        let supplyType;
        if (igst > 0 && cgst === 0 && sgst === 0) {
            supplyType = "INTER";
        } else if ((cgst > 0 || sgst > 0) && igst === 0) {
            supplyType = "INTRA";
        } else {
            supplyType = (sellerStateCode && stateCode && sellerStateCode === stateCode) ? "INTRA" : "INTER";
        }

        const sign = eventType === "RETURN" ? -1 : 1;

        return {
            marketplace: "FLIPKART",
            type: eventType,
            documentNumber: cleanText(row.buyer_invoice_id) || cleanText(row.order_item_id) || cleanText(row.order_id),
            orderDate: parseReportDate(row.order_date),
            hsnCode: cleanText(row.hsn_code),
            uqcLong: "NOS-NUMBERS",
            uqcShort: "NOS",
            gstRate,
            supplyType,
            stateCode: stateCode || "",
            state: state || "Unknown",
            quantity: round2(sign * quantity),
            taxableValue: round2(sign * absTaxable),
            igst: round2(sign * igst),
            cgst: round2(sign * cgst),
            sgst: round2(sign * sgst),
            cess: round2(sign * cess),
            sellerStateCode,
            ecoGSTIN: "",
            ecoTradeName: ""
        };
    }

    function detectFlipkartGSTRate(row) {
        const igstRate = Math.abs(toNumber(row.igst_rate));
        const cgstRate = Math.abs(toNumber(row.cgst_rate));
        const sgstRate = Math.abs(toNumber(row.sgst_rate_or_utgst_as_applicable));

        if (igstRate > 0) return round2(igstRate);
        if (cgstRate > 0 || sgstRate > 0) return round2(cgstRate + sgstRate);
        return 0;
    }

    function resolveFlipkartEcoGSTIN(transactions) {
        const sellerStateCode = transactions.map((t) => t.sellerStateCode).find(Boolean) || "";
        const operator = FLIPKART_ECO_BY_STATE[sellerStateCode];

        if (!operator) {
            throw new Error(
                "Flipkart ECO GSTIN is not configured for this seller state. Please contact InfoBridgeIndia before filing the ECO section."
            );
        }

        transactions.forEach((t) => {
            t.ecoGSTIN = operator.gstin;
            t.ecoTradeName = operator.tradeName;
        });
    }

    /* ---------------------------------------------------------------
       GROUPING (shared - drives both Excel and JSON)
       --------------------------------------------------------------- */

    function groupB2C(transactions) {
        const groups = new Map();

        transactions.forEach((tx) => {
            const key = `${tx.supplyType}|${tx.gstRate}|${tx.stateCode}|${tx.state}`;
            if (!groups.has(key)) {
                groups.set(key, {
                    supplyType: tx.supplyType, gstRate: tx.gstRate,
                    stateCode: tx.stateCode, state: tx.state,
                    taxableValue: 0, igst: 0, cgst: 0, sgst: 0, cess: 0
                });
            }
            const g = groups.get(key);
            g.taxableValue += tx.taxableValue;
            g.igst += tx.igst;
            g.cgst += tx.cgst;
            g.sgst += tx.sgst;
            g.cess += tx.cess;
        });

        return Array.from(groups.values())
            .map((g) => ({
                ...g,
                taxableValue: round2(g.taxableValue),
                igst: round2(g.igst),
                cgst: round2(g.cgst),
                sgst: round2(g.sgst),
                cess: round2(g.cess)
            }))
            .filter((g) => [g.taxableValue, g.igst, g.cgst, g.sgst].some((v) => Math.abs(v) >= 0.01))
            .sort((a, b) => (a.stateCode.localeCompare(b.stateCode) || a.gstRate - b.gstRate));
    }

    function groupHSN(transactions) {
        const groups = new Map();

        transactions.forEach((tx) => {
            const key = `${tx.hsnCode}|${tx.gstRate}|${tx.uqcShort}`;
            if (!groups.has(key)) {
                groups.set(key, {
                    hsnCode: tx.hsnCode, uqcLong: tx.uqcLong, uqcShort: tx.uqcShort,
                    gstRate: tx.gstRate, quantity: 0, taxableValue: 0,
                    igst: 0, cgst: 0, sgst: 0, cess: 0
                });
            }
            const g = groups.get(key);
            g.quantity += tx.quantity;
            g.taxableValue += tx.taxableValue;
            g.igst += tx.igst;
            g.cgst += tx.cgst;
            g.sgst += tx.sgst;
            g.cess += tx.cess;
        });

        return Array.from(groups.values())
            .map((g) => ({
                ...g,
                quantity: round2(g.quantity),
                taxableValue: round2(g.taxableValue),
                igst: round2(g.igst),
                cgst: round2(g.cgst),
                sgst: round2(g.sgst),
                cess: round2(g.cess)
            }))
            .filter((g) => [g.quantity, g.taxableValue, g.igst, g.cgst, g.sgst].some((v) => Math.abs(v) >= 0.01))
            .sort((a, b) => (
                String(a.hsnCode).localeCompare(String(b.hsnCode), undefined, { numeric: true }) ||
                a.gstRate - b.gstRate
            ));
    }

    function groupECO(transactions) {
        const groups = new Map();

        transactions.forEach((tx) => {
            if (!tx.ecoGSTIN) return;
            const key = tx.ecoGSTIN;
            if (!groups.has(key)) {
                groups.set(key, {
                    ecoGSTIN: tx.ecoGSTIN, tradeName: tx.ecoTradeName || tx.marketplace,
                    taxableValue: 0, igst: 0, cgst: 0, sgst: 0, cess: 0
                });
            }
            const g = groups.get(key);
            g.taxableValue += tx.taxableValue;
            g.igst += tx.igst;
            g.cgst += tx.cgst;
            g.sgst += tx.sgst;
            g.cess += tx.cess;
        });

        return Array.from(groups.values())
            .map((g) => ({
                ...g,
                taxableValue: round2(g.taxableValue),
                igst: round2(g.igst),
                cgst: round2(g.cgst),
                sgst: round2(g.sgst),
                cess: round2(g.cess)
            }))
            .filter((g) => [g.taxableValue, g.igst, g.cgst, g.sgst, g.cess].some((v) => Math.abs(v) >= 0.01))
            .sort((a, b) => a.ecoGSTIN.localeCompare(b.ecoGSTIN));
    }

    function buildMarketplaceOverview(transactions) {
        const byMarketplace = { MEESHO: makeOverviewRow(), FLIPKART: makeOverviewRow() };

        transactions.forEach((tx) => {
            const row = byMarketplace[tx.marketplace];
            if (!row) return;
            if (tx.type === "SALE") row.salesRows += 1; else row.returnRows += 1;
            row.netTaxable += tx.taxableValue;
            row.igst += tx.igst;
            row.cgst += tx.cgst;
            row.sgst += tx.sgst;
            row.cess += tx.cess;
        });

        return Object.keys(byMarketplace).map((marketplace) => {
            const row = byMarketplace[marketplace];
            return {
                marketplace,
                salesRows: row.salesRows,
                returnRows: row.returnRows,
                netTaxable: round2(row.netTaxable),
                igst: round2(row.igst),
                cgst: round2(row.cgst),
                sgst: round2(row.sgst),
                cess: round2(row.cess)
            };
        }).filter((row) => row.salesRows > 0 || row.returnRows > 0);
    }

    function makeOverviewRow() {
        return { salesRows: 0, returnRows: 0, netTaxable: 0, igst: 0, cgst: 0, sgst: 0, cess: 0 };
    }

    /* ---------------------------------------------------------------
       EXCEL WORKBOOK
       --------------------------------------------------------------- */

    function buildWorkbook(b2cGroups, hsnGroups, ecoGroups, marketplaceOverview) {
        const workbook = XLSX.utils.book_new();

        appendB2CSheet(workbook, b2cGroups);
        appendHSNSheet(workbook, hsnGroups);
        appendECOSheet(workbook, ecoGroups);
        appendOverviewSheet(workbook, marketplaceOverview);

        workbook.Props = {
            Title: "InfoBridgeIndia Combined GSTR-1 Workbook",
            Subject: "Combined Meesho + Flipkart GST Portal Ready Working Sheets",
            Author: "InfoBridgeIndia",
            Company: "InfoBridgeIndia",
            Comments: "Generated from Meesho and Flipkart Sales/Return reports."
        };

        return workbook;
    }

    function appendB2CSheet(workbook, groups) {
        const headers = ["POS (State)", "Supply Type", "Taxable Value", "Rate", "IGST", "CGST", "SGST", "Status"];
        const data = groups.map((g) => [
            formatPlaceOfSupply(g.stateCode, toTitleCase(g.state)),
            g.supplyType, g.taxableValue, g.gstRate, g.igst, g.cgst, g.sgst, "ENTER IN PORTAL"
        ]);
        appendPortalSheet(workbook, "B2C Others", headers, data, [22, 12, 18, 10, 14, 14, 14, 18], [2, 4, 5, 6]);
    }

    function appendHSNSheet(workbook, groups) {
        const headers = ["HSN", "UQC", "Total Quantity", "Total Taxable Value", "Rate", "Integrated Tax", "Central Tax", "State/UT Tax", "Status"];
        const data = groups.map((g) => [
            g.hsnCode || "Missing", g.uqcLong, g.quantity, g.taxableValue, g.gstRate, g.igst, g.cgst, g.sgst, "ENTER IN PORTAL"
        ]);
        appendPortalSheet(workbook, "HSN Ready", headers, data, [12, 18, 16, 22, 10, 18, 16, 16, 20], [2, 3, 4, 5, 6, 7]);
    }

    function appendECOSheet(workbook, groups) {
        const headers = ["GSTIN of E-Commerce Operator", "Trade/Legal Name", "Net Value of Supplies", "Integrated Tax", "Central Tax", "State/UT Tax", "Cess"];
        const data = groups.map((g) => [g.ecoGSTIN, g.tradeName, g.taxableValue, g.igst, g.cgst, g.sgst, g.cess]);
        appendPortalSheet(workbook, "ECO Ready", headers, data, [30, 38, 22, 18, 16, 16, 12], [2, 3, 4, 5, 6]);
    }

    function appendOverviewSheet(workbook, marketplaceOverview) {
        const headers = ["Marketplace", "Sale Rows", "Return Rows", "Net Taxable Value", "IGST", "CGST", "SGST", "Cess"];
        const data = marketplaceOverview.map((row) => [
            row.marketplace, row.salesRows, row.returnRows, row.netTaxable, row.igst, row.cgst, row.sgst, row.cess
        ]);
        appendPortalSheet(workbook, "Marketplace Summary", headers, data, [16, 12, 12, 20, 14, 14, 14, 12], [1, 2, 3, 4, 5, 6, 7]);
    }

    function appendPortalSheet(workbook, sheetName, headers, rows, columnWidths, numericColumns) {
        const safeRows = rows.length ? rows : [["No reportable transactions"]];
        const sheet = XLSX.utils.aoa_to_sheet([headers, ...safeRows]);

        sheet["!cols"] = columnWidths.map((width) => ({ wch: width }));
        sheet["!freeze"] = { xSplit: 0, ySplit: 1 };

        if (sheet["!ref"]) {
            const range = XLSX.utils.decode_range(sheet["!ref"]);
            sheet["!autofilter"] = {
                ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: range.e.r, c: range.e.c } })
            };

            for (let row = 1; row <= range.e.r; row += 1) {
                numericColumns.forEach((column) => {
                    const address = XLSX.utils.encode_cell({ r: row, c: column });
                    if (sheet[address] && sheet[address].t === "n") {
                        sheet[address].z = "#,##0.00";
                    }
                });
            }
        }

        XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
    }

    /* ---------------------------------------------------------------
       GSTR-1 JSON (structure follows the supplied reference file)
       --------------------------------------------------------------- */

    function buildGstr1Json(b2cGroups, hsnGroups, ecoGroups, gstin, fp) {
        return {
            gstin,
            fp,
            version: "GST3.1.6",
            hash: "",
            b2cs: toJsonB2CS(b2cGroups),
            hsn: {
                hsn_b2c: toJsonHSN(hsnGroups),
                hsn_b2b: []
            },
            nil: {
                inv: [
                    { sply_ty: "INTRB2B", nil_amt: 0, expt_amt: 0, ngsup_amt: 0 },
                    { sply_ty: "INTRAB2B", nil_amt: 0, expt_amt: 0, ngsup_amt: 0 },
                    { sply_ty: "INTRB2C", nil_amt: 0, expt_amt: 0, ngsup_amt: 0 },
                    { sply_ty: "INTRAB2C", nil_amt: 0, expt_amt: 0, ngsup_amt: 0 }
                ]
            },
            supeco: {
                clttx: toJsonSupEco(ecoGroups)
            },
            doc_issue: {
                doc_det: []
            }
        };
    }

    function toJsonB2CS(groups) {
        return groups.map((g) => {
            const entry = {
                sply_ty: g.supplyType,
                rt: g.gstRate,
                typ: "OE",
                pos: g.stateCode || "97",
                txval: g.taxableValue
            };

            if (g.supplyType === "INTER") {
                entry.iamt = g.igst;
            } else {
                entry.camt = g.cgst;
                entry.samt = g.sgst;
            }

            entry.csamt = g.cess;
            return entry;
        });
    }

    function toJsonHSN(groups) {
        return groups.map((g, index) => ({
            num: index + 1,
            hsn_sc: g.hsnCode,
            uqc: g.uqcShort,
            qty: g.quantity,
            rt: g.gstRate,
            txval: g.taxableValue,
            iamt: g.igst,
            samt: g.sgst,
            camt: g.cgst,
            csamt: g.cess
        }));
    }

    function toJsonSupEco(groups) {
        return groups.map((g) => ({
            etin: g.ecoGSTIN,
            suppval: g.taxableValue,
            igst: g.igst,
            cgst: g.cgst,
            sgst: g.sgst,
            cess: g.cess,
            flag: "N"
        }));
    }

    function downloadJsonFile(fileName, dataObject) {
        const blob = new Blob([JSON.stringify(dataObject)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    /* ---------------------------------------------------------------
       GSTIN / FILING PERIOD HELPERS
       --------------------------------------------------------------- */

    function normalizeGSTIN(value) {
        const gstin = cleanText(value).toUpperCase().replace(/\s+/g, "");
        return /^[0-9]{2}[A-Z0-9]{13}$/.test(gstin) ? gstin : "";
    }

    function toFilingPeriod(monthValue) {
        const text = cleanText(monthValue);
        const match = text.match(/^(\d{4})-(\d{2})$/);
        if (!match) return null;

        const year = match[1];
        const month = match[2];
        const label = new Date(Number(year), Number(month) - 1, 1)
            .toLocaleString("en-US", { month: "long", year: "numeric" });

        return { fp: `${month}${year}`, label };
    }

    function shortUQC(value) {
        const text = cleanText(value).toUpperCase();
        const code = text.split(/[-\s]/)[0];
        return code || "OTH";
    }

    /* ---------------------------------------------------------------
       SHARED HELPERS (ported from js/meesho.js and js/flipkart.js)
       --------------------------------------------------------------- */

    function normalizeStateName(value) {
        const text = cleanText(value).toUpperCase().replace(/&/g, "AND").replace(/\./g, "").replace(/\s+/g, " ");
        return STATE_ALIASES[text] || text;
    }

    function getStateCode(stateName) {
        return STATE_CODES[normalizeStateName(stateName)] || "";
    }

    function formatPlaceOfSupply(code, state) {
        return code ? `${code}-${state}` : state;
    }

    function toTitleCase(value) {
        return cleanText(value).toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
    }

    function firstValue(row, columns) {
        for (const column of columns) {
            if (row[column] !== undefined && row[column] !== null && row[column] !== "") {
                return row[column];
            }
        }
        return "";
    }

    function toNumber(value) {
        if (value === null || value === undefined || value === "") return 0;
        if (typeof value === "number") return Number.isFinite(value) ? value : 0;

        let text = String(value).replace(/₹/g, "").replace(/,/g, "").replace(/%/g, "").replace(/\s+/g, "").trim();

        if (text.startsWith("(") && text.endsWith(")")) {
            text = `-${text.slice(1, -1)}`;
        }

        const number = Number(text);
        return Number.isFinite(number) ? number : 0;
    }

    function cleanText(value) {
        return (value === null || value === undefined) ? "" : String(value).trim();
    }

    function round2(value) {
        return Math.round((toNumber(value) + Number.EPSILON) * 100) / 100;
    }

    function formatMoney(value) {
        return round2(value).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function isExcelFile(fileName) {
        return /\.(xlsx|xls)$/i.test(fileName);
    }

    function parseReportDate(value) {
        if (!value) return null;

        if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

        if (typeof value === "number" && typeof XLSX !== "undefined") {
            const parsed = XLSX.SSF.parse_date_code(value);
            if (parsed) return new Date(parsed.y, parsed.m - 1, parsed.d);
        }

        const text = String(value).trim();
        const ymd = text.match(/^(\d{4})[\/.-](\d{1,2})[\/.-](\d{1,2})/);
        if (ymd) return validDate(Number(ymd[1]), Number(ymd[2]), Number(ymd[3]));

        const dmy = text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/);
        if (dmy) {
            let year = Number(dmy[3]);
            if (year < 100) year += 2000;
            return validDate(year, Number(dmy[2]), Number(dmy[1]));
        }

        const direct = new Date(text);
        return Number.isNaN(direct.getTime()) ? null : direct;
    }

    function validDate(year, month, day) {
        const date = new Date(year, month - 1, day);
        return (
            date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
        ) ? date : null;
    }

    /* ---------------------------------------------------------------
       UI HELPERS
       --------------------------------------------------------------- */

    function resetEngine() {
        validated = false;
        combinedTransactions = [];
        validationWarnings = [];
        lastWorkbook = null;
        lastJson = null;

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

    function escapeHtml(value) {
        const element = document.createElement("div");
        element.textContent = String(value);
        return element.innerHTML;
    }
});
