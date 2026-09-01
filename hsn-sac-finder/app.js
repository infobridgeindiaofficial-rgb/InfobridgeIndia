const queryInput = document.getElementById("hsnQuery");
const typeSelect = document.getElementById("classificationType");
const searchButton = document.getElementById("searchBtn");
const statusElement = document.getElementById("finderStatus");
const resultsElement = document.getElementById("resultsList");
const countElement = document.getElementById("directoryCount");

let directory = [];

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function scoreEntry(entry, normalizedQuery, tokens) {
  const code = entry[1];
  const description = normalize(entry[2]);
  let score = 0;

  if (code === normalizedQuery) score += 500;
  else if (code.startsWith(normalizedQuery) && /^\d+$/.test(normalizedQuery)) score += 300;
  if (description === normalizedQuery) score += 260;
  if (description.startsWith(normalizedQuery)) score += 160;
  if (description.includes(normalizedQuery)) score += 120;

  let matched = 0;
  for (const token of tokens) {
    if (description.includes(token) || code.includes(token)) {
      matched += 1;
      score += description.split(" ").includes(token) ? 30 : 15;
    }
  }

  if (matched !== tokens.length) return 0;
  score += Math.min(code.length, 8) * 2;
  score -= Math.max(0, description.length - 160) / 40;
  return score;
}

function renderResults(matches, query) {
  if (!matches.length) {
    statusElement.textContent = `No exact directory match found for “${query}”. Try fewer words, the main material, or choose HSN/SAC separately.`;
    resultsElement.innerHTML = "";
    return;
  }

  statusElement.innerHTML = `<strong>${matches.length} closest results</strong> for “${escapeHtml(query)}”. Compare the descriptions before selecting a code.`;
  resultsElement.innerHTML = matches.map(({ entry, score }, index) => {
    const [kind, code, description] = entry;
    const confidence = index === 0 && score >= 120 ? "Closest match" : "Related result";
    return `<article class="result-card">
      <div class="result-topline">
        <span class="kind-badge kind-${kind.toLowerCase()}">${kind === "HSN" ? "Goods · HSN" : "Services · SAC"}</span>
        <span class="match-label">${confidence}</span>
      </div>
      <div class="result-main">
        <div class="code-block"><span>${kind} code</span><strong>${escapeHtml(code)}</strong></div>
        <p>${escapeHtml(description)}</p>
      </div>
      <div class="result-footer">
        <span><strong>GST rate:</strong> Verify against the current official rate schedule</span>
        <button type="button" class="copy-code" data-copy-code="${escapeHtml(code)}">Copy code</button>
      </div>
    </article>`;
  }).join("");
}

function searchDirectory() {
  const query = queryInput.value.trim();
  const normalizedQuery = normalize(query);
  const selectedType = typeSelect.value;

  if (normalizedQuery.length < 2) {
    statusElement.textContent = "Enter at least 2 characters to search.";
    resultsElement.innerHTML = "";
    queryInput.focus();
    return;
  }

  const tokens = normalizedQuery.split(" ").filter((token) => token.length > 1);
  const matches = directory
    .filter((entry) => selectedType === "ALL" || entry[0] === selectedType)
    .map((entry) => ({ entry, score: scoreEntry(entry, normalizedQuery, tokens) }))
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score || b.entry[1].length - a.entry[1].length)
    .slice(0, 12);

  renderResults(matches, query);
}

async function loadDirectory() {
  try {
    const response = await fetch("/hsn-sac-finder/directory.json.gz");
    if (!response.ok) throw new Error("Directory could not be loaded");
    if (typeof DecompressionStream === "undefined") throw new Error("This browser does not support the compressed directory");
    const text = await new Response(response.body.pipeThrough(new DecompressionStream("gzip"))).text();
    directory = JSON.parse(text);
    const hsnCount = directory.filter((entry) => entry[0] === "HSN").length;
    const sacCount = directory.length - hsnCount;
    countElement.textContent = `${directory.length.toLocaleString("en-IN")} codes · ${hsnCount.toLocaleString("en-IN")} HSN · ${sacCount.toLocaleString("en-IN")} SAC`;
    statusElement.textContent = "Directory ready. Search for a product, service or code.";
  } catch (error) {
    countElement.textContent = "Directory unavailable";
    statusElement.textContent = "The classification directory could not be loaded. Please refresh and try again.";
    searchButton.disabled = true;
  }
}

searchButton.addEventListener("click", searchDirectory);
queryInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") searchDirectory();
});

document.querySelectorAll("[data-example]").forEach((button) => {
  button.addEventListener("click", () => {
    queryInput.value = button.dataset.example;
    searchDirectory();
  });
});

resultsElement.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-copy-code]");
  if (!button) return;
  try {
    await navigator.clipboard.writeText(button.dataset.copyCode);
    const original = button.textContent;
    button.textContent = "Copied";
    setTimeout(() => { button.textContent = original; }, 1400);
  } catch {
    button.textContent = button.dataset.copyCode;
  }
});

loadDirectory();
