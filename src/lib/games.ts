import type { Component } from 'svelte';
import bombRelay from './games/bomb-relay/meta';
import borderRush from './games/border-rush/meta';
import bugRush from './games/bug-rush/meta';
import catMouse from './games/cat-mouse/meta';
import dentist from './games/dentist/meta';
import dogGuard from './games/dog-guard/meta';
import doodleWorm from './games/doodle-worm/meta';
import gateRun from './games/gate-run/meta';
import hirameki from './games/hirameki/meta';
import hockey from './games/hockey/meta';
import lightning from './games/lightning/meta';
import pinRescue from './games/pin-rescue/meta';
import snowCamp from './games/snow-camp/meta';
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

export interface SoloProps {
  /** 1 から meta.levels まで。ゲームはこの数で難しさや面を選ぶ */
  level: number;
  /** クリアかしっぱいが決まったら 1 回だけ呼ぶ */
  onfinish: (cleared: boolean) => void;
  /** 画面の上に出す「いまやること」。空文字で消す。呼ばなければ何も出ない */
  onhint?: (text: string) => void;
}

export interface SoloModule {
  Game: Component<SoloProps>;
  Howto: Component;
}

interface BaseMeta {
  /** URL（/games/<id>）に使うので kebab-case */
  id: string;
  name: string;
  description: string;
  minutes: string;
}

/** 本体は、一覧画面に全ゲームを載せないよう load() で遊ぶときに読み込む */
export interface DuelMeta extends BaseMeta {
  players: 2;
  load: () => Promise<GameModule>;
}

/** 画面全体を 1 人で使い、レベルを順にクリアしていく */
export interface SoloMeta extends BaseMeta {
  players: 1;
  /** 面の数。最後の面をクリアしたら全クリ。1 ならレベル選びを出さず、onfinish を呼ばない自由あそびにしてよい */
  levels: number;
  /** 1 面の呼び方。難しさの順に並ばないゲームは「レベル」と呼ばない。なければ「レベル」 */
  levelName?: string;
  /**
   * ゲームが自分で結果（正解の説明など）を見せる。共通の結果画面を出さず、クリアなら次の面、しっぱいなら同じ面をすぐ始める。
   * 最後の面をクリアしたときだけは「ぜんぶクリア」の結果画面を出す
   */
  ownResult?: boolean;
  load: () => Promise<SoloModule>;
}

export type GameMeta = DuelMeta | SoloMeta;

export const games: GameMeta[] = [
  pinRescue,
  hirameki,
  gateRun,
  dogGuard,
  snowCamp,
  dentist,
  doodleWorm,
  borderRush,
  bombRelay,
  hockey,
  bugRush,
  lightning,
  catMouse
];
