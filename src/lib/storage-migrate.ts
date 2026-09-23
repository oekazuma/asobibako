const OLD = 'table-duel:';
const NEW = 'asobibako:';

/**
 * 改名前の保存名（table-duel:）を asobibako: へ移す。同じ github.io 配下なので古い端末には旧名の記録が残っている。
 * 新しい名前がすでにあればそちらを残す（移したあとに遊んだ記録を古い値で戻さないため）
 */
export function migrateStorage(): void {
  try {
    for (const old of Object.keys(localStorage).filter((k) => k.startsWith(OLD))) {
      const key = NEW + old.slice(OLD.length);
      const value = localStorage.getItem(old);
      if (localStorage.getItem(key) === null && value !== null) localStorage.setItem(key, value);
      localStorage.removeItem(old);
    }
  } catch {
    // 使えない・容量が尽きた端末では何もしない。旧名の残りは次に開いたときにまた移す
  }
}
