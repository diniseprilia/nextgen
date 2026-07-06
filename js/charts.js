const COLORS = {
  brand: '#C41E3A',
  brandDark: '#9E1830',
  charcoal: '#2D2D2D',
  gold: '#D97706',
  muted: '#94a3b8',
  ringCenter: '#FFFFFF',
};

function setupCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  return { ctx, w: rect.width, h: rect.height };
}

export function drawBarChart(canvas, labels, values, color = COLORS.brand) {
  const { ctx, w, h } = setupCanvas(canvas);
  ctx.clearRect(0, 0, w, h);
  const pad = { t: 20, r: 16, b: 36, l: 40 };
  const chartW = w - pad.l - pad.r;
  const chartH = h - pad.t - pad.b;
  const max = Math.max(...values, 1);

  values.forEach((v, i) => {
    const barW = chartW / values.length * 0.65;
    const gap = chartW / values.length;
    const x = pad.l + i * gap + (gap - barW) / 2;
    const barH = (v / max) * chartH;
    const y = pad.t + chartH - barH;
    const grad = ctx.createLinearGradient(x, y, x, y + barH);
    grad.addColorStop(0, COLORS.gold);
    grad.addColorStop(1, color);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(x, y, barW, barH, 4);
    ctx.fill();
    ctx.fillStyle = COLORS.muted;
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'center';
    const label = labels[i].length > 10 ? labels[i].slice(0, 9) + '…' : labels[i];
    ctx.fillText(label, x + barW / 2, h - 10);
    ctx.fillText(String(v), x + barW / 2, y - 6);
  });
}

export function drawProgressRings(canvas, items) {
  const { ctx, w, h } = setupCanvas(canvas);
  ctx.clearRect(0, 0, w, h);
  const count = items.length || 1;
  const cx = w / (count + 1);

  items.forEach((item, i) => {
    const x = cx * (i + 1);
    const y = h / 2;
    const r = Math.min(50, h / 2 - 24);
    const pct = Math.min(100, Math.max(0, item.value)) / 100;

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(148,163,184,0.2)';
    ctx.lineWidth = 8;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
    ctx.strokeStyle = i % 2 ? COLORS.gold : COLORS.brand;
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.fillStyle = COLORS.ringCenter;
    ctx.font = 'bold 14px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${item.value}%`, x, y);
    ctx.fillStyle = COLORS.muted;
    ctx.font = '10px Inter, sans-serif';
    ctx.fillText(item.label, x, y + r + 16);
  });
}

export function drawLineChart(canvas, labels, values) {
  const { ctx, w, h } = setupCanvas(canvas);
  ctx.clearRect(0, 0, w, h);
  const pad = { t: 20, r: 16, b: 36, l: 40 };
  const chartW = w - pad.l - pad.r;
  const chartH = h - pad.t - pad.b;
  const max = Math.max(...values, 1);
  const step = chartW / Math.max(values.length - 1, 1);

  ctx.strokeStyle = 'rgba(148,163,184,0.15)';
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + (chartH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(pad.l, y);
    ctx.lineTo(w - pad.r, y);
    ctx.stroke();
  }

  ctx.beginPath();
  values.forEach((v, i) => {
    const x = pad.l + i * step;
    const y = pad.t + chartH - (v / max) * chartH;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = COLORS.brand;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  values.forEach((v, i) => {
    const x = pad.l + i * step;
    const y = pad.t + chartH - (v / max) * chartH;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.gold;
    ctx.fill();
    ctx.fillStyle = COLORS.muted;
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(labels[i], x, h - 8);
  });
}
