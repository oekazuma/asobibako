/** ルール・行動・3D・画面が共有する名前。値は持たない */

export type Kind = 'dog' | 'cat';

export type BreedId = 'shiba' | 'beagle' | 'poodle' | 'mike' | 'kuro' | 'saba';

/** ペットの 1 つのかっこう。3D モデルはこの名前でポーズを取り、切り替わりはモデル側でなめらかにつなぐ */
export type PetAction =
  | 'stand'
  | 'walk'
  | 'run'
  | 'sit'
  | 'down'
  | 'sleep'
  | 'eat'
  | 'paw'
  | 'roll'
  | 'jump'
  | 'pounce'
  | 'happy'
  | 'shake'
  | 'beg'
  | 'spin'
  | 'dead'
  | 'high'
  | 'bow'
  | 'belly'
  | 'bliss'
  | 'scratch'
  | 'swat'
  | 'flick'
  | 'arch';

export type Stat = 'food' | 'water' | 'clean' | 'energy';

export type TrickId = 'sit' | 'down' | 'paw' | 'roll' | 'jump' | 'beg' | 'spin' | 'dead' | 'high' | 'bow';

/** 食べもの（使うと減る） */
export type FoodId = 'dogfood' | 'catfood' | 'treat';
/** おもちゃ（1 度買えばずっと使える） */
export type ToyId = 'ball' | 'frisbee' | 'wand' | 'mouse';
/** 身につけるもの。1 匹 1 つまで */
export type AccessoryId = 'collar-red' | 'collar-blue' | 'ribbon' | 'hat' | 'bandana';

/** いつもの場面。部屋と公園の置き場所は layout.ts の LAYOUTS に持つ */
export type BaseScene = 'room' | 'park';
/** 遊びのモード（activity.ts）が持つ場面も含めた名前。モードの場面の置き場所と組み立てはモードが渡す */
export type Scene = BaseScene | 'contest' | 'plaza' | 'bath' | 'street';

export type ContestId = 'frisbee' | 'wand' | 'agility' | 'obedience';
