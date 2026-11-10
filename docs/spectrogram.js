// Interactive view of the measured linear magnitude spectrogram.
async function initSpectrogram() {
  const figure = document.querySelector('#linear-spectrogram');
  if (!figure) return;
  const canvas = figure.querySelector('canvas');
  const readout = figure.querySelector('output');
  const fallback = figure.querySelector('img');
  const hint = 'Pasa el ratón o toca una celda para ver su trama, frecuencia y magnitud.';
  try {
    const response = await fetch('assets/spectrogram-data.json');
    if (!response.ok) throw new Error('Spectrogram data unavailable');
    const data = await response.json();
    const frames = data.magnitudes;
    const columns = frames.length, rows = frames[0].length;
    if (columns !== 35 || rows !== 257 || frames.some(frame => frame.length !== rows)) {
      throw new Error('Unexpected spectrogram dimensions');
    }
    let selected = null;
    let geometry;
    const ctx = canvas.getContext('2d');
    const background = document.createElement('canvas');
    const bg = background.getContext('2d');
    const format = (n, digits = 2) => n.toLocaleString('es-ES', { maximumFractionDigits: digits });
    function redraw() {
      const width = Math.max(240, canvas.getBoundingClientRect().width);
      const height = width < 430 ? 360 : 430;
      const ratio = window.devicePixelRatio || 1;
      canvas.style.height = `${height}px`;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      background.width = canvas.width;
      background.height = canvas.height;
      bg.setTransform(ratio, 0, 0, ratio, 0, 0);
      const left = 66, top = 24, w = width - left - 16, h = height - top - 44;
      geometry = { left, top, w, h, width, height, ratio };
      bg.fillStyle = '#f6f5ef'; bg.fillRect(0, 0, width, height);
      frames.forEach((frame, column) => frame.forEach((m, row) => {
        bg.fillStyle = data.palette[Math.min(255, Math.floor(m / data.maximum * 255))];
        bg.fillRect(left + column * w / columns, top + (rows - row - 1) * h / rows,
          w / columns + .2, h / rows + .2);
      }));
      // Subpixel grid: every row and every column, without replacing the colors.
      bg.strokeStyle = 'rgba(255,255,255,0.22)'; bg.lineWidth = .25;
      bg.beginPath();
      for (let col = 0; col <= columns; col++) {
        const x = left + col * w / columns;
        bg.moveTo(x, top); bg.lineTo(x, top + h);
      }
      for (let row = 0; row <= rows; row++) {
        const y = top + row * h / rows;
        bg.moveTo(left, y); bg.lineTo(left + w, y);
      }
      bg.stroke();
      bg.fillStyle = '#244d40'; bg.font = '11px sans-serif';
      [0, 2000, 4000, 6000, 8000].forEach(hz => {
        const row = hz / (data.sampleRate / data.fftSize);
        const y = top + (rows - row - .5) * h / rows;
        bg.textAlign = 'right'; bg.fillText(String(hz), left - 7, y + 4);
      });
      bg.save();
      bg.translate(12, top + h / 2);
      bg.rotate(-Math.PI / 2);
      bg.textAlign = 'center';
      bg.fillText('Hz', 0, 0);
      bg.restore();
      [0, 8, 17, 26, 34].forEach(col => {
        bg.textAlign = col === 34 ? 'right' : 'left';
        bg.fillText(format(col * data.hopLength / data.sampleRate, 3),
          left + (col + .5) * w / columns, top + h + 18);
      });
      bg.textAlign = 'center'; bg.fillText('Tiempo (s)', left + w / 2, height - 5);
      bg.textAlign = 'left';
      paintSelection();
    }
    function paintSelection() {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(background, 0, 0);
      if (!selected) return;
      const {left, top, w, h, ratio} = geometry;
      const {col, row} = selected;
      const x = left + col * w / columns;
      const y = top + (rows - row - 1) * h / rows;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.fillStyle = 'rgba(255,255,255,.08)';
      ctx.fillRect(x, top, w / columns, h);
      ctx.strokeStyle = '#78e7e4'; ctx.lineWidth = 1;
      ctx.strokeRect(x, top, w / columns, h);
      ctx.beginPath(); ctx.moveTo(left, y + h / rows / 2); ctx.lineTo(left + w, y + h / rows / 2); ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
      ctx.strokeRect(x, y - .5, w / columns, Math.max(2, h / rows));
    }
    function select(col, row) {
      if (selected && selected.col === col && selected.row === row) return;
      selected = {col, row};
      readout.textContent = `Columna ${col + 1}/35 · Trama ${col} · Fila ${row + 1}/257 (k=${row}) · ${format(row * data.sampleRate / data.fftSize)} Hz · t=${format(col * data.hopLength / data.sampleRate, 3)} s · Magnitud ${format(frames[col][row], 6)}`;
      paintSelection();
    }
    function pointer(event) {
      const bounds = canvas.getBoundingClientRect();
      const x = event.clientX - bounds.left, y = event.clientY - bounds.top;
      const {left, top, w, h} = geometry;
      if (x < left || x >= left + w || y < top || y >= top + h) return;
      const col = Math.min(columns - 1, Math.floor((x - left) / w * columns));
      const row = Math.max(0, rows - 1 - Math.floor((y - top) / h * rows));
      select(col, row);
    }
    canvas.addEventListener('pointermove', pointer);
    canvas.addEventListener('pointerdown', pointer);
    canvas.addEventListener('pointerleave', event => {
      if (event.pointerType === 'touch') return;
      selected = null; readout.textContent = hint; paintSelection();
    });
    canvas.addEventListener('keydown', event => {
      if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Escape'].includes(event.key)) return;
      event.preventDefault();
      if (event.key === 'Escape') {
        selected = null; readout.textContent = hint; paintSelection(); return;
      }
      const {col = 0, row = 0} = selected || {};
      select(Math.max(0, Math.min(34, col + (event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0))),
        Math.max(0, Math.min(256, row + (event.key === 'ArrowUp' ? 1 : event.key === 'ArrowDown' ? -1 : 0))));
    });
    fallback.hidden = true; canvas.hidden = false;
    readout.textContent = hint;
    redraw();
    let previousWidth = canvas.getBoundingClientRect().width;
    new ResizeObserver(() => {
      const width = canvas.getBoundingClientRect().width;
      if (width !== previousWidth) { previousWidth = width; redraw(); }
    }).observe(canvas);
  } catch (error) {
    readout.textContent = 'Vista estática del espectrograma. Recarga para volver a intentar la vista interactiva.';
  }
}
initSpectrogram();
