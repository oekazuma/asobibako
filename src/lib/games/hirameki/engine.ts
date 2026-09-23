import type {
  Block,
  ConnectQ,
  DivideQ,
  FillQ,
  IceQ,
  RotateQ,
  TileShape,
  LinesQ,
  PlaceQ,
  Point,
  Puzzle,
  RiverQ,
  SlideQ,
  Slot,
  SticksQ
} from './types';

/**
 * 「こたえる」で確かめる答え。number は数、tap は選んだ spots の添え字、
 * sticks はいま置いてある slot の添え字、lines は線を曲げた pegs の添え字の並び。
 * connect は各組の線のます目の並びを -1 で区切ってつないだもの、divide は各ます目の組の番号、
 * rotate は各タイルの向き、fill は cells の順の数（空きは -1）
 */
export type Pick = number | readonly number[];

export function isRight(p: Puzzle, pick: Pick): boolean {
  switch (p.kind) {
    case 'number':
      return pick === p.answer;
    case 'tap':
      return typeof pick !== 'number' && sameSet(pick, p.answer);
    case 'sticks':
      return typeof pick !== 'number' && movesUsed(p, pick) <= p.moves && p.goal(new Set(pick));
    case 'lines':
      return typeof pick !== 'number' && linesCover(p, pick);
    case 'connect':
      return typeof pick !== 'number' && connectOk(p, pick);
    case 'divide':
      return typeof pick !== 'number' && divideOk(p, pick);
    case 'rotate':
      return typeof pick !== 'number' && rotateOk(p, pick);
    case 'fill':
      return typeof pick !== 'number' && fillOk(p, pick);
    case 'place':
      return typeof pick !== 'number' && placeOk(p, pick);
    case 'word':
      return typeof pick !== 'number' && new Set(pick).size === pick.length && p.answer.includes(spell(p.tiles, pick));
    default:
      // 川わたりと注ぐなぞは、うごかしている途中で決まる
      return false;
  }
}

const sameSet = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((x) => b.includes(x));

/** はじめの場所から動いた本数。もとの場所へ戻せば数えなおす */
export const movesUsed = (p: SticksQ, on: readonly number[]) => p.on.filter((i) => !on.includes(i)).length;

// ---- マッチ棒の数字 ----

/** 7 つの棒の並び: 上・右上・右下・下・左下・左上・真ん中 */
const DIGITS = [
  '1111110',
  '0110000',
  '1101101',
  '1111001',
  '0110011',
  '1011011',
  '1011111',
  '1110000',
  '1111111',
  '1111011'
];

/**
 * "6+4=4" のような式をマッチ棒で並べる。数字は 7 本、+ と - は横と縦の 2 本、= は 2 本の場所を持つ。
 * goal は、どの数字も正しい形で、式がなりたつこと
 */
export function equation(src: string, size = 40, gap = 12): Laid {
  const w = size / 2;
  const slots: Slot[] = [];
  const on: number[] = [];
  const cells: { kind: 'digit' | 'op' | 'eq'; at: number }[] = [];
  let x = gap;
  const y = gap;
  for (const ch of src) {
    const at = slots.length;
    if (/\d/.test(ch)) {
      const segs: Slot[] = [
        { x1: x, y1: y, x2: x + w, y2: y },
        { x1: x + w, y1: y, x2: x + w, y2: y + w },
        { x1: x + w, y1: y + w, x2: x + w, y2: y + size },
        { x1: x, y1: y + size, x2: x + w, y2: y + size },
        { x1: x, y1: y + w, x2: x, y2: y + size },
        { x1: x, y1: y, x2: x, y2: y + w },
        { x1: x, y1: y + w, x2: x + w, y2: y + w }
      ];
      slots.push(...segs);
      DIGITS[Number(ch)].split('').forEach((b, i) => b === '1' && on.push(at + i));
      cells.push({ kind: 'digit', at });
    } else if (ch === '+' || ch === '-') {
      slots.push(
        { x1: x, y1: y + w, x2: x + w, y2: y + w },
        { x1: x + w / 2, y1: y + w / 2, x2: x + w / 2, y2: y + w * 1.5 }
      );
      on.push(at);
      if (ch === '+') on.push(at + 1);
      cells.push({ kind: 'op', at });
    } else if (ch === '=') {
      slots.push(
        { x1: x, y1: y + w * 0.75, x2: x + w, y2: y + w * 0.75 },
        { x1: x, y1: y + w * 1.25, x2: x + w, y2: y + w * 1.25 }
      );
      on.push(at, at + 1);
      cells.push({ kind: 'eq', at });
    } else throw new Error(`equation: ${ch}`);
    x += w + gap;
  }
  const goal = (set: ReadonlySet<number>) => {
    let expr = '';
    for (const c of cells) {
      if (c.kind === 'digit') {
        const bits = Array.from({ length: 7 }, (_, i) => (set.has(c.at + i) ? '1' : '0')).join('');
        const d = DIGITS.indexOf(bits);
        if (d < 0) return false;
        expr += d;
      } else if (c.kind === 'op') {
        if (!set.has(c.at)) return false;
        expr += set.has(c.at + 1) ? '+' : '-';
      } else {
        if (!set.has(c.at) || !set.has(c.at + 1)) return false;
        expr += '=';
      }
    }
    const [left, right] = expr.split('=');
    if (right === undefined || right === '' || left === '') return false;
    return evaluate(left) === evaluate(right);
  };
  return { slots, on, goal, width: x, height: size + gap * 2 };
}

interface Laid {
  slots: Slot[];
  on: number[];
  goal: (on: ReadonlySet<number>) => boolean;
  /** 並べた式の幅と高さ。図の viewBox に使う */
  width: number;
  height: number;
}

/** 左から順に + と - を計算する。数字は並んだぶんだけ桁になる */
function evaluate(s: string): number {
  const parts = s.match(/[+-]?\d+/g);
  if (!parts || parts.join('') !== s) return NaN;
  return parts.reduce((sum, n) => sum + Number(n), 0);
}

// ---- マッチ棒の方眼 ----

/**
 * cols × rows の方眼の辺をすべて slot にする。h(i, j) は j 段目の横線の i 本目、v(i, j) は i 列目の縦線の j 本目
 */
export function grid(cols: number, rows: number, unit = 40, ox = 12, oy = 12) {
  const slots: Slot[] = [];
  for (let j = 0; j <= rows; j++)
    for (let i = 0; i < cols; i++)
      slots.push({ x1: ox + i * unit, y1: oy + j * unit, x2: ox + (i + 1) * unit, y2: oy + j * unit });
  for (let i = 0; i <= cols; i++)
    for (let j = 0; j < rows; j++)
      slots.push({ x1: ox + i * unit, y1: oy + j * unit, x2: ox + i * unit, y2: oy + (j + 1) * unit });
  const h = (i: number, j: number) => j * cols + i;
  const v = (i: number, j: number) => (rows + 1) * cols + i * rows + j;
  /** 置いてある棒でできている正方形。大きさ（辺の本数）の配列と、どこかの正方形の辺になっている棒 */
  const squares = (on: ReadonlySet<number>) => {
    const sizes: number[] = [];
    const used = new Set<number>();
    for (let k = 1; k <= Math.min(cols, rows); k++)
      for (let x = 0; x + k <= cols; x++)
        for (let y = 0; y + k <= rows; y++) {
          const edges: number[] = [];
          for (let t = 0; t < k; t++) edges.push(h(x + t, y), h(x + t, y + k), v(x, y + t), v(x + k, y + t));
          if (edges.every((e) => on.has(e))) {
            sizes.push(k);
            edges.forEach((e) => used.add(e));
          }
        }
    return { sizes, allUsed: [...on].every((e) => used.has(e)) };
  };
  return { slots, h, v, squares, width: ox * 2 + cols * unit, height: oy * 2 + rows * unit };
}

// ---- コイン ----

/** 点の集まりを、平行移動しても同じになる形の名前にする */
export function shapeKey(points: readonly { x: number; y: number }[]): string {
  const mx = Math.min(...points.map((p) => p.x));
  const my = Math.min(...points.map((p) => p.y));
  return points
    .map((p) => `${Math.round(p.x - mx)},${Math.round(p.y - my)}`)
    .sort()
    .join(' ');
}

/** 押したタイルの並びを言葉にする */
export const spell = (tiles: readonly string[], pick: readonly number[]) => pick.map((i) => tiles[i] ?? '').join('');

// ---- 駒の配置 ----

export function placeOk(p: PlaceQ, cells: readonly number[]): boolean {
  const set = new Set(cells);
  return (
    set.size === p.count &&
    cells.every((c) => Number.isInteger(c) && c >= 0 && c < p.cols * p.rows && !p.blocked?.includes(c)) &&
    p.goal(set)
  );
}

// ---- スライドパズル ----

/** blocks[i] を (dx, dy) だけ 1 ます動かせれば、動かしたあとの並び。盤の外や他のブロックに当たれば null */
export function slide(p: SlideQ, blocks: readonly Block[], i: number, dx: number, dy: number): Block[] | null {
  const b = blocks[i];
  const moved = { ...b, x: b.x + dx, y: b.y + dy };
  if (moved.x < 0 || moved.y < 0 || moved.x + moved.w > p.cols || moved.y + moved.h > p.rows) return null;
  const hit = blocks.some(
    (o, j) =>
      j !== i && moved.x < o.x + o.w && o.x < moved.x + moved.w && moved.y < o.y + o.h && o.y < moved.y + moved.h
  );
  return hit ? null : blocks.map((o, j) => (j === i ? moved : o));
}

export const slideDone = (p: SlideQ, blocks: readonly Block[]) =>
  blocks[p.target].x === p.goal.x && blocks[p.target].y === p.goal.y;

// ---- 氷の上を滑る ----

/** at から (dx, dy) へ滑って止まるます目。goal を通れば goal で止まる */
export function iceSlide(p: IceQ, at: Point, dx: number, dy: number): Point {
  let { x, y } = at;
  for (;;) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= p.cols || ny >= p.rows || p.rocks.some((r) => r.x === nx && r.y === ny))
      return { x, y };
    x = nx;
    y = ny;
    if (x === p.goal.x && y === p.goal.y) return { x, y };
  }
}

export const iceDone = (p: IceQ, at: Point) => at.x === p.goal.x && at.y === p.goal.y;

// ---- 線でつなぐ ----

const near = (cols: number, a: number, b: number) =>
  (Math.abs(a - b) === 1 && Math.floor(a / cols) === Math.floor(b / cols)) || Math.abs(a - b) === cols;

/** pick を -1 で区切って、組ごとの線（ます目の並び）にする */
export const splitPaths = (pick: readonly number[]) =>
  pick.reduce<number[][]>((out, c) => (c < 0 ? [...out, []] : [...out.slice(0, -1), [...out.at(-1)!, c]]), [[]]);

export function connectOk(p: ConnectQ, pick: readonly number[]): boolean {
  const paths = splitPaths(pick);
  if (paths.length !== p.pairs.length) return false;
  const at = (q: Point) => q.y * p.cols + q.x;
  const ends = new Set(p.pairs.flatMap((pr) => [at(pr.a), at(pr.b)]));
  const used = new Set<number>();
  const ok = p.pairs.every((pr, i) => {
    const path = paths[i];
    const [a, b] = [at(pr.a), at(pr.b)];
    if (path.length < 2 || !((path[0] === a && path.at(-1) === b) || (path[0] === b && path.at(-1) === a)))
      return false;
    return path.every((c, k) => {
      if (c < 0 || c >= p.cols * p.rows || used.has(c) || p.blocked?.includes(c)) return false;
      if (k > 0 && !near(p.cols, path[k - 1], c)) return false;
      if (k > 0 && k < path.length - 1 && ends.has(c)) return false;
      used.add(c);
      return true;
    });
  });
  return ok && (!p.fill || used.size === p.cols * p.rows - (p.blocked?.length ?? 0));
}

// ---- 等分割 ----

/** ます目の集まりを、回転と裏返しで同じになる形の名前にする */
function shapeOf(cells: readonly number[], cols: number): string {
  const pts = cells.map((c) => [c % cols, Math.floor(c / cols)]);
  const forms = [0, 1, 2, 3, 4, 5, 6, 7].map((k) => {
    const t = pts.map(([x, y]) => {
      const [u, v] = k & 1 ? [y, x] : [x, y];
      return [k & 2 ? -u : u, k & 4 ? -v : v];
    });
    const mx = Math.min(...t.map((q) => q[0]));
    const my = Math.min(...t.map((q) => q[1]));
    return t
      .map(([x, y]) => `${x - mx},${y - my}`)
      .sort()
      .join(' ');
  });
  return forms.sort()[0];
}

export function divideOk(p: DivideQ, groups: readonly number[]): boolean {
  const n = p.cols * p.rows;
  if (groups.length !== n) return false;
  const byGroup: number[][] = Array.from({ length: p.parts }, () => []);
  for (let c = 0; c < n; c++) {
    if (p.blocked?.includes(c)) continue;
    const g = groups[c];
    if (!Number.isInteger(g) || g < 0 || g >= p.parts) return false;
    byGroup[g].push(c);
  }
  const connected = (cells: number[]) => {
    const seen = new Set([cells[0]]);
    const todo = [cells[0]];
    while (todo.length) {
      const c = todo.pop()!;
      for (const d of cells) {
        if (seen.has(d) || !near(p.cols, c, d)) continue;
        seen.add(d);
        todo.push(d);
      }
    }
    return seen.size === cells.length;
  };
  return (
    byGroup.every((cells) => cells.length > 0 && connected(cells)) &&
    new Set(byGroup.map((cells) => shapeOf(cells, p.cols))).size === 1 &&
    (!p.marks || byGroup.every((cells) => cells.filter((c) => p.marks!.includes(c)).length === 1))
  );
}

// ---- 回転タイル ----

const OPEN: Record<TileShape, number[]> = {
  empty: [],
  end: [0],
  straight: [0, 2],
  corner: [0, 1],
  tee: [0, 1, 3],
  cross: [0, 1, 2, 3],
  mirror: []
};

/** turn だけ時計回りに回したタイルの、開いている辺（0 上・1 右・2 下・3 左） */
export const openSides = (shape: TileShape, turn: number) => OPEN[shape].map((d) => (d + turn) % 4);

const STEP = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0]
];

/** source から水か光をたどって届いたます目 */
export function reach(p: RotateQ, turns: readonly number[]): Set<number> {
  const got = new Set<number>();
  const seen = new Set<string>();
  // 水や光の出どころは盤の外に置くので、ます目の番号ではなく x, y でたどる
  const todo: [number, number, number][] = [[p.source.x, p.source.y, p.source.dir]];
  while (todo.length) {
    const [px, py, dir] = todo.pop()!;
    const x = px + STEP[dir][0];
    const y = py + STEP[dir][1];
    if (x < 0 || y < 0 || x >= p.cols || y >= p.rows) continue;
    const next = y * p.cols + x;
    const key = `${next},${dir}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const tile = p.tiles[next];
    const turn = turns[next] ?? tile.turn;
    const from = (dir + 2) % 4;
    if (p.mode === 'light') {
      got.add(next);
      if (tile.shape === 'mirror') {
        // 「/」は上⇔右・下⇔左、「\」は上⇔左・下⇔右に曲げる
        const slash = turn % 2 === 0;
        const out = slash ? [1, 0, 3, 2][dir] : [3, 2, 1, 0][dir];
        todo.push([x, y, out]);
      } else if (tile.shape === 'empty') todo.push([x, y, dir]);
    } else {
      const sides = openSides(tile.shape, turn);
      if (!sides.includes(from)) continue;
      got.add(next);
      for (const d of sides) if (d !== from) todo.push([x, y, d]);
    }
  }
  return got;
}

export const rotateOk = (p: RotateQ, turns: readonly number[]) => reach(p, turns).has(p.target);

// ---- 数を入れる ----

export function fillOk(p: FillQ, values: readonly number[]): boolean {
  if (values.length !== p.cells.length) return false;
  const placed = values.filter((v, i) => p.cells[i].given === undefined);
  const pool = [...p.numbers].sort((a, b) => a - b).join();
  return (
    p.cells.every((c, i) => c.given === undefined || values[i] === c.given) &&
    [...placed].sort((a, b) => a - b).join() === pool &&
    p.goal(values)
  );
}

// ---- 一筆の直線 ----

/** a から b への線分の上に p がある（端も含む） */
function onSegment(p: Point, a: Point, b: Point): boolean {
  const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
  const dot = (p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y);
  const len = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  return Math.abs(cross) < 1e-6 * Math.max(1, len) && dot >= -1e-9 && dot <= len + 1e-9;
}

/** pegs の添え字の並びを折れ線にしたとき、segments 本以内の直線で dots をすべて通っている */
export function linesCover(p: LinesQ, path: readonly number[]): boolean {
  if (path.length < 2 || path.length > p.segments + 1) return false;
  const pts = path.map((i) => p.pegs[i]);
  if (pts.some((q) => !q)) return false;
  return p.dots.every((d) => pts.slice(1).some((b, i) => onSegment(d, pts[i], b)));
}

// ---- 川わたり ----

export interface RiverState {
  /** 向こう岸にいるもの */
  far: ReadonlySet<string>;
  /** ボート（橋ならランタン）がある岸。0 が手前 */
  boat: 0 | 1;
  time: number;
  trips: number;
}

export const riverStart = (): RiverState => ({ far: new Set(), boat: 0, time: 0, trips: 0 });

export const riverDone = (p: RiverQ, s: RiverState) => s.far.size === p.crossers.length;

/** 岸の中身。side 0 が手前 */
export const bank = (p: RiverQ, s: RiverState, side: 0 | 1) =>
  new Set(p.crossers.filter((c) => s.far.has(c.id) === (side === 1)).map((c) => c.id));

/**
 * load を乗せて向こうへわたる。warn はわたれないだけ（やり直せる）、fail はなぞのしっぱい
 */
export function cross(
  p: RiverQ,
  s: RiverState,
  load: readonly string[]
): { next: RiverState } | { warn: string } | { fail: string; next: RiverState } {
  const riders = p.crossers.filter((c) => load.includes(c.id));
  if (!riders.length) return { warn: p.bridge ? '渡る人を選んでください' : 'ボートにだれか乗せてください' };
  if (riders.some((c) => s.far.has(c.id) !== (s.boat === 1))) return { warn: '向こう岸にいます' };
  if (riders.reduce((sum, c) => sum + (c.weight ?? 1), 0) > p.cap)
    return { warn: p.bridge ? `橋を渡れるのは ${p.cap} 人までです` : '重すぎてボートが沈んでしまいます' };
  const rowers = p.crossers.some((c) => c.rows);
  if (rowers && !riders.some((c) => c.rows)) return { warn: 'ボートをこげる者がいません' };
  const far = new Set(s.far);
  for (const c of riders) {
    if (s.boat === 0) far.add(c.id);
    else far.delete(c.id);
  }
  const next: RiverState = {
    far,
    boat: s.boat === 0 ? 1 : 0,
    time: s.time + Math.max(...riders.map((c) => c.time ?? 0)),
    trips: s.trips + 1
  };
  for (const side of [0, 1] as const) {
    const why = p.danger?.(bank(p, next, side));
    if (why) return { fail: why, next };
  }
  if (p.limit !== undefined && next.time > p.limit) return { fail: `${p.limit} 分を過ぎてしまった`, next };
  return { next };
}

// ---- 注ぐ ----

/** from から to へ、from が空になるか to が満タンになるまで注ぐ */
export function pour(amounts: readonly number[], caps: readonly number[], from: number, to: number): number[] {
  const next = [...amounts];
  const moved = Math.min(next[from], caps[to] - next[to]);
  next[from] -= moved;
  next[to] += moved;
  return next;
}
