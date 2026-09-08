export function legalDocument({ title, introduction, sections }) {
  return `<main class="legal-document">
    <article class="legal-document-content" aria-labelledby="legal-title">
      <h1 id="legal-title">${title}</h1>
      <p class="legal-introduction">${introduction}</p>
      <p class="legal-updated">Last updated: <time datetime="2026-09-08">September 8, 2026</time></p>
      ${sections.map(([heading, ...paragraphs], index) => `<section aria-labelledby="legal-section-${index + 1}">
        <h2 id="legal-section-${index + 1}">${index + 1}. ${heading}</h2>
        ${paragraphs.map(paragraph => `<p>${paragraph}</p>`).join('\n        ')}
      </section>`).join('\n      ')}
    </article>
  </main>`;
}

export const legalDocumentHead = '<link rel="stylesheet" href="/styles/legal-document.css">';
