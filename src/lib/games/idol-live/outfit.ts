import type { VRM } from '@pixiv/three-vrm';
import {
  CanvasTexture,
  Color,
  Group,
  Mesh,
  OctahedronGeometry,
  SphereGeometry,
  TorusGeometry,
  Vector3,
  type BufferGeometry,
  type Material,
  type Object3D,
  type Texture
} from 'three';
import type { Coord, Slot, Theme } from './outfits';
import { strand } from './shapes';
import { outline, toon } from './toon';

/**
 * 衣装。モデルの服（上・下・靴・首のリボン）の絵を、明るさはそのままにテーマの色へ塗りかえる（ひだや影の描きこみは残る）。
 * 髪飾りはテーマごとの形を頭の骨に付ける
 */

interface Style {
  /** 暗いところ → 明るいところの色 */
  dark: string;
  light: string;
  /** 髪飾りの色 */
  trim: string;
  gem: string;
}

export const STYLES: Record<Theme, Style> = {
  cute: { dark: '#b8336f', light: '#fff0f6', trim: '#ff4f93', gem: '#ff5fa2' },
  cool: { dark: '#141b4d', light: '#e8eeff', trim: '#6f8cff', gem: '#6fd6ff' },
  pop: { dark: '#1f86c9', light: '#fff9d6', trim: '#ffb000', gem: '#ff8a3d' },
  elegant: { dark: '#4b2a8a', light: '#fbf6ff', trim: '#e0b85a', gem: '#b06cff' }
};

/** モデルの材質の名前と、どの部位の服か */
const PARTS: [RegExp, Slot][] = [
  [/Tops/, 'top'],
  [/Bottoms/, 'bottom'],
  [/Shoes/, 'shoes'],
  [/AccessoryNeck/, 'acc']
];

type Textured = Material & { map: Texture | null };
type Picture = CanvasImageSource & { width: number; height: number };

export class Outfit {
  readonly #vrm: VRM;
  /** 塗りかえる材質と、もとの絵 */
  readonly #parts: { mat: Textured; slot: Slot; image: Picture; like: Texture }[] = [];
  readonly #painted = new Map<string, CanvasTexture>();
  #acc: Object3D[] = [];

  constructor(vrm: VRM) {
    this.#vrm = vrm;
    const seen = new Set<Material>();
    vrm.scene.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      for (const mat of ([] as Material[]).concat(o.material)) {
        if (seen.has(mat)) continue;
        seen.add(mat);
        const slot = PARTS.find(([re]) => re.test(mat.name))?.[1];
        // 塗りかえる前の絵を覚えておく（塗りかえた絵をまた塗りかえない）
        const map = (mat.userData.base ??= (mat as Textured).map) as Texture | null;
        if (slot && map?.image)
          this.#parts.push({ mat: mat as Textured, slot, image: map.image as Picture, like: map });
      }
    });
  }

  wear(c: Coord): void {
    for (const p of this.#parts) {
      const key = `${p.mat.name}:${c[p.slot]}`;
      let tex = this.#painted.get(key);
      if (!tex) {
        tex = recolor(p.image, STYLES[c[p.slot]], p.like);
        this.#painted.set(key, tex);
      }
      p.mat.map = tex;
      p.mat.needsUpdate = true;
    }
    for (const o of this.#acc) o.removeFromParent();
    this.#acc = [];
    const head = this.#vrm.humanoid.getRawBoneNode('head');
    if (head) this.#hair(c.acc, head);
  }

  #hair(t: Theme, head: Object3D) {
    const st = STYLES[t];
    const add = (o: Object3D, x: number, y: number, z: number) => {
      // モデルは -z を向いて作られているので、頭の骨の中では前が -z（x も左右が逆）
      const holder = new Group();
      holder.rotation.y = Math.PI;
      holder.position.set(-x, y, -z);
      holder.add(o);
      head.add(holder);
      this.#acc.push(holder);
      return o;
    };
    if (t === 'cute') {
      add(bow(st.trim, 0.06, 1), 0.075, 0.17, -0.02).rotation.z = 0.3;
    } else if (t === 'cool') {
      add(solid(new SphereGeometry(1, 14, 10), '#3a3f55'), 0.085, 0.06, 0).scale.set(0.014, 0.028, 0.026);
      add(
        solid(
          strand([new Vector3(0, 0, 0), new Vector3(-0.012, -0.04, 0.05), new Vector3(-0.05, -0.05, 0.085)], {
            width: () => 0.003,
            thick: () => 0.003,
            out: () => new Vector3(1, 0, 0),
            segments: 8,
            sides: 5
          }),
          '#3a3f55',
          false
        ),
        0.088,
        0.05,
        0.01
      );
      add(gem(st.gem, 0.006), 0.04, 0.0, 0.1);
    } else if (t === 'pop') {
      add(gem(st.trim, 0.018), 0.07, 0.16, 0.06);
      add(gem(st.gem, 0.012), 0.045, 0.19, 0.05);
    } else {
      add(solid(new TorusGeometry(0.085, 0.006, 6, 32, Math.PI), st.trim, true, 1), 0, 0.17, 0.01).rotation.x = -0.45;
      add(gem(st.gem, 0.014), 0, 0.225, 0.06);
      for (const s of [-1, 1]) add(gem('#8ec9ff', 0.008), s * 0.045, 0.21, 0.055);
    }
  }
}

/** 絵の明るさで、テーマの暗い色 → 明るい色へ塗りかえる */
function recolor(image: Picture, st: Style, like: Texture): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = image.width;
  c.height = image.height;
  const x = c.getContext('2d', { willReadFrequently: true })!;
  x.drawImage(image, 0, 0);
  const img = x.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  const [a, b] = [new Color(st.dark), new Color(st.light)];
  const lut = Array.from({ length: 256 }, (_, i) => {
    const u = (i / 255) ** 0.85;
    return [a.r + (b.r - a.r) * u, a.g + (b.g - a.g) * u, a.b + (b.b - a.b) * u].map((v) => Math.round(v * 255));
  });
  for (let i = 0; i < d.length; i += 4) {
    const [r, g, bl] = lut[Math.round(0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2])];
    [d[i], d[i + 1], d[i + 2]] = [r, g, bl];
  }
  x.putImageData(img, 0, 0);
  const t = new CanvasTexture(c);
  t.colorSpace = like.colorSpace;
  t.flipY = like.flipY;
  t.wrapS = like.wrapS;
  t.wrapT = like.wrapT;
  return t;
}

function solid(g: BufferGeometry, color: string, line = true, gloss = 0): Group {
  const grp = new Group();
  grp.add(new Mesh(g, toon({ color, shade: '#c6a4cf', gloss })));
  if (line) grp.add(new Mesh(g, outline('#' + new Color(color).multiplyScalar(0.55).getHexString(), 0.0015)));
  return grp;
}

/** リボン。平たくふくらんだ 2 つの輪（先が外へ広がる）と結び目と、垂れる 2 本 */
function bow(color: string, size: number, tails = 1): Group {
  const g = new Group();
  const loop = new SphereGeometry(1, 16, 12);
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
    if (tails > 0)
      g.add(
        solid(
          strand(
            [
              new Vector3(0, 0, 0.004),
              new Vector3(s * size * 0.3, -size * 0.6 * tails, 0.01),
              new Vector3(s * size * 0.45, -size * 1.3 * tails, 0)
            ],
            {
              width: (u) => size * 0.22 * (1 - u * 0.2),
              thick: () => size * 0.05,
              out: () => new Vector3(0, 0, 1),
              segments: 6,
              sides: 4
            }
          ),
          color
        )
      );
  }
  const knot = solid(new SphereGeometry(1, 12, 10), color);
  knot.scale.set(size * 0.22, size * 0.26, size * 0.2);
  knot.position.z = size * 0.04;
  g.add(knot);
  return g;
}

function gem(color: string, size: number): Group {
  const m = solid(new OctahedronGeometry(1, 0), color, true, 1);
  m.scale.set(size, size * 1.25, size * 0.6);
  return m;
}
