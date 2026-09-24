import { describe, expect, it } from 'vitest';
import { Bgm, loopSeconds, midi, score } from './bgm';
import { SONGS } from './songs';

/** 鳴らした音の高さと時刻だけを覚える AudioContext の代わり */
function fakeContext() {
  const starts: { t: number; f: number }[] = [];
  const param = () => {
    const p = {
      value: 0,
      setValueAtTime: (v: number) => void (p.value = v),
      linearRampToValueAtTime: () => {},
      exponentialRampToValueAtTime: () => {},
      cancelScheduledValues: () => {}
    };
    return p;
  };
  const node = () => {
    const n = {
      gain: param(),
      frequency: param(),
      Q: param(),
      delayTime: param(),
      type: '',
      buffer: null,
      connect: (to: unknown) => to,
      disconnect: () => {},
      start: (t = 0) => starts.push({ t, f: n.frequency.value }),
      stop: () => {}
    };
    return n;
  };
  const ctx = {
    currentTime: 0,
    state: 'running',
    sampleRate: 8000,
    destination: node(),
    createGain: node,
    createOscillator: node,
    createBiquadFilter: node,
    createDelay: node,
    createBufferSource: node,
    createBuffer: (_c: number, n: number) => ({ getChannelData: () => new Float32Array(n) })
  };
  return { ctx: ctx as unknown as BaseAudioContext & { currentTime: number }, starts };
}

/** sec 秒ぶん 60Hz で tick し、そのあいだに始まった音を返す */
function run(bgm: Bgm, fake: ReturnType<typeof fakeContext>, sec: number) {
  const from = fake.starts.length;
  for (let i = 0; i < sec * 60; i++) {
    fake.ctx.currentTime += 1 / 60;
    bgm.tick();
  }
  return fake.starts.slice(from);
}

describe('BGM', () => {
  it('ミュートのあいだは音を予約せず、戻すと今の時刻から流しなおす', () => {
    const fake = fakeContext();
    let muted = false;
    const bgm = new Bgm(() => (muted ? undefined : fake.ctx));
    bgm.play('room');
    expect(run(bgm, fake, 3).length).toBeGreaterThan(10);
    muted = true;
    const at = fake.ctx.currentTime;
    const quiet = run(bgm, fake, 3);
    expect(quiet.filter((s) => s.t > at + 0.6)).toEqual([]);
    expect(bgm.playing).toBe(null);
    muted = false;
    const back = fake.ctx.currentTime;
    const again = run(bgm, fake, 2);
    expect(again.length).toBeGreaterThan(5);
    expect(Math.min(...again.map((s) => s.t))).toBeGreaterThanOrEqual(back);
    expect(bgm.playing).toBe('room');
  });

  it('場面が変わると曲が替わり、同じ曲の行き先ではテンポだけ変える', () => {
    const fake = fakeContext();
    const bgm = new Bgm(() => fake.ctx);
    bgm.play('room');
    const room = run(bgm, fake, 4).map((s) => Math.round(s.f));
    bgm.play('park');
    run(bgm, fake, 0.1);
    expect(bgm.playing).toBe('park');
    const park = run(bgm, fake, 4).map((s) => Math.round(s.f));
    expect(park).not.toEqual(room.slice(0, park.length));
    bgm.play('contest');
    run(bgm, fake, 2);
    bgm.play('contest-play');
    run(bgm, fake, 0.1);
    expect(bgm.playing).toBe('contest-play');
    expect(loopSeconds('contest-play')).toBeLessThan(loopSeconds('contest'));
    bgm.stop();
    expect(run(bgm, fake, 1).filter((s) => s.t > fake.ctx.currentTime)).toEqual([]);
  });

  it('予約した音の時刻は重ならずに進む', () => {
    const fake = fakeContext();
    const bgm = new Bgm(() => fake.ctx);
    bgm.play('plaza');
    const t = run(bgm, fake, 5)
      .map((s) => s.t)
      .filter((v, i, a) => a.indexOf(v) === i);
    for (let i = 1; i < t.length; i++) expect(t[i]).toBeGreaterThan(t[i - 1]);
  });

  it.each(Object.keys(SONGS) as (keyof typeof SONGS)[])('%s の楽譜は 16〜32 小節で、旋律は G4..G6 に収まる', (id) => {
    const s = score(SONGS[id]);
    const bars = s.notes.length / s.perBar;
    expect(bars).toBeGreaterThanOrEqual(16);
    expect(bars).toBeLessThanOrEqual(32);
    for (const n of s.notes) {
      if (!n) continue;
      expect(n.midi).toBeGreaterThanOrEqual(midi('g4'));
      expect(n.midi).toBeLessThanOrEqual(midi('g6'));
    }
  });
});
