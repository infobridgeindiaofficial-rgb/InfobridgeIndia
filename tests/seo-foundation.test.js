import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { financeAccountingDetailPages } from "../src/pages/marketing/finance-accounting.js";
import { renderHead } from "../src/components/layout.js";
import { seoForRoute } from "../src/data/seo.js";

test("primary product landing pages have complete SEO metadata", () => {
  for (const route of [
    "/index.html",
    "/products/finance-accounting.html",
    "/products/inventory-warehouse.html",
    "/products/sales-crm.html",
    "/products/purchases-procurement.html",
    "/products/projects-operations.html",
    "/products/reports-analytics.html",
  ]) {
    const seo = seoForRoute(route);
    assert.ok(seo, `${route} must have SEO metadata`);
    assert.match(seo.canonical, /^https:\/\/infobridgeindia\.online\//);
    assert.ok(seo.title.length <= 65, `${route} title is too long`);
    assert.ok(seo.description.length >= 100 && seo.description.length <= 180, `${route} description length is invalid`);
  }
});

test("unfinished finance detail routes remain out of search results", () => {
  const pages = financeAccountingDetailPages();
  assert.ok(pages.length > 50);
  for (const page of pages) assert.match(page.extraHead, /noindex, follow/);
});

test("private company routes emit noindex directives", () => {
  assert.match(renderHead({ title: "Company", route: "/company-profile.html" }), /noindex, nofollow/);
});

test("sitemap includes real product pages and excludes private workspaces", () => {
  const sitemap = readFileSync(new URL("../public/sitemap.xml", import.meta.url), "utf8");
  assert.match(sitemap, /products\/finance-accounting\.html/);
  assert.match(sitemap, /products\/inventory-warehouse\.html/);
  assert.doesNotMatch(sitemap, /\/app\//);
  assert.doesNotMatch(sitemap, /finance-accounting\/chart-of-accounts/);
});
