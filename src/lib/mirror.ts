// 記録の控え。localStorage の記録（バックアップと同じ JSON）を、別のファイルに置かれる IndexedDB へ写しておく。
// iOS のホーム画面アプリは、固まって終わらされたあとに localStorage がまるごと空になることがある。
// 起動したときに記録が 1 つもなく控えがあれば、控えから全部戻す
import { exportAll, hasRecords, importAll, parseBackup, RESTORE_PENDING_KEY, type Backup } from './backup';

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
    req.onsuccess = () => {
      const db = req.result;
      // iOS は裏に回ったあいだに接続を閉じることがある。覚えたままだと以後の控えがずっと失敗する
      db.onclose = () => (opening = undefined);
      db.onversionchange = () => {
        db.close();
        opening = undefined;
      };
      resolve(db);
    };
    req.onerror = () => reject(req.error);
  });
  // 失敗した open を覚えたままにせず、次は開きなおす
  opening.catch(() => (opening = undefined));
  return opening;
}

export const idb: Store = {
  async get() {
    const db = await open();
    return new Promise<string | undefined>((resolve, reject) => {
      const req = db.transaction('kv').objectStore('kv').get(KEY);
      req.onsuccess = () => resolve(typeof req.result === 'string' ? req.result : undefined);
      req.onerror = () => reject(req.error);
    }).catch((e) => {
      // 接続が閉じられていると transaction が投げる。opening を覚えたままだと以後ずっと失敗する
      opening = undefined;
      throw e;
    });
  },
  async set(text) {
    const db = await open();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(text, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(tx.error);
    }).catch((e) => {
      opening = undefined;
      throw e;
    });
  }
};

let last = '';
/** 控えを読み終えたか（控えが無かった・壊れていた場合も含む）。読めるまでは、控えを今の記録で上書きしない */
let verified = false;

/** いまの記録を控えに写す。記録が空のとき・控えをまだ読み終えていないときは写さない（戻す元がなくなるため） */
export async function snapshot(version: string, store = idb): Promise<void> {
  try {
    if (!verified || !hasRecords()) return;
    const text = exportAll(version);
    if (text === last) return;
    await store.set(text);
    last = text;
  } catch {
    // 控えを残せなくても遊ぶのには困らない
  }
}

const LATE = Symbol('late');

/** 記録が 1 つもなく控えがあれば、控えから全部戻す。戻したら true */
export async function restoreIfEmpty(store = idb, wait = RESTORE_WAIT): Promise<boolean> {
  try {
    if (hasRecords() && localStorage.getItem(RESTORE_PENDING_KEY) === null) {
      verified = true;
      return false;
    }
    // 読み切れずに遊び始めると記録が少し書かれる。次の起動でもそれに負けずに戻しにいくための印
    localStorage.setItem(RESTORE_PENDING_KEY, '1');
    const reading = store.get();
    const text = await Promise.race([reading, new Promise<typeof LATE>((r) => setTimeout(() => r(LATE), wait))]);
    if (text !== LATE) return restore(text);
    // 起動は待たせない。遅れて読めたら、そのあいだに書かれた数分ぶんより控えを取って読み直す
    void reading.then(
      (late) => restore(late) && location.reload(),
      () => {}
    );
    return false;
  } catch {
    return false;
  }
}

function restore(text: string | undefined): boolean {
  verified = true;
  try {
    localStorage.removeItem(RESTORE_PENDING_KEY);
    return !!text && importAll(parseBackup(text));
  } catch {
    return false;
  }
}

/** いまの控え。無い・壊れている・待ちきれないときは null。アプリについてで見せて、保護者が手で戻すのに使う */
export async function peek(store = idb, wait = RESTORE_WAIT): Promise<Backup | null> {
  try {
    const text = await Promise.race([store.get(), new Promise<typeof LATE>((r) => setTimeout(() => r(LATE), wait))]);
    return typeof text === 'string' ? parseBackup(text) : null;
  } catch {
    return null;
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
