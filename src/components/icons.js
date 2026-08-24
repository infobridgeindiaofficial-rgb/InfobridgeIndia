// Minimal, original line-icon set (24x24, stroke-based, currentColor).
// Kept deliberately simple/geometric so the visual language stays consistent
// across the whole product without depending on any external icon library.

const svg = (inner, vb = 24) =>
  `<svg viewBox="0 0 ${vb} ${vb}" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;

const paths = {
  dashboard: '<rect x="3.5" y="3.5" width="7" height="9" rx="1.4"/><rect x="13.5" y="3.5" width="7" height="5.5" rx="1.4"/><rect x="13.5" y="11.5" width="7" height="9" rx="1.4"/><rect x="3.5" y="15" width="7" height="5.5" rx="1.4"/>',
  finance: '<path d="M4 20V10M10 20V4M16 20V13M22 20H2"/><circle cx="10" cy="4" r="0" stroke-opacity="0"/>',
  ledger: '<rect x="4" y="3" width="16" height="18" rx="1.6"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  sales: '<path d="M3 12l4-5 4 3 4-6 6 8"/><path d="M17 6h4v4"/>',
  crm: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16.5 5a3.2 3.2 0 010 6.2M21 20c0-2.8-2-5-4.7-5.8"/>',
  purchase: '<path d="M3 4h2l1.6 11.2A2 2 0 008.6 17H18a2 2 0 002-1.6l1.3-6.8H6"/><circle cx="9" cy="20.5" r="1.3"/><circle cx="17" cy="20.5" r="1.3"/>',
  inventory: '<path d="M3.5 7.5L12 3l8.5 4.5L12 12 3.5 7.5z"/><path d="M3.5 7.5V16.5L12 21l8.5-4.5V7.5"/><path d="M12 12v9"/>',
  warehouse: '<path d="M3 21V9l9-6 9 6v12"/><path d="M3 21h18"/><path d="M9 21v-7h6v7"/>',
  ecommerce: '<circle cx="8" cy="20.5" r="1.3"/><circle cx="17" cy="20.5" r="1.3"/><path d="M2.5 3h2.4L7 15.2h11l2-8.4H6.2"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.4 2.4 3.6 5.4 3.6 8.5s-1.2 6.1-3.6 8.5c-2.4-2.4-3.6-5.4-3.6-8.5s1.2-6.1 3.6-8.5z"/>',
  importexport: '<path d="M4 7h9M13 7l-3-3M13 7l-3 3"/><path d="M20 17H11M11 17l3-3M11 17l3 3"/>',
  bank: '<path d="M3 10.5L12 5l9 5.5"/><path d="M4.5 10.5v8.5M9 10.5v8.5M15 10.5v8.5M19.5 10.5v8.5"/><path d="M3 19.5h18"/>',
  gst: '<path d="M12 3l7.5 3v6c0 5-3.2 7.8-7.5 9-4.3-1.2-7.5-4-7.5-9V6L12 3z"/><path d="M9 12.2l2 2 4-4.2"/>',
  hr: '<circle cx="9" cy="7" r="3.2"/><path d="M2.8 20c0-3.3 2.8-6 6.2-6s6.2 2.7 6.2 6"/><rect x="15.5" y="3.5" width="6" height="6" rx="1.2"/><path d="M16.8 6.5h3.4"/>',
  payroll: '<rect x="3" y="5" width="18" height="14" rx="1.8"/><path d="M3 10h18"/><circle cx="8" cy="14.5" r="1.6"/><path d="M13 14.5h5"/>',
  projects: '<rect x="3.5" y="4.5" width="17" height="15" rx="1.6"/><path d="M3.5 9.5h17"/><path d="M8 4.5v-1M16 4.5v-1"/><path d="M7 13.2l2.2 2.2L13.5 11"/>',
  documents: '<path d="M7 3.5h7l4 4V20a1 1 0 01-1 1H7a1 1 0 01-1-1V4.5a1 1 0 011-1z"/><path d="M14 3.5V8h4"/><path d="M9 12.5h6M9 16h6"/>',
  reports: '<path d="M4 20V4"/><path d="M4 20h16"/><rect x="7" y="13" width="2.6" height="7"/><rect x="12" y="9" width="2.6" height="11"/><rect x="17" y="6" width="2.6" height="14"/>',
  approvals: '<circle cx="12" cy="12" r="8.5"/><path d="M8.2 12.3l2.4 2.4 5.2-5.4"/>',
  admin: '<circle cx="12" cy="12" r="2.6"/><path d="M12 3.5v2.3M12 18.2v2.3M20.5 12h-2.3M5.8 12H3.5M18 6l-1.6 1.6M6 18l1.6-1.6M18 18l-1.6-1.6M6 6l1.6 1.6"/>',
  settings: '<path d="M4 7h11M18.5 7h1.5M4 12h1.5M9 12h11M4 17h11M18.5 17h1.5"/><circle cx="8" cy="7" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="8" cy="17" r="2"/>',
  branches: '<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="12" r="2"/><path d="M6 7v10M6 12h8.2M14.2 12l-2.4-2.4M14.2 12l-2.4 2.4"/>',
  chevronDown: '<path d="M6 9l6 6 6-6"/>',
  chevronRight: '<path d="M9 6l6 6-6 6"/>',
  arrowRight: '<path d="M4 12h16M14 6l6 6-6 6"/>',
  arrowUpRight: '<path d="M6 18L18 6M9 6h9v9"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M20 20l-4.6-4.6"/>',
  check: '<path d="M4 12.5l5 5L20 6.5"/>',
  checkCircle: '<circle cx="12" cy="12" r="8.5"/><path d="M8 12.3l2.6 2.6L16.5 9"/>',
  plus: '<path d="M12 4v16M4 12h16"/>',
  filter: '<path d="M4 5h16M7 12h10M10 19h4"/>',
  download: '<path d="M12 3v12M7 11l5 5 5-5"/><path d="M4 20h16"/>',
  upload: '<path d="M12 21V9M7 13l5-5 5 5"/><path d="M4 4h16"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="1.6"/><path d="M3.5 9.5h17"/><path d="M8 3v3.5M16 3v3.5"/>',
  users: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 5.2a3 3 0 010 5.9M20.5 19c0-2.6-1.8-4.7-4.3-5.6"/>',
  building: '<rect x="5" y="3" width="14" height="18" rx="1"/><path d="M9 7h1.5M13.5 7H15M9 11h1.5M13.5 11H15M9 15h1.5M13.5 15H15"/><path d="M10 21v-3.5h4V21"/>',
  shield: '<path d="M12 3.5l7 2.7v5.6c0 5-3 7.7-7 8.7-4-1-7-3.7-7-8.7V6.2L12 3.5z"/>',
  link: '<path d="M9.5 14.5l5-5"/><path d="M12.5 6.5l1.4-1.4a3.5 3.5 0 015 5L17.5 11.5M11.5 17.5l-1.4 1.4a3.5 3.5 0 01-5-5L6.5 12.5"/>',
  alertTriangle: '<path d="M12 4l9 15.5H3L12 4z"/><path d="M12 10v4"/><circle cx="12" cy="17" r="0.4" fill="currentColor"/>',
  alertCircle: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5"/><circle cx="12" cy="16" r="0.4" fill="currentColor"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5"/><circle cx="12" cy="8" r="0.4" fill="currentColor"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3.2 2"/>',
  file: '<path d="M7 3.5h7l4 4V20a1 1 0 01-1 1H7a1 1 0 01-1-1V4.5a1 1 0 011-1z"/><path d="M14 3.5V8h4"/>',
  trendingUp: '<path d="M4 16l5.5-6 4 3.5L20 6"/><path d="M14.5 6H20v5.5"/>',
  trendingDown: '<path d="M4 8l5.5 6 4-3.5L20 18"/><path d="M14.5 18H20v-5.5"/>',
  star: '<path d="M12 3.5l2.5 5.4 5.8.6-4.4 4 1.2 5.9L12 16.6 6.9 19.4l1.2-5.9-4.4-4 5.8-.6L12 3.5z"/>',
  truck: '<path d="M3 6.5h11v9H3z"/><path d="M14 10h4l3 3v2.5h-7z"/><circle cx="7" cy="18" r="1.6"/><circle cx="18" cy="18" r="1.6"/>',
  package: '<path d="M3.5 7.5L12 3l8.5 4.5L12 12 3.5 7.5z"/><path d="M3.5 7.5V16.5L12 21l8.5-4.5V7.5"/>',
  creditCard: '<rect x="3" y="5.5" width="18" height="13" rx="1.8"/><path d="M3 10h18"/><path d="M7 14.5h4"/>',
  briefcase: '<rect x="3" y="7.5" width="18" height="12" rx="1.6"/><path d="M8 7.5V6a2 2 0 012-2h4a2 2 0 012 2v1.5"/><path d="M3 13h18"/>',
  layers: '<path d="M12 3.5l8 4.2-8 4.2-8-4.2 8-4.2z"/><path d="M4 12l8 4.2 8-4.2M4 15.8L12 20l8-4.2"/>',
  grid: '<rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.2"/><rect x="13" y="3.5" width="7.5" height="7.5" rx="1.2"/><rect x="3.5" y="13" width="7.5" height="7.5" rx="1.2"/><rect x="13" y="13" width="7.5" height="7.5" rx="1.2"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="0.9" fill="currentColor"/><circle cx="3.5" cy="12" r="0.9" fill="currentColor"/><circle cx="3.5" cy="18" r="0.9" fill="currentColor"/>',
  moreHorizontal: '<circle cx="5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="19" cy="12" r="1.3" fill="currentColor"/>',
  menu: '<path d="M4 6.5h16M4 12h16M4 17.5h16"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  bell: '<path d="M6 10.5a6 6 0 1112 0c0 3 1 4.7 2 5.8H4c1-1.1 2-2.8 2-5.8z"/><path d="M9.5 19a2.5 2.5 0 005 0"/>',
  logout: '<path d="M9 4H5.5A1.5 1.5 0 004 5.5v13A1.5 1.5 0 005.5 20H9"/><path d="M14 16l4-4-4-4"/><path d="M18 12H8"/>',
  bolt: '<path d="M13 3L5 13.5h5.5L10 21l8-10.5h-5.5L13 3z"/>',
  scale: '<path d="M12 3v3M12 6l-5.5 11h11L12 6z"/><path d="M4 21h16"/><circle cx="6.5" cy="14" r="0" /><path d="M12 6L6.5 17M12 6l5.5 11"/>',
  wallet: '<path d="M3 8.5A2 2 0 015 6.5h13A2 2 0 0120 8.5V17a2 2 0 01-2 2H5a2 2 0 01-2-2V8.5z"/><path d="M3 10h17"/><path d="M15.5 14.3h2"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="0.9" fill="currentColor"/>',
  folder: '<path d="M3.5 6.5a1 1 0 011-1h5l2 2.3h8a1 1 0 011 1V18a1 1 0 01-1 1h-15a1 1 0 01-1-1V6.5z"/>',
  workflow: '<circle cx="5" cy="6" r="2.3"/><circle cx="19" cy="6" r="2.3"/><circle cx="12" cy="18" r="2.3"/><path d="M5 8.3v3a3 3 0 003 3h2M19 8.3v3a3 3 0 01-3 3h-2"/>',
};

export function icon(name, cls = "") {
  const body = paths[name];
  if (!body) return "";
  const svgStr = svg(body);
  if (!cls) return svgStr;
  return svgStr.replace("<svg ", `<svg class="${cls}" `);
}
