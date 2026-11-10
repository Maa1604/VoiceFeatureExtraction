// Collect a visual copy of each feature block while preserving the originals.
function initFeatureRail() {
  const originals = [...document.querySelectorAll('.vector-explorer [data-feature-index]')];
  if (originals.length !== 85) return;
  const rail = document.createElement('div');
  rail.className = 'feature-rail';
  rail.setAttribute('aria-label', 'Vector de 85 características recogidas durante el recorrido');
  rail.innerHTML = '<button class="rail-toggle" type="button" aria-expanded="false">Vector <span>0/85</span></button><div class="rail-content"><p class="eyebrow">TU VECTOR</p><strong class="rail-count">0 / 85</strong><p class="rail-description">Baja para recoger; sube para devolver las features.</p><div class="rail-slots"></div><output class="rail-detail" aria-live="polite">85 huecos por completar.</output></div>';
  document.querySelector('.layout').append(rail);
  document.body.classList.add('has-feature-rail');
  const grid = rail.querySelector('.rail-slots');
  const detail = rail.querySelector('.rail-detail');
  const toggle = rail.querySelector('.rail-toggle');
  toggle.addEventListener('click', () => {
    const open = !rail.classList.contains('rail-open');
    rail.classList.toggle('rail-open', open);
    toggle.setAttribute('aria-expanded', String(open));
  });
  const format = value => Number(value).toLocaleString('es-ES', { maximumSignificantDigits: 5 });
  const slots = originals.map((original, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'rail-slot';
    button.dataset.kind = index < 52 ? 'mfcc' : index < 78 ? 'delta' : index < 80 ? 'flux' : 'spectral';
    button.dataset.index = index;
    button.textContent = index;
    button.setAttribute('aria-label', `Posición ${index}: pendiente`);
    button.addEventListener('click', () => {
      detail.textContent = filled.has(index)
        ? `#${index} · ${original.dataset.featureLabel}: ${format(original.dataset.featureValue)}`
        : `#${index} · Aún pendiente. Se recoge al llegar a su cuadro.`;
    });
    button.addEventListener('pointerenter', () => {
      if (filled.has(index)) detail.textContent = `#${index} · ${original.dataset.featureLabel}: ${format(original.dataset.featureValue)}`;
    });
    grid.append(button);
    return button;
  });
  const filled = new Set();
  const flights = new Map();
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  function fill(indices) {
    indices.forEach(index => {
      if (filled.has(index)) return;
      filled.add(index);
      const slot = slots[index], original = originals[index];
      slot.classList.add('filled');
      slot.textContent = Number(original.dataset.featureValue).toLocaleString('es-ES', {
        maximumSignificantDigits: 3
      });
      slot.setAttribute('aria-label', `Posición ${index}: ${original.dataset.featureLabel}, ${format(original.dataset.featureValue)}`);
      slot.title = `#${index} · ${original.dataset.featureLabel}: ${format(original.dataset.featureValue)}`;
    });
    rail.querySelector('.rail-count').textContent = `${filled.size} / 85`;
    toggle.querySelector('span').textContent = `${filled.size}/85`;
    detail.textContent = filled.size === 85 ? 'Vector completo: 85 características recogidas.'
      : `${filled.size} características recogidas · ${85 - filled.size} huecos pendientes.`;
  }
  function empty(indices) {
    indices.forEach(index => {
      filled.delete(index);
      const slot = slots[index];
      slot.classList.remove('filled');
      slot.textContent = index;
      slot.removeAttribute('title');
      slot.setAttribute('aria-label', `Posición ${index}: pendiente`);
    });
    fill([]);
  }
  function cancelFlight(source) {
    const flight = flights.get(source);
    if (!flight) return;
    flights.delete(source);
    flight.ghost.remove();
    flight.animation.cancel();
  }
  function travel(source, indices, collecting) {
    const running = flights.get(source);
    if (running && running.collecting === collecting) return;
    if (running) cancelFlight(source);
    const fresh = indices.filter(index => collecting ? !filled.has(index) : filled.has(index));
    if (!fresh.length) return;
    const target = slots[fresh[Math.floor(fresh.length / 2)]];
    const from = source.getBoundingClientRect(), to = target.getBoundingClientRect();
    const railVisible = rail.querySelector('.rail-content').getBoundingClientRect().width > 0;
    if (!collecting) empty(fresh);
    if (reduceMotion.matches || !railVisible || !source.animate || !to.width
        || from.bottom < 80 || from.top > window.innerHeight) {
      if (collecting) fill(fresh);
      return;
    }
    // A separate visual copy flies; source nodes and their layout stay intact.
    const ghost = document.createElement('div');
    ghost.className = 'feature-flight';
    const colorSource = source.querySelector('.coefficient-cells span') || source;
    const sourceColors = window.getComputedStyle(colorSource);
    ghost.style.backgroundColor = sourceColors.backgroundColor;
    ghost.style.color = sourceColors.color;
    ghost.setAttribute('aria-hidden', 'true');
    ghost.textContent = fresh.length === 1 ? `#${fresh[0]}` : `#${fresh[0]}–${fresh[fresh.length - 1]} · ${fresh.length} valores`;
    Object.assign(ghost.style, { left: `${from.left}px`, top: `${from.top}px`,
      width: `${from.width}px`, height: `${Math.max(28, from.height)}px` });
    document.body.append(ghost);
    const frames = [
      { transform: 'translate(0,0) scale(1)', opacity: .95 },
      { transform: `translate(${to.left - from.left}px,${to.top - from.top}px) scale(${to.width/from.width},${to.height/Math.max(28,from.height)})`, opacity: .65 }
    ];
    const animation = ghost.animate(collecting ? frames : frames.slice().reverse(),
      { duration: 750, easing: 'cubic-bezier(.3,.05,.2,1)', fill: 'forwards' });
    const flight = {animation, ghost, collecting, indices: fresh};
    flights.set(source, flight);
    animation.finished.then(() => {
      if (flights.get(source) !== flight) return;
      flights.delete(source); ghost.remove();
      if (collecting) fill(fresh);
    }, () => {});
  }
  const sources = [];
  document.querySelectorAll('.feature-tiles span, .coefficient-row').forEach(source => {
    const text = source.classList.contains('coefficient-row')
      ? source.querySelector('small').textContent : source.textContent;
    const match = text.match(/#(\d+)(?:[–-](\d+))?/);
    if (!match) return;
    const first = Number(match[1]), last = Number(match[2] || match[1]);
    const indices = Array.from({length: last - first + 1}, (_, i) => first + i);
    if (indices.every(i => i >= 0 && i < 85)) sources.push({ source, indices });
  });
  // Scroll position also handles a restored position or a jump through the menu.
  let scheduled = false;
  function check() {
    scheduled = false;
    const threshold = window.innerHeight * .65;
    const finalMap = document.querySelector('.vector-explorer');
    const complete = finalMap.getBoundingClientRect().top < threshold;
    sources.forEach(({source, indices}) => {
      const box = source.getBoundingClientRect();
      if (complete) {
        cancelFlight(source);
        fill(indices);
      } else {
        travel(source, indices, box.top < threshold);
      }
    });
  }
  window.addEventListener('scroll', () => {
    if (!scheduled) { scheduled = true; requestAnimationFrame(check); }
  }, { passive: true });
  window.addEventListener('resize', check);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) [...flights].forEach(([source, flight]) => {
      cancelFlight(source);
      if (flight.collecting) fill(flight.indices);
    });
  });
  check();
}
initFeatureRail();
