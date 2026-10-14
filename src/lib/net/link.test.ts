import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { host, join, Link, pack, slim, unpack, type Message } from './link';

describe('pack', () => {
  it('SDP を縮めて URL に使える文字だけにし、元に戻せる', async () => {
    const sdp = 'v=0\r\no=- 4611731400430051336 2 IN IP4 127.0.0.1\r\n'.repeat(12);
    const code = await pack(sdp);
    expect(code).toMatch(/^[\w-]+$/);
    expect(code.length).toBeLessThan(sdp.length / 2);
    expect(await unpack(code)).toBe(sdp);
  });

  it('大きく膨らむ code は、SDP の上限で打ち切って戻す', async () => {
    expect(await unpack(await pack('a'.repeat(4 * 1024 * 1024)))).toHaveLength(16 * 1024);
  });
});

describe('slim', () => {
  it('TCP の候補と候補の拡張、データのやりとりに要らない行を落とす', () => {
    const sdp = [
      'v=0',
      'a=extmap-allow-mixed',
      'a=msid-semantic: WMS',
      'a=candidate:403344202 1 udp 2122194687 192.168.0.80 49291 typ host generation 0 network-id 1 network-cost 10',
      'a=candidate:1724213714 1 tcp 1518214911 192.168.0.80 9 typ host tcptype active generation 0 network-id 1',
      'a=ice-ufrag:txoL',
      ''
    ].join('\r\n');
    expect(slim(sdp)).toBe(
      ['v=0', 'a=candidate:403344202 1 udp 2122194687 192.168.0.80 49291 typ host', 'a=ice-ufrag:txoL', ''].join('\r\n')
    );
  });
});

describe('Link', () => {
  it('聞き手が付く前に届いた知らせをためておき、最初の聞き手に渡す', () => {
    const channel = {
      readyState: 'open',
      onmessage: null as ((e: { data: string }) => void) | null,
      addEventListener() {},
      send() {}
    };
    const pc = { addEventListener() {}, close() {} };
    const link = new Link(pc as unknown as RTCPeerConnection, channel as unknown as RTCDataChannel);
    channel.onmessage!({ data: JSON.stringify({ t: 'seat', seat: 2 }) });
    const got: Message[] = [];
    link.on((m) => got.push(m));
    channel.onmessage!({ data: JSON.stringify({ t: 'members', members: [1, 2] }) });
    expect(got).toEqual([
      { t: 'seat', seat: 2 },
      { t: 'members', members: [1, 2] }
    ]);
  });

  const LIMIT = 256 * 1024;
  const bytes = (text: string) => new TextEncoder().encode(text).byteLength;

  /** 送る側の Link。送った 1 通ずつを sent に残す。上限を超える 1 通は、Chrome の channel と同じく投げる */
  function sender(maxMessageSize?: number) {
    const sent: string[] = [];
    const channel = {
      readyState: 'open',
      onmessage: null as ((e: { data: string }) => void) | null,
      addEventListener() {},
      send(data: string) {
        if (bytes(data) > (maxMessageSize ?? LIMIT)) throw new TypeError('message too large');
        sent.push(data);
      }
    };
    const pc = {
      addEventListener() {},
      close() {},
      sctp: maxMessageSize === undefined ? undefined : { maxMessageSize }
    };
    return { link: new Link(pc as unknown as RTCPeerConnection, channel as unknown as RTCDataChannel), sent };
  }

  /** 受ける側の Link。届けた 1 通ずつから聞き手が受けた知らせを got に残す */
  function receiver() {
    const channel = {
      readyState: 'open',
      onmessage: null as ((e: { data: string }) => void) | null,
      addEventListener() {},
      send() {}
    };
    const pc = { addEventListener() {}, close() {} };
    const link = new Link(pc as unknown as RTCPeerConnection, channel as unknown as RTCDataChannel);
    const got: Message[] = [];
    link.on((m) => got.push(m));
    return { got, deliver: (data: string) => channel.onmessage!({ data }) };
  }

  const big = (n: number) => ({
    t: 'sync',
    strokes: [{ color: '#2b2d42', size: 0.018, pts: Array.from({ length: n }, (_, i) => (i % 9973) / 1e4) }]
  });

  // 古い版の端末は分けた知らせを読めないので、今送れている大きさの知らせは今までと同じ 1 通で送る
  it('上限より小さい知らせは、今までどおり 1 通のまま送る', () => {
    const { link, sent } = sender();
    const message = { t: 'ink', ink: { k: 'add', pts: [0.1, 0.2] } };
    link.send(message);
    expect(sent).toEqual([JSON.stringify(message)]);
  });

  it('上限を超える知らせは、上限より小さい何通かに分けて送り、受けた側では元の 1 通として渡す', () => {
    const { link, sent } = sender();
    const message = big(60000);
    expect(bytes(JSON.stringify(message))).toBeGreaterThan(LIMIT);
    link.send(message);
    expect(sent.length).toBeGreaterThan(1);
    const { got, deliver } = receiver();
    sent.forEach(deliver);
    expect(got).toEqual([message]);
  });

  // お題などの日本語は UTF-8 で 1 字 3 バイトなので、字数では上限を測れない
  it('日本語の多い知らせも、1 通ずつが上限に収まる', () => {
    const { link, sent } = sender();
    const message = { t: 'relayPage', entry: { kind: 'guess', text: 'あ'.repeat(100000) } };
    link.send(message);
    expect(sent.every((s) => bytes(s) <= LIMIT)).toBe(true);
    const { got, deliver } = receiver();
    sent.forEach(deliver);
    expect(got).toEqual([message]);
  });

  it('接続が決めた上限が小さければそれに合わせ、上限が無い（Infinity）ときは 256KiB で分ける', () => {
    for (const [max, limit] of [
      [64 * 1024, 64 * 1024],
      [Infinity, LIMIT]
    ] as [number, number][]) {
      const { link, sent } = sender(max);
      const message = big(60000);
      link.send(message);
      expect(sent.every((s) => bytes(s) <= limit)).toBe(true);
      const { got, deliver } = receiver();
      sent.forEach(deliver);
      expect(got).toEqual([message]);
    }
  });

  // channel は順を守り、分けた何通かは 1 回の send の中で続けて送るので、ふつうはあいだに別の知らせは入らない。入っても壊さない
  it('分けた知らせのあいだに別の知らせが届いても、どちらも元のまま渡す', () => {
    const { link, sent } = sender();
    const message = big(60000);
    link.send(message);
    const ink = { t: 'ink', ink: { k: 'add', pts: [0.5, 0.5] } };
    const { got, deliver } = receiver();
    deliver(sent[0]);
    deliver(JSON.stringify(ink));
    sent.slice(1).forEach(deliver);
    expect(got).toEqual([ink, message]);
  });

  it('つなぐ数の上限を超える n や、正の整数でない n の列は捨てて、次の知らせは受ける', () => {
    const { got, deliver } = receiver();
    for (const n of [65, 0, -1, 1.5, 'x']) deliver(JSON.stringify({ t: '~part', i: 0, n, s: '{}' }));
    expect(got).toEqual([]);
    const ink = { t: 'ink', ink: { k: 'add', pts: [0.5, 0.5] } };
    deliver(JSON.stringify(ink));
    expect(got).toEqual([ink]);
  });

  it('分けた知らせの順がずれたら集めたものを捨て、次の知らせは受ける', () => {
    const { link, sent } = sender();
    const message = big(60000);
    link.send(message);
    const { got, deliver } = receiver();
    deliver(sent[0]);
    deliver(sent[2]);
    sent.slice(1).forEach(deliver);
    expect(got).toEqual([]);
    sent.forEach(deliver);
    expect(got).toEqual([message]);
  });

  // 投げると、親が子を迎える途中（席を返す前の join）や、人ごとに送るループの途中で止まる
  it('channel が投げても send は投げない', () => {
    const channel = {
      readyState: 'open',
      onmessage: null as ((e: { data: string }) => void) | null,
      addEventListener() {},
      send() {
        throw new Error('closing');
      }
    };
    const pc = { addEventListener() {}, close() {} };
    const link = new Link(pc as unknown as RTCPeerConnection, channel as unknown as RTCDataChannel);
    expect(() => link.send({ t: 'seat', seat: 2 })).not.toThrow();
  });
});

describe('host と join', () => {
  class FakePc {
    static made: FakePc[] = [];
    iceGatheringState = 'complete';
    localDescription = { sdp: 'v=0\r\n' };
    close = vi.fn();
    constructor() {
      FakePc.made.push(this);
    }
    createDataChannel() {
      return {};
    }
    async setLocalDescription() {}
    async setRemoteDescription() {}
    addEventListener() {}
  }

  beforeEach(() => {
    FakePc.made = [];
    vi.stubGlobal('RTCPeerConnection', FakePc);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('親の close は、子の QR が届く前でも接続を閉じる', async () => {
    const offer = await host();
    expect(FakePc.made[0].close).not.toHaveBeenCalled();
    offer.close();
    expect(FakePc.made[0].close).toHaveBeenCalled();
  });

  it('子の close は、親が読み取る前でも接続を閉じる', async () => {
    const answer = await join('O:' + (await pack('v=0\r\n')));
    answer.close();
    expect(FakePc.made[0].close).toHaveBeenCalled();
  });
});
