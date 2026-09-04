const menuButton = document.querySelector('.menu-button');
const nav = document.querySelector('nav');
menuButton?.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  menuButton.setAttribute('aria-expanded', String(open));
});
const signupForm = document.querySelector('.newsletter form');
signupForm?.addEventListener('submit', () => {
  const button = signupForm.querySelector('button');
  const status = document.querySelector('.form-status');
  const originalLabel = 'Send me deals →';
  button.disabled = true;
  button.textContent = 'Check your inbox…';
  if (status) status.textContent = 'Almost there — check your inbox to confirm your subscription.';
  window.setTimeout(() => {
    button.disabled = false;
    button.textContent = originalLabel;
  }, 2500);
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
