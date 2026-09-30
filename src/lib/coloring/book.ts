import type { Step } from './paint';
import { SIZE } from './regions';

export const LIMIT = 30;

/** randomUUID は安全な接続（https）でしか使えないので、http で開いた開発の画面のために代わりを用意する */
export const newId = () => crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

export interface Work {
  id: string;
  template?: string;
  /** テンプレートの作品の、塗る場所を分けた線画（1 画素 1 ビット）。テンプレートのパスを直しても、保存した作品の場所の番号がずれないようにする */
  lines?: Uint8Array;
  /** 写真から作った線画。1 画素 1 ビットに詰める（そのままだと 1 作品 590KB になる） */
  photo?: Uint8Array;
  colors: Record<number, string>;
  history: Step[];
  /** ぬりえちょうに並べる小さな見本（data URL） */
  thumb: string;
  updated: number;
}

export function pack(mask: Uint8Array): Uint8Array {
  const bits = new Uint8Array(Math.ceil(mask.length / 8));
  for (let i = 0; i < mask.length; i++) if (mask[i]) bits[i >> 3] |= 1 << (i & 7);
  return bits;
}

export function unpack(bits: Uint8Array, n = SIZE * SIZE): Uint8Array {
  const mask = new Uint8Array(n);
  for (let i = 0; i < n; i++) mask[i] = (bits[i >> 3] >> (i & 7)) & 1;
  return mask;
}

export function overflow(works: { id: string; updated: number }[], limit = LIMIT): string[] {
  return [...works]
    .sort((a, b) => b.updated - a.updated)
    .slice(limit)
    .map((w) => w.id);
}

const DB = 'asobibako-nurie';
const STORE = 'works';
let opening: Promise<IDBDatabase> | undefined;

function open(): Promise<IDBDatabase> {
  opening ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => {
      const db = req.result;
      // iOS は裏に回ったあいだに接続を閉じることがある。覚えたままだと以後の保存がずっと失敗する
      db.onclose = () => (opening = undefined);
      resolve(db);
    };
    req.onerror = () => reject(req.error);
  });
  opening.catch(() => (opening = undefined));
  return opening;
}

async function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = work(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req ? req.result : (undefined as T));
    tx.onerror = tx.onabort = () => reject(tx.error);
  }).catch((e) => {
    opening = undefined;
    throw e;
  });
}

export async function listWorks(): Promise<Work[]> {
  const all = await run<Work[]>('readonly', (s) => s.getAll());
  return all.sort((a, b) => b.updated - a.updated);
}

export async function saveWork(work: Work): Promise<void> {
  await run('readwrite', (s) => void s.put(work));
  const all = await listWorks();
  const drop = overflow(all);
  if (drop.length) await run('readwrite', (s) => void drop.forEach((id) => s.delete(id)));
}

export async function removeWork(id: string): Promise<void> {
  await run('readwrite', (s) => void s.delete(id));
}
