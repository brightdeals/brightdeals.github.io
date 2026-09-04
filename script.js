const menuButton = document.querySelector('.menu-button');
const nav = document.querySelector('nav');
menuButton?.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  menuButton.setAttribute('aria-expanded', String(open));
});
document.querySelector('form')?.addEventListener('submit', (event) => {
  event.preventDefault();
  const button = event.currentTarget.querySelector('button');
  button.textContent = 'You’re on the list ✓';
  button.disabled = true;
});

document.querySelectorAll('.promo-code').forEach((button) => {
  button.addEventListener('click', async () => {
    const code = button.dataset.code;
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
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
