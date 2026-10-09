import { describe, expect, it } from 'vitest';
import type { Message } from '$lib/net/link';
import type { Seat } from '$lib/net/party.svelte';
import type { V3 } from '$lib/sculpt';
import { Host, type Port } from './host';
import type { Level } from './move';
import { CHAMELEON_VERSION, packDabs, splice, unpackDabs, type Me } from './net';
import type { Dab } from './paint';
import { DEFAULTS, type Settings, type View } from './referee';

const floor: Level = { boxes: [{ min: [-20, -1, -20], max: [20, 0, 20] }], ramps: [], spawn: [0, 0, 0] };

function setup(members: Seat[] = [1, 2, 3]) {
  const told: { to: Seat | 'all'; m: Message }[] = [];
  let listener: (m: Message, from: Seat) => void = () => {};
  const port: Port & { members: Seat[] } = {
    members,
    // Link と同じく JSON で渡す
    tell: (to, m) => told.push({ to, m: JSON.parse(JSON.stringify(m)) }),
    onAct: (l) => {
      listener = l;
      return () => {};
    }
  };
  const clock = { ms: 0 };
  const host = new Host(
    port,
    floor,
    () => clock.ms,
    () => 0
  );
  const act = (m: Message, from: Seat) => listener(m, from);
  for (const s of members) if (s !== 1) act({ t: 'hi', v: CHAMELEON_VERSION }, s);
  return { host, port, told, act, clock };
}

const me = (ms: number, pos: V3, extra: Partial<Me> = {}): Message =>
  ({
    t: 'me',
    ms,
    pos,
    yaw: 0,
    cling: null,
    pose: 'stand',
    crouch: false,
    paint: false,
    look: [0, 0],
    ...extra
  }) as Message;

const views = (told: { m: Message }[]) => told.filter((x) => x.m.t === 'phase').map((x) => x.m.view as View);
const lastView = (told: { m: Message }[]) => views(told).at(-1)!;
const of = (told: { m: Message }[], t: string) => told.filter((x) => x.m.t === t).map((x) => x.m);

/** 3 人で始め（3 番がハンター）、探索まで進める */
function searching(settings: Partial<Settings> = {}) {
  const s = setup();
  s.act({ t: 'wish', on: true }, 3);
  s.host.start({ ...DEFAULTS, ...settings });
  for (let i = 0; i < 64 * 10; i++) s.host.tick(0.1);
  expect(lastView(s.told).phase).toBe('search');
  return s;
}

/** 隠れる人 2 は z = 5 に立ち、ハンター 3 は原点から +z を向いて撃つ */
const SHOT = { t: 'shot', o: [0, 0.75, 0], d: [0, 0, 1] };

describe('Host の中継', () => {
  it('動きと吹き付けは、送った人のほかの全員へ席を付けて配る', () => {
    const { act, told } = setup();
    act(me(0, [1, 0, 1]), 2);
    const relayed = of(told, 'me');
    expect(told.filter((x) => x.m.t === 'me').map((x) => x.to)).toEqual([1, 3]);
    expect(relayed[0].seat).toBe(2);
  });

  it('形の壊れた動きと吹き付けは配らない', () => {
    const { act, told } = setup();
    act({ t: 'me', ms: 0, pos: [0, 0] }, 2);
    act({ t: 'dabs', at: 1, d: [] }, 2);
    act({ t: 'dabs', at: 0, d: [1, 2, 3] }, 2);
    expect(told).toEqual([]);
  });

  it('版のちがう子には知らせ、その子の動きは配らない', () => {
    const { act, told } = setup([1, 2]);
    act({ t: 'leave' }, 2);
    act({ t: 'hi', v: CHAMELEON_VERSION + 1 }, 2);
    expect(told.at(-1)).toEqual({ to: 2, m: { t: 'chameleon-mismatch' } });
    act(me(0, [1, 0, 1]), 2);
    expect(of(told, 'me')).toEqual([]);
  });
});

describe('Host の試合', () => {
  it('始めると紹介を配り、3 秒で隠れタイムになる。2 人そろわないと始めない', () => {
    const lone = setup([1]);
    lone.host.start(DEFAULTS);
    expect(views(lone.told)).toEqual([]);
    const { host, told } = setup();
    host.start(DEFAULTS);
    expect(lastView(told).phase).toBe('intro');
    for (let i = 0; i < 30; i++) host.tick(0.1);
    expect(lastView(told).phase).toBe('hide');
  });

  it('試合中の start は無視する', () => {
    const { host, told } = setup();
    host.start(DEFAULTS);
    for (let i = 0; i < 30; i++) host.tick(0.1);
    const n = views(told).length;
    host.start({ ...DEFAULTS, hunters: 2 });
    expect(views(told).length).toBe(n);
    expect(lastView(told).phase).toBe('hide');
  });

  it('残り秒しか変わらないあいだは 1 秒ごとに配る', () => {
    const { host, told } = setup();
    host.start({ ...DEFAULTS, hide: 60 });
    for (let i = 0; i < 40; i++) host.tick(0.1);
    const n = views(told).length;
    for (let i = 0; i < 20; i++) host.tick(0.1);
    expect(views(told).length - n).toBe(2);
  });
});

describe('Host の当たり', () => {
  it('隠れる人に当たれば found と splat を全員へ配り、2 秒以内の次の弾は捨てる', () => {
    const { act, told, host } = searching();
    act(me(0, [0, 0, 5]), 2);
    act(me(0, [0, 0, 0]), 3);
    act({ ...SHOT, ms: 0 }, 3);
    const found = of(told, 'found');
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ seat: 2, by: 3 });
    expect((found[0].body as Me).pos).toEqual([0, 0, 5]);
    expect(of(told, 'splat')).toHaveLength(1);
    expect(lastView(told).found).toEqual([2]);
    host.tick(1);
    act({ ...SHOT, ms: 1000 }, 3);
    expect(of(told, 'splat')).toHaveLength(1);
  });

  it('撃った人や、ほかのハンターの体は弾を止めない', () => {
    const { act, told } = searching({ mode: 'infect', hunters: 2 });
    const hunters = (Object.entries(lastView(told).roles) as [string, string][])
      .filter(([, r]) => r === 'hunter')
      .map(([s]) => Number(s) as Seat);
    const hider = ([1, 2, 3] as Seat[]).find((s) => !hunters.includes(s))!;
    act(me(0, [0, 0, 5]), hider);
    act(me(0, [0, 0, 0]), hunters[0]);
    act(me(0, [0, 0, 1]), hunters[1]);
    act({ ...SHOT, ms: 0 }, hunters[0]);
    expect(of(told, 'found')[0]).toMatchObject({ seat: hider, by: hunters[0] });
  });

  it('形の壊れた弾は捨てる', () => {
    const { act, told } = searching();
    act(me(0, [0, 0, 0]), 3);
    act({ t: 'shot', ms: 0 }, 3);
    act({ t: 'shot', o: [0, 0, 0], d: [0, 0, 0], ms: 0 }, 3);
    act({ t: 'shot', o: [0, 0, 'x'], d: [0, 0, 1], ms: 0 }, 3);
    expect(of(told, 'splat')).toEqual([]);
  });

  it('撃ち返しの間が 2.0 秒を少し切って届いても受け、1 秒では捨てる', () => {
    const { act, told, host } = searching();
    act(me(0, [0, 0, 0]), 3);
    act({ t: 'shot', o: [0, 1, 0], d: [0, -1, 0], ms: 0 }, 3);
    for (let i = 0; i < 19; i++) host.tick(0.1);
    act({ t: 'shot', o: [0, 1, 0], d: [0, -1, 0], ms: 1900 }, 3);
    expect(of(told, 'splat')).toHaveLength(2);
    for (let i = 0; i < 10; i++) host.tick(0.1);
    act({ t: 'shot', o: [0, 1, 0], d: [0, -1, 0], ms: 2900 }, 3);
    expect(of(told, 'splat')).toHaveLength(2);
  });

  it.each([
    ['0.04 秒前（50ms の巻き戻しで届く）', 260],
    ['0.06 秒前（100ms の巻き戻しだけ届く）', 240]
  ])('撃つ少し前に動いた隠れる人は、巻き戻しで見つかる（%s）', (_, moved) => {
    const { act, told, clock } = searching();
    for (let t = 0; t <= 300; t += 10) {
      clock.ms = t;
      act(me(t, [0, 0, 0]), 3);
      act(me(t, [t >= moved ? 3 : 0, 0, 5]), 2);
    }
    act({ ...SHOT, ms: 300 }, 3);
    expect(of(told, 'found')).toHaveLength(1);
  });

  it('外れた線は面に当たった所としぶきの向きを返す', () => {
    const { act, told } = searching();
    act(me(0, [0, 0, 0]), 3);
    act({ t: 'shot', o: [0, 1, 0], d: [0, -1, 0], ms: 0 }, 3);
    const splat = of(told, 'splat')[0];
    expect((splat.marks as { n: V3 }[])[0].n).toEqual([0, 1, 0]);
    // 銃口が届いていなければ、筋は撃った所から引く
    expect(splat.from).toEqual([0, 1, 0]);
    expect((splat.ends as V3[]).length).toBe(5);
  });

  it('同じ時刻に 2 人のハンターが同じ人を撃っても、見つかるのは 1 度だけ', () => {
    const { act, told } = searching({ mode: 'infect', hunters: 2 });
    const hunters = (Object.entries(lastView(told).roles) as [string, string][])
      .filter(([, r]) => r === 'hunter')
      .map(([s]) => Number(s) as Seat);
    const hider = ([1, 2, 3] as Seat[]).find((s) => !hunters.includes(s))!;
    act(me(0, [0, 0, 5]), hider);
    for (const h of hunters) act(me(0, [0, 0, 0]), h);
    for (const h of hunters) act({ ...SHOT, ms: 0 }, h);
    expect(of(told, 'found')).toHaveLength(1);
    expect(of(told, 'splat')).toHaveLength(2);
    expect(lastView(told).phase).toBe('reveal');
    expect(lastView(told).winner).toBe('hunter');
  });

  it('時計のずれた子の弾も、撃った時刻の体で決める（撃ったあとに動いた体にも当たる）', () => {
    const { act, told, clock } = searching();
    // 子 3 の時計は親より 1000 秒進んでいる。届くまで 30ms
    const skew = 1_000_000;
    for (let t = 0; t <= 300; t += 50) {
      clock.ms = t + 30;
      act(me(t + skew, [0, 0, 0]), 3);
      act(me(t, [0, 0, 5]), 2);
    }
    // 親の時計で 300ms に撃った。2 はその直後に横へ 3m 動いた
    for (let t = 350; t <= 500; t += 50) {
      clock.ms = t + 30;
      act(me(t, [3, 0, 5]), 2);
    }
    clock.ms = 540;
    act({ ...SHOT, ms: 300 + skew }, 3);
    expect(of(told, 'found')).toHaveLength(1);
  });

  it('切れた隠れる人の体はその場に残り、撃てば見つかる', () => {
    const { act, told, port } = searching({ mode: 'normal' });
    act(me(0, [0, 0, 5]), 2);
    port.members = [1, 3];
    act({ t: 'leave' }, 2);
    act(me(0, [0, 0, 0]), 3);
    act({ ...SHOT, ms: 0 }, 3);
    expect(of(told, 'found')[0]).toMatchObject({ seat: 2 });
  });

  it('ハンターが全員切れると、隠れる人の勝ちで答え合わせへ', () => {
    const { act, told, port } = searching();
    port.members = [1, 2];
    act({ t: 'leave' }, 3);
    expect(lastView(told)).toMatchObject({ phase: 'reveal', winner: 'chameleon' });
  });

  it('強制挑発は、吹いた人のいる所を全員へ配る', () => {
    const { act, told, host } = searching({ taunt: 5 });
    act(me(0, [2, 0, 3]), 1);
    for (let i = 0; i < 50; i++) host.tick(0.1);
    expect(of(told, 'toot')).toContainEqual({ t: 'toot', seat: 1, at: [2, 0, 3] });
  });
});

describe('Host の戻った子', () => {
  const paint = (n: number): Dab[] =>
    Array.from({ length: n }, (_, i) => ({
      p: [i / 100, 1, 0],
      n: [0, 0, 1],
      r: 0.05,
      c: [1, 0, 0],
      a: 0.3,
      m: 0,
      ro: 0.8
    }));

  it('ロビーや紹介に入ったら、いなかった席の古い塗りは捨てる', () => {
    const { act, told, port, host } = setup();
    act({ t: 'dabs', at: 0, d: packDabs(paint(2)) }, 2);
    port.members = [1, 3];
    act({ t: 'leave' }, 2);
    host.start(DEFAULTS);
    told.length = 0;
    port.members = [1, 2, 3];
    act({ t: 'hi', v: CHAMELEON_VERSION }, 2);
    act({ t: 'join' }, 2);
    expect(told.filter((x) => x.to === 2 && x.m.t === 'dabs')).toEqual([]);
    act({ t: 'dabs', at: 0, d: packDabs(paint(1)) }, 2);
    expect(of(told, 'dabs')).toHaveLength(2);
  });

  it('戻った子へ、全員の体・塗り・今の様子をこの順に送り、塗りは作り直せる', () => {
    const { act, told, port, host } = searching({ mode: 'normal' });
    act(me(0, [0, 0, 5]), 2);
    act({ t: 'dabs', at: 0, d: packDabs(paint(3000)) }, 2);
    act({ t: 'dabs', at: 2990, d: packDabs(paint(5)) }, 2);
    act({ t: 'dabs', at: 0, d: packDabs(paint(4)) }, 1);
    act(me(0, [0, 0, 0]), 3);
    act({ ...SHOT, ms: 0 }, 3);
    host.tick(300);
    expect(lastView(told).phase).toBe('reveal');
    port.members = [1, 3];
    act({ t: 'leave' }, 2);
    told.length = 0;
    port.members = [1, 2, 3];
    act({ t: 'join' }, 2);
    const mine = told.filter((x) => x.to === 2).map((x) => x.m);
    expect(mine[0]).toMatchObject({ t: 'me', seat: 2, pos: [0, 0, 5] });
    expect(mine.filter((m) => m.t === 'me').map((m) => m.seat)).toEqual([2, 3]);
    expect(mine.findIndex((m) => m.t === 'phase')).toBe(mine.length - 1);
    const logs = new Map<number, Dab[]>();
    for (const m of mine.filter((m) => m.t === 'dabs')) {
      const log = logs.get(m.seat as number) ?? [];
      logs.set(m.seat as number, log);
      expect(splice(log, m.at as number, unpackDabs(m.d as number[]))).not.toBeNull();
    }
    expect(logs.get(2)).toHaveLength(2995);
    expect(logs.get(1)).toHaveLength(4);
    const v = mine.at(-1)!.view as View;
    expect(v).toMatchObject({ phase: 'reveal', winner: 'chameleon', found: [2] });
    // 見つかったときの体も、演出なしで送り直す
    expect(mine.find((m) => m.t === 'found')).toMatchObject({ seat: 2, quiet: true, body: { pos: [0, 0, 5] } });
  });
});
