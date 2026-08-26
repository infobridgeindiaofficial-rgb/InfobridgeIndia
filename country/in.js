import { INDIA_BUSINESS_TYPES, INDIA_STATES, freezeCountryConfig, gstinValid } from "./shared.js";

// These values intentionally mirror the existing Administration behaviour.
export const indiaCountryConfig = freezeCountryConfig({
  country: "IN",
  countryName: "India",
  currency: "INR",
  businessTypes: INDIA_BUSINESS_TYPES,
  jurisdictions: INDIA_STATES,
  jurisdictionLabel: "State",
  jurisdictionCodeLabel: "State code",
  postalCodeLabel: "PIN code",
  tax: {
    system: "GST",
    strategy: "india-gst",
    statusLabel: "GST status",
    identifier: "GSTIN",
    identifierField: "gstin",
    rateLabel: "Default GST rate",
    settingsLabel: "GST & Tax Settings",
    workspaceLabel: "GST Workspace",
    validateIdentifier: gstinValid,
    labels: { total: "GST", central: "CGST", state: "SGST", integrated: "IGST" },
    capabilities: {
      components: ["CGST", "SGST", "IGST"],
      intraRegionSplit: true,
      interRegionIntegrated: true,
      requiresRegionComparison: true,
    },
  },
  registration: {
    showPan: true,
    numberLabel: "CIN / registration number",
    numberField: "registrationNumber",
    tradeLicence: false,
  },
  defaults: { locale: "en-IN", timezone: "Asia/Kolkata", financialYearStart: "04-01", rounding: "Nearest rupee" },
});

export default indiaCountryConfig;
