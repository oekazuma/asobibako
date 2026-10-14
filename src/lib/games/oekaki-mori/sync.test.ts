import { describe, expect, it } from 'vitest';
import { Link, type Message } from '$lib/net/link';
import { catchUp } from './sync';
import { PENS, SIZES, snap, type Stroke } from './strokes';

const frac = (v: number) => v - Math.floor(v);

/** Board と同じく 4 けたに丸めた点を n 個、300 点ずつの線にする。描きこんだ子の絵の大きさを作る */
function scribble(n: number): Stroke[] {
  const strokes: Stroke[] = [];
  for (let i = 0; i < n; i++) {
    if (i % 300 === 0) strokes.push({ color: PENS[0].hex, size: SIZES[1], pts: [] });
    strokes.at(-1)!.pts.push(snap(0.1 + 0.8 * frac(i * 0.6180339887)), snap(0.1 + 0.8 * frac(i * 0.7548776662)));
  }
  return strokes;
}

describe('catchUp', () => {
  // DataChannel の 1 通には上限があり、絵をまとめて送ると越えることがある
  it('遊んでいるあいだは、いまの絵とこれまでの絵を 1 枚ずつ別の知らせで送る', () => {
    const strokes = [{ color: '#000', size: 0.01, pts: [0, 0] }];
    const drawing = { word: 'いぬ', by: 1 as const, strokes, misses: [] };
    expect(catchUp('play', strokes, [drawing, drawing], [{ by: 2, text: 'いぬ' }])).toEqual([
      { t: 'sync', strokes, misses: [{ by: 2, text: 'いぬ' }] },
      { t: 'drawing', drawing },
      { t: 'drawing', drawing }
    ]);
  });

  it('ほかの画面では、その画面を知らせる', () => {
    expect(catchUp('mode', [], [], [])).toEqual([{ t: 'screen', screen: 'mode' }]);
  });

  // 1〜2 分ぬりつぶすように描くと 2 万点を超え、絵 1 枚の知らせが DataChannel の 1 通の上限（256KiB）を超える
  it('描きこんだ絵の送り直しは上限を超えるが、分けて送れば元の絵のまま届く', () => {
    const [sync] = catchUp('play', scribble(30000), [], []);
    const text = JSON.stringify(sync);
    expect(text.length).toBeGreaterThan(256 * 1024);
    const sent: string[] = [];
    const got: Message[] = [];
    const to = {
      readyState: 'open',
      onmessage: null as ((e: { data: string }) => void) | null,
      addEventListener() {},
      send() {}
    };
    new Link({ addEventListener() {}, close() {} } as unknown as RTCPeerConnection, to as unknown as RTCDataChannel).on(
      (m) => got.push(m)
    );
    const from = {
      readyState: 'open',
      onmessage: null,
      addEventListener() {},
      send: (data: string) => sent.push(data)
    };
    new Link(
      { addEventListener() {}, close() {} } as unknown as RTCPeerConnection,
      from as unknown as RTCDataChannel
    ).send(sync);
    expect(sent.every((s) => s.length <= 256 * 1024)).toBe(true);
    sent.forEach((data) => to.onmessage!({ data }));
    expect(got).toEqual([sync]);
  });
});
