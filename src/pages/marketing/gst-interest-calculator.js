import { breadcrumbs, renderHead, renderHeader, renderFooter, renderClientScript } from "../../components/layout.js";

export function gstInterestCalculatorPageHtml() {
  const body = `
  <section class="service-hero">
    <div class="container">
      ${breadcrumbs([{ label: "Home", href: "/index.html" }, { label: "Business Tools", href: "/solutions.html" }, { label: "GST Interest Calculator", href: "#" }])}
      <div style="margin-top:18px; max-width:640px;">
        <span class="eyebrow">Business Tools</span>
        <h1 class="h-1">GST Interest Calculator</h1>
        <p class="text-lead">Calculate interest payable on delayed GST tax payments.</p>
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
              <span>Delayed Tax Amount &#8377;</span>
              <input class="input" type="number" id="taxAmount" min="0" step="0.01" placeholder="Example: 50000" />
            </label>
            <label class="field">
              <span>Payment Due Date</span>
              <input class="input" type="date" id="dueDate" />
            </label>
            <label class="field">
              <span>Actual Payment Date</span>
              <input class="input" type="date" id="paymentDate" />
            </label>
            <label class="field full">
              <span>Annual Interest Rate</span>
              <select class="input" id="interestRate">
                <option value="18">18% &ndash; Delayed tax payment</option>
                <option value="24">24% &ndash; Other applicable cases</option>
              </select>
            </label>
          </div>

          <button type="button" class="btn btn-accent btn-block" id="calculateBtn" style="margin-top:var(--sp-5);">Calculate Interest</button>
          <div class="banner banner-danger hidden" id="errorMessage" style="margin-top:var(--sp-4);"></div>
        </div>

        <div class="card">
          <h2 class="h-3" style="margin-bottom:var(--sp-5);">Interest Calculation Result</h2>
          <div class="kv-list">
            <div class="kv-row"><span class="k">Delayed Tax Amount</span><span class="v" id="resultTaxAmount">&#8377;0.00</span></div>
            <div class="kv-row"><span class="k">Interest Rate</span><span class="v" id="resultRate">0%</span></div>
            <div class="kv-row"><span class="k">Number of Delay Days</span><span class="v" id="delayDays">0 Days</span></div>
            <div class="kv-row"><span class="k">Interest Per Day</span><span class="v" id="dailyInterest">&#8377;0.00</span></div>
            <div class="kv-row final"><span class="k">Total Interest Payable</span><span class="v" id="totalInterest">&#8377;0.00</span></div>
          </div>
          <button type="button" class="btn btn-secondary btn-block" id="resetBtn" style="margin-top:var(--sp-5);">Reset</button>
          <div class="ptw-note" style="margin-top:var(--sp-5); padding:var(--sp-4) var(--sp-5); border-radius:var(--r-md); background:var(--surface-50); border:1px solid var(--border);">
            <p style="font-size:var(--fs-13); color:var(--ink-400);">This calculator provides an estimate. Final interest may vary based on GST Portal calculations, available ITC and applicable GST rules.</p>
          </div>
        </div>

      </div>
    </div>
  </section>
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
${renderHead({ title: "GST Interest Calculator", description: "Free GST Interest Calculator to calculate interest on delayed GST tax payments." })}
<link rel="stylesheet" href="/gst-interest-calculator/styles.css" />
</head>
<body>
${renderHeader("solutions")}
${body}
${renderFooter()}
${renderClientScript()}
<script type="module" src="/gst-interest-calculator/app.js"></script>
</body>
</html>`;
}
