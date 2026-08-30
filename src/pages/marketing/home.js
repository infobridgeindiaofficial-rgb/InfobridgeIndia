import { icon } from "../../components/icons.js";

function hero() {
  return `<section class="hero">
    <div class="hero-office" aria-hidden="true">
      <img src="/infobridgeindia-office-hero.png" alt="" />
    </div>
    <div class="container hero-inner">
      <div class="hero-copy">
        <span class="eyebrow">BUSINESS MANAGEMENT PLATFORM FOR INDIA</span>
        <h1 class="h-display">All-in-One Business Management Software for India</h1>
        <p class="text-lead">Manage accounting, GST, sales, purchases, inventory, banking, HR, e-commerce, import &amp; export and business operations from one connected platform.</p>
        <p class="text-lead hero-subline">Built for local businesses, online sellers, growing companies and enterprises across India.</p>
      </div>
    </div>
  </section>`;
}

const playGlyph = `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
const YOUTUBE_URL = "https://www.youtube.com/@infobridgeindia";

function appMark(iconName) {
  return `<span class="story-app-mark">${icon(iconName)}</span>`;
}

/* ---------- Section 1: short company intro ---------- */
function introSection() {
  return `<section class="story-block story-intro">
    <div class="container story-intro-inner">
      <span class="eyebrow">InfoBridgeIndia</span>
      <h2 class="h-2">Everything You Need to Manage Your Business</h2>
      <p class="story-taglist">Mobile Apps<span class="dot">&bull;</span>Business Software<span class="dot">&bull;</span>Websites<span class="dot">&bull;</span>Cloud Systems</p>
      <p class="text-lead">We create connected digital products designed for modern businesses.</p>
    </div>
  </section>`;
}

/* ---------- Section 2: mobile app story ---------- */
function mobileAppStory() {
  const apps = [
    { mark: "building", name: "IB Civil", desc: "Practical tools for civil and construction workflows." },
    { mark: "globe", name: "IB Lingo", desc: "A smarter way to learn and communicate." },
    { mark: "ecommerce", name: "IB Commerce", desc: "Digital tools for modern selling and business." },
  ];

  const phoneImages = [
    ["ib-civil-mobile.png", "IB Civil mobile app"],
    ["ib-lingo-mobile.png", "IB Lingo mobile app"],
    ["ib-commerce-mobile.png", "IB Commerce mobile app"],
  ];

  return `<section class="story-pin-wrap" id="phoneStory">
    <div class="story-pin">
      <div class="container story-pin-grid">
        <div class="story-pin-copy">
          <span class="eyebrow">Mobile</span>
          <h2 class="h-2">Apps built for every screen.</h2>
          <p class="text-lead">InfoBridgeIndia creates business applications for iPhone and Android.</p>
          <div class="story-app-list">
            ${apps
              .map(
                (a, i) => `<div class="story-app-item${i === 0 ? " is-active" : ""}" data-app-item="${i}">
              ${appMark(a.mark)}
              <div><strong>${a.name}</strong><p>${a.desc}</p></div>
            </div>`
              )
              .join("")}
          </div>
          <p class="story-note">More InfoBridgeIndia apps are preparing for launch.</p>
        </div>
        <div class="story-phone-stage">
          <div class="story-phone" data-story-phone>
            ${phoneImages
              .map(
                ([src, alt], i) =>
                  `<img class="story-device-img" data-phone-face="${i}" src="/app-showcase/${src}" width="700" height="1050" alt="${alt}" loading="lazy" decoding="async" />`
              )
              .join("")}
          </div>
          <div class="story-product-quick-info" data-civil-quick-info>
            <span>Quantity surveying made simple.</span>
            <span>Easy to use, even without prior experience.</span>
            <span>Create BOQs and generate complete or floor-wise reports.</span>
          </div>
          <div class="story-product-quick-info" data-lingo-quick-info>
            <span>Internet video and audio calls with live translation.</span>
            <span>Communicate easily, even when you don’t share the same language.</span>
          </div>
          <div class="story-product-quick-info" data-commerce-quick-info>
            <span>Manage your entire e-commerce business in one app.</span>
            <span>Track products, orders, accounts and budgets together.</span>
            <span>See your business performance clearly as you grow.</span>
          </div>
          <div class="story-tablet" data-story-tablet>
            <img class="story-device-img" src="/app-showcase/ib-commerce-tablet.png" width="1100" height="733" alt="IB Commerce tablet app" loading="lazy" decoding="async" />
          </div>
        </div>
      </div>
    </div>
  </section>`;
}

/* ---------- Section 3: laptop opening story ---------- */
function laptopStory() {
  return `<section class="story-pin-wrap" id="laptopStory">
    <div class="story-pin">
      <div class="container story-pin-grid">
        <div class="story-laptop-stage">
          <div class="story-laptop-glow" aria-hidden="true"></div>
          <div class="story-laptop-base"></div>
          <div class="story-laptop-photo" data-laptop-photo>
            <div class="story-laptop-screen">
              <img src="/app-showcase/infobridgeindia-dashboard-screen.png" width="1033" height="608" alt="" aria-hidden="true" loading="lazy" decoding="async" />
            </div>
            <img class="story-device-img story-laptop-frame" src="/app-showcase/infobridgeindia-laptop-frame.png" width="1300" height="867" alt="InfoBridgeIndia business dashboard open on a laptop" loading="lazy" decoding="async" />
          </div>
        </div>
        <div class="story-pin-copy">
          <span class="eyebrow">Platform</span>
          <h2 class="h-2">Your business, connected.</h2>
          <p class="text-lead">Finance, GST, Sales, Inventory, HR and operations &mdash; working together.</p>
          <p class="story-taglist">Web Platforms<span class="dot">&bull;</span>Desktop Software<span class="dot">&bull;</span>Cloud Systems</p>
          <p class="story-note">Built around the way your business works.</p>
        </div>
      </div>
    </div>
  </section>`;
}

/* ---------- Section 4: digital services strip ---------- */
function servicesSection() {
  const items = [
    ["layers", "Mobile Apps", "iPhone & Android"],
    ["dashboard", "Business Software", "Desktop & Cloud"],
    ["globe", "Web Design", "Company & E-commerce"],
    ["link", "Connected Systems", "Finance, CRM & Operations"],
  ];
  return `<section class="story-block story-services">
    <div class="container story-services-grid">
      ${items
        .map(
          ([i, title, sub]) => `<div class="story-service">
        <span class="story-service-icon">${icon(i)}</span>
        <strong>${title}</strong>
        <span>${sub}</span>
      </div>`
        )
        .join("")}
    </div>
  </section>`;
}

/* ---------- Section 5: YouTube strip ---------- */
function youtubeStrip() {
  return `<section class="story-block story-youtube">
    <div class="container story-youtube-inner">
      <a class="story-yt-poster" href="${YOUTUBE_URL}" target="_blank" rel="noopener" aria-label="Watch InfoBridgeIndia on YouTube">${playGlyph}</a>
      <div>
        <p class="story-yt-text">See InfoBridgeIndia in action</p>
        <a class="btn btn-on-dark" href="${YOUTUBE_URL}" target="_blank" rel="noopener">Watch on YouTube</a>
      </div>
    </div>
  </section>`;
}

export function homePage() {
  const body = `
  ${hero()}
  <div class="story">
    ${introSection()}
    ${mobileAppStory()}
    ${laptopStory()}
    ${servicesSection()}
    ${youtubeStrip()}
  </div>
  `;
  return {
    route: "/index.html",
    title: "Business Management Software India | InfoBridgeIndia",
    exactTitle: true,
    description: "All-in-one business management software for Indian businesses. Manage GST billing, accounting, CRM, inventory, sales, purchases, HR, payroll and projects with InfoBridgeIndia.",
    active: "",
    body,
    extraHead: '<link rel="stylesheet" href="/styles/home-story.css" />',
    extraScripts: '<script type="module" src="/scripts/home-story.js"></script>',
  };
}
