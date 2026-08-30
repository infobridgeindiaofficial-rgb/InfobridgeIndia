import { breadcrumbs, renderHead, renderHeader, renderFooter, renderClientScript } from "../../components/layout.js";

export function marketplaceProfitCalculatorPageHtml() {
  const body = `
  <section class="service-hero">
    <div class="container">
      ${breadcrumbs([{ label: "Home", href: "/index.html" }, { label: "Business Tools", href: "/gst-calculator.html" }, { label: "Marketplace Profit Calculator", href: "#" }])}
      <div style="margin-top:18px; max-width:680px;">
        <span class="eyebrow">Business Tools</span>
        <h1 class="h-1">Marketplace Profit Calculator</h1>
        <p class="text-lead">Compare Amazon, Flipkart and Meesho Local, Regional and National delivery fees, settlement amounts and estimated profit.</p>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container" style="max-width:1180px;">
      <div class="tool-grid">

        <div class="card">
          <h2 class="h-3" style="margin-bottom:var(--sp-5);">Enter Details</h2>
          <form id="amazonCalculatorForm" novalidate>
            <div class="form-grid" style="grid-template-columns:1fr;">
              <label class="field">
                <span>Marketplace</span>
                <select class="input" id="marketplace" required>
                  <option value="amazon">Amazon</option>
                  <option value="flipkart">Flipkart</option>
                  <option value="meesho">Meesho</option>
                </select>
              </label>

              <label class="field" id="categoryGroup">
                <span>Product Category</span>
                <div class="category-search-wrap">
                  <input class="input category-search-input" type="text" id="productCategorySearch" placeholder="Type to search category" autocomplete="off" inputmode="search" aria-autocomplete="list" aria-controls="categorySuggestions" aria-expanded="false" />
                  <span class="category-search-icon">&#8981;</span>
                  <input type="hidden" id="productCategory" value="" />
                  <div id="categorySuggestions" class="category-suggestions" role="listbox"></div>
                </div>
                <small class="hint">Type a word such as Kitchen, Bottle or Beauty, then select a category.</small>
              </label>

              <label class="field">
                <span>Selling Price (&#8377;)</span>
                <input class="input" type="number" id="sellingPrice" placeholder="Example: 250" min="0.01" step="0.01" required />
              </label>

              <label class="field">
                <span>Product Cost (&#8377;)</span>
                <input class="input" type="number" id="productCost" placeholder="Example: 100" min="0" step="0.01" required />
              </label>

              <label class="field">
                <span>Product GST Rate</span>
                <select class="input" id="gstRate" required>
                  <option value="">Select GST rate</option>
                  <option value="0">0%</option>
                  <option value="3">3%</option>
                  <option value="5">5%</option>
                  <option value="12">12%</option>
                  <option value="18">18%</option>
                  <option value="28">28%</option>
                </select>
              </label>

              <label class="field">
                <span>Product Weight (kg)</span>
                <input class="input" type="number" id="productWeight" placeholder="Example: 0.5" min="0.01" step="0.01" required />
                <small class="hint">Enter packed product weight including packing material.</small>
              </label>
            </div>

            <button type="submit" class="btn btn-accent btn-block" style="margin-top:var(--sp-5);">Calculate Profit</button>
            <div class="banner banner-danger hidden" id="errorMessage" role="alert" style="margin-top:var(--sp-4);"></div>
          </form>
        </div>

        <div class="card">
          <h2 class="h-3" id="resultTitle" style="margin-bottom:var(--sp-5);">Amazon Fee Calculation Result</h2>

          <div id="resultPlaceholder" class="state-block">
            <div class="state-icon" style="margin:0 auto var(--sp-4);">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V4"/><path d="M4 20h16"/><rect x="7" y="13" width="2.6" height="7"/><rect x="12" y="9" width="2.6" height="11"/><rect x="17" y="6" width="2.6" height="14"/></svg>
            </div>
            <h4>Your result will appear here</h4>
            <p>Enter the product details and click Calculate Profit.</p>
          </div>

          <div id="resultContent" class="hidden">
            <div class="mpc-table-wrap">
              <table class="mpc-table">
                <thead><tr><th>Fee Details</th><th>Local</th><th>Regional</th><th>National</th></tr></thead>
                <tbody>
                  <tr><td>Selling Price</td><td id="localSellingPrice">&#8377;0.00</td><td id="regionalSellingPrice">&#8377;0.00</td><td id="nationalSellingPrice">&#8377;0.00</td></tr>
                  <tr><td>Product Cost</td><td id="localProductCost">&#8377;0.00</td><td id="regionalProductCost">&#8377;0.00</td><td id="nationalProductCost">&#8377;0.00</td></tr>
                  <tr><td>Shipping Fee</td><td id="localShippingFee">&#8377;0.00</td><td id="regionalShippingFee">&#8377;0.00</td><td id="nationalShippingFee">&#8377;0.00</td></tr>
                  <tr><td id="commissionLabel">Referral Fee</td><td id="localReferralFee">&#8377;0.00</td><td id="regionalReferralFee">&#8377;0.00</td><td id="nationalReferralFee">&#8377;0.00</td></tr>
                  <tr><td id="fixedFeeLabel">Closing Fee</td><td id="localClosingFee">&#8377;0.00</td><td id="regionalClosingFee">&#8377;0.00</td><td id="nationalClosingFee">&#8377;0.00</td></tr>
                  <tr><td id="gstFeeLabel">GST on Amazon Fees</td><td id="localFeeGst">&#8377;0.00</td><td id="regionalFeeGst">&#8377;0.00</td><td id="nationalFeeGst">&#8377;0.00</td></tr>
                  <tr><td>TCS</td><td id="localTcs">&#8377;0.00</td><td id="regionalTcs">&#8377;0.00</td><td id="nationalTcs">&#8377;0.00</td></tr>
                  <tr><td>TDS</td><td id="localTds">&#8377;0.00</td><td id="regionalTds">&#8377;0.00</td><td id="nationalTds">&#8377;0.00</td></tr>
                  <tr class="total-row"><td>Total Deduction</td><td id="localTotalDeduction">&#8377;0.00</td><td id="regionalTotalDeduction">&#8377;0.00</td><td id="nationalTotalDeduction">&#8377;0.00</td></tr>
                  <tr class="settlement-row"><td>Bank Settlement</td><td id="localSettlement">&#8377;0.00</td><td id="regionalSettlement">&#8377;0.00</td><td id="nationalSettlement">&#8377;0.00</td></tr>
                  <tr class="profit-row"><td>Net Profit</td><td id="localProfit">&#8377;0.00</td><td id="regionalProfit">&#8377;0.00</td><td id="nationalProfit">&#8377;0.00</td></tr>
                </tbody>
              </table>
            </div>

            <div class="mpc-summary">
              <h3>Estimated Net Profit</h3>
              <div class="mpc-summary-grid">
                <div class="mpc-summary-item"><span>Local</span><strong id="localProfitSummary">&#8377;0.00</strong></div>
                <div class="mpc-summary-item"><span>Regional</span><strong id="regionalProfitSummary">&#8377;0.00</strong></div>
                <div class="mpc-summary-item"><span>National</span><strong id="nationalProfitSummary">&#8377;0.00</strong></div>
              </div>
            </div>

            <p style="margin-top:var(--sp-4); font-size:var(--fs-12); color:var(--ink-400); line-height:1.6;"><span id="calculationNoteText">This calculator provides an estimated result based on the selected category, selling price, product weight and available Amazon fee structure. Actual settlement may vary.</span></p>
          </div>
        </div>

      </div>
    </div>
  </section>
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
${renderHead({ title: "Marketplace Profit Calculator", description: null, route: "/marketplace-profit-calculator.html" })}
<link rel="stylesheet" href="/marketplace-profit-calculator/styles.css" />
</head>
<body>
${renderHeader("solutions")}
${body}
${renderFooter()}
${renderClientScript()}
<script type="module" src="/marketplace-profit-calculator/app.js"></script>
</body>
</html>`;
}
