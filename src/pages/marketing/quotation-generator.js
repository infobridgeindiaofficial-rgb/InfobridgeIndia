import { breadcrumbs, renderHead, renderHeader, renderFooter, renderClientScript } from "../../components/layout.js";

export function quotationGeneratorPageHtml() {
  const body = `
  <section class="service-hero">
    <div class="container">
      ${breadcrumbs([{ label: "Home", href: "/index.html" }, { label: "Business Tools", href: "/gst-calculator.html" }, { label: "Quotation Generator", href: "#" }])}
      <div style="margin-top:18px; max-width:680px;">
        <span class="eyebrow">Business Tools</span>
        <h1 class="h-1">Online Quotation Generator</h1>
        <p class="text-lead">Create a professional quotation with automatic totals and a live preview, ready to print or save as PDF. Nothing is uploaded &mdash; your data stays in this browser.</p>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container" style="max-width:1320px;">
      <div class="qg-workspace">

        <form id="quotationForm" class="card" novalidate>
          <div class="qg-privacy-note"><b>Your data stays in this browser.</b><span>Nothing is uploaded or stored remotely.</span></div>

          <div class="qg-form-section">
            <div class="qg-section-title"><b>1</b><div><h2>Business Details</h2><p>Your company details, shown at the top of the quotation.</p></div></div>
            <div class="form-grid">
              <label class="field full"><span>Business / Company Name *</span><input class="input" id="businessName" type="text" placeholder="ABC Enterprises" required></label>
              <label class="field full"><span>Address</span><textarea class="input" id="businessAddress" rows="2" placeholder="Door number, street, city and PIN code"></textarea></label>
              <label class="field"><span>Phone Number</span><input class="input" id="businessPhone" type="text" placeholder="+91 98765 43210"></label>
              <label class="field"><span>Email</span><input class="input" id="businessEmail" type="email" placeholder="hello@business.com"></label>
              <label class="field"><span>GSTIN (optional)</span><input class="input" id="businessGstin" type="text" maxlength="40" placeholder="Optional"></label>
              <div class="field">
                <span>Company Logo (optional)</span>
                <div class="qg-logo-row">
                  <div class="qg-logo-preview" id="logoPreviewBox"><span>No logo</span></div>
                  <div class="qg-logo-actions">
                    <input type="file" id="businessLogoInput" accept="image/*" style="display:none;">
                    <button type="button" class="btn btn-secondary btn-sm" id="logoChooseButton">Upload Logo</button>
                    <button type="button" class="btn btn-ghost btn-sm" id="logoRemoveButton" style="display:none;">Remove Logo</button>
                    <small>Stays on your device. PNG/JPG recommended.</small>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="qg-form-section">
            <div class="qg-section-title"><b>2</b><div><h2>Bill To / Customer Details</h2><p>Who this quotation is being prepared for.</p></div></div>
            <div class="form-grid">
              <label class="field full"><span>Customer / Company Name *</span><input class="input" id="customerName" type="text" placeholder="XYZ Retailers" required></label>
              <label class="field full"><span>Address</span><textarea class="input" id="customerAddress" rows="2" placeholder="Customer address with city and PIN code"></textarea></label>
              <label class="field"><span>Phone Number</span><input class="input" id="customerPhone" type="text" placeholder="+91 98765 43210"></label>
              <label class="field"><span>Email</span><input class="input" id="customerEmail" type="email" placeholder="customer@email.com"></label>
              <label class="field"><span>GSTIN (optional)</span><input class="input" id="customerGstin" type="text" maxlength="40" placeholder="Optional"></label>
            </div>
          </div>

          <div class="qg-form-section">
            <div class="qg-section-title"><b>3</b><div><h2>Quotation Details</h2><p>Quotation identity and validity.</p></div></div>
            <div class="form-grid">
              <label class="field"><span>Quotation Number</span><input class="input" id="quotationNumber" type="text" maxlength="24" placeholder="QUO-2026-0001"></label>
              <label class="field"><span>Quotation Date</span><input class="input" id="quotationDate" type="date"></label>
              <label class="field"><span>Valid Until</span><input class="input" id="validUntil" type="date"></label>
              <label class="field"><span>Currency</span>
                <select class="input" id="currencySelect">
                  <option value="INR" selected>INR &#8377; - Indian Rupee</option>
                  <option value="USD">USD $ - US Dollar</option>
                  <option value="EUR">EUR &euro; - Euro</option>
                  <option value="GBP">GBP &pound; - British Pound</option>
                  <option value="AED">AED - UAE Dirham</option>
                </select>
              </label>
              <label class="field full"><span>Reference / Subject (optional)</span><input class="input" id="referenceSubject" type="text" placeholder="e.g. Quotation for office supplies"></label>
            </div>
          </div>

          <div class="qg-form-section">
            <div class="qg-section-title"><b>4</b><div><h2>Products / Services</h2><p>Edit directly in the table. Totals update automatically.</p></div></div>

            <div class="qg-item-table-wrap">
              <table class="qg-item-table">
                <thead><tr><th>Description</th><th class="qg-col-num">Quantity</th><th class="qg-col-num">Rate</th><th class="qg-col-num">Tax %</th><th class="qg-col-amount">Amount</th><th></th></tr></thead>
                <tbody id="itemsBody"></tbody>
              </table>
            </div>
            <div class="qg-add-item-row"><button id="addItemButton" class="btn btn-secondary btn-sm" type="button">&#65291; Add Item</button></div>
            <p id="itemError" class="qg-inline-error"></p>

            <div class="qg-discount-row">
              <label class="field"><span>Discount Type</span>
                <select class="input" id="discountType">
                  <option value="percentage" selected>Percentage (%)</option>
                  <option value="fixed">Fixed Amount</option>
                </select>
              </label>
              <label class="field"><span id="discountValueLabel">Discount %</span><input class="input" id="discountValue" type="number" inputmode="decimal" min="0" step="0.01" value="0"></label>
            </div>

            <div class="qg-form-totals">
              <div><span>Subtotal</span><b id="formSubtotal">0.00</b></div>
              <div id="formDiscountRow" style="display:none;"><span>Discount</span><b id="formDiscount">0.00</b></div>
              <div><span>Tax</span><b id="formTax">0.00</b></div>
              <div class="qg-grand"><span>Grand Total</span><b id="formGrandTotal">0.00</b></div>
            </div>
          </div>

          <div class="qg-form-section">
            <div class="qg-section-title"><b>5</b><div><h2>Notes &amp; Terms</h2><p>Shown at the bottom of the quotation. Fully editable.</p></div></div>
            <div class="form-grid">
              <label class="field full"><span>Notes</span><textarea class="input" id="notes" rows="2" placeholder="Thank you for considering us."></textarea></label>
              <label class="field full"><span>Terms &amp; Conditions</span><textarea class="input" id="terms" rows="4" placeholder="Payment terms, validity, delivery notes..."></textarea></label>
            </div>
          </div>

          <p id="formError" class="qg-form-error"></p>
          <div class="qg-form-actions">
            <button id="previewButton" class="btn btn-accent" type="button">&#128065; Preview Quotation</button>
            <button id="clearButton" class="btn btn-secondary" type="button">&#8635; Clear / New Quotation</button>
          </div>
        </form>

        <aside class="qg-preview-panel">
          <div class="qg-preview-top"><div><b>LIVE PREVIEW</b><span>Updates automatically</span></div></div>

          <article id="quotationPreview" class="qg-sheet">
            <header class="qg-header">
              <div class="qg-header-business">
                <img id="previewLogo" class="qg-header-logo" alt="Company logo">
                <div>
                  <h2 id="previewBusinessName">YOUR BUSINESS NAME</h2>
                  <p id="previewBusinessAddress" class="qg-keep-lines"></p>
                  <p id="previewBusinessContact"></p>
                  <p id="previewBusinessGstinRow"><b>GSTIN:</b> <span id="previewBusinessGstin">&mdash;</span></p>
                </div>
              </div>
              <div class="qg-title-block">
                <h2>QUOTATION</h2>
                <dl>
                  <div><dt>Quotation No.</dt><dd id="previewQuotationNumber">&mdash;</dd></div>
                  <div><dt>Date</dt><dd id="previewQuotationDate">&mdash;</dd></div>
                  <div><dt>Valid Until</dt><dd id="previewValidUntil">&mdash;</dd></div>
                </dl>
              </div>
            </header>

            <section class="qg-bill-to">
              <small>BILL TO</small>
              <h3 id="previewCustomerName">CUSTOMER NAME</h3>
              <p id="previewCustomerAddress" class="qg-keep-lines"></p>
              <p id="previewCustomerContact"></p>
              <p id="previewCustomerGstinRow"><b>GSTIN:</b> <span id="previewCustomerGstin">&mdash;</span></p>
            </section>

            <p id="previewReferenceRow" class="qg-reference" style="display:none;"><b>Subject:</b> <span id="previewReference"></span></p>

            <div class="qg-table-wrap">
              <table class="qg-preview-table">
                <thead><tr><th>#</th><th style="text-align:left;">Description</th><th>Qty</th><th>Rate</th><th>Tax %</th><th>Amount</th></tr></thead>
                <tbody id="previewItemsBody"><tr><td colspan="6" class="qg-preview-empty">Add an item to generate the quotation.</td></tr></tbody>
              </table>
            </div>

            <section class="qg-summary-area">
              <div></div>
              <div class="qg-totals">
                <div><span>Subtotal</span><b id="previewSubtotal">0.00</b></div>
                <div id="previewDiscountRow" style="display:none;"><span>Discount</span><b id="previewDiscount">0.00</b></div>
                <div><span>Tax</span><b id="previewTax">0.00</b></div>
                <div class="qg-grand"><span>Grand Total</span><b id="previewGrandTotal">0.00</b></div>
              </div>
            </section>

            <section class="qg-bottom">
              <div><small>NOTES</small><p id="previewNotes" class="qg-keep-lines">&mdash;</p></div>
              <div><small>TERMS &amp; CONDITIONS</small><p id="previewTerms" class="qg-keep-lines">&mdash;</p></div>
            </section>
            <footer class="qg-footer">Generated using InfoBridgeIndia. This is a quotation, not a tax invoice.</footer>
          </article>

          <div class="qg-preview-actions">
            <button id="printButton" class="btn btn-accent" type="button">&#128424; Print / Save as PDF</button>
          </div>
          <p id="pdfStatus" class="qg-pdf-status"></p>
        </aside>
      </div>
    </div>
  </section>
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
${renderHead({ title: "Quotation Generator", description: "Create a professional quotation with automatic totals and a live preview. Print or save as PDF, entirely in your browser.", route: "/quotation-generator.html" })}
<link rel="stylesheet" href="/quotation-generator/styles.css" />
</head>
<body>
${renderHeader("solutions")}
${body}
${renderFooter()}
${renderClientScript()}
<script type="module" src="/quotation-generator/app.js"></script>
</body>
</html>`;
}
