import type { Component } from 'svelte';
import animalSurvivors from './games/animal-survivors/meta';
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
import nurie from './games/nurie/meta';
import oekakiMori from './games/oekaki-mori/meta';
import petHouse from './games/pet-house/meta';
import pinRescue from './games/pin-rescue/meta';
import snowCamp from './games/snow-camp/meta';
import yappariChameleon from './games/yappari-chameleon/meta';
import type { Net } from './net/link';
import type { Player } from './player';

export interface GameProps {
  /** 勝者が決まったら 1 回だけ呼ぶ。1 が手前、2 が向かい */
  onfinish: (winner: Player) => void;
  /** 2 台の端末で遊ぶときだけ渡る。親が 1P を持ち、ルールを進めて子へ盤面を送る */
  net?: Net;
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
  /** ゲームが自分の画面から抜けるとき（meta.ownMenu のゲームの「タイトルへ」）に呼ぶ */
  onquit?: () => void;
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
  /** 2 台の端末をつないで遊べる。本体は GameProps の net を扱う */
  net?: true;
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
  /** 面を好きな順に選べ、とばせる。解いた面を 1 つずつ覚える（難しさの順に並ばないナゾ解きなど） */
  anyOrder?: boolean;
  /** 遊んでいるあいだの隅の ✕ と ↻ を出さない。ゲームが自分で一時停止やタイトルへ戻る口を持つ（長い 1 回を押し間違いで失わないため） */
  ownMenu?: boolean;
  /** 横持ちで遊ぶ。シェルの枠を横向きのタッチ端末で 90 度回さない（端末を手に持って 3D を見回すゲーム） */
  landscape?: true;
  load: () => Promise<SoloModule>;
}

/** 1 人 1 台の端末で遊ぶ。共通のシェルを通さず、ロビーから結果までの画面をゲームが持つ */
export interface PartyMeta extends BaseMeta {
  players: 2;
  party: true;
  load: () => Promise<{ Game: Component }>;
}

export type GameMeta = DuelMeta | SoloMeta | PartyMeta;

export const games: GameMeta[] = [
  yappariChameleon,
  animalSurvivors,
  petHouse,
  pinRescue,
  hirameki,
  gateRun,
  dogGuard,
  snowCamp,
  dentist,
  nurie,
  doodleWorm,
  oekakiMori,
  borderRush,
  bombRelay,
  hockey,
  bugRush,
  lightning,
  catMouse
];
