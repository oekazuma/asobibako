import { describe, expect, it } from 'vitest';
import type { Message } from '$lib/net/link';
import { pipes } from './pipe';

describe('手元の管', () => {
  it('送った知らせは JSON で写して相手へ渡し、聞き手が付くまでためる', () => {
    const [a, b] = pipes();
    const box = { n: [1] };
    a.send({ t: 'x', box });
    box.n.push(2);
    const got: Message[] = [];
    b.on((m) => got.push(m));
    expect(got).toEqual([{ t: 'x', box: { n: [1] } }]);
    a.send({ t: 'y' });
    expect(got.map((m) => m.t)).toEqual(['x', 'y']);
  });

  it('どちらの端から閉じても両方が閉じ、閉じたあとは送らない', async () => {
    const [a, b] = pipes();
    const got: Message[] = [];
    a.on((m) => got.push(m));
    b.close();
    await a.closed;
    b.send({ t: 'x' });
    expect(got).toEqual([]);
  });
});
