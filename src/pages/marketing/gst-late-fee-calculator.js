import { breadcrumbs, renderHead, renderHeader, renderFooter, renderClientScript } from "../../components/layout.js";

export function gstLateFeeCalculatorPageHtml() {
  const body = `
  <section class="service-hero">
    <div class="container">
      ${breadcrumbs([{ label: "Home", href: "/index.html" }, { label: "Business Tools", href: "/solutions.html" }, { label: "GST Late Fee Calculator", href: "#" }])}
      <div style="margin-top:18px; max-width:640px;">
        <span class="eyebrow">Business Tools</span>
        <h1 class="h-1">GST Late Fee Calculator</h1>
        <p class="text-lead">Calculate estimated late fee for delayed GSTR-1 and GSTR-3B filing.</p>
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
              <span>Return Type</span>
              <select class="input" id="returnType">
                <option value="gstr1">GSTR-1</option>
                <option value="gstr3b">GSTR-3B</option>
              </select>
            </label>
            <label class="field full">
              <span>Return Status</span>
              <select class="input" id="returnStatus">
                <option value="nil">Nil Return</option>
                <option value="nonNil">Return With Transactions</option>
              </select>
            </label>
            <label class="field full" id="turnoverGroup">
              <span>Previous Financial Year Turnover</span>
              <select class="input" id="turnoverSlab">
                <option value="upto1_5">Up to &#8377;1.5 Crore</option>
                <option value="1_5to5">Above &#8377;1.5 Crore to &#8377;5 Crore</option>
                <option value="above5">Above &#8377;5 Crore</option>
              </select>
            </label>
            <label class="field">
              <span>Return Due Date</span>
              <input class="input" type="date" id="dueDate" />
            </label>
            <label class="field">
              <span>Actual Filing Date</span>
              <input class="input" type="date" id="filingDate" />
            </label>
          </div>

          <button type="button" class="btn btn-accent btn-block" id="calculateBtn" style="margin-top:var(--sp-5);">Calculate Late Fee</button>
          <div class="banner banner-danger hidden" id="errorMessage" style="margin-top:var(--sp-4);"></div>
        </div>

        <div class="card">
          <h2 class="h-3" style="margin-bottom:var(--sp-5);">Late Fee Calculation Result</h2>
          <div class="kv-list">
            <div class="kv-row"><span class="k">Return Type</span><span class="v" id="resultReturnType">&mdash;</span></div>
            <div class="kv-row"><span class="k">Delay Period</span><span class="v" id="delayDays">0 Days</span></div>
            <div class="kv-row"><span class="k">Late Fee Per Day</span><span class="v" id="feePerDay">&#8377;0.00</span></div>
            <div class="kv-row"><span class="k">Calculated Late Fee</span><span class="v" id="calculatedFee">&#8377;0.00</span></div>
            <div class="kv-row"><span class="k">Maximum Late Fee</span><span class="v" id="maximumFee">&#8377;0.00</span></div>
            <div class="kv-row"><span class="k">CGST Late Fee</span><span class="v" id="cgstFee">&#8377;0.00</span></div>
            <div class="kv-row"><span class="k">SGST Late Fee</span><span class="v" id="sgstFee">&#8377;0.00</span></div>
            <div class="kv-row final"><span class="k">Total Late Fee Payable</span><span class="v" id="totalLateFee">&#8377;0.00</span></div>
          </div>
          <button type="button" class="btn btn-secondary btn-block" id="resetBtn" style="margin-top:var(--sp-5);">Reset</button>
          <div style="margin-top:var(--sp-5); padding:var(--sp-4) var(--sp-5); border-radius:var(--r-md); background:var(--surface-50); border:1px solid var(--border);">
            <p style="font-size:var(--fs-13); color:var(--ink-400);">This tool provides an estimate based on the selected details. GST Portal calculation, notifications, waivers and special return periods may change the final late fee.</p>
          </div>
        </div>

      </div>
    </div>
  </section>
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
${renderHead({ title: "GST Late Fee Calculator", description: "Free GST Late Fee Calculator for delayed GSTR-1 and GSTR-3B filing." })}
<link rel="stylesheet" href="/gst-late-fee-calculator/styles.css" />
</head>
<body>
${renderHeader("solutions")}
${body}
${renderFooter()}
${renderClientScript()}
<script type="module" src="/gst-late-fee-calculator/app.js"></script>
</body>
</html>`;
}
