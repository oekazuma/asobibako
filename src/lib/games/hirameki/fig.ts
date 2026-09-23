import { ICONS, type IconName } from '$lib/icons';
import type { Shape } from './types';

type Attrs = Record<string, string | number>;

/** 図のふち線。共通の画面のこげ茶に合わせる */
export const LINE = '#5b4a42';

const outline = { stroke: LINE, 'stroke-width': 2, 'stroke-linejoin': 'round' };

export const rect = (x: number, y: number, w: number, h: number, fill = '#fff', a: Attrs = {}): Shape => ({
  el: 'rect',
  a: { x, y, width: w, height: h, fill, ...outline, ...a }
});

export const circle = (cx: number, cy: number, r: number, fill = '#fff', a: Attrs = {}): Shape => ({
  el: 'circle',
  a: { cx, cy, r, fill, ...outline, ...a }
});

export const ellipse = (cx: number, cy: number, rx: number, ry: number, fill = '#fff', a: Attrs = {}): Shape => ({
  el: 'ellipse',
  a: { cx, cy, rx, ry, fill, ...outline, ...a }
});

export const line = (x1: number, y1: number, x2: number, y2: number, a: Attrs = {}): Shape => ({
  el: 'line',
  a: { x1, y1, x2, y2, stroke: LINE, 'stroke-width': 2, 'stroke-linecap': 'round', ...a }
});

export const poly = (points: [number, number][], fill = '#fff', a: Attrs = {}): Shape => ({
  el: 'polygon',
  a: { points: points.map((p) => p.join(',')).join(' '), fill, ...outline, ...a }
});

export const path = (d: string, fill = '#fff', a: Attrs = {}): Shape => ({
  el: 'path',
  a: { d, fill, ...outline, ...a }
});

/** (x, y) を真ん中にした太字 */
export const text = (x: number, y: number, t: string, size = 14, a: Attrs = {}): Shape => ({
  el: 'text',
  a: {
    x,
    y,
    'font-size': size,
    'font-weight': 800,
    'text-anchor': 'middle',
    'dominant-baseline': 'central',
    fill: LINE,
    ...a
  },
  t
});

export const g = (transform: string, ...c: Shape[]): Shape => ({ el: 'g', a: { transform }, c });

/** $lib/icons のアイコンを (cx, cy) を真ん中に size の大きさで置く */
export const icon = (name: IconName, cx: number, cy: number, size: number): Shape =>
  g(
    `translate(${cx - size / 2} ${cy - size / 2}) scale(${size / 24})`,
    ...ICONS[name].map((layer): Shape => ({
      el: 'path',
      a: {
        d: layer.d,
        fill: 'fill' in layer ? (layer.fill ?? 'none') : 'none',
        stroke: 'stroke' in layer ? (layer.stroke ?? 'none') : 'none',
        'stroke-width': 'width' in layer ? (layer.width ?? 0) : 0,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round'
      }
    }))
  );
