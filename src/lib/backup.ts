import { MUTED_KEY } from './audio.svelte';
import { GATE_KEY } from './gate.svelte';
import { LAST_ERROR_KEY } from './last-error';
import { MENU_TAB_KEY, RECENT_KEY } from './recent';
import { today } from './today';

// 記録のバックアップ。localStorage の asobibako: で始まるキーをまとめて 1 つの JSON にし、読み込みは全部置き換える
// （サーバーや同期は持たない。保護者が自分で持つファイルだけ）
export type Backup = { app: 'asobibako'; version: string; at: string; data: Record<string, string> };
const PREFIX = 'asobibako:';
/** 前の起動で控えを読み切れなかった印。端末ごとの状態なので書き出さない */
export const RESTORE_PENDING_KEY = 'asobibako:restore-pending';
// 端末ごとの控え。持ち運ぶと別の端末のエラーやゲートの回数が混ざる。
// 'asobibako:graphics' は前の版の画質の設定。端末ごとの値なので持ち込まない
const EXCLUDED = new Set([LAST_ERROR_KEY, GATE_KEY, 'asobibako:graphics', RESTORE_PENDING_KEY]);

// 常識外のファイルを弾く上限。わんにゃんハウスの写真やらくがきパレードのずかんで 1MB を超えるが、
// localStorage そのものが数 MB までなので、それより大きな正規の書き出しはない。キーはゲーム数 + 数個
const MAX_KEYS = 400;
const MAX_CHARS = 16 * 1024 * 1024;
/** 最後に書き出した日（YYYY-MM-DD）。書き出しにも入るので、別の端末へ移しても「いつの控えか」が残る */
export const BACKUP_AT_KEY = 'asobibako:backup-at';
// 書き出しには入れるが「記録がある」とは数えない。ゲームを開くだけで書かれるので、これで記録ありとみなすと、
// 消えたあとの起動で控えから戻さず、空に近い中身で控えを上書きしてしまう
const NOT_RECORDS = new Set([BACKUP_AT_KEY, RECENT_KEY, MENU_TAB_KEY, MUTED_KEY]);

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const backedUp = (k: string) => k.startsWith(PREFIX) && !EXCLUDED.has(k);
const keys = () => Object.keys(localStorage).filter(backedUp);

/** 書き出して残す記録が 1 つでもあるか */
export const hasRecords = () => keys().some((k) => !NOT_RECORDS.has(k));

export function markBackedUp(): void {
  try {
    localStorage.setItem(BACKUP_AT_KEY, today());
  } catch {
    // 残せなくても書き出しそのものは済んでいる
  }
}

/** 最後に書き出した日。まだなら null */
export function backedUpAt(): string | null {
  try {
    return localStorage.getItem(BACKUP_AT_KEY);
  } catch {
    return null;
  }
}

export function exportAll(version: string): string {
  const data: Record<string, string> = {};
  for (const k of keys()) data[k] = localStorage.getItem(k) ?? '';
  const b: Backup = { app: 'asobibako', version, at: today(), data };
  return JSON.stringify(b);
}

export const backupName = () => `asobibako-${today()}.json`;

/** iPad の共有シート（AirDrop・ファイル・メール）に渡すための File。中身は exportAll と同じ */
export const backupFile = (version: string) =>
  new File([exportAll(version)], backupName(), { type: 'application/json' });

/** 形が違えば throw する（呼び出し側が「読み込めません」と出す） */
export function parseBackup(text: string): Backup {
  if (text.length > MAX_CHARS) throw new Error('backup');
  const v: unknown = JSON.parse(text);
  if (!isObject(v) || v.app !== 'asobibako' || !isObject(v.data)) throw new Error('backup');
  if (typeof v.version !== 'string' || typeof v.at !== 'string') throw new Error('backup');
  const entries = Object.entries(v.data);
  if (entries.length > MAX_KEYS) throw new Error('backup');
  const data: Record<string, string> = {};
  for (const [k, val] of entries) {
    if (!k.startsWith(PREFIX) || typeof val !== 'string') throw new Error('backup');
    // 端末ごとの控えは持ち込まない。拒むと、除くキーを足す前に書き出したファイルや控えが読めなくなる
    if (!EXCLUDED.has(k)) data[k] = val;
  }
  return { app: 'asobibako', version: v.version, at: v.at, data };
}

// 途中で容量超過しても記録を失わないよう、いまの記録を控えてから置き換え、失敗したら控えを戻す
export function importAll(b: Backup): boolean {
  try {
    const before = Object.fromEntries(keys().map((k) => [k, localStorage.getItem(k) ?? '']));
    const replace = (data: Record<string, string>) => {
      for (const k of keys()) localStorage.removeItem(k);
      for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v);
    };
    try {
      replace(b.data);
      return true;
    } catch {
      try {
        replace(before);
      } catch {
        // 控えも戻せない = もともと容量が尽きている。これ以上は何もできない
      }
      return false;
    }
  } catch {
    // localStorage そのものが使えない（プライベートブラウズなど）
    return false;
  }
}

/** 読み込み前の確認に見せる数字。games はレベルを進めたゲームの本数（100 面だったころの保存名も数える） */
export function summarize(b: Backup): { games: number; keys: number; at: string } {
  const ids = Object.keys(b.data).flatMap((k) => k.match(/^asobibako:(?:reached|level):(.+)$/)?.[1] ?? []);
  return { games: new Set(ids).size, keys: Object.keys(b.data).length, at: b.at };
}
