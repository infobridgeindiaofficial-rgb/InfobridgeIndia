import { resolveCountryConfig } from "../country/registry.js";
export function projectCurrencyNumberFormat(company){const c=resolveCountryConfig(company);return c.country==="AE"?'[$AED] #,##0.00;[Red]-[$AED] #,##0.00':'[$₹-en-IN]#,##0.00;[Red]-[$₹-en-IN]#,##0.00'}
