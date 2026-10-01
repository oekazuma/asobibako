import type { IconName } from '$lib/icons';
import type { Seat } from '$lib/net/party.svelte';

/** 端末ごとに選ぶ動物。字を打たずに選べるので、小さい子もすぐ自分が分かる */
export const LOOKS = [
  { id: 'rabbit', name: 'うさぎ' },
  { id: 'cat', name: 'ねこ' },
  { id: 'dog', name: 'いぬ' },
  { id: 'bear', name: 'くま' },
  { id: 'mouse', name: 'ねずみ' },
  { id: 'sheep', name: 'ひつじ' },
  { id: 'wolf', name: 'おおかみ' },
  { id: 'bee', name: 'はち' }
] as const satisfies readonly { id: IconName; name: string }[];

export type Look = (typeof LOOKS)[number]['id'];

export const lookOf = (id?: string) => LOOKS.find((look) => look.id === id);

/** 番号の人の動物の名前。動物がまだ届いていない番号は番号で呼ぶ */
export const who = (seat: Seat, looks: Record<number, string>): string => lookOf(looks[seat])?.name ?? `${seat}P`;
