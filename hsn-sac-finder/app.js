const queryInput = document.getElementById("hsnQuery");
const typeSelect = document.getElementById("classificationType");
const searchButton = document.getElementById("searchBtn");
const statusElement = document.getElementById("finderStatus");
const resultsElement = document.getElementById("resultsList");
const countElement = document.getElementById("directoryCount");

let directory = [];
let rateSchedule = [];

const IRREGULAR_WORDS = Object.freeze({
  knives: "knife", knife: "knife", leaves: "leaf", loaves: "loaf",
  scarves: "scarf", shelves: "shelf", halves: "half", wives: "wife",
  glasses: "glass", boxes: "box", dishes: "dish", brushes: "brush",
  services: "service", goods: "good", bags: "bag", bottles: "bottle",
});

function normalizeWord(word) {
  if (IRREGULAR_WORDS[word]) return IRREGULAR_WORDS[word];
  if (word.length > 4 && word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.length > 4 && /(ches|shes|sses|xes|zes)$/.test(word)) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map(normalizeWord)
    .join(" ");
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
  if (tokens.length === 1 && !/^\d+$/.test(normalizedQuery)) {
    score += code.length <= 4 ? 70 : code.length === 6 ? 30 : 0;
    for (const qualifier of ["machine", "industrial", "medical", "surgical", "paper", "electric", "part", "component"]) {
      if (description.includes(qualifier) && !tokens.includes(qualifier)) score -= 28;
    }
  } else {
    score += Math.min(code.length, 8) * 2;
  }
  score -= Math.max(0, description.length - 160) / 40;
  return score;
}

function numericPrefixes(value) {
  return String(value || "").match(/\d{2,8}/g) || [];
}

function rateForEntry(kind, code) {
  const candidates = rateSchedule
    .filter((row) => row[0] === kind)
    .flatMap((row) => numericPrefixes(row[1]).map((prefix) => ({ row, prefix: prefix.replace(/\s/g, "") })))
    .filter(({ prefix }) => code.startsWith(prefix) || prefix.startsWith(code))
    .sort((a, b) => b.prefix.length - a.prefix.length);

  if (!candidates.length) return null;
  const longest = candidates[0].prefix.length;
  const closest = candidates.filter((candidate) => candidate.prefix.length === longest);
  const distinctRates = [...new Set(closest.map(({ row }) => `${row[3]}|${row[4]}|${row[5]}`))];
  if (distinctRates.length !== 1) return { multiple: true, rows: closest.map(({ row }) => row) };
  return { multiple: false, row: closest[0].row };
}

function renderRate(kind, code) {
  const match = rateForEntry(kind, code);
  if (!match) return `<span><strong>GST rate:</strong> No direct schedule match — verify officially</span>`;
  if (match.multiple) return `<span><strong>GST rate:</strong> Multiple rates or conditions apply — verify product details</span>`;
  const row = match.row;
  const condition = row[7] && row[7] !== "-" && row[7] !== "nan" ? ` · Conditions apply` : "";
  return `<span><strong>GST rate:</strong> IGST ${escapeHtml(row[5])} · CGST ${escapeHtml(row[3])} + SGST/UTGST ${escapeHtml(row[4])}${condition}</span>`;
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
        ${renderRate(kind, code)}
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
    const [response, rateResponse] = await Promise.all([
      fetch("/hsn-sac-finder/directory.json.gz"),
      fetch("/hsn-sac-finder/rates.json.gz"),
    ]);
    if (!response.ok || !rateResponse.ok) throw new Error("Directory could not be loaded");
    if (typeof DecompressionStream === "undefined") throw new Error("This browser does not support the compressed directory");
    const text = await new Response(response.body.pipeThrough(new DecompressionStream("gzip"))).text();
    const rateText = await new Response(rateResponse.body.pipeThrough(new DecompressionStream("gzip"))).text();
    directory = JSON.parse(text);
    rateSchedule = JSON.parse(rateText);
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
