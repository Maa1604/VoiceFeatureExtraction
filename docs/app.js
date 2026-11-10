const signal = document.querySelector('.signal');
for (let i = 0; i < 85; i++) {
  const bar = document.createElement('i');
  const envelope = Math.sin(Math.PI * i / 84) ** 1.5;
  bar.style.height = `${5 + envelope * (20 + 65 * Math.abs(Math.sin(i * 1.73)))}%`;
  signal.append(bar);
}
const sections = document.querySelectorAll('main section');
document.querySelectorAll('[data-feature-index]').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('[data-feature-index]').forEach(cell => {
      cell.setAttribute('aria-pressed', String(cell === button));
    });
    const value = Number(button.dataset.featureValue).toLocaleString('es-ES', {
      maximumSignificantDigits: 6
    });
    document.querySelector('#feature-detail').textContent =
      `Posición ${button.dataset.featureIndex} · ${button.dataset.featureLabel} · Valor: ${value}`;
  });
});
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      document.querySelectorAll('nav a').forEach(a => {
        a.classList.toggle('active', a.hash === `#${entry.target.id}`);
      });
    });
  }, { rootMargin: '-10% 0px -65% 0px' });
  sections.forEach(section => observer.observe(section));
}
