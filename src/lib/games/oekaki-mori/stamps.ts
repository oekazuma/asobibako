import type { IconName } from '$lib/icons';

/** 当てる人が描く人へ送るスタンプ。字を打てない小さい子も参加できる */
export const STAMPS = [
  { id: 'like', icon: 'heart', name: 'いいね' },
  { id: 'wow', icon: 'star', name: 'すごい' },
  { id: 'huh', icon: 'help', name: 'わかんない' },
  { id: 'idea', icon: 'bolt', name: 'ひらめいた' }
] as const satisfies readonly { id: string; icon: IconName; name: string }[];

export const stampOf = (id: string) => STAMPS.find((s) => s.id === id);
