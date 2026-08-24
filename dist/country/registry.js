import indiaCountryConfig from "./in.js";
import uaeCountryConfig from "./ae.js";

export const countryRegistry = Object.freeze({ IN: indiaCountryConfig, AE: uaeCountryConfig });

export function resolveCountryConfig(country) {
  const value = String(country || "").trim().toUpperCase();
  if (value === "AE" || value === "UAE" || value === "UNITED ARAB EMIRATES") return countryRegistry.AE;
  return countryRegistry.IN;
}

export default resolveCountryConfig;
