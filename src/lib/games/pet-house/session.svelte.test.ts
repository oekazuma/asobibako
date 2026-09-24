import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Activity, ActivityHost, SceneHost, Visit } from './activity';
import { createActor, type Actor, type WorldView } from './behavior';
import type { Pet } from './engine';

const seen: { view?: WorldView; actors?: Actor[] } = {};

vi.mock('./world3d', () => ({
  PetWorld: class {
    setScene() {}
    syncPets() {}
    update(actors: Actor[], view: WorldView) {
      seen.actors = actors;
      seen.view = view;
    }
    render() {}
    resize() {}
    pick() {
      return null;
    }
    // 画面の下の中ほどが front、上へ行くほど奥
    floor(px: number, py: number) {
      return { x: (px - 200) / 150, z: (py - 700) / 150 };
    }
    project() {
      return [0, 0, 100];
    }
    snapshot() {
      return 'data:image/jpeg;base64,xx';
    }
    setBrush() {}
    dispose() {}
  }
}));
vi.mock('./sounds', () => ({ sounds: new Proxy({}, { get: () => () => {} }) }));

const { Session } = await import('./session.svelte');
type S = InstanceType<typeof Session>;

function make(): S {
  const s = new Session(document.createElement('canvas'), document.createElement('canvas'));
  s.resize(400, 800);
  s.save.money = 10000;
  return s;
}

function frames(s: S, sec: number, until?: () => boolean): boolean {
  for (let t = 0; t < sec; t += 1 / 30) {
    s.frame(1 / 30);
    if (until?.()) return true;
  }
  return false;
}

beforeEach(() => localStorage.clear());

describe('Session', () => {
  it('公園で咥えている子から切り替えると、おもちゃを落として次の子が拾える', () => {
    const s = make();
    s.adopt('shiba', 'ポチ');
    s.adopt('beagle', 'ハチ');
    const [first, second] = s.save.pets;
    s.select(first.id);
    s.goPark();
    s.setTool('toy', 'ball');
    frames(s, 1);
    s.down(1, 200, 700);
    s.up(1, 200, 600, 0, -1500);
    expect(frames(s, 20, () => seen.view?.toy?.holder === first.id)).toBe(true);
    s.select(second.id);
    expect(seen.view?.toy?.holder).toBeNull();
    expect(frames(s, 30, () => seen.view?.toy?.holder === second.id)).toBe(true);
  });

  it('いまのペットが食べないごはんが残っていたら入れ替え、手つかずなら在庫へ戻す', () => {
    const s = make();
    s.adopt('shiba', 'ポチ');
    s.adopt('mike', 'タマ');
    const [dog, cat] = s.save.pets;
    s.select(dog.id);
    s.feed('dogfood');
    const dogfood = s.save.food.dogfood;
    // 犬が食べるものが残っているうちは入れ直さない
    s.feed('dogfood');
    expect(s.toast).toBe('まだ ごはんが のこってるよ');
    s.select(cat.id);
    const catfood = s.save.food.catfood;
    s.feed('catfood');
    expect(s.save.food.catfood).toBe(catfood - 1);
    expect(s.save.food.dogfood).toBe(dogfood + 1);
  });

  it('入れたばかりのごはんは、やめるときに在庫へ戻す', () => {
    const s = make();
    s.adopt('shiba', 'ポチ');
    const before = s.save.food.dogfood;
    s.feed('dogfood');
    s.dispose();
    expect(JSON.parse(localStorage.getItem('asobibako:pet-house')!).food.dogfood).toBe(before);
  });

  it('遊びのモードが動かすあいだは think と指と芸をモードへ渡し、end で部屋と道具を戻す', () => {
    const s = make();
    s.adopt('shiba', 'ポチ');
    s.setTool('brush');
    const got: string[] = [];
    let host: ActivityHost | undefined;
    const act: Activity = {
      drives: true,
      enter(h) {
        host = h;
        h.setTool('toy', 'frisbee');
      },
      frame() {
        const a = host?.actor;
        if (a) a.x = 5;
      },
      down: () => (got.push('down'), true),
      trick: (t) => void got.push(t)
    };
    s.start(act);
    frames(s, 0.5);
    // think が動いていれば、部屋の外（x = 5）に置いたペットは範囲の中へ戻される
    expect(seen.actors?.[0].x).toBe(5);
    s.down(1, 200, 700);
    s.trick('sit');
    expect(got).toEqual(['down', 'sit']);
    host?.end();
    expect(s.activity).toBeNull();
    expect(s.scene).toBe('room');
    expect(s.tool).toBe('brush');
  });

  it('ペットを連れないモードは 0 匹でも始まり、cast した子を飼っているペットの代わりに描く', () => {
    const s = make();
    const [dog] = s.save.pets;
    expect(dog).toBeUndefined();
    const guest = createActor({ id: 'guest', breed: 'mike' } as Pet, { x: 0, z: 0 });
    let host: SceneHost | undefined;
    const visit: Visit = {
      drives: true,
      enter(h) {
        host = h;
        h.cast([], [guest]);
      },
      frame() {}
    };
    s.visit(visit);
    expect(s.activity).toBe(visit);
    frames(s, 0.2);
    expect(seen.actors).toEqual([guest]);
    host?.end();
    s.adopt('shiba', 'ポチ');
    frames(s, 0.2);
    expect(s.scene).toBe('room');
    expect(seen.actors?.map((a) => a.petId)).toEqual([s.save.current]);
  });
});
