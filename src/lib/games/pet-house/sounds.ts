import { bus, sink } from '$lib/audio.svelte';
import { note, type Instrument } from './instruments';
import { biquad, bubble, click, hann, hiss, logRand, play, rand, ring, sfxOut, shot, thump, white } from './synth';

/**
 * 効果音。水は小さな泡の共鳴（高さが上がりながら消える短いサイン波）をたくさん重ね、
 * こする・踏む音は帯域を絞った粒のあるノイズ、画面の音は木琴・鉄琴・ベルの音色で作る。
 * どれも (ctx, 出口, 時刻) を受け取るので、OfflineAudioContext に書き出して聞き比べられる
 */

export interface At {
  ctx: BaseAudioContext;
  out: AudioNode;
  t: number;
}

export type Surface = 'floor' | 'grass' | 'road';

const inst = (o: At, name: Instrument, f: number, gain: number, dt = 0, wet = 0.2) =>
  play(o.ctx, o.out, o.t + dt, note(o.ctx, name, f), gain, { wet });

const fx = (o: At, sec: number, fill: (d: Float32Array, sr: number) => void, gain = 1, dt = 0, wet = 0) =>
  shot(o.ctx, o.out, o.t + dt, sec, fill, gain, { wet });

/** 風切り音。帯域を from → to Hz へ動かしながら、ふくらんで消える */
function whoosh(
  d: Float32Array,
  sr: number,
  at: number,
  sec: number,
  from: number,
  to: number,
  amp: number,
  flutter = 0
) {
  const bp = biquad('bp', sr, from, 1.6);
  const i0 = Math.round(at * sr);
  const n = Math.min(d.length - i0, Math.round(sec * sr));
  for (let j = 0; j < n; j++) {
    const u = j / n;
    if (j % 32 === 0) bp.set(from * (to / from) ** u);
    const flap = flutter ? 1 - flutter * 0.5 * (1 + Math.sin((2 * Math.PI * 22 * j) / sr)) : 1;
    d[i0 + j] += bp.run(white()) * amp * Math.sin(Math.PI * u) ** 2 * flap;
  }
}

export const decay = (k: number) => (u: number) => Math.exp(-u * k);
/** 速く立ち上がって、なだらかに消える */
const swell = (u: number) => (u < 0.15 ? u / 0.15 : ((1 - u) / 0.85) ** 1.5);

/** シャワー 1 粒ぶん（0.2 秒）。細かいしぶきのノイズ、たらいの水面を打つ低い音、しずくの泡 */
export function showerGrain(d: Float32Array, sr: number) {
  const sec = d.length / sr;
  hiss(d, sr, 0, sec, 1400, 6500, 0.3, () => 1, 0.35);
  hiss(d, sr, 0, sec, 180, 900, 0.35, () => 1, 0.25);
  for (let i = 0; i < 30; i++) bubble(d, sr, rand(0, sec - 0.01), logRand(1500, 4500), rand(0.05, 0.22), 0.1);
  for (let i = 0; i < 4; i++) bubble(d, sr, rand(0, sec - 0.02), logRand(500, 1300), rand(0.12, 0.3), 0.15);
  hann(d);
}

/** 泡立て 1 回ぶん。泡がはじけるぷちぷちと、あわをもむ湿った音 */
export function foamGrain(d: Float32Array, sr: number) {
  const sec = d.length / sr;
  hiss(d, sr, 0, sec, 400, 1800, 0.22, (u) => Math.sin(Math.PI * u), 0.6);
  const n = 7 + Math.floor(Math.random() * 6);
  for (let i = 0; i < n; i++) bubble(d, sr, rand(0, sec - 0.01), logRand(2500, 6500), rand(0.15, 0.45), 0.05);
  for (let i = 0; i < 2; i++) bubble(d, sr, rand(0, sec - 0.03), logRand(900, 1600), rand(0.1, 0.2), 0.2);
}

/** ぶるぶる。毛が振れるばさっを 1 秒に 9 回、飛んだしずくのしぶきと、落ちてくるぱらぱら */
export function shakeBurst(d: Float32Array, sr: number) {
  for (let i = 0; i < 14; i++) {
    const at = i * 0.108 + rand(0, 0.01);
    const k = 1 - i / 16;
    hiss(d, sr, at, 0.07, 200, 2400, 0.55 * k, swell, 0.4);
    hiss(d, sr, at, 0.09, 1500, 6000, 0.22 * k, swell, 0.3);
    thump(d, sr, at, 95, 0.12 * k, 0.02);
  }
  for (let i = 0; i < 140; i++) {
    const at = rand(0.12, 1.8);
    const k = Math.max(0.2, 1 - at / 1.9);
    if (i % 4) click(d, sr, at, rand(0.04, 0.12) * k, 1500, 5000, 0.001);
    else bubble(d, sr, at, logRand(1200, 3500), rand(0.1, 0.25) * k, 0.2);
  }
}

/** たらいの水をかく、ちゃぷっ。水が動く低い音と大きめの泡 */
export function sloshGrain(d: Float32Array, sr: number) {
  hiss(d, sr, 0, 0.3, 150, 900, 0.4, (u) => Math.sin(Math.PI * u) ** 1.5, 0.2);
  const n = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) bubble(d, sr, rand(0.02, 0.15), logRand(300, 950), rand(0.35, 0.75), 0.3);
  for (let i = 0; i < 2; i++) hiss(d, sr, rand(0.02, 0.12), 0.02, 1500, 5000, 0.15);
}

/** 止めたあとのしずく。間があいていき、1 粒ずつ水面に落ちて高くなりながら消える */
export function dripTrail(d: Float32Array, sr: number) {
  for (const at of [0.08, 0.34, 0.66, 1.05, 1.5]) {
    const a = at + rand(-0.04, 0.04);
    bubble(d, sr, a, logRand(900, 2200), rand(0.45, 0.7), rand(0.3, 0.45));
    hiss(d, sr, a, 0.004, 2000, 6000, 0.08);
  }
}

/** 食べる、カリッ。細かいひびを 30ms にまとめ、あごの低い音を足す */
function crunch(d: Float32Array, sr: number, at: number) {
  const n = 12 + Math.floor(Math.random() * 8);
  for (let i = 0; i < n; i++) click(d, sr, at + rand(0, 0.035), rand(0.1, 0.35), 900, 4500, rand(0.0008, 0.002));
  hiss(d, sr, at, 0.045, 800, 5000, 0.12, decay(3), 0.8);
  ring(d, sr, at, rand(130, 160), 0.2, 0.02);
}

/** なめる、ぴちゃ。舌で水をはじく短いこすれと、上がる泡 */
function lap(d: Float32Array, sr: number, at: number) {
  hiss(d, sr, at, 0.012, 1000, 4000, 0.2);
  const n = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++)
    bubble(d, sr, at + rand(0.004, 0.025), logRand(600, 1800), rand(0.3, 0.6), rand(0.2, 0.4));
}

/** 足音。床は肉球のトンと爪のチャッ、芝は草を踏むざくっ、道は砂のざらっ */
export function footstep(d: Float32Array, sr: number, surface: Surface, cat: boolean) {
  const k = rand(0.75, 1);
  if (surface === 'grass') {
    hiss(d, sr, 0, 0.08, 1500, 6000, 0.3 * k, swell, 0.8);
    hiss(d, sr, 0, 0.04, 200, 900, 0.18 * k, decay(4));
    return;
  }
  thump(d, sr, 0, rand(150, 190), (cat ? 0.3 : 0.5) * k, 0.014, 0.3);
  hiss(d, sr, 0, 0.018, 200, 1300, (cat ? 0.12 : 0.22) * k, decay(4));
  if (surface === 'road') hiss(d, sr, 0.003, 0.05, 800, 5000, 0.45 * k, swell, 0.9);
  if (cat) return;
  click(d, sr, 0.004 + rand(0, 0.004), rand(0.4, 0.5), 2500, 7000, 0.0012);
  click(d, sr, 0.018 + rand(0, 0.008), rand(0.3, 0.45), 2500, 7000, 0.0012);
}

/** 木のドアのカチャ・ドアベルのカランコロン・閉まるバタン */
function doorFill(d: Float32Array, sr: number) {
  click(d, sr, 0, 0.45, 1200, 4500, 0.004);
  click(d, sr, 0.05, 0.3, 1200, 4500, 0.003);
  ring(d, sr, 0, 2300, 0.06, 0.03);
  thump(d, sr, 1.0, 85, 0.45, 0.06);
  hiss(d, sr, 1.0, 0.06, 80, 600, 0.3, decay(4));
  click(d, sr, 1.02, 0.15, 1000, 3500, 0.004);
}

/** 紙の包みを開ける。くしゃくしゃのひびと、びりっと破る音 */
function paperFill(d: Float32Array, sr: number) {
  for (let i = 0; i < 45; i++) click(d, sr, rand(0, 0.5), rand(0.05, 0.3), 1000, 6000, rand(0.0012, 0.003));
  hiss(d, sr, 0.18, 0.24, 800, 6000, 0.3, (u) => (u < 0.8 ? u / 0.8 : (1 - u) / 0.2), 0.9);
}

/** カメラの機械のカチャ。ミラーが上がる音と、シャッター幕が閉じる音 */
function shutterFill(d: Float32Array, sr: number) {
  click(d, sr, 0, 0.5, 1500, 6000, 0.004);
  thump(d, sr, 0, 220, 0.3, 0.008);
  hiss(d, sr, 0, 0.008, 2000, 9000, 0.25);
  click(d, sr, 0.075, 0.38, 1800, 7000, 0.003);
  ring(d, sr, 0.075, 3200, 0.05, 0.02);
  hiss(d, sr, 0.075, 0.012, 1500, 8000, 0.18);
}

/** ボールが弾む。床ではゴムの胴が鳴るぽん、芝ではとすっ。フリスビーはプラスチックのカタッ・ぱさっ */
function bounceFill(d: Float32Array, sr: number, surface: Surface, kind: 'ball' | 'frisbee') {
  const soft = surface === 'grass';
  if (kind === 'frisbee') {
    if (soft) hiss(d, sr, 0, 0.1, 1500, 5000, 0.3, swell, 0.8);
    ring(d, sr, 0, rand(850, 950), soft ? 0.25 : 0.55, 0.015);
    ring(d, sr, 0, rand(1400, 1500), soft ? 0.15 : 0.35, 0.01);
    ring(d, sr, 0, rand(2500, 2700), 0.15, 0.006);
    thump(d, sr, 0, 140, 0.25, 0.02);
    return;
  }
  if (soft) {
    hiss(d, sr, 0, 0.08, 60, 500, 0.8, decay(4));
    thump(d, sr, 0, 90, 0.5, 0.03);
    hiss(d, sr, 0, 0.07, 1500, 5000, 0.2, swell, 0.8);
    return;
  }
  const f = rand(320, 380);
  thump(d, sr, 0, f, 1, 0.025, 0.15);
  ring(d, sr, 0, f * 2.3, 0.3, 0.01);
  click(d, sr, 0, 0.18, 1500, 4000, 0.0015);
  thump(d, sr, 0, 110, 0.4, 0.03);
}

/** ソファに飛び乗るぼふっ（クッションが空気を吐く）、床に降りるとんっ */
function landFill(d: Float32Array, sr: number, where: 'sofa' | 'floor') {
  if (where === 'sofa') {
    hiss(d, sr, 0, 0.18, 80, 600, 0.9, (u) => (u < 0.03 ? u / 0.03 : Math.exp(-(u - 0.03) * 5)));
    thump(d, sr, 0, 90, 0.5, 0.05);
    hiss(d, sr, 0.01, 0.07, 600, 2000, 0.15, decay(3));
    hiss(d, sr, 0.02, 0.09, 2000, 6000, 0.05, swell, 0.5);
    return;
  }
  thump(d, sr, 0, 160, 0.6, 0.02);
  hiss(d, sr, 0, 0.02, 150, 1500, 0.3, decay(4));
  click(d, sr, 0.006, 0.12, 2500, 7000, 0.0012);
}

/** 画面の音の元の高さ（Hz） */
const C5 = 523.25;
/** 地面ごとの足音とボールの大きさ（書き出して、ほかの効果音とそろえた値） */
const STEP: Record<Surface, number> = { floor: 0.155, grass: 0.32, road: 0.12 };
const BOUNCE: Record<Surface, number> = { floor: 0.14, grass: 0.2, road: 0.14 };
const E5 = 659.25;
const G5 = 783.99;
const C6 = 1046.5;
const E6 = 1318.5;

export const SFX = {
  eat: (o: At) => fx(o, 0.4, (d, sr) => [0, 0.14, 0.29].forEach((at) => crunch(d, sr, at)), 0.24),
  drink: (o: At) => fx(o, 0.45, (d, sr) => [0, 0.16, 0.32].forEach((at) => lap(d, sr, at + rand(0, 0.02))), 0.09),
  sparkle: (o: At) => {
    [1568, 2093, 2637, 3136].forEach((f, i) => inst(o, 'glock', f, 0.03 - i * 0.0035, i * 0.06, 0.35));
  },
  throw: (o: At, kind: 'ball' | 'frisbee' | 'mouse' = 'ball') =>
    fx(
      o,
      0.5,
      (d, sr) =>
        kind === 'frisbee' ? whoosh(d, sr, 0, 0.45, 600, 1500, 0.5, 0.5) : whoosh(d, sr, 0, 0.26, 500, 1800, 0.55),
      0.5
    ),
  /** 口でぱくっ。そのあとの小さい木琴が「とれた！」の合図 */
  catch: (o: At) => {
    fx(
      o,
      0.1,
      (d, sr) => {
        thump(d, sr, 0, 180, 0.5, 0.02);
        hiss(d, sr, 0, 0.025, 300, 2500, 0.3, decay(4));
      },
      0.16
    );
    inst(o, 'xylo', E6, 0.05, 0.05);
  },
  coin: (o: At) => {
    inst(o, 'glock', 987.77, 0.038, 0, 0.3);
    inst(o, 'glock', E6, 0.045, 0.08, 0.3);
  },
  learned: (o: At) => {
    [C5, E5, G5, C6].forEach((f, i) => inst(o, 'marimba', f, 0.05, i * 0.11));
    inst(o, 'bell', C6, 0.021, 0.48, 0.35);
    inst(o, 'bell', E6, 0.015, 0.48, 0.35);
    inst(o, 'glock', 2093, 0.008, 0.48, 0.35);
  },
  shutter: (o: At) => fx(o, 0.2, shutterFill, 0.38),
  /** ぽん。口を鳴らしたような、上へはねる大きめの泡 */
  pop: (o: At) =>
    fx(
      o,
      0.2,
      (d, sr) => {
        bubble(d, sr, 0, rand(480, 560), 1, 1.2);
        bubble(d, sr, 0.004, rand(850, 950), 0.25, 0.8);
      },
      0.086
    ),
  /** リズムあそびでノーツを叩いた、とん。ぴったりは高く、鉄琴の粒を重ねる */
  beat: (o: At, great: boolean) => {
    inst(o, 'xylo', great ? 1568 : 1175, 0.067, 0, 0.1);
    if (great) inst(o, 'glock', 3136, 0.012, 0, 0.1);
  },
  /** スタンプを押す、ぽんっ。ゴムの判が台紙に当たる音のあとに、覚えたときのファンファーレ */
  stamp: (o: At) => {
    fx(
      o,
      0.15,
      (d, sr) => {
        thump(d, sr, 0, 150, 0.9, 0.03, 0.5);
        hiss(d, sr, 0, 0.03, 150, 1200, 0.4, decay(4));
        click(d, sr, 0, 0.12, 600, 2000, 0.003);
      },
      0.3,
      0.18
    );
    SFX.learned({ ...o, t: o.t + 0.3 });
  },
  foam: (o: At) => fx(o, 0.2, foamGrain, 0.29, 0, 0.2),
  /** シャワーのお湯。出しているあいだ 0.1 秒ごとに呼ぶと、0.2 秒の粒が半分ずつ重なって切れ目なく流れる */
  shower: (o: At) => fx(o, 0.2, showerGrain, 0.27, 0, 0.25),
  drips: (o: At) => fx(o, 1.8, dripTrail, 0.3, 0, 0.4),
  slosh: (o: At, k = 1) => fx(o, 0.35, sloshGrain, 0.1 * k, 0, 0.25),
  /** タオルでふく、ふきっ。布どうしのこすれで、高い音は布が吸う */
  towel: (o: At) =>
    fx(
      o,
      0.26,
      (d, sr) => hiss(d, sr, 0, 0.26, 250, rand(2000, 2800), 0.5, (u) => Math.sin(Math.PI * u) ** 1.5, 0.5),
      0.23
    ),
  shake: (o: At) => fx(o, 2, shakeBurst, 0.56, 0, 0.25),
  step: (o: At, surface: Surface = 'road', cat = false) =>
    fx(o, 0.1, (d, sr) => footstep(d, sr, surface, cat), STEP[surface] * (cat ? 0.8 : 1)),
  /** においをかぐ。鼻から吸う短い息を 3 回 */
  sniff: (o: At) =>
    fx(
      o,
      0.3,
      (d, sr) => {
        for (const at of [0, 0.11, 0.22])
          hiss(d, sr, at, 0.05, 1200, 5000, 0.3, (u) => (u < 0.3 ? u / 0.3 : (1 - u) / 0.7), 0.2);
      },
      0.46
    ),
  /** おしっこ。細い水の流れ（小さい泡の粒のつながり） */
  pee: (o: At) =>
    fx(
      o,
      1.5,
      (d, sr) => {
        hiss(d, sr, 0, 1.4, 800, 3500, 0.12, (u) => Math.min(1, u / 0.07, (1 - u) / 0.15));
        for (let i = 0; i < 110; i++) bubble(d, sr, rand(0, 1.3), logRand(1200, 3200), rand(0.08, 0.25), 0.1);
      },
      0.18
    ),
  plop: (o: At) =>
    fx(
      o,
      0.15,
      (d, sr) => {
        thump(d, sr, 0, 220, 0.6, 0.03, 0.6);
        hiss(d, sr, 0, 0.03, 100, 800, 0.3, decay(4));
      },
      0.135
    ),
  /** ほかの犬とあいさつ。マリンバの 2 音が弾む */
  greet: (o: At) => {
    inst(o, 'marimba', G5, 0.04);
    inst(o, 'marimba', 1174.66, 0.04, 0.11);
  },
  /** ねこじゃらしの羽根が空を切る、しゅっ。k は振る強さ 0..1 */
  rustle: (o: At, k: number) => fx(o, 0.14, (d, sr) => whoosh(d, sr, 0, 0.13, 2500, 4200, 0.4, 0.3), 0.07 + 0.18 * k),
  /** 猫が飛びかかる、とんっ。床を蹴る音と、体が空を切る音 */
  leap: (o: At) =>
    fx(
      o,
      0.2,
      (d, sr) => {
        thump(d, sr, 0, 130, 0.45, 0.02);
        hiss(d, sr, 0, 0.03, 300, 1500, 0.2, decay(4));
        whoosh(d, sr, 0.02, 0.15, 800, 2000, 0.2);
      },
      0.22
    ),
  land: (o: At, where: 'sofa' | 'floor') => fx(o, 0.22, (d, sr) => landFill(d, sr, where), 0.18),
  /** v は当たったときの落ちる速さ（m/s） */
  bounce: (o: At, surface: Surface, v: number, kind: 'ball' | 'frisbee' = 'ball') =>
    fx(o, 0.12, (d, sr) => bounceFill(d, sr, surface, kind), BOUNCE[surface] * Math.min(1, Math.max(0.15, v / 3))),
  /** ねずみのおもちゃのカシャカシャ。中の粒が転がって当たる */
  rattle: (o: At, k = 1) =>
    fx(
      o,
      0.1,
      (d, sr) => {
        const n = 5 + Math.floor(Math.random() * 5);
        for (let i = 0; i < n; i++) click(d, sr, rand(0, 0.08), rand(0.15, 0.4), 3000, 8000, 0.0012);
      },
      0.3 * k
    ),
  /** ブラシの毛が毛並みをすべる、しゃっ */
  brush: (o: At, k = 1) =>
    fx(
      o,
      0.22,
      (d, sr) => {
        hiss(d, sr, 0, 0.22, 2000, 9000, 0.35, (u) => Math.sin(Math.PI * u), 0.9);
        hiss(d, sr, 0, 0.22, 400, 1500, 0.1, (u) => Math.sin(Math.PI * u), 0.4);
      },
      0.18 * k
    ),
  door: (o: At) => {
    fx(o, 1.2, doorFill, 0.18, 0, 0.2);
    inst(o, 'bell', 1568, 0.04, 0.12, 0.3);
    inst(o, 'bell', E6, 0.035, 0.3, 0.3);
  },
  unwrap: (o: At) => fx(o, 0.55, paperFill, 0.29)
};

type Args<K extends keyof typeof SFX> = (typeof SFX)[K] extends (o: At, ...a: infer A) => void ? A : never;
type Live = { [K in keyof typeof SFX]: (...a: Args<K>) => void };

// 触っていなくてもフレームから鳴る音。止まっているあいだに予約すると、resume したときにまとめて鳴ってしまう
const AMBIENT = new Set<keyof typeof SFX>(['eat', 'drink', 'land', 'step', 'bounce', 'rattle', 'rustle']);

/** いまの AudioContext に鳴らす版。音がまだ使えない・ミュートのあいだは何もしない */
export const sounds = Object.fromEntries(
  Object.entries(SFX).map(([k, f]) => [
    k,
    (...a: unknown[]) => {
      const ctx = AMBIENT.has(k as keyof typeof SFX) ? bus() : sink();
      if (ctx) (f as (o: At, ...a: unknown[]) => void)({ ctx, out: sfxOut(ctx), t: ctx.currentTime + 0.005 }, ...a);
      if (k === 'shower') armDrips();
    }
  ])
) as Live;

let drip: ReturnType<typeof setTimeout> | undefined;
/** シャワーが 0.25 秒来なくなったら止めたとみなし、しずくを落とす（呼ぶ側は止めたことを知らせなくてよい） */
function armDrips() {
  clearTimeout(drip);
  drip = setTimeout(() => sounds.drips(), 250);
}
