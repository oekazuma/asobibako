import type { ClientInit, HandleClientError } from '@sveltejs/kit';
import { remember } from '$lib/last-error';
import { migrateStorage } from '$lib/storage-migrate';

export const handleError: HandleClientError = ({ error, message }) => {
  remember(error instanceof Error ? error.message : message);
};

// ページやストアが保存値を読む前に、改名前の保存名を移す（プリレンダーでは走らない）
export const init: ClientInit = migrateStorage;
