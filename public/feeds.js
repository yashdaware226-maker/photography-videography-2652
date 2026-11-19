// Drone (#drone) and Behind-the-scenes (#bts) feeds from Instagram.
(() => {
  const feed = window.igFeed || fetch("/api/instagram").then((r) => (r.ok ? r.json() : { posts: [] })).catch(() => ({ posts: [] }));
  const esc = (s) => (s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const clean = (t) => (t || "").split("\n")[0].replace(/#\S+/g, "").trim().slice(0, 70);
  const ROTATED = /#ccf\b/i;

  // Small lightbox that plays a clip with sound, or shows a photo.
  let box;
  const open = (p) => {
    if (!box) {
      box = document.createElement("div");
      box.className = "clipbox";
      box.innerHTML = '<button class="clipbox__close" aria-label="Close">×</button><div class="clipbox__media"></div><a class="btn btn--ghost clipbox__ig" target="_blank" rel="noopener">View on Instagram</a>';
      document.body.appendChild(box);
      const close = () => { box.hidden = true; box.querySelector(".clipbox__media").innerHTML = ""; document.body.style.overflow = ""; };
      box.addEventListener("click", (e) => { if (e.target === box || e.target.closest(".clipbox__close")) close(); });
      document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !box.hidden) close(); });
    }
    const media = box.querySelector(".clipbox__media");
    media.classList.toggle("is-rotated", ROTATED.test(p.caption));
    media.innerHTML = p.videoUrl
      ? `<video src="${esc(p.videoUrl)}" poster="${esc(p.image)}" controls autoplay playsinline></video>`
      : `<img src="${esc(p.image)}" alt="${esc(clean(p.caption))}" />`;
    box.querySelector(".clipbox__ig").href = p.permalink;
    box.hidden = false;
    document.body.style.overflow = "hidden";
    document.querySelectorAll(".clip video").forEach((v) => v.pause());
  };

  // Muted previews only play while visible, to save data on phones.
  // Each grid starts all its clips together when it scrolls into view, and pauses them when it leaves.
  const playAll = (grid, on) => grid.querySelectorAll("video").forEach((v) => {
    v.muted = true;
    if (on) v.play().catch(() => {}); else v.pause();
  });
  const gio = new IntersectionObserver((entries) =>
    entries.forEach((e) => playAll(e.target, e.isIntersecting)), { threshold: 0.05 });

  const render = (wrap, grid, posts, max) => {
    if (!wrap || !grid || !posts.length) return;
    grid.innerHTML = posts.slice(0, max).map((p, i) => `
      <button class="clip${ROTATED.test(p.caption) ? " clip--rot" : ""}" data-i="${i}" aria-label="${esc(clean(p.caption) || "Open post")}">
        ${p.videoUrl
          ? `<video muted autoplay loop playsinline preload="metadata" poster="${esc(p.image)}" src="${esc(p.videoUrl)}"></video><i class="clip__play" aria-hidden="true">▶</i>`
          : `<img loading="lazy" src="${esc(p.image)}" alt="" />`}
        ${clean(p.caption) ? `<span class="clip__cap">${esc(clean(p.caption))}</span>` : ""}
      </button>`).join("");
    grid.querySelectorAll("video").forEach((v) => v.setAttribute("muted", ""));
    gio.observe(grid);
    grid.addEventListener("click", (e) => { const c = e.target.closest(".clip"); if (c) open(posts[+c.dataset.i]); });
    wrap.hidden = false;
  };

  feed.then(({ posts = [] }) => {
    const bts = posts.filter((p) => /#bts\b/i.test(p.caption));
    const drone = posts.filter((p) => /#drone\b/i.test(p.caption));
    render(document.getElementById("bts"), document.querySelector(".bts__grid"), bts, 12);
    document.querySelectorAll("[data-feed='drone']").forEach((g) => render(g.closest(".drone__feed, .dpage__feed"), g, drone, +(g.dataset.max || 12)));
  });
})();
