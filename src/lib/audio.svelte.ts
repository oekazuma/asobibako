const KEY = 'table-duel:muted';

let ctx: AudioContext | undefined;

export const audio = $state({ muted: read() });

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function toggleMute(): void {
  audio.muted = !audio.muted;
  try {
    localStorage.setItem(KEY, audio.muted ? '1' : '0');
  } catch {
    // プライベートブラウズでは保存できないが、音は鳴らせる
  }
}

/** iOS は操作イベントの中で resume() しないと無音のままになる */
export function wake(): void {
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
}

/** 各ゲームの効果音はこの部品を組み合わせて、ゲームのフォルダ側で定義する */
export function tone(freq: number, ms: number, type: OscillatorType = 'triangle', gain = 0.14, delay = 0) {
  if (!ctx || audio.muted) return;
  const at = ctx.currentTime + delay / 1000;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  amp.gain.setValueAtTime(gain, at);
  amp.gain.exponentialRampToValueAtTime(0.0001, at + ms / 1000);
  osc.connect(amp).connect(ctx.destination);
  osc.start(at);
  osc.stop(at + ms / 1000);
}

/** 周波数を from から to へ滑らせる（投げる・吹き飛ぶ音） */
export function sweep(from: number, to: number, ms: number, gain = 0.12) {
  if (!ctx || audio.muted) return;
  const at = ctx.currentTime;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.frequency.setValueAtTime(from, at);
  osc.frequency.exponentialRampToValueAtTime(to, at + ms / 1000);
  amp.gain.setValueAtTime(gain, at);
  amp.gain.exponentialRampToValueAtTime(0.0001, at + ms / 1000);
  osc.connect(amp).connect(ctx.destination);
  osc.start(at);
  osc.stop(at + ms / 1000);
}

/** 減衰するホワイトノイズ（爆発音） */
export function noise(ms: number, gain = 0.3) {
  if (!ctx || audio.muted) return;
  const length = Math.floor((ctx.sampleRate * ms) / 1000);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 2;
  const src = ctx.createBufferSource();
  const amp = ctx.createGain();
  src.buffer = buffer;
  amp.gain.value = gain;
  src.connect(amp).connect(ctx.destination);
  src.start();
}

export const sfx = {
  start: () => {
    tone(440, 120);
    tone(660, 200, 'triangle', 0.14, 120);
  },
  finish: () => {
    tone(880, 140);
    tone(1175, 140, 'triangle', 0.14, 120);
    tone(1568, 320, 'triangle', 0.14, 240);
  }
};
