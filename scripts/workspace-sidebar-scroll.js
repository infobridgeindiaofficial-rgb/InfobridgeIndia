export const SIDEBAR_SCROLL_STORAGE_PREFIX = "infobridgeindia.sidebar.scroll.";

const safeNumber = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;

export function visibleSidebarScrollTop(scrollTop, viewportHeight, itemTop, itemHeight) {
  const current = safeNumber(scrollTop);
  const height = safeNumber(viewportHeight);
  if (!height) return current;
  const top = safeNumber(itemTop);
  const bottom = top + safeNumber(itemHeight);
  if (top < current) return top;
  if (bottom > current + height) return Math.max(0, bottom - height);
  return current;
}

export function sidebarScrollStorageKey(moduleName) {
  return `${SIDEBAR_SCROLL_STORAGE_PREFIX}${encodeURIComponent(String(moduleName || "Workspace"))}`;
}
