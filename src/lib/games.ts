import type { Component } from 'svelte';
import BorderRush from './games/border-rush/BorderRush.svelte';
import type { Player } from './player';

export interface GameDef {
  id: string;
  name: string;
  component: Component<{ onfinish: (winner: Player) => void }>;
}

export const games: GameDef[] = [{ id: 'border-rush', name: 'せめぎあい', component: BorderRush }];
