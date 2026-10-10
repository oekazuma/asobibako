import { describe, expect, it } from 'vitest';
import type { Message } from '$lib/net/link';
import { Party, type Seat } from '$lib/net/party.svelte';
import { Host } from '../host';
import { levelOf, mansion, SPAWNS } from '../mansion/layout';
import type { Me } from '../net';
import { DEFAULTS, INTRO } from '../referee';
import { Bot, REVEAL_READY } from './bot';
import { pipes } from './pipe';

/** 親の Party と審判に、手元の管で CPU を n 人座らせる。審判と CPU は同じ時計で 0.05 秒ずつ進める */
async function table(n: number) {
  const clock = { ms: 0 };
  const party = Party.host();
  const host = new Host(
    party,
    (seed) => levelOf(mansion(seed)),
    () => clock.ms,
    () => 0
  );
  const told: Message[] = [];
  party.onTell((m) => told.push(m));
  const bots: Bot[] = [];
  /** CPU ごとの、親へ送った知らせの種類 */
  const sends: string[][] = [];
  for (let i = 0; i < n; i++) {
    const [a, b] = pipes();
    const sent: string[] = [];
    const send = b.send;
    b.send = (m) => {
      sent.push(m.t);
      send(m);
    };
    sends.push(sent);
    bots.push(new Bot(b));
    await party.add(a);
  }
  const run = (secs: number) => {
    for (let t = 0; t < secs - 1e-9; t += 0.05) {
      clock.ms += 50;
      host.tick(0.05);
      for (const b of bots) b.step(0.05, clock.ms);
    }
  };
  const bodies = (seat: Seat) => told.filter((m) => m.t === 'me' && m.seat === seat) as unknown as Me[];
  return { party, host, bots, told, run, bodies, sends };
}

describe('CPU の子', () => {
  it('cpu の印を付けて入り、席 2・3 を受け、CPU の名前で顔ぶれに並ぶ', async () => {
    const { party, bots } = await table(2);
    expect(party.members).toEqual([1, 2, 3]);
    expect(party.looks).toEqual({ 2: 'cpu', 3: 'cpu' });
    expect(bots.map((b) => b.party.me)).toEqual([2, 3]);
    expect(bots[0].match.name(3)).toBe('CPU 2');
    expect(bots[0].match.synced).toBe(true);
  });

  it('知らせを受けた中では hello のほかに何も送らず、step で版を送ってから体を送る', async () => {
    const { sends, run, bodies } = await table(1);
    expect(sends[0]).toEqual(['hello']);
    run(0.05);
    expect(sends[0]).toEqual(['hello', 'hi', 'me']);
    expect(bodies(2).at(-1)!.pos).toEqual(SPAWNS.lobby[2]);
  });

  it('止まっていても 50ms ごとに体を送る', async () => {
    const { run, bodies } = await table(1);
    run(1);
    expect(bodies(2).length).toBeGreaterThanOrEqual(19);
    expect(bodies(2).length).toBeLessThanOrEqual(21);
    expect(bodies(2).at(-1)!.eye).toBeNull();
  });

  it('紹介ではハンターは控室、隠れる人は大広間に立つ', async () => {
    const { host, run, bodies } = await table(2);
    host.start({ ...DEFAULTS, mode: 'normal' }, [2]);
    run(0.1);
    expect(bodies(2).at(-1)!.pos).toEqual(SPAWNS.room[2]);
    expect(bodies(3).at(-1)!.pos).toEqual(SPAWNS.hall[3]);
  });

  it('ハンターの CPU は隠れタイムの始めに押し、答え合わせでは 5 秒たってから押す', async () => {
    const { host, party, run } = await table(2);
    host.start({ ...DEFAULTS, mode: 'normal', hide: 60, search: 60, reveal: 30 }, [2, 3]);
    run(INTRO + 0.1);
    expect(host.match.phase).toBe('hide');
    expect(host.match.ready).toEqual([2, 3]);
    party.act({ t: 'ready' });
    expect(host.match.phase).toBe('search');
    run(60);
    expect(host.match.phase).toBe('reveal');
    run(REVEAL_READY - 0.2);
    expect(host.match.ready).toEqual([]);
    run(0.4);
    expect(host.match.ready).toEqual([2, 3]);
  });

  it('閉じると親の顔ぶれから外れ、版ちがいを知らされても抜ける', async () => {
    const { party, bots } = await table(2);
    bots[1].close();
    await bots[1].gone;
    expect(party.members).toEqual([1, 2]);
    party.tell(2, { t: 'chameleon-mismatch' });
    await bots[0].gone;
    expect(party.members).toEqual([1]);
  });
});
