import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  Mesh,
  OctahedronGeometry,
  SphereGeometry,
  TorusGeometry,
  Vector3,
  type Material,
  type Object3D
} from 'three';
import { SKIN, type BodyPaint } from './body';
import type { Coord, Theme } from './outfits';
import { CENTER } from './head';
import { Rig, SIZE, sign, type Side } from './rig';
import { strand } from './shapes';
import { outline, toon } from './toon';

/**
 * ステージ衣装。テーマ 4 つ × 部位 4 つ（トップス・ボトムス・シューズ・アクセ）。
 * 体にぴったりの身ごろ・手袋・ブーツは体の皮の塗り分けで、スカート・そで・リボン・宝石は骨に付ける形で作る
 */

interface Style {
  bodice: string;
  /** 身ごろの前の飾り */
  panel: string;
  sleeve: string;
  glove: string;
  skirt: string;
  petticoat: string;
  trim: string;
  gem: string;
  boot: string;
  cuff: string;
}

export const STYLES: Record<Theme, Style> = {
  cute: {
    bodice: '#fff4f9',
    panel: '#ff7ab4',
    sleeve: '#ff8fc0',
    glove: '#ffffff',
    skirt: '#ff8fc0',
    petticoat: '#ffffff',
    trim: '#ff4f93',
    gem: '#ff5fa2',
    boot: '#ff7ab4',
    cuff: '#ffffff'
  },
  cool: {
    bodice: '#34409a',
    panel: '#eef1ff',
    sleeve: '#eef1ff',
    glove: '#1d2250',
    skirt: '#34409a',
    petticoat: '#9fb4ff',
    trim: '#9fb4ff',
    gem: '#6fd6ff',
    boot: '#1d2250',
    cuff: '#9fb4ff'
  },
  pop: {
    bodice: '#ffcf3f',
    panel: '#ffffff',
    sleeve: '#4fd6e8',
    glove: '#ffffff',
    skirt: '#4fd6e8',
    petticoat: '#ffffff',
    trim: '#ff6fa5',
    gem: '#ff8a3d',
    boot: '#ffffff',
    cuff: '#4fd6e8'
  },
  elegant: {
    bodice: '#c9aaff',
    panel: '#fff7ff',
    sleeve: '#fff7ff',
    glove: '#fff7ff',
    skirt: '#c9aaff',
    petticoat: '#fff7ff',
    trim: '#f0cf78',
    gem: '#b06cff',
    boot: '#b89cff',
    cuff: '#fff7ff'
  }
};

const lin = (hex: string) => new Color(hex);
const darker = (hex: string, k = 0.55) => '#' + new Color(hex).multiplyScalar(k).getHexString();
const skin = lin(SKIN);

/** 体の皮の塗り分け（身ごろ・手袋・ブーツ） */
export function bodyPaint(c: Coord): BodyPaint {
  const top = STYLES[c.top];
  const shoes = STYLES[c.shoes];
  const [bodice, panel, trim, glove] = [lin(top.bodice), lin(top.panel), lin(top.trim), lin(top.glove)];
  const lace = lin('#ffffff');
  const boot = lin(shoes.boot);
  const cuff = lin(shoes.cuff);
  const shoulder = SIZE.hips + SIZE.spine + SIZE.chest + SIZE.shoulder.y;
  return {
    torso: (y, a) => {
      const neck = 1.195 + 0.035 * (1 - Math.cos(a)) * 0.5;
      if (y > neck) return skin;
      if (y > neck - 0.014) return lace;
      if (y < 1.0 && y > 0.965) return trim;
      if (Math.abs(Math.sin(a)) < 0.16 && Math.cos(a) > 0 && y < neck - 0.02) return panel;
      return bodice;
    },
    arm: (y) => {
      const top = shoulder - 0.2;
      if (y > top || c.top === 'pop') return skin;
      return y > top - 0.012 ? trim : glove;
    },
    leg: (y) => {
      if (c.shoes === 'elegant') return y < 0.07 ? boot : skin.clone().lerp(lin('#e7d8ff'), 0.45);
      if (c.shoes === 'pop') return y < 0.1 ? lace : skin;
      const top = c.shoes === 'cool' ? 0.58 : 0.45;
      if (y > top) return skin;
      return y > top - 0.03 ? cuff : boot;
    }
  };
}

type Mat = { fill: Material; line: Material };
const mats = new Map<string, Mat>();
function mat(color: string, o: { gloss?: number; opacity?: number } = {}): Mat {
  const key = `${color}:${o.gloss ?? 0}:${o.opacity ?? 1}`;
  let m = mats.get(key);
  if (!m) {
    m = { fill: toon({ color, shade: '#c6a4cf', gloss: o.gloss, opacity: o.opacity }), line: outline(darker(color, 0.6), 0.0015) };
    mats.set(key, m);
  }
  return m;
}

function solid(g: BufferGeometry, color: string, o: { gloss?: number; opacity?: number; line?: boolean } = {}): Group {
  const m = mat(color, o);
  const grp = new Group();
  grp.add(new Mesh(g, m.fill));
  if (o.line !== false) grp.add(new Mesh(g, m.line));
  return grp;
}

/**
 * 裾の広がった筒（スカート・袖口のフリル）。y0 から下へ len、半径 r0 → r1。裾は lobes 個の波で、sharp なら山がとがる（プリーツ）。
 * bulge は途中のふくらみ（バルーン）
 */
function flare(o: { y0: number; len: number; r0: number; r1: number; lobes: number; amp: number; sharp?: boolean; bulge?: number; depth?: number }): BufferGeometry {
  const sides = Math.max(48, o.lobes * 6);
  const rows = 12;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let j = 0; j <= rows; j++) {
    const u = j / rows;
    for (let i = 0; i <= sides; i++) {
      const a = (i / sides) * Math.PI * 2;
      const w = o.sharp ? 1 - 2 * Math.abs(((a * o.lobes) / (Math.PI * 2)) % 1 - 0.5) : 0.5 + 0.5 * Math.cos(a * o.lobes);
      const r = o.r0 + (o.r1 - o.r0) * u ** 0.8 + (o.bulge ?? 0) * Math.sin(Math.PI * u) + (o.sharp ? w * 0.012 * u : 0);
      const y = o.y0 - o.len * u + (u === 1 ? -o.amp * w : u > 0.85 ? -o.amp * w * ((u - 0.85) / 0.15) : 0);
      pos.push(Math.sin(a) * r, y, Math.cos(a) * r * (o.depth ?? 0.85));
    }
  }
  const row = sides + 1;
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < sides; i++) {
      const a = j * row + i;
      idx.push(a, a + row, a + 1, a + 1, a + row, a + row + 1);
    }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** リボン。平たくふくらんだ 2 つの輪（先が外へ広がる）と結び目と、垂れる 2 本 */
function bow(color: string, size: number, tails = 1): Group {
  const g = new Group();
  const loop = new SphereGeometry(1, 16, 12);
  // 輪は、結び目のそばを細く、外ほど大きくふくらませる
  const pos = loop.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const k = 0.45 + 0.55 * ((x + 1) / 2);
    pos.setXYZ(i, x, pos.getY(i) * k, pos.getZ(i) * k);
  }
  loop.computeVertexNormals();
  for (const s of [-1, 1]) {
    const m = solid(loop, color);
    m.scale.set(size * 0.55, size * 0.42, size * 0.16);
    m.position.set(s * size * 0.55, size * 0.06, 0);
    m.rotation.set(0, s > 0 ? 0 : Math.PI, s * 0.3);
    g.add(m);
    if (tails > 0) {
      const t = solid(
        strand(
          [new Vector3(0, 0, 0.004), new Vector3(s * size * 0.3, -size * 0.6 * tails, 0.01), new Vector3(s * size * 0.45, -size * 1.3 * tails, 0)],
          { width: (u) => size * 0.22 * (1 - u * 0.2), thick: () => size * 0.05, out: () => new Vector3(0, 0, 1), segments: 6, sides: 4 }
        ),
        color
      );
      g.add(t);
    }
  }
  const knot = solid(new SphereGeometry(1, 12, 10), color);
  knot.scale.set(size * 0.22, size * 0.26, size * 0.2);
  knot.position.z = size * 0.04;
  g.add(knot);
  return g;
}

function gem(color: string, size: number): Group {
  const m = solid(new OctahedronGeometry(1, 0), color, { gloss: 1 });
  m.scale.set(size, size * 1.25, size * 0.6);
  return m;
}

export class Outfit {
  readonly #rig: Rig;
  #parts: Object3D[] = [];

  constructor(rig: Rig) {
    this.#rig = rig;
  }

  /** 衣装を着せかえる（体の塗り分けは Body.paint で別に当てる） */
  wear(c: Coord): void {
    for (const p of this.#parts) p.removeFromParent();
    this.#parts = [];
    const b = this.#rig.bones;
    const attach = (bone: Object3D, o: Object3D) => {
      bone.add(o);
      this.#parts.push(o);
      return o;
    };
    const top = STYLES[c.top];
    // 胸のリボンと宝石、首のチョーカー
    const chestBow = attach(b.chest, bow(top.trim, 0.05, 0.8));
    chestBow.position.set(0, 0.085, 0.085);
    attach(b.chest, gem(top.gem, 0.013)).position.set(0, 0.083, 0.1);
    const choker = attach(b.neck, solid(new TorusGeometry(0.036, 0.006, 6, 24), top.trim));
    choker.rotation.x = Math.PI / 2;
    choker.position.set(0, 0.03, 0.003);
    attach(b.neck, gem(top.gem, 0.007)).position.set(0, 0.022, 0.042);
    for (const s of ['L', 'R'] as const) {
      // ふくらんだ袖（上腕の付け根）と、手袋のフリル
      const puff = attach(b[`upper${s}`], solid(new SphereGeometry(1, 16, 12), top.sleeve));
      puff.scale.set(0.052, 0.058, 0.05);
      puff.position.set(0, -0.035, 0);
      const band = attach(b[`upper${s}`], solid(flare({ y0: 0, len: 0.02, r0: 0.036, r1: 0.05, lobes: 10, amp: 0.006 }), '#ffffff'));
      band.position.set(0, -0.07, 0);
      if (c.top !== 'pop') {
        // 手袋はひじの少し上まで。口のフリルは上へ開く
        const cuff = attach(b[`upper${s}`], solid(flare({ y0: 0, len: 0.028, r0: 0.038, r1: 0.025, lobes: 9, amp: -0.006 }), top.glove === '#ffffff' ? top.trim : '#ffffff'));
        cuff.position.set(0, -0.186, 0);
      }
      this.#shoe(c.shoes, s, attach);
      this.#tie(c.acc, s, attach);
    }
    this.#skirt(c.bottom, attach);
    this.#head(c.acc, attach);
  }

  #skirt(t: Theme, attach: (b: Object3D, o: Object3D) => Object3D) {
    const st = STYLES[t];
    const hips = this.#rig.bones.hips;
    // 腰の骨から見た腰まわりの高さ（ウエストが 0.1、すそが -0.2 ほど）
    const layers: [BufferGeometry, string][] = [];
    if (t === 'cute') {
      layers.push([flare({ y0: 0.07, len: 0.33, r0: 0.118, r1: 0.3, lobes: 16, amp: 0.02 }), st.petticoat]);
      layers.push([flare({ y0: 0.1, len: 0.26, r0: 0.115, r1: 0.27, lobes: 12, amp: 0.025 }), st.skirt]);
      layers.push([flare({ y0: 0.1, len: 0.15, r0: 0.115, r1: 0.2, lobes: 10, amp: 0.02 }), st.bodice]);
    } else if (t === 'cool') {
      layers.push([flare({ y0: 0.07, len: 0.3, r0: 0.118, r1: 0.26, lobes: 18, amp: 0.01 }), st.petticoat]);
      layers.push([flare({ y0: 0.1, len: 0.28, r0: 0.115, r1: 0.25, lobes: 20, amp: 0.012, sharp: true }), st.skirt]);
    } else if (t === 'pop') {
      layers.push([flare({ y0: 0.07, len: 0.3, r0: 0.118, r1: 0.24, lobes: 14, amp: 0.02 }), st.petticoat]);
      layers.push([flare({ y0: 0.1, len: 0.28, r0: 0.115, r1: 0.19, lobes: 12, amp: 0.012, bulge: 0.07 }), st.skirt]);
    } else {
      layers.push([flare({ y0: 0.1, len: 0.62, r0: 0.118, r1: 0.36, lobes: 14, amp: 0.03 }), st.petticoat]);
      layers.push([flare({ y0: 0.1, len: 0.52, r0: 0.115, r1: 0.31, lobes: 9, amp: 0.05 }), st.skirt]);
    }
    for (const [g, color] of layers) attach(hips, solid(g, color, { opacity: t === 'elegant' && color === st.petticoat ? 0.85 : 1 }));
    // うしろの大きなリボン
    const back = attach(hips, bow(st.trim, t === 'elegant' ? 0.08 : 0.07, 2.2));
    back.position.set(0, 0.1, -0.1);
    back.rotation.y = Math.PI;
    attach(hips, gem(st.gem, 0.012)).position.set(0, 0.1, 0.1);
  }

  #shoe(t: Theme, s: Side, attach: (b: Object3D, o: Object3D) => Object3D) {
    const st = STYLES[t];
    const foot = this.#rig.bones[`foot${s}`];
    const toe = attach(foot, solid(new SphereGeometry(1, 16, 12), st.boot));
    toe.scale.set(0.032, 0.03, 0.075);
    toe.position.set(0, -0.022, 0.035);
    if (t === 'pop') {
      const sole = attach(foot, solid(new SphereGeometry(1, 16, 8), st.cuff));
      sole.scale.set(0.035, 0.012, 0.08);
      sole.position.set(0, -0.045, 0.035);
    } else {
      const heel = attach(foot, solid(new SphereGeometry(1, 10, 8), darker(st.boot, 0.7)));
      heel.scale.set(0.014, 0.03, 0.014);
      heel.position.set(0, -0.035, -0.03);
    }
    if (t !== 'elegant' && t !== 'pop') {
      // ブーツの口はひざより上なので、太ももの骨に付ける（股の付け根からの高さで置く）
      const thigh = this.#rig.bones[`thigh${s}`];
      const y = (t === 'cool' ? 0.58 : 0.45) - (SIZE.hips + SIZE.hip.y);
      const cuff = attach(thigh, solid(flare({ y0: 0, len: 0.025, r0: 0.05, r1: 0.058, lobes: 10, amp: 0.006 }), st.cuff));
      cuff.position.set(0, y + 0.005, 0);
      attach(thigh, bow(st.trim, 0.022, 0.5)).position.set(0, y - 0.01, 0.05);
    }
  }

  #tie(t: Theme, s: Side, attach: (b: Object3D, o: Object3D) => Object3D) {
    const st = STYLES[t];
    const k = sign(s);
    const head = this.#rig.bones.head;
    const at = SIZE.tailRoot.clone().multiply(new Vector3(k, 1, 1));
    if (t === 'cute') {
      const r = attach(head, bow(st.trim, 0.055, 1));
      r.position.copy(at).add(new Vector3(k * 0.01, 0.015, 0.01));
      r.rotation.set(0, k * 0.5, k * 0.2);
    } else {
      const ring = attach(head, solid(new TorusGeometry(0.03, 0.012, 8, 20), t === 'pop' ? st.skirt : st.trim));
      ring.position.copy(at);
      ring.rotation.set(Math.PI / 2, 0, k * 0.5);
      if (t === 'elegant') attach(head, gem(st.gem, 0.01)).position.copy(at).add(new Vector3(0, 0.005, 0.03));
    }
  }

  #head(t: Theme, attach: (b: Object3D, o: Object3D) => Object3D) {
    const st = STYLES[t];
    const head = this.#rig.bones.head;
    const c = CENTER;
    if (t === 'cool') {
      // ヘッドセット。耳当てとマイク
      const ear = attach(head, solid(new SphereGeometry(1, 14, 10), '#3a3f55'));
      ear.scale.set(0.012, 0.024, 0.022);
      ear.position.set(-0.098, c.y - 0.01, 0.0);
      const mic = attach(
        head,
        solid(
          strand([new Vector3(-0.1, c.y - 0.02, 0.01), new Vector3(-0.085, c.y - 0.06, 0.06), new Vector3(-0.04, c.y - 0.07, 0.09)], {
            width: () => 0.003,
            thick: () => 0.003,
            out: () => new Vector3(1, 0, 0),
            segments: 8,
            sides: 5
          }),
          '#3a3f55',
          { line: false }
        )
      );
      void mic;
      attach(head, gem(st.gem, 0.006)).position.set(-0.04, c.y - 0.07, 0.092);
    } else if (t === 'pop') {
      for (const [x, y, z, r] of [
        [-0.07, c.y + 0.07, 0.06, 0.016],
        [-0.045, c.y + 0.095, 0.045, 0.011]
      ])
        attach(head, gem(st.bodice, r)).position.set(x, y, z);
    } else if (t === 'elegant') {
      const tiara = attach(head, solid(new TorusGeometry(0.075, 0.006, 6, 32, Math.PI), st.trim, { gloss: 1 }));
      tiara.position.set(0, c.y + 0.07, 0.02);
      tiara.rotation.set(-0.5, 0, 0);
      attach(head, gem(st.gem, 0.014)).position.set(0, c.y + 0.12, 0.05);
      for (const s of [-1, 1]) attach(head, gem('#8ec9ff', 0.008)).position.set(s * 0.04, c.y + 0.11, 0.045);
    } else {
      const r = attach(head, bow(st.trim, 0.03, 0.4));
      r.position.set(0.06, c.y + 0.085, 0.06);
      r.rotation.set(-0.3, 0.4, -0.3);
    }
  }
}
