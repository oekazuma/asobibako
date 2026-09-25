import type { Actor, WorldView } from './behavior';
import type { Cry } from './cries';
import type { PetFx } from './effects';
import type { CounterId, Pet } from './engine';
import type { Layout } from './layout';
import type { Part } from './petting';
import type { Session } from './session.svelte';
import type { PetWorld } from './world3d';

/** 部品（toys.ts など）に渡す Session の中身。s は画面から見える状態で、部品も読み書きする */
export interface Core {
  readonly s: Pick<
    Session,
    | 'save'
    | 'current'
    | 'scene'
    | 'tool'
    | 'toy'
    | 'activity'
    | 'moving'
    | 'away'
    | 'trickPending'
    | 'teaching'
    | 'trying'
    | 'toast'
    | 'covered'
    | 'setTool'
  >;
  readonly world: PetWorld;
  readonly fx: PetFx;
  readonly view: WorldView;
  readonly layout: Layout;
  readonly actors: Actor[];
  readonly touches: Touch[];
  /** frame に渡した dt を積んだ時計（秒） */
  readonly now: number;
  /** 盤面の幅と高さ（ピクセル） */
  readonly w: number;
  readonly h: number;
  actor(petId?: string): Actor | undefined;
  pet(petId: string): Pet | undefined;
  above(a: Actor, y?: number): [number, number];
  purse(): [number, number];
  say(text: string, seconds?: number): void;
  /** cry が無ければそのときの気分で鳴き方を決める */
  voice(pet: Pet, cry?: Cry): void;
  count(key: CounterId, n?: number): void;
  /** save を書き換えた。少しあとでまとめて保存する */
  changed(): void;
  /** しばらく指で遊んでいるときと同じ回数で描く */
  smooth(): void;
}

export interface Touch {
  id: number;
  x: number;
  y: number;
  /** 置いた位置 */
  sx: number;
  sy: number;
  t0: number;
  moved: number;
  /** このフレームにペットの上で動いた距離（ピクセル） */
  rub: number;
  pet: string | null;
  /** 指の下の体の場所。ペットの上を動くたびに引き直す */
  part: Part | null;
  /** part と違う場所の上を続けて動いた距離（ピクセル） */
  stray: number;
  mode: 'rub' | 'floor' | 'wand' | 'throw' | 'teach';
}
