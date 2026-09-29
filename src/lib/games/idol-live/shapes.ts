import { BufferGeometry, CatmullRomCurve3, Color, Float32BufferAttribute, Uint16BufferAttribute, Vector3 } from 'three';

/** 曲線に沿って平たく細くなる帯（リボンのたれ・ヘッドセットのマイク） */

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
