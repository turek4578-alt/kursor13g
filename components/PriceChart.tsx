'use client';

export default function PriceChart({ points, color = '#00d96b' }: { points: [number, number][]; color?: string }) {
  if (points.length < 2) {
    return (
      <div style={{ height: 180, display: 'grid', placeItems: 'center', color: '#7c8b84', fontSize: 13 }}>
        Недостаточно данных для графика
      </div>
    );
  }

  const W = 320;
  const H = 160;
  const PAD = 6;

  const prices = points.map((p) => p[1]);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;

  const coords = points.map(([t, price], i) => {
    const x = (i / (points.length - 1)) * (W - PAD * 2) + PAD;
    const y = H - PAD - ((price - min) / range) * (H - PAD * 2);
    return [x, y];
  });

  const linePath = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${coords[coords.length - 1][0].toFixed(1)},${H} L${coords[0][0].toFixed(1)},${H} Z`;

  const up = prices[prices.length - 1] >= prices[0];
  const lineColor = up ? color : '#ff6b6b';

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none">
      <defs>
        <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={lineColor} stopOpacity="0.25" />
          <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#chartFill)" />
      <path d={linePath} fill="none" stroke={lineColor} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
