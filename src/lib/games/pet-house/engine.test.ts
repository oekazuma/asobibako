// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addPhoto,
  adopt,
  bathe,
  buy,
  catchUp,
  eat,
  findPresent,
  FLOOR,
  hearts,
  loadSave,
  newSave,
  play,
  praise,
  SLEEPY,
  STORAGE_KEY,
  stroke,
  tick,
  trickChance,
  trickSteps,
  tricksFor,
  TRICKS,
  wash,
  writePhotos,
  writeSave,
  type Pet
} from './engine';

const HOUR = 3600 * 1000;
// 保存の読み込みは未来の seen を今に丸めるので、基準は過去に置く
const NOW = Date.now() - 1000 * HOUR;

function withPet() {
  const save = newSave(NOW);
  const pet = adopt(save, 'shiba', 'ハチ') as Pet;
  return { save, pet };
}

describe('pet-house engine', () => {
  beforeEach(() => localStorage.clear());

  it('閉じていたあいだの減りは下限で止まり、げんきは戻り、おこづかいは 1 日 1 回', () => {
    const { save, pet } = withPet();
    pet.stats = { food: 80, water: 10, clean: 90, energy: 30 };
    const later = NOW + 72 * HOUR;
    expect(catchUp(save, later).allowance).toBeGreaterThan(0);
    expect(pet.stats).toEqual({ food: FLOOR, water: 10, clean: FLOOR, energy: 100 });
    expect(save.seen).toBe(later);
    expect(catchUp(save, later).allowance).toBe(0);
  });

  it('遊んでいるあいだはおなかが 6 時間ほどで空き、減らしたぶん seen が進む', () => {
    const { save, pet } = withPet();
    pet.stats.food = 100;
    for (let i = 0; i < 5.5 * 60; i++) tick(save, 60);
    expect(pet.stats.food).toBeGreaterThan(0);
    expect(pet.stats.food).toBeLessThan(15);
    expect(save.seen).toBe(NOW + 5.5 * HOUR);
    // 開いていたぶんを catchUp がもう一度減らさない
    const food = pet.stats.food;
    catchUp(save, save.seen);
    expect(pet.stats.food).toBe(food);
  });

  it('保存を往復でき、壊れた値は補い、読めない JSON は null', () => {
    const { save } = withPet();
    save.money = 123;
    writeSave(save);
    expect(loadSave()).toEqual(save);

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ pets: [{ id: 'a', breed: 'kuro', stats: { food: 'x' } }, { breed: 'dragon' }], money: -5 })
    );
    const fixed = loadSave()!;
    expect(fixed.pets).toHaveLength(1);
    expect(fixed.pets[0].stats).toEqual({ food: 80, water: 80, clean: 80, energy: 80 });
    expect(fixed.current).toBe('a');
    expect(fixed.money).toBe(0);
    expect(fixed.food).toEqual(newSave(NOW).food);
    expect(fixed.toys).toEqual(['ball', 'wand']);

    localStorage.setItem(STORAGE_KEY, '{oops');
    expect(loadSave()).toBeNull();
  });

  it('リズムあそびのハイスコアは芸ごとに戻り、壊れた値は捨てる', () => {
    const { save, pet } = withPet();
    pet.best = { sit: 3120, roll: 900 };
    writeSave(save);
    expect(loadSave()?.pets[0].best).toEqual({ sit: 3120, roll: 900 });
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ pets: [{ id: 'a', breed: 'shiba', best: { sit: 'x', roll: -4, jump: 1e9, fly: 5 } }] })
    );
    expect(loadSave()?.pets[0].best).toEqual({ roll: 0, jump: 99999 });
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ pets: [{ id: 'a', breed: 'shiba', best: [1, 2] }] }));
    expect(loadSave()?.pets[0].best).toBeUndefined();
  });

  it('コンテストの階級は保存から戻り、古い保存や壊れた値は 0..5 の整数にそろえる', () => {
    const { save } = withPet();
    save.contest.frisbee = 2;
    save.contest.obedience = 5;
    writeSave(save);
    expect(loadSave()?.contest).toEqual({ frisbee: 2, wand: 0, agility: 0, obedience: 5 });

    localStorage.setItem(STORAGE_KEY, JSON.stringify({ pets: [] }));
    expect(loadSave()?.contest).toEqual({ frisbee: 0, wand: 0, agility: 0, obedience: 0 });
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ contest: { frisbee: 9, wand: -1, agility: '3', obedience: 2.7, dragon: 4 } })
    );
    expect(loadSave()?.contest).toEqual({ frisbee: 5, wand: 0, agility: 0, obedience: 2 });
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ contest: [1, 2] }));
    expect(loadSave()?.contest).toEqual({ frisbee: 0, wand: 0, agility: 0, obedience: 0 });
  });

  it('写真は別のキーに置き、容量があふれたら古い写真から減らして、手もとの枚数もそろえる', () => {
    const { save } = withPet();
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        if (v.length > 12000) throw new DOMException('full', 'QuotaExceededError');
        store.set(k, v);
      },
      removeItem: (k: string) => store.delete(k)
    });
    for (let i = 1; i <= 3; i++) {
      addPhoto(save, 'data:image/jpeg;base64,' + String(i).repeat(5000));
      writePhotos(save);
    }
    writeSave(save);
    expect(store.get(STORAGE_KEY)).not.toContain('base64');
    expect(save.photos).toHaveLength(2);
    const back = loadSave()!;
    expect(back.pets).toEqual(save.pets);
    // 新しい 2 枚が残る
    expect(back.photos).toEqual(save.photos);
    expect(back.photos[0]).toContain('333');
    vi.unstubAllGlobals();
  });

  it('1 匹目はただで、2 匹目からお金がいり、3 匹まで', () => {
    const save = newSave(NOW);
    expect(adopt(save, 'mike', 'タマ')).toMatchObject({ breed: 'mike' });
    expect(adopt(save, 'beagle', 'スヌ')).toBe('money');
    save.money = 10000;
    adopt(save, 'beagle', 'スヌ');
    const third = adopt(save, 'poodle', 'モコ') as Pet;
    expect(save.current).toBe(third.id);
    expect(adopt(save, 'saba', 'トラ')).toBe('full');
    expect(new Set(save.pets.map((p) => p.id)).size).toBe(3);
  });

  it('おみせ: お金が足りなければ買えず、おもちゃとアクセサリーは 1 度だけ', () => {
    const save = newSave(NOW);
    expect(buy(save, 'ball')).toBe('owned');
    expect(buy(save, 'treat')).toBe('ok');
    expect(save.food.treat).toBe(8);
    expect(buy(save, 'hat')).toBe('money');
    save.money = 2000;
    expect(buy(save, 'hat')).toBe('ok');
    expect(buy(save, 'hat')).toBe('owned');
  });

  it('げんき満タンから投げっこ 15〜20 回で眠くなる', () => {
    const { pet } = withPet();
    let throws = 0;
    while (pet.stats.energy >= SLEEPY) {
      play(pet);
      throws++;
    }
    expect(throws).toBeGreaterThanOrEqual(15);
    expect(throws).toBeLessThanOrEqual(20);
  });

  it('なでるたびに少しずつ増え、最初のハートは 40 秒ほど、次からはゆっくり', () => {
    const { pet } = withPet();
    stroke(pet, 20);
    expect(hearts(pet)).toBe(0);
    expect(pet.love).toBeGreaterThan(0);
    stroke(pet, 20);
    expect(hearts(pet)).toBe(1);
    stroke(pet, 100);
    expect(hearts(pet)).toBe(1);
    stroke(pet, 25);
    expect(hearts(pet)).toBe(2);
  });

  it('自分の種類のごはんがいちばんおなかにたまる', () => {
    const { pet } = withPet();
    pet.stats.food = 10;
    eat(pet, 'dogfood');
    const own = pet.stats.food;
    pet.stats.food = 10;
    eat(pet, 'catfood');
    expect(own).toBeGreaterThan(pet.stats.food);
  });

  it('芸は成功してほめるたびに成功しやすくなり、覚えきった瞬間だけ learned', () => {
    const { pet } = withPet();
    for (const trick of TRICKS) {
      expect(trick.steps).toBeGreaterThanOrEqual(4);
      expect(trick.steps).toBeLessThanOrEqual(6);
      const before = trickChance(pet, trick.id);
      const results = Array.from({ length: trick.steps + 1 }, () => praise(pet, trick.id).learned);
      expect(results).toEqual([...Array(trick.steps - 1).fill(false), true, false]);
      expect(trickChance(pet, trick.id)).toBeGreaterThan(before);
    }
  });

  it('猫は覚えられる芸が犬より少なく、新しい芸は犬より多くほめないと覚えない', () => {
    const save = newSave(0);
    const cat = adopt(save, 'mike', 'タマ') as Pet;
    const cats = tricksFor('cat');
    expect(cats.length).toBeLessThan(tricksFor('dog').length);
    expect(trickChance(cat, 'dead')).toBe(0);
    for (const t of cats) expect(trickChance(cat, t.id)).toBeGreaterThan(0);
    const spin = TRICKS.find((t) => t.id === 'spin')!;
    expect(trickSteps(spin, 'cat')).toBeGreaterThan(trickSteps(spin, 'dog'));
    const results = Array.from({ length: trickSteps(spin, 'cat') }, () => praise(cat, 'spin').learned);
    expect(results.at(-1)).toBe(true);
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it('体で教えたあとにほめると 2 回ぶん進み、覚える回数を超えない', () => {
    const { pet } = withPet();
    const sit = TRICKS.find((t) => t.id === 'sit')!;
    const results = Array.from({ length: Math.ceil(sit.steps / 2) }, () => praise(pet, 'sit', 2).learned);
    expect(results.at(-1)).toBe(true);
    expect(pet.tricks.sit).toBe(sit.steps);
    expect(praise(pet, 'sit', 2).learned).toBe(false);
  });

  it('おふろはシャワーで流すほど汚れが落ち、最後まで入るとぴかぴかでなかよしが少し増える', () => {
    const { pet } = withPet();
    pet.stats.clean = 10;
    wash(pet, 0.5);
    expect(pet.stats.clean).toBe(50);
    wash(pet, 0.2);
    expect(pet.stats.clean).toBe(50);
    const love = pet.love;
    bathe(pet);
    expect(pet.stats.clean).toBe(100);
    expect(pet.love).toBeGreaterThan(love);
    expect(pet.love).toBeLessThan(love + 0.3);
  });

  it('プレゼントはごはん・おやつが中心で、コインは少し、まれにおみせの品がただで出る', () => {
    const seq =
      (...xs: number[]) =>
      () =>
        xs.shift() ?? 0;
    const { save } = withPet();
    const money = save.money;
    expect(findPresent(save, seq(0.9, 0, 0.9, 0.9))).toEqual({ food: 'dogfood', count: 3 });
    expect(findPresent(save, seq(0.9, 0, 0.1, 0))).toEqual({ food: 'treat', count: 2 });
    expect(save.food).toMatchObject({ dogfood: 8, treat: 5 });
    expect(findPresent(save, seq(0.1, 0))).toEqual({ money: 30 });
    expect(save.money).toBe(money + 30);
    // 犬だけなら猫のおもちゃは出ない。持っていないものから選ぶ
    expect(findPresent(save, seq(0, 0))).toMatchObject({ item: { id: 'frisbee' } });
    expect(save.toys).toContain('frisbee');
    for (let i = 0; i < 10; i++) findPresent(save, seq(0, 0));
    expect(save.accessories).toHaveLength(5);
    expect(save.toys).not.toContain('mouse');
    expect(findPresent(save, seq(0, 0))).toEqual({ money: 150 });
  });
});
