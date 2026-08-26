import { UAE_BUSINESS_TYPES, UAE_EMIRATES, freezeCountryConfig, trnValid } from "./shared.js";

export const uaeCountryConfig = freezeCountryConfig({
  country: "AE",
  countryName: "United Arab Emirates (UAE)",
  currency: "AED",
  businessTypes: UAE_BUSINESS_TYPES,
  jurisdictions: UAE_EMIRATES,
  jurisdictionLabel: "Emirate",
  jurisdictionCodeLabel: "Emirate code",
  postalCodeLabel: "Postal code",
  tax: {
    system: "VAT",
    strategy: "uae-vat",
    statusLabel: "VAT status",
    identifier: "TRN",
    identifierField: "trn",
    rateLabel: "Default VAT rate",
    settingsLabel: "VAT & Tax Settings",
    workspaceLabel: "VAT settings",
    validateIdentifier: trnValid,
    labels: { total: "VAT", valueAdded: "VAT" },
    capabilities: {
      components: ["VAT"],
      intraRegionSplit: false,
      interRegionIntegrated: false,
      requiresRegionComparison: false,
    },
  },
  registration: {
    showPan: false,
    numberLabel: "Trade Licence Number",
    numberField: "tradeLicenseNumber",
    expiryLabel: "Trade Licence Expiry Date",
    expiryField: "tradeLicenseExpiryDate",
    tradeLicence: true,
  },
  defaults: { locale: "en-AE", timezone: "Asia/Dubai", financialYearStart: "01-01", rounding: "Two decimals" },
});

export default uaeCountryConfig;
