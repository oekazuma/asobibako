import { describe, expect, it } from 'vitest';
import type { Message } from './link';
import { Party, type Pipe, type Seat } from './party.svelte';

/** 手元でつないだ 2 本の管。close はどちらの端からでも両方を閉じる */
function pipes(): [Pipe, Pipe] {
  const listeners = [new Set<(m: Message) => void>(), new Set<(m: Message) => void>()];
  let open = true;
  let close!: () => void;
  const closed = new Promise<void>((resolve) => (close = resolve));
  const end = (me: 0 | 1): Pipe => ({
    send: (m) => {
      // Link と同じく JSON で渡す（$state の配列は structuredClone できない）
      if (open) for (const l of listeners[1 - me]) l(JSON.parse(JSON.stringify(m)));
    },
    on: (l) => {
      listeners[me].add(l);
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

function trio() {
  const host = Party.host();
  const [a, a2] = pipes();
  const [b, b2] = pipes();
  const g2 = Party.guest(a2);
  const g3 = Party.guest(b2);
  host.add(a);
  host.add(b);
  return { host, g2, g3, a, b };
}

describe('Party', () => {
  it('親は子を 2P・3P の順に迎え、4 人目は断って閉じる', async () => {
    const { host, g2, g3 } = trio();
    const [c, c2] = pipes();
    expect(host.add(c)).toBeNull();
    await settle();
    let refused = false;
    c2.closed.then(() => (refused = true));
    await settle();
    expect(refused).toBe(true);
    expect([host.me, g2.me, g3.me]).toEqual([1, 2, 3]);
    expect(host.members).toEqual([1, 2, 3]);
    expect(g2.members).toEqual([1, 2, 3]);
    expect(g3.members).toEqual([1, 2, 3]);
  });

  it('子の操作は送った子の番号付きで、親の操作は 1 番で親のルールに届く', () => {
    const { host, g3 } = trio();
    const got: [Message, Seat][] = [];
    host.onAct((m, from) => got.push([m, from]));
    g3.act({ t: 'guess', text: 'いぬ' });
    host.act({ t: 'pick', index: 1 });
    expect(got).toEqual([
      [{ t: 'guess', text: 'いぬ' }, 3],
      [{ t: 'pick', index: 1 }, 1]
    ]);
  });

  it('知らせは all なら親の画面と全員の子に、番号なら その 1 人にだけ届く', () => {
    const { host, g2, g3 } = trio();
    const seen: Record<number, Message[]> = { 1: [], 2: [], 3: [] };
    host.onTell((m) => seen[1].push(m));
    g2.onTell((m) => seen[2].push(m));
    g3.onTell((m) => seen[3].push(m));
    host.tell('all', { t: 'screen', screen: 'mode' });
    host.tell(3, { t: 'close' });
    host.tell(1, { t: 'close' });
    expect(seen[1]).toEqual([{ t: 'screen', screen: 'mode' }, { t: 'close' }]);
    expect(seen[2]).toEqual([{ t: 'screen', screen: 'mode' }]);
    expect(seen[3]).toEqual([{ t: 'screen', screen: 'mode' }, { t: 'close' }]);
  });

  it('子が抜けると、親のルールに leave が届き、残りの全員の顔ぶれから消える', async () => {
    const { host, g3, a } = trio();
    const left: Seat[] = [];
    host.onAct((m, from) => m.t === 'leave' && left.push(from));
    a.close();
    await settle();
    expect(left).toEqual([2]);
    expect(host.members).toEqual([1, 3]);
    expect(g3.members).toEqual([1, 3]);
  });

  it('抜けた子の番号は、次に来た子に使う', async () => {
    const { host, a } = trio();
    a.close();
    await settle();
    const [c, c2] = pipes();
    const g = Party.guest(c2);
    expect(host.add(c)).toBe(2);
    expect(g.me).toBe(2);
  });

  it('親が閉じると、子は lost になる', async () => {
    const { host, g2 } = trio();
    host.close();
    await settle();
    expect(g2.lost).toBe(true);
  });

  it('子の Party を作る前に届いていた番号の知らせも受け取る', () => {
    const host = Party.host();
    const [a, a2] = pipes();
    const early: Message[] = [];
    // 管そのものは受け取りを取りこぼすので、Link と同じく最初の聞き手が付くまでためる管にする
    const buffered: Pipe = {
      ...a2,
      on: (l) => {
        for (const m of early.splice(0)) l(m);
        return a2.on(l);
      }
    };
    const stop = a2.on((m) => early.push(m));
    host.add(a);
    stop();
    const g = Party.guest(buffered);
    expect(g.me).toBe(2);
    expect(g.members).toEqual([1, 2]);
  });
  // ページを閉じたあと戻る（bfcache）と、同じ Party が生き返る。つながっていない子が顔ぶれに残ると「はじめる」が押せてしまう
  it('閉じたら、顔ぶれは自分だけになる', () => {
    const { host } = trio();
    host.close();
    expect(host.members).toEqual([1]);
  });

  // 切れた人の番号を空けたままにすると、別の人が入って切れた人が戻れなくなる
  it('切れた子の番号を覚え、次に迎える子へ先に渡す', async () => {
    const { host, a } = trio();
    a.close();
    await settle();
    expect(host.away).toEqual([2]);
    const [c, c2] = pipes();
    const g = Party.guest(c2);
    expect(host.add(c)).toBe(2);
    await settle();
    expect(g.me).toBe(2);
    expect(host.away).toEqual([]);
    expect(host.members).toEqual([1, 2, 3]);
  });

  it('迎えるたびに、その子の番号で join を親のルールへ流す', () => {
    const host = Party.host();
    const joined: Seat[] = [];
    host.onAct((m, from) => m.t === 'join' && joined.push(from));
    const [a] = pipes();
    host.add(a);
    expect(joined).toEqual([2]);
  });

  it('閉じたら、切れた子の番号も忘れる', async () => {
    const { host, a } = trio();
    a.close();
    await settle();
    host.close();
    expect(host.away).toEqual([]);
  });
});
