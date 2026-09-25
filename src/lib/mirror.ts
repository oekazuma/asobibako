// 記録の控え。localStorage の記録（バックアップと同じ JSON）を、別のファイルに置かれる IndexedDB へ写しておく。
// iOS のホーム画面アプリは、固まって終わらされたあとに localStorage がまるごと空になることがある。
// 起動したときに記録が 1 つもなく控えがあれば、控えから全部戻す
import { exportAll, hasRecords, importAll, parseBackup } from './backup';

export interface Store {
  get(): Promise<string | undefined>;
  set(text: string): Promise<void>;
}

const DB = 'asobibako-mirror';
const KEY = 'latest';
/** iOS の IndexedDB は開くところで止まることがある。記録を戻せないより、起動しないほうが困る */
const RESTORE_WAIT = 1500;

let opening: Promise<IDBDatabase> | undefined;

function open(): Promise<IDBDatabase> {
  opening ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  // 失敗した open を覚えたままにせず、次は開きなおす
  opening.catch(() => (opening = undefined));
  return opening;
}

export const idb: Store = {
  async get() {
    const db = await open();
    return new Promise((resolve, reject) => {
      const req = db.transaction('kv').objectStore('kv').get(KEY);
      req.onsuccess = () => resolve(typeof req.result === 'string' ? req.result : undefined);
      req.onerror = () => reject(req.error);
    });
  },
  async set(text) {
    const db = await open();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(text, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(tx.error);
    });
  }
};

let last = '';

/** いまの記録を控えに写す。記録が空のときは写さない（空で控えを上書きすると、戻す元がなくなる） */
export async function snapshot(version: string, store = idb): Promise<void> {
  try {
    if (!hasRecords()) return;
    const text = exportAll(version);
    if (text === last) return;
    await store.set(text);
    last = text;
  } catch {
    // 控えを残せなくても遊ぶのには困らない
  }
}

/** 記録が 1 つもなく控えがあれば、控えから全部戻す。戻したら true */
export async function restoreIfEmpty(store = idb, wait = RESTORE_WAIT): Promise<boolean> {
  try {
    if (hasRecords()) return false;
    const text = await Promise.race([
      store.get(),
      new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), wait))
    ]);
    return !!text && importAll(parseBackup(text));
  } catch {
    return false;
  }
}

/** 画面が隠れるとき・閉じるときと、見えているあいだは 30 秒ごとに控えを取る */
export function watch(version: string): () => void {
  const take = () => void snapshot(version);
  const hidden = () => {
    if (document.visibilityState === 'hidden') take();
  };
  const timer = setInterval(() => {
    if (document.visibilityState === 'visible') take();
  }, 30_000);
  document.addEventListener('visibilitychange', hidden);
  addEventListener('pagehide', take);
  take();
  return () => {
    clearInterval(timer);
    document.removeEventListener('visibilitychange', hidden);
    removeEventListener('pagehide', take);
  };
}
