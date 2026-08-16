/* =========================================================
   INFOBRIDGEINDIA — APPS / SOFTWARE (apps.html)
   Isolated script. Does not touch any GST tool logic.

   Handles:
   - "Explore" buttons for products without a dedicated page yet ->
     shows a small toast instead of navigating to a broken link.
   ========================================================= */

(() => {
  "use strict";

  function showToast(message) {
    let toast = document.querySelector(".apps-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "apps-toast";
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => {
      toast.classList.remove("show");
    }, 2600);
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".apps-card-cta[data-app]").forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        const appName = link.getAttribute("data-app-name") || "This app";
        showToast(`${appName} detail page is coming soon.`);
      });
    });
  });
})();
