// Scroll-triggered text animations: headlines rise word by word, copy fades up in sequence.
(() => {
  if (!("IntersectionObserver" in window)) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const SKIP = ".nav, .form, .map, .tile, .hp, .lightbox, .viewfinder, .marquee, .wa";
  const COPY = [
    ".eyebrow", ".display", ".lede", "main p", "section p",
    ".svc__no", ".svc__item h3", ".step span", ".step h3",
    ".facts li", ".stats li", ".ticks li", ".contact__list > div",
    ".hero__actions", ".filters", ".work__more", ".about__photo figcaption",
    ".footer > *", ".thanks__wrap > .btn",
  ].join(",");

  // Wrap each word of a headline in a masked span, keeping <em>/<br> intact.
  const splitWords = (el) => {
    let i = 0;
    const walk = (node) => {
      [...node.childNodes].forEach((child) => {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/([ \n\t]+)/).forEach((part) => {
            if (!part) return;
            if (/^[ \n\t]+$/.test(part)) { frag.appendChild(document.createTextNode(" ")); return; }
            const w = document.createElement("span");
            w.className = "w";
            const inner = document.createElement("span");
            inner.className = "w__i";
            inner.style.setProperty("--wi", i++);
            inner.textContent = part;
            w.appendChild(inner);
            frag.appendChild(w);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === 1 && child.tagName !== "BR") {
          walk(child);
        }
      });
    };
    el.setAttribute("aria-label", el.textContent.replace(/\s+/g, " ").trim());
    walk(el);
    el.querySelectorAll(".w").forEach((w) => w.setAttribute("aria-hidden", "true"));
  };

  const all = [...document.querySelectorAll(COPY)].filter((el) => !el.closest(SKIP));
  const set = new Set(all);
  // Skip anything nested inside another animated element to avoid double motion.
  const targets = all.filter((el) => {
    for (let p = el.parentElement; p; p = p.parentElement) if (set.has(p)) return false;
    return true;
  });

  targets.forEach((el) => {
    // Elements that had the on-load .reveal animation keep their original delay.
    if (el.classList.contains("reveal")) {
      const d = el.style.getPropertyValue("--d");
      el.classList.remove("reveal");
      if (d) el.style.setProperty("--base", d);
    }
    if (el.classList.contains("display")) { splitWords(el); el.classList.add("tx-head"); }
    else el.classList.add("tx");
  });

  // Containers with the on-load animation whose text is now animated individually lose it.
  document.querySelectorAll(".reveal").forEach((el) => {
    if (targets.some((t) => el.contains(t))) el.classList.remove("reveal");
  });

  const io = new IntersectionObserver((entries) => {
    let n = 0;
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.style.setProperty("--sd", `${n++ * 90}ms`);
      e.target.classList.add("is-in");
      io.unobserve(e.target);
    });
  }, { threshold: 0.15, rootMargin: "0px 0px -8% 0px" });
  targets.forEach((el) => io.observe(el));
})();
