// ─── Mobile nav toggle ───────────────────────────────────────────────────────

const navToggle = document.getElementById('nav-toggle');
const mobileNav = document.getElementById('mobile-nav');

if (navToggle && mobileNav) {
  navToggle.addEventListener('click', () => {
    const open = mobileNav.classList.toggle('is-open');
    navToggle.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
  });

  mobileNav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      mobileNav.classList.remove('is-open');
      navToggle.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    });
  });
}

// ─── Gallery filter ──────────────────────────────────────────────────────────

const headingTitle = document.getElementById('gallery-heading-title');
const headingDesc  = document.getElementById('gallery-heading-desc');
const seriesDataEl = document.getElementById('series-data');
const seriesData   = seriesDataEl ? JSON.parse(seriesDataEl.textContent) : {};

function updateHeading(filter, label) {
  if (!headingTitle) return;
  headingTitle.textContent = filter === 'all' ? 'Toutes les photos' : label;
  if (headingDesc) headingDesc.textContent = filter === 'all' ? '' : (seriesData[filter] || '');
}

document.querySelectorAll('.gallery-filters__btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.gallery-filters__btn').forEach(b => b.classList.remove('is-active'));
    btn.classList.add('is-active');

    const filter = btn.dataset.filter;
    updateHeading(filter, btn.textContent.trim());

    document.querySelectorAll('.gallery-card').forEach(card => {
      const show = filter === 'all' || card.dataset.category === filter;
      card.style.display = show ? '' : 'none';
    });
  });
});

// ─── Lightbox ────────────────────────────────────────────────────────────────

(function () {
  const dataEl = document.getElementById('photo-data');
  if (!dataEl) return;

  const photos = JSON.parse(dataEl.textContent);
  const lightbox = document.getElementById('lightbox');
  if (!lightbox) return;

  const lbImg      = document.getElementById('lightbox-img');
  const lbTitle    = document.getElementById('lightbox-title');
  const lbMeta     = document.getElementById('lightbox-meta');
  const lbLocation = document.getElementById('lightbox-location');
  const lbDesc     = document.getElementById('lightbox-description');
  const lbClose    = document.getElementById('lightbox-close');
  const lbPrev     = document.getElementById('lightbox-prev');
  const lbNext     = document.getElementById('lightbox-next');
  const lbStage    = document.getElementById('lightbox-stage');

  let current = 0;
  let lastFocused = null;

  function visibleIndices() {
    return Array.from(document.querySelectorAll('.gallery-card'))
      .filter(card => card.style.display !== 'none')
      .map(card => Number(card.dataset.index));
  }

  function update() {
    const p = photos[current];

    lbImg.src = p.src;
    lbImg.alt = p.title;
    lbTitle.textContent = p.title;

    const metaParts = [p.category, p.date].filter(Boolean);
    lbMeta.textContent = metaParts.join(' · ');

    lbLocation.textContent = p.location;
    lbLocation.hidden = !p.location;

    lbDesc.textContent = p.description;
    lbDesc.hidden = !p.description;

    const multiPhoto = visibleIndices().length > 1;
    lbPrev.hidden = !multiPhoto;
    lbNext.hidden = !multiPhoto;
  }

  function open(index) {
    lastFocused = document.activeElement;
    current = index;
    update();
    lightbox.classList.add('is-open');
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    lbClose.focus();
  }

  function close() {
    lightbox.classList.remove('is-open');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    lastFocused?.focus();
  }

  function navigate(dir) {
    const visible = visibleIndices();
    const pos = visible.indexOf(current);
    current = visible[(pos + dir + visible.length) % visible.length];
    update();
  }

  document.querySelectorAll('.gallery-card').forEach(card => {
    card.addEventListener('click', e => {
      e.preventDefault();
      open(Number(card.dataset.index));
    });
  });

  lbClose.addEventListener('click', close);
  lbPrev.addEventListener('click', () => navigate(-1));
  lbNext.addEventListener('click', () => navigate(1));

  lbStage.addEventListener('click', e => {
    if (e.target === lbStage) close();
  });

  document.addEventListener('keydown', e => {
    if (!lightbox.classList.contains('is-open')) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') navigate(-1);
    if (e.key === 'ArrowRight') navigate(1);
  });
})();
