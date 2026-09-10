const menuButton = document.querySelector('.menu-button');
const nav = document.querySelector('nav');
if (nav && !nav.querySelector('[data-guide-link]')) {
  const guideLink = document.createElement('a');
  guideLink.href = 'cordless-vacuum-edit.html';
  guideLink.dataset.guideLink = 'true';
  guideLink.textContent = 'The Edit';
  nav.appendChild(guideLink);
}
menuButton?.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  menuButton.setAttribute('aria-expanded', String(open));
});
document.querySelectorAll('.brevo-signup').forEach((signupForm) => {
  signupForm.addEventListener('submit', () => {
    const button = signupForm.querySelector('button');
    const status = signupForm.parentElement.querySelector('.form-status');
    const originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = 'Check your inbox…';
    if (status) status.textContent = signupForm.dataset.confirmation;
    window.setTimeout(() => {
      button.disabled = false;
      button.textContent = originalLabel;
    }, 2500);
  });
});

document.querySelectorAll('.promo-code').forEach((button) => {
  button.addEventListener('click', async () => {
    const code = button.dataset.code;
    if (!code) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        const helper = document.createElement('textarea');
        helper.value = code;
        helper.setAttribute('readonly', '');
        helper.style.position = 'fixed';
        helper.style.opacity = '0';
        document.body.appendChild(helper);
        helper.select();
        const copied = document.execCommand('copy');
        helper.remove();
        if (!copied) throw new Error('Copy unavailable');
      }
      const label = button.querySelector('span');
      button.classList.add('copied');
      if (label) label.textContent = 'Copied ✓';
      setTimeout(() => {
        button.classList.remove('copied');
        if (label) label.textContent = 'Copy';
      }, 1800);
    } catch {
      window.prompt('Copy this promo code:', code);
    }
  });
});

const slugify = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const detailModal = document.createElement('div');
detailModal.className = 'deal-modal';
detailModal.hidden = true;
detailModal.innerHTML = `
  <div class="deal-modal-backdrop" data-close-detail></div>
  <section class="deal-modal-card" role="dialog" aria-modal="true" aria-labelledby="deal-modal-title" tabindex="-1">
    <button class="deal-modal-close" type="button" aria-label="Close product details" data-close-detail>&times;</button>
    <div class="deal-modal-visual"><img alt=""></div>
    <div class="deal-modal-content">
      <p class="deal-modal-category"></p>
      <h2 id="deal-modal-title"></h2>
      <div class="deal-modal-price"></div>
      <p class="deal-modal-detail"></p>
      <p class="deal-modal-promo" hidden></p>
      <a class="deal-modal-cta" target="_blank" rel="sponsored noopener">Get deal <span aria-hidden="true">↗</span></a>
      <small>Prices and availability can change on Amazon.</small>
    </div>
  </section>`;
document.body.appendChild(detailModal);

let lastFocusedElement;
const modalCard = detailModal.querySelector('.deal-modal-card');
const modalImage = detailModal.querySelector('.deal-modal-visual img');
const modalCategory = detailModal.querySelector('.deal-modal-category');
const modalTitle = detailModal.querySelector('#deal-modal-title');
const modalPrice = detailModal.querySelector('.deal-modal-price');
const modalDetail = detailModal.querySelector('.deal-modal-detail');
const modalPromo = detailModal.querySelector('.deal-modal-promo');
const modalCta = detailModal.querySelector('.deal-modal-cta');

const closeDealDetails = () => {
  if (detailModal.hidden) return;
  detailModal.hidden = true;
  document.body.classList.remove('modal-open');
  lastFocusedElement?.focus();
};

const openDealDetails = (card) => {
  const image = card.querySelector('.product-visual img');
  const category = card.querySelector('.product-category');
  const title = card.querySelector('h3');
  const price = card.querySelector('.final-price');
  const detail = card.querySelector('.product-detail');
  const promo = card.querySelector('.promo-code');
  const link = card.querySelector('.product-info a[href]');
  if (!title || !link) return;

  lastFocusedElement = document.activeElement;
  modalImage.src = image?.currentSrc || image?.src || '';
  modalImage.alt = image?.alt || title.textContent.trim();
  modalCategory.textContent = category?.textContent.trim() || 'BrightDeals pick';
  modalTitle.textContent = title.textContent.trim();
  modalPrice.innerHTML = price?.innerHTML || '';
  modalDetail.textContent = detail?.textContent.trim() || 'See the latest product details and availability on Amazon.';
  const code = promo?.dataset.code;
  modalPromo.hidden = !code;
  modalPromo.textContent = code ? `Promo code: ${code}` : '';
  modalCta.href = link.href;
  detailModal.hidden = false;
  document.body.classList.add('modal-open');
  modalCard.focus();
};

detailModal.addEventListener('click', (event) => {
  if (event.target.closest('[data-close-detail]')) closeDealDetails();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeDealDetails();
});

document.querySelectorAll('.product-card').forEach((card) => {
  const title = card.querySelector('h3')?.textContent.trim();
  if (!title) return;
  card.tabIndex = 0;
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', `View details for ${title}`);
  card.addEventListener('click', (event) => {
    if (event.target.closest('a, button, input, textarea, select, label')) return;
    openDealDetails(card);
  });
  card.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    openDealDetails(card);
  });
});

const requestedDeal = new URLSearchParams(window.location.search).get('deal');
if (requestedDeal) {
  const dealCard = [...document.querySelectorAll('.product-card')].find((card) =>
    slugify(card.querySelector('h3')?.textContent || '') === requestedDeal
  );
  if (dealCard) {
    window.requestAnimationFrame(() => openDealDetails(dealCard));
  }
}
