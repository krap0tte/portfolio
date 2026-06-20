(function () {
  'use strict';

  const dataEl = document.getElementById('compat-photo-data');
  if (!dataEl) return;

  let photos;
  try { photos = JSON.parse(dataEl.textContent); } catch (e) { return; }

  const grid     = document.getElementById('compat-grid');
  const lightbox = document.getElementById('compat-lightbox');
  const lbStage  = document.getElementById('compat-lb-stage');
  const lbImg    = document.getElementById('compat-lb-img');
  const lbClose  = document.getElementById('compat-lb-close');
  const lbPrev   = document.getElementById('compat-lb-prev');
  const lbNext   = document.getElementById('compat-lb-next');

  if (!grid || !lightbox || !lbStage || !lbImg || !lbClose || !lbPrev || !lbNext) return;

  const cards      = Array.from(grid.querySelectorAll('.compat-card'));
  const filterBtns = Array.from(document.querySelectorAll('.compat-filter__btn'));

  let currentFilter  = null;
  let visibleIndexes = photos.map(function (_, i) { return i; });
  let currentIndex   = null;
  let lastFocused    = null;

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function onceLoaded(img) {
    function handler() {
      img.classList.add('is-loaded');
      img.removeEventListener('load',  handler);
      img.removeEventListener('error', handler);
    }
    img.addEventListener('load',  handler);
    img.addEventListener('error', handler);
    if (img.complete && img.naturalWidth) handler();
  }

  // ── Lazy load ───────────────────────────────────────────────────────────────

  function lazyLoadImg(img) {
    const src = img.getAttribute('data-src');
    img.removeAttribute('data-src');
    img.src = src;
    onceLoaded(img);
  }

  function lazyLoad() {
    const viewH = window.innerHeight || document.documentElement.clientHeight;
    const imgs  = grid.querySelectorAll('img[data-src]');
    for (let i = 0; i < imgs.length; i++) {
      if (imgs[i].getBoundingClientRect().top < viewH + 400) lazyLoadImg(imgs[i]);
    }
  }

  window.addEventListener('scroll', lazyLoad);
  window.addEventListener('resize', lazyLoad);
  lazyLoad();

  // ── Filtre ──────────────────────────────────────────────────────────────────

  function applyFilter(series) {
    currentFilter  = series || null;
    visibleIndexes = [];
    cards.forEach(function (card) {
      const show = !currentFilter || card.dataset.series === currentFilter;
      card.style.display = show ? '' : 'none';
      if (show) visibleIndexes.push(parseInt(card.dataset.index, 10));
    });
    filterBtns.forEach(function (btn) {
      const active = (btn.dataset.series || '') === (currentFilter || '');
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
  }

  filterBtns.forEach(function (btn) {
    btn.addEventListener('click', function () { applyFilter(btn.dataset.series); });
  });

  // ── Lightbox ────────────────────────────────────────────────────────────────

  function lbLoad(index) {
    lbImg.classList.remove('is-loaded');
    lbImg.src = photos[index].src;
    onceLoaded(lbImg);
  }

  function updateNav() {
    const hide = visibleIndexes.length < 2;
    lbPrev.hidden = hide;
    lbNext.hidden = hide;
  }

  function openLightbox(index) {
    currentIndex = index;
    lastFocused  = document.activeElement;
    lbLoad(index);
    updateNav();
    lightbox.classList.add('is-open');
    lightbox.removeAttribute('aria-hidden');
    document.body.style.overflow = 'hidden';
    lbClose.focus();
  }

  function closeLightbox() {
    lightbox.classList.remove('is-open');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (lastFocused) lastFocused.focus();
    currentIndex = null;
  }

  function navigate(dir) {
    if (currentIndex === null) return;
    const pos = visibleIndexes.indexOf(currentIndex);
    if (pos === -1) return;
    currentIndex = visibleIndexes[(pos + dir + visibleIndexes.length) % visibleIndexes.length];
    lbLoad(currentIndex);
  }

  cards.forEach(function (card) {
    card.addEventListener('click', function () {
      openLightbox(parseInt(card.dataset.index, 10));
    });
  });

  lbClose.addEventListener('click', closeLightbox);
  lbPrev.addEventListener('click',  function () { navigate(-1); });
  lbNext.addEventListener('click',  function () { navigate(1);  });

  lbStage.addEventListener('click', function (e) {
    if (e.target === lbStage) closeLightbox();
  });

  document.addEventListener('keydown', function (e) {
    if (!lightbox.classList.contains('is-open')) return;
    if (e.key === 'Escape')      { closeLightbox(); return; }
    if (e.key === 'ArrowLeft')   { navigate(-1);    return; }
    if (e.key === 'ArrowRight')  { navigate(1);     return; }
    if (e.key === 'Tab') {
      const focusable = [lbClose, lbPrev, lbNext].filter(function (el) { return !el.hidden; });
      const first = focusable[0];
      const last  = focusable[focusable.length - 1];
      if (e.shiftKey ? document.activeElement === first : document.activeElement === last) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      }
    }
  });

}());
