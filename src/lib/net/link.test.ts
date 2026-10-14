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
