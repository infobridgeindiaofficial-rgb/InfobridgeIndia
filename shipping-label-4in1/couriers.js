export const UNKNOWN_COURIER = "Unknown Courier";
export const COURIER_ORDER = ["XpressBees", "Valmo", "Shadowfax", "Delhivery", "Ekart", "Ecom Express", UNKNOWN_COURIER];

export function identifyCourier(text, awb = "") {
  const shippingText = String(text || "").normalize("NFKC").split(/Product\s+Details|Tax\s+Invoice|BILL\s+OF\s+SUPPLY|Quantity\s+Product/i)[0];
  const names = [
    ["Valmo", /\bvalmo\b/i],
    ["XpressBees", /\bxpress[\s-]*bees\b/i],
    ["Shadowfax", /\bshadow[\s-]*fax\b/i],
    ["Delhivery", /\bdelhivery\b/i],
    ["Ecom Express", /\becom[\s-]*express\b/i],
    ["Ekart", /\be[\s-]*kart(?:\s+logistics)?\b/i],
  ].filter(([, pattern]) => pattern.test(shippingText)).map(([name]) => name);
  if (names.length === 1) return { courier: names[0], courierSource: "printed" };
  if (names.length > 1) return { courier: UNKNOWN_COURIER, courierSource: "conflicting" };
  const tracking = String(awb).toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (/^VL\d{13}$/.test(tracking)) return { courier: "Valmo", courierSource: "prefix" };
  if (/^(?:FMPC|FMPP)\d{10}$/.test(tracking)) return { courier: "Ekart", courierSource: "prefix" };
  return { courier: UNKNOWN_COURIER, courierSource: "unknown" };
}

export function compareCouriers(first, second) {
  if (first === second) return 0;
  const firstRank = COURIER_ORDER.indexOf(first);
  const secondRank = COURIER_ORDER.indexOf(second);
  if (firstRank !== secondRank) return (firstRank < 0 ? COURIER_ORDER.length : firstRank) - (secondRank < 0 ? COURIER_ORDER.length : secondRank);
  return first.localeCompare(second, "en");
}

export function courierCounts(labels) {
  const counts = new Map();
  for (const label of labels) {
    const name = label.courier || UNKNOWN_COURIER;
    counts.set(name, (counts.get(name) || 0) + 1);
  }
  return [...counts].sort(([first], [second]) => compareCouriers(first, second));
}
