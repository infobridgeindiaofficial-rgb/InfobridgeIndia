document.addEventListener("DOMContentLoaded", () => {
    "use strict";
 
    const salesInput = document.getElementById("salesReport");
    const returnInput = document.getElementById("returnReport");
    const validateBtn = document.getElementById("validateBtn");
    const generateBtn = document.getElementById("generateBtn");
    const statusBox = document.getElementById("statusBox");
    const downloadSection = document.getElementById("downloadSection");
    const downloadExcelBtn = document.getElementById("downloadExcelBtn");
    const downloadJsonBtn = document.getElementById("downloadJsonBtn");

    if (
        !salesInput ||
        !returnInput ||
        !validateBtn ||
        !generateBtn ||
        !statusBox ||
        !downloadSection ||
        !downloadExcelBtn ||
        !downloadJsonBtn
    ) {
        console.error("Required Meesho page elements were not found.");
        return;
    }
 
    const SALES_REQUIRED = [
        "sub_order_num",
        "order_date",
        "hsn_code",
        "gst_rate",
        "total_taxable_sale_value",
        "end_customer_state_new"
    ];
 
    const RETURN_REQUIRED = [
        "sub_order_num",
        "cancel_return_date",
        "hsn_code",
        "gst_rate",
        "total_taxable_sale_value",
        "end_customer_state_new"
    ];
 
    let validatedSales = [];
    let validatedReturns = [];
    let reportPeriod = "";
    let lastWorkbook = null;
    let lastGeneratedFileName = "";

    generateBtn.disabled = true;
 
    salesInput.addEventListener("change", resetEngine);
    returnInput.addEventListener("change", resetEngine);
 
    validateBtn.addEventListener("click", async () => {
        try {
            resetEngine();
 
            const salesFile = salesInput.files[0];
            const returnFile = returnInput.files[0];
 
            if (!salesFile) {
                showStatus(
                    "Please select the Meesho Sales Report.",
                    "error"
                );
                return;
            }
 
            if (
                !isExcelFile(salesFile.name) ||
                (returnFile && !isExcelFile(returnFile.name))
            ) {
                showStatus(
                    "Only .xlsx and .xls files are supported.",
                    "error"
                );
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
 
            showStatus(
                "Validating Meesho reports...",
                "loading"
            );
 
            const [salesResult, returnResult] = await Promise.all([
                readExcelFile(salesFile),
                returnFile ?
                    readExcelFile(returnFile) :
                    Promise.resolve(null)
            ]);

            const salesRows = normalizeRows(salesResult.rows);
            const returnRows = returnResult ?
                normalizeRows(returnResult.rows) :
                [];

            validateReport(
                salesRows,
                SALES_REQUIRED,
                "Sales"
            );

            if (returnResult) {
                validateReport(
                    returnRows,
                    RETURN_REQUIRED,
                    "Return"
                );
            }

            validatedSales = salesRows;
            validatedReturns = returnRows;
 
            reportPeriod = detectPeriod(
                salesRows,
                returnRows
            );
 
            generateBtn.disabled = false;

            const returnSummaryHtml = returnResult ?
                `
                Return sheet:
                <strong>${escapeHtml(returnResult.sheetName)}</strong>
                <br>

                Return rows:
                <strong>${returnRows.length}</strong>
                <br><br>
                ` :
                `
                Return report:
                <strong>Not provided (returns = 0)</strong>
                <br><br>
                `;

            showStatus(
                `
                <strong>Reports validated successfully.</strong>
                <br><br>

                Sales sheet:
                <strong>${escapeHtml(salesResult.sheetName)}</strong>
                <br>

                Sales rows:
                <strong>${salesRows.length}</strong>
                <br><br>

                ${returnSummaryHtml}

                Report period:
                <strong>${escapeHtml(reportPeriod)}</strong>
                <br><br>
 
                Ready to generate the GST workbook.
                `,
                "success"
            );
        } catch (error) {
            console.error(error);
 
            generateBtn.disabled = true;
 
            showStatus(
                error.message ||
                "The reports could not be validated.",
                "error"
            );
        } finally {
            validateBtn.disabled = false;
        }
    });
 
    generateBtn.addEventListener("click", () => {
        try {
            if (!validatedSales.length) {
                showStatus(
                    "Validate the Sales Report before generating the workbook.",
                    "error"
                );
                return;
            }

            generateBtn.disabled = true;

            downloadSection.hidden = true;
            downloadExcelBtn.disabled = true;
            lastWorkbook = null;
            lastGeneratedFileName = "";

            showStatus(
                "Preparing the GST report...",
                "loading"
            );

            const result = calculateGST(
                validatedSales,
                validatedReturns
            );

            const workbook = buildWorkbook(result);

            const safePeriod = (
                reportPeriod || "Report"
            )
                .replace(/\s+/g, "_")
                .replace(/[^A-Za-z0-9_-]/g, "");

            lastWorkbook = workbook;
            lastGeneratedFileName =
                `InfoBridgeIndia_Meesho_GST_${safePeriod}.xlsx`;

            downloadSection.hidden = false;
            downloadExcelBtn.disabled = false;

            showStatus(
                `
                <strong>GST Report Ready.</strong>
                <br><br>

                Net taxable value:
                <strong>₹${formatMoney(result.summary.netTaxable)}</strong>
                <br>

                Net IGST:
                <strong>₹${formatMoney(result.summary.netIGST)}</strong>
                <br>

                Net CGST:
                <strong>₹${formatMoney(result.summary.netCGST)}</strong>
                <br>

                Net SGST:
                <strong>₹${formatMoney(result.summary.netSGST)}</strong>
                <br><br>

                Choose a format below to download your report.
                `,
                "success"
            );
        } catch (error) {
            console.error(error);

            downloadSection.hidden = true;
            downloadExcelBtn.disabled = true;
            lastWorkbook = null;
            lastGeneratedFileName = "";

            showStatus(
                error.message ||
                "The GST workbook could not be generated.",
                "error"
            );
        } finally {
            generateBtn.disabled = false;
        }
    });

    downloadExcelBtn.addEventListener("click", () => {
        if (!lastWorkbook || !lastGeneratedFileName) {
            showStatus(
                "Generate the GST report before downloading.",
                "error"
            );
            return;
        }

        XLSX.writeFile(
            lastWorkbook,
            lastGeneratedFileName
        );
    });

    downloadJsonBtn.addEventListener("click", () => {
        showStatus(
            "GST JSON export is pending the official GSTN GSTR-1 schema and is not available yet.",
            "error"
        );
    });
 
    async function readExcelFile(file) {
        const buffer = await file.arrayBuffer();
 
        const workbook = XLSX.read(buffer, {
            type: "array",
            cellDates: true
        });
 
        if (!workbook.SheetNames.length) {
            throw new Error(
                `${file.name} does not contain a worksheet.`
            );
        }
 
        let selectedSheetName = workbook.SheetNames[0];
        let selectedRows = [];
 
        workbook.SheetNames.forEach((sheetName) => {
            const worksheet = workbook.Sheets[sheetName];
 
            const rows = XLSX.utils.sheet_to_json(
                worksheet,
                {
                    defval: "",
                    raw: true
                }
            );
 
            if (rows.length > selectedRows.length) {
                selectedSheetName = sheetName;
                selectedRows = rows;
            }
        });
 
        if (!selectedRows.length) {
            throw new Error(
                `${file.name} does not contain data rows.`
            );
        }
 
        return {
            sheetName: selectedSheetName,
            rows: selectedRows
        };
    }
 
    function normalizeRows(rows) {
        return rows.map((row) => {
            const normalized = {};
 
            Object.keys(row).forEach((key) => {
                const normalizedKey = String(key)
                    .trim()
                    .toLowerCase()
                    .replace(/&/g, "and")
                    .replace(/[^a-z0-9]+/g, "_")
                    .replace(/^_+|_+$/g, "");
 
                normalized[normalizedKey] = row[key];
            });
 
            return normalized;
        });
    }
 
    function validateReport(
        rows,
        requiredColumns,
        reportName
    ) {
        if (!rows.length) {
            throw new Error(
                `The ${reportName} Report does not contain data rows.`
            );
        }
 
        const availableColumns = new Set();
 
        rows.slice(0, 20).forEach((row) => {
            Object.keys(row).forEach((column) => {
                availableColumns.add(column);
            });
        });
 
        const missing = requiredColumns.filter(
            (column) => !availableColumns.has(column)
        );
 
        if (missing.length) {
            throw new Error(
                `Wrong ${reportName} Report. Missing columns: ${missing.join(", ")}`
            );
        }
 
        const validRows = rows.filter((row) => {
            return (
                cleanText(row.sub_order_num) ||
                toNumber(
                    row.total_taxable_sale_value
                ) !== 0
            );
        });
 
        if (!validRows.length) {
            throw new Error(
                `The ${reportName} Report does not contain usable transaction rows.`
            );
        }
    }
        function calculateGST(salesRows, returnRows) {
        const sales = salesRows
            .map((row, index) =>
                prepareTransaction(
                    row,
                    "SALE",
                    index + 2
                )
            )
            .filter(isUsableTransaction);
 
        const returns = returnRows
            .map((row, index) =>
                prepareTransaction(
                    row,
                    "RETURN",
                    index + 2
                )
            )
            .filter(isUsableTransaction);
 
        if (!sales.length) {
            throw new Error(
                "No usable sales transactions were found."
            );
        }
 
        if (!returns.length && returnRows.length) {
            throw new Error(
                "No usable return transactions were found."
            );
        }
 
        const salesTaxable = round2(
            sum(
                sales.map(
                    (row) => row.taxableValue
                )
            )
        );
 
        const returnTaxable = round2(
            sum(
                returns.map(
                    (row) =>
                        Math.abs(row.taxableValue)
                )
            )
        );
 
        const salesIGST = round2(
            sum(
                sales.map(
                    (row) => row.igst
                )
            )
        );
 
        const salesCGST = round2(
            sum(
                sales.map(
                    (row) => row.cgst
                )
            )
        );
 
        const salesSGST = round2(
            sum(
                sales.map(
                    (row) => row.sgst
                )
            )
        );
 
        const salesCess = round2(
            sum(
                sales.map(
                    (row) => row.cess
                )
            )
        );
 
        const returnIGST = round2(
            sum(
                returns.map(
                    (row) =>
                        Math.abs(row.igst)
                )
            )
        );
 
        const returnCGST = round2(
            sum(
                returns.map(
                    (row) =>
                        Math.abs(row.cgst)
                )
            )
        );
 
        const returnSGST = round2(
            sum(
                returns.map(
                    (row) =>
                        Math.abs(row.sgst)
                )
            )
        );
 
        const returnCess = round2(
            sum(
                returns.map(
                    (row) =>
                        Math.abs(row.cess)
                )
            )
        );
 
        return {
            period: reportPeriod,
 
            summary: {
                salesTaxable,
 
                returnTaxable,
 
                netTaxable: round2(
                    salesTaxable -
                    returnTaxable
                ),
 
                salesIGST,
 
                returnIGST,
 
                netIGST: round2(
                    salesIGST -
                    returnIGST
                ),
 
                salesCGST,
 
                returnCGST,
 
                netCGST: round2(
                    salesCGST -
                    returnCGST
                ),
 
                salesSGST,
 
                returnSGST,
 
                netSGST: round2(
                    salesSGST -
                    returnSGST
                ),
 
                salesCess,
 
                returnCess,
 
                netCess: round2(
                    salesCess -
                    returnCess
                ),
 
                salesDocumentCount:
                    uniqueCount(
                        sales.map(
                            (row) =>
                                row.documentNumber
                        )
                    ),
 
                returnDocumentCount:
                    uniqueCount(
                        returns.map(
                            (row) =>
                                row.documentNumber
                        )
                    )
            },
 
            b2c: groupB2C(
                sales,
                returns
            ),
 
            hsn: groupHSN(
                sales,
                returns
            ),
 
            eco: groupECO(
                sales,
                returns
            ),
 
            documents: buildDocuments(
                sales,
                returns
            )
        };
    }
 
    function prepareTransaction(
        row,
        type,
        sourceRow
    ) {
        const gstRate = Math.abs(
            toNumber(row.gst_rate)
        );
 
        const rawTaxable = toNumber(
            row.total_taxable_sale_value
        );
 
        const taxableValue =
            type === "RETURN"
                ? Math.abs(rawTaxable)
                : rawTaxable;
 
        const state = normalizeStateName(
            cleanText(
                row.end_customer_state_new
            ) ||
            cleanText(
                row.place_of_supply
            ) ||
            cleanText(
                row.customer_state
            )
        );
 
        const stateCode = getStateCode(
            state
        );
 
        let igst = toNumber(
            firstValue(
                row,
                [
                    "igst",
                    "igst_amount",
                    "integrated_tax"
                ]
            )
        );
 
        let cgst = toNumber(
            firstValue(
                row,
                [
                    "cgst",
                    "cgst_amount",
                    "central_tax"
                ]
            )
        );
 
        let sgst = toNumber(
            firstValue(
                row,
                [
                    "sgst",
                    "sgst_amount",
                    "utgst",
                    "utgst_amount",
                    "state_tax"
                ]
            )
        );
 
        let cess = toNumber(
            firstValue(
                row,
                [
                    "cess",
                    "cess_amount"
                ]
            )
        );
 
        const reportTax = toNumber(
            firstValue(
                row,
                [
                    "tax_amount",
                    "total_tax_amount",
                    "total_gst_amount",
                    "gst_amount"
                ]
            )
        );
 
        const hasComponentTax =
            Math.abs(igst) +
            Math.abs(cgst) +
            Math.abs(sgst) +
            Math.abs(cess) > 0;
 
        if (
            !hasComponentTax &&
            gstRate > 0 &&
            taxableValue !== 0
        ) {
            const computedTax =
                reportTax !== 0
                    ? Math.abs(reportTax)
                    : Math.abs(
                        taxableValue
                    ) *
                    gstRate /
                    100;
 
            const sign =
                type === "RETURN"
                    ? 1
                    : Math.sign(
                        taxableValue
                    ) || 1;
 
            if (
                isIntraState(
                    row,
                    state,
                    stateCode
                )
            ) {
                cgst =
                    sign *
                    computedTax /
                    2;
 
                sgst =
                    sign *
                    computedTax /
                    2;
 
                igst = 0;
            } else {
                igst =
                    sign *
                    computedTax;
 
                cgst = 0;
                sgst = 0;
            }
        } else {
            if (type === "RETURN") {
                igst = Math.abs(igst);
                cgst = Math.abs(cgst);
                sgst = Math.abs(sgst);
                cess = Math.abs(cess);
            }
        }
 
        const quantityValue = toNumber(
            firstValue(
                row,
                [
                    "quantity",
                    "qty",
                    "item_quantity",
                    "ordered_quantity",
                    "product_quantity"
                ]
            )
        );
 
        const quantity =
            type === "RETURN"
                ? Math.abs(
                    quantityValue || 1
                )
                : quantityValue ||
                (
                    taxableValue === 0
                        ? 0
                        : Math.sign(
                            taxableValue
                        )
                );
 
        const ecoGSTIN = normalizeGSTIN(
            firstValue(
                row,
                [
                    "eco_tcs_gstin",
                    "ecommerce_gstin",
                    "e_commerce_gstin",
                    "e_commerce_operator_gstin",
                    "eco_gstin",
                    "operator_gstin",
                    "marketplace_gstin"
                ]
            )
        );
 
        const invoiceNumber = cleanText(
            firstValue(
                row,
                [
                    "invoice_number",
                    "invoice_no",
                    "supplier_invoice_number",
                    "tax_invoice_number"
                ]
            )
        );
 
        const subOrderNumber = cleanText(
            row.sub_order_num
        );
 
        return {
            type,
 
            sourceRow,
 
            documentNumber:
                invoiceNumber ||
                subOrderNumber,
 
            subOrderNumber,
 
            orderDate:
                parseReportDate(
                    row.order_date
                ),
 
            returnDate:
                parseReportDate(
                    row.cancel_return_date
                ),
 
            hsnCode:
                cleanText(
                    row.hsn_code
                ),
 
            gstRate:
                round2(gstRate),
 
            state:
                state || "Unknown",
 
            stateCode,
 
            taxableValue:
                round2(
                    taxableValue
                ),
 
            igst:
                round2(igst),
 
            cgst:
                round2(cgst),
 
            sgst:
                round2(sgst),
 
            cess:
                round2(cess),
 
            quantity:
                round2(quantity),
 
            uqc:
                cleanText(
                    firstValue(
                        row,
                        [
                            "uqc",
                            "unit",
                            "unit_of_measurement"
                        ]
                    )
                ) ||
                "NOS-NUMBERS",
 
            description:
                cleanText(
                    firstValue(
                        row,
                        [
                            "product_name",
                            "item_name",
                            "product_description",
                            "description"
                        ]
                    )
                ),
 
            ecoGSTIN
        };
    }
 
    function isUsableTransaction(row) {
        return Boolean(
            row.documentNumber ||
            row.hsnCode ||
            row.taxableValue !== 0 ||
            row.igst !== 0 ||
            row.cgst !== 0 ||
            row.sgst !== 0
        );
    }
 
    function groupB2C(sales, returns) {
        const groups = new Map();
 
        sales.forEach((row) => addB2C(groups, row, false));
        returns.forEach((row) => addB2C(groups, row, true));
 
        return Array.from(groups.values())
            .map((group) => ({
                placeOfSupply: formatPlaceOfSupply(
                    group.stateCode,
                    toTitleCase(group.state)
                ),
                taxableValue: round2(group.taxableValue),
                gstRate: group.gstRate,
                status: "ENTER IN PORTAL"
            }))
            .filter((row) => Math.abs(row.taxableValue) >= 0.01)
            .sort((a, b) => {
                return (
                    a.placeOfSupply.localeCompare(b.placeOfSupply) ||
                    a.gstRate - b.gstRate
                );
            });
    }
 
    function addB2C(groups, row, isReturn) {
        const key = `${row.stateCode}|${row.state}|${row.gstRate}`;
 
        if (!groups.has(key)) {
            groups.set(key, {
                state: row.state,
                stateCode: row.stateCode,
                gstRate: row.gstRate,
                taxableValue: 0
            });
        }
 
        const group = groups.get(key);
        const amount = Math.abs(row.taxableValue);
 
        group.taxableValue += isReturn ? -amount : row.taxableValue;
    }
 
    function toTitleCase(value) {
        return cleanText(value)
            .toLowerCase()
            .replace(/\b\w/g, (letter) => letter.toUpperCase());
    }
 
    function groupHSN(sales, returns) {
        const groups = new Map();
 
        sales.forEach((row) => addHSN(groups, row, false));
        returns.forEach((row) => addHSN(groups, row, true));
 
        return Array.from(groups.values())
            .map((group) => ({
                hsnCode: group.hsnCode || "Missing",
                uqc: group.uqc || "NOS-NUMBERS",
                totalQuantity: round2(group.quantity),
                totalTaxableValue: round2(group.taxableValue),
                gstRate: group.gstRate,
                igst: round2(group.igst),
                cgst: round2(group.cgst),
                sgst: round2(group.sgst),
                status: "ENTER IN PORTAL"
            }))
            .filter((row) => {
                return [
                    row.totalQuantity,
                    row.totalTaxableValue,
                    row.igst,
                    row.cgst,
                    row.sgst
                ].some((value) => Math.abs(value) >= 0.01);
            })
            .sort((a, b) => {
                return (
                    String(a.hsnCode).localeCompare(
                        String(b.hsnCode),
                        undefined,
                        { numeric: true }
                    ) ||
                    a.gstRate - b.gstRate
                );
            });
    }
 
    function addHSN(groups, row, isReturn) {
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
                sgst: 0
            });
        }
 
        const group = groups.get(key);
        const sign = isReturn ? -1 : 1;
 
        group.quantity += sign * Math.abs(row.quantity);
        group.taxableValue += sign * Math.abs(row.taxableValue);
        group.igst += sign * Math.abs(row.igst);
        group.cgst += sign * Math.abs(row.cgst);
        group.sgst += sign * Math.abs(row.sgst);
    }
 
    function groupECO(sales, returns) {
        const allRows = [
            ...sales.map((row) => ({ row, sign: 1 })),
            ...returns.map((row) => ({ row, sign: -1 }))
        ];
 
        const firstGSTIN = allRows
            .map((item) => item.row.ecoGSTIN)
            .find(Boolean) || "33AARCM9332R1CV";
 
        const total = allRows.reduce(
            (summary, item) => {
                const { row, sign } = item;
 
                summary.netTaxable += sign * Math.abs(row.taxableValue);
                summary.igst += sign * Math.abs(row.igst);
                summary.cgst += sign * Math.abs(row.cgst);
                summary.sgst += sign * Math.abs(row.sgst);
                summary.cess += sign * Math.abs(row.cess);
 
                return summary;
            },
            {
                netTaxable: 0,
                igst: 0,
                cgst: 0,
                sgst: 0,
                cess: 0
            }
        );
 
        if (
            Math.abs(total.netTaxable) < 0.01 &&
            Math.abs(total.igst) < 0.01 &&
            Math.abs(total.cgst) < 0.01 &&
            Math.abs(total.sgst) < 0.01 &&
            Math.abs(total.cess) < 0.01
        ) {
            return [];
        }
 
        return [
            {
                ecoGSTIN: firstGSTIN,
                tradeName: "MEESHO",
                netTaxable: round2(total.netTaxable),
                igst: round2(total.igst),
                cgst: round2(total.cgst),
                sgst: round2(total.sgst),
                cess: round2(total.cess)
            }
        ];
    }
 
    function buildDocuments(sales, returns) {
        const salesDocuments = uniqueSorted(
            sales.map((row) => row.documentNumber)
        );
 
        const returnDocuments = uniqueSorted(
            returns.map((row) => row.documentNumber)
        );
 
        return [
            {
                nature: "Invoices for Outward Supply",
                from: salesDocuments[0] || "",
                to: salesDocuments[salesDocuments.length - 1] || "",
                total: salesDocuments.length,
                cancelled: 0,
                netIssued: salesDocuments.length
            },
            {
                nature: "Credit Notes / Return Documents",
                from: returnDocuments[0] || "",
                to: returnDocuments[returnDocuments.length - 1] || "",
                total: returnDocuments.length,
                cancelled: 0,
                netIssued: returnDocuments.length
            }
        ];
    }
        function buildWorkbook(result) {
        const workbook = XLSX.utils.book_new();
 
        appendB2CSheet(workbook, result.b2c);
        appendHSNSheet(workbook, result.hsn);
        appendECOSheet(workbook, result.eco);
 
        workbook.Props = {
            Title: "InfoBridgeIndia Meesho GST Workbook",
            Subject: "Meesho GST Portal Ready Working Sheets",
            Author: "InfoBridgeIndia",
            Company: "InfoBridgeIndia",
            Comments: "Generated from Meesho Sales and Return reports."
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
            [30, 20, 22, 18, 16, 16, 12],
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
        const safeRows = rows.length
            ? rows
            : [["No reportable transactions"]];
 
        const sheet = XLSX.utils.aoa_to_sheet([
            headers,
            ...safeRows
        ]);
 
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
                    const address = XLSX.utils.encode_cell({
                        r: row,
                        c: column
                    });
 
                    if (sheet[address] && sheet[address].t === "n") {
                        sheet[address].z = "#,##0.00";
                    }
                });
            }
        }
 
        XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
    }
 
    function detectPeriod(
        salesRows,
        returnRows
    ) {
        const dates = [
            ...salesRows.map(
                (row) =>
                    parseReportDate(
                        row.order_date
                    )
            ),
            ...returnRows.map(
                (row) =>
                    parseReportDate(
                        row.cancel_return_date
                    )
            )
        ].filter(Boolean);
 
        if (!dates.length) {
            return "Unknown Period";
        }
 
        const counts = new Map();
 
        dates.forEach((date) => {
            const key =
                `${date.getFullYear()}-` +
                `${String(
                    date.getMonth() + 1
                ).padStart(2, "0")}`;
 
            counts.set(
                key,
                (counts.get(key) || 0) + 1
            );
        });
 
        const periodKey =
            Array.from(
                counts.entries()
            )
                .sort(
                    (a, b) =>
                        b[1] - a[1]
                )[0][0];
 
        const [
            year,
            month
        ] = periodKey
            .split("-")
            .map(Number);
 
        return new Date(
            year,
            month - 1,
            1
        ).toLocaleString(
            "en-US",
            {
                month: "long",
                year: "numeric"
            }
        );
    }
 
    function parseReportDate(value) {
        if (!value) {
            return null;
        }
 
        if (
            value instanceof Date &&
            !Number.isNaN(
                value.getTime()
            )
        ) {
            return value;
        }
 
        if (
            typeof value === "number" &&
            typeof XLSX !== "undefined"
        ) {
            const parsed =
                XLSX.SSF.parse_date_code(
                    value
                );
 
            if (parsed) {
                return new Date(
                    parsed.y,
                    parsed.m - 1,
                    parsed.d
                );
            }
        }
 
        const text =
            String(value).trim();
 
        const ymd =
            text.match(
                /^(\d{4})[\/.-](\d{1,2})[\/.-](\d{1,2})/
            );
 
        if (ymd) {
            return validDate(
                Number(ymd[1]),
                Number(ymd[2]),
                Number(ymd[3])
            );
        }
 
        const dmy =
            text.match(
                /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/
            );
 
        if (dmy) {
            let year =
                Number(dmy[3]);
 
            if (year < 100) {
                year += 2000;
            }
 
            return validDate(
                year,
                Number(dmy[2]),
                Number(dmy[1])
            );
        }
 
        const direct =
            new Date(text);
 
        return Number.isNaN(
            direct.getTime()
        )
            ? null
            : direct;
    }
 
    function validDate(
        year,
        month,
        day
    ) {
        const date =
            new Date(
                year,
                month - 1,
                day
            );
 
        if (
            date.getFullYear() === year &&
            date.getMonth() ===
                month - 1 &&
            date.getDate() === day
        ) {
            return date;
        }
 
        return null;
    }
 
    function isIntraState(row, customerState, customerStateCode) {
        const supplierState = normalizeStateName(
            firstValue(row, [
                "supplier_state",
                "seller_state",
                "gstin_state",
                "merchant_state"
            ])
        );
 
        if (supplierState && customerState) {
            return supplierState === customerState;
        }
 
        const supplierGSTIN = cleanText(
            firstValue(row, [
                "gstin",
                "seller_gstin",
                "supplier_gstin",
                "merchant_gstin"
            ])
        )
            .toUpperCase()
            .replace(/\s+/g, "");
 
        const supplierStateCode = /^\d{2}/.test(supplierGSTIN)
            ? supplierGSTIN.slice(0, 2)
            : "";
 
        if (supplierStateCode && customerStateCode) {
            return supplierStateCode === customerStateCode;
        }
 
        return customerStateCode === "33";
    }
 
    function normalizeStateName(value) {
        const text =
            cleanText(value)
                .toUpperCase()
                .replace(/&/g, "AND")
                .replace(/\./g, "")
                .replace(/\s+/g, " ");
 
        const aliases = {
            "ANDAMAN & NICOBAR ISLANDS":
                "ANDAMAN AND NICOBAR ISLANDS",
 
            "ANDAMAN NICOBAR":
                "ANDAMAN AND NICOBAR ISLANDS",
 
            "ANDHRA":
                "ANDHRA PRADESH",
 
            "ARUNACHAL":
                "ARUNACHAL PRADESH",
 
            "CHATTISGARH":
                "CHHATTISGARH",
 
            "DADRA & NAGAR HAVELI AND DAMAN & DIU":
                "DADRA AND NAGAR HAVELI AND DAMAN AND DIU",
 
            "DADRA AND NAGAR HAVELI":
                "DADRA AND NAGAR HAVELI AND DAMAN AND DIU",
 
            "DAMAN AND DIU":
                "DADRA AND NAGAR HAVELI AND DAMAN AND DIU",
 
            "JAMMU & KASHMIR":
                "JAMMU AND KASHMIR",
 
            "NEW DELHI":
                "DELHI",
 
            "ORISSA":
                "ODISHA",
 
            "PONDICHERRY":
                "PUDUCHERRY",
 
            "TAMILNADU":
                "TAMIL NADU",
 
            "UTTARANCHAL":
                "UTTARAKHAND",
 
            "WESTBENGAL":
                "WEST BENGAL"
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
 
        return (
            stateCodes[
                normalizeStateName(
                    stateName
                )
            ] || ""
        );
    }
 
    function formatPlaceOfSupply(
        code,
        state
    ) {
        return code
            ? `${code}-${state}`
            : state;
    }
 
    function firstValue(
        row,
        columns
    ) {
        for (
            const column of columns
        ) {
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
 
    function normalizeGSTIN(value) {
        const gstin =
            cleanText(value)
                .toUpperCase()
                .replace(/\s+/g, "");
 
        return /^[0-9]{2}[A-Z0-9]{13}$/.test(
            gstin
        )
            ? gstin
            : "";
    }
 
    function toNumber(value) {
        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {
            return 0;
        }
 
        if (
            typeof value === "number"
        ) {
            return Number.isFinite(value)
                ? value
                : 0;
        }
 
        let text =
            String(value)
                .replace(/₹/g, "")
                .replace(/,/g, "")
                .replace(/%/g, "")
                .replace(/\s+/g, "")
                .trim();
 
        if (
            text.startsWith("(") &&
            text.endsWith(")")
        ) {
            text =
                `-${text.slice(1, -1)}`;
        }
 
        const number =
            Number(text);
 
        return Number.isFinite(number)
            ? number
            : 0;
    }
 
    function cleanText(value) {
        return (
            value === null ||
            value === undefined
        )
            ? ""
            : String(value).trim();
    }
 
    function sum(values) {
        return values.reduce(
            (total, value) =>
                total + toNumber(value),
            0
        );
    }
 
    function round2(value) {
        return (
            Math.round(
                (
                    toNumber(value) +
                    Number.EPSILON
                ) * 100
            ) / 100
        );
    }
 
    function formatMoney(value) {
        return round2(value)
            .toLocaleString(
                "en-IN",
                {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                }
            );
    }
 
    function uniqueCount(values) {
        return new Set(
            values
                .map(cleanText)
                .filter(Boolean)
        ).size;
    }
 
    function uniqueSorted(values) {
        return Array.from(
            new Set(
                values
                    .map(cleanText)
                    .filter(Boolean)
            )
        ).sort(
            (a, b) =>
                a.localeCompare(
                    b,
                    undefined,
                    {
                        numeric: true
                    }
                )
        );
    }
 
    function isExcelFile(fileName) {
        return /\.(xlsx|xls)$/i.test(
            fileName
        );
    }
 
    function resetEngine() {
        validatedSales = [];
        validatedReturns = [];
        reportPeriod = "";
        lastWorkbook = null;
        lastGeneratedFileName = "";

        generateBtn.disabled = true;

        downloadSection.hidden = true;
        downloadExcelBtn.disabled = true;

        statusBox.className = "";
        statusBox.innerHTML = "";
        statusBox.style.display = "none";
    }
 
    function showStatus(
        message,
        type
    ) {
        statusBox.className = "";
 
        if (type === "success") {
            statusBox.classList.add(
                "status-success"
            );
        } else if (
            type === "error"
        ) {
            statusBox.classList.add(
                "status-error"
            );
        } else {
            statusBox.classList.add(
                "status-loading"
            );
        }
 
        statusBox.innerHTML = message;
        statusBox.style.display = "block";
 
        statusBox.scrollIntoView({
            behavior: "smooth",
            block: "center"
        });
    }
 
    function escapeHtml(value) {
        const element =
            document.createElement("div");
 
        element.textContent =
            String(value);
 
        return element.innerHTML;
    }
});
