import { describe, expect, it } from 'vitest';
import {
  bank,
  connectOk,
  cross,
  divideOk,
  fillOk,
  iceDone,
  iceSlide,
  linesCover,
  movesUsed,
  placeOk,
  pour,
  riverDone,
  riverStart,
  rotateOk,
  slide,
  slideDone,
  type RiverState
} from './engine';
import meta from './meta';
import { ALL_PUZZLES, ORDER, PUZZLES } from './puzzles';
import type {
  Block,
  ConnectQ,
  FillQ,
  IceQ,
  LinesQ,
  PlaceQ,
  Point,
  PourQ,
  Puzzle,
  RiverQ,
  SlideQ,
  SticksQ
} from './types';

/** 幅優先で、goal にたどり着く最小の手数（maxDepth までに見つからなければ -1） */
function bfs<S>(start: S, key: (s: S) => string, next: (s: S) => S[], goal: (s: S) => boolean, maxDepth: number) {
  let layer = [start];
  const seen = new Set([key(start)]);
  for (let depth = 0; depth <= maxDepth; depth++) {
    if (layer.some(goal)) return depth;
    const nextLayer: S[] = [];
    for (const s of layer)
      for (const n of next(s)) {
        const k = key(n);
        if (!seen.has(k)) {
          seen.add(k);
          nextLayer.push(n);
        }
      }
    layer = nextLayer;
  }
  return -1;
}

/** 棒を 1 本ずつ動かして、なぞがとける最小の本数 */
function sticksDepth(p: SticksQ) {
  const all = p.slots.map((_, i) => i);
  return bfs(
    p.on,
    (on) => [...on].sort((a, b) => a - b).join(),
    (on) =>
      on.flatMap((from) => all.filter((to) => !on.includes(to)).map((to) => [...on.filter((i) => i !== from), to])),
    (on) => movesUsed(p, on) <= p.moves && p.goal(new Set(on)),
    p.moves
  );
}

function riverDepth(p: RiverQ) {
  return bfs<RiverState>(
    riverStart(),
    (s) => `${[...s.far].sort().join()}|${s.boat}|${s.time}`,
    (s) => {
      const here = [...bank(p, s, s.boat)];
      const out: RiverState[] = [];
      for (let mask = 1; mask < 1 << here.length; mask++) {
        const r = cross(
          p,
          s,
          here.filter((_, i) => mask & (1 << i))
        );
        if ('next' in r && !('fail' in r)) out.push(r.next);
      }
      return out;
    },
    (s) => riverDone(p, s),
    30
  );
}

function pourDepth(p: PourQ) {
  return bfs(
    p.start,
    (v) => v.join(),
    (v) => v.flatMap((_, f) => v.map((__, t) => (f === t ? v : pour(v, p.caps, f, t)))),
    (v) => p.goal(v),
    30
  );
}

/** pegs をたどる折れ線で、dots をすべて通れる最小の本数（segments までに見つからなければ -1） */
function linesDepth(p: LinesQ) {
  const n = p.pegs.length;
  // 線分ごとに通る dots を先に数えておく
  const hits = p.pegs.map((a, i) =>
    p.pegs.map((b, j) =>
      i === j ? 0 : p.dots.reduce((m, d, k) => (linesCover({ ...p, dots: [d] }, [i, j]) ? m | (1 << k) : m), 0)
    )
  );
  const most = Math.max(...hits.flat().map((m) => m.toString(2).replace(/0/g, '').length));
  const all = (1 << p.dots.length) - 1;
  const open = (m: number) => p.dots.length - m.toString(2).replace(/0/g, '').length;
  const walk = (at: number, left: number, covered: number): boolean => {
    if (covered === all) return true;
    // 1 本で通れる点の数には上限があるので、残りの本数で足りなければ打ち切る
    if (left === 0 || open(covered) > left * most) return false;
    for (let j = 0; j < n; j++)
      if (j !== at && hits[at][j] & ~covered && walk(j, left - 1, covered | hits[at][j])) return true;
    return false;
  };
  for (let k = 1; k <= p.segments; k++) for (let i = 0; i < n; i++) if (walk(i, k, 0)) return k;
  return -1;
}

function iceDepth(p: IceQ) {
  return bfs<Point>(
    p.start,
    (q) => `${q.x},${q.y}`,
    (q) =>
      [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1]
      ].map(([dx, dy]) => iceSlide(p, q, dx, dy)),
    (q) => iceDone(p, q),
    50
  );
}

function slideDepth(p: SlideQ) {
  return bfs<Block[]>(
    p.blocks,
    (bs) => bs.map((b) => `${b.x},${b.y}`).join(' '),
    (bs) =>
      bs.flatMap((_, i) =>
        [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1]
        ].flatMap(([dx, dy]) => {
          const next = slide(p, bs, i, dx, dy);
          return next ? [next] : [];
        })
      ),
    (bs) => slideDone(p, bs),
    200
  );
}

/** 駒の置き方を全部ためし、goal を満たす数と全体の数 */
function placeCount(p: PlaceQ) {
  const free = Array.from({ length: p.cols * p.rows }, (_, i) => i).filter((i) => !p.blocked?.includes(i));
  let ok = 0;
  let all = 0;
  const walk = (from: number, cells: number[]) => {
    if (cells.length === p.count) {
      all++;
      if (placeOk(p, cells)) ok++;
      return;
    }
    for (let k = from; k < free.length; k++) walk(k + 1, [...cells, free[k]]);
  };
  walk(0, []);
  return { ok, all };
}

/** 組ごとに線を探して、全部つなげられるか（fill ならます目を埋めきれるか） */
function connectSolvable(p: ConnectQ): boolean {
  const n = p.cols * p.rows;
  const at = (q: Point) => q.y * p.cols + q.x;
  const ends = new Set(p.pairs.flatMap((pr) => [at(pr.a), at(pr.b)]));
  const nbrs = (c: number) =>
    [c - p.cols, c + p.cols, c % p.cols ? c - 1 : -1, (c + 1) % p.cols ? c + 1 : -1].filter((d) => d >= 0 && d < n);
  const route = (i: number, used: Set<number>, paths: number[][]): boolean => {
    if (i === p.pairs.length)
      return connectOk(
        p,
        paths.flatMap((q, k) => (k ? [-1, ...q] : q))
      );
    const [a, b] = [at(p.pairs[i].a), at(p.pairs[i].b)];
    const walk = (path: number[]): boolean => {
      const c = path.at(-1)!;
      if (c === b) return route(i + 1, new Set([...used, ...path]), [...paths, path]);
      return nbrs(c).some(
        (d) =>
          !path.includes(d) &&
          !used.has(d) &&
          !p.blocked?.includes(d) &&
          (d === b || !ends.has(d)) &&
          walk([...path, d])
      );
    };
    return walk([a]);
  };
  return route(0, new Set(), []);
}

/** 数の入れ方を全部ためし、goal を満たす数と全体の数 */
function fillCount(p: FillQ) {
  const open = p.cells.map((c, i) => (c.given === undefined ? i : -1)).filter((i) => i >= 0);
  let ok = 0;
  let all = 0;
  const walk = (k: number, left: number[], values: number[]) => {
    if (k === open.length) {
      all++;
      if (fillOk(p, values)) ok++;
      return;
    }
    new Set(left).forEach((v) => {
      const next = [...values];
      next[open[k]] = v;
      const rest = [...left];
      rest.splice(rest.indexOf(v), 1);
      walk(k + 1, rest, next);
    });
  };
  walk(
    0,
    p.numbers,
    p.cells.map((c) => c.given ?? -1)
  );
  return { ok, all };
}

const choose = (n: number, k: number): number => (k === 0 ? 1 : (choose(n - 1, k - 1) * n) / k);

describe('hirameki のなぞ', () => {
  it('レベルの数だけなぞがある', () => {
    expect(PUZZLES.length).toBe(meta.levels);
  });

  it('並び順はすべてのナゾを 1 回ずつ含み、同じジャンルが隣り合わない', () => {
    expect(new Set(ORDER.map(([t]) => t)).size).toBe(ORDER.length);
    expect(ORDER.length).toBe(ALL_PUZZLES.length);
    ORDER.slice(1).forEach(([title, genre], i) => expect(genre, title).not.toBe(ORDER[i][1]));
  });

  it('題と問題文はかぶらない', () => {
    expect(new Set(PUZZLES.map((p) => p.title)).size).toBe(PUZZLES.length);
    expect(new Set(PUZZLES.map((p) => p.text)).size).toBe(PUZZLES.length);
  });

  it.each(PUZZLES.map((p, i) => [i + 1, p.title, p] as const))(
    '%i %s',
    (_, __, p: Puzzle) => {
      expect(p.hints.every((h) => h.trim().length > 0)).toBe(true);
      expect(p.why.trim().length).toBeGreaterThan(0);
      if (p.questions) {
        expect(p.questions.length).toBeGreaterThanOrEqual(6);
        expect(new Set(p.questions.map((x) => x.q)).size).toBe(p.questions.length);
        // 「はい」だけでは真相の手がかりにならないので、いいえや関係ないもまぜる
        expect(new Set(p.questions.map((x) => x.a)).size).toBeGreaterThanOrEqual(2);
      }
      // 当てずっぽうで当たる選択式は型から消したが、データに残っていないかも確かめる
      expect((p as { kind: string }).kind).not.toBe('choice');
      switch (p.kind) {
        case 'number':
          expect(Number.isInteger(p.answer)).toBe(true);
          expect(p.answer).toBeGreaterThanOrEqual(0);
          break;
        case 'tap':
          expect(p.answer.length).toBeGreaterThan(0);
          // 当てずっぽうで当たるのは 10 回に 1 回まで
          expect(choose(p.spots.length, p.answer.length)).toBeGreaterThanOrEqual(10);
          expect(p.answer.every((i) => p.spots[i])).toBe(true);
          expect(p.fig).toBeDefined();
          break;
        case 'sticks':
          expect(p.goal(new Set(p.on))).toBe(false);
          // 手数ちょうどでとける（少ない手数でとけるなら、なぞがゆるい）
          expect(sticksDepth(p)).toBe(p.moves);
          break;
        case 'river':
          expect(riverDepth(p)).toBeGreaterThan(0);
          break;
        case 'lines':
          // 手数ちょうどでとける（少ない本数でとけるなら、なぞがゆるい）
          expect(linesDepth(p)).toBe(p.segments);
          break;
        case 'word':
          // どの答えも、タイルを 1 枚ずつ使って作れる
          for (const w of p.answer) {
            const left = [...p.tiles];
            for (const ch of w) {
              expect(left, `${w} の ${ch}`).toContain(ch);
              left.splice(left.indexOf(ch), 1);
            }
          }
          // おとりの文字があり、答えの文字だけを並べかえれば済む問題にしない
          expect(p.tiles.length).toBeGreaterThan(Math.max(...p.answer.map((w) => w.length)));
          break;
        case 'ice':
          // 1 手や 2 手でとけるなら、ナゾになっていない
          expect(iceDepth(p)).toBeGreaterThanOrEqual(4);
          break;
        case 'connect':
          expect(connectSolvable(p)).toBe(true);
          break;
        case 'divide':
          expect(divideOk(p, p.example)).toBe(true);
          break;
        case 'rotate':
          expect(
            rotateOk(
              p,
              p.tiles.map((t) => t.turn)
            )
          ).toBe(false);
          expect(rotateOk(p, p.example)).toBe(true);
          // fixed のタイルは回せないので、正解の向きでも最初のまま
          p.tiles.forEach((t, i) => t.fixed && expect(p.example[i] % 4).toBe(t.turn % 4));
          break;
        case 'fill': {
          expect(p.numbers.length).toBe(p.cells.filter((c) => c.given === undefined).length);
          const { ok, all } = fillCount(p);
          expect(ok).toBeGreaterThan(0);
          expect(ok * 10).toBeLessThanOrEqual(all);
          break;
        }
        case 'slide':
          expect(slideDone(p, p.blocks)).toBe(false);
          expect(slideDepth(p)).toBeGreaterThan(0);
          break;
        case 'place': {
          const { ok, all } = placeCount(p);
          expect(ok).toBeGreaterThan(0);
          // 当てずっぽうで当たるのは 10 回に 1 回まで
          expect(ok * 10).toBeLessThanOrEqual(all);
          break;
        }
        case 'pour':
          expect(p.goal(p.start)).toBe(false);
          expect(pourDepth(p)).toBeGreaterThan(0);
          break;
      }
      // マッチ棒の総当たりは 3 手で数秒かかり、並列で走らせると既定の 5 秒を超える
    },
    30_000
  );
});
