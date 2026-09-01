import { breadcrumbs, renderHead, renderHeader, renderFooter, renderClientScript } from "../../components/layout.js";

export function hsnSacFinderPageHtml() {
  const body = `
  <section class="service-hero hsn-hero">
    <div class="container">
      ${breadcrumbs([{ label: "Home", href: "/index.html" }, { label: "Business Tools", href: "/gst-calculator.html" }, { label: "HSN/SAC Finder", href: "#" }])}
      <div class="hsn-hero-copy">
        <span class="eyebrow">Free GST Business Tool</span>
        <h1 class="h-1">HSN Code &amp; SAC Code Finder</h1>
        <p class="text-lead">Search 22,600+ Indian HSN and SAC entries by product name, service name or code.</p>
      </div>
    </div>
  </section>

  <main class="section hsn-main">
    <div class="container hsn-container">
      <section class="card hsn-search-card" aria-labelledby="finder-title">
        <div class="hsn-search-heading">
          <div>
            <h2 class="h-3" id="finder-title">Find the closest classification</h2>
            <p>Try a specific description such as “stainless steel water bottle”, “wooden comb” or “website development”.</p>
          </div>
          <span class="directory-count" id="directoryCount">Loading directory…</span>
        </div>

        <div class="finder-controls">
          <label class="field finder-query">
            <span>Product, service or code</span>
            <input class="input" id="hsnQuery" type="search" autocomplete="off" placeholder="Example: glass water bottle" aria-describedby="searchHelp" />
          </label>
          <label class="field finder-type">
            <span>Classification</span>
            <select class="input" id="classificationType">
              <option value="ALL">HSN &amp; SAC</option>
              <option value="HSN">Goods (HSN)</option>
              <option value="SAC">Services (SAC)</option>
            </select>
          </label>
          <button type="button" class="btn btn-accent finder-button" id="searchBtn">Search code</button>
        </div>
        <p class="search-help" id="searchHelp">Enter at least 2 characters. More product details give a more accurate match.</p>
        <div class="popular-searches" aria-label="Popular searches">
          <span>Try:</span>
          <button type="button" data-example="water bottle">Water bottle</button>
          <button type="button" data-example="wooden comb">Wooden comb</button>
          <button type="button" data-example="shopping bag">Shopping bag</button>
          <button type="button" data-example="construction service">Construction service</button>
        </div>
      </section>

      <div class="finder-status" id="finderStatus" aria-live="polite"></div>
      <section class="results-list" id="resultsList" aria-label="Search results"></section>

      <section class="card finder-note">
        <h2 class="h-4">Before using a code on an invoice</h2>
        <p>This directory helps you shortlist a classification. Confirm the exact material, use and product specification before filing. The uploaded official directory contains codes and descriptions, but does not include GST rates.</p>
        <div class="note-actions">
          <a class="btn btn-secondary btn-sm" href="https://www.gst.gov.in/" target="_blank" rel="noopener noreferrer">Verify on GST Portal</a>
          <a class="text-link" href="https://tutorial.gst.gov.in/userguide/taxpayersdashboard/Search_HSN_SAC_Tax_Rates_manual.htm" target="_blank" rel="noopener noreferrer">Read official HSN search guidance</a>
        </div>
      </section>

      <section class="finder-content">
        <h2 class="h-3">How the HSN/SAC finder works</h2>
        <div class="content-grid">
          <article><h3>Search by everyday name</h3><p>Enter the name used by customers or sellers. The finder checks every word against the official description directory and ranks the closest entries.</p></article>
          <article><h3>Compare detailed codes</h3><p>Results prefer more detailed 6-digit and 8-digit classifications while still showing relevant chapter and heading codes for context.</p></article>
          <article><h3>Verify the GST rate</h3><p>GST rates can depend on the exact product, conditions and current notifications. The tool never invents a tax rate when the source directory does not contain one.</p></article>
        </div>
      </section>
    </div>
  </main>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
${renderHead({ title: "HSN Code Finder", description: "Search Indian HSN and SAC codes by product name, service description or code using a directory of more than 22,600 classifications.", route: "/hsn-sac-code-finder.html" })}
<link rel="stylesheet" href="/hsn-sac-finder/styles.css" />
</head>
<body>
${renderHeader("solutions")}
${body}
${renderFooter()}
${renderClientScript()}
<script type="module" src="/hsn-sac-finder/app.js"></script>
</body>
</html>`;
}
