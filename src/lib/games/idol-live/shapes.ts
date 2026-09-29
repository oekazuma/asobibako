import { BufferGeometry, CatmullRomCurve3, Color, Float32BufferAttribute, Uint16BufferAttribute, Vector3 } from 'three';

/**
 * 形を作る部品。体は立った姿（腕を下ろした姿）で縦に並ぶので、胴も手足も「縦の柱」を輪切りの楕円で作る。
 * 髪は、曲線に沿って平たく細くなる毛束で作る
 */

/** 輪切りの形。y の高さで、横の半径 rx・奥の半径 rz、奥へのずれ dz */
export type Ring = [y: number, rx: number, rz: number, dz?: number];

export interface ColumnOptions {
  /** 柱の中心（x, z） */
  x?: number;
  z?: number;
  sides?: number;
  /** 輪の間隔 */
  step?: number;
  /** 高さ y・向き a（前が 0、右回り）の点の、骨の番号と重さ（合わせて 1） */
  skin?: (y: number, a: number) => [number, number][];
  /** 高さ y・向き a の点の色（服の塗り分け） */
  paint?: (y: number, a: number) => Color;
  /** 上下のふたを閉じる */
  caps?: boolean;
}

const smooth = (u: number) => u * u * (3 - 2 * u);

/** 輪切りの並び（上から下でも下から上でも）を、なめらかにつないだ柱にする */
export function column(rings: Ring[], o: ColumnOptions = {}): BufferGeometry {
  const rs = [...rings].sort((a, b) => a[0] - b[0]);
  const sides = o.sides ?? 24;
  const step = o.step ?? 0.012;
  const at = (y: number): [number, number, number] => {
    let i = 0;
    while (i < rs.length - 2 && y > rs[i + 1][0]) i++;
    const [a, b] = [rs[i], rs[i + 1]];
    const u = smooth(Math.max(0, Math.min(1, (y - a[0]) / (b[0] - a[0]))));
    return [a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u, (a[3] ?? 0) + ((b[3] ?? 0) - (a[3] ?? 0)) * u];
  };
  const y0 = rs[0][0];
  const y1 = rs[rs.length - 1][0];
  const n = Math.max(2, Math.ceil((y1 - y0) / step));
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const bones: number[] = [];
  const weights: number[] = [];
  const cx = o.x ?? 0;
  const cz = o.z ?? 0;
  const push = (x: number, y: number, z: number, a: number) => {
    pos.push(x, y, z);
    if (o.paint) {
      const c = o.paint(y, a);
      col.push(c.r, c.g, c.b);
    }
    if (o.skin) {
      const s = o.skin(y, a).slice(0, 4);
      for (let k = 0; k < 4; k++) {
        bones.push(s[k]?.[0] ?? 0);
        weights.push(s[k]?.[1] ?? 0);
      }
    }
  };
  for (let j = 0; j <= n; j++) {
    const y = y0 + ((y1 - y0) * j) / n;
    const [rx, rz, dz] = at(y);
    for (let i = 0; i <= sides; i++) {
      const a = (i / sides) * Math.PI * 2;
      push(cx + Math.sin(a) * rx, y, cz + dz + Math.cos(a) * rz, a);
    }
  }
  const row = sides + 1;
  for (let j = 0; j < n; j++)
    for (let i = 0; i < sides; i++) {
      const a = j * row + i;
      idx.push(a, a + 1, a + row, a + 1, a + row + 1, a + row);
    }
  if (o.caps)
    for (const [j, y] of [
      [0, y0],
      [n, y1]
    ]) {
      const c = pos.length / 3;
      push(cx, y, cz + at(y)[2], 0);
      for (let i = 0; i < sides; i++) {
        const a = j * row + i;
        if (j === 0) idx.push(c, a + 1, a);
        else idx.push(c, a, a + 1);
      }
    }
  return finish(pos, idx, col, bones, weights);
}

export interface StrandOptions {
  /** 毛束の幅（根元 → 毛先の t で） */
  width: (t: number) => number;
  thick: (t: number) => number;
  /** 毛束の外がわ（面の表）の向き。頭の中心から外へ、など */
  out: (p: Vector3) => Vector3;
  segments?: number;
  sides?: number;
  skin?: (t: number) => [number, number][];
  /** 根元 → 毛先の t での色 */
  paint?: (t: number) => Color;
}

/** 曲線をたどって、平たく細くなる毛束を作る（前髪・横髪・うしろ髪・ツインテール） */
export function strand(points: Vector3[], o: StrandOptions): BufferGeometry {
  const curve = new CatmullRomCurve3(points, false, 'centripetal');
  const segs = o.segments ?? 14;
  const sides = o.sides ?? 8;
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const bones: number[] = [];
  const weights: number[] = [];
  const side = new Vector3();
  const up = new Vector3();
  for (let j = 0; j <= segs; j++) {
    const t = j / segs;
    const p = curve.getPoint(t);
    const tan = curve.getTangent(t);
    side.crossVectors(tan, o.out(p)).normalize();
    up.crossVectors(side, tan).normalize();
    const [w, h] = [o.width(t), o.thick(t)];
    for (let i = 0; i <= sides; i++) {
      const a = (i / sides) * Math.PI * 2;
      pos.push(
        p.x + side.x * Math.cos(a) * w + up.x * Math.sin(a) * h,
        p.y + side.y * Math.cos(a) * w + up.y * Math.sin(a) * h,
        p.z + side.z * Math.cos(a) * w + up.z * Math.sin(a) * h
      );
      if (o.paint) {
        const c = o.paint(t);
        col.push(c.r, c.g, c.b);
      }
      if (o.skin) {
        const s = o.skin(t).slice(0, 4);
        for (let k = 0; k < 4; k++) {
          bones.push(s[k]?.[0] ?? 0);
          weights.push(s[k]?.[1] ?? 0);
        }
      }
    }
  }
  const row = sides + 1;
  for (let j = 0; j < segs; j++)
    for (let i = 0; i < sides; i++) {
      const a = j * row + i;
      idx.push(a, a + row, a + 1, a + 1, a + row, a + row + 1);
    }
  return finish(pos, idx, col, bones, weights);
}

function finish(pos: number[], idx: number[], col: number[], bones: number[], weights: number[]): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  if (col.length) g.setAttribute('color', new Float32BufferAttribute(col, 3));
  if (bones.length) {
    g.setAttribute('skinIndex', new Uint16BufferAttribute(bones, 4));
    g.setAttribute('skinWeight', new Float32BufferAttribute(weights, 4));
  }
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** a と b のあいだを、u の位置で 2 つの骨に重さを分ける（関節のまわり width の幅でなめらかに） */
export function blendBones(a: number, b: number, u: number, width: number): [number, number][] {
  const k = smooth(Math.max(0, Math.min(1, 0.5 + u / width)));
  return [
    [a, 1 - k],
    [b, k]
  ];
}
