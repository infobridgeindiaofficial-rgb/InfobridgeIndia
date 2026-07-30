document.addEventListener("DOMContentLoaded", () => {
    const DATA_URL = "../data/hsn-data.json";
    const INITIAL_LIMIT = 12;
    const LOAD_MORE_COUNT = 12;

    const searchInput = document.getElementById("hsnSearch");
    const searchButton = document.getElementById("searchButton");
    const clearButton = document.getElementById("clearSearch");
    const resultsGrid = document.getElementById("resultsGrid");
    const emptyState = document.getElementById("emptyState");
    const resultsTitle = document.getElementById("resultsTitle");
    const resultCount = document.getElementById("resultCount");
    const showMoreButton = document.getElementById("showMoreButton");
    const menuButton = document.getElementById("menuButton");
    const navMenu = document.getElementById("navMenu");

    let hsnData = [];
    let currentResults = [];
    let visibleCount = INITIAL_LIMIT;

    function normalizeText(value) {
        return String(value ?? "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9%]+/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    }

    function tokenize(value) {
        return normalizeText(value)
            .split(" ")
            .filter(Boolean);
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function getValue(record, keys) {
        for (const key of keys) {
            if (record[key] !== undefined && record[key] !== null) {
                return String(record[key]).trim();
            }
        }
        return "";
    }

    function prepareRecord(record, index) {
        const hsn = getValue(record, ["hsn", "HSN", "hsn_code", "HSN_CD", "code"]);
        const productName = getValue(record, [
            "product_name",
            "Product_Name",
            "product",
            "description",
            "name"
        ]);
        const gstRate = getValue(record, ["gst_rate", "GST_Rate", "gst", "rate"]);
        const keywords = getValue(record, [
            "keywords",
            "Search_Keywords",
            "search_keywords"
        ]);

        const productText = normalizeText(productName);
        const keywordText = normalizeText(keywords);

        return {
            id: index,
            hsn,
            productName,
            gstRate,
            keywords,
            normalizedHsn: normalizeText(hsn).replace(/\s/g, ""),
            productText,
            keywordText,
            productTokens: new Set(tokenize(productName)),
            keywordTokens: new Set(tokenize(keywords))
        };
    }

    function isValidRecord(record) {
        return Boolean(
            record.hsn &&
            record.productName &&
            record.gstRate &&
            normalizeText(record.gstRate) !== "varies"
        );
    }

    async function loadHsnData() {
        setLoadingState();

        try {
            const response = await fetch(DATA_URL, { cache: "no-store" });

            if (!response.ok) {
                throw new Error(`Unable to load HSN data: ${response.status}`);
            }

            const rawData = await response.json();

            if (!Array.isArray(rawData)) {
                throw new Error("HSN data must be a JSON array.");
            }

            hsnData = rawData.map(prepareRecord).filter(isValidRecord);
            setReadyState();
        } catch (error) {
            console.error(error);
            showDataError();
        }
    }

    function setLoadingState() {
        searchInput.disabled = true;
        searchButton.disabled = true;
        searchInput.placeholder = "Loading HSN data...";
        resultsTitle.textContent = "Loading HSN database";
        resultCount.textContent = "Loading";
        resultsGrid.innerHTML = "";
        showMoreButton.hidden = true;
    }

    function setReadyState() {
        searchInput.disabled = false;
        searchButton.disabled = false;
        searchInput.placeholder = "Enter product name or HSN code";
        resultsTitle.textContent = "Start typing to search";
        resultCount.textContent = "0 Results";
        restoreDefaultEmptyState();
        searchInput.focus();
    }

    function restoreDefaultEmptyState() {
        emptyState.hidden = false;
        emptyState.innerHTML = `
            <div class="empty-icon">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M21 21l-4.35-4.35m2.1-5.4a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z"></path>
                </svg>
            </div>
            <h3>Search your product</h3>
            <p>Enter a product name or type an HSN code, then click Search.</p>
        `;
    }

    function showDataError() {
        searchInput.disabled = true;
        searchButton.disabled = true;
        searchInput.placeholder = "HSN data could not be loaded";
        resultsTitle.textContent = "Unable to load HSN data";
        resultCount.textContent = "Error";
        resultsGrid.innerHTML = "";
        showMoreButton.hidden = true;
        emptyState.hidden = false;
        emptyState.innerHTML = `
            <div class="empty-icon">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 8v4m0 4h.01M10.27 3.7 2.6 17a2 2 0 0 0 1.73 3h15.34a2 2 0 0 0 1.73-3L13.73 3.7a2 2 0 0 0-3.46 0Z"></path>
                </svg>
            </div>
            <h3>HSN data not loaded</h3>
            <p>Check data/hsn-data.json and refresh the page.</p>
        `;
    }

    function tokenMatches(record, word) {
        return (
            record.productTokens.has(word) ||
            record.keywordTokens.has(word)
        );
    }

    function scoreRecord(record, query, queryWords, numericQuery) {
        let score = 0;

        if (numericQuery) {
            if (record.normalizedHsn === numericQuery) return 10000;
            if (record.normalizedHsn.startsWith(numericQuery)) return 8000;
            if (record.normalizedHsn.includes(numericQuery)) return 6000;
            return 0;
        }

        const allWordsMatch = queryWords.every((word) => tokenMatches(record, word));

        if (!allWordsMatch) {
            return 0;
        }

        if (record.productText === query) score += 5000;
        if (record.productText.startsWith(query)) score += 3500;
        if (record.productText.includes(query)) score += 2500;
        if (record.keywordText === query) score += 2200;
        if (record.keywordText.includes(query)) score += 1800;

        for (const word of queryWords) {
            if (record.productTokens.has(word)) score += 500;
            if (record.keywordTokens.has(word)) score += 250;
        }

        score -= Math.min(record.productName.length, 300) * 0.05;
        return score;
    }

    function searchRecords(queryValue) {
        const query = normalizeText(queryValue);
        const numericQuery = query.replace(/\D/g, "");
        const isNumericSearch = /^\d+$/.test(query);
        const queryWords = tokenize(query).filter((word) => word.length >= 2);

        if (!query || (!isNumericSearch && queryWords.length === 0)) {
            return [];
        }

        return hsnData
            .map((record) => ({
                record,
                score: scoreRecord(
                    record,
                    query,
                    queryWords,
                    isNumericSearch ? numericQuery : ""
                )
            }))
            .filter((item) => item.score > 0)
            .sort((a, b) => {
                if (b.score !== a.score) return b.score - a.score;
                if (a.record.productName.length !== b.record.productName.length) {
                    return a.record.productName.length - b.record.productName.length;
                }
                return a.record.hsn.localeCompare(
                    b.record.hsn,
                    undefined,
                    { numeric: true }
                );
            })
            .map((item) => item.record);
    }

    function formatGstRate(rate) {
        const cleanRate = String(rate ?? "").trim();
        if (!cleanRate) return "";
        if (cleanRate.includes("%")) return cleanRate;
        if (/^\d+(\.\d+)?$/.test(cleanRate)) return `${cleanRate}%`;
        return cleanRate;
    }

    function createResultCard(record, index) {
        return `
            <article class="result-card"
                style="animation-delay:${Math.min(index, 10) * 35}ms">
                <span class="card-label">Product Name</span>
                <h3>${escapeHtml(record.productName)}</h3>
                <div class="result-details">
                    <div class="detail-box">
                        <span>HSN Code</span>
                        <strong>${escapeHtml(record.hsn)}</strong>
                    </div>
                    <div class="detail-box gst">
                        <span>GST Rate</span>
                        <strong>${escapeHtml(formatGstRate(record.gstRate))}</strong>
                    </div>
                </div>
            </article>
        `;
    }

    function renderResults() {
        const total = currentResults.length;
        const visible = currentResults.slice(0, visibleCount);

        if (total === 0) {
            showNoResults();
            return;
        }

        emptyState.hidden = true;
        resultsGrid.innerHTML = visible.map(createResultCard).join("");
        resultsTitle.textContent =
            total === 1 ? "1 matching HSN record" : `${total} matching HSN records`;
        resultCount.textContent =
            total === 1 ? "1 Result" : `${total} Results`;
        showMoreButton.hidden = visibleCount >= total;

        if (!showMoreButton.hidden) {
            showMoreButton.textContent =
                `Show More Results (${total - visibleCount} remaining)`;
        }

        document.querySelector(".results-section")?.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }

    function showNoResults() {
        resultsGrid.innerHTML = "";
        resultsTitle.textContent = "No matching HSN found";
        resultCount.textContent = "0 Results";
        showMoreButton.hidden = true;
        emptyState.hidden = false;
        emptyState.innerHTML = `
            <div class="empty-icon">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M21 21l-4.35-4.35m2.1-5.4a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z"></path>
                </svg>
            </div>
            <h3>No result found</h3>
            <p>Try the exact product name, material name or HSN code.</p>
        `;
        document.querySelector(".results-section")?.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }

    function resetSearch() {
        currentResults = [];
        visibleCount = INITIAL_LIMIT;
        resultsGrid.innerHTML = "";
        resultsTitle.textContent = "Start typing to search";
        resultCount.textContent = "0 Results";
        showMoreButton.hidden = true;
        restoreDefaultEmptyState();
    }

    function runSearch() {
        const query = searchInput.value.trim();
        clearButton.classList.toggle("visible", query.length > 0);

        if (!query) {
            resetSearch();
            searchInput.focus();
            return;
        }

        visibleCount = INITIAL_LIMIT;
        currentResults = searchRecords(query);
        renderResults();
    }

    searchButton.addEventListener("click", runSearch);

    searchInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            runSearch();
        }

        if (event.key === "Escape") {
            searchInput.value = "";
            clearButton.classList.remove("visible");
            resetSearch();
        }
    });

    searchInput.addEventListener("input", () => {
        clearButton.classList.toggle(
            "visible",
            searchInput.value.trim().length > 0
        );
    });

    clearButton.addEventListener("click", () => {
        searchInput.value = "";
        clearButton.classList.remove("visible");
        resetSearch();
        searchInput.focus();
    });

    showMoreButton.addEventListener("click", () => {
        visibleCount += LOAD_MORE_COUNT;
        renderResults();
    });

    if (menuButton && navMenu) {
        menuButton.addEventListener("click", () => {
            navMenu.classList.toggle("open");
        });

        navMenu.querySelectorAll("a").forEach((link) => {
            link.addEventListener("click", () => {
                navMenu.classList.remove("open");
            });
        });
    }

    loadHsnData();
});
    