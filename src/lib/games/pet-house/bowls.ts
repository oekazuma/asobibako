import { eats, type WorldView } from './behavior';
import type { Core } from './core';
import { itemName, kindOf, type Pet } from './engine';
import { sounds } from './sounds';
import type { FoodId } from './types';

const eatsFood = (pet: Pet, food: FoodId) => eats(kindOf(pet.breed) === 'dog', food);

/** 部屋のお皿。ごはんと水を入れる。公園へ行っても残しておく */
export class Bowls {
  readonly state: WorldView['bowls'] = { food: null, foodLeft: 0, waterLeft: 0 };
  readonly #c: Core;

  constructor(core: Core) {
    this.#c = core;
  }

  feed(food: FoodId) {
    const c = this.#c;
    const save = c.s.save;
    const pet = c.s.current;
    if (c.s.scene !== 'room') return c.say('ごはんは おうちで あげようね');
    if (save.food[food] <= 0) return c.say(`${itemName(food)}が もう ないよ。おみせで かおう`);
    const bowl = this.state;
    if (bowl.foodLeft > 0.3) {
      // 犬と猫がいると、片方の食べものが残ったままもう片方が食べられなくなる。いまのペットが食べないものなら入れ替える
      if (!pet || !bowl.food || eatsFood(pet, bowl.food)) return c.say('まだ ごはんが のこってるよ');
      if (bowl.foodLeft > 0.9) save.food[bowl.food] += 1;
    }
    save.food[food] -= 1;
    bowl.food = food;
    bowl.foodLeft = 1;
    c.changed();
    sounds.pop();
    if (pet && !eatsFood(pet, food)) return c.say(`${pet.name}は ${itemName(food)}を たべないみたい`);
    if (pet && !c.actor()?.asleep) c.voice(pet, 'happy');
  }

  water() {
    if (this.#c.s.scene !== 'room') return this.#c.say('おみずは おうちで あげようね');
    this.state.waterLeft = 1;
    sounds.pop();
  }

  /** お皿は保存しないので、入れたばかりで手つかずのごはんは在庫へ戻す */
  putBack() {
    const bowl = this.state;
    if (bowl.food && bowl.foodLeft > 0.9) this.#c.s.save.food[bowl.food] += 1;
  }
}
