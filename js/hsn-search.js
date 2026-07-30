document.addEventListener("DOMContentLoaded", () => {
    const DATA_URL = "../data/hsn-data.json";
    const INITIAL_LIMIT = 12;
    const LOAD_MORE_COUNT = 12;
    const DEBOUNCE_DELAY = 120;

    const searchInput = document.getElementById("hsnSearch");
    const clearButton = document.getElementById("clearSearch");
    const resultsGrid = document.getElementById("resultsGrid");
    const emptyState = document.getElementById("emptyState");
    const resultsTitle = document.getElementById("resultsTitle");
    const resultCount = document.getElementById("resultCount");
    const showMoreButton = document.getElementById("showMoreButton");
    const popularButtons = document.querySelectorAll("[data-search]");
    const menuButton = document.getElementById("menuButton");
    const navMenu = document.getElementById("navMenu");

    let hsnData = [];
    let currentResults = [];
    let visibleCount = INITIAL_LIMIT;
    let debounceTimer;

    function normalizeText(value) {
        return String(value ?? "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9%]+/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function getRecordValue(record, possibleKeys) {
        for (const key of possibleKeys) {
            if (record[key] !== undefined && record[key] !== null) {
                return String(record[key]).trim();
            }
        }

        return "";
    }

    function prepareRecord(record, index) {
        const hsn = getRecordValue(record, [
            "hsn",
            "HSN",
            "hsn_code",
            "HSN_CD",
            "code"
        ]);

        const productName = getRecordValue(record, [
            "product_name",
            "Product_Name",
            "product",
            "description",
            "name"
        ]);

        const gstRate = getRecordValue(record, [
            "gst_rate",
            "GST_Rate",
            "gst",
            "rate"
        ]);

        const keywords = getRecordValue(record, [
            "keywords",
            "Search_Keywords",
            "search_keywords"
        ]);

        return {
            id: index,
            hsn,
            productName,
            gstRate,
            keywords,
            normalizedHsn: normalizeText(hsn).replace(/\s/g, ""),
            normalizedProduct: normalizeText(productName),
            normalizedKeywords: normalizeText(keywords),
            searchableText: normalizeText(
                `${hsn} ${productName} ${keywords}`
            )
        };
    }

    function isValidRecord(record) {
        if (!record.hsn || !record.productName || !record.gstRate) {
            return false;
        }

        if (normalizeText(record.gstRate) === "varies") {
            return false;
        }

        return true;
    }

    async function loadHsnData() {
        setLoadingState();

        try {
            const response = await fetch(DATA_URL, {
                cache: "no-store"
            });

            if (!response.ok) {
                throw new Error(`Unable to load HSN data: ${response.status}`);
            }

            const rawData = await response.json();

            if (!Array.isArray(rawData)) {
                throw new Error("HSN data must be a JSON array.");
            }

            hsnData = rawData
                .map(prepareRecord)
                .filter(isValidRecord);

            setReadyState();

            const initialQuery = searchInput.value.trim();

            if (initialQuery) {
                runSearch(initialQuery);
            }
        } catch (error) {
            console.error(error);
            showDataError();
        }
    }

    function setLoadingState() {
        searchInput.disabled = true;
        searchInput.placeholder = "Loading HSN data...";
        resultsTitle.textContent = "Loading HSN database";
        resultCount.textContent = "Loading";
        emptyState.hidden = false;
        resultsGrid.innerHTML = "";
        showMoreButton.hidden = true;

        emptyState.innerHTML = `
            <div class="empty-icon">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48 2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48 2.83-2.83"></path>
                </svg>
            </div>
            <h3>Loading HSN data</h3>
            <p>Please wait a moment.</p>
        `;
    }

    function setReadyState() {
        searchInput.disabled = false;
        searchInput.placeholder = "Search bottle, comb, steel plate...";
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
            <p>Enter a product name such as “bottle” or type an HSN code.</p>
        `;
    }

    function showDataError() {
        searchInput.disabled = true;
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
            <p>Check that data/hsn-data.json is saved correctly, then refresh the page.</p>
        `;
    }

    function scoreRecord(record, query, queryWords, numericQuery) {
        let score = 0;

        const product = record.normalizedProduct;
        const keywords = record.normalizedKeywords;
        const hsn = record.normalizedHsn;
        const searchable = record.searchableText;

        if (numericQuery) {
            if (hsn === numericQuery) {
                score += 1000;
            } else if (hsn.startsWith(numericQuery)) {
                score += 700;
            } else if (hsn.includes(numericQuery)) {
                score += 500;
            }
        }

        if (product === query) {
            score += 900;
        }

        if (product.startsWith(query)) {
            score += 650;
        }

        if (product.includes(query)) {
            score += 500;
        }

        if (keywords === query) {
            score += 450;
        }

        if (keywords.startsWith(query)) {
            score += 350;
        }

        if (keywords.includes(query)) {
            score += 260;
        }

        if (searchable.includes(query)) {
            score += 180;
        }

        let matchedWords = 0;

        for (const word of queryWords) {
            if (!word) {
                continue;
            }

            if (product.split(" ").includes(word)) {
                score += 90;
                matchedWords += 1;
            } else if (product.includes(word)) {
                score += 60;
                matchedWords += 1;
            } else if (keywords.includes(word)) {
                score += 40;
                matchedWords += 1;
            } else if (hsn.includes(word)) {
                score += 35;
                matchedWords += 1;
            }
        }

        if (queryWords.length > 1 && matchedWords === queryWords.length) {
            score += 220;
        }

        if (matchedWords === 0 && score === 0) {
            return 0;
        }

        score -= Math.min(product.length, 250) * 0.03;

        return score;
    }

    function searchRecords(queryValue) {
        const query = normalizeText(queryValue);
        const numericQuery = query.replace(/\D/g, "");
        const queryWords = query
            .split(" ")
            .filter((word) => word.length > 0);

        if (!query) {
            return [];
        }

        return hsnData
            .map((record) => ({
                record,
                score: scoreRecord(
                    record,
                    query,
                    queryWords,
                    numericQuery
                )
            }))
            .filter((item) => item.score > 0)
            .sort((a, b) => {
                if (b.score !== a.score) {
                    return b.score - a.score;
                }

                if (a.record.productName.length !== b.record.productName.length) {
                    return (
                        a.record.productName.length -
                        b.record.productName.length
                    );
                }

                return a.record.hsn.localeCompare(
                    b.record.hsn,
                    undefined,
                    { numeric: true }
                );
            })
            .map((item) => item.record);
    }

    function createResultCard(record, index) {
        const safeProductName = escapeHtml(record.productName);
        const safeHsn = escapeHtml(record.hsn);
        const safeGstRate = escapeHtml(formatGstRate(record.gstRate));

        return `
            <article
                class="result-card"
                style="animation-delay: ${Math.min(index, 10) * 35}ms"
            >
                <span class="card-label">Product Name</span>

                <h3>${safeProductName}</h3>

                <div class="result-details">

                    <div class="detail-box">
                        <span>HSN Code</span>
                        <strong>${safeHsn}</strong>
                    </div>

                    <div class="detail-box gst">
                        <span>GST Rate</span>
                        <strong>${safeGstRate}</strong>
                    </div>

                </div>
            </article>
        `;
    }

    function formatGstRate(rate) {
        const cleanRate = String(rate ?? "").trim();

        if (!cleanRate) {
            return "";
        }

        if (cleanRate.includes("%")) {
            return cleanRate;
        }

        if (/^\d+(\.\d+)?$/.test(cleanRate)) {
            return `${cleanRate}%`;
        }

        return cleanRate;
    }

    function renderResults() {
        const totalResults = currentResults.length;
        const visibleResults = currentResults.slice(0, visibleCount);

        if (totalResults === 0) {
            showNoResults();
            return;
        }

        emptyState.hidden = true;

        resultsGrid.innerHTML = visibleResults
            .map(createResultCard)
            .join("");

        resultsTitle.textContent =
            totalResults === 1
                ? "1 matching HSN record"
                : `${totalResults.toLocaleString()} matching HSN records`;

        resultCount.textContent =
            totalResults === 1
                ? "1 Result"
                : `${totalResults.toLocaleString()} Results`;

        showMoreButton.hidden = visibleCount >= totalResults;

        if (!showMoreButton.hidden) {
            const remaining = totalResults - visibleCount;
            showMoreButton.textContent =
                `Show More Results (${remaining.toLocaleString()} remaining)`;
        }
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
            <p>Try a shorter product name, another spelling or an HSN number.</p>
        `;
    }

    function resetSearchResults() {
        currentResults = [];
        visibleCount = INITIAL_LIMIT;
        resultsGrid.innerHTML = "";
        resultsTitle.textContent = "Start typing to search";
        resultCount.textContent = "0 Results";
        showMoreButton.hidden = true;
        restoreDefaultEmptyState();
    }

    function updateClearButton() {
        clearButton.classList.toggle(
            "visible",
            searchInput.value.trim().length > 0
        );
    }

    function runSearch(queryValue) {
        const query = queryValue.trim();

        updateClearButton();
        visibleCount = INITIAL_LIMIT;

        if (!query) {
            resetSearchResults();
            return;
        }

        currentResults = searchRecords(query);
        renderResults();
    }

    function scheduleSearch() {
        window.clearTimeout(debounceTimer);

        debounceTimer = window.setTimeout(() => {
            runSearch(searchInput.value);
        }, DEBOUNCE_DELAY);
    }

    function setSearchValue(value) {
        searchInput.value = value;
        searchInput.focus();
        runSearch(value);

        document
            .querySelector(".results-section")
            ?.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
    }

    searchInput.addEventListener("input", scheduleSearch);

    searchInput.addEventListener("search", () => {
        runSearch(searchInput.value);
    });

    searchInput.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            searchInput.value = "";
            updateClearButton();
            resetSearchResults();
        }
    });

    clearButton.addEventListener("click", () => {
        searchInput.value = "";
        updateClearButton();
        resetSearchResults();
        searchInput.focus();
    });

    popularButtons.forEach((button) => {
        button.addEventListener("click", () => {
            setSearchValue(button.dataset.search || "");
        });
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

        document.addEventListener("click", (event) => {
            const clickedInsideMenu = navMenu.contains(event.target);
            const clickedMenuButton = menuButton.contains(event.target);

            if (!clickedInsideMenu && !clickedMenuButton) {
                navMenu.classList.remove("open");
            }
        });
    }

    loadHsnData();
});
