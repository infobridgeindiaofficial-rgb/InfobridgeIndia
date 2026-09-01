// Guarded rather than assumed: this same module is imported directly (no DOM) by the automated
// ranking/GST-rate tests in tests/hsn-sac-finder.test.js, so the search/scoring/rate logic below
// can be tested against the real implementation instead of a second, drift-prone copy of it.
const isBrowser = typeof document !== "undefined";
const queryInput = isBrowser ? document.getElementById("hsnQuery") : null;
const typeSelect = isBrowser ? document.getElementById("classificationType") : null;
const searchButton = isBrowser ? document.getElementById("searchBtn") : null;
const statusElement = isBrowser ? document.getElementById("finderStatus") : null;
const resultsElement = isBrowser ? document.getElementById("resultsList") : null;
const countElement = isBrowser ? document.getElementById("directoryCount") : null;

let directory = [];
let rateSchedule = [];

const IRREGULAR_WORDS = Object.freeze({
  knives: "knife", knife: "knife", leaves: "leaf", loaves: "loaf",
  scarves: "scarf", shelves: "shelf", halves: "half", wives: "wife",
  glasses: "glass", boxes: "box", dishes: "dish", brushes: "brush",
  services: "service", goods: "good", bags: "bag", bottles: "bottle",
});

const SEARCH_CONCEPTS = Object.freeze({
  food: ["food", "kitchen", "table", "household"],
  container: ["container", "receptacle", "ware", "jar", "bottle", "box", "case", "vessel", "tin", "canister"],
  box: ["box", "case", "container", "tin", "canister", "ware"],
  storage: ["storage", "container", "receptacle", "box", "case"],
  lunch: ["lunch", "food", "kitchen", "table", "tiffin"],
  tiffin: ["tiffin", "lunch", "food", "kitchen"],
  utensil: ["utensil", "kitchenware", "tableware", "household"],
  kitchenware: ["kitchenware", "utensil", "tableware", "kitchen"],
  tableware: ["tableware", "utensil", "kitchenware", "table"],
  kitchen: ["kitchen", "kitchenware", "utensil"],
  crockery: ["crockery", "tableware", "kitchenware"],
  cookware: ["cookware", "utensil", "kitchenware", "pot", "pan"],
  cup: ["cup", "mug", "drinking", "glassware"],
  plate: ["plate", "dish", "tableware"],
  bag: ["bag", "sack", "pouch", "shopping"],
  bottle: ["bottle", "flask", "container", "carboy"],
  pot: ["pot", "vessel", "pan", "cookware", "cooking", "utensil"],
  vessel: ["vessel", "pot", "container", "utensil"],
  cleaning: ["cleaning", "washing", "scouring", "sanitary"],
  website: ["website", "web", "software", "information technology"],
});

// A handful of materials the directory routinely classifies goods by. Naming the SAME material
// as the query is a strong positive signal; naming a DIFFERENT, explicitly-stated material is a
// strong negative one -- this is what keeps a "plastic" search from ranking a glass-specific
// entry, and vice versa, without needing a hand-written rule per product.
const MATERIALS = Object.freeze({
  glass: ["glass"],
  plastic: ["plastic", "plastics", "polymer"],
  steel: ["steel", "stainless"],
  iron: ["iron"],
  wood: ["wood", "wooden"],
  ceramic: ["ceramic", "porcelain", "china", "stoneware", "earthenware", "clay"],
  aluminium: ["aluminium", "aluminum"],
  paper: ["paper", "paperboard", "cardboard"],
  rubber: ["rubber"],
  leather: ["leather"],
  copper: ["copper", "brass"],
  silver: ["silver"],
  gold: ["gold"],
});

// Two opposing purposes the very same shape of object -- a jar, a bottle, a box -- is routinely
// split across in the tariff: everyday table/kitchen/household use, or industrial packing and
// conveyance. The query's own wording is the only signal available to tell them apart, so
// matching words on either side are tracked the same way for both the search query and each
// candidate's own description.
const HOUSEHOLD_INTENT_WORDS = new Set([
  "food", "kitchen", "kitchenware", "table", "tableware", "household", "cooking", "cook",
  "dining", "meal", "lunch", "tiffin", "utensil", "utensils", "vessel", "crockery", "domestic",
  "home", "toilet",
]);
const PACKING_INTENT_WORDS = new Set([
  "packing", "pack", "conveyance", "transport", "shipping", "industrial", "chemical",
  "commercial", "bulk", "godown", "warehouse", "cargo",
]);

const MATERIAL_WORDS = new Set(Object.values(MATERIALS).flat());

function detectMaterial(words) {
  for (const [material, aliases] of Object.entries(MATERIALS)) {
    if (aliases.some((alias) => words.includes(alias))) return material;
  }
  return null;
}

function detectIntent(words) {
  const household = words.some((word) => HOUSEHOLD_INTENT_WORDS.has(word));
  const packing = words.some((word) => PACKING_INTENT_WORDS.has(word));
  if (household && !packing) return "household";
  if (packing && !household) return "packing";
  return null;
}

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

// Official descriptions routinely name the very thing they exclude -- "autoclaves other than
// for cooking or heating food", "tractors except road tractors for semi-trailers". Matching
// individual words against the raw text would treat that named exclusion as if it were a
// positive description of the item, so word-level matching is done against the text with any
// "other than .../except .../excluding ..." clause removed first.
function withoutExclusionText(value) {
  return String(value || "").replace(/\b(other than|except|excluding)\b[^,;()]*/gi, " ");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function scoreEntry(entry, normalizedQuery, tokens, queryMaterial, queryIntent) {
  const code = entry[1];
  const description = normalize(entry[2]);
  const isCodeQuery = /^\d+$/.test(normalizedQuery);
  let score = 0;

  // An exact (or exact-prefix) code match is a certainty, not a guess -- nothing computed below
  // can ever add up to enough to outrank it, and for a pure code lookup nothing below should
  // even be considered (a code has no "material" or "intent" to weigh against word matches).
  if (code === normalizedQuery) score += 500;
  else if (isCodeQuery && code.startsWith(normalizedQuery)) score += 300;
  if (isCodeQuery) return score;

  if (description === normalizedQuery) score += 260;
  if (description.startsWith(normalizedQuery)) score += 160;
  if (description.includes(normalizedQuery)) score += 120;

  const descriptionWords = normalize(withoutExclusionText(entry[2])).split(" ");
  let matchedTokens = 0;
  let strongMatches = 0;
  let productSignal = false;
  for (const token of tokens) {
    const concepts = SEARCH_CONCEPTS[token] || [token];
    const isMaterialToken = MATERIAL_WORDS.has(token);
    if (descriptionWords.includes(token)) {
      matchedTokens += 1;
      strongMatches += 1;
      if (!isMaterialToken) productSignal = true;
      score += 30;
      continue;
    }
    const exactConcept = concepts.find((concept) => descriptionWords.includes(concept));
    if (exactConcept) {
      matchedTokens += 1;
      strongMatches += 1;
      if (!isMaterialToken) productSignal = true;
      score += 20;
      continue;
    }
    if (concepts.some((concept) => description.includes(concept)) || code.includes(token)) {
      matchedTokens += 1;
      if (!isMaterialToken) productSignal = true;
      score += 10;
    }
  }

  // Every word used to matter equally and *all* of them had to match, which is exactly why a
  // reasonable search like "food storage container" returned nothing: no single official
  // description contains all three literal ideas at once. Requiring only that the query have
  // *some* real relevance -- and rewarding results that cover more of it -- lets material,
  // product and purpose combine instead of needing a perfect literal match.
  if (matchedTokens === 0) return 0;
  if (tokens.length > 1 && strongMatches === 0) return 0;
  // A material name matching on its own proves nothing about *what* is being searched for --
  // "steel vessel" must not be satisfied by any random steel product that has nothing to do
  // with a vessel. Once the query names a material, at least one other, non-material word
  // (the actual product/use) must also find a match.
  if (queryMaterial && tokens.length > 1 && !productSignal) return 0;
  score += (matchedTokens / tokens.length) * 40;

  const material = detectMaterial(descriptionWords);
  if (queryMaterial) {
    if (material === queryMaterial) score += 45;
    else if (material) score -= 60;
    // A raw or semi-finished material heading (flat-rolled sheet, coil, ingot, wire rod and
    // the like) can coincidentally share a word with a finished household product -- a
    // "pressure vessel quality" steel-coil grade is not a cooking vessel -- so when the query
    // names a material, downrank the raw-material forms of it rather than the finished articles.
    if (["rolled", "coil", "ingot", "billet", "wrought", "unwrought", "flat", "semi"].some((w) => descriptionWords.includes(w))) score -= 50;
  }

  const intent = detectIntent(descriptionWords);
  if (queryIntent) {
    if (intent === queryIntent) score += 55;
    else if (intent) score -= 75;
    // A household-use search (food/kitchen/storage/container and the like) should favour the
    // classifications actually named "tableware"/"kitchenware" over an incidental household-word
    // match somewhere in an unrelated heading (e.g. a travel-goods heading that happens to
    // mention "food" because it also covers insulated food-carry bags).
    if (queryIntent === "household" && (descriptionWords.includes("kitchenware") || descriptionWords.includes("tableware"))) score += 40;
  }

  // A word like "cooking" or "food" appearing in an industrial-machinery or processed-food
  // heading is not describing a household item, even though it matches literally -- an
  // extrusion "cooking plant" is equipment, not a cooking pot. This applies regardless of how
  // many words the query has, so "cooking pot" is not quietly won by a plant/machine/appliance
  // entry just because "cooking" happens to be one of its official words too.
  for (const qualifier of ["machine", "industrial", "medical", "surgical", "paper", "electric", "part", "component", "plant", "equipment", "machinery", "appliance", "apparatus"]) {
    if (descriptionWords.includes(qualifier) && !tokens.includes(qualifier)) score -= 28;
  }

  if (tokens.length === 1) {
    score += code.length <= 4 ? 70 : code.length === 6 ? 30 : 0;
  } else {
    // Broad, multi-word searches should surface the specific 8-digit (then 6-digit) child codes
    // a user can actually pick, not just the heading they already typed their way into.
    score += Math.min(code.length, 8) * 3;
  }
  score -= Math.max(0, description.length - 160) / 40;
  return Math.max(0, score);
}

function rateForEntry(kind, code) {
  // Each row's code is already a single, clean HSN/SAC prefix -- resolved once, offline, by
  // scripts/build-hsn-rates.py (which is also where published "except"/"other than" exclusions
  // are parsed and where a heading is narrowed to one specific child code whenever the
  // schedule's own wording confidently identifies it). At runtime this only has to find the
  // most specific prefix that actually covers `code` and was not excluded from it.
  const candidates = rateSchedule
    .filter((row) => row[0] === kind && (code.startsWith(row[1]) || row[1].startsWith(code)))
    .filter((row) => !(row[8] || "").split(",").filter(Boolean).some((excluded) => code.startsWith(excluded)))
    .sort((a, b) => b[1].length - a[1].length);

  if (!candidates.length) return null;
  const longest = candidates[0][1].length;
  const closest = candidates.filter((row) => row[1].length === longest);
  const distinctRates = [...new Set(closest.map((row) => `${row[3]}|${row[4]}|${row[5]}`))];
  if (distinctRates.length !== 1) return { multiple: true, rows: closest };
  return { multiple: false, row: closest[0] };
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

function rankMatches(query, selectedType) {
  const normalizedQuery = normalize(query);
  if (normalizedQuery.length < 2) return [];
  const tokens = normalizedQuery.split(" ").filter((token) => token.length > 1);
  const queryMaterial = detectMaterial(tokens);
  const queryIntent = detectIntent(tokens);
  return directory
    .filter((entry) => selectedType === "ALL" || entry[0] === selectedType)
    .map((entry) => ({ entry, score: scoreEntry(entry, normalizedQuery, tokens, queryMaterial, queryIntent) }))
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score || b.entry[1].length - a.entry[1].length)
    .slice(0, 12);
}

function searchDirectory() {
  const query = queryInput.value.trim();
  if (normalize(query).length < 2) {
    statusElement.textContent = "Enter at least 2 characters to search.";
    resultsElement.innerHTML = "";
    queryInput.focus();
    return;
  }
  renderResults(rankMatches(query, typeSelect.value), query);
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

if (isBrowser) {
  searchButton.addEventListener("click", searchDirectory);
  queryInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") searchDirectory();
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
}

// Exported for tests/hsn-sac-finder.test.js only -- the browser never imports this module, it
// loads it as a page script, so these exports have no effect on the page itself.
export { normalize, detectMaterial, detectIntent, scoreEntry, rateForEntry, rankMatches, setDirectoryForTests, setRateScheduleForTests };

function setDirectoryForTests(rows) { directory = rows; }
function setRateScheduleForTests(rows) { rateSchedule = rows; }
