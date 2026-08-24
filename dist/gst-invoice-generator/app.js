(() => { "use strict";

  /* =========================================================
     INFOBRIDGEINDIA GST INVOICE - migrated from the original
     InfoBridgeIndia website (js/gst-invoice.js). Every calculation,
     validation, live-preview and amount-in-words function below is the
     original working logic, unchanged.

     Adaptation note: the original "Download PDF" button loaded jsPDF from
     an external CDN at runtime. This project runs with zero external
     network dependencies (every other module is hand-built for the same
     reason), so PDF download here uses the browser's native print-to-PDF
     instead (same mechanism as "Print Invoice" - the print stylesheet
     already produces a clean single-page A4 invoice). Everything else is
     unchanged from the original.
     - No GSTIN format blocking
     - Searchable state fields on desktop and mobile
     - Multiple product add/remove
     - Live preview
     - CGST + SGST / IGST calculation
     ========================================================= */

  const STATES = [
    ["01", "Jammu and Kashmir"],
    ["02", "Himachal Pradesh"],
    ["03", "Punjab"],
    ["04", "Chandigarh"],
    ["05", "Uttarakhand"],
    ["06", "Haryana"],
    ["07", "Delhi"],
    ["08", "Rajasthan"],
    ["09", "Uttar Pradesh"],
    ["10", "Bihar"],
    ["11", "Sikkim"],
    ["12", "Arunachal Pradesh"],
    ["13", "Nagaland"],
    ["14", "Manipur"],
    ["15", "Mizoram"],
    ["16", "Tripura"],
    ["17", "Meghalaya"],
    ["18", "Assam"],
    ["19", "West Bengal"],
    ["20", "Jharkhand"],
    ["21", "Odisha"],
    ["22", "Chhattisgarh"],
    ["23", "Madhya Pradesh"],
    ["24", "Gujarat"],
    ["26", "Dadra and Nagar Haveli and Daman and Diu"],
    ["27", "Maharashtra"],
    ["28", "Andhra Pradesh (Old)"],
    ["29", "Karnataka"],
    ["30", "Goa"],
    ["31", "Lakshadweep"],
    ["32", "Kerala"],
    ["33", "Tamil Nadu"],
    ["34", "Puducherry"],
    ["35", "Andaman and Nicobar Islands"],
    ["36", "Telangana"],
    ["37", "Andhra Pradesh"],
    ["38", "Ladakh"],
    ["97", "Other Territory"]
  ];

  const $ = (id) => document.getElementById(id);

  const form = $("invoiceForm");
  const invoicePreview = $("invoicePreview");
  const addedItemsBody = $("addedItemsBody");
  const previewItemsBody = $("previewItemsBody");
  const itemError = $("itemError") || $("errorMessage");
  const formError = $("formError");
  const pdfStatus = $("pdfStatus");

  if (!form || !invoicePreview) {
    console.error("GST Invoice: Required HTML elements are missing.");
    return;
  }

  const fields = {
    sellerName: $("sellerName"),
    sellerGstin: $("sellerGstin"),
    sellerAddress: $("sellerAddress"),
    sellerState: $("sellerState"),
    sellerContact: $("sellerContact"),
    invoiceNumber: $("invoiceNumber"),
    invoiceDate: $("invoiceDate"),
    customerName: $("customerName"),
    customerGstin: $("customerGstin"),
    customerAddress: $("customerAddress"),
    placeOfSupply: $("placeOfSupply"),
    reverseCharge: $("reverseCharge"),
    bankName: $("bankName"),
    bankAccount: $("bankAccount"),
    bankIfsc: $("bankIfsc"),
    signatoryName: $("signatoryName"),
    terms: $("terms"),
    notes: $("notes")
  };

  const itemFields = {
    description: $("itemDescription"),
    hsn: $("itemHsn"),
    qty: $("itemQty"),
    unit: $("itemUnit"),
    rate: $("itemRate"),
    discount: $("itemDiscount"),
    gstRate: $("itemGstRate")
  };

  let items = [];

  /* -----------------------------
     BASIC HELPERS
     ----------------------------- */

  function textValue(element) {
    return element ? String(element.value || "").trim() : "";
  }

  function setText(id, value, fallback = "—") {
    const element = $(id);
    if (!element) return;
    const clean = String(value || "").trim();
    element.textContent = clean || fallback;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function money(value) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(Number(value) || 0);
  }

  function plainNumber(value) {
    return new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(Number(value) || 0);
  }

  function formatDate(value) {
    if (!value) return "—";
    const parts = value.split("-");
    if (parts.length !== 3) return value;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  function normalizeReference(value) {
    return String(value || "").toUpperCase();
  }

  function stateDisplay(code, name) {
    return `${name} (${code})`;
  }

  function findState(value) {
    const clean = String(value || "").trim().toLowerCase();
    if (!clean) return null;

    return STATES.find(([code, name]) => {
      const display = stateDisplay(code, name).toLowerCase();
      return clean === code.toLowerCase()
        || clean === name.toLowerCase()
        || clean === display
        || clean.endsWith(`(${code})`);
    }) || null;
  }

  function stateCode(value) {
    const found = findState(value);
    return found ? found[0] : "";
  }

  function stateLabel(value) {
    const found = findState(value);
    return found ? stateDisplay(found[0], found[1]) : (String(value || "").trim() || "—");
  }

  /* -----------------------------
     SEARCHABLE STATE FIELDS
     ----------------------------- */

  function prepareStateField(element, listId, placeholder) {
    if (!element) return;

    if (element.tagName === "SELECT") {
      element.innerHTML = `<option value="">${placeholder}</option>`;
      STATES.forEach(([code, name]) => {
        const option = document.createElement("option");
        option.value = code;
        option.textContent = stateDisplay(code, name);
        element.appendChild(option);
      });
      return;
    }

    let dataList = $(listId);
    if (!dataList) {
      dataList = document.createElement("datalist");
      dataList.id = listId;
      document.body.appendChild(dataList);
    }

    dataList.innerHTML = "";
    STATES.forEach(([code, name]) => {
      const option = document.createElement("option");
      option.value = stateDisplay(code, name);
      dataList.appendChild(option);
    });

    element.setAttribute("list", listId);
    element.setAttribute("autocomplete", "off");
    element.setAttribute("inputmode", "text");
    element.placeholder = placeholder;
  }

  function readStateValue(element) {
    if (!element) return "";
    if (element.tagName === "SELECT") {
      const code = element.value;
      const found = STATES.find(([stateCodeValue]) => stateCodeValue === code);
      return found ? stateDisplay(found[0], found[1]) : "";
    }
    return element.value;
  }

  function tidyStateField(element) {
    if (!element || element.tagName === "SELECT") return;
    const found = findState(element.value);
    if (found) element.value = stateDisplay(found[0], found[1]);
  }

  /* -----------------------------
     DEFAULTS
     ----------------------------- */

  function setDefaults() {
    const now = new Date();
    const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 10);

    if (fields.invoiceDate) fields.invoiceDate.value = localDate;

    if (fields.invoiceNumber) {
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      fields.invoiceNumber.value = `INV-${year}${month}${day}-01`.slice(0, 16);
    }

    if (fields.notes && !fields.notes.value) {
      fields.notes.value = "Thank you for your business.";
    }

    if (fields.terms && !fields.terms.value) {
      fields.terms.value =
        "1. Payment is due within 15 days.\n" +
        "2. Goods once sold will not be taken back.";
    }

    if (itemFields.qty) itemFields.qty.value = "1";
    if (itemFields.discount) itemFields.discount.value = "0";
    if (itemFields.gstRate) itemFields.gstRate.value = "18";
  }

  /* -----------------------------
     ITEM CALCULATION
     ----------------------------- */

  function showItemError(message) {
    if (!itemError) return;
    itemError.textContent = message;
    itemError.classList.add("show");
  }

  function clearItemError() {
    if (!itemError) return;
    itemError.textContent = "";
    itemError.classList.remove("show");
  }

  function addItem() {
    clearItemError();

    const description = textValue(itemFields.description);
    const hsn = textValue(itemFields.hsn);
    const qty = Number(itemFields.qty?.value || 0);
    const unit = textValue(itemFields.unit) || "NOS";
    const rate = Number(itemFields.rate?.value || 0);
    const discount = Number(itemFields.discount?.value || 0);
    const gstRate = Number(itemFields.gstRate?.value || 0);

    if (!description) {
      showItemError("Enter the product or service description.");
      itemFields.description?.focus();
      return;
    }

    if (!hsn) {
      showItemError("Enter the HSN or SAC code.");
      itemFields.hsn?.focus();
      return;
    }

    if (!Number.isFinite(qty) || qty <= 0) {
      showItemError("Quantity must be greater than zero.");
      itemFields.qty?.focus();
      return;
    }

    if (!Number.isFinite(rate) || rate < 0) {
      showItemError("Enter a valid rate.");
      itemFields.rate?.focus();
      return;
    }

    if (!Number.isFinite(discount) || discount < 0 || discount > 100) {
      showItemError("Discount must be between 0 and 100.");
      itemFields.discount?.focus();
      return;
    }

    const gross = qty * rate;
    const discountAmount = gross * discount / 100;
    const taxable = gross - discountAmount;
    const taxAmount = taxable * gstRate / 100;
    const total = taxable + taxAmount;

    items.push({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      description,
      hsn,
      qty,
      unit,
      rate,
      discount,
      gstRate,
      gross,
      discountAmount,
      taxable,
      taxAmount,
      total
    });

    if (itemFields.description) itemFields.description.value = "";
    if (itemFields.hsn) itemFields.hsn.value = "";
    if (itemFields.qty) itemFields.qty.value = "1";
    if (itemFields.unit) itemFields.unit.value = "NOS";
    if (itemFields.rate) itemFields.rate.value = "";
    if (itemFields.discount) itemFields.discount.value = "0";
    if (itemFields.gstRate) itemFields.gstRate.value = "18";

    renderItems();
    itemFields.description?.focus();
  }

  function removeItem(id) {
    items = items.filter((item) => item.id !== id);
    renderItems();
  }

  function renderItems() {
    if (!items.length) {
      if (addedItemsBody) {
        addedItemsBody.innerHTML =
          `<tr><td class="empty-cell" colspan="9">No products added yet.</td></tr>`;
      }

      if (previewItemsBody) {
        previewItemsBody.innerHTML =
          `<tr><td class="preview-empty" colspan="9">Add a product to generate the invoice.</td></tr>`;
      }

      updateTotals();
      return;
    }

    if (addedItemsBody) {
      addedItemsBody.innerHTML = items.map((item, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(item.description)}</td>
          <td>${escapeHtml(item.hsn)}</td>
          <td>${plainNumber(item.qty)} ${escapeHtml(item.unit)}</td>
          <td>${money(item.rate)}</td>
          <td>${item.discount.toFixed(2)}%</td>
          <td>${item.gstRate.toFixed(2)}%</td>
          <td>${money(item.taxable)}</td>
          <td>
            <button class="remove-item" type="button" data-id="${escapeHtml(item.id)}">×</button>
          </td>
        </tr>
      `).join("");
    }

    if (previewItemsBody) {
      previewItemsBody.innerHTML = items.map((item, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(item.description)}</td>
          <td>${escapeHtml(item.hsn)}</td>
          <td>${plainNumber(item.qty)} ${escapeHtml(item.unit)}</td>
          <td>${plainNumber(item.rate)}</td>
          <td>${item.discount.toFixed(2)}%</td>
          <td>${plainNumber(item.taxable)}</td>
          <td>${item.gstRate.toFixed(2)}%<br>${plainNumber(item.taxAmount)}</td>
          <td>${plainNumber(item.total)}</td>
        </tr>
      `).join("");
    }

    updateTotals();
  }

  function totals() {
    return items.reduce((sum, item) => {
      sum.gross += item.gross;
      sum.discount += item.discountAmount;
      sum.taxable += item.taxable;
      sum.tax += item.taxAmount;
      sum.grand += item.total;
      return sum;
    }, {
      gross: 0,
      discount: 0,
      taxable: 0,
      tax: 0,
      grand: 0
    });
  }

  function taxMode() {
    const sellerValue = readStateValue(fields.sellerState);
    const supplyValue = readStateValue(fields.placeOfSupply);
    const sellerCode = stateCode(sellerValue);
    const supplyCode = stateCode(supplyValue);

    if (!sellerCode || !supplyCode) return "unknown";
    return sellerCode === supplyCode ? "intra" : "inter";
  }

  function updateTotals() {
    const total = totals();
    const mode = taxMode();

    const cgst = mode === "intra" ? total.tax / 2 : 0;
    const sgst = mode === "intra" ? total.tax / 2 : 0;
    const igst = mode === "inter" ? total.tax : 0;

    setText("previewGrossTotal", money(total.gross), money(0));
    setText("previewDiscountTotal", money(total.discount), money(0));
    setText("previewTaxableTotal", money(total.taxable), money(0));
    setText("previewCgst", money(cgst), money(0));
    setText("previewSgst", money(sgst), money(0));
    setText("previewIgst", money(igst), money(0));
    setText("previewGrandTotal", money(total.grand), money(0));
    setText("amountInWords", numberWords(Math.round(total.grand)), "Rupees Zero Only");

    invoicePreview.classList.toggle("inter-state", mode === "inter");

    const badge = $("taxModeBadge");
    if (badge) {
      badge.classList.remove("intra", "inter");

      if (mode === "intra") {
        badge.textContent = "CGST + SGST";
        badge.classList.add("intra");
      } else if (mode === "inter") {
        badge.textContent = "IGST";
        badge.classList.add("inter");
      } else {
        badge.textContent = "Select states";
      }
    }
  }

  /* -----------------------------
     LIVE PREVIEW
     ----------------------------- */

  function updatePreview() {
    if (fields.sellerGstin) {
      fields.sellerGstin.value = normalizeReference(fields.sellerGstin.value);
    }

    if (fields.customerGstin) {
      fields.customerGstin.value = normalizeReference(fields.customerGstin.value);
    }

    if (fields.bankIfsc) {
      fields.bankIfsc.value = normalizeReference(fields.bankIfsc.value);
    }

    setText("previewSellerName", textValue(fields.sellerName), "YOUR BUSINESS NAME");
    setText("previewSellerAddress", textValue(fields.sellerAddress), "Business address will appear here.");
    setText("previewSellerContact", textValue(fields.sellerContact), "");
    setText("previewSellerGstin", textValue(fields.sellerGstin), "—");

    setText("previewInvoiceNumber", textValue(fields.invoiceNumber), "—");
    setText("previewInvoiceDate", formatDate(fields.invoiceDate?.value), "—");
    setText(
      "previewPlaceOfSupply",
      stateLabel(readStateValue(fields.placeOfSupply)),
      "—"
    );
    setText("previewReverseCharge", textValue(fields.reverseCharge), "No");

    setText("previewCustomerName", textValue(fields.customerName), "CUSTOMER NAME");
    setText("previewCustomerAddress", textValue(fields.customerAddress), "Customer address will appear here.");
    setText("previewCustomerGstin", textValue(fields.customerGstin), "Unregistered");

    setText("previewBankName", textValue(fields.bankName), "—");
    setText("previewBankAccount", textValue(fields.bankAccount), "—");
    setText("previewBankIfsc", textValue(fields.bankIfsc), "—");
    setText("previewSignatureBusiness", textValue(fields.sellerName), "Your Business");
    setText("previewSignatoryName", textValue(fields.signatoryName), "Authorized Signatory");
    setText("previewTerms", textValue(fields.terms), "Payment terms will appear here.");
    setText("previewNotes", textValue(fields.notes), "Thank you for your business.");

    updateTotals();
  }

  /* -----------------------------
     VALIDATION
     ----------------------------- */

  function clearValidation() {
    form.querySelectorAll(".invalid").forEach((element) => {
      element.classList.remove("invalid");
    });

    if (formError) {
      formError.textContent = "";
      formError.classList.remove("show");
    }
  }

  function validateInvoice() {
    clearValidation();

    const required = [
      fields.sellerName,
      fields.sellerGstin,
      fields.sellerAddress,
      fields.sellerState,
      fields.invoiceNumber,
      fields.invoiceDate,
      fields.customerName,
      fields.customerAddress,
      fields.placeOfSupply
    ].filter(Boolean);

    const missing = required.filter((element) => !textValue(element));

    if (missing.length) {
      missing.forEach((element) => element.classList.add("invalid"));

      if (formError) {
        formError.textContent = "Complete all required fields marked with *.";
        formError.classList.add("show");
      }

      missing[0].focus();
      return false;
    }

    if (!items.length) {
      if (formError) {
        formError.textContent = "Add at least one product or service.";
        formError.classList.add("show");
      }

      itemFields.description?.focus();
      return false;
    }

    return true;
  }

  function previewInvoiceAction() {
    updatePreview();
    if (!validateInvoice()) return;

    invoicePreview.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  function printInvoice() {
    updatePreview();
    if (!validateInvoice()) return;
    window.print();
  }

  /* -----------------------------
     DOWNLOAD AS PDF
     Uses the browser's native print-to-PDF (choose "Save as PDF" in the
     print dialog) instead of loading a PDF-drawing library from an
     external CDN, so this works fully offline like every other tool.
     The print stylesheet already renders a clean single-page A4 invoice.
     ----------------------------- */

  function downloadPdf() {
    if (pdfStatus) pdfStatus.textContent = "Opening the print dialog - choose \"Save as PDF\" as the destination.";
    printInvoice();
  }

  /* -----------------------------
     AMOUNT IN WORDS
     ----------------------------- */

  function numberWords(number) {
    const n = Math.max(0, Math.floor(Number(number) || 0));
    if (n === 0) return "Rupees Zero Only";

    const one = [
      "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
      "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
      "Seventeen", "Eighteen", "Nineteen"
    ];

    const ten = [
      "", "", "Twenty", "Thirty", "Forty", "Fifty",
      "Sixty", "Seventy", "Eighty", "Ninety"
    ];

    function underHundred(value) {
      if (value < 20) return one[value];
      return `${ten[Math.floor(value / 10)]} ${one[value % 10]}`.trim();
    }

    function underThousand(value) {
      const hundreds = Math.floor(value / 100);
      const rest = value % 100;

      return [
        hundreds ? `${one[hundreds]} Hundred` : "",
        rest ? underHundred(rest) : ""
      ].filter(Boolean).join(" ");
    }

    let value = n;
    const words = [];

    const crore = Math.floor(value / 10000000);
    if (crore) {
      words.push(`${underThousand(crore)} Crore`);
      value %= 10000000;
    }

    const lakh = Math.floor(value / 100000);
    if (lakh) {
      words.push(`${underHundred(lakh)} Lakh`);
      value %= 100000;
    }

    const thousand = Math.floor(value / 1000);
    if (thousand) {
      words.push(`${underHundred(thousand)} Thousand`);
      value %= 1000;
    }

    if (value) words.push(underThousand(value));

    return `Rupees ${words.join(" ")} Only`;
  }

  /* -----------------------------
     CLEAR
     ----------------------------- */

  function clearAll() {
    const confirmed = window.confirm("Clear all invoice details and products?");
    if (!confirmed) return;

    form.reset();
    items = [];
    setDefaults();
    clearValidation();
    clearItemError();

    if (pdfStatus) pdfStatus.textContent = "";

    renderItems();
    updatePreview();

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }

  /* -----------------------------
     EVENTS
     ----------------------------- */

  $("addItemButton")?.addEventListener("click", addItem);
  $("previewButton")?.addEventListener("click", previewInvoiceAction);
  $("clearButton")?.addEventListener("click", clearAll);
  $("printButton")?.addEventListener("click", printInvoice);
  $("downloadPdfButton")?.addEventListener("click", downloadPdf);

  addedItemsBody?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-id]");
    if (button) removeItem(button.dataset.id);
  });

  form.addEventListener("input", updatePreview);
  form.addEventListener("change", updatePreview);

  fields.sellerState?.addEventListener("change", () => {
    tidyStateField(fields.sellerState);
    updatePreview();
  });

  fields.sellerState?.addEventListener("blur", () => {
    tidyStateField(fields.sellerState);
    updatePreview();
  });

  fields.placeOfSupply?.addEventListener("change", () => {
    tidyStateField(fields.placeOfSupply);
    updatePreview();
  });

  fields.placeOfSupply?.addEventListener("blur", () => {
    tidyStateField(fields.placeOfSupply);
    updatePreview();
  });

  itemFields.description?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addItem();
    }
  });

  /* -----------------------------
     START
     ----------------------------- */

  prepareStateField(
    fields.sellerState,
    "sellerStateOptions",
    "Type state name, e.g. Tamil Nadu"
  );

  prepareStateField(
    fields.placeOfSupply,
    "placeOfSupplyOptions",
    "Type state name, e.g. Karnataka"
  );

  setDefaults();
  renderItems();
  updatePreview();
})();
