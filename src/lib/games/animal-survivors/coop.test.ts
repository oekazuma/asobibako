import { describe, expect, it } from 'vitest';
import type { Message } from '$lib/net/link';
import { Party, type Pipe } from '$lib/net/party.svelte';
import { CoopGuest, CoopHost } from './coop';
import type { Hero } from './heroes';
import { Prompts } from './prompts.svelte';
import { ENEMIES } from './enemies';
import { createWorld, makeEnemy, step } from './world';

const VIEW = { w: 260, h: 380 };

/** party.svelte.test.ts と同じ、手元でつないだ 2 本の管 */
function pipes(): [Pipe, Pipe] {
  const listeners = [new Set<(m: Message) => void>(), new Set<(m: Message) => void>()];
  const early: Message[][] = [[], []];
  let open = true;
  let close!: () => void;
  const closed = new Promise<void>((resolve) => (close = resolve));
  const end = (me: 0 | 1): Pipe => ({
    send: (m) => {
      if (!open) return;
      const copy = JSON.parse(JSON.stringify(m));
      if (!listeners[1 - me].size) early[1 - me].push(copy);
      for (const l of listeners[1 - me]) l(copy);
    },
    on: (l) => {
      listeners[me].add(l);
      for (const m of early[me].splice(0)) l(m);
      return () => listeners[me].delete(l);
    },
    closed,
    close: () => {
      open = false;
      close();
    }
  });
  return [end(0), end(1)];
}

const settle = () => new Promise((resolve) => setTimeout(resolve));

const owned = (h: Hero) => h.weapons.reduce((n, o) => n + o.level, 0) + h.passives.length;

/** つないで、親の「はじめる」まで進めた組。told は子に届いた知らせの種類 */
async function started() {
  const { host, guest } = await pair();
  const told: string[] = [];
  guest.onTell((m) => told.push(m.t));
  const w = createWorld('dog', 1, VIEW);
  w.stage = { ...w.stage, waves: [] };
  const h = new CoopHost(host, w);
  const g = new CoopGuest(guest, { animal: 'cat', ranks: {}, gear: [] });
  await settle();
  h.start();
  await settle();
  return { host, guest, w, h, g, told };
}

async function pair() {
  const [a, b] = pipes();
  const host = Party.host();
  const guest = Party.guest(b);
  await host.add(a);
  return { host, guest };
}

describe('協力プレイのつなぎ', () => {
  it('子の hi で 2 匹めが入り、子の位置が親の World に届き、snap で子の画面に敵が出る', async () => {
    const { host, guest } = await pair();
    const w = createWorld('dog', 1, VIEW);
    w.stage = { ...w.stage, waves: [] };
    const h = new CoopHost(host, w);
    const g = new CoopGuest(guest, { animal: 'cat', ranks: {}, gear: [] });
    await settle();
    expect(h.ready).toBe(true);
    h.start();
    await settle();
    expect(g.view?.heroes).toHaveLength(2);
    w.enemies.push(makeEnemy(ENEMIES.caterpillar, 40, 0, 50));
    g.move({ x: 1, y: 0 }, 0.5);
    await settle();
    h.before();
    step(w, { x: 0, y: 0 }, 1 / 60);
    h.after(0.06);
    await settle();
    expect(w.heroes[1].player.x).toBeGreaterThan(40);
    g.frame(performance.now() + 1000);
    expect(g.view!.enemies.some((e) => e.alive)).toBe(true);
  });

  it('版がちがう子には mismatch を返して 2 匹めを入れない', async () => {
    const { host, guest } = await pair();
    const w = createWorld('dog', 1, VIEW);
    const h = new CoopHost(host, w);
    const told: string[] = [];
    guest.onTell((m) => told.push(m.t));
    guest.act({ t: 'hi', v: 0, animal: 'cat', ranks: {}, gear: [] });
    await settle();
    expect(h.ready).toBe(false);
    expect(w.heroes).toHaveLength(1);
    expect(told).toContain('coop-mismatch');
  });

  it('snap が届く前の子の画面でも frame が投げない', async () => {
    const { host, guest } = await pair();
    const h = new CoopHost(host, createWorld('dog', 1, VIEW));
    const g = new CoopGuest(guest, { animal: 'cat', ranks: {}, gear: [] });
    await settle();
    h.start();
    await settle();
    expect(() => g.frame(performance.now())).not.toThrow();
  });

  it('子の画面の出来事は、新しい snap を見せたときに 1 回だけ渡す', async () => {
    const { host, guest } = await pair();
    const w = createWorld('dog', 1, VIEW);
    w.stage = { ...w.stage, waves: [] };
    const h = new CoopHost(host, w);
    const g = new CoopGuest(guest, { animal: 'cat', ranks: {}, gear: [] });
    await settle();
    h.start();
    await settle();
    w.events.push({ type: 'levelup' });
    h.after(0.06);
    await settle();
    const now = performance.now() + 1000;
    g.frame(now);
    expect(g.view!.events).toEqual([{ type: 'levelup' }]);
    g.frame(now + 16);
    expect(g.view!.events).toEqual([]);
  });

  it('子の動物は、親から届いた遅さで遅くなる', async () => {
    const run = async (slow: number) => {
      const { host, guest } = await pair();
      const w = createWorld('dog', 1, VIEW);
      w.stage = { ...w.stage, waves: [] };
      const h = new CoopHost(host, w);
      const g = new CoopGuest(guest, { animal: 'cat', ranks: {}, gear: [] });
      await settle();
      h.start();
      await settle();
      w.heroes[1].player.slow = slow;
      h.after(0.06);
      await settle();
      g.frame(performance.now() + 1000);
      const p = g.view!.heroes[1].player;
      const x = p.x;
      g.move({ x: 1, y: 0 }, 1);
      return p.x - x;
    };
    expect(await run(1)).toBeLessThan(await run(0));
  });

  it('子の 3 択は子へ送られ、子が選ぶと子の動物に入り、返事の前には送り直さない', async () => {
    const { w, h, g, told } = await started();
    w.heroes[1].pending = 1;
    h.before();
    h.before();
    await settle();
    expect(g.prompts?.options).toHaveLength(3);
    expect(told.filter((t) => t === 'offer')).toHaveLength(1);
    const before = owned(w.heroes[1]);
    g.prompts!.choose(g.prompts!.options![0], null);
    await settle();
    h.before();
    expect(w.heroes[1].pending).toBe(0);
    expect(owned(w.heroes[1])).toBeGreaterThan(before);
    expect(w.cur).toBe(0);
  });

  it('子が拾った宝箱は子の端末で開け、とじるで親のゲームが進む', async () => {
    const { w, h, g } = await started();
    w.heroes[1].chests = 1;
    h.before();
    await settle();
    expect(g.prompts?.rewards?.length).toBeGreaterThan(0);
    expect(w.heroes[1].chests).toBe(0);
    g.prompts!.close(null);
    await settle();
    w.heroes[1].pending = 1;
    h.before();
    await settle();
    expect(g.prompts?.options).toHaveLength(3);
  });

  it('remote の Prompts は World の 3 択を自分で開かない', () => {
    const w = createWorld('dog', 1, VIEW);
    w.pending = 1;
    const p = new Prompts(w, true, { send: () => {} });
    p.next(null);
    expect(p.options).toBeNull();
  });

  it('子が止めると親も止まり、子のつづけるで再開し、止まっていたあいだの位置は捨てる', async () => {
    const { w, h, g } = await started();
    g.pause();
    await settle();
    expect(h.paused).toBe('guest');
    expect(g.paused).toBe('guest');
    g.move({ x: 1, y: 0 }, 2);
    await settle();
    g.resume();
    await settle();
    expect(h.paused).toBeNull();
    expect(g.paused).toBeNull();
    const x = w.heroes[1].player.x;
    h.before();
    expect(w.heroes[1].player.x).toBe(x);
  });

  it('親が止めると子の画面にも知らせが届き、止めていない子は再開できない', async () => {
    const { h, g } = await started();
    h.pause();
    await settle();
    expect(g.paused).toBe('host');
    g.resume();
    await settle();
    expect(h.paused).toBe('host');
    h.resume();
    await settle();
    expect(g.paused).toBeNull();
  });
});
