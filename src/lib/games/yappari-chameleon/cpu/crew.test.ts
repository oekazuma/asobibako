import { describe, expect, it, vi } from 'vitest';
import type { Message } from '$lib/net/link';
import { Party, type Seat } from '$lib/net/party.svelte';
import { Host } from '../host';
import { PODIUM } from '../mansion/lobby';
import { levelOf, mansion, SPAWNS } from '../mansion/layout';
import { DAB_LEN, unpackDabs, type Me } from '../net';
import { bodyPoints } from '../oversight';
import { DEFAULTS, INTRO, PETIT, SHATTER_SECS, type Settings } from '../referee';
import { rng } from '../rng';
import { REVEAL_READY } from './bot';
import { cpuHunters, cpuSettings, Crew } from './crew';
import { OPEN, tube } from './fixtures';
import { pipes } from './pipe';
import { CPU_DEFAULT, SKILLS, type CpuChoice } from './levels';
import type { Senses } from './senses';

const settle = () => new Promise((resolve) => setTimeout(resolve));
const SET: Settings = { ...DEFAULTS, hide: 30, search: 120, reveal: 10, taunt: 0 };

/** 決め打ちの目と筆。プレイヤー（席 1）の体だけが目立ち、CPU の体は目立たない */
const fake: Senses = {
  visible: (seat) => (seat === 1 ? 0.8 : 0),
  colorAt: () => ({ color: [0.4, 0.3, 0.2], metal: 0, rough: 0.8, up: 0 }),
  surface: (_, body) => tube(body)
};

/** 親の端末。審判と CPU を同じ時計で 0.05 秒ずつ進め、プレイヤーの体を決め打ちで送る */
function table(mixed = false) {
  const clock = { ms: 0 };
  const party = Party.host();
  const rand = rng(11);
  const host = new Host(
    party,
    (seed) => levelOf(mansion(seed)),
    () => clock.ms,
    rand
  );
  const crew = new Crew(party, host, rand, mixed);
  crew.useSenses(fake);
  const told: Message[] = [];
  party.onTell((m) => told.push(m));
  let player: Partial<Me> | null = null;
  const run = (secs: number) => {
    for (let t = 0; t < secs - 1e-9; t += 0.05) {
      clock.ms += 50;
      if (player)
        party.act({
          t: 'me',
          ms: clock.ms,
          pos: [0, 0, 0],
          yaw: 0,
          cling: null,
          pose: 'stand',
          crouch: false,
          paint: false,
          look: [0, 0],
          eye: null,
          ...player
        });
      host.tick(0.05);
      crew.step(0.05, clock.ms);
    }
  };
  const until = (done: () => boolean, secs: number) => {
    for (let t = 0; t < secs && !done(); t += 0.05) run(0.05);
    return done();
  };
  const of = (t: string, seat: Seat) => told.filter((m) => m.t === t && m.seat === seat);
  const body = (seat: Seat) => of('me', seat).at(-1) as unknown as Me;
  /** プレイヤーのハンターが、seat の体の胴を真上から撃つ（天井に張り付いた体は天井の中から撃つ。中から始まる線は天井に止められない） */
  const shoot = (seat: Seat, scale = 1) => {
    const [mid] = bodyPoints({ ...body(seat), scale });
    party.act({ t: 'shot', o: [mid[0], mid[1] + 0.6, mid[2]], d: [0, -1, 0], ms: clock.ms });
  };
  const hunterMe: Partial<Me> = { pos: SPAWNS.room[1], pose: 'aim', eye: [SPAWNS.room[1][0], 1, SPAWNS.room[1][2]] };
  return {
    party,
    host,
    crew,
    told,
    run,
    until,
    of,
    body,
    shoot,
    hunterMe,
    setPlayer: (p: Partial<Me> | null) => (player = p)
  };
}

const choice = (c: Partial<CpuChoice>): CpuChoice => ({ ...CPU_DEFAULT, ...c });

describe('CPU と遊ぶの設定', () => {
  it('隠れるは通常で CPU 全員をハンターに、探すは選んだモードでプレイヤーだけをハンターに', () => {
    const s = { ...DEFAULTS, mode: 'double' } as const;
    expect(cpuSettings(s, choice({ side: 'hide', count: 2, mode: 'infect' }))).toMatchObject({
      mode: 'normal',
      hunters: 2
    });
    expect(cpuSettings(s, choice({ side: 'seek', count: 2, mode: 'infect' }))).toMatchObject({
      mode: 'infect',
      hunters: 1
    });
    // 審判の start は渡した設定で許可を上書きするので、ロビーで渡している CPU の設定の許可と同じ値にする
    expect(cpuSettings({ ...s, petit: false }, choice({ petit: true })).petit).toBe(true);
    expect(cpuSettings({ ...s, petit: true }, choice({ petit: false })).petit).toBe(false);
    expect(cpuHunters(choice({ side: 'hide' }), [1, 2, 3])).toEqual([2, 3]);
    expect(cpuHunters(choice({ side: 'seek' }), [1, 2, 3])).toEqual([1]);
  });

  it('CPU と遊ぶでは、ロビーの台をハンター希望に使わない', () => {
    expect(table().host.podium).toBe(false);
  });

  it('人数を 2 → 1 → 2 と変えても、閉じた席が抜け終わってから進め、CPU の印で座る', async () => {
    const t = table();
    await t.crew.seat(choice({ count: 2 }));
    expect(t.party.members).toEqual([1, 2, 3]);
    await t.crew.seat(choice({ count: 1 }));
    expect(t.party.members).toEqual([1, 2]);
    await t.crew.seat(choice({ count: 2, strength: 'strong' }));
    expect(t.party.members).toEqual([1, 2, 3]);
    expect(t.party.looks[3]).toBe('cpu');
    expect(t.crew.bots.map((b) => b.strength)).toEqual(['strong', 'strong']);
    await t.crew.seat(choice({ count: 1 }));
    await t.crew.play(choice({ side: 'seek', count: 1 }), SET);
    expect(Object.keys(t.host.match.roles)).toEqual(['1', '2']);
  });

  it('queue した試合は go で 1 度だけ始める', async () => {
    const t = table();
    const start = vi.spyOn(t.host, 'start');
    await t.crew.seat(CPU_DEFAULT);
    t.crew.queue(CPU_DEFAULT, SET);
    await settle();
    expect(start).not.toHaveBeenCalled();
    expect(t.host.match.phase).toBe('lobby');
    t.crew.go();
    await settle();
    expect(t.host.match.phase).toBe('intro');
    t.crew.go();
    await settle();
    expect(start).toHaveBeenCalledTimes(1);
  });

  it('保存したマップの設定がダブルでも、モードとハンターは CPU の設定で決め直す（queue と go・play のどちらでも）', async () => {
    const double = { ...SET, mode: 'double' } as const;
    const seek = table();
    await seek.crew.seat(choice({ side: 'seek', count: 2 }));
    seek.crew.queue(choice({ side: 'seek', count: 2, mode: 'infect' }), double);
    seek.crew.go();
    await settle();
    expect(seek.host.match.settings.mode).toBe('infect');
    expect(seek.host.match.roles).toEqual({ 1: 'hunter', 2: 'hider', 3: 'hider' });
    const hide = table();
    await hide.crew.play(choice({ side: 'hide', count: 2 }), double);
    expect(hide.host.match.settings.mode).toBe('normal');
    expect(hide.host.match.roles).toEqual({ 1: 'hider', 2: 'hunter', 3: 'hunter' });
  });

  it('重ねて呼んだ席替えは 1 つずつ進め、始まったあとに届いた play は席を変えない', async () => {
    const t = table();
    await Promise.all([t.crew.seat(choice({ count: 2 })), t.crew.seat(choice({ count: 1 }))]);
    expect(t.party.members).toEqual([1, 2]);
    expect(t.crew.bots).toHaveLength(1);
    await Promise.all([t.crew.play(choice({ count: 2 }), SET), t.crew.play(choice({ count: 1 }), SET)]);
    expect(t.party.members).toEqual([1, 2, 3]);
    expect(Object.keys(t.host.match.roles)).toEqual(['1', '2', '3']);
  });

  it('go で始めるのに失敗しても、未処理の reject にせず知らせる', async () => {
    const t = table();
    vi.spyOn(t.host, 'start').mockImplementation(() => {
      throw new Error('boom');
    });
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    t.crew.queue(CPU_DEFAULT, SET);
    t.crew.go();
    await settle();
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ message: 'boom' }));
    error.mockRestore();
  });
});

// 隠れるプレイヤーを置く OPEN が入口と大広間の見回す点から見えることは、hunter.test.ts の「的の点は」が確かめる
describe('CPU との通しの試合', () => {
  it('隠れる（CPU のハンター 1 人・通常）は、目立つプレイヤーを見つけて決着し、ロビーへ戻る', async () => {
    const t = table();
    await t.crew.play(choice({ side: 'hide', count: 1, strength: 'strong' }), SET);
    expect(t.host.match.roles).toEqual({ 1: 'hider', 2: 'hunter' });
    t.setPlayer({ pos: OPEN });
    t.run(INTRO + 0.1);
    expect(t.host.match.ready).toEqual([2]);
    t.party.act({ t: 'ready' });
    expect(t.host.match.phase).toBe('search');
    expect(t.until(() => t.host.match.phase === 'reveal', 60)).toBe(true);
    expect(t.host.match.winner).toBe('hunter');
    expect(t.told.some((m) => m.t === 'splat' && m.by === 2)).toBe(true);
    t.run(REVEAL_READY + 0.1);
    expect(t.host.match.ready).toContain(2);
    t.party.act({ t: 'ready' });
    expect(t.host.match.phase).toBe('lobby');
  });

  it('隠れタイムのあいだ、探す CPU は控室で待ち、頭脳は探索から載せる', async () => {
    const t = table();
    await t.crew.play(choice({ side: 'hide', count: 1 }), SET);
    t.setPlayer({ pos: OPEN });
    t.run(INTRO + 5);
    expect(t.host.match.phase).toBe('hide');
    expect(t.crew.bots[0].hunter).toBeNull();
    expect(t.crew.bots[0].hider).toBeNull();
    expect(t.body(2).pos).toEqual(SPAWNS.room[2]);
    t.party.act({ t: 'ready' });
    t.run(0.1);
    expect(t.crew.bots[0].hunter).not.toBeNull();
  });

  it('隠れる（CPU のハンター 2 人）も決着し、次の試合では頭脳を作り直す', async () => {
    const t = table();
    const c = choice({ side: 'hide', count: 2, strength: 'normal' });
    await t.crew.play(c, SET);
    expect(t.host.match.roles).toEqual({ 1: 'hider', 2: 'hunter', 3: 'hunter' });
    t.setPlayer({ pos: OPEN });
    t.run(INTRO + 0.1);
    expect(t.host.match.ready).toEqual([2, 3]);
    t.party.act({ t: 'ready' });
    expect(t.until(() => t.host.match.phase === 'reveal', 90)).toBe(true);
    expect(t.host.match.winner).toBe('hunter');
    const first = t.crew.bots.map((b) => b.hunter);
    t.run(REVEAL_READY + 0.1);
    t.party.act({ t: 'ready' });
    expect(t.host.match.phase).toBe('lobby');
    await t.crew.play(c, SET);
    t.run(INTRO + 0.1);
    t.party.act({ t: 'ready' });
    t.run(0.1);
    for (const [i, bot] of t.crew.bots.entries()) {
      expect(bot.hunter).not.toBeNull();
      expect(bot.hunter).not.toBe(first[i]);
    }
  });

  it('探す（CPU の隠れる人 1 人・通常）は、CPU が塗って押し、プレイヤーが撃って決着する', async () => {
    const t = table();
    await t.crew.play(choice({ side: 'seek', count: 1 }), SET);
    expect(t.host.match.roles).toEqual({ 1: 'hunter', 2: 'hider' });
    t.setPlayer(t.hunterMe);
    t.run(INTRO + 0.1);
    expect(t.until(() => t.host.match.ready.includes(2), 25)).toBe(true);
    expect(t.host.match.phase).toBe('hide');
    expect(t.of('dabs', 2).length).toBeGreaterThan(0);
    t.party.act({ t: 'ready' });
    expect(t.host.match.phase).toBe('search');
    t.shoot(2);
    expect(t.host.match.found).toEqual([2]);
    expect(t.host.match).toMatchObject({ phase: 'reveal', winner: 'hunter' });
  });

  it('探す（2 人・増え鬼）で見つかった CPU は、破片の間をおいて探す側になり、試合は最後まで進む', async () => {
    const t = table();
    await t.crew.play(choice({ side: 'seek', count: 2, mode: 'infect' }), SET);
    t.setPlayer(t.hunterMe);
    t.run(INTRO + 0.1);
    expect(t.until(() => [2, 3].every((s) => t.host.match.ready.includes(s as Seat)), 25)).toBe(true);
    t.party.act({ t: 'ready' });
    t.shoot(2);
    expect(t.host.match.roles[2]).toBe('hunter');
    expect(t.host.match.phase).toBe('search');
    const before = t.of('me', 2).length;
    t.run(SHATTER_SECS - 0.2);
    expect(t.of('me', 2).length).toBe(before);
    t.run(0.4);
    const turned = t.body(2);
    expect(turned.eye).not.toBeNull();
    expect(turned.cling).toBeNull();
    // 人の子と同じく、ハンターになった体は白に戻す（列を空にする知らせを送る）
    expect(t.of('dabs', 2).at(-1)).toMatchObject({ at: 0, d: [] });
    expect(t.until(() => t.host.match.phase === 'reveal', 130)).toBe(true);
    t.run(REVEAL_READY + 0.1);
    t.party.act({ t: 'ready' });
    expect(t.host.match.phase).toBe('lobby');
  });

  it('隠れタイムが最短の 30 秒でも、強い CPU 2 人は塗りを送り終えてから押す', async () => {
    const t = table();
    await t.crew.play(choice({ side: 'seek', count: 2, strength: 'strong' }), { ...SET, hide: 30 });
    t.setPlayer(t.hunterMe);
    t.run(INTRO + 0.1);
    expect(t.until(() => [2, 3].every((s) => t.host.match.ready.includes(s as Seat)), 29)).toBe(true);
    expect(t.host.match.phase).toBe('hide');
    for (const bot of t.crew.bots) {
      const sent = t.of('dabs', bot.party.me).reduce((n, m) => n + (m.d as number[]).length / DAB_LEN, 0);
      expect(sent).toBe(bot.hider!.log.dabs.length);
      expect(sent).toBeGreaterThan(500);
    }
  });

  it('見つかって観戦になった CPU も、答え合わせで 5 秒たつと押す', async () => {
    const t = table();
    await t.crew.play(choice({ side: 'seek', count: 2 }), SET);
    t.setPlayer(t.hunterMe);
    t.run(INTRO + 0.1);
    t.until(() => [2, 3].every((s) => t.host.match.ready.includes(s as Seat)), 25);
    t.party.act({ t: 'ready' });
    t.shoot(2);
    t.run(2.1);
    t.shoot(3);
    expect(t.host.match.phase).toBe('reveal');
    t.run(REVEAL_READY + 0.1);
    expect(t.host.match.ready).toEqual(expect.arrayContaining([2, 3]));
  });

  it('抜けると CPU も止まり、閉じたあとは CPU も管も何も送らない', async () => {
    const t = table();
    await t.crew.play(choice({ side: 'hide', count: 2 }), SET);
    const heard: Seat[] = [];
    t.party.onAct((_, from) => heard.push(from));
    t.run(1);
    expect(heard.filter((s) => s !== 1).length).toBeGreaterThan(0);
    const bots = [...t.crew.bots];
    const acts = bots.map((b) => vi.spyOn(b.party, 'act'));
    t.crew.stop();
    await settle();
    expect(t.party.members).toEqual([1]);
    heard.length = 0;
    t.run(1);
    t.crew.step(0.05, 1e9);
    for (const b of bots) b.step(0.05, 2e9);
    expect(heard).toEqual([]);
    for (const act of acts) expect(act).not.toHaveBeenCalled();
  });

  it('プチカメレオンを許可した探すでは、隠れる CPU は全員プチで、屋敷の中で同じ大きさの筆で塗り、プチの胴を撃てば見つかる', async () => {
    const t = table();
    await t.crew.play(choice({ side: 'seek', count: 2, petit: true }), SET);
    expect(t.host.match.settings.petit).toBe(true);
    expect(t.host.match.bodies).toMatchObject({ 2: 'petit', 3: 'petit' });
    t.setPlayer(t.hunterMe);
    t.run(INTRO + 0.1);
    expect(t.until(() => [2, 3].every((s) => t.host.match.ready.includes(s as 2 | 3)), 25)).toBe(true);
    const dabs = t.of('dabs', 2).flatMap((m) => unpackDabs(m.d as number[]));
    expect(dabs.length).toBeGreaterThan(0);
    expect(dabs.every((d) => Math.abs(d.r - SKILLS.normal.brush / PETIT) < 1e-3)).toBe(true);
    t.party.act({ t: 'ready' });
    expect(t.host.match.phase).toBe('search');
    t.shoot(2, PETIT);
    expect(t.host.match.found).toEqual([2]);
  });

  it('席に着けなかった CPU がいても、プレイヤー（席 1）の体型は書き換えない', async () => {
    const t = table();
    // 人間の子で席が埋まっていると CPU は着けず、その party.me は初めの 1 のまま bots に残る
    for (let i = 0; i < 2; i++) {
      const [a, b] = pipes();
      Party.guest(b);
      await t.party.add(a);
    }
    await t.crew.seat(choice({ count: 1 }));
    expect(t.crew.bots).toHaveLength(1);
    expect(t.party.members).toEqual([1, 2, 3]);
    await t.crew.play(choice({ side: 'seek', count: 1, petit: true }), SET);
    expect(t.host.match.bodies).toEqual({ 2: 'petit', 3: 'petit' });
  });

  it('許可しないか、CPU が探す側なら、CPU は通常の体', async () => {
    const off = table();
    await off.crew.play(choice({ side: 'seek', count: 1, petit: false }), SET);
    expect(off.host.match.settings.petit).toBe(false);
    const hide = table();
    await hide.crew.play(choice({ side: 'hide', count: 2, petit: true }), SET);
    expect(hide.host.match.bodies).toMatchObject({ 2: 'normal', 3: 'normal' });
  });
});

describe('人の試合の空いた席の CPU', () => {
  it('ロビーの台は使い続け、空いた席に CPU を 1 人座らせて外せる。外した席は切れた席にも CPU の名前にも残さない', async () => {
    const t = table(true);
    expect(t.host.podium).toBe(true);
    const [a, b] = pipes();
    Party.guest(b);
    expect(await t.party.add(a)).toBe(2);
    await t.crew.fillSeat('normal');
    expect(t.party.members).toEqual([1, 2, 3]);
    expect(t.party.looks[3]).toBe('cpu');
    await t.crew.fillSeat('normal');
    expect(t.crew.bots).toHaveLength(1);
    await t.crew.fillSeat(null);
    expect(t.party.members).toEqual([1, 2]);
    expect(t.party.away).toEqual([]);
    expect(t.party.looks[3]).toBeUndefined();
  });

  it('切れた人がいるあいだは CPU を足さず、戻った人は元の席に戻る', async () => {
    const t = table(true);
    const [a, b] = pipes();
    Party.guest(b);
    await t.party.add(a);
    b.close();
    await settle();
    expect(t.party.away).toEqual([2]);
    await t.crew.fillSeat('normal');
    expect(t.crew.bots).toHaveLength(0);
    expect(t.party.members).toEqual([1]);
    const [a2, b2] = pipes();
    Party.guest(b2, { was: 2 });
    expect(await t.party.add(a2)).toBe(2);
    await t.crew.fillSeat('normal');
    expect(t.party.members).toEqual([1, 2, 3]);
  });

  it('CPU が座ったあとに人が切れても、戻った人は元の席に戻り、CPU は席を動かない', async () => {
    const t = table(true);
    const [a, b] = pipes();
    Party.guest(b);
    await t.party.add(a);
    await t.crew.fillSeat('normal');
    b.close();
    await settle();
    expect(t.party.away).toEqual([2]);
    const [a2, b2] = pipes();
    Party.guest(b2, { was: 2 });
    expect(await t.party.add(a2)).toBe(2);
    expect(t.party.members).toEqual([1, 2, 3]);
    expect(t.party.looks[3]).toBe('cpu');
  });

  it('試合が始まったあとは足しも外しもしない', async () => {
    const t = table(true);
    await t.crew.fillSeat('normal');
    t.host.start(SET);
    await t.crew.fillSeat(null);
    expect(t.crew.bots).toHaveLength(1);
    expect(t.party.members).toEqual([1, 2]);
  });

  it('ふつうの始め方では台の希望でハンターを決め、隠れる役の CPU が塗って押す', async () => {
    const t = table(true);
    await t.crew.fillSeat('strong');
    t.setPlayer({ pos: [PODIUM.at[0], PODIUM.h, PODIUM.at[2]] });
    t.run(0.2);
    expect(t.host.match.wishes).toEqual([1]);
    t.host.start({ ...SET, mode: 'normal' });
    expect(t.host.match.roles).toEqual({ 1: 'hunter', 2: 'hider' });
    t.setPlayer(t.hunterMe);
    t.run(INTRO + 0.1);
    expect(t.until(() => t.host.match.ready.includes(2), SET.hide)).toBe(true);
    expect(t.of('dabs', 2).length).toBeGreaterThan(0);
  });

  it('CPU の目の準備は、最初の CPU を座らせるときまで待つ', async () => {
    const t = table(true);
    const warm = vi.fn();
    t.crew.useSenses(fake, warm);
    await t.crew.fillSeat(null);
    expect(warm).not.toHaveBeenCalled();
    await t.crew.fillSeat('normal');
    expect(warm).toHaveBeenCalledTimes(1);
  });
});
