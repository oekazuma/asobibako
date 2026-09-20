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

function tone(freq: number, ms: number, type: OscillatorType = 'triangle', gain = 0.14, delay = 0) {
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

export const sfx = {
  tap: () => tone(660, 90),
  hold: () => {
    tone(520, 90);
    tone(780, 160, 'triangle', 0.14, 70);
  },
  contest: () => {
    tone(990, 120, 'square', 0.1);
    tone(1320, 180, 'square', 0.08, 90);
  },
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
