import { legalDocument, legalDocumentHead } from "../../components/legal-document.js";

export function securityPage() {
  const sections = [
    ["Protecting Your Information", "InfoBridgeIndia uses reasonable technical and organisational measures to help protect user and business information. No internet-based service can guarantee absolute security."],
    ["Account Security", "Account access requires sign-in where applicable. Business workspace access is separated between user accounts where applicable. Users are responsible for keeping their account information and login credentials secure."],
    ["Business Data", "Information entered into business workspaces is handled to provide the requested platform functionality. Only submit information needed for your work, and take care when sharing business records with others."],
    ["File Processing", "File handling depends on the tool you use. JPG to PDF processes selected images in your browser and provides the generated PDF for download to your device. This does not mean that every InfoBridgeIndia feature processes information only on your device."],
    ["Third-Party Services", "InfoBridgeIndia may use trusted external services for hosting, authentication, analytics, advertising, contact forms, storage and other platform functions. Our <a href=\"/privacy.html\">Privacy Policy</a> explains how information may be used by these services."],
    ["Security Responsibilities", "Keep login credentials and devices secure, use an updated browser and sign out after using shared devices. Review important business, tax and accounting information before submission. Contact us if you believe your account or data may have been compromised."],
    ["Reporting a Security Issue", "If you believe you have found a security or privacy issue, please use our <a href=\"/contact.html\">Contact page</a> so we can review it. Describe the issue without including passwords or unnecessary sensitive information."],
  ];
  return { route: "/security.html", title: "Security", description: "How InfoBridgeIndia currently handles data protection, file privacy, account security and Indian data-protection considerations.", active: "resources", extraHead: legalDocumentHead, body: legalDocument({ title: "Security", introduction: "This page explains how InfoBridgeIndia helps protect information and the steps users can take when using our website, tools and business platform.", sections }) };
}
