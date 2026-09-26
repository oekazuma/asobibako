import { describe, expect, it } from 'vitest';
import {
  add,
  groups,
  hatch,
  isLoop,
  parade,
  poke,
  random,
  speck,
  step,
  type Point,
  type Stroke,
  type World
} from './engine';

const ring = (cx: number, cy: number, r: number, turns = 1): Point[] =>
  Array.from({ length: 20 }, (_, i) => {
    const t = (i / 19) * Math.PI * 2 * turns;
    return [cx + Math.cos(t) * r, cy + Math.sin(t) * r];
  });

const line = (x0: number, y0: number, x1: number, y1: number): Point[] =>
  Array.from({ length: 10 }, (_, i) => [x0 + ((x1 - x0) * i) / 9, y0 + ((y1 - y0) * i) / 9]);

const s = (pts: Point[]): Stroke => ({ color: 'c', pts });
const body = s(ring(0.5, 0.5, 0.1));
const roles = (strokes: Stroke[]) => hatch(strokes)!.parts.map((p) => p.role);

describe('isLoop', () => {
  it('まるは体になり、線や小さな輪はならない', () => {
    expect(isLoop(ring(0.5, 0.5, 0.08))).toBe(true);
    expect(isLoop(line(0.1, 0.1, 0.5, 0.2))).toBe(false);
    expect(isLoop(ring(0.5, 0.5, 0.01))).toBe(false);
  });

  it('閉じきっていなくても、4 分の 3 周以上回っていれば体になる', () => {
    expect(isLoop(ring(0.5, 0.5, 0.08, 0.8))).toBe(true);
    expect(isLoop(ring(0.5, 0.5, 0.08, 0.5))).toBe(false);
  });
});

describe('hatch', () => {
  it('何も描いていなければ生まれない', () => {
    expect(hatch([])).toBeNull();
  });

  it('まるだけなら跳ね、目を付ける', () => {
    const c = hatch([body])!;
    expect(c.kind).toBe('hop');
    expect(c.eyes).toBe(true);
  });

  it('体の中に描いた点や線は顔になり、目は付けない。あとから描いた体も顔の下に敷く', () => {
    const eye: Stroke = s([[0.47, 0.47]]);
    const c = hatch([eye, s(line(0.46, 0.55, 0.54, 0.55)), body])!;
    expect(c.parts.map((p) => p.role)).toEqual(['body', 'face', 'face']);
    expect(c.eyes).toBe(false);
  });

  it('体の下に出した輪は足になって歩く（カービィ）', () => {
    const feet = [s(ring(0.45, 0.62, 0.04)), s(ring(0.55, 0.62, 0.04))];
    const c = hatch([body, ...feet])!;
    expect(c.kind).toBe('walk');
    expect(roles([body, ...feet]).filter((r) => r === 'leg')).toHaveLength(2);
    expect(c.parts.find((p) => p.role === 'leg')!.filled).toBe(true);
  });

  it('横に出した短いものは腕になって飛び、上に出したものは触角になる', () => {
    const wings = [s(line(0.4, 0.5, 0.3, 0.45)), s(line(0.6, 0.5, 0.7, 0.45))];
    expect(hatch([body, ...wings])!.kind).toBe('fly');
    expect(roles([body, s(line(0.5, 0.4, 0.5, 0.3))])).toContain('top');
    const long = [s(line(0.4, 0.5, 0.1, 0.45)), s(line(0.6, 0.5, 0.9, 0.45))];
    expect(hatch([body, ...long])!.kind).toBe('fly');
  });

  it('棒人間は体から離れた線を振らず、ばらばらにならない', () => {
    const head = s(ring(0.5, 0.2, 0.05));
    const torso = s(line(0.5, 0.25, 0.5, 0.45));
    const legs = [s(line(0.5, 0.45, 0.45, 0.6)), s(line(0.5, 0.45, 0.55, 0.6))];
    expect(roles([head, torso, ...legs])).toEqual(['still', 'still', 'still', 'body']);
  });

  it('長いしっぽがあれば、どちら向きに描いても頭の側へ這う（むかしのムシ）', () => {
    for (const tail of [line(0.6, 0.5, 0.9, 0.5), line(0.9, 0.5, 0.6, 0.5)]) {
      const c = hatch([body, s(tail)])!;
      expect(c.kind).toBe('crawl');
      expect(c.dir).toBe(-1);
    }
  });

  it('まるのない絵も、全体をくねらせて這う', () => {
    const c = hatch([s(line(0.1, 0.5, 0.4, 0.5))])!;
    expect(c.kind).toBe('crawl');
    expect(c.eyes).toBe(false);
  });
});

describe('step', () => {
  it('画面の端で折り返し、外へ出ていかない', () => {
    for (let seed = 0; seed < 8; seed++) {
      let n = seed + 1;
      const rand = () => (n = (n * 16807) % 2147483647) / 2147483647;
      const world: World = { aspect: 0.75, creatures: [random(0.75, rand)] };
      for (let i = 0; i < 1200; i++) {
        step(world, 0.05);
        const c = world.creatures[0];
        expect(c.x + c.box[0]).toBeGreaterThan(-0.05);
        expect(c.x + c.box[2]).toBeLessThan(0.8);
        expect(c.y + c.box[1]).toBeGreaterThan(-0.05);
        expect(c.y + c.box[3]).toBeLessThan(1.05);
      }
    }
  });
});

describe('poke', () => {
  const tap = (x: number, y: number): Stroke => ({ color: 'c', pts: [[x, y]] });

  it('画面の子をタップすると跳ね、跳ね終わると元に戻る', () => {
    const world: World = { aspect: 1, creatures: [hatch([body])!] };
    expect(poke(world, [], tap(0.9, 0.9))).toBe(false);
    expect(poke(world, [], tap(0.5, 0.5))).toBe(true);
    step(world, 0.2);
    expect(world.creatures[0].jump).toBeGreaterThan(0);
    step(world, 1);
    expect(world.creatures[0].jump).toBe(-1);
  });

  it('線を引いたときや、描きかけの絵のそばの点では跳ねない', () => {
    const world: World = { aspect: 1, creatures: [hatch([body])!] };
    expect(poke(world, [], s(line(0.45, 0.5, 0.55, 0.5)))).toBe(false);
    expect(poke(world, [s(ring(0.52, 0.52, 0.05))], tap(0.5, 0.5))).toBe(false);
    expect(world.creatures[0].jump).toBe(-1);
  });
});

describe('speck', () => {
  const tap = (x: number, y: number): Stroke => ({ color: 'c', pts: [[x, y]] });

  it('タップ 1 つは点だけの子', () => {
    expect(speck([tap(0.5, 0.5)])).toBe(true);
  });

  it('近くに打った 2 つのタップも点だけの子', () => {
    expect(speck([tap(0.5, 0.5), tap(0.51, 0.5)])).toBe(true);
  });

  it('小さくても輪は点だけの子ではない', () => {
    expect(speck([s(ring(0.5, 0.5, 0.05))])).toBe(false);
  });
});

describe('parade', () => {
  it('足もとをそろえて左の外から並び、右へ抜けた子は列のうしろへ回る', () => {
    const world: World = { aspect: 0.75, creatures: [hatch([body])!] };
    const kids = [[body], [body, s(ring(0.45, 0.62, 0.04))], [s(line(0.1, 0.5, 0.3, 0.5))]];
    parade(world, kids);
    expect(world.creatures).toHaveLength(3);
    const feet = world.creatures.map((c) => c.y + c.box[3]);
    expect(new Set(feet.map((f) => f.toFixed(6))).size).toBe(1);
    expect(world.creatures.every((c) => c.x + c.box[2] <= 0)).toBe(true);
    for (let i = 0; i < 400; i++) {
      step(world, 0.05);
      for (const c of world.creatures) expect(c.x + c.box[0]).toBeLessThanOrEqual(0.75 + 0.01);
    }
    expect(world.creatures.some((c) => c.x + c.box[2] > 0)).toBe(true);
  });
});

describe('groups', () => {
  it('離れて描いた絵は別の子に、重なったり近かったりする線は同じ子にまとめる', () => {
    const kirby = [body, s([[0.47, 0.47]]), s(ring(0.45, 0.62, 0.04))];
    const worm = [s(ring(0.2, 0.1, 0.05)), s(line(0.25, 0.1, 0.4, 0.1))];
    const [a, b] = groups([worm[0], ...kirby, worm[1]]);
    expect(a).toEqual(worm);
    expect(b).toEqual(kirby);
  });
});

describe('add', () => {
  it('あふれたら自由に動く子から下がり、パレードの列の子は残す', () => {
    const world: World = { aspect: 1, creatures: [] };
    parade(
      world,
      Array.from({ length: 12 }, () => [body])
    );
    for (let i = 0; i < 14; i++) add(world, hatch([body])!);
    expect(world.creatures.filter((c) => c.march)).toHaveLength(12);
    expect(world.creatures.filter((c) => !c.march)).toHaveLength(12);
  });
});
