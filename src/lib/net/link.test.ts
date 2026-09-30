import { describe, expect, it } from 'vitest';
import { pack, slim, unpack } from './link';

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
