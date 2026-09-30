import { afterEach, describe, expect, it, vi } from 'vitest';
import { Lines } from './lines.svelte';

const fake = vi.hoisted(() => ({
  edge: vi.fn(() => new Uint8Array([2])),
  ink: vi.fn(() => new Uint8Array([1])),
  walls: vi.fn(() => new Uint8Array([2])),
  run: vi.fn(),
  aiMask: vi.fn(() => new Uint8Array([9]))
}));
vi.mock('./lineart', () => ({ lineArt: fake.edge, inkArt: fake.ink }));
vi.mock('./walls', () => ({ colorWalls: fake.walls }));
vi.mock('./ai-run', () => ({ drawWithAi: fake.run }));
vi.mock('./ai', () => ({ toTensor: () => new Float32Array(1), aiMask: fake.aiMask }));

const rgba = new Uint8ClampedArray(4);
const settle = () => new Promise((r) => setTimeout(r));

describe('Lines', () => {
  afterEach(() => {
    vi.clearAllMocks();
    fake.run.mockReset();
  });

  it('えの せん・いろで わける・しゃしんの りんかく で線画を作る', () => {
    const lines = new Lines();
    lines.start(rgba);
    expect([...lines.mask!]).toEqual([1]);
    lines.setMode('color');
    expect([...lines.mask!]).toEqual([3]);
    lines.setMode('edge');
    expect([...lines.mask!]).toEqual([2]);
  });

  it('AI は描き終えるまで busy にし、描き終えたら線画にする', async () => {
    let finish!: (out: Float32Array) => void;
    fake.run.mockReturnValueOnce(new Promise((r) => (finish = r)));
    const lines = new Lines();
    lines.start(rgba);
    lines.setMode('ai');
    expect(lines.busy).toBe(true);
    finish(new Float32Array(1));
    await settle();
    expect(lines.busy).toBe(false);
    expect([...lines.mask!]).toEqual([9]);
  });

  // AI は 1 回に数秒〜十数秒かかるので、線の量を変えるたびに描き直さない
  it('AI の線の量を変えても、描き直さずに線画だけを作り直す', async () => {
    fake.run.mockResolvedValueOnce(new Float32Array(1));
    const lines = new Lines();
    lines.start(rgba);
    lines.setMode('ai');
    await settle();
    lines.amount = 0.9;
    lines.build();
    expect(fake.run).toHaveBeenCalledTimes(1);
    expect(fake.aiMask).toHaveBeenCalledTimes(2);
  });

  it('AI で描けなかったら知らせ、busy を戻す', async () => {
    fake.run.mockRejectedValueOnce(new Error('no model'));
    const lines = new Lines();
    lines.start(rgba);
    lines.setMode('ai');
    await settle();
    expect(lines.busy).toBe(false);
    expect(lines.note).toContain('AI で かけませんでした');
  });

  it('描いているあいだに切り取りなおしたら、あとから届いた線画を使わない', async () => {
    let finish!: (out: Float32Array) => void;
    fake.run.mockReturnValueOnce(new Promise((r) => (finish = r)));
    const lines = new Lines();
    lines.start(rgba);
    lines.setMode('ai');
    lines.recrop();
    finish(new Float32Array(1));
    await settle();
    expect(lines.mask).toBeNull();
    expect(lines.busy).toBe(false);
  });
});
