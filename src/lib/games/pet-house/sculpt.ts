/**
 * 丸い円すいと楕円体をなめらかにつないだ形（符号付き距離）を、三角形の面にする（surface nets）。
 * 胴・首・頭・足・しっぽを 1 枚の面にすると継ぎ目が出ず、1 回の描画で済む。three は使わない
 */

export type V3 = readonly [number, number, number];

export interface Shape {
  /** 楕円体なら中心、円すいなら始まりの点 */
  a: V3;
  /** 丸い円すいの終わりの点と、両端の半径 */
  cone?: { b: V3; ra: number; rb: number };
  /** 楕円体の半径 */
  ell?: V3;
  /** 形を a のまわりで回す角度（x → y → z の順）と、回したあとの軸ごとの縮め（耳を平たくするなど） */
  turn?: V3;
  squash?: V3;
  /** まわりの形となじませる幅。0 ならただ重ねる */
  k: number;
  /** 削る形（目のくぼみなど） */
  cut?: boolean;
  bone: string;
  tag: string;
}

interface Prim {
  cone: boolean;
  ax: number;
  ay: number;
  az: number;
  /** 回したあとの座標での b（a を原点に） */
  bx: number;
  by: number;
  bz: number;
  ra: number;
  rb: number;
  rx: number;
  ry: number;
  rz: number;
  /** 世界の向き → 形の向き（3x3、縮めこみ）。null なら回さない */
  m: number[] | null;
  /** 縮めた分だけ距離が伸びるので、いちばん縮めた倍率を掛けて戻す */
  lip: number;
  k: number;
  cut: boolean;
  cx: number;
  cy: number;
  cz: number;
  br: number;
}

function rotation([x, y, z]: V3) {
  const [cx, sx, cy, sy, cz, sz] = [Math.cos(x), Math.sin(x), Math.cos(y), Math.sin(y), Math.cos(z), Math.sin(z)];
  // three の Euler 'XYZ' と同じ R = Rx·Ry·Rz
  return [
    cy * cz,
    -cy * sz,
    sy,
    cx * sz + sx * sy * cz,
    cx * cz - sx * sy * sz,
    -sx * cy,
    sx * sz - cx * sy * cz,
    sx * cz + cx * sy * sz,
    cx * cy
  ];
}

function prepare(s: Shape): Prim {
  const [ax, ay, az] = s.a;
  let m: number[] | null = null;
  let lip = 1;
  if (s.turn || s.squash) {
    const r = rotation(s.turn ?? [0, 0, 0]);
    const q = s.squash ?? [1, 1, 1];
    // local = S⁻¹ · Rᵀ · (p − a)
    m = [0, 1, 2].flatMap((i) => [0, 1, 2].map((j) => r[j * 3 + i] / q[i]));
    lip = Math.min(...q);
  }
  const local = (x: number, y: number, z: number): [number, number, number] =>
    m ? [m[0] * x + m[1] * y + m[2] * z, m[3] * x + m[4] * y + m[5] * z, m[6] * x + m[7] * y + m[8] * z] : [x, y, z];
  const b = s.cone ? local(s.cone.b[0] - ax, s.cone.b[1] - ay, s.cone.b[2] - az) : [0, 0, 0];
  const [rx, ry, rz] = s.ell ?? [0, 0, 0];
  const ra = s.cone?.ra ?? 0;
  const rb = s.cone?.rb ?? 0;
  const ext = s.squash ? Math.max(...s.squash) : 1;
  const bw = s.cone ? [ax + (s.cone.b[0] - ax) / 2, ay + (s.cone.b[1] - ay) / 2, az + (s.cone.b[2] - az) / 2] : s.a;
  const half = s.cone
    ? Math.hypot(s.cone.b[0] - ax, s.cone.b[1] - ay, s.cone.b[2] - az) / 2 + Math.max(ra, rb) * ext
    : Math.max(rx, ry, rz) * ext;
  return {
    cone: !!s.cone,
    ax,
    ay,
    az,
    bx: b[0],
    by: b[1],
    bz: b[2],
    ra,
    rb,
    rx,
    ry,
    rz,
    m,
    lip,
    k: s.k,
    cut: !!s.cut,
    cx: bw[0],
    cy: bw[1],
    cz: bw[2],
    br: half
  };
}

/** 形 1 つまでの距離（外が正） */
function primDist(p: Prim, x: number, y: number, z: number) {
  let px = x - p.ax;
  let py = y - p.ay;
  let pz = z - p.az;
  if (p.m) {
    const m = p.m;
    const [qx, qy, qz] = [px, py, pz];
    px = m[0] * qx + m[1] * qy + m[2] * qz;
    py = m[3] * qx + m[4] * qy + m[5] * qz;
    pz = m[6] * qx + m[7] * qy + m[8] * qz;
  }
  let d: number;
  if (p.cone) {
    // Inigo Quilez の sdRoundCone
    const { bx, by, bz, ra, rb } = p;
    const l2 = bx * bx + by * by + bz * bz;
    const rr = ra - rb;
    const a2 = l2 - rr * rr;
    const il2 = 1 / l2;
    const yy = px * bx + py * by + pz * bz;
    const zz = yy - l2;
    const xvx = px * l2 - bx * yy;
    const xvy = py * l2 - by * yy;
    const xvz = pz * l2 - bz * yy;
    const x2 = xvx * xvx + xvy * xvy + xvz * xvz;
    const y2 = yy * yy * l2;
    const z2 = zz * zz * l2;
    const k = Math.sign(rr) * rr * rr * x2;
    if (Math.sign(zz) * a2 * z2 > k) d = Math.sqrt(x2 + z2) * il2 - rb;
    else if (Math.sign(yy) * a2 * y2 < k) d = Math.sqrt(x2 + y2) * il2 - ra;
    else d = (Math.sqrt(x2 * a2 * il2) + yy * rr) * il2 - ra;
  } else {
    // 楕円体の近似（Quilez）
    // Math.hypot は遅いので平方根を直接取る（形 1 つあたり何十万回も呼ぶ）
    const ux = px / p.rx;
    const uy = py / p.ry;
    const uz = pz / p.rz;
    const k0 = Math.sqrt(ux * ux + uy * uy + uz * uz);
    const vx = ux / p.rx;
    const vy = uy / p.ry;
    const vz = uz / p.rz;
    const k1 = Math.sqrt(vx * vx + vy * vy + vz * vz);
    d = k1 > 1e-9 ? (k0 * (k0 - 1)) / k1 : -Math.min(p.rx, p.ry, p.rz);
  }
  return d * p.lip;
}

function smin(a: number, b: number, k: number) {
  if (k <= 0) return Math.min(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

export interface Field {
  (x: number, y: number, z: number): number;
  /** 形ごとの距離。重さ（どの骨に付くか）を決めるのに使う */
  each(x: number, y: number, z: number, out: Float64Array): void;
  count: number;
  /** 中心 (x, y, z)・半径 r の球の中だけで正しい、効く形だけに絞った距離の関数 */
  near(x: number, y: number, z: number, r: number): (x: number, y: number, z: number) => number;
}

/** 形の並びを 1 つの距離の関数にする。detail は表面を細かくでこぼこさせるとき（プードルの毛）で、amp はその高さ */
export function field(
  shapes: Shape[],
  detail?: { fn: (x: number, y: number, z: number) => number; amp: number }
): Field {
  const prims = shapes.map(prepare);
  const make = (adds: Prim[], cuts: Prim[]) => (x: number, y: number, z: number) => {
    let d = Infinity;
    for (const p of adds) {
      // 遠い形は結果を変えないので、外接球で先に見切る
      const ex = x - p.cx;
      const ey = y - p.cy;
      const ez = z - p.cz;
      const reach = d + p.k + p.br;
      if (d !== Infinity && ex * ex + ey * ey + ez * ez > reach * reach) continue;
      const di = primDist(p, x, y, z);
      d = d === Infinity ? di : smin(d, di, p.k);
    }
    for (const p of cuts) {
      const ex = x - p.cx;
      const ey = y - p.cy;
      const ez = z - p.cz;
      if (ex * ex + ey * ey + ez * ez > (p.k + p.br) ** 2) continue;
      d = -smin(-d, primDist(p, x, y, z), p.k);
    }
    // でこぼこは面の近くでだけ効けばよい（遠くは符号が変わらない）
    return detail && Math.abs(d) < detail.amp * 2 ? d - detail.fn(x, y, z) : d;
  };
  const adds = prims.filter((p) => !p.cut);
  const cuts = prims.filter((p) => p.cut);
  const f = make(adds, cuts) as Field;
  f.near = (x, y, z, r) => {
    // 半径 r の球の中で距離はせいぜい d0 + r。それより k 以上遠い形は球の中の値を変えない
    const top = f(x, y, z) + r;
    const keep = (p: Prim, lim: number) => {
      const [dx, dy, dz] = [x - p.cx, y - p.cy, z - p.cz];
      return Math.sqrt(dx * dx + dy * dy + dz * dz) - p.br - r < lim + p.k * 2;
    };
    return make(
      adds.filter((p) => keep(p, top)),
      cuts.filter((p) => keep(p, 0))
    );
  };
  f.each = (x, y, z, out) => prims.forEach((p, i) => (out[i] = primDist(p, x, y, z)));
  f.count = prims.length;
  return f;
}

export interface Surface {
  pos: Float32Array;
  nrm: Float32Array;
  idx: Uint32Array;
}

/**
 * 距離の関数の 0 の面を、h 間隔の格子で三角形にする。bounds は [x0, y0, z0, x1, y1, z1]。
 * 粗い格子で面から遠いとわかった塊は細かく測らない
 */
export function mesh(f: Field, bounds: number[], h: number, slack = 0): Surface {
  const C = 3;
  const [x0, y0, z0] = bounds;
  const n = [0, 1, 2].map((i) => C * Math.ceil((bounds[i + 3] - bounds[i]) / h / C) + 1);
  const [nx, ny, nz] = n;
  const at = (i: number, j: number, k: number) => i + nx * (j + ny * k);
  const vals = new Float32Array(nx * ny * nz);
  // 粗いセルの角がどれも面からこれより遠ければ、そのセルの中に面はない（距離の傾きは 1 以下なので）
  const far = C * h * Math.sqrt(3) * 1.1 + slack;
  const cn = n.map((v) => (v - 1) / C + 1);
  const coarse = new Float32Array(cn[0] * cn[1] * cn[2]);
  for (let k = 0; k < cn[2]; k++)
    for (let j = 0; j < cn[1]; j++)
      for (let i = 0; i < cn[0]; i++)
        coarse[i + cn[0] * (j + cn[1] * k)] = f(x0 + i * C * h, y0 + j * C * h, z0 + k * C * h);
  const skip = new Float32Array((cn[0] - 1) * (cn[1] - 1) * (cn[2] - 1));
  for (let ck = 0; ck < cn[2] - 1; ck++)
    for (let cj = 0; cj < cn[1] - 1; cj++)
      for (let ci = 0; ci < cn[0] - 1; ci++) {
        let lo = Infinity;
        let sign = 0;
        for (let c = 0; c < 8; c++) {
          const v = coarse[ci + (c & 1) + cn[0] * (cj + ((c >> 1) & 1) + cn[1] * (ck + (c >> 2)))];
          lo = Math.min(lo, Math.abs(v));
          sign += v > 0 ? 1 : -1;
        }
        skip[ci + (cn[0] - 1) * (cj + (cn[1] - 1) * ck)] = lo > far && Math.abs(sign) === 8 ? Math.sign(sign) * far : 0;
      }
  // 細かい点は、それを含むどれかの粗いセルが面に近いときだけ測る
  // 測るときは、その点を持つ粗いセルのまわりで効く形だけに絞る（形が 40 以上あるので数倍速い）
  const local = new Map<number, (x: number, y: number, z: number) => number>();
  // 細かい格子の点 (i, j, k) を持つ粗いセルの関数。半径は面の頂点が 1 マスはみ出しても収まる大きさ
  const cell0 = (v: number, a: number) => Math.max(0, Math.min(Math.floor(v / C), cn[a] - 2));
  const near = (i: number, j: number, k: number) => {
    const bi = cell0(i, 0);
    const bj = cell0(j, 1);
    const bk = cell0(k, 2);
    const b = bi + (cn[0] - 1) * (bj + (cn[1] - 1) * bk);
    let g = local.get(b);
    if (!g) {
      g = f.near(x0 + (bi + 0.5) * C * h, y0 + (bj + 0.5) * C * h, z0 + (bk + 0.5) * C * h, C * h * 1.4);
      local.set(b, g);
    }
    return g;
  };
  for (let k = 0; k < nz; k++) {
    const ck0 = Math.min(Math.floor((k - 1) / C), cn[2] - 2);
    const ck1 = Math.min(Math.floor(k / C), cn[2] - 2);
    for (let j = 0; j < ny; j++) {
      const cj0 = Math.min(Math.floor((j - 1) / C), cn[1] - 2);
      const cj1 = Math.min(Math.floor(j / C), cn[1] - 2);
      for (let i = 0; i < nx; i++) {
        const ci0 = Math.min(Math.floor((i - 1) / C), cn[0] - 2);
        const ci1 = Math.min(Math.floor(i / C), cn[0] - 2);
        let v = 0;
        for (let ck = Math.max(0, ck0); ck <= ck1 && v !== 1e9; ck++)
          for (let cj = Math.max(0, cj0); cj <= cj1 && v !== 1e9; cj++)
            for (let ci = Math.max(0, ci0); ci <= ci1; ci++) {
              const sk = skip[ci + (cn[0] - 1) * (cj + (cn[1] - 1) * ck)];
              if (sk === 0) {
                v = 1e9;
                break;
              }
              v = sk;
            }
        if (v !== 1e9) {
          vals[at(i, j, k)] = v;
          continue;
        }
        vals[at(i, j, k)] = near(i, j, k)(x0 + i * h, y0 + j * h, z0 + k * h);
      }
    }
  }

  // 符号の変わるセルごとに 1 つ頂点を置く（辺を横切る点の平均）
  const cell = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1);
  const cat = (i: number, j: number, k: number) => i + (nx - 1) * (j + (ny - 1) * k);
  const pos: number[] = [];
  const edges = [
    [0, 1],
    [2, 3],
    [4, 5],
    [6, 7],
    [0, 2],
    [1, 3],
    [4, 6],
    [5, 7],
    [0, 4],
    [1, 5],
    [2, 6],
    [3, 7]
  ];
  const corner = new Float64Array(8);
  for (let k = 0; k < nz - 1; k++)
    for (let j = 0; j < ny - 1; j++)
      for (let i = 0; i < nx - 1; i++) {
        let mask = 0;
        for (let c = 0; c < 8; c++) {
          corner[c] = vals[at(i + (c & 1), j + ((c >> 1) & 1), k + (c >> 2))];
          if (corner[c] < 0) mask |= 1 << c;
        }
        if (mask === 0 || mask === 255) continue;
        let sx = 0;
        let sy = 0;
        let sz = 0;
        let cnt = 0;
        for (const [a, b] of edges) {
          const va = corner[a];
          const vb = corner[b];
          if (va < 0 === vb < 0) continue;
          const t = va / (va - vb);
          sx += (a & 1) + ((b & 1) - (a & 1)) * t;
          sy += ((a >> 1) & 1) + (((b >> 1) & 1) - ((a >> 1) & 1)) * t;
          sz += (a >> 2) + ((b >> 2) - (a >> 2)) * t;
          cnt++;
        }
        cell[cat(i, j, k)] = pos.length / 3;
        pos.push(x0 + (i + sx / cnt) * h, y0 + (j + sy / cnt) * h, z0 + (k + sz / cnt) * h);
      }

  // 符号の変わる格子の辺ごとに、まわりの 4 つのセルの頂点で四角形を張る
  const idx: number[] = [];
  const quad = (a: number, b: number, c: number, d: number, flip: boolean) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) idx.push(a, c, b, a, d, c);
    else idx.push(a, b, c, a, c, d);
  };
  for (let k = 1; k < nz - 1; k++)
    for (let j = 1; j < ny - 1; j++)
      for (let i = 1; i < nx - 1; i++) {
        const inside = vals[at(i, j, k)] < 0;
        if (i < nx - 1 && inside !== vals[at(i + 1, j, k)] < 0)
          quad(cell[cat(i, j - 1, k - 1)], cell[cat(i, j, k - 1)], cell[cat(i, j, k)], cell[cat(i, j - 1, k)], !inside);
        if (j < ny - 1 && inside !== vals[at(i, j + 1, k)] < 0)
          quad(cell[cat(i - 1, j, k - 1)], cell[cat(i - 1, j, k)], cell[cat(i, j, k)], cell[cat(i, j, k - 1)], !inside);
        if (k < nz - 1 && inside !== vals[at(i, j, k + 1)] < 0)
          quad(cell[cat(i - 1, j - 1, k)], cell[cat(i, j - 1, k)], cell[cat(i, j, k)], cell[cat(i - 1, j, k)], !inside);
      }

  // 頂点を面の上へ 1 歩寄せ、向きは距離の傾きから取る（面の三角形から取るより滑らか）
  const nrm = new Float32Array(pos.length);
  const e = h * 0.5;
  for (let v = 0; v < pos.length; v += 3) {
    let [x, y, z] = [pos[v], pos[v + 1], pos[v + 2]];
    const f = near(Math.floor((x - x0) / h), Math.floor((y - y0) / h), Math.floor((z - z0) / h));
    for (let it = 0; it < 2; it++) {
      const d = f(x, y, z);
      const gx = f(x + e, y, z) - f(x - e, y, z);
      const gy = f(x, y + e, z) - f(x, y - e, z);
      const gz = f(x, y, z + e) - f(x, y, z - e);
      const g = Math.hypot(gx, gy, gz) || 1;
      const step = Math.max(-h, Math.min(h, d));
      if (it === 0) {
        x -= (gx / g) * step;
        y -= (gy / g) * step;
        z -= (gz / g) * step;
      } else {
        nrm[v] = gx / g;
        nrm[v + 1] = gy / g;
        nrm[v + 2] = gz / g;
      }
    }
    pos[v] = x;
    pos[v + 1] = y;
    pos[v + 2] = z;
  }
  return { pos: new Float32Array(pos), nrm, idx: new Uint32Array(idx) };
}

/** 形の並びが収まる箱 [x0, y0, z0, x1, y1, z1] に、margin を足したもの */
export function bounds(shapes: Shape[], margin: number) {
  const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (const s of shapes) {
    if (s.cut) continue;
    const p = prepare(s);
    for (let i = 0; i < 3; i++) {
      const c = [p.cx, p.cy, p.cz][i];
      b[i] = Math.min(b[i], c - p.br);
      b[i + 3] = Math.max(b[i + 3], c + p.br);
    }
  }
  return b.map((v, i) => v + (i < 3 ? -margin : margin));
}
