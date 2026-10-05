import { describe, expect, it } from 'vitest';
import {
  CELL,
  obstacleAt,
  obstaclesNear,
  PLAYER_R,
  pushOut,
  SHAPES,
  SQUASH,
  type Ground,
  type Obstacle
} from './obstacles';
import { byFeet, covers, feetOf, inView } from './draw-obstacles';

const GROUNDS: Ground[] = ['forest', 'graveyard', 'snow', 'volcano'];
const inside = (g: Ground, x: number, y: number, r: number) =>
  obstaclesNear(g, x, y, r, []).some((o) =>
    SHAPES[o.kind].circles.some(([dx, dy, cr]) => Math.hypot(x - o.x - dx, (y - o.y - dy) / SQUASH) < r + cr - 0.01)
  );

describe('障害物の置き方', () => {
  it('同じ区画は何度聞いても同じ障害物', () => {
    for (const g of GROUNDS)
      for (let c = -5; c <= 5; c++) expect(obstacleAt(g, c, c * 2)).toEqual(obstacleAt(g, c, c * 2));
  });

  it('始めの位置から 80 ドットの中には当たりの丸がかからない', () => {
    for (const g of GROUNDS) expect(obstaclesNear(g, 0, 0, 80, [])).toEqual([]);
  });

  it('およそ 4 区画に 1 つ（40 × 40 区画で 18〜32%）', () => {
    for (const g of GROUNDS) {
      let n = 0;
      for (let cx = -20; cx < 20; cx++) for (let cy = -20; cy < 20; cy++) if (obstacleAt(g, cx, cy)) n++;
      expect(n / 1600).toBeGreaterThan(0.18);
      expect(n / 1600).toBeLessThan(0.32);
    }
  });

  it('ステージごとに 2 種類が出て、ほかのステージの種類は出ない', () => {
    const want: Record<Ground, string[]> = {
      forest: ['boulder', 'log'],
      graveyard: ['bigTomb', 'fence'],
      snow: ['icy', 'snowTree'],
      volcano: ['lavaRock', 'steamRock']
    };
    for (const g of GROUNDS) {
      const seen = new Set<string>();
      for (let cx = -20; cx < 20; cx++) for (let cy = -20; cy < 20; cy++) seen.add(obstacleAt(g, cx, cy)?.kind ?? '');
      seen.delete('');
      expect([...seen].sort()).toEqual([...want[g]].sort());
    }
  });

  it('隣どうしの障害物のあいだは、自分が通れる（自分の直径より広い）', () => {
    for (const g of GROUNDS) {
      const all: Obstacle[] = [];
      for (let cx = -15; cx < 15; cx++)
        for (let cy = -15; cy < 15; cy++) {
          const o = obstacleAt(g, cx, cy);
          if (o) all.push(o);
        }
      for (const a of all)
        for (const b of all) {
          // 遠い組は丸が届かないので比べない（全部の組を比べると遅い）
          if (a === b || Math.hypot(a.x - b.x, a.y - b.y) > CELL * 1.5) continue;
          for (const [ax, ay, ar] of SHAPES[a.kind].circles)
            for (const [bx, by, br] of SHAPES[b.kind].circles)
              expect(Math.hypot(a.x + ax - b.x - bx, a.y + ay - b.y - by) - ar - br).toBeGreaterThan(PLAYER_R * 2);
        }
    }
  });
});

describe('押し出し', () => {
  it('中に置いた丸は当たりの丸の外へ出る', () => {
    for (const g of GROUNDS)
      for (let cx = -6; cx < 6; cx++)
        for (let cy = -6; cy < 6; cy++) {
          const o = obstacleAt(g, cx, cy);
          if (!o) continue;
          for (const [dx, dy] of SHAPES[o.kind].circles) {
            const p = { x: o.x + dx + 0.5, y: o.y + dy + 0.3 };
            pushOut(g, p, PLAYER_R);
            expect(inside(g, p.x, p.y, PLAYER_R)).toBe(false);
          }
        }
  });

  it('外の丸は動かさない', () => {
    const p = { x: 3, y: 4 };
    pushOut('forest', p, PLAYER_R);
    expect(p).toEqual({ x: 3, y: 4 });
  });

  it('斜めにぶつかると、沿って滑って向こうへ抜ける', () => {
    for (const g of GROUNDS) {
      let o: Obstacle | null = null;
      for (let c = 2; !o; c++) o = obstacleAt(g, c, 0);
      const s = SHAPES[o.kind];
      const reach = Math.max(...s.circles.map(([dx, dy, r]) => Math.hypot(dx, dy) + r));
      const p = { x: o.x - reach - 20, y: o.y - 2 };
      for (let i = 0; i < 400; i++) {
        p.x += 1;
        p.y += 0.15;
        pushOut(g, p, PLAYER_R);
      }
      expect(p.x).toBeGreaterThan(o.x + reach);
    }
  });
});

describe('区画の大きさ', () => {
  it('区画は 160 ドット', () => expect(CELL).toBe(160));
});

describe('画面にかかる障害物', () => {
  it('画面の外の障害物は入らず、奥（足もとの y の小さい）から並ぶ', () => {
    const list = inView('forest', -800, -800, 1600, 1600, []);
    expect(list.length).toBeGreaterThan(5);
    for (let i = 1; i < list.length; i++) expect(feetOf(list[i])).toBeGreaterThanOrEqual(feetOf(list[i - 1]));
    // 絵は足もとより上へ伸びるので、画面の下の外は少し広く拾う
    for (const o of inView('forest', -60, -60, 120, 120, [])) {
      expect(Math.abs(o.x)).toBeLessThan(60 + 48);
      expect(o.y).toBeGreaterThan(-60 - 48);
      expect(o.y).toBeLessThan(60 + 96);
    }
    expect(inView('forest', -60, -60, 120, 120, []).length).toBeLessThan(list.length);
  });
});

describe('奥行きの順', () => {
  const rock = { x: 0, y: 0, kind: 'boulder' as const };
  const tomb = { x: 0, y: 2, kind: 'bigTomb' as const };

  it('敵と障害物を足もとの高さの順に 1 本に並べる（奥の敵は岩より先、手前の敵は岩よりあと）', () => {
    const foes = [
      { id: 'back', feet: feetOf(rock) - 5 },
      { id: 'front', feet: feetOf(rock) + 5 }
    ];
    const out = byFeet(foes, (f) => f.feet, [rock]);
    expect(out.map((x) => ('id' in x ? x.id : 'rock'))).toEqual(['back', 'rock', 'front']);
  });

  it('自分の足もとより手前で、自分の絵に重なる障害物だけを自分のあとに描き直す', () => {
    expect(covers(rock, 0, feetOf(rock) - 12, 16)).toBe(true);
    expect(covers(rock, 0, feetOf(rock) + 4, 16)).toBe(false);
    expect(covers(rock, 60, feetOf(rock) - 12, 16)).toBe(false);
    expect(covers(tomb, 0, -60, 16)).toBe(false);
  });
});
