document.addEventListener("DOMContentLoaded", () => {
    "use strict";
 
    const salesInput = document.getElementById("salesReport");
    const gstinInput = document.getElementById("gstin");
    const periodInput = document.getElementById("filingPeriod");
    const validateBtn = document.getElementById("validateBtn");
    const generateBtn = document.getElementById("generateBtn");
    const statusBox = document.getElementById("statusBox");
    const downloadSection = document.getElementById("downloadSection");
    const downloadExcelBtn = document.getElementById("downloadExcelBtn");
    const downloadJsonBtn = document.getElementById("downloadJsonBtn");

    if (
        !salesInput ||
        !gstinInput ||
        !periodInput ||
        !validateBtn ||
        !generateBtn ||
        !statusBox ||
        !downloadSection ||
        !downloadExcelBtn ||
        !downloadJsonBtn
    ) {
        console.error("Required Flipkart page elements were not found.");
        return;
    }
 
    const REQUIRED_COLUMNS = [
        "seller_gstin",
        "order_id",
        "order_item_id",
        "hsn_code",
        "event_type",
        "order_date",
        "item_quantity",
        "taxable_value_final_invoice_amount_taxes",
        "igst_rate",
        "igst_amount",
        "cgst_rate",
        "cgst_amount",
        "sgst_rate_or_utgst_as_applicable",
        "sgst_amount_or_utgst_as_applicable",
        "customer_s_delivery_state"
    ];
 
    const FLIPKART_ECO_BY_STATE = {
        "33": {
            gstin: "33AACCF0683K1CZ",
            tradeName: "FLIPKART INTERNET PRIVATE LIMITED"
        }
    };
 
    let validatedRows = [];
    let reportPeriod = "";
    let selectedSheetName = "";
    let lastWorkbook = null;
    let lastGeneratedFileName = "";
    let resolvedGSTIN = "";
    let resolvedPeriod = { fp: "", label: "" };
    let lastJson = null;
    let lastJsonFileName = "";

    generateBtn.disabled = true;

    salesInput.addEventListener("change", resetEngine);
    gstinInput.addEventListener("input", resetEngine);
    periodInput.addEventListener("change", resetEngine);
 
    validateBtn.addEventListener("click", async () => {
        try {
            resetEngine();
 
            const file = salesInput.files[0];
 
            if (!file) {
                showStatus("Please select the Flipkart Sales Report.", "error");
                return;
            }
 
            if (!isExcelFile(file.name)) {
                showStatus("Only .xlsx and .xls files are supported.", "error");
                return;
            }
 
            if (typeof XLSX === "undefined") {
                showStatus(
                    "The Excel processing library could not be loaded. Check your internet connection and try again.",
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
                showStatus(
                    "Please select the filing period (month and year).",
                    "error"
                );
                return;
            }

            validateBtn.disabled = true;
            showStatus("Validating Flipkart report...", "loading");
 
            const result = await readFlipkartReport(file);
            const rows = normalizeRows(result.rows);
 
            validateReport(rows);
 
            validatedRows = rows;
            selectedSheetName = result.sheetName;
            reportPeriod = detectPeriod(rows);
            resolvedGSTIN = gstin;
            resolvedPeriod = period;
            generateBtn.disabled = false;
 
            const counts = countEvents(rows);
 
            showStatus(
                `
                <strong>Report validated successfully.</strong>
                <br><br>
                Sheet: <strong>${escapeHtml(selectedSheetName)}</strong>
                <br>
                Sale rows: <strong>${counts.sales}</strong>
                <br>
                Return rows: <strong>${counts.returns}</strong>
                <br><br>
                Report period: <strong>${escapeHtml(reportPeriod)}</strong>
                <br><br>
                Ready to generate the GST workbook.
                `,
                "success"
            );
        } catch (error) {
            console.error(error);
            generateBtn.disabled = true;
            showStatus(
                error.message || "The Flipkart report could not be validated.",
                "error"
            );
        } finally {
            validateBtn.disabled = false;
        }
    });
 
    generateBtn.addEventListener("click", () => {
        try {
            if (!validatedRows.length) {
                showStatus("Validate the report before generating the workbook.", "error");
                return;
            }

            generateBtn.disabled = true;

            downloadSection.hidden = true;
            downloadExcelBtn.disabled = true;
            downloadJsonBtn.disabled = true;
            lastWorkbook = null;
            lastGeneratedFileName = "";
            lastJson = null;
            lastJsonFileName = "";

            showStatus("Preparing the GST report...", "loading");

            const result = calculateGST(validatedRows);
            const workbook = buildWorkbook(result);

            const safePeriod = (reportPeriod || "Report")
                .replace(/\s+/g, "_")
                .replace(/[^A-Za-z0-9_-]/g, "");

            lastWorkbook = workbook;
            lastGeneratedFileName = `InfoBridgeIndia_Flipkart_GST_${safePeriod}.xlsx`;

            lastJson = buildGstr1Json(
                result.b2c,
                result.hsn,
                result.eco,
                resolvedGSTIN,
                resolvedPeriod.fp
            );
            lastJsonFileName = `GSTR1_${resolvedGSTIN}_${resolvedPeriod.fp}_Flipkart.json`;

            downloadSection.hidden = false;
            downloadExcelBtn.disabled = false;
            downloadJsonBtn.disabled = false;

            showStatus(
                `
                <div class="result-heading">
                    <span class="result-check">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                    </span>
                    GST Report Ready
                </div>
                <div class="result-rows">
                    <div class="result-row"><span>Net Taxable Value</span><strong>₹${formatMoney(result.summary.netTaxable)}</strong></div>
                    <div class="result-row"><span>IGST</span><strong>₹${formatMoney(result.summary.netIGST)}</strong></div>
                    <div class="result-row"><span>CGST</span><strong>₹${formatMoney(result.summary.netCGST)}</strong></div>
                    <div class="result-row"><span>SGST</span><strong>₹${formatMoney(result.summary.netSGST)}</strong></div>
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
            lastGeneratedFileName = "";
            lastJson = null;
            lastJsonFileName = "";

            showStatus(
                error.message || "The GST workbook could not be generated.",
                "error"
            );
        } finally {
            generateBtn.disabled = false;
        }
    });

    downloadExcelBtn.addEventListener("click", () => {
        if (!lastWorkbook || !lastGeneratedFileName) {
            showStatus("Generate the GST report before downloading.", "error");
            return;
        }

        XLSX.writeFile(lastWorkbook, lastGeneratedFileName);
    });

    downloadJsonBtn.addEventListener("click", () => {
        if (!lastJson || !lastJsonFileName) {
            showStatus("Generate the GST report before downloading.", "error");
            return;
        }

        downloadJsonFile(lastJsonFileName, lastJson);
    });
 
    async function readFlipkartReport(file) {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, {
            type: "array",
            cellDates: true
        });
 
        if (!workbook.SheetNames.length) {
            throw new Error(`${file.name} does not contain a worksheet.`);
        }
 
        const preferredName = workbook.SheetNames.find(
            (name) => normalizeKey(name) === "sales_report"
        );
 
        const sheetName = preferredName || workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, {
            defval: "",
            raw: true
        });
 
        if (!rows.length) {
            throw new Error("The Sales Report sheet does not contain data rows.");
        }
 
        return { sheetName, rows };
    }
 
    function normalizeRows(rows) {
        return rows.map((row) => {
            const normalized = {};
 
            Object.keys(row).forEach((key) => {
                normalized[normalizeKey(key)] = row[key];
            });
 
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
 
    function validateReport(rows) {
        const availableColumns = new Set();
 
        rows.slice(0, 20).forEach((row) => {
            Object.keys(row).forEach((column) => availableColumns.add(column));
        });
 
        const missing = REQUIRED_COLUMNS.filter(
            (column) => !availableColumns.has(column)
        );
 
        if (missing.length) {
            throw new Error(
                `Wrong Flipkart report. Missing columns: ${missing.join(", ")}`
            );
        }
 
        const usableRows = rows.filter((row) => {
            const eventType = cleanText(row.event_type).toUpperCase();
            return (
                eventType === "SALE" ||
                eventType === "RETURN" ||
                toNumber(row.taxable_value_final_invoice_amount_taxes) !== 0
            );
        });
 
        if (!usableRows.length) {
            throw new Error("No usable Sale or Return transactions were found.");
        }
    }
 
    function countEvents(rows) {
        return rows.reduce(
            (counts, row) => {
                const eventType = cleanText(row.event_type).toUpperCase();
                if (eventType === "SALE") counts.sales += 1;
                if (eventType === "RETURN") counts.returns += 1;
                return counts;
            },
            { sales: 0, returns: 0 }
        );
    }
 
    function calculateGST(rows) {
        const transactions = rows
            .map((row, index) => prepareTransaction(row, index + 2))
            .filter(Boolean);
 
        if (!transactions.length) {
            throw new Error("No usable Flipkart transactions were found.");
        }
 
        const summary = transactions.reduce(
            (total, row) => {
                total.netTaxable += row.signedTaxable;
                total.netIGST += row.signedIGST;
                total.netCGST += row.signedCGST;
                total.netSGST += row.signedSGST;
                total.netCess += row.signedCess;
                return total;
            },
            {
                netTaxable: 0,
                netIGST: 0,
                netCGST: 0,
                netSGST: 0,
                netCess: 0
            }
        );
 
        Object.keys(summary).forEach((key) => {
            summary[key] = round2(summary[key]);
        });
 
        return {
            period: reportPeriod,
            summary,
            b2c: groupB2C(transactions),
            hsn: groupHSN(transactions),
            eco: groupECO(transactions, summary)
        };
    }
 
    function prepareTransaction(row, sourceRow) {
        const eventType = cleanText(row.event_type).toUpperCase();
 
        if (eventType !== "SALE" && eventType !== "RETURN") {
            return null;
        }
 
        const sign = eventType === "RETURN" ? -1 : 1;
        const taxable = Math.abs(
            toNumber(row.taxable_value_final_invoice_amount_taxes)
        );
 
        const igst = Math.abs(toNumber(row.igst_amount));
        const cgst = Math.abs(toNumber(row.cgst_amount));
        const sgst = Math.abs(
            toNumber(row.sgst_amount_or_utgst_as_applicable)
        );
 
        const cess = Math.abs(
            toNumber(
                firstValue(row, [
                    "luxury_cess_amount",
                    "cess_amount"
                ])
            )
        );
 
        const gstRate = detectGSTRate(row);
        const state = normalizeStateName(row.customer_s_delivery_state);
        const stateCode = getStateCode(state);
        const quantity = Math.abs(toNumber(row.item_quantity) || 1);
        const sellerGSTIN = normalizeGSTIN(row.seller_gstin);
 
        return {
            sourceRow,
            eventType,
            sign,
            orderId: cleanText(row.order_id),
            orderItemId: cleanText(row.order_item_id),
            invoiceNumber: cleanText(row.buyer_invoice_id),
            orderDate: parseReportDate(row.order_date),
            hsnCode: cleanText(row.hsn_code),
            uqc: "NOS-NUMBERS",
            gstRate,
            state: state || "Unknown",
            stateCode,
            sellerGSTIN,
            signedQuantity: round2(sign * quantity),
            signedTaxable: round2(sign * taxable),
            signedIGST: round2(sign * igst),
            signedCGST: round2(sign * cgst),
            signedSGST: round2(sign * sgst),
            signedCess: round2(sign * cess)
        };
    }
 
    function detectGSTRate(row) {
        const igstRate = Math.abs(toNumber(row.igst_rate));
        const cgstRate = Math.abs(toNumber(row.cgst_rate));
        const sgstRate = Math.abs(
            toNumber(row.sgst_rate_or_utgst_as_applicable)
        );
 
        if (igstRate > 0) return round2(igstRate);
        if (cgstRate > 0 || sgstRate > 0) {
            return round2(cgstRate + sgstRate);
        }
        return 0;
    }
 
    function groupB2C(transactions) {
        const groups = new Map();

        transactions.forEach((row) => {
            const supplyType = Math.abs(row.signedIGST) > 0 ? "INTER" : "INTRA";
            const key = `${row.stateCode}|${row.state}|${row.gstRate}|${supplyType}`;

            if (!groups.has(key)) {
                groups.set(key, {
                    stateCode: row.stateCode,
                    state: row.state,
                    gstRate: row.gstRate,
                    supplyType,
                    taxableValue: 0,
                    igst: 0,
                    cgst: 0,
                    sgst: 0,
                    cess: 0
                });
            }

            const group = groups.get(key);
            group.taxableValue += row.signedTaxable;
            group.igst += row.signedIGST;
            group.cgst += row.signedCGST;
            group.sgst += row.signedSGST;
            group.cess += row.signedCess;
        });

        return Array.from(groups.values())
            .map((group) => ({
                placeOfSupply: formatPlaceOfSupply(
                    group.stateCode,
                    toTitleCase(group.state)
                ),
                taxableValue: round2(group.taxableValue),
                gstRate: group.gstRate,
                status: "ENTER IN PORTAL",
                // Additional fields below are only used for GSTR-1 JSON
                // mapping and are ignored by the existing Excel sheet.
                stateCode: group.stateCode,
                supplyType: group.supplyType,
                igst: round2(group.igst),
                cgst: round2(group.cgst),
                sgst: round2(group.sgst),
                cess: round2(group.cess)
            }))
            .filter((row) => Math.abs(row.taxableValue) >= 0.01)
            .sort((a, b) =>
                a.placeOfSupply.localeCompare(b.placeOfSupply) ||
                a.gstRate - b.gstRate
            );
    }
 
    function groupHSN(transactions) {
        const groups = new Map();

        transactions.forEach((row) => {
            const key = `${row.hsnCode}|${row.gstRate}|${row.uqc}`;

            if (!groups.has(key)) {
                groups.set(key, {
                    hsnCode: row.hsnCode,
                    uqc: row.uqc,
                    gstRate: row.gstRate,
                    quantity: 0,
                    taxableValue: 0,
                    igst: 0,
                    cgst: 0,
                    sgst: 0,
                    cess: 0
                });
            }

            const group = groups.get(key);
            group.quantity += row.signedQuantity;
            group.taxableValue += row.signedTaxable;
            group.igst += row.signedIGST;
            group.cgst += row.signedCGST;
            group.sgst += row.signedSGST;
            group.cess += row.signedCess;
        });

        return Array.from(groups.values())
            .map((group) => ({
                hsnCode: group.hsnCode || "Missing",
                uqc: group.uqc,
                totalQuantity: round2(group.quantity),
                totalTaxableValue: round2(group.taxableValue),
                gstRate: group.gstRate,
                igst: round2(group.igst),
                cgst: round2(group.cgst),
                sgst: round2(group.sgst),
                status: "ENTER IN PORTAL",
                // Used only for GSTR-1 JSON mapping; ignored by the Excel sheet.
                cess: round2(group.cess)
            }))
            .filter((row) =>
                [
                    row.totalQuantity,
                    row.totalTaxableValue,
                    row.igst,
                    row.cgst,
                    row.sgst
                ].some((value) => Math.abs(value) >= 0.01)
            )
            .sort((a, b) =>
                String(a.hsnCode).localeCompare(
                    String(b.hsnCode),
                    undefined,
                    { numeric: true }
                ) || a.gstRate - b.gstRate
            );
    }
 
    function groupECO(transactions, summary) {
        const sellerGSTIN = transactions
            .map((row) => row.sellerGSTIN)
            .find(Boolean) || "";
 
        const sellerStateCode = /^\d{2}/.test(sellerGSTIN)
            ? sellerGSTIN.slice(0, 2)
            : "";
 
        const operator = FLIPKART_ECO_BY_STATE[sellerStateCode];
 
        if (!operator) {
            throw new Error(
                "Flipkart ECO GSTIN is not configured for this seller state. Please contact InfoBridgeIndia before filing the ECO section."
            );
        }
 
        return [
            {
                ecoGSTIN: operator.gstin,
                tradeName: operator.tradeName,
                netTaxable: summary.netTaxable,
                igst: summary.netIGST,
                cgst: summary.netCGST,
                sgst: summary.netSGST,
                cess: summary.netCess
            }
        ];
    }
 
    function buildWorkbook(result) {
        const workbook = XLSX.utils.book_new();
 
        appendB2CSheet(workbook, result.b2c);
        appendHSNSheet(workbook, result.hsn);
        appendECOSheet(workbook, result.eco);
 
        workbook.Props = {
            Title: "InfoBridgeIndia Flipkart GST Workbook",
            Subject: "Flipkart GST Portal Ready Working Sheets",
            Author: "InfoBridgeIndia",
            Company: "InfoBridgeIndia",
            Comments: "Generated from the Flipkart Sales Report."
        };
 
        return workbook;
    }
 
    function appendB2CSheet(workbook, rows) {
        const headers = [
            "POS (State)",
            "Taxable Value",
            "Rate",
            "Status"
        ];
 
        const data = rows.map((row) => [
            row.placeOfSupply,
            row.taxableValue,
            row.gstRate,
            row.status
        ]);
 
        appendPortalSheet(
            workbook,
            "B2C Others",
            headers,
            data,
            [22, 18, 10, 20],
            [1, 2]
        );
    }
 
    function appendHSNSheet(workbook, rows) {
        const headers = [
            "HSN",
            "UQC",
            "Total Quantity",
            "Total Taxable Value",
            "Rate",
            "Integrated Tax",
            "Central Tax",
            "State/UT Tax",
            "Status"
        ];
 
        const data = rows.map((row) => [
            row.hsnCode,
            row.uqc,
            row.totalQuantity,
            row.totalTaxableValue,
            row.gstRate,
            row.igst,
            row.cgst,
            row.sgst,
            row.status
        ]);
 
        appendPortalSheet(
            workbook,
            "HSN Ready",
            headers,
            data,
            [12, 18, 16, 22, 10, 18, 16, 16, 20],
            [2, 3, 4, 5, 6, 7]
        );
    }
 
    function appendECOSheet(workbook, rows) {
        const headers = [
            "GSTIN of E-Commerce Operator",
            "Trade/Legal Name",
            "Net Value of Supplies",
            "Integrated Tax",
            "Central Tax",
            "State/UT Tax",
            "Cess"
        ];
 
        const data = rows.map((row) => [
            row.ecoGSTIN,
            row.tradeName,
            row.netTaxable,
            row.igst,
            row.cgst,
            row.sgst,
            row.cess
        ]);
 
        appendPortalSheet(
            workbook,
            "ECO Ready",
            headers,
            data,
            [30, 38, 22, 18, 16, 16, 12],
            [2, 3, 4, 5, 6]
        );
    }
 
    function appendPortalSheet(
        workbook,
        sheetName,
        headers,
        rows,
        columnWidths,
        numericColumns
    ) {
        const safeRows = rows.length ? rows : [["No reportable transactions"]];
        const sheet = XLSX.utils.aoa_to_sheet([headers, ...safeRows]);
 
        sheet["!cols"] = columnWidths.map((width) => ({ wch: width }));
        sheet["!freeze"] = { xSplit: 0, ySplit: 1 };
 
        if (sheet["!ref"]) {
            const range = XLSX.utils.decode_range(sheet["!ref"]);
 
            sheet["!autofilter"] = {
                ref: XLSX.utils.encode_range({
                    s: { r: 0, c: 0 },
                    e: { r: range.e.r, c: range.e.c }
                })
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
 
    function detectPeriod(rows) {
        const dates = rows
            .map((row) => parseReportDate(row.order_date))
            .filter(Boolean);
 
        if (!dates.length) return "Unknown Period";
 
        const counts = new Map();
 
        dates.forEach((date) => {
            const key = `${date.getFullYear()}-${String(
                date.getMonth() + 1
            ).padStart(2, "0")}`;
            counts.set(key, (counts.get(key) || 0) + 1);
        });
 
        const periodKey = Array.from(counts.entries())
            .sort((a, b) => b[1] - a[1])[0][0];
 
        const [year, month] = periodKey.split("-").map(Number);
 
        return new Date(year, month - 1, 1).toLocaleString("en-US", {
            month: "long",
            year: "numeric"
        });
    }
 
    function parseReportDate(value) {
        if (!value) return null;
 
        if (value instanceof Date && !Number.isNaN(value.getTime())) {
            return value;
        }
 
        if (typeof value === "number" && typeof XLSX !== "undefined") {
            const parsed = XLSX.SSF.parse_date_code(value);
            if (parsed) return new Date(parsed.y, parsed.m - 1, parsed.d);
        }
 
        const text = String(value).trim();
        const ymd = text.match(/^(\d{4})[\/.\-](\d{1,2})[\/.\-](\d{1,2})/);
 
        if (ymd) {
            return validDate(Number(ymd[1]), Number(ymd[2]), Number(ymd[3]));
        }
 
        const dmy = text.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/);
 
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
            date.getFullYear() === year &&
            date.getMonth() === month - 1 &&
            date.getDate() === day
        ) ? date : null;
    }
 
    function normalizeStateName(value) {
        const text = cleanText(value)
            .toUpperCase()
            .replace(/&/g, "AND")
            .replace(/\./g, "")
            .replace(/\s+/g, " ");
 
        const aliases = {
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
 
        return aliases[text] || text;
    }
 
    function getStateCode(stateName) {
        const stateCodes = {
            "JAMMU AND KASHMIR": "01",
            "HIMACHAL PRADESH": "02",
            "PUNJAB": "03",
            "CHANDIGARH": "04",
            "UTTARAKHAND": "05",
            "HARYANA": "06",
            "DELHI": "07",
            "RAJASTHAN": "08",
            "UTTAR PRADESH": "09",
            "BIHAR": "10",
            "SIKKIM": "11",
            "ARUNACHAL PRADESH": "12",
            "NAGALAND": "13",
            "MANIPUR": "14",
            "MIZORAM": "15",
            "TRIPURA": "16",
            "MEGHALAYA": "17",
            "ASSAM": "18",
            "WEST BENGAL": "19",
            "JHARKHAND": "20",
            "ODISHA": "21",
            "CHHATTISGARH": "22",
            "MADHYA PRADESH": "23",
            "GUJARAT": "24",
            "DADRA AND NAGAR HAVELI AND DAMAN AND DIU": "26",
            "MAHARASHTRA": "27",
            "KARNATAKA": "29",
            "GOA": "30",
            "LAKSHADWEEP": "31",
            "KERALA": "32",
            "TAMIL NADU": "33",
            "PUDUCHERRY": "34",
            "ANDAMAN AND NICOBAR ISLANDS": "35",
            "TELANGANA": "36",
            "ANDHRA PRADESH": "37",
            "LADAKH": "38",
            "OTHER TERRITORY": "97",
            "CENTRE JURISDICTION": "99"
        };
 
        return stateCodes[normalizeStateName(stateName)] || "";
    }
 
    function formatPlaceOfSupply(code, state) {
        return code ? `${code}-${state}` : state;
    }
 
    function toTitleCase(value) {
        return cleanText(value)
            .toLowerCase()
            .replace(/\b\w/g, (letter) => letter.toUpperCase());
    }
 
    function firstValue(row, columns) {
        for (const column of columns) {
            if (
                row[column] !== undefined &&
                row[column] !== null &&
                row[column] !== ""
            ) {
                return row[column];
            }
        }
        return "";
    }
 
    /* ---------------------------------------------------------------
       GSTR-1 JSON (structure follows the official reference GSTR-1
       JSON file supplied for this feature). Built from the same
       result.b2c / result.hsn / result.eco used for the Excel workbook.
       --------------------------------------------------------------- */

    function buildGstr1Json(b2cRows, hsnRows, ecoRows, gstin, fp) {
        return {
            gstin,
            fp,
            version: "GST3.1.6",
            hash: "",
            b2cs: toJsonB2CS(b2cRows),
            hsn: {
                hsn_b2c: toJsonHSN(hsnRows),
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
                clttx: toJsonSupEco(ecoRows)
            },
            doc_issue: {
                doc_det: []
            }
        };
    }

    function toJsonB2CS(rows) {
        return rows.map((row) => {
            const entry = {
                sply_ty: row.supplyType,
                rt: row.gstRate,
                typ: "OE",
                pos: row.stateCode || "97",
                txval: row.taxableValue
            };

            if (row.supplyType === "INTER") {
                entry.iamt = row.igst;
            } else {
                entry.camt = row.cgst;
                entry.samt = row.sgst;
            }

            entry.csamt = row.cess;
            return entry;
        });
    }

    function toJsonHSN(rows) {
        return rows.map((row, index) => ({
            num: index + 1,
            hsn_sc: row.hsnCode === "Missing" ? "" : row.hsnCode,
            uqc: shortUQC(row.uqc),
            qty: row.totalQuantity,
            rt: row.gstRate,
            txval: row.totalTaxableValue,
            iamt: row.igst,
            samt: row.sgst,
            camt: row.cgst,
            csamt: row.cess
        }));
    }

    function toJsonSupEco(rows) {
        return rows.map((row) => ({
            etin: row.ecoGSTIN,
            suppval: row.netTaxable,
            igst: row.igst,
            cgst: row.cgst,
            sgst: row.sgst,
            cess: row.cess,
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

    function normalizeGSTIN(value) {
        const gstin = cleanText(value)
            .toUpperCase()
            .replace(/\s+/g, "");
 
        return /^[0-9]{2}[A-Z0-9]{13}$/.test(gstin) ? gstin : "";
    }
 
    function toNumber(value) {
        if (value === null || value === undefined || value === "") return 0;
        if (typeof value === "number") return Number.isFinite(value) ? value : 0;
 
        let text = String(value)
            .replace(/₹/g, "")
            .replace(/,/g, "")
            .replace(/%/g, "")
            .replace(/\s+/g, "")
            .trim();
 
        if (text.startsWith("(") && text.endsWith(")")) {
            text = `-${text.slice(1, -1)}`;
        }
 
        const number = Number(text);
        return Number.isFinite(number) ? number : 0;
    }
 
    function cleanText(value) {
        return value === null || value === undefined ? "" : String(value).trim();
    }
 
    function round2(value) {
        return Math.round((toNumber(value) + Number.EPSILON) * 100) / 100;
    }
 
    function formatMoney(value) {
        return round2(value).toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }
 
    function isExcelFile(fileName) {
        return /\.(xlsx|xls)$/i.test(fileName);
    }
 
    function resetEngine() {
        validatedRows = [];
        reportPeriod = "";
        selectedSheetName = "";
        lastWorkbook = null;
        lastGeneratedFileName = "";
        resolvedGSTIN = "";
        resolvedPeriod = { fp: "", label: "" };
        lastJson = null;
        lastJsonFileName = "";
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
