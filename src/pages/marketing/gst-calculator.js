import { breadcrumbs, renderHead, renderHeader, renderFooter, renderClientScript } from "../../components/layout.js";

export function gstCalculatorPageHtml() {
  const body = `
  <section class="service-hero">
    <div class="container">
      ${breadcrumbs([{ label: "Home", href: "/index.html" }, { label: "Business Tools", href: "/gst-calculator.html" }, { label: "GST Calculator", href: "#" }])}
      <div style="margin-top:18px; max-width:640px;">
        <span class="eyebrow">Business Tools</span>
        <h1 class="h-1">GST Calculator India</h1>
        <p class="text-lead">Calculate GST inclusive, exclusive, CGST, SGST and IGST instantly.</p>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container" style="max-width:960px;">
      <div class="tool-grid">

        <div class="card">
          <h2 class="h-3" style="margin-bottom:var(--sp-5);">Enter Details</h2>
          <div class="form-grid">
            <label class="field full">
              <span>Amount &#8377;</span>
              <input class="input" type="number" id="amount" placeholder="Example: 150000" min="0" step="0.01" />
            </label>

            <label class="field full">
              <span>GST Rate</span>
              <select class="input" id="gstRate">
                <option value="">Select GST Rate</option>
                <option value="0">0%</option>
                <option value="0.25">0.25%</option>
                <option value="3">3%</option>
                <option value="5">5%</option>
                <option value="12">12%</option>
                <option value="18">18%</option>
                <option value="28">28%</option>
              </select>
            </label>

            <label class="field full">
              <span>Calculation Type</span>
              <div class="option-grid">
                <label class="option-box"><input type="radio" name="calculationType" value="exclusive" checked /> GST Exclusive</label>
                <label class="option-box"><input type="radio" name="calculationType" value="inclusive" /> GST Inclusive</label>
              </div>
            </label>

            <label class="field full">
              <span>Transaction Type</span>
              <div class="option-grid">
                <label class="option-box"><input type="radio" name="transactionType" value="same" checked /> Same State</label>
                <label class="option-box"><input type="radio" name="transactionType" value="interstate" /> Other State</label>
              </div>
            </label>
          </div>

          <button type="button" class="btn btn-accent btn-block" id="calculateBtn" style="margin-top:var(--sp-5);">Calculate GST</button>
          <div class="banner banner-danger hidden" id="errorMessage" style="margin-top:var(--sp-4);"></div>
        </div>

        <div class="card">
          <h2 class="h-3" style="margin-bottom:var(--sp-5);">GST Calculation Result</h2>
          <div class="kv-list">
            <div class="kv-row"><span class="k">Taxable Value</span><span class="v" id="taxableValue">&#8377;0.00</span></div>
            <div class="kv-row"><span class="k">Total GST</span><span class="v" id="gstAmount">&#8377;0.00</span></div>
            <div id="sameStateResults">
              <div class="kv-row"><span class="k" id="cgstLabel">CGST</span><span class="v" id="cgstAmount">&#8377;0.00</span></div>
              <div class="kv-row"><span class="k" id="sgstLabel">SGST</span><span class="v" id="sgstAmount">&#8377;0.00</span></div>
            </div>
            <div id="interstateResults" class="hidden">
              <div class="kv-row"><span class="k" id="igstLabel">IGST</span><span class="v" id="igstAmount">&#8377;0.00</span></div>
            </div>
            <div class="kv-row final"><span class="k">Final Amount</span><span class="v" id="finalAmount">&#8377;0.00</span></div>
          </div>
          <button type="button" class="btn btn-secondary btn-block" id="resetBtn" style="margin-top:var(--sp-5);">Reset</button>
        </div>

      </div>
    </div>
  </section>
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
${renderHead({ title: "GST Calculator", description: "Free GST Inclusive and Exclusive Calculator. Calculate taxable value, GST amount, CGST, SGST and IGST instantly.", route: "/gst-calculator.html" })}
<link rel="stylesheet" href="/gst-calculator/styles.css" />
</head>
<body>
${renderHeader("solutions")}
${body}
${renderFooter()}
${renderClientScript()}
<script type="module" src="/gst-calculator/app.js"></script>
</body>
</html>`;
}
