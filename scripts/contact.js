import { CONTACT_FORM_ENDPOINT } from "./contact-config.js";

export function initContactForm(form, endpoint = CONTACT_FORM_ENDPOINT, fetcher = globalThis.fetch) {
  const button = form.querySelector('button[type="submit"]');
  const status = form.querySelector('[role="status"]');
  let sending = false;
  const configured = /^https:\/\/formspree\.io\/f\/[a-zA-Z0-9]+$/.test(endpoint);
  button.disabled = !configured;
  if (!configured) status.textContent = "The contact form is currently unavailable. Please contact us on WhatsApp below.";
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!configured || sending || !form.reportValidity()) return;
    const fields = Object.fromEntries(["name", "email", "message"].map((name) => [name, form.elements.namedItem(name).value.trim()]));
    if (Object.values(fields).some((value) => !value)) {
      status.textContent = "Please complete all three fields.";
      return;
    }
    sending = true;
    button.disabled = true;
    button.textContent = "Sending...";
    form.setAttribute("aria-busy", "true");
    status.textContent = "Sending your message...";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetcher(endpoint, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(fields),
        signal: controller.signal,
        credentials: "omit",
        redirect: "error",
      });
      if (!response.ok) throw new Error("Submission rejected");
      form.reset();
      status.textContent = "Thank you. Your message has been sent.";
    } catch {
      status.textContent = "We could not confirm that your message was sent. Your message is still here. Please try again or contact us on WhatsApp below.";
    } finally {
      clearTimeout(timeout);
      sending = false;
      button.disabled = false;
      button.textContent = "Send Message";
      form.setAttribute("aria-busy", "false");
    }
  });
}

const form = globalThis.document?.getElementById("contact-form");
if (form) initContactForm(form);
