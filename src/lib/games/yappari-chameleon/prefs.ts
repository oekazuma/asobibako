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
