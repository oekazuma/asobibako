/**
 * 朝・昼・夕方・夜と、その日の天気。端末の時計から光と空の色を決める。DOM も three も使わない。
 * 昼（10〜16 時）の晴れは、時間帯を入れる前の見た目と同じ数字にしてある
 */

export type Weather = 'sunny' | 'cloudy' | 'rain' | 'snow';
export type Phase = 'morning' | 'day' | 'evening' | 'night';
type Vec = [number, number, number];

export const PHASE_NAME: Record<Phase, string> = { morning: 'あさ', day: 'ひる', evening: 'ゆうがた', night: 'よる' };
export const WEATHER_NAME: Record<Weather, string> = { sunny: 'はれ', cloudy: 'くもり', rain: 'あめ', snow: 'ゆき' };

export interface Daylight {
  hour: number;
  phase: Phase;
  weather: Weather;
  /** 0 が昼、1 が夜。ペットの眠くなりやすさにも使う */
  night: number;
  /** 外の日（夜は月）。dir は地面から光のほうへの向き、power は DirectionalLight の強さ */
  sun: { dir: Vec; color: string; power: number };
  /** 部屋の中の光。昼は窓からの日、夜は天井の明かりで、真上から照らしてペットの足元に影を落とす */
  room: { dir: Vec; color: string; power: number; hemi: string; hemiPower: number };
  /** 空と地面の照り返し。power は外の場面のもとの強さに掛ける */
  hemi: { sky: string; ground: string; power: number };
  /** 空のドームの上・中ほど・地平線 */
  sky: [string, string, string];
  fog: string;
  /** 窓の外の景色の絵に掛ける色 */
  view: string;
  /** 窓から床へ落ちる日だまり。power はもとの濃さに掛ける */
  patch: { color: string; power: number };
  /** 部屋のランプと外の街灯（0..1） */
  lamps: number;
  stars: number;
}

interface Key {
  h: number;
  sun: string;
  power: number;
  /** 日の高さ（度）と、昼の向きからの横の振れ（度） */
  elev: number;
  az: number;
  sky: [string, string, string];
  fog: string;
  view: string;
  patch: string;
  patchPower: number;
  lamps: number;
  stars: number;
  hemi: [string, string, number];
  night: number;
}

const NIGHT: Omit<Key, 'h'> = {
  sun: '#9fb4e8',
  power: 1.1,
  elev: 62,
  az: 40,
  sky: ['#0c1430', '#1c2a58', '#34426e'],
  fog: '#2a3558',
  view: '#3a4880',
  patch: '#8090c0',
  patchPower: 0,
  lamps: 1,
  stars: 1,
  hemi: ['#8a9ad0', '#4a4058', 0.95],
  night: 1
};

const NOON: Omit<Key, 'h'> = {
  sun: '#ffe2c2',
  power: 3,
  elev: 55.8,
  az: 0,
  sky: ['#6fa8d8', '#b4d3ea', '#e2edf2'],
  fog: '#dbe9f2',
  view: '#ffffff',
  patch: '#ffd9a0',
  patchPower: 1,
  lamps: 0,
  stars: 0,
  hemi: ['#f4f1ff', '#b08a66', 1],
  night: 0
};

/**
 * 時刻ごとの見本。あいだはなめらかにつなぐ。
 * 日の高さは 33 度より下げない（横の窓から床へ写す日だまりが、低い日だと向かいの壁を突き抜ける）
 */
const KEYS: Key[] = [
  { h: 0, ...NIGHT },
  { h: 4.5, ...NIGHT },
  {
    h: 6,
    sun: '#ffcaa8',
    power: 1.6,
    elev: 38,
    az: 30,
    sky: ['#7d9cc8', '#e8c4c4', '#ffdcc4'],
    fog: '#e6d6d4',
    view: '#ffe4d8',
    patch: '#ffe6d0',
    patchPower: 0.7,
    lamps: 0.3,
    stars: 0,
    hemi: ['#e8dcf0', '#a08070', 0.85],
    night: 0.3
  },
  {
    h: 8,
    sun: '#fff3e2',
    power: 2.7,
    elev: 42,
    az: 22,
    sky: ['#78b0de', '#c0daee', '#eef4f6'],
    fog: '#dde9f0',
    view: '#fbfcff',
    patch: '#fff4e6',
    patchPower: 0.95,
    lamps: 0,
    stars: 0,
    hemi: ['#f4f4ff', '#b08a66', 1],
    night: 0
  },
  { h: 10.5, ...NOON },
  { h: 15.5, ...NOON },
  {
    h: 17,
    sun: '#ffac6a',
    power: 2.7,
    elev: 35,
    az: -20,
    sky: ['#6a8cc8', '#f2b48a', '#ffcf98'],
    fog: '#f2d0b0',
    view: '#ffc49a',
    patch: '#ff9a4c',
    patchPower: 1.3,
    lamps: 0.3,
    stars: 0,
    hemi: ['#ffe0c8', '#a07058', 0.95],
    night: 0.1
  },
  {
    h: 18.5,
    sun: '#d890a0',
    power: 1.5,
    elev: 34,
    az: -25,
    sky: ['#26336a', '#6a5690', '#d88a88'],
    fog: '#8a6e8a',
    view: '#8878a8',
    patch: '#ff8a60',
    patchPower: 0.3,
    lamps: 0.9,
    stars: 0.3,
    hemi: ['#b8a8d8', '#6a5060', 0.9],
    night: 0.6
  },
  { h: 19.5, ...NIGHT },
  { h: 24, ...NIGHT }
];

/** 昼の日の横の向き（部屋の左の窓の側、少し奥から） */
const BASE_AZ = Math.atan2(-0.8, -2.6);
const CEILING: Vec = [-0.3, 4, 0.5];
const BULB = '#ffc890';

export function phaseOf(hour: number): Phase {
  const h = ((hour % 24) + 24) % 24;
  if (h >= 5 && h < 10) return 'morning';
  if (h >= 10 && h < 16) return 'day';
  if (h >= 16 && h < 19) return 'evening';
  return 'night';
}

export function daylight(hour: number, weather: Weather): Daylight {
  const h = ((hour % 24) + 24) % 24;
  const i = KEYS.findIndex((k) => k.h > h);
  const a = KEYS[i - 1];
  const b = KEYS[i];
  const t = (h - a.h) / (b.h - a.h);
  const num = (x: number, y: number) => x + (y - x) * t;
  const col = (x: string, y: string) => mix(x, y, t);

  const elev = (num(a.elev, b.elev) * Math.PI) / 180;
  const az = BASE_AZ + (num(a.az, b.az) * Math.PI) / 180;
  const dir = norm([Math.cos(az) * Math.cos(elev), Math.sin(elev), Math.sin(az) * Math.cos(elev)]);
  let lamps = num(a.lamps, b.lamps);
  let power = num(a.power, b.power);
  let sun = col(a.sun, b.sun);
  let sky = [0, 1, 2].map((k) => col(a.sky[k], b.sky[k])) as Daylight['sky'];
  let fog = col(a.fog, b.fog);
  let view = col(a.view, b.view);
  let patchPower = num(a.patchPower, b.patchPower);
  let hemiPower = num(a.hemi[2], b.hemi[2]);

  // 雲の日は日を弱め、空と窓の色を灰色へ寄せる。灰色はその色の明るさのままにするので、夜は暗い灰色になる
  const over = OVERCAST[weather];
  if (over) {
    power *= over.sun;
    patchPower *= over.patch;
    hemiPower *= over.hemi;
    sun = gray(sun, 0.5, 1);
    sky = sky.map((c) => gray(c, over.gray, over.light)) as Daylight['sky'];
    fog = gray(fog, over.gray, over.light);
    view = gray(view, over.gray * 0.6, over.light);
    lamps = Math.max(lamps, over.lamps);
  }

  const room = {
    dir: norm(lerpVec(dir, norm(CEILING), lamps)),
    color: mix(sun, BULB, lamps),
    power: power * (1 - lamps) + 1.4 * lamps,
    hemi: mix(col(a.hemi[0], b.hemi[0]), '#ffd8ac', lamps),
    hemiPower: hemiPower * (1 - lamps) + 0.85 * lamps
  };
  return {
    hour: h,
    phase: phaseOf(h),
    weather,
    night: num(a.night, b.night),
    sun: { dir, color: sun, power },
    room,
    hemi: { sky: col(a.hemi[0], b.hemi[0]), ground: col(a.hemi[1], b.hemi[1]), power: hemiPower },
    sky,
    fog,
    view,
    patch: { color: col(a.patch, b.patch), power: patchPower },
    lamps,
    stars: weather === 'sunny' ? num(a.stars, b.stars) : 0
  };
}

const OVERCAST: Record<
  Weather,
  { sun: number; patch: number; hemi: number; gray: number; light: number; lamps: number } | null
> = {
  sunny: null,
  cloudy: { sun: 0.45, patch: 0.25, hemi: 1.2, gray: 0.6, light: 1, lamps: 0 },
  rain: { sun: 0.3, patch: 0, hemi: 1.15, gray: 0.8, light: 0.85, lamps: 0.35 },
  snow: { sun: 0.45, patch: 0.3, hemi: 1.25, gray: 0.7, light: 1.05, lamps: 0.15 }
};

/** その日の天気。同じ日付なら何度開いても同じ。雪は冬（12〜2 月）だけ */
export function weatherOn(year: number, month: number, day: number): Weather {
  const r = hash(year * 372 + month * 31 + day);
  const winter = month === 12 || month <= 2;
  if (r < 0.2) return 'rain';
  if (winter && r < 0.4) return 'snow';
  if (r < (winter ? 0.6 : 0.4)) return 'cloudy';
  return 'sunny';
}

/**
 * いまの時刻（時、小数つき）と天気。globalThis.__asobibakoClock に { hour, weather } を置くと差し替わる
 * （画面の確かめで、時刻と天気を切り替えて撮るための口。画面には出さない）
 */
export function now(at = new Date()): { hour: number; weather: Weather } {
  const pin = (globalThis as { __asobibakoClock?: { hour?: number; weather?: Weather } }).__asobibakoClock;
  return {
    hour: pin?.hour ?? at.getHours() + at.getMinutes() / 60,
    weather: pin?.weather ?? weatherOn(at.getFullYear(), at.getMonth() + 1, at.getDate())
  };
}

/** 開いたときの一言 */
export function greeting(phase: Phase, weather: Weather): string {
  if (weather === 'rain') return 'きょうは あめだね';
  if (weather === 'snow') return 'ゆきが ふってるね';
  if (weather === 'cloudy') return 'きょうは くもりだね';
  return {
    morning: 'おはよう！ いい てんきだね',
    day: 'きょうは いい てんきだね',
    evening: 'ゆうやけが きれいだね',
    night: 'ほしが きれいな よるだね'
  }[phase];
}

function hash(n: number): number {
  let x = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  return ((x ^ (x >>> 16)) >>> 0) / 2 ** 32;
}

const rgb = (hex: string): Vec => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Vec;
const hex = (c: Vec) =>
  '#' +
  c
    .map((v) =>
      Math.round(Math.min(255, Math.max(0, v)))
        .toString(16)
        .padStart(2, '0')
    )
    .join('');

export function mix(a: string, b: string, t: number): string {
  const x = rgb(a);
  const y = rgb(b);
  return hex([0, 1, 2].map((k) => x[k] + (y[k] - x[k]) * t) as Vec);
}

/** 色を、同じ明るさの灰色へ t だけ寄せて light 倍する */
function gray(c: string, t: number, light: number): string {
  const v = rgb(c);
  const l = 0.3 * v[0] + 0.59 * v[1] + 0.11 * v[2];
  return hex(v.map((x) => (x + (l - x) * t) * light) as Vec);
}

const lerpVec = (a: Vec, b: Vec, t: number): Vec => [0, 1, 2].map((k) => a[k] + (b[k] - a[k]) * t) as Vec;
function norm(v: Vec): Vec {
  const l = Math.hypot(...v);
  return [v[0] / l, v[1] / l, v[2] / l];
}
