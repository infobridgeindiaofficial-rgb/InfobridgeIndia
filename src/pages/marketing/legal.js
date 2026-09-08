import { legalDocument, legalDocumentHead } from "../../components/legal-document.js";

export function privacyPage() {
  const sections = [
    ["Information We Collect", "InfoBridgeIndia may collect information you provide when using our website, tools, account features or contact form, together with basic technical and usage information such as browser, device and website interactions."],
    ["How We Use Information", "We use this information to operate and improve InfoBridgeIndia, provide requested features, maintain security and respond to enquiries."],
    ["Cookies and Google AdSense", "InfoBridgeIndia uses Google AdSense to display advertising. Google and its partners may use cookies or similar technologies to serve and measure ads, including ads based on visits to this and other websites. Google Analytics may also be used to understand website usage.", "You can manage cookies through your browser settings and learn more about how Google uses information from sites that use its services at <a href=\"https://policies.google.com/technologies/partner-sites\">Google's partner sites policy</a>."],
    ["Third-Party Services", "We may use third-party services for hosting, authentication, analytics, advertising and contact forms. Those services may process information needed to provide their functions and may have their own privacy policies."],
    ["Contact", "For privacy questions or requests, please use our <a href=\"/contact.html\">Contact page</a>."],
  ];
  return { route: "/privacy.html", title: "Privacy Policy", description: "How InfoBridgeIndia handles information, cookies and advertising.", active: "", extraHead: legalDocumentHead, body: legalDocument({ title: "Privacy Policy", introduction: "This Privacy Policy explains how InfoBridgeIndia handles information when you use our website and services.", sections }) };
}

export function termsPage() {
  const sections = [
    ["Use of InfoBridgeIndia", "InfoBridgeIndia provides business software, calculators, tools and information. Use the website and services lawfully and responsibly."],
    ["User Responsibility", "You are responsible for the information you enter and for checking calculations, records and generated outputs before relying on them or submitting information to authorities or other parties."],
    ["Service Availability", "Features may be changed or updated as the platform develops. We do not guarantee uninterrupted or error-free availability."],
    ["Third-Party Services", "Some website features may use third-party services, including analytics and advertising services, which may have their own terms and privacy policies."],
    ["No Professional Advice", "InfoBridgeIndia tools and information do not replace professional accounting, tax, legal or compliance advice. Users should obtain qualified advice when required."],
    ["Contact", "For questions about these Terms, please use our <a href=\"/contact.html\">Contact page</a>."],
  ];
  return { route: "/terms.html", title: "Terms of Use", description: "Basic terms for using InfoBridgeIndia.", active: "", extraHead: legalDocumentHead, body: legalDocument({ title: "Terms of Use", introduction: "These basic terms apply when you use the InfoBridgeIndia website and services.", sections }) };
}
