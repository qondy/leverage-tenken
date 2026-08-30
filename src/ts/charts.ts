// ============================================================
// SVG チャート描画（依存なし・自前）
// ============================================================
import { Item, Snapshot } from './types';
import { leverageScore, HIGH_THRESHOLD } from './leverage';

const SVGNS = 'http://www.w3.org/2000/svg';

function el(name: string, attrs: Record<string, string | number>): SVGElement {
  const node = document.createElementNS(SVGNS, name);
  Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, String(v)));
  return node;
}

/**
 * 労力（横）× レバレッジ（縦）の散布マトリクス。
 * viewBox 0 0 320 320、内側プロット領域は 40..300。
 */
export function renderMatrix(items: Item[], onPick: (item: Item) => void): SVGSVGElement {
  const svg = el('svg', {
    viewBox: '0 0 320 320',
    class: 'matrix-svg',
    role: 'img',
    'aria-label': '労力とレバレッジのマトリクス',
  }) as SVGSVGElement;

  const p0 = 40;
  const p1 = 300;
  const span = p1 - p0;
  // 値 1..5 を座標へ。x はそのまま、y は上下反転（大きいほど上）
  const sx = (v: number): number => p0 + ((v - 1) / 4) * span;
  const sy = (v: number): number => p1 - ((v - 1) / 4) * span;
  const mid = p0 + (HIGH_THRESHOLD - 1) / 4 * span;

  // 象限の背景
  //   左上 = 低労力×高レバ = now(go) / 右上 = 高労力×高レバ = build
  //   左下 = 低労力×低レバ = gap     / 右下 = 高労力×低レバ = trim
  svg.append(el('rect', { x: p0, y: p0, width: mid - p0, height: mid - p0, class: 'matrix-cell matrix-cell--go' }));
  svg.append(el('rect', { x: mid, y: p0, width: p1 - mid, height: mid - p0, class: 'matrix-cell matrix-cell--build' }));
  svg.append(el('rect', { x: p0, y: mid, width: mid - p0, height: p1 - mid, class: 'matrix-cell matrix-cell--gap' }));
  svg.append(el('rect', { x: mid, y: mid, width: p1 - mid, height: p1 - mid, class: 'matrix-cell matrix-cell--trim' }));

  // 軸の枠と中央線
  svg.append(el('rect', { x: p0, y: p0, width: span, height: span, class: 'matrix-frame' }));
  svg.append(el('line', { x1: mid, y1: p0, x2: mid, y2: p1, class: 'matrix-guide' }));
  svg.append(el('line', { x1: p0, y1: mid, x2: p1, y2: mid, class: 'matrix-guide' }));

  // 象限ラベル
  const label = (x: number, y: number, text: string): void => {
    const t = el('text', { x, y, class: 'matrix-qlabel' });
    t.textContent = text;
    svg.append(t);
  };
  label((p0 + mid) / 2, p0 + 16, '🚀 今すぐ');
  label((mid + p1) / 2, p0 + 16, '🏗 仕組み化');
  label((p0 + mid) / 2, p1 - 8, '☕ スキマで');
  label((mid + p1) / 2, p1 - 8, '✂️ やめる/任せる');

  // 軸タイトル
  const axX = el('text', { x: (p0 + p1) / 2, y: 316, class: 'matrix-axis' });
  axX.textContent = '労力・時間 →';
  svg.append(axX);
  const axY = el('text', { x: 12, y: (p0 + p1) / 2, class: 'matrix-axis', transform: `rotate(-90 12 ${(p0 + p1) / 2})` });
  axY.textContent = 'レバレッジ →';
  svg.append(axY);

  // プロット（同じ座標が重なるので軽くジッター）
  const active = items.filter((it) => !it.archived);
  active.forEach((it, i) => {
    const jitter = active.length > 1 ? ((i % 5) - 2) * 1.6 : 0;
    const cx = sx(it.effort) + jitter;
    const cy = sy(leverageScore(it.scores)) + jitter;
    const g = el('g', { class: 'matrix-dot', tabindex: 0, role: 'button' }) as SVGGElement;
    g.append(el('circle', { cx, cy, r: 9, class: 'matrix-dot__hit' }));
    g.append(el('circle', { cx, cy, r: 6, class: 'matrix-dot__core' }));
    const title = document.createElementNS(SVGNS, 'title');
    title.textContent = it.title;
    g.append(title);
    g.addEventListener('click', () => onPick(it));
    g.addEventListener('keydown', (ev) => {
      const ke = ev as KeyboardEvent;
      if (ke.key === 'Enter' || ke.key === ' ') { ke.preventDefault(); onPick(it); }
    });
    svg.append(g);
  });

  return svg;
}

/**
 * 週次スナップショットの平均レバレッジ推移（折れ線）。
 * viewBox 0 0 320 180。
 */
export function renderTrend(snaps: Snapshot[]): SVGSVGElement {
  const svg = el('svg', {
    viewBox: '0 0 320 180',
    class: 'trend-svg',
    role: 'img',
    'aria-label': '平均レバレッジスコアの推移',
  }) as SVGSVGElement;

  const left = 30;
  const right = 308;
  const top = 14;
  const bottom = 150;

  // Y軸グリッド（1〜5）
  for (let v = 1; v <= 5; v += 1) {
    const y = bottom - ((v - 1) / 4) * (bottom - top);
    svg.append(el('line', { x1: left, y1: y, x2: right, y2: y, class: 'trend-grid' }));
    const t = el('text', { x: left - 6, y: y + 3, class: 'trend-ytick' });
    t.textContent = String(v);
    svg.append(t);
  }

  const pts = snaps.map((s, i) => {
    const x = snaps.length === 1
      ? (left + right) / 2
      : left + (i / (snaps.length - 1)) * (right - left);
    const y = bottom - ((Math.min(5, Math.max(1, s.avgLeverage)) - 1) / 4) * (bottom - top);
    return { x, y };
  });

  if (pts.length >= 2) {
    const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    svg.append(el('path', { d, class: 'trend-line' }));
  }
  pts.forEach((p) => svg.append(el('circle', { cx: p.x, cy: p.y, r: 3.5, class: 'trend-dot' })));

  return svg;
}
