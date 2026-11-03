(() => {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const dot = document.createElement('div');
  const ring = document.createElement('div');
  dot.className = 'cursor-dot';
  ring.className = 'cursor-ring';
  ring.innerHTML = '<span class="cursor-ring__frame"><i class="c c--tl"></i><i class="c c--tr"></i><i class="c c--bl"></i><i class="c c--br"></i></span><span class="cursor-ring__rec"></span><span class="cursor-ring__label"></span>';
  dot.setAttribute('aria-hidden', 'true');
  ring.setAttribute('aria-hidden', 'true');
  document.body.append(ring, dot);
  document.documentElement.classList.add('has-cursor');

  const label = ring.querySelector('.cursor-ring__label');
  let mx = -100, my = -100, rx = -100, ry = -100, shown = false;

  const LINK = 'a, button, [role="button"], label, select, .chips span, .filters button';
  const VIEW = '.tile';
  const TEXT = 'input, textarea, [contenteditable="true"]';

  document.addEventListener('mousemove', (e) => {
    mx = e.clientX; my = e.clientY;
    if (!shown) { rx = mx; ry = my; shown = true; document.documentElement.classList.add('cursor-on'); }
    dot.style.transform = `translate3d(${mx}px, ${my}px, 0)`;
  }, { passive: true });

  document.addEventListener('mouseover', (e) => {
    const t = e.target;
    const view = t.closest(VIEW);
    ring.classList.toggle('is-view', !!view);
    label.textContent = view ? 'View' : '';
    ring.classList.toggle('is-link', !view && !!t.closest(LINK));
    document.documentElement.classList.toggle('cursor-text', !!t.closest(TEXT));
  });

  document.addEventListener('mouseleave', () => document.documentElement.classList.remove('cursor-on'));
  document.addEventListener('mouseenter', () => { if (shown) document.documentElement.classList.add('cursor-on'); });
  document.addEventListener('mousedown', () => ring.classList.add('is-down'));
  document.addEventListener('mouseup', () => ring.classList.remove('is-down'));

  const ease = reduce ? 1 : 0.16;
  (function loop() {
    rx += (mx - rx) * ease;
    ry += (my - ry) * ease;
    ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
    requestAnimationFrame(loop);
  })();
})();
