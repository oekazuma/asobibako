import type * as THREE from 'three';
import type { Actor, BehaviorEvent, WorldView } from './behavior';
import type { Track } from './bgm';
import type { Cry } from './cries';
import type { Daylight } from './daytime';
import type { PetFx } from './effects';
import type { CounterId, Pet, Save } from './engine';
import type { Layout } from './layout';
import type { Tool } from './session.svelte';
import type { BaseScene, Scene, ToyId, TrickId } from './types';
import type { PetWorld } from './world3d';

/**
 * 遊びのモード（コンテスト・おふろ・リードのおさんぽ・ふれあいひろば・しつけのリズムあそび）を Session に挿す口。
 *
 * 挿し方:
 * - Activity を実装したクラスを `.svelte.ts` に置き、画面に出す値はそのクラスの `$state` の欄に持つ
 * - 画面は `session.start(new MyActivity(...), 'おふろへ いくよ')` で始める。Session は「いどうちゅう」を
 *   1 度描かせてから `enter(host)` を呼ぶ（2 フレームあと）。
 *   PetHouse.svelte はモードのあいだ下のメニュー・道具・ペットの札を隠すので、
 *   `session.activity instanceof MyActivity` のときに自分の HUD（例 ContestHud.svelte）を出す
 * - 自分の場面へは `host.enter(scene)`。ActivityScene の layout がペットの歩ける範囲とカメラ、
 *   build が three の組み立て（例 scene-contest.ts）。world3d.ts と layout.ts には足さなくてよい。
 *   types.ts の Scene に名前を 1 つ足す（behavior の歩き回り方が scene の名前を見る）
 * - Session は毎フレーム、think より先に `frame(dt)` を呼ぶ。`drives` が true のあいだは
 *   think・なでる・ねこじゃらし・ふつうの指の処理を止めるので、モードが actor の
 *   x・z・heading・action・speed・wag・look を毎フレーム書く（world3d はそれを描くだけ）
 * - drives が false なら、ふつうの遊び（投げる・ねこじゃらし・なでる・床をタップして呼ぶ）がそのまま動く。
 *   down / move / up が true を返した指は、ふつうの処理へ渡さない
 * - ペットの出来事（caught・fetched など）は Session の演出より先に event へ渡る。true を返すと
 *   Session の演出とげんきの減りを飛ばす
 * - しつけのボタン（session.trick）は、モードのあいだ trick へ渡る（無ければ何もしない）
 * - 終わるときは `host.end()`。部屋へ戻り、持ち替えた道具も戻して、session.activity は null になる。
 *   戻るのは 2 フレームあとで、それまでは frame が呼ばれつづけ、重ねて呼んだ end() は捨てる
 * - Session は描く回数を減らして発熱を抑えるので、動きの細かさが遊びそのもののモード（リズムあそび）は smooth を true にする。
 *   draw は 3D の上の 2D の canvas に、ハートなどの演出より先に描く口（盤面の中のピクセル）
 * - 飼っているペットを連れないモード（ふれあいひろば）は Visit を実装して `session.visit(...)` で始める。
 *   0 匹でも始められ、host に pet・actor・voice が無い。動物は `host.cast(pets, actors)` で自分の子を出し、
 *   drives を true にして think もモードが呼ぶ（例 plaza.svelte.ts）
 */
export interface Activity {
  readonly drives: boolean;
  /** 指が止まっていても 1 秒に 60 回描く */
  readonly smooth?: boolean;
  /** 寝ている子とは始めない（おさんぽ）。無ければ start が起こしてから始める */
  readonly awakeOnly?: boolean;
  enter(host: ActivityHost): void;
  frame(dt: number): void;
  down?(id: number, px: number, py: number): boolean;
  move?(id: number, px: number, py: number): boolean;
  up?(id: number, px: number, py: number, vx: number, vy: number): boolean;
  event?(e: BehaviorEvent): boolean;
  trick?(trick: TrickId): void;
  draw?(ctx: CanvasRenderingContext2D): void;
  /** host.end() とゲームを閉じたとき */
  exit?(): void;
}

/** 飼っているペットを連れないモード（ふれあいひろば）。ペットが 0 匹でも始められる */
export interface Visit extends Omit<Activity, 'enter'> {
  enter(host: SceneHost): void;
}

/** どのモードにも渡す口。座標は盤面の中のピクセルと、layout と同じメートル */
export interface SceneHost {
  readonly save: Save;
  /** think が読む世界。toy と wand はモードが置いても消してもよい */
  readonly view: WorldView;
  readonly fx: PetFx;
  readonly world: PetWorld;
  /** 盤面の幅と高さ（ピクセル） */
  readonly size: readonly [number, number];
  enter(scene: ActivityScene): void;
  /**
   * 3D に出す動物を、飼っているペットからモードが持つ子（save に無い Pet と actor）に替える。
   * 替えたあとは world.pick もこの子たちに当たる。end() で飼っているペットに戻る
   */
  cast(pets: Pet[], actors: Actor[]): void;
  setTool(tool: Tool, toy?: ToyId): void;
  say(text: string, seconds?: number): void;
  /** ペットの頭の上の画面の位置 */
  above(a: Actor, y?: number): [number, number];
  /** コインが飛んでいく先 */
  purse(): [number, number];
  /** BGM を替える。場面に入ると場面の曲に戻り、null で止める */
  music(track: Track | null): void;
  /** save を書き換えたら呼ぶ。少しあとでまとめて保存する */
  changed(): void;
  /** スタンプ帳の回数を数える（おふろ・あいさつ・うんち） */
  count(key: CounterId, n?: number): void;
  /** scene を渡すと部屋ではなくその場面へ出る（おさんぽの道の先の公園）。組み立てを待つので 2 フレームあとに効く */
  end(scene?: BaseScene): void;
}

/** ペットを連れて始めるモード（start）に渡す口 */
export interface ActivityHost extends SceneHost {
  /** モードを始めたときのペット。モードのあいだは切り替えさせない */
  readonly pet: Pet;
  /** そのペットの actor。場面に入るたびに作り直すので、とっておかずに毎回ここから読む */
  readonly actor: Actor | undefined;
  /** ワン・ニャー。cry が無ければそのときの気分で鳴き方を決める */
  voice(cry?: Cry): void;
  /** 公園と同じに、道ばたのプレゼントを開けて中身をもらう */
  found(a: Actor): void;
  /** しつけのボタンでほめたのと同じに、芸を覚えた回数を amount 進める。覚えきったらコインと演出 */
  praise(trick: TrickId, amount: number): void;
}

/** カメラがペットを追う範囲。値の意味は world3d.ts の FOLLOW と同じ */
export interface Follow {
  x: number;
  zMin: number;
  zMax: number;
  near: number;
  rate: number;
  shadow: number;
}

/**
 * モードが持つカメラ。world3d はペットを追わず、毎フレーム camera(dt) が返した構えのとおりに置く。
 * 日の影はその見ている点のまわり shadow m に落とす
 */
export interface HeldCamera {
  camera(dt: number): Layout['camera'];
  shadow: number;
}

export interface Built {
  group: THREE.Group;
  dispose(): void;
  /** 旗や観客のように、場面そのものが動くとき */
  update?(dt: number, t: number): void;
  /** 時刻と天気が変わったとき（組み立てた直後にも 1 度）。空・光・雨は world3d が映すので、場面だけの物（窓の外など）を合わせる */
  daylight?(d: Daylight): void;
}

export interface ActivityScene {
  id: Scene;
  layout: Layout;
  follow: Follow | HeldCamera;
  /** 空と霧と日の強さを公園と同じにする。false なら部屋と同じ */
  outdoor: boolean;
  /** 外の霧がかかりはじめる距離と、空の色に消える距離（m）。無ければ公園と同じ */
  fog?: { near: number; far: number };
  build(sun: THREE.Vector3): Built;
}
