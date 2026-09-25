/**
 * 効果音と BGM の合成の部品。音声ファイルは読まず、波形を JS で計算して AudioBuffer に書き、
 * 1 音を BufferSource と Gain の 2 つだけで鳴らす（泡を何十個も重ねる水の音をノードで組むと iPad で途切れる）。
 * 前半は Float32Array に書く純粋な関数（vitest でそのまま確かめられる）、後半は Web Audio への出口
 */

export const RATE = 32000;
const TAU = 2 * Math.PI;

export const wave = (sec: number, sr = RATE) => new Float32Array(Math.ceil(sec * sr));
export const white = () => Math.random() * 2 - 1;
export const rand = (a: number, b: number) => a + Math.random() * (b - a);
/** 対数で一様（高さを選ぶとき、低い音ばかり・高い音ばかりにならない） */
export const logRand = (a: number, b: number) => a * (b / a) ** Math.random();

/**
 * 減衰するサイン波を足す。打楽器の倍音・泡・固いものの響きはすべてこれ。
 * rise は 1 秒あたりの高さの上がり方の割合で、泡がつぶれながら縮むと高くなる（Minnaert の泡）
 */
export function ring(d: Float32Array, sr: number, at: number, f: number, amp: number, tau: number, rise = 0) {
  if (f >= sr * 0.45 || f <= 0 || amp === 0) return;
  const i0 = Math.max(0, Math.round(at * sr));
  const n = Math.min(d.length - i0, Math.ceil(tau * 7 * sr));
  const k = Math.exp(-1 / (tau * sr));
  // 立ち上がりの 0.3ms だけ丸める。0 から急に立つとプチッと鳴る
  const na = Math.max(1, 0.0003 * sr);
  let a = amp;
  let ph = 0;
  for (let j = 0; j < n; j++) {
    d[i0 + j] += a * Math.sin(ph) * (j < na ? j / na : 1);
    ph += (TAU * f * (1 + (rise * j) / sr)) / sr;
    a *= k;
  }
}

/**
 * 水の中の泡 1 つの音。半径で高さが決まり（f ≈ 3.26/r）、小さい泡ほど速く消える。
 * 減衰は van den Doel の式を高さで書き直したもの、xi は高さの上がり方（しずくが水面に落ちると大きい）
 */
export function bubble(d: Float32Array, sr: number, at: number, f: number, amp: number, xi = 0.1) {
  const damp = 0.043 * f + 0.0014 * f ** 1.5;
  ring(d, sr, at, f, amp, 1 / damp, xi * damp);
}

/** RBJ の 2 次フィルタ。set で途中から高さを変えられる（風切り音のように帯域が動く音） */
export function biquad(kind: 'lp' | 'hp' | 'bp', sr: number, f: number, q = 0.707) {
  let [b0, b1, b2, a1, a2, x1, x2, y1, y2] = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  const set = (hz: number) => {
    const w = (TAU * Math.min(Math.max(hz, 20), sr * 0.45)) / sr;
    const c = Math.cos(w);
    const al = Math.sin(w) / (2 * q);
    const a0 = 1 + al;
    if (kind === 'lp') [b0, b1, b2] = [(1 - c) / 2 / a0, (1 - c) / a0, (1 - c) / 2 / a0];
    else if (kind === 'hp') [b0, b1, b2] = [(1 + c) / 2 / a0, -(1 + c) / a0, (1 + c) / 2 / a0];
    else [b0, b1, b2] = [al / a0, 0, -al / a0];
    [a1, a2] = [(-2 * c) / a0, (1 - al) / a0];
  };
  set(f);
  // 1 サンプルごとに呼ぶので、配列の分割代入（毎回配列を作る）は使わない
  const run = (x: number) => {
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    return y;
  };
  return { set, run };
}

/**
 * lo〜hi Hz に絞ったノイズを at から dur 秒、env(0..1) の形で足す。
 * grain を 0..1 で上げると粒が立ち、こする・ざらつく音になる（なめらかなノイズは「サー」としか聞こえない）
 */
export function hiss(
  d: Float32Array,
  sr: number,
  at: number,
  dur: number,
  lo: number,
  hi: number,
  amp: number,
  env: (u: number) => number = (u) => 1 - u,
  grain = 0
) {
  const hp = biquad('hp', sr, lo);
  const lp = biquad('lp', sr, hi);
  const lp2 = biquad('lp', sr, hi);
  const i0 = Math.max(0, Math.round(at * sr));
  const n = Math.min(d.length - i0, Math.round(dur * sr));
  let g = 1;
  for (let j = 0; j < n; j++) {
    if (grain && j % 24 === 0) g = 1 - grain + grain * Math.random() ** 3 * 3;
    d[i0 + j] += lp2.run(lp.run(hp.run(white()))) * amp * g * env(j / n);
  }
}

/** 固いものが当たったカチッ。高さの散った短い響きを数個重ね、1 つの音程に聞こえないようにする */
export function click(d: Float32Array, sr: number, at: number, amp: number, lo = 1800, hi = 6000, tau = 0.0025) {
  for (let i = 0; i < 3; i++)
    ring(d, sr, at + rand(0, 0.0006), logRand(lo, hi), amp * rand(0.5, 1), tau * rand(0.6, 1.4));
}

/** 低いドスッ。高さが下がりながら消えるサイン波（床・クッション・たいこの胴） */
export function thump(d: Float32Array, sr: number, at: number, f: number, amp: number, tau: number, drop = 0.4) {
  ring(d, sr, at, f, amp, tau, -drop / (tau * 4));
}

/**
 * 弦をはじいた音（Karplus-Strong）。ノイズを 1 周期の遅れで回し、回るたびに平均して高い音から消える。
 * t60 は 1/1000 まで消える秒、bright は最初のはじきの明るさ 0..1
 */
export function pluck(d: Float32Array, sr: number, f: number, amp: number, t60 = 1.2, bright = 0.6) {
  const L = sr / f - 0.5;
  const g = 10 ** (-3 / (t60 * f));
  const head = Math.ceil(L) + 2;
  const y = new Float32Array(d.length);
  let lp = 0;
  let mean = 0;
  for (let i = 0; i < head && i < y.length; i++) {
    lp += bright * (white() - lp);
    y[i] = lp;
    mean += lp / head;
  }
  for (let i = 0; i < head && i < y.length; i++) y[i] -= mean;
  const at = (p: number) => {
    const i = Math.floor(p);
    const fr = p - i;
    return y[i] * (1 - fr) + y[i + 1] * fr;
  };
  for (let n = head; n < y.length; n++) y[n] = g * 0.5 * (at(n - L) + at(n - L - 1));
  for (let n = 0; n < y.length; n++) d[n] += y[n] * amp;
}

/** 始まりと終わりを cos でならす。0.1 秒おきに重ねて鳴らす音（シャワー）の継ぎ目を消す */
export function hann(d: Float32Array) {
  for (let i = 0; i < d.length; i++) d[i] *= 0.5 - 0.5 * Math.cos((TAU * i) / (d.length - 1));
  return d;
}

// --- Web Audio への出口 ---

interface Outs {
  master: AudioNode;
  sfx: GainNode;
  bgm: GainNode;
  room: AudioNode;
}
const outs = new WeakMap<BaseAudioContext, Outs>();

/** 全体の大きさの配分。鳴き声 > 効果音 > BGM */
const SFX = 0.9;
const BGM = 0.26;

/**
 * 出口の組み立て（ctx ごとに 1 度）。最後に波形の上だけ丸める WaveShaper を置き、重なって 1 を超えても割れないようにする
 * （DynamicsCompressor は自動で持ち上げるので鳴き声と効果音の釣り合いが変わる）。響き（room）は BGM と効果音で分け合う
 */
function build(ctx: BaseAudioContext): Outs {
  const soft = ctx.createWaveShaper();
  const curve = new Float32Array(1025);
  for (let i = 0; i < curve.length; i++) {
    const x = (i / 512 - 1) * 1.5;
    const a = Math.abs(x);
    curve[i] = Math.sign(x) * (a < 0.6 ? a : 0.6 + 0.4 * Math.tanh((a - 0.6) / 0.4));
  }
  soft.curve = curve;
  // 曲線は ±1.5 までを受け持つので、入れる前に 1/1.5 に縮める（曲線の中で 1.5 倍に戻す）
  const master = ctx.createGain();
  master.gain.value = 1 / 1.5;
  master.connect(soft).connect(ctx.destination);
  const verb = ctx.createConvolver();
  verb.normalize = false;
  verb.buffer = impulse(ctx, 1.1, 0.28);
  verb.connect(master);
  const sfx = ctx.createGain();
  sfx.gain.value = SFX;
  sfx.connect(master);
  const bgm = ctx.createGain();
  bgm.gain.value = BGM;
  bgm.connect(master);
  const bgmWet = ctx.createGain();
  bgmWet.gain.value = 0.3;
  bgm.connect(bgmWet).connect(verb);
  return { master, sfx, bgm, room: verb };
}

const got = (ctx: BaseAudioContext) => outs.get(ctx) ?? outs.set(ctx, build(ctx)).get(ctx)!;
/** 鳴き声の出口 */
export const master = (ctx: BaseAudioContext): AudioNode => got(ctx).master;
export const sfxOut = (ctx: BaseAudioContext): AudioNode => got(ctx).sfx;
export const bgmOut = (ctx: BaseAudioContext): GainNode => got(ctx).bgm;
/** 響きへ送る口。送る量は送る側の Gain で決める */
export const room = (ctx: BaseAudioContext): AudioNode => got(ctx).room;

/** 部屋の響き。減衰するノイズで、あとになるほど高い音を早く落とす。合計のエネルギーを 1 にそろえる */
function impulse(ctx: BaseAudioContext, sec: number, tau: number): AudioBuffer {
  const sr = ctx.sampleRate;
  const b = ctx.createBuffer(2, Math.ceil(sec * sr), sr);
  const a = Math.sqrt(2 / (sr * tau));
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < d.length; i++) {
      const t = i / sr;
      const k = 0.9 * Math.exp(-t / 0.4) + 0.05;
      lp += k * (white() - lp);
      d[i] = lp * a * Math.exp(-t / tau) * Math.min(1, t / 0.004) * 1.6;
    }
  }
  return b;
}

/** 計算した波形を AudioBuffer にする */
export function toBuffer(ctx: BaseAudioContext, data: Float32Array, sr = RATE): AudioBuffer {
  const b = ctx.createBuffer(1, Math.max(1, data.length), sr);
  b.getChannelData(0).set(data);
  return b;
}

export interface PlayOpts {
  /** 再生の速さ（高さも変わる） */
  rate?: number;
  /** この時刻から release 秒で消して止める（のばす楽器の音を楽譜の長さで切る） */
  end?: number;
  release?: number;
  /** 響きへ送る割合 */
  wet?: number;
}

/** BufferSource と Gain だけで鳴らす。鳴り終わったら外す */
export function play(
  ctx: BaseAudioContext,
  out: AudioNode,
  t: number,
  buf: AudioBuffer,
  gain: number,
  o: PlayOpts = {}
) {
  const s = ctx.createBufferSource();
  s.buffer = buf;
  if (o.rate) s.playbackRate.value = o.rate;
  const g = ctx.createGain();
  g.gain.value = gain;
  s.connect(g).connect(out);
  if (o.wet) g.connect(wetSend(ctx, o.wet));
  s.onended = () => g.disconnect();
  s.start(t);
  if (o.end === undefined) return;
  const r = o.release ?? 0.2;
  g.gain.setValueAtTime(gain, o.end);
  g.gain.linearRampToValueAtTime(0, o.end + r);
  s.stop(o.end + r + 0.01);
}

const sends = new WeakMap<BaseAudioContext, Map<number, GainNode>>();
/** 響きへの送り口は割合ごとに 1 つを使い回す（音ごとに作るとノードが増える） */
function wetSend(ctx: BaseAudioContext, wet: number): GainNode {
  const m = sends.get(ctx) ?? sends.set(ctx, new Map()).get(ctx)!;
  const k = Math.round(wet * 20) / 20;
  let g = m.get(k);
  if (!g) {
    g = ctx.createGain();
    g.gain.value = k;
    g.connect(room(ctx));
    m.set(k, g);
  }
  return g;
}

/** 波形を計算してすぐ鳴らす（毎回ちがう音にしたい水や足音） */
export function shot(
  ctx: BaseAudioContext,
  out: AudioNode,
  t: number,
  sec: number,
  fill: (d: Float32Array, sr: number) => void,
  gain = 1,
  o: PlayOpts = {}
) {
  const d = wave(sec);
  fill(d, RATE);
  play(ctx, out, t, toBuffer(ctx, d), gain, o);
}
