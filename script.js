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
