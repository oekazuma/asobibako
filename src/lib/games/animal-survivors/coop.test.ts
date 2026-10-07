import { describe, expect, it, vi } from 'vitest';
import type { Message } from '$lib/net/link';
import { Party, type Pipe } from '$lib/net/party.svelte';
import { CoopGuest, CoopHost } from './coop';
import type { Hero } from './heroes';
import { Prompts } from './prompts.svelte';
import { ENEMIES } from './enemies';
import { gainXp } from './drops';
import { startOvertime } from './overtime';
import { emptyRecords, loadRecords, RECORDS_KEY } from './records';
import { createWorld, makeEnemy, step } from './world';
import { obstacleAt, obstaclesNear, PLAYER_R, SHAPES, SQUASH } from './obstacles';

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

/** 記録を見るテストのための、メモリの localStorage（このファイルは DOM の無い環境で動く） */
function memoryStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    }
  };
}

const settle = () => new Promise((resolve) => setTimeout(resolve));

const owned = (h: Hero) => h.weapons.reduce((n, o) => n + o.level, 0) + h.passives.length;

/** つないで、親の「はじめる」まで進めた組。told は子に届いた知らせの種類 */
async function started() {
  const { host, guest, pipe } = await pair();
  const told: string[] = [];
  guest.onTell((m) => told.push(m.t));
  const w = createWorld('dog', 1, VIEW);
  w.stage = { ...w.stage, waves: [] };
  const h = new CoopHost(host);
  const g = new CoopGuest(guest, { animal: 'cat', ranks: {}, gear: [] });
  await settle();
  h.start(w);
  await settle();
  return { host, guest, w, h, g, told, pipe };
}

async function pair() {
  const [a, b] = pipes();
  const host = Party.host();
  const guest = Party.guest(b);
  await host.add(a);
  return { host, guest, pipe: b };
}

describe('協力プレイのつなぎ', () => {
  it('風の祠のご利益は、子の端末での子の動物の動きにも効く', async () => {
    const { g, w, h } = await started();
    w.heroes[1].blessing.speed = 10;
    h.after(0.06);
    await settle();
    g.frame(performance.now() + 1000);
    const v = g.view!;
    const me = v.heroes[v.cur].player;
    const x0 = me.x;
    g.move({ x: 1, y: 0 }, 0.1);
    expect(me.x - x0).toBeCloseTo(60 * v.heroes[v.cur].stats.speed * 1.3 * 0.1, 1);
  });

  it('子の端末で動かした子の動物も、障害物の中に入らない', async () => {
    const { g } = await started();
    const v = g.view!;
    const me = v.heroes[v.cur].player;
    let o = null;
    for (let c = 1; !o; c++) o = obstacleAt(v.stage.art, c, 0);
    Object.assign(me, { x: o.x - 60, y: o.y });
    for (let i = 0; i < 120; i++) {
      g.move({ x: 1, y: 0 }, 1 / 30);
      const hit = obstaclesNear(v.stage.art, me.x, me.y, PLAYER_R, []).some((ob) =>
        SHAPES[ob.kind].circles.some(
          ([dx, dy, r]) => Math.hypot(me.x - ob.x - dx, (me.y - ob.y - dy) / SQUASH) < PLAYER_R + r - 0.01
        )
      );
      expect(hit).toBe(false);
    }
  });

  it('子の hi で 2 匹めが入り、子の位置が親の World に届き、snap で子の画面に敵が出る', async () => {
    const { host, guest } = await pair();
    const w = createWorld('dog', 1, VIEW);
    w.stage = { ...w.stage, waves: [] };
    const h = new CoopHost(host);
    const g = new CoopGuest(guest, { animal: 'cat', ranks: {}, gear: [] });
    await settle();
    expect(h.ready).toBe(true);
    h.start(w);
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

  it('子が動物を選ぶまでは始められず、選ぶと始めたときに子の動物が入る', async () => {
    const { host, guest } = await pair();
    const w = createWorld('dog', 1, VIEW);
    const h = new CoopHost(host);
    const g = new CoopGuest(guest);
    const told: string[] = [];
    guest.onTell((m) => told.push(m.t));
    await settle();
    expect(h.ready).toBe(false);
    expect(h.guest).toBeNull();
    g.pick({ animal: 'wolf', ranks: { might: 2 }, gear: [] });
    await settle();
    expect(h.ready).toBe(true);
    expect(h.guest?.animal).toBe('wolf');
    expect(told).toContain('picked');
    h.start(w);
    await settle();
    expect(w.heroes.map((x) => x.animal.id)).toEqual(['dog', 'wolf']);
    expect(g.view?.heroes[1].animal.id).toBe('wolf');
  });

  it('版がちがう子には mismatch を返して 2 匹めを入れない', async () => {
    const { host, guest } = await pair();
    const w = createWorld('dog', 1, VIEW);
    const h = new CoopHost(host);
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
    const h = new CoopHost(host);
    const g = new CoopGuest(guest, { animal: 'cat', ranks: {}, gear: [] });
    await settle();
    h.start(createWorld('dog', 1, VIEW));
    await settle();
    expect(() => g.frame(performance.now())).not.toThrow();
  });

  it('子の画面の出来事は、新しい snap を見せたときに 1 回だけ渡す', async () => {
    const { host, guest } = await pair();
    const w = createWorld('dog', 1, VIEW);
    w.stage = { ...w.stage, waves: [] };
    const h = new CoopHost(host);
    const g = new CoopGuest(guest, { animal: 'cat', ranks: {}, gear: [] });
    await settle();
    h.start(w);
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
      const h = new CoopHost(host);
      const g = new CoopGuest(guest, { animal: 'cat', ranks: {}, gear: [] });
      await settle();
      h.start(w);
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

  it('倒れて終わると、親と子がそれぞれ自分の記録に入れ、子は子の動物のぶんでリザルトを出す', async () => {
    vi.stubGlobal('localStorage', memoryStorage());
    localStorage.setItem(RECORDS_KEY, JSON.stringify(emptyRecords()));
    const { w, h, g } = await started();
    w.kills = 77;
    w.time = 123;
    w.over = 'dead';
    h.finish(true);
    await settle();
    expect(h.result?.run.animal).toBe('dog');
    expect(g.result?.run.animal).toBe('cat');
    // 同じ localStorage を 2 台で使っているので、2 回ぶん入る
    expect(loadRecords().kills).toBe(154);
    vi.unstubAllGlobals();
  });

  it('クリアで延長戦を選ばなければ、子にも 10:00 のまとめでリザルトを出す', async () => {
    vi.stubGlobal('localStorage', memoryStorage());
    localStorage.setItem(RECORDS_KEY, JSON.stringify(emptyRecords()));
    const { w, h, g } = await started();
    w.time = w.stage.length;
    w.over = 'clear';
    h.finish(false);
    await settle();
    expect(g.result).toBeNull();
    h.end();
    await settle();
    expect(g.result?.run.cleared).toBe(true);
    vi.unstubAllGlobals();
  });

  it('子が切れると、子の動物の 3 択と宝箱を消して、親は止まらずに続ける', async () => {
    const { w, h, pipe } = await started();
    w.heroes[1].pending = 2;
    w.heroes[1].chests = 1;
    pipe.close();
    await settle();
    h.before();
    expect(w.heroes[1].gone).toBe(true);
    expect(w.heroes[1].pending).toBe(0);
    const t = w.time;
    step(w, { x: 0, y: 0 }, 1 / 60);
    expect(w.time).toBeGreaterThan(t);
  });

  it('親が切れたら、子は最後に届いたまとめを記録してリザルトを出す', async () => {
    vi.stubGlobal('localStorage', memoryStorage());
    localStorage.setItem(RECORDS_KEY, JSON.stringify(emptyRecords()));
    const { w, h, g, pipe } = await started();
    w.time = 123;
    h.after(10.1);
    await settle();
    pipe.close();
    await settle();
    g.frame(performance.now());
    expect(g.result?.run.time).toBe(123);
    expect(loadRecords().best).toBe(123);
    vi.unstubAllGlobals();
  });

  it('子がやめると、親から自分のぶんのまとめが届いてから抜け、親は 1 人で続ける', async () => {
    vi.stubGlobal('localStorage', memoryStorage());
    localStorage.setItem(RECORDS_KEY, JSON.stringify(emptyRecords()));
    const { w, h, g } = await started();
    w.time = 45;
    g.quit();
    await settle();
    expect(g.result?.run.animal).toBe('cat');
    expect(g.done).toBe(true);
    expect(w.heroes[1].gone).toBe(true);
    expect(w.over).toBeNull();
    expect(h.result).toBeNull();
    vi.unstubAllGlobals();
  });

  it('子が抜けたあとは、レベルが上がっても抜けた子の 3 択がたまらず、親は止まらない', async () => {
    const { w, h, pipe } = await started();
    pipe.close();
    await settle();
    gainXp(w, 9999);
    expect(w.heroes[1].pending).toBe(0);
    w.heroes[0].pending = 0;
    h.before();
    const t = w.time;
    step(w, { x: 0, y: 0 }, 1 / 60);
    expect(w.time).toBeGreaterThan(t);
  });

  it('子が抜けたあとのもう一度は、親が 1 人で始め、記録もする', async () => {
    vi.stubGlobal('localStorage', memoryStorage());
    localStorage.setItem(RECORDS_KEY, JSON.stringify(emptyRecords()));
    const { h, pipe } = await started();
    pipe.close();
    await settle();
    expect(h.ready).toBe(false);
    const again = createWorld('dog', 2, VIEW);
    h.start(again);
    expect(again.heroes).toHaveLength(1);
    again.over = 'dead';
    h.finish(true);
    expect(h.result?.run.animal).toBe('dog');
    vi.unstubAllGlobals();
  });

  it('クリアのあと延長戦を選んでいるあいだに子がやめても、2 回記録しない', async () => {
    vi.stubGlobal('localStorage', memoryStorage());
    localStorage.setItem(RECORDS_KEY, JSON.stringify(emptyRecords()));
    const { w, h, g } = await started();
    w.kills = 20;
    w.time = w.stage.length;
    w.over = 'clear';
    h.finish(false);
    await settle();
    const kills = loadRecords().kills;
    g.quit();
    await new Promise((r) => setTimeout(r, 1600));
    expect(loadRecords().kills).toBe(kills);
    expect(g.result?.run.cleared).toBe(true);
    vi.unstubAllGlobals();
  });

  it('子が宝箱を開けているあいだは、親も止まる', async () => {
    const { w, h, g } = await started();
    w.heroes[1].chests = 1;
    h.before();
    await settle();
    expect(h.busy).toBe(true);
    g.prompts!.close(null);
    await settle();
    expect(h.busy).toBe(false);
  });

  it('延長戦の途中で子がやめると、引き上げたことにして拾った券を持ち帰る', async () => {
    vi.stubGlobal('localStorage', memoryStorage());
    localStorage.setItem(RECORDS_KEY, JSON.stringify(emptyRecords()));
    const { w, g } = await started();
    w.time = w.stage.length;
    startOvertime(w);
    w.tickets[0] += 2;
    g.quit();
    await settle();
    expect(g.result?.run.lost).toEqual([0, 0, 0]);
    expect(w.overtime?.retreat).toBe(false);
    vi.unstubAllGlobals();
  });

  it('子の 3 択は、出たときに残っていた移動の指が離れた直後も押せない（合成 click を捨てる）', async () => {
    const { w, h, g } = await started();
    g.hold(7);
    w.heroes[1].pending = 1;
    h.before();
    await settle();
    await new Promise((r) => setTimeout(r, 400));
    expect(g.prompts!.lock.active).toBe(false);
    g.prompts!.lock.lift(7);
    expect(g.prompts!.lock.active).toBe(true);
  });
});
