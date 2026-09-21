import type { Component } from 'svelte';
import bombRelay from './games/bomb-relay/meta';
import borderRush from './games/border-rush/meta';
import colorGrab from './games/color-grab/meta';
import hockey from './games/hockey/meta';
import type { Player } from './player';

export interface GameProps {
  /** 勝者が決まったら 1 回だけ呼ぶ。1 が手前、2 が向かい */
  onfinish: (winner: Player) => void;
}

export interface GameModule {
  Game: Component<GameProps>;
  /** タイトル画面の上下それぞれに出す遊び方。1 行のルールと凡例くらいに留める */
  Howto: Component;
}

export interface GameMeta {
  /** URL（/games/<id>）に使うので kebab-case */
  id: string;
  name: string;
  description: string;
  players: number;
  minutes: string;
  /** 一覧画面に全ゲームの本体を載せないよう、遊ぶときに読み込む */
  load: () => Promise<GameModule>;
}

export const games: GameMeta[] = [borderRush, bombRelay, colorGrab, hockey];
