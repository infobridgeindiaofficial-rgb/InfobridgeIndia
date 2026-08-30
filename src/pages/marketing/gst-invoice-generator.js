import { breadcrumbs, renderHead, renderHeader, renderFooter, renderClientScript } from "../../components/layout.js";

export function gstInvoiceGeneratorPageHtml() {
  const body = `
  <section class="service-hero">
    <div class="container">
      ${breadcrumbs([{ label: "Home", href: "/index.html" }, { label: "Business Tools", href: "/gst-calculator.html" }, { label: "GST Invoice Generator", href: "#" }])}
      <div style="margin-top:18px; max-width:680px;">
        <span class="eyebrow">Business Tools</span>
        <h1 class="h-1">GST Invoice Generator</h1>
        <p class="text-lead">Create a clean GST invoice with automatic tax calculation and live preview. Nothing is uploaded &mdash; your data stays in this browser.</p>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container" style="max-width:1320px;">
      <div class="invoice-workspace">

        <form id="invoiceForm" class="card" novalidate>
          <div class="privacy-note"><b>Your data stays in this browser.</b><span>Nothing is uploaded.</span></div>

          <div class="invoice-form-section">
            <div class="invoice-section-title"><b>1</b><div><h2>Seller Details</h2><p>Enter supplier details exactly as they should appear.</p></div></div>
            <div class="form-grid">
              <label class="field full"><span>Business / Seller Name *</span><input class="input" id="sellerName" type="text" placeholder="ABC Enterprises" required></label>
              <label class="field full"><span>Seller GSTIN / Reference *</span><input class="input" id="sellerGstin" type="text" maxlength="40" placeholder="Enter any GSTIN or reference" required><small class="hint">No format validation. Your exact text will appear.</small></label>
              <label class="field full"><span>Business Address *</span><textarea class="input" id="sellerAddress" rows="3" placeholder="Door number, street, city and PIN code" required></textarea></label>
              <label class="field"><span>Seller State *</span><input class="input" id="sellerState" type="text" placeholder="Type state name, e.g. Tamil Nadu" autocomplete="off" required><small class="hint">Tap and type to search on mobile.</small></label>
              <label class="field"><span>Phone / Email</span><input class="input" id="sellerContact" type="text" placeholder="+91 98765 43210 / seller@email.com"></label>
            </div>
          </div>

          <div class="invoice-form-section">
            <div class="invoice-section-title"><b>2</b><div><h2>Invoice &amp; Customer Details</h2><p>Enter invoice identity, buyer and place of supply.</p></div></div>
            <div class="form-grid">
              <label class="field"><span>Invoice Number *</span><input class="input" id="invoiceNumber" type="text" maxlength="16" placeholder="INV-2026-0001" required><small class="hint">Maximum 16 characters</small></label>
              <label class="field"><span>Invoice Date *</span><input class="input" id="invoiceDate" type="date" required></label>
              <label class="field"><span>Customer Name *</span><input class="input" id="customerName" type="text" placeholder="XYZ Retailers" required></label>
              <label class="field"><span>Customer GSTIN / UIN</span><input class="input" id="customerGstin" type="text" maxlength="40" placeholder="Optional - any text accepted"><small class="hint">Your exact text will appear.</small></label>
              <label class="field full"><span>Customer Address *</span><textarea class="input" id="customerAddress" rows="3" placeholder="Customer address with city and PIN code" required></textarea></label>
              <label class="field"><span>Place of Supply *</span><input class="input" id="placeOfSupply" type="text" placeholder="Type state name, e.g. Karnataka" autocomplete="off" required><small class="hint">Tap and type to search on mobile.</small></label>
              <label class="field"><span>Reverse Charge</span><select class="input" id="reverseCharge"><option>No</option><option>Yes</option></select></label>
            </div>
          </div>

          <div class="invoice-form-section">
            <div class="invoice-section-title"><b>3</b><div><h2>Product / Service Details</h2><p>Large fields make item entry easy on desktop and mobile.</p></div></div>
            <div class="item-entry">
              <div class="item-grid">
                <label class="field item-name"><span>Product / Service Description *</span><input class="input" id="itemDescription" type="text" placeholder="Wireless Mouse"></label>
                <label class="field"><span>HSN / SAC *</span><input class="input" id="itemHsn" type="text" inputmode="numeric" maxlength="8" placeholder="84716060"></label>
                <label class="field"><span>Quantity *</span><input class="input" id="itemQty" type="number" inputmode="decimal" min="0.001" step="0.001" value="1"></label>
                <label class="field"><span>Unit</span><select class="input" id="itemUnit"><option>NOS</option><option>PCS</option><option>KGS</option><option>LTR</option><option>MTR</option><option>BOX</option><option>SET</option><option>OTH</option></select></label>
                <label class="field"><span>Rate (&#8377;) *</span><input class="input" id="itemRate" type="number" inputmode="decimal" min="0" step="0.01" placeholder="650.00"></label>
                <label class="field"><span>Discount %</span><input class="input" id="itemDiscount" type="number" inputmode="decimal" min="0" max="100" step="0.01" value="0"></label>
                <label class="field"><span>GST Rate *</span><select class="input" id="itemGstRate"><option value="0">0%</option><option value="0.1">0.1%</option><option value="0.25">0.25%</option><option value="1.5">1.5%</option><option value="3">3%</option><option value="5">5%</option><option value="6">6%</option><option value="7.5">7.5%</option><option value="12">12%</option><option value="18" selected>18%</option><option value="28">28%</option></select></label>
                <button id="addItemButton" class="btn btn-accent add-item-button" type="button">&#65291; Add Product</button>
              </div>
              <p id="itemError" class="invoice-inline-error"></p>
            </div>

            <div class="item-table-wrap">
              <table class="item-table">
                <thead><tr><th>#</th><th>Product / Service</th><th>HSN/SAC</th><th>Qty</th><th>Rate</th><th>Disc.</th><th>GST</th><th>Taxable</th><th>Action</th></tr></thead>
                <tbody id="addedItemsBody"><tr><td colspan="9" class="empty-cell">No products added yet.</td></tr></tbody>
              </table>
            </div>
          </div>

          <div class="invoice-form-section">
            <div class="invoice-section-title"><b>4</b><div><h2>Payment &amp; Other Details</h2><p>Optional information shown at the invoice bottom.</p></div></div>
            <div class="form-grid">
              <label class="field"><span>Bank Name</span><input class="input" id="bankName" type="text" placeholder="HDFC Bank"></label>
              <label class="field"><span>Account Number</span><input class="input" id="bankAccount" type="text" placeholder="50200012345678"></label>
              <label class="field"><span>IFSC Code</span><input class="input" id="bankIfsc" type="text" placeholder="HDFC0001234"></label>
              <label class="field"><span>Authorized Signatory</span><input class="input" id="signatoryName" type="text" placeholder="Owner / Authorized Person"></label>
              <label class="field full"><span>Terms &amp; Conditions</span><textarea class="input" id="terms" rows="3" placeholder="Payment is due within 15 days."></textarea></label>
              <label class="field full"><span>Additional Notes</span><textarea class="input" id="notes" rows="2" placeholder="Thank you for your business."></textarea></label>
            </div>
          </div>

          <p id="formError" class="invoice-form-error"></p>
          <div class="invoice-form-actions">
            <button id="previewButton" class="btn btn-accent" type="button">&#128065; Preview Invoice</button>
            <button id="clearButton" class="btn btn-secondary" type="button">&#8635; Clear All</button>
          </div>
        </form>

        <aside class="preview-panel">
          <div class="preview-top"><div><b>LIVE PREVIEW</b><span>Updates automatically</span></div><em id="taxModeBadge">Select states</em></div>

          <article id="invoicePreview" class="invoice-sheet">
            <header class="invoice-header">
              <div><h2 id="previewSellerName">YOUR BUSINESS NAME</h2><p id="previewSellerAddress">Business address will appear here.</p><p id="previewSellerContact"></p><p><b>GSTIN / Ref:</b> <span id="previewSellerGstin">&mdash;</span></p></div>
              <div class="invoice-title"><h2>TAX INVOICE</h2><span>ORIGINAL FOR RECIPIENT</span><dl><div><dt>Invoice No.</dt><dd id="previewInvoiceNumber">&mdash;</dd></div><div><dt>Invoice Date</dt><dd id="previewInvoiceDate">&mdash;</dd></div><div><dt>Place of Supply</dt><dd id="previewPlaceOfSupply">&mdash;</dd></div><div><dt>Reverse Charge</dt><dd id="previewReverseCharge">No</dd></div></dl></div>
            </header>

            <section class="bill-to"><small>BILL TO</small><h3 id="previewCustomerName">CUSTOMER NAME</h3><p id="previewCustomerAddress">Customer address will appear here.</p><p><b>GSTIN / UIN:</b> <span id="previewCustomerGstin">Unregistered</span></p></section>

            <div class="preview-table-wrap"><table class="preview-table"><thead><tr><th>#</th><th>Product / Service Description</th><th>HSN/SAC</th><th>Qty</th><th>Rate (&#8377;)</th><th>Disc.</th><th>Taxable (&#8377;)</th><th>GST</th><th>Total (&#8377;)</th></tr></thead><tbody id="previewItemsBody"><tr><td colspan="9" class="preview-empty">Add a product to generate the invoice.</td></tr></tbody></table></div>

            <section class="summary-area">
              <div><b>Amount in Words</b><p id="amountInWords">Rupees Zero Only</p></div>
              <div class="totals"><div><span>Total Value</span><b id="previewGrossTotal">&#8377;0.00</b></div><div><span>Discount</span><b id="previewDiscountTotal">&#8377;0.00</b></div><div><span>Total Taxable Value</span><b id="previewTaxableTotal">&#8377;0.00</b></div><div class="cgst-row"><span>CGST</span><b id="previewCgst">&#8377;0.00</b></div><div class="sgst-row"><span>SGST / UTGST</span><b id="previewSgst">&#8377;0.00</b></div><div class="igst-row"><span>IGST</span><b id="previewIgst">&#8377;0.00</b></div><div class="grand"><span>Grand Total</span><b id="previewGrandTotal">&#8377;0.00</b></div></div>
            </section>

            <section class="invoice-bottom">
              <div><small>NOTES</small><p id="previewNotes" class="keep-lines">Thank you for your business.</p><small class="top-gap">TERMS &amp; CONDITIONS</small><p id="previewTerms" class="keep-lines">Payment terms will appear here.</p></div>
              <div><small>BANK DETAILS</small><p><b>Bank:</b> <span id="previewBankName">&mdash;</span></p><p><b>A/C No.:</b> <span id="previewBankAccount">&mdash;</span></p><p><b>IFSC:</b> <span id="previewBankIfsc">&mdash;</span></p></div>
              <div class="signature"><p>For <b id="previewSignatureBusiness">Your Business</b></p><div></div><p id="previewSignatoryName">Authorized Signatory</p></div>
            </section>
            <footer class="invoice-note">Generated using InfoBridgeIndia. Verify all details before issuing the invoice.</footer>
          </article>

          <div class="preview-actions">
            <button id="downloadPdfButton" class="btn btn-accent" type="button">&#11015; Download PDF</button>
            <button id="printButton" class="btn btn-secondary" type="button">&#128424; Print Invoice</button>
          </div>
          <p id="pdfStatus" class="pdf-status"></p>
        </aside>
      </div>
    </div>
  </section>
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
${renderHead({ title: "GST Invoice Generator", description: "Create, preview, print and download a GST invoice with automatic CGST, SGST or IGST calculation." })}
<link rel="stylesheet" href="/gst-invoice-generator/styles.css" />
</head>
<body>
${renderHeader("solutions")}
${body}
${renderFooter()}
${renderClientScript()}
<script type="module" src="/gst-invoice-generator/app.js"></script>
</body>
</html>`;
}
