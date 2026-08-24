// Homepage scroll story — drives the phone / tablet / laptop device
// transforms from scroll position. Animates only `transform` and `opacity`,
// gated by IntersectionObserver so no work happens while a section is
// off-screen. Respects prefers-reduced-motion with a fully static fallback.

(function () {
  const story = document.querySelector(".story");
  if (!story) return;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    story.classList.add("story-static");
    return;
  }

  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  const isMobile = () => window.matchMedia("(max-width: 640px)").matches;
  const isTablet = () => window.matchMedia("(max-width: 980px)").matches;

  function pinProgress(wrap) {
    const rect = wrap.getBoundingClientRect();
    const range = rect.height - window.innerHeight;
    return range > 0 ? clamp01(-rect.top / range) : 0;
  }

  function observePin(wrap, onProgress) {
    let inView = false;
    let raf = null;

    function tick() {
      raf = null;
      onProgress(pinProgress(wrap));
      if (inView) raf = requestAnimationFrame(tick);
    }

    new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          inView = entry.isIntersecting;
          if (inView && raf === null) raf = requestAnimationFrame(tick);
        });
      },
      { threshold: 0 }
    ).observe(wrap);

    tick();
  }

  // fades in over [inEnd-fade, inEnd], holds at 1, fades out over [outStart, outStart+fade]
  function rangeFade(p, inStart, inEnd, outStart, outEnd) {
    if (p <= inStart) return 0;
    if (p < inEnd) return (p - inStart) / (inEnd - inStart);
    if (p <= outStart) return 1;
    if (p < outEnd) return 1 - (p - outStart) / (outEnd - outStart);
    return 0;
  }

  // ---- Phone + tablet story ----
  const phoneWrap = document.getElementById("phoneStory");
  const phone = document.querySelector("[data-story-phone]");
  const phoneFaces = phone ? Array.from(phone.querySelectorAll("[data-phone-face]")) : [];
  const tablet = document.querySelector("[data-story-tablet]");
  const civilQuickInfo = document.querySelector("[data-civil-quick-info]");
  const lingoQuickInfo = document.querySelector("[data-lingo-quick-info]");
  const commerceQuickInfo = document.querySelector("[data-commerce-quick-info]");
  const appItems = Array.from(document.querySelectorAll("[data-app-item]"));

  const ENTER_END = 0.18;
  const HANDOFF_START = 0.6;
  const HANDOFF_END = 0.82;

  if (phoneWrap && phone) {
    observePin(phoneWrap, (p) => {
      const mobile = isMobile();
      const tabletBp = isTablet();
      const ampX = mobile ? 70 : tabletBp ? 110 : 170;
      const ampRot = mobile ? 10 : tabletBp ? 18 : 32;
      const handoffX = mobile ? 40 : tabletBp ? 55 : 80;
      const tabletAmpX = mobile ? 90 : tabletBp ? 150 : 220;

      // ---- phone transform ----
      let x, rot, scale, op;
      if (p < ENTER_END) {
        const t = p / ENTER_END;
        x = (1 - t) * ampX;
        rot = mobile ? 0 : -(1 - t) * ampRot;
        scale = 1;
        op = 1;
      } else if (p < HANDOFF_START) {
        x = 0; rot = 0; scale = 1; op = 1;
      } else if (p < HANDOFF_END) {
        const t = (p - HANDOFF_START) / (HANDOFF_END - HANDOFF_START);
        x = -handoffX * t; rot = 0; scale = 1 - 0.18 * t; op = 1 - 0.45 * t;
      } else {
        x = -handoffX; rot = 0; scale = 0.82; op = 0.55;
      }
      phone.style.transform = `translate3d(${x.toFixed(1)}px,0,0) rotateY(${rot.toFixed(1)}deg) scale(${scale.toFixed(2)})`;
      phone.style.opacity = op.toFixed(2);

      // ---- phone face crossfade: Civil -> Lingo -> Commerce ----
      if (phoneFaces[0]) phoneFaces[0].style.opacity = rangeFade(p, 0, 0.1, 0.22, 0.34).toFixed(2);
      if (phoneFaces[1]) phoneFaces[1].style.opacity = rangeFade(p, 0.22, 0.34, 0.46, 0.58).toFixed(2);
      if (phoneFaces[2]) phoneFaces[2].style.opacity = clamp01((p - 0.46) / 0.12).toFixed(2);
      if (civilQuickInfo) civilQuickInfo.style.opacity = rangeFade(p, 0, 0.1, 0.22, 0.34).toFixed(2);
      if (lingoQuickInfo) lingoQuickInfo.style.opacity = rangeFade(p, 0.22, 0.34, 0.46, 0.58).toFixed(2);
      if (commerceQuickInfo) commerceQuickInfo.style.opacity = clamp01((p - 0.46) / 0.12).toFixed(2);

      // ---- tablet entrance (after Commerce mobile state) ----
      if (tablet) {
        let tx, tScale, tOp;
        if (p < HANDOFF_START) {
          tx = tabletAmpX; tScale = 0.9; tOp = 0;
        } else if (p < HANDOFF_END) {
          const t = (p - HANDOFF_START) / (HANDOFF_END - HANDOFF_START);
          tx = tabletAmpX * (1 - t); tScale = 0.9 + 0.1 * t; tOp = t;
        } else {
          tx = 0; tScale = 1; tOp = 1;
        }
        tablet.style.transform = `translate3d(${tx.toFixed(1)}px,0,0) scale(${tScale.toFixed(2)})`;
        tablet.style.opacity = tOp.toFixed(2);
      }

      // ---- highlighted product text ----
      const active = p < 0.28 ? 0 : p < 0.52 ? 1 : 2;
      appItems.forEach((item, i) => item.classList.toggle("is-active", i === active));
    });
  }

  // ---- Laptop story (single open-state photo, simulated close->open) ----
  const laptopWrap = document.getElementById("laptopStory");
  const laptopPhoto = document.querySelector("[data-laptop-photo]");

  if (laptopWrap && laptopPhoto) {
    observePin(laptopWrap, (p) => {
      const rotX = -78 + 78 * p;
      const scaleY = 0.22 + 0.78 * p;
      const op = 0.85 + 0.15 * p;
      laptopPhoto.style.transform = `translateX(-50%) rotateX(${rotX.toFixed(1)}deg) scaleY(${scaleY.toFixed(3)})`;
      laptopPhoto.style.opacity = op.toFixed(2);
    });
  }
})();
