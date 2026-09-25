import type { ClientInit, HandleClientError } from '@sveltejs/kit';
import { remember } from '$lib/last-error';
import { restoreIfEmpty } from '$lib/mirror';
import { migrateStorage } from '$lib/storage-migrate';

export const handleError: HandleClientError = ({ error, message }) => {
  remember(error instanceof Error ? error.message : message);
};

// ページやストアが保存値を読む前に、改名前の保存名を移し、記録が空なら IndexedDB の控えから戻す（プリレンダーでは走らない）
export const init: ClientInit = async () => {
  migrateStorage();
  await restoreIfEmpty();
  // 容量が足りないときなどに iPad がこのアプリの記録を消さないよう頼む。断られても遊ぶのには困らない
  try {
    void navigator.storage?.persist?.().catch(() => {});
  } catch {
    // 古い端末には無い
  }
};
