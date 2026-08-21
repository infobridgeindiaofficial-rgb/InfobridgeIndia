import { CURRENCIES, DEFAULT_CURRENCY, safeNumber, safeNonNegative, toMinor, computeLine, computeTotals, formatMoney, formatPlain } from "./calc.js";

(() => { "use strict";

  const $ = (id) => document.getElementById(id);

  const form = $("quotationForm");
  const quotationPreview = $("quotationPreview");
  const itemsBody = $("itemsBody");
  const previewItemsBody = $("previewItemsBody");
  const itemError = $("itemError");
  const formError = $("formError");
  const pdfStatus = $("pdfStatus");

  if (!form || !quotationPreview || !itemsBody) {
    console.error("Quotation Generator: required HTML elements are missing.");
    return;
  }

  const fields = {
    businessName: $("businessName"),
    businessAddress: $("businessAddress"),
    businessPhone: $("businessPhone"),
    businessEmail: $("businessEmail"),
    businessGstin: $("businessGstin"),
    customerName: $("customerName"),
    customerAddress: $("customerAddress"),
    customerPhone: $("customerPhone"),
    customerEmail: $("customerEmail"),
    customerGstin: $("customerGstin"),
    quotationNumber: $("quotationNumber"),
    quotationDate: $("quotationDate"),
    validUntil: $("validUntil"),
    currencySelect: $("currencySelect"),
    referenceSubject: $("referenceSubject"),
    discountType: $("discountType"),
    discountValue: $("discountValue"),
    notes: $("notes"),
    terms: $("terms"),
  };

  let items = [];
  let logoDataUrl = null;

  /* -----------------------------
     BASIC HELPERS
     ----------------------------- */

  function textValue(element) {
    return element ? String(element.value || "").trim() : "";
  }

  function setText(id, value, fallback = "") {
    const element = $(id);
    if (!element) return;
    const clean = String(value ?? "").trim();
    element.textContent = clean || fallback;
  }

  function setRowVisible(id, visible) {
    const element = $(id);
    if (element) element.style.display = visible ? "" : "none";
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatDate(value) {
    if (!value) return "";
    const parts = value.split("-");
    if (parts.length !== 3) return value;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  function toLocalIsoDate(date) {
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }

  function currentCurrency() {
    const code = fields.currencySelect?.value;
    return CURRENCIES[code] ? code : DEFAULT_CURRENCY;
  }

  function currentDiscountType() {
    return fields.discountType?.value === "fixed" ? "fixed" : "percentage";
  }

  function setMoneyText(id, minor, currency, showAsDeduction = false) {
    const element = $(id);
    if (!element) return;
    const text = formatMoney(minor, currency);
    element.textContent = showAsDeduction && minor > 0 ? `- ${text}` : text;
  }

  /* -----------------------------
     DEFAULTS
     ----------------------------- */

  function setDefaults() {
    const now = new Date();

    if (fields.quotationDate) fields.quotationDate.value = toLocalIsoDate(now);

    if (fields.validUntil) {
      const validTill = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
      fields.validUntil.value = toLocalIsoDate(validTill);
    }

    if (fields.quotationNumber) {
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      fields.quotationNumber.value = `QUO-${year}${month}${day}-01`.slice(0, 24);
    }

    if (fields.notes && !fields.notes.value) {
      fields.notes.value = "Thank you for considering our quotation.";
    }

    if (fields.terms && !fields.terms.value) {
      fields.terms.value =
        "1. This quotation is valid until the date mentioned above.\n" +
        "2. Prices are subject to change without prior notice.\n" +
        "3. Delivery / service timelines will be confirmed upon order confirmation.";
    }

    if (fields.discountType) fields.discountType.value = "percentage";
    if (fields.discountValue) fields.discountValue.value = "0";
    updateDiscountLabel();
  }

  function updateDiscountLabel() {
    const label = $("discountValueLabel");
    const isFixed = currentDiscountType() === "fixed";
    if (label) label.textContent = isFixed ? "Discount Amount" : "Discount %";
    if (fields.discountValue) {
      if (isFixed) fields.discountValue.removeAttribute("max");
      else fields.discountValue.setAttribute("max", "100");
    }
  }

  /* -----------------------------
     ITEM TABLE (directly editable)
     ----------------------------- */

  function newId() {
    return `i${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function addRow() {
    items.push({ id: newId(), description: "", qty: 1, rate: "", taxPct: 0 });
    renderRows();
    const rows = itemsBody.querySelectorAll("tr[data-id]");
    const last = rows[rows.length - 1];
    last?.querySelector('[data-field="description"]')?.focus();
  }

  function removeRow(id) {
    items = items.filter((item) => item.id !== id);
    renderRows();
  }

  function rowHtml(item, currency) {
    const line = computeLine(item);
    return `
      <tr data-id="${item.id}">
        <td><input class="input qg-field" data-field="description" type="text" placeholder="Item / service description" value="${escapeHtml(item.description)}"></td>
        <td class="qg-col-num"><input class="input qg-field" data-field="qty" type="number" min="0" step="0.01" value="${escapeHtml(item.qty)}"></td>
        <td class="qg-col-num"><input class="input qg-field" data-field="rate" type="number" min="0" step="0.01" value="${escapeHtml(item.rate)}"></td>
        <td class="qg-col-num"><input class="input qg-field" data-field="taxPct" type="number" min="0" max="100" step="0.01" value="${escapeHtml(item.taxPct)}"></td>
        <td class="qg-col-amount">${formatMoney(line.baseMinor, currency)}</td>
        <td><button type="button" class="qg-remove-item" data-remove="${item.id}" aria-label="Remove item">&times;</button></td>
      </tr>`;
  }

  function renderRows() {
    if (!items.length) {
      itemsBody.innerHTML = `<tr><td colspan="6" class="qg-empty-cell">No items added yet. Click &ldquo;+ Add Item&rdquo; to begin.</td></tr>`;
    } else {
      const currency = currentCurrency();
      itemsBody.innerHTML = items.map((item) => rowHtml(item, currency)).join("");
    }
    updateTotals();
  }

  function refreshRowAmounts(currency) {
    itemsBody.querySelectorAll("tr[data-id]").forEach((tr) => {
      const item = items.find((it) => it.id === tr.dataset.id);
      if (!item) return;
      const line = computeLine(item);
      const cell = tr.querySelector(".qg-col-amount");
      if (cell) cell.textContent = formatMoney(line.baseMinor, currency);
    });
  }

  function renderPreviewItems(currency) {
    if (!previewItemsBody) return;
    if (!items.length) {
      previewItemsBody.innerHTML = `<tr><td colspan="6" class="qg-preview-empty">Add an item to generate the quotation.</td></tr>`;
      return;
    }
    previewItemsBody.innerHTML = items
      .map((item, index) => {
        const line = computeLine(item);
        return `
          <tr>
            <td>${index + 1}</td>
            <td class="qg-desc-cell">${escapeHtml(item.description) || "&mdash;"}</td>
            <td>${formatPlain(line.qty)}</td>
            <td>${formatPlain(line.rate)}</td>
            <td>${formatPlain(line.taxPct)}%</td>
            <td>${formatMoney(line.baseMinor, currency)}</td>
          </tr>`;
      })
      .join("");
  }

  /* -----------------------------
     TOTALS
     ----------------------------- */

  function showDiscountWarning(clamped) {
    if (!itemError) return;
    if (clamped) {
      itemError.textContent = "Discount reduced so the grand total does not go below zero.";
      itemError.classList.add("show");
    } else {
      itemError.textContent = "";
      itemError.classList.remove("show");
    }
  }

  function updateTotals() {
    const currency = currentCurrency();
    refreshRowAmounts(currency);

    const totals = computeTotals(items, {
      discountType: currentDiscountType(),
      discountValue: fields.discountValue?.value,
    });

    setMoneyText("formSubtotal", totals.subtotalMinor, currency);
    setRowVisible("formDiscountRow", totals.discountMinor > 0);
    setMoneyText("formDiscount", totals.discountMinor, currency, true);
    setMoneyText("formTax", totals.taxMinor, currency);
    setMoneyText("formGrandTotal", totals.grandTotalMinor, currency);

    setRowVisible("previewDiscountRow", totals.discountMinor > 0);
    setMoneyText("previewSubtotal", totals.subtotalMinor, currency);
    setMoneyText("previewDiscount", totals.discountMinor, currency, true);
    setMoneyText("previewTax", totals.taxMinor, currency);
    setMoneyText("previewGrandTotal", totals.grandTotalMinor, currency);

    renderPreviewItems(currency);
    showDiscountWarning(totals.discountClamped);
  }

  /* -----------------------------
     LOGO UPLOAD (local only - FileReader, never uploaded)
     ----------------------------- */

  function updateLogoPreview() {
    const box = $("logoPreviewBox");
    const previewImg = $("previewLogo");
    const removeButton = $("logoRemoveButton");

    if (logoDataUrl) {
      if (box) box.innerHTML = `<img src="${logoDataUrl}" alt="Logo preview">`;
      if (previewImg) {
        previewImg.src = logoDataUrl;
        previewImg.classList.add("qg-has-logo");
      }
      if (removeButton) removeButton.style.display = "";
    } else {
      if (box) box.innerHTML = `<span>No logo</span>`;
      if (previewImg) {
        previewImg.removeAttribute("src");
        previewImg.classList.remove("qg-has-logo");
      }
      if (removeButton) removeButton.style.display = "none";
    }
  }

  const MAX_LOGO_SIZE = 5 * 1024 * 1024; // 5 MB - a logo has no legitimate reason to be larger

  function handleLogoFile(file) {
    if (!file) return;
    if (!file.type || !file.type.startsWith("image/")) {
      formError.textContent = "Please choose an image file (PNG, JPG, etc.) for the logo.";
      formError.classList.add("show");
      return;
    }
    if (file.size > MAX_LOGO_SIZE) {
      formError.textContent = `This logo file is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Please choose an image under 5 MB.`;
      formError.classList.add("show");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      logoDataUrl = String(reader.result || "");
      updateLogoPreview();
    };
    reader.readAsDataURL(file);
  }

  /* -----------------------------
     LIVE PREVIEW
     ----------------------------- */

  function updatePreview() {
    setText("previewBusinessName", textValue(fields.businessName), "YOUR BUSINESS NAME");
    setText("previewBusinessAddress", textValue(fields.businessAddress), "");

    const businessContact = [textValue(fields.businessPhone), textValue(fields.businessEmail)].filter(Boolean).join("  |  ");
    setText("previewBusinessContact", businessContact, "");
    setRowVisible("previewBusinessContact", Boolean(businessContact));

    const businessGstin = textValue(fields.businessGstin);
    setText("previewBusinessGstin", businessGstin, "");
    setRowVisible("previewBusinessGstinRow", Boolean(businessGstin));

    setText("previewQuotationNumber", textValue(fields.quotationNumber), "—");
    setText("previewQuotationDate", formatDate(fields.quotationDate?.value), "—");
    setText("previewValidUntil", formatDate(fields.validUntil?.value), "—");

    setText("previewCustomerName", textValue(fields.customerName), "CUSTOMER NAME");
    setText("previewCustomerAddress", textValue(fields.customerAddress), "");

    const customerContact = [textValue(fields.customerPhone), textValue(fields.customerEmail)].filter(Boolean).join("  |  ");
    setText("previewCustomerContact", customerContact, "");
    setRowVisible("previewCustomerContact", Boolean(customerContact));

    const customerGstin = textValue(fields.customerGstin);
    setText("previewCustomerGstin", customerGstin, "");
    setRowVisible("previewCustomerGstinRow", Boolean(customerGstin));

    const reference = textValue(fields.referenceSubject);
    setText("previewReference", reference, "");
    setRowVisible("previewReferenceRow", Boolean(reference));

    setText("previewNotes", textValue(fields.notes), "—");
    setText("previewTerms", textValue(fields.terms), "—");

    updateTotals();
  }

  /* -----------------------------
     VALIDATION
     ----------------------------- */

  function clearValidation() {
    form.querySelectorAll(".invalid").forEach((element) => element.classList.remove("invalid"));
    if (formError) {
      formError.textContent = "";
      formError.classList.remove("show");
    }
  }

  function validateQuotation() {
    clearValidation();

    const required = [fields.businessName, fields.customerName];
    const missing = required.filter((element) => !textValue(element));

    if (missing.length) {
      missing.forEach((element) => element.classList.add("invalid"));
      if (formError) {
        formError.textContent = "Business name and customer name are required to generate the quotation.";
        formError.classList.add("show");
      }
      missing[0].focus();
      return false;
    }

    return true;
  }

  function previewQuotationAction() {
    updatePreview();
    if (!validateQuotation()) return;
    quotationPreview.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function printQuotation() {
    updatePreview();
    if (!validateQuotation()) return;
    if (pdfStatus) pdfStatus.textContent = 'Opening the print dialog — choose "Save as PDF" as the destination.';
    window.print();
  }

  /* -----------------------------
     CLEAR / NEW QUOTATION
     ----------------------------- */

  function clearAll() {
    const hasData = items.length > 0 || textValue(fields.businessName) || textValue(fields.customerName) || logoDataUrl;
    if (hasData) {
      const confirmed = window.confirm("Clear all quotation details and items? This cannot be undone.");
      if (!confirmed) return;
    }

    form.reset();
    items = [];
    logoDataUrl = null;
    updateLogoPreview();
    clearValidation();
    setDefaults();
    renderRows();
    updatePreview();

    if (pdfStatus) pdfStatus.textContent = "";

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* -----------------------------
     EVENTS
     ----------------------------- */

  $("addItemButton")?.addEventListener("click", addRow);
  $("previewButton")?.addEventListener("click", previewQuotationAction);
  $("clearButton")?.addEventListener("click", clearAll);
  $("printButton")?.addEventListener("click", printQuotation);

  itemsBody.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove]");
    if (button) removeRow(button.dataset.remove);
  });

  // Quantity/rate/tax can never be stored as negative: as soon as a typed
  // value parses to a negative number the field is corrected in place. This
  // runs on every keystroke (not just on blur) so it is not dependent on a
  // focus/blur cycle actually occurring - it corrects immediately, and a
  // normal positive value is never touched or reformatted while typing.
  function syncItemField(field) {
    const tr = field.closest("tr[data-id]");
    const item = items.find((it) => it.id === tr?.dataset.id);
    if (!item) return;
    const key = field.dataset.field;
    if (key !== "description" && field.value !== "" && safeNumber(field.value) < 0) {
      const clamped = safeNonNegative(field.value);
      field.value = clamped;
      item[key] = clamped;
    } else {
      item[key] = field.value;
    }
  }

  form.addEventListener("input", (event) => {
    const field = event.target.closest(".qg-field");
    if (field) syncItemField(field);
    updatePreview();
  });

  form.addEventListener("change", updatePreview);

  fields.discountType?.addEventListener("change", updateDiscountLabel);

  // Negative discount values are corrected immediately (same reasoning as
  // syncItemField above); the percentage-over-100 cap is applied on blur
  // since it only matters once the user has finished typing the number.
  // Either way computeTotals() in calc.js clamps defensively too, so the
  // grand total is always correct even in the instant before this runs.
  fields.discountValue?.addEventListener("input", () => {
    if (fields.discountValue.value !== "" && safeNumber(fields.discountValue.value) < 0) {
      fields.discountValue.value = safeNonNegative(fields.discountValue.value);
    }
  });

  fields.discountValue?.addEventListener("blur", () => {
    let value = safeNonNegative(fields.discountValue.value);
    if (currentDiscountType() === "percentage" && value > 100) value = 100;
    fields.discountValue.value = value;
    updatePreview();
  });

  $("logoChooseButton")?.addEventListener("click", () => $("businessLogoInput")?.click());
  $("businessLogoInput")?.addEventListener("change", (event) => handleLogoFile(event.target.files?.[0]));
  $("logoRemoveButton")?.addEventListener("click", () => {
    logoDataUrl = null;
    const input = $("businessLogoInput");
    if (input) input.value = "";
    updateLogoPreview();
  });

  /* -----------------------------
     START
     ----------------------------- */

  setDefaults();
  addRow();
  updateLogoPreview();
  updatePreview();
})();
