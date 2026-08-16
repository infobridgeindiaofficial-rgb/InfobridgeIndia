/* =========================================================
   INFOBRIDGEINDIA — "Get Pricing" enquiry modal (apps.html hero)
   Scope: isolated to the pricing card + modal only.
   Does not touch the apps gallery, homepage, or GST tools.

   Email delivery: Web3Forms (https://web3forms.com)
   - Static-site friendly form relay: the browser POSTs directly to
     Web3Forms, which forwards the enquiry to the InfoBridgeIndia
     Gmail inbox server-side. No Gmail password / SMTP secret is
     ever present in this file or anywhere in the frontend.
   - WEB3FORMS_ACCESS_KEY below is a placeholder. It must be
     replaced with the real access key before this form can
     actually deliver email — see the note next to the constant.
   ========================================================= */

(() => {
  "use strict";

  // ---- Web3Forms configuration -----------------------------------------
  // Get a free access key at https://web3forms.com by entering
  // infobridgeindia.official@gmail.com — the key arrives by email in
  // seconds. Paste it below in place of the placeholder. Until a real
  // key is set, Web3Forms will reject submissions (this file will show
  // the genuine error state below — it will NOT report a fake success).
  const WEB3FORMS_ACCESS_KEY = "38a83234-c8f5-459e-a4bd-36fba4200e82";
  const WEB3FORMS_ENDPOINT = "https://api.web3forms.com/submit";
  const RECEIVING_EMAIL = "infobridgeindia.official@gmail.com";
  const PAGE_SOURCE = "InfoBridgeIndia Apps Pricing";

  const openBtn = document.getElementById("openPricingModal");
  const modal = document.getElementById("pricingModal");
  const form = document.getElementById("pricingForm");
  const submitBtn = document.getElementById("pricingSubmitBtn");
  const statusBox = document.getElementById("pricingFormStatus");

  if (!openBtn || !modal || !form || !submitBtn || !statusBox) return;

  const fields = {
    firstName: document.getElementById("pfFirstName"),
    lastName: document.getElementById("pfLastName"),
    email: document.getElementById("pfEmail"),
    phone: document.getElementById("pfPhone"),
    product: document.getElementById("pfProduct"),
    message: document.getElementById("pfMessage"),
    website: document.getElementById("pfWebsite"), // honeypot
  };

  let lastFocusedEl = null;
  let submitting = false;
  let cooldownUntil = 0;

  // ---- Modal open / close ------------------------------------------------
  function openModal() {
    lastFocusedEl = document.activeElement;
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    window.setTimeout(() => fields.firstName && fields.firstName.focus(), 30);
    document.addEventListener("keydown", onKeydown);
  }

  function closeModal() {
    modal.hidden = true;
    document.body.style.overflow = "";
    document.removeEventListener("keydown", onKeydown);
    if (lastFocusedEl && typeof lastFocusedEl.focus === "function") {
      lastFocusedEl.focus();
    }
  }

  function onKeydown(e) {
    if (e.key === "Escape") closeModal();
  }

  openBtn.addEventListener("click", openModal);

  modal.querySelectorAll("[data-modal-close]").forEach((el) => {
    el.addEventListener("click", closeModal);
  });

  // ---- Additional entry points (e.g. the IB Civil showcase's secondary
  // CTA) that open this same modal and optionally preselect a product.
  // Purely additive — does not change openModal/closeModal/validate/submit.
  document.querySelectorAll("[data-preselect-product]").forEach((btn) => {
    if (btn === openBtn) return;
    btn.addEventListener("click", () => {
      openModal();
      const preset = btn.getAttribute("data-preselect-product");
      if (preset && fields.product) {
        fields.product.value = preset;
      }
    });
  });

  // ---- Validation ----------------------------------------------------------
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  // Accepts international numbers: optional leading +, country code,
  // spaces/hyphens/parentheses allowed, 7-15 digits overall (E.164-ish).
  const PHONE_RE = /^\+?[0-9][0-9\s\-()]{6,17}$/;

  function setFieldError(fieldId, message) {
    const errorEl = form.querySelector(`[data-error-for="${fieldId}"]`);
    const wrapper = errorEl ? errorEl.closest(".apps-pricing-field") : null;
    if (errorEl) errorEl.textContent = message || "";
    if (wrapper) wrapper.classList.toggle("has-error", Boolean(message));
  }

  function clearAllErrors() {
    ["pfFirstName", "pfLastName", "pfEmail", "pfPhone", "pfProduct"].forEach((id) =>
      setFieldError(id, "")
    );
  }

  function validate() {
    clearAllErrors();
    let firstInvalid = null;
    let valid = true;

    const firstName = fields.firstName.value.trim();
    if (!firstName) {
      setFieldError("pfFirstName", "First name is required.");
      valid = false;
      firstInvalid = firstInvalid || fields.firstName;
    }

    const lastName = fields.lastName.value.trim();
    if (!lastName) {
      setFieldError("pfLastName", "Last name is required.");
      valid = false;
      firstInvalid = firstInvalid || fields.lastName;
    }

    const email = fields.email.value.trim();
    if (!email) {
      setFieldError("pfEmail", "Email address is required.");
      valid = false;
      firstInvalid = firstInvalid || fields.email;
    } else if (!EMAIL_RE.test(email)) {
      setFieldError("pfEmail", "Enter a valid email address.");
      valid = false;
      firstInvalid = firstInvalid || fields.email;
    }

    const phone = fields.phone.value.trim();
    if (!phone) {
      setFieldError("pfPhone", "WhatsApp / mobile number is required.");
      valid = false;
      firstInvalid = firstInvalid || fields.phone;
    } else if (!PHONE_RE.test(phone)) {
      setFieldError("pfPhone", "Enter a valid number, e.g. +91 98765 43210.");
      valid = false;
      firstInvalid = firstInvalid || fields.phone;
    }

    const product = fields.product.value.trim();
    if (!product) {
      setFieldError("pfProduct", "Please select a product.");
      valid = false;
      firstInvalid = firstInvalid || fields.product;
    }

    if (firstInvalid) firstInvalid.focus();
    return valid;
  }

  // ---- Status messaging ------------------------------------------------
  function showStatus(kind, message) {
    statusBox.textContent = message;
    statusBox.classList.remove("is-success", "is-error");
    if (kind) statusBox.classList.add(kind === "success" ? "is-success" : "is-error");
  }

  function clearStatus() {
    statusBox.textContent = "";
    statusBox.classList.remove("is-success", "is-error");
  }

  // ---- Submit ------------------------------------------------------------
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (submitting) return;

    // Honeypot: real visitors never fill this hidden field. If it has a
    // value, silently drop the submission (classic bot trap) instead of
    // sending it on — this does not affect real users.
    if (fields.website && fields.website.value.trim() !== "") {
      return;
    }

    // Submission cooldown to avoid accidental duplicate sends.
    const now = Date.now();
    if (now < cooldownUntil) {
      showStatus("error", "Please wait a few seconds before sending another request.");
      return;
    }

    if (!validate()) {
      clearStatus();
      return;
    }

    const firstName = fields.firstName.value.trim();
    const lastName = fields.lastName.value.trim();
    const product = fields.product.value.trim();

    submitting = true;
    submitBtn.disabled = true;
    submitBtn.querySelector(".apps-pricing-submit-text").textContent = "Sending...";
    clearStatus();

    const payload = new FormData();
    payload.set("access_key", WEB3FORMS_ACCESS_KEY);
    payload.set("subject", `New IB Software Pricing Enquiry — ${product} — ${firstName} ${lastName}`);
    payload.set("from_name", "InfoBridgeIndia Apps Pricing");
    payload.set("name", `${firstName} ${lastName}`);
    payload.set("first_name", firstName);
    payload.set("last_name", lastName);
    payload.set("email", fields.email.value.trim());
    payload.set("phone", fields.phone.value.trim());
    payload.set("interested_software", product);
    payload.set("message", fields.message.value.trim() || "(no message provided)");
    payload.set("page_source", PAGE_SOURCE);
    payload.set(
      "enquiry_datetime",
      new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour12: true }) + " IST"
    );
    payload.set("receiving_email", RECEIVING_EMAIL);

    try {
      const response = await fetch(WEB3FORMS_ENDPOINT, {
        method: "POST",
        headers: { Accept: "application/json" },
        body: payload,
      });

      const result = await response.json().catch(() => null);

      if (response.ok && result && result.success) {
        // Success: keep the button disabled through the confirmation window,
        // then close/reset/restore together — never before submission is
        // actually confirmed by Web3Forms.
        showStatus("success", "Thank you! Your pricing request has been received.");
        cooldownUntil = Date.now() + 30000; // 30s cooldown after a real send

        window.setTimeout(() => {
          closeModal();
          form.reset();
          clearAllErrors();
          clearStatus();
          submitting = false;
          submitBtn.disabled = false;
          submitBtn.querySelector(".apps-pricing-submit-text").textContent = "Request Pricing →";
        }, 1800);
      } else {
        // Failure: do NOT close the modal, do NOT reset the form, do NOT
        // pretend success. Re-enable immediately so the visitor can retry.
        const reason = result && result.message ? ` (${result.message})` : "";
        showStatus(
          "error",
          `We couldn't send your request${reason}. Please try again or email us directly at ${RECEIVING_EMAIL}.`
        );
        submitting = false;
        submitBtn.disabled = false;
        submitBtn.querySelector(".apps-pricing-submit-text").textContent = "Request Pricing →";
      }
    } catch (err) {
      showStatus(
        "error",
        `We couldn't send your request due to a connection issue. Please try again or email us directly at ${RECEIVING_EMAIL}.`
      );
      submitting = false;
      submitBtn.disabled = false;
      submitBtn.querySelector(".apps-pricing-submit-text").textContent = "Request Pricing →";
    }
  });
})();
