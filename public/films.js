// Films: one big showreel that plays YouTube films and Instagram reels back to back (muted autoplay).
(() => {
  const section = document.getElementById("films");
  if (!section) return;
  const screen = section.querySelector(".films__screen");
  const strip = section.querySelector(".films__strip");
  const srcEl = section.querySelector(".films__src");
  const titleEl = section.querySelector(".films__title");
  const openEl = section.querySelector(".films__open");
  const soundBtn = section.querySelector('[data-act="sound"]');

  // Reels shot horizontally and rotated for Instagram carry #CCF; those get turned back to landscape.
  const ROTATED = /#ccf\b/i;
  const SHOOT = /#ccf\b|wedd?ing|pre[\s-]?wedd?ing|prewed|shaadi|shadi|lagna|haldi|mehe?ndi|mehandi|sangeet|engagement|reception|b'?day|birthday|cinematic|film|teaser|highlight/i;
  const clean = (t) => (t || "").split("\n")[0].replace(/#\S+/g, "").trim().slice(0, 80);
  const getJSON = (url, key) => fetch(url).then((r) => (r.ok ? r.json() : {})).then((d) => d[key] || []).catch(() => []);

  let items = [];
  let idx = 0;
  let muted = true;
  let inView = false;
  let ytPlayer = null;
  let video = null;
  let ytReady = null;

  const loadYT = () =>
    ytReady ||
    (ytReady = new Promise((resolve) => {
      if (window.YT && window.YT.Player) return resolve();
      window.onYouTubeIframeAPIReady = resolve;
      const s = document.createElement("script");
      s.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(s);
    }));

  const clear = () => {
    if (ytPlayer) { try { ytPlayer.destroy(); } catch {} ytPlayer = null; }
    if (video) { video.pause(); video.removeAttribute("src"); video.load(); video = null; }
    screen.innerHTML = "";
  };

  const next = () => play((idx + 1) % items.length);
  const prev = () => play((idx - 1 + items.length) % items.length);

  async function play(i) {
    idx = i;
    const it = items[idx];
    clear();
    srcEl.textContent = it.type === "yt" ? "YouTube" : "Instagram";
    titleEl.textContent = it.title || "The Cre8ive YD";
    openEl.href = it.link;
    strip.querySelectorAll(".films__thumb").forEach((t, n) => t.classList.toggle("is-active", n === idx));
    strip.children[idx]?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });

    if (it.type === "ig") {
      video = document.createElement("video");
      Object.assign(video, { src: it.src, muted, playsInline: true, autoplay: inView, preload: "metadata", poster: it.thumb });
      video.setAttribute("playsinline", "");
      if (it.rotated) video.classList.add("is-rotated");
      video.addEventListener("ended", next);
      video.addEventListener("error", () => items.length > 1 && setTimeout(next, 800));
      screen.appendChild(video);
      if (inView) video.play().catch(() => {});
      return;
    }

    await loadYT();
    if (items[idx] !== it) return; // user moved on while the API loaded
    const host = document.createElement("div");
    screen.appendChild(host);
    ytPlayer = new YT.Player(host, {
      videoId: it.id,
      playerVars: { autoplay: inView ? 1 : 0, mute: muted ? 1 : 0, playsinline: 1, rel: 0, modestbranding: 1 },
      events: {
        onReady: (e) => { muted ? e.target.mute() : e.target.unMute(); if (inView) e.target.playVideo(); },
        onStateChange: (e) => { if (e.data === YT.PlayerState.ENDED) next(); },
        onError: () => items.length > 1 && setTimeout(next, 800),
      },
    });
  }

  const setSound = (on) => {
    muted = !on;
    soundBtn.classList.toggle("is-on", on);
    soundBtn.innerHTML = on ? "&#128266; Sound on" : "&#128263; Sound";
    soundBtn.setAttribute("aria-label", on ? "Turn sound off" : "Turn sound on");
    if (video) { video.muted = muted; video.play().catch(() => {}); }
    if (ytPlayer && ytPlayer.mute) { muted ? ytPlayer.mute() : ytPlayer.unMute(); }
  };

  section.addEventListener("click", (e) => {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    if (b.dataset.act === "next") next();
    if (b.dataset.act === "prev") prev();
    if (b.dataset.act === "sound") setSound(muted);
  });

  // Only play while the section is on screen.
  new IntersectionObserver(([e]) => {
    inView = e.isIntersecting;
    if (video) inView ? video.play().catch(() => {}) : video.pause();
    if (ytPlayer && ytPlayer.playVideo) inView ? ytPlayer.playVideo() : ytPlayer.pauseVideo();
  }, { threshold: 0.35 }).observe(section);

  Promise.all([getJSON("/api/youtube", "videos"), (window.igFeed || fetch("/api/instagram").then((r) => r.json())).then((d) => d.posts || []).catch(() => [])]).then(([yt, ig]) => {
    const ytItems = yt.map((v) => ({
      type: "yt", id: v.id, title: v.title, kind: v.kind,
      thumb: `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`,
      link: `https://www.youtube.com/watch?v=${v.id}`,
    }));
    const igItems = ig
      .filter((p) => p.videoUrl && ROTATED.test(p.caption) && !/#bts\b/i.test(p.caption))
      .map((p) => ({ type: "ig", src: p.videoUrl, title: clean(p.caption), thumb: p.image, link: p.permalink, rotated: ROTATED.test(p.caption) }));
    // Shuffle each playlist and the #CCF reels on every visit, then mix them.
    const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const pre = shuffle(ytItems.filter((v) => v.kind === "prewedding"));
    const wed = shuffle(ytItems.filter((v) => v.kind !== "prewedding"));
    const reels = shuffle(igItems);
    // Pattern: pre-wedding film → wedding film → #CCF reel → …
    for (let i = 0; i < Math.max(pre.length, wed.length, reels.length); i++) {
      if (pre[i]) items.push(pre[i]);
      if (wed[i]) items.push(wed[i]);
      if (reels[i]) items.push(reels[i]);
    }
    if (!items.length) return;
    strip.innerHTML = items
      .map((it, n) => `<button class="films__thumb" role="listitem" data-i="${n}" aria-label="Play ${it.title.replace(/"/g, "&quot;")}"><img loading="lazy" src="${it.thumb}" alt=""${it.rotated ? ' class="is-rotated"' : ""} /><span>${it.type === "yt" ? "YOUTUBE" : "REEL"}</span></button>`)
      .join("");
    strip.addEventListener("click", (e) => { const t = e.target.closest(".films__thumb"); if (t) play(+t.dataset.i); });
    section.hidden = false;
    play(0);
  });
})();
