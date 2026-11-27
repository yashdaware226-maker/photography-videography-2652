(() => {
  // Nav: scrolled state + mobile menu
  const nav = document.querySelector(".nav");
  const toggle = document.querySelector(".nav__toggle");
  const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 40);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", open);
    document.body.style.overflow = open ? "hidden" : "";
  });
  nav.querySelectorAll(".nav__links a").forEach((a) =>
    a.addEventListener("click", () => {
      nav.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
      document.body.style.overflow = "";
    })
  );

  // Viewfinder timecode (24fps)
  const tc = document.getElementById("timecode");
  const start = performance.now();
  const pad = (n) => String(n).padStart(2, "0");
  const tick = (now) => {
    const t = (now - start) / 1000;
    const f = Math.floor((t % 1) * 24);
    const s = Math.floor(t) % 60;
    const m = Math.floor(t / 60) % 60;
    const h = Math.floor(t / 3600);
    tc.textContent = `${pad(h)}:${pad(m)}:${pad(s)}:${pad(f)}`;
    requestAnimationFrame(tick);
  };
  if (tc) requestAnimationFrame(tick);

  // Drone altitude drift
  const alt = document.getElementById("alt");
  if (alt) setInterval(() => { alt.textContent = 110 + Math.round(Math.random() * 20); }, 1400);

  // Scroll reveals
  const targets = document.querySelectorAll(".intro__logo, .about--home .about__photo, .tile, .map, .form");
  targets.forEach((el) => el.classList.add("sr"));
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
  targets.forEach((el) => io.observe(el));

  // Portfolio: filter + lightbox (delegated so Instagram tiles work too)
  const grid = document.querySelector(".grid");
  const filterBtns = document.querySelectorAll(".filters button");
  let activeFilter = "all";
  const applyFilter = () =>
    grid.querySelectorAll(".tile").forEach((t) => t.classList.toggle("is-hidden", activeFilter !== "all" && t.dataset.cat !== activeFilter));
  filterBtns.forEach((btn) =>
    btn.addEventListener("click", () => {
      filterBtns.forEach((b) => { b.classList.toggle("is-active", b === btn); b.setAttribute("aria-selected", b === btn); });
      activeFilter = btn.dataset.filter;
      applyFilter();
      queueFit();
    })
  );

  const lb = document.querySelector(".lightbox");
  const lbImg = lb.querySelector("img");
  const lbLink = lb.querySelector(".lightbox__ig");
  const closeLb = () => { lb.hidden = true; document.body.style.overflow = ""; };
  const openTile = (t) => {
    const img = t.querySelector("img");
    lbImg.src = img.src.includes("images.unsplash.com") ? img.src.replace(/w=\d+/, "w=2000") : img.src;
    lbImg.alt = img.alt;
    lbLink.hidden = !t.dataset.permalink;
    if (t.dataset.permalink) lbLink.href = t.dataset.permalink;
    lb.hidden = false;
    document.body.style.overflow = "hidden";
  };
  // Photo layout (all devices): Pinterest-style columns. Each tile keeps its photo's
  // shape, and the next photo moves up to sit right under it, so a column never has gaps.
  const ROW = 4;
  const ratioOf = (t) => {
    const img = t.querySelector("img");
    const r = img && img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 0.8;
    return t.classList.contains("tile--rot") ? 1 / r : r;
  };
  const fitGrid = () => {
    grid.classList.add("is-fit");
    const cs = getComputedStyle(grid);
    const gap = parseFloat(cs.rowGap) || 0;
    const cols = cs.gridTemplateColumns.split(" ").length;
    const colW = (grid.clientWidth - gap * (cols - 1)) / cols;
    grid.querySelectorAll(".tile").forEach((t) => {
      t.style.setProperty("--rows", Math.max(1, Math.round((colW / ratioOf(t) + gap) / (ROW + gap))));
    });
  };
  let fitQueued = false;
  const queueFit = () => { if (!fitQueued) { fitQueued = true; requestAnimationFrame(() => { fitQueued = false; fitGrid(); }); } };
  const prepTiles = () => {
    grid.querySelectorAll(".tile").forEach((t) => {
      t.tabIndex = 0;
      const img = t.querySelector("img");
      if (img && !img.complete) img.addEventListener("load", queueFit, { once: true });
    });
    fitGrid();
  };
  prepTiles();
  window.addEventListener("resize", queueFit);
  grid.addEventListener("click", (e) => { const t = e.target.closest(".tile"); if (t) openTile(t); });
  grid.addEventListener("keydown", (e) => { const t = e.target.closest(".tile"); if (t && e.key === "Enter") openTile(t); });
  lb.addEventListener("click", (e) => { if (e.target !== lbImg && e.target !== lbLink) closeLb(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !lb.hidden) closeLb(); });

  // Instagram feed: replace the sample frames with the latest posts when available
  // Only shoot photo posts appear in Work (no reels/videos): captions must mention one of these.
  const CATS = [
    ["prewedding", /pre[\s-]?wedd?ing|prewed|couple ?shoot/i, "Pre-wedding"],
    ["wedding", /wedd?ing|shaadi|shadi|lagna|vivah|haldi|mehe?ndi|mehandi|sangeet|bride|groom|reception|engagement|phera/i, "Wedding"],
    ["event", /b'?day|birthday/i, "Birthday"],
  ];
  const LAYOUT = ["tile--tall", "", "", "tile--wide", "", "tile--tall", "", "", "", "", "tile--wide"];
  const esc = (str) => str.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  // One shared Instagram request for Work, Films, Drone and BTS.
  window.igFeed = window.igFeed || fetch("/api/instagram").then((r) => (r.ok ? r.json() : { posts: [] })).catch(() => ({ posts: [] }));
  window.igFeed
    .then(({ posts }) => {
      const shoots = (posts || [])
        .filter((p) => !p.video && !/#bts\b/i.test(p.caption))
        .map((p) => ({ ...p, cat: CATS.find(([, re]) => re.test(p.caption)) }))
        .filter((p) => p.cat);
      if (!shoots.length) return;
      grid.innerHTML = shoots.map((p, i) => {
        const cat = p.cat;
        const title = (p.caption.split("\n")[0].replace(/#\S+/g, "").trim() || "On Instagram").slice(0, 60);
        const rot = /#ccf\b/i.test(p.caption) ? " tile--rot" : "";
        return `<figure class="tile tile--ig${rot} ${LAYOUT[i % LAYOUT.length]}" data-cat="${cat ? cat[0] : "other"}" data-permalink="${esc(p.permalink)}">
          <img loading="lazy" src="${esc(p.image)}" alt="${esc(title)} — Instagram post by The Cre8ive YD" />
          ${p.video ? '<i class="tile__play" aria-hidden="true">▶</i>' : ""}
          <figcaption>${esc(title)} · <span>${cat ? cat[2] : "Instagram"}</span></figcaption>
        </figure>`;
      }).join("");
      prepTiles();
      applyFilter();
      // Rotated tiles swap width/height so the turned image still fills the tile.
      const sizeRot = () => grid.querySelectorAll(".tile--rot").forEach((t) => {
        t.style.setProperty("--rw", t.clientWidth + "px");
        t.style.setProperty("--rh", t.clientHeight + "px");
      });
      sizeRot();
      window.addEventListener("resize", sizeRot);
      grid.querySelectorAll("img").forEach((img) => img.addEventListener("load", sizeRot, { once: true }));
      grid.querySelectorAll(".tile").forEach((t) => { t.classList.add("sr"); io.observe(t); });
    })
    .catch(() => {});

  // Enquiry form: inline validation, then AJAX submit to Netlify Forms
  const form = document.querySelector("form[name='enquiry']");
  const status = form.querySelector(".form__status");
  const submitBtn = form.querySelector("button[type='submit']");
  const validate = (el) => {
    const field = el.closest(".field");
    if (!field) return true;
    const ok = el.checkValidity();
    field.classList.toggle("is-invalid", !ok);
    return ok;
  };
  form.querySelectorAll("input, select").forEach((el) => {
    el.addEventListener("blur", () => validate(el));
    el.addEventListener("input", () => el.closest(".field")?.classList.contains("is-invalid") && validate(el));
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fields = [...form.querySelectorAll("input[required], select[required], input[type='email']")];
    const results = fields.map(validate);
    if (results.includes(false)) {
      status.textContent = "Please fix the highlighted fields.";
      status.classList.add("is-error");
      fields[results.indexOf(false)].focus();
      return;
    }
    status.classList.remove("is-error");
    status.textContent = "Sending…";
    submitBtn.disabled = true;
    try {
      const res = await fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(new FormData(form)).toString(),
      });
      if (!res.ok) throw new Error(res.statusText);
      window.location.href = "/thank-you";
    } catch {
      status.textContent = "Something went wrong. Please call or WhatsApp us on +91 84520 18599.";
      status.classList.add("is-error");
      submitBtn.disabled = false;
    }
  });

  // ?type=drone or ?type=realestate pre-selects the shoot type (used by the Drone page links).
  const typeParam = new URLSearchParams(location.search).get("type");
  const typeSel = form.querySelector("#f-type");
  const TYPE_MAP = { drone: "Drone / aerial", realestate: "Real estate / property", wedding: "Wedding" };
  if (typeParam && TYPE_MAP[typeParam]) {
    typeSel.value = TYPE_MAP[typeParam];
    if (typeParam !== "wedding") form.querySelector("input[name='want_drone']").checked = true;
  }

  // Floating WhatsApp button: wedding message by default, drone message while the Drone section is on screen.
  const wa = document.querySelector(".wa");
  const WA = {
    wedding: "Hi Yash, I'd like to check availability for my wedding 💍",
    drone: "Hi Yash, I need a drone / real estate shoot 🚁",
  };
  const setWA = (k) => { if (wa) wa.href = "https://wa.me/918452018599?text=" + encodeURIComponent(WA[k]); };
  document.querySelectorAll("[data-wa]").forEach((sec) =>
    new IntersectionObserver(([e]) => setWA(e.isIntersecting ? sec.dataset.wa : "wedding"), { threshold: 0.3 }).observe(sec)
  );

  document.getElementById("year").textContent = new Date().getFullYear();
})();
