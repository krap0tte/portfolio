// Mobile nav toggle
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

// Gallery filter
document.querySelectorAll('.gallery-filters__btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.gallery-filters__btn').forEach(b => b.classList.remove('is-active'));
    btn.classList.add('is-active');

    const filter = btn.dataset.filter;
    document.querySelectorAll('.gallery-card').forEach(card => {
      const show = filter === 'all' || card.dataset.category === filter;
      card.style.display = show ? '' : 'none';
    });
  });
});
