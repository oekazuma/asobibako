import { DEFAULTS, fit, type Settings } from './referee';

export const SETTINGS_KEY = 'asobibako:yappari-chameleon:settings';
const NUMBERS = ['hunters', 'hide', 'search', 'reveal', 'taunt'] as const;

/** 親が前に選んだマップの設定。読めない値は既定に戻し、範囲に収める（人数は始めるときに合わせる） */
export function readSettings(): Settings {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') as Partial<Settings>;
    const merged = { ...DEFAULTS, ...saved };
    if (NUMBERS.some((k) => !Number.isFinite(merged[k]))) return DEFAULTS;
    return fit(merged, 3);
  } catch {
    return DEFAULTS;
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // 覚えられなくても、選んだ設定で始められる
  }
}
