import { CPU_DEFAULT, type CpuChoice } from './cpu/levels';
import { DEFAULTS, fit, type Settings } from './referee';

export const SETTINGS_KEY = 'asobibako:yappari-chameleon:settings';
const NUMBERS = ['hunters', 'hide', 'search', 'reveal', 'taunt'] as const;
/** 保存の版。印の無い保存の隠れる時間 60 は、選んだ値ではなく前の版の既定なので今の既定で読む */
const VERSION = 2;

/** 親が前に選んだマップの設定。読めない値は既定に戻し、範囲に収める（人数は始めるときに合わせる） */
export function readSettings(): Settings {
  try {
    const { v, ...saved } = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') as Partial<Settings> & {
      v?: number;
    };
    if (v !== VERSION && saved.hide === 60) saved.hide = DEFAULTS.hide;
    const merged = { ...DEFAULTS, ...saved };
    if (NUMBERS.some((k) => !Number.isFinite(merged[k]))) return DEFAULTS;
    return fit(merged, 3);
  } catch {
    return DEFAULTS;
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...s, v: VERSION }));
  } catch {
    // 覚えられなくても、選んだ設定で始められる
  }
}

export const CPU_KEY = 'asobibako:yappari-chameleon:cpu';

const one = <T>(v: unknown, list: readonly T[], or: T): T => (list.includes(v as T) ? (v as T) : or);

/** 前に選んだ CPU の設定。知らない値は既定に戻す */
export function readCpu(): CpuChoice {
  try {
    const s = JSON.parse(localStorage.getItem(CPU_KEY) ?? '{}') as Record<string, unknown>;
    const side = one(s.side, ['hide', 'seek'] as const, CPU_DEFAULT.side);
    return {
      side,
      count: one(s.count, [1, 2] as const, CPU_DEFAULT.count),
      // 隠れるときはプレイヤー 1 人が隠れ、見つかった時点で終わるので、増え鬼にしない
      mode: side === 'hide' ? 'normal' : one(s.mode, ['normal', 'infect'] as const, CPU_DEFAULT.mode),
      strength: one(s.strength, ['weak', 'normal', 'strong'] as const, CPU_DEFAULT.strength)
    };
  } catch {
    return { ...CPU_DEFAULT };
  }
}

export function saveCpu(c: CpuChoice): void {
  try {
    localStorage.setItem(CPU_KEY, JSON.stringify(c));
  } catch {
    // 覚えられなくても、選んだ設定で始められる
  }
}
