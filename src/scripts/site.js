// InfoBridgeIndia â€” shared client-side behaviour. No framework, no dependencies.
(function () {
  "use strict";

  // Add the HSN/SAC finder to older pre-rendered headers too. Future builds
  // already receive it from nav.js; the href guard prevents duplicates.
  if (!document.querySelector('.mega-link[href="/hsn-sac-code-finder.html"]')) {
    var toolsNav = Array.from(document.querySelectorAll("[data-nav-item]")).find(function (item) {
      var navLink = item.querySelector('.nav-link[href="/gst-calculator.html"]');
      return Boolean(navLink);
    });
    var toolsColumn = toolsNav && toolsNav.querySelector(".mega-grid > div");
    var firstTool = toolsColumn && toolsColumn.querySelector(".mega-link");
    if (toolsColumn && firstTool) {
      var finderLink = firstTool.cloneNode(true);
      finderLink.href = "/hsn-sac-code-finder.html";
      finderLink.querySelector(".mega-link-title").textContent = "HSN & SAC Code Finder";
      finderLink.querySelector(".mega-link-desc").textContent = "Find codes and GST rates by product or service name";
      firstTool.parentNode.insertBefore(finderLink, firstTool);
    }
  }

  if (!document.querySelector('.mobile-nav a[href="/hsn-sac-code-finder.html"]')) {
    Array.from(document.querySelectorAll(".mobile-group")).some(function (group) {
      var title = group.querySelector(".mobile-group-title");
      if (!title || title.textContent.trim() !== "Business Tools") return false;
      var link = document.createElement("a");
      link.href = "/hsn-sac-code-finder.html";
      link.textContent = "HSN & SAC Code Finder";
      title.insertAdjacentElement("afterend", link);
      return true;
    });
  }

  // ---- Header mega menus ----
  var navItems = document.querySelectorAll("[data-nav-item].has-mega");
  navItems.forEach(function (item) {
    var closeTimer;
    function open() {
      clearTimeout(closeTimer);
      navItems.forEach(function (i) { if (i !== item) i.classList.remove("open"); });
      item.classList.add("open");
    }
    function scheduleClose() {
      closeTimer = setTimeout(function () { item.classList.remove("open"); }, 150);
    }
    item.addEventListener("mouseenter", open);
    item.addEventListener("mouseleave", scheduleClose);
    var link = item.querySelector(".nav-link");
    if (link) {
      link.addEventListener("click", function (e) {
        if (window.innerWidth <= 980) return;
        if (item.classList.contains("open")) return; // allow navigation on 2nd click
        e.preventDefault();
        open();
      });
    }
  });
  document.addEventListener("click", function (e) {
    if (!e.target.closest("[data-nav-item]")) {
      navItems.forEach(function (i) { i.classList.remove("open"); });
    }
  });

  // ---- Mobile nav ----
  var mobileToggle = document.querySelector("[data-mobile-toggle]");
  var mobileNav = document.querySelector("[data-mobile-nav]");
  if (mobileToggle && mobileNav) {
    mobileToggle.addEventListener("click", function () {
      mobileNav.classList.toggle("open");
    });
  }

  // ---- App sidebar toggle (mobile) ----
  var sidebarToggle = document.querySelector("[data-sidebar-toggle]");
  var sidebar = document.querySelector("[data-app-sidebar]");
  if (sidebarToggle && sidebar) {
    sidebarToggle.addEventListener("click", function () {
      sidebar.classList.toggle("open");
    });
  }

  // ---- Generic tabs ----
  document.querySelectorAll("[data-tabs]").forEach(function (wrap) {
    var tabs = wrap.querySelectorAll(".tab");
    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        var id = tab.getAttribute("data-tab");
        wrap.querySelectorAll(".tab").forEach(function (t) { t.classList.remove("active"); });
        wrap.querySelectorAll(".tab-panel").forEach(function (p) { p.classList.remove("active"); });
        tab.classList.add("active");
        var panel = wrap.querySelector('[data-tab-panel="' + id + '"]');
        if (panel) panel.classList.add("active");
      });
    });
  });

  // ---- Auth page: signup password visibility + validation ----
  document.querySelectorAll("[data-password-toggle]").forEach(function (toggle) {
    toggle.addEventListener("click", function () {
      var input = document.getElementById(toggle.getAttribute("data-password-toggle"));
      if (!input) return;
      var show = input.type === "password";
      input.type = show ? "text" : "password";
      toggle.setAttribute("aria-label", show ? "Hide password" : "Show password");
    });
  });

  var signupForm = document.querySelector("[data-signup-form]");
  if (signupForm) {
    signupForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var firstName = signupForm.elements.firstName;
      var lastName = signupForm.elements.lastName;
      var email = signupForm.elements.email;
      var password = signupForm.elements.password;
      var passwordConfirm = signupForm.elements.passwordConfirm;
      var emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim());
      var checks = [
        [firstName, firstName.value.trim().length > 0],
        [lastName, lastName.value.trim().length > 0],
        [email, emailValid],
        [password, password.value.length > 0],
        [passwordConfirm, password.value.length > 0 && passwordConfirm.value === password.value],
      ];
      checks.forEach(function (check) {
        check[0].closest(".field").classList.toggle("invalid", !check[1]);
        check[0].setAttribute("aria-invalid", String(!check[1]));
      });
      var firstInvalid = checks.find(function (check) { return !check[1]; });
      if (firstInvalid) {
        firstInvalid[0].focus();
        return;
      }
      window.location.href = "/index.html";
    });
    signupForm.querySelectorAll("input").forEach(function (input) {
      input.addEventListener("input", function () {
        input.closest(".field").classList.remove("invalid");
        input.removeAttribute("aria-invalid");
      });
    });
  }
})();
