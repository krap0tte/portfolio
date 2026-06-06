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
const seriesEl     = document.getElementById('series-data');
const seriesData   = seriesEl ? JSON.parse(seriesEl.textContent) : {};
const filterBtns   = document.querySelectorAll('.gallery-filters__btn');
const galleryCards = document.querySelectorAll('.gallery-card');

function updateHeading(filter, label) {
  if (!headingTitle || !headingDesc) return;
  headingTitle.textContent = filter === 'all' ? 'Toutes les photos' : label;
  headingDesc.textContent  = filter === 'all' ? '' : (seriesData[filter] || '');
}

filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterBtns.forEach(b => b.classList.remove('is-active'));
    btn.classList.add('is-active');

    const filter = btn.dataset.filter;
    updateHeading(filter, btn.textContent.trim());

    galleryCards.forEach(card => {
      card.style.display = filter === 'all' || card.dataset.category === filter ? '' : 'none';
    });
  });
});

// ─── Gallery image fade-in ───────────────────────────────────────────────────

galleryCards.forEach(card => {
  const img  = card.querySelector('img');
  const wrap = card.querySelector('.gallery-card__img-wrap');
  if (!img) return;
  const markLoaded = () => {
    img.classList.add('is-loaded');
    wrap?.classList.add('is-loaded');
  };
  if (img.complete && img.naturalWidth > 0) markLoaded();
  else img.addEventListener('load', markLoaded);
});

// ─── Lightbox ────────────────────────────────────────────────────────────────

(function () {
  const dataEl = document.getElementById('photo-data');
  if (!dataEl) return;

  const photos   = JSON.parse(dataEl.textContent);
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
  const lbLoader   = document.getElementById('lightbox-loader');

  let current     = 0;
  let lastFocused = null;

  function visibleIndices() {
    return Array.from(galleryCards)
      .filter(card => card.style.display !== 'none')
      .map(card => Number(card.dataset.index));
  }

  function update() {
    const p = photos[current];

    lbImg.classList.add('is-loading');
    lbLoader.classList.add('is-visible');

    const done = () => {
      lbImg.classList.remove('is-loading');
      lbLoader.classList.remove('is-visible');
    };
    lbImg.onload = done;

    lbImg.alt = p.title;
    if (p.webp) {
      lbImg.onerror = () => { lbImg.onerror = null; lbImg.src = p.src; };
      lbImg.src = p.webp;
    } else {
      lbImg.src = p.src;
    }
    if (lbImg.complete && lbImg.naturalWidth) done();

    lbTitle.textContent = p.title;
    lbMeta.textContent  = [p.category, p.date].filter(Boolean).join(' · ');

    lbLocation.textContent = p.location;
    lbLocation.hidden      = !p.location;

    lbDesc.textContent = p.description;
    lbDesc.hidden      = !p.description;

    lbPrev.hidden = lbNext.hidden = visibleIndices().length < 2;
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
    const pos     = visible.indexOf(current);
    current       = visible[(pos + dir + visible.length) % visible.length];
    update();
  }

  galleryCards.forEach(card => {
    card.addEventListener('click', e => {
      e.preventDefault();
      open(Number(card.dataset.index));
    });
  });

  lbClose.addEventListener('click', close);
  lbPrev.addEventListener('click', () => navigate(-1));
  lbNext.addEventListener('click', () => navigate(1));

  lbStage.addEventListener('click', e => { if (e.target === lbStage) close(); });

  document.addEventListener('keydown', e => {
    if (!lightbox.classList.contains('is-open')) return;
    if (e.key === 'Escape')     close();
    if (e.key === 'ArrowLeft')  navigate(-1);
    if (e.key === 'ArrowRight') navigate(1);
  });
})();
