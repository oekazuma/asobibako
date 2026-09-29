import { CanvasTexture, Group, Mesh, SphereGeometry, SRGBColorSpace, Vector3 } from 'three';
import { drawFace, EYE, FACE_H, FACE_PX, FACE_W, faceKey, SKIN, type FaceState } from './face-draw';
import { glint, outline, toon } from './toon';

/**
 * 頭（頭の骨の子）。丸い頭、細いあご、少しふっくらしたほお、平らな顔の前面。顔の前面にだけ顔の絵を貼り、
 * ひとみの上には光を映す透明なおおいをかぶせる。表情が変わったときだけ顔の絵を描き直す
 */

/** 頭の骨から見た頭の中心 */
export const CENTER = new Vector3(0, 0.105, 0.004);

const smooth = (u: number) => {
  const c = Math.max(0, Math.min(1, u));
  return c * c * (3 - 2 * c);
};

/** 球の向き d を、頭の形の上の点（頭の中心から）にする */
export function headPoint(d: Vector3): Vector3 {
  const { x, y, z } = d;
  const front = Math.max(0, z);
  let px = x * 0.09;
  const py = y * (y > 0 ? 0.102 : 0.088);
  let pz = z * (z > 0 ? 0.09 : 0.1);
  // ほおは口の高さまでふっくら保ち、そこから丸くあごへすぼめる
  const jaw = smooth((-y - 0.38) / 0.62);
  px *= 1 - 0.48 * jaw ** 1.6;
  pz *= 1 - 0.25 * jaw * (z < 0 ? 1 : 0.3);
  pz += 0.012 * smooth((-y - 0.6) / 0.4) * front;
  // ほおのふくらみ
  const cheek = Math.exp(-((y + 0.25) ** 2) / 0.06) * front * Math.min(1, Math.abs(x) * 2);
  px += Math.sign(x) * 0.006 * cheek;
  // 顔の前面は平らに
  pz -= 0.012 * front * front * (1 - Math.abs(x)) * smooth((y + 0.9) / 0.6);
  return new Vector3(px, py, pz);
}

export class Head {
  readonly group = new Group();
  readonly #canvas = document.createElement('canvas');
  readonly #tex: CanvasTexture;
  #key = '';

  constructor() {
    this.#canvas.width = this.#canvas.height = FACE_PX;
    this.#tex = new CanvasTexture(this.#canvas);
    this.#tex.colorSpace = SRGBColorSpace;
    this.#tex.anisotropy = 4;
    const geo = new SphereGeometry(1, 72, 56);
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    const d = new Vector3();
    for (let i = 0; i < pos.count; i++) {
      d.fromBufferAttribute(pos, i);
      // SphereGeometry は -z を前に作るので、+z を前に直す
      d.set(-d.x, d.y, -d.z).normalize();
      const p = headPoint(d);
      pos.setXYZ(i, p.x + CENTER.x, p.y + CENTER.y, p.z + CENTER.z);
      uv.setXY(i, 0.5 + p.x / FACE_W, 0.5 + p.y / FACE_H);
    }
    // 前を向いた面だけ顔の絵、ほかは肌の色
    const idx = geo.index!;
    const face: number[] = [];
    const rest: number[] = [];
    for (let t = 0; t < idx.count; t += 3) {
      const tri = [idx.getX(t), idx.getX(t + 1), idx.getX(t + 2)];
      const z = tri.reduce((s, i) => s + pos.getZ(i), 0) / 3 - CENTER.z;
      (z > 0.015 ? face : rest).push(...tri);
    }
    geo.setIndex([...face, ...rest]);
    geo.clearGroups();
    geo.addGroup(0, face.length, 0);
    geo.addGroup(face.length, rest.length, 1);
    geo.computeVertexNormals();
    const skin = toon({ color: SKIN, shade: '#f6c4c0', soft: 0.55, rim: 0.3 });
    const head = new Mesh(geo, [toon({ map: this.#tex, shade: '#f6c4c0', soft: 0.55, rim: 0.3 }), skin]);
    const line = new Mesh(geo, outline('#b8707a', 0.0018));
    this.group.add(head, line);
    for (const side of [-1, 1]) this.group.add(cornea(side));
    this.set({ face: 'smile', mouth: 0, blink: false });
  }

  set(s: FaceState): void {
    const key = faceKey(s);
    if (key === this.#key) return;
    this.#key = key;
    drawFace(this.#canvas.getContext('2d')!, s);
    this.#tex.needsUpdate = true;
  }
}

/** ひとみのおおい。顔の面から少し浮かせた、平たい丸 */
function cornea(side: number): Mesh {
  // 顔の面の上の、目の中心の位置を探す
  let best = new Vector3();
  let err = Infinity;
  const d = new Vector3();
  for (let i = 0; i < 4000; i++) {
    const a = (i % 80) / 80;
    const b = Math.floor(i / 80) / 50;
    d.set(Math.sin(a * 2 - 1), b * 1.2 - 0.6, 1).normalize();
    const p = headPoint(d);
    const e = Math.hypot(p.x - side * EYE.x, p.y - EYE.y);
    if (e < err) [err, best] = [e, p];
  }
  const m = new Mesh(new SphereGeometry(1, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.35), glint());
  m.rotation.x = Math.PI / 2;
  m.scale.set(EYE.w * 0.55, 0.012, EYE.h * 0.5);
  m.position.copy(best).add(CENTER);
  m.position.z -= 0.009;
  m.rotation.y = side * 0.35;
  return m;
}
