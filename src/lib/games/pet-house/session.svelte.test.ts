import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Activity, ActivityHost, ActivityScene, SceneHost, Visit } from './activity';
import { PARK } from './layout';
import { createActor, throwToy, type Actor, type WorldView } from './behavior';
import type { Pet } from './engine';
import { STAMPS } from './stamps';

const seen: {
  view?: WorldView;
  actors?: Actor[];
  pets?: Pet[];
  log: string[];
  renders: number;
  precompiles: number;
} = {
  log: [],
  renders: 0,
  precompiles: 0
};

// frame() を同期のループで回すテストが多いので、既定は then() をその場で呼ぶ「即決の thenable」にする
// （本物の Promise だとマイクロタスクが挟まり、同期ループの中では解決しない）
const settled = {
  then: (onFulfilled?: (v: unknown) => unknown) => onFulfilled?.(undefined)
} as unknown as PromiseLike<unknown>;
let compiled: PromiseLike<unknown> = settled;
// 組み立てが済んでいない子の数。世界3d の pending を差し替えて、Session が覆いを外す・precompile を呼ぶ条件を試す
let pending = 0;

vi.mock('./world3d', () => ({
  PetWorld: class {
    get pending() {
      return pending;
    }
    setScene() {
      seen.log.push('scene');
    }
    syncPets(pets: Pet[]) {
      seen.pets = pets;
    }
    update(actors: Actor[], view: WorldView) {
      seen.actors = actors;
      seen.view = view;
    }
    render() {
      seen.renders++;
    }
    precompile() {
      seen.precompiles++;
      return compiled;
    }
    resize() {}
    pick() {
      return null;
    }
    pickPart() {
      return null;
    }
    // 画面の下の中ほどが front、上へ行くほど奥
    floor(px: number, py: number) {
      return { x: (px - 200) / 150, z: (py - 700) / 150 };
    }
    // 画面のいちばん上はソファ
    furniture(px: number, py: number) {
      return py < 100 ? { id: 'sofa', x: 0.3, z: -1.9 } : null;
    }
    project() {
      return [0, 0, 100];
    }
    snapshot() {
      return 'data:image/jpeg;base64,xx';
    }
    setBrush() {}
    setDaylight() {}
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

beforeEach(() => {
  localStorage.clear();
  compiled = settled;
  pending = 0;
});

describe('Session', () => {
  it('のんびりしているときは描く回数を減らし、指で触っているあいだは毎秒 60 回描く', () => {
    const s = make();
    s.adopt('shiba', 'ポチ');
    const count = (sec: number) => {
      seen.renders = 0;
      for (let t = 0; t < sec; t += 1 / 60) s.frame(1 / 60);
      return seen.renders;
    };
    count(3);
    expect(count(2)).toBeLessThan(70);
    s.down(1, 200, 700);
    expect(count(2)).toBeGreaterThan(110);
    s.up(1, 200, 700, 0, 0);
    s.covered = true;
    count(3);
    expect(count(2)).toBeLessThan(40);
  });

  it('試着は見た目だけ着せて save は変えず、買うと着たまま、ペットを替えると外れる', () => {
    const s = make();
    s.adopt('shiba', 'ポチ');
    s.adopt('mike', 'タマ');
    const [dog, cat] = s.save.pets;
    s.select(dog.id);
    const shown = () => seen.pets?.find((p) => p.id === s.save.current)?.accessory;
    s.tryOn('ribbon');
    frames(s, 0.1);
    expect(shown()).toBe('ribbon');
    expect(dog.accessory).toBeNull();
    expect(s.save.accessories).toEqual([]);
    s.select(cat.id);
    frames(s, 0.1);
    expect(s.trying).toBeNull();
    expect(seen.pets?.every((p) => p.accessory === null)).toBe(true);
    s.tryOn('hat');
    s.tryOn(null);
    frames(s, 0.1);
    expect(shown()).toBeNull();
    s.tryOn('bandana');
    expect(s.buy('bandana')).toBe('ok');
    frames(s, 0.1);
    expect(s.trying).toBeNull();
    expect(cat.accessory).toBe('bandana');
    expect(shown()).toBe('bandana');
    // 持っているものは試着しない（着せ替えで着る）
    s.tryOn('bandana');
    expect(s.trying).toBeNull();
  });

  it('公園で咥えている子から切り替えても、その子がそのまま持ってくる', () => {
    const s = make();
    s.adopt('shiba', 'ポチ');
    s.adopt('beagle', 'ハチ');
    s.goPark();
    s.setTool('toy', 'ball');
    frames(s, 1);
    s.down(1, 200, 700);
    s.up(1, 200, 600, 0, -1500);
    // 2 匹とも追うので、先にくわえた子から、もう 1 匹へ切り替える
    expect(frames(s, 20, () => !!seen.view?.toy?.holder)).toBe(true);
    const holder = seen.view!.toy!.holder!;
    s.select(s.save.pets.find((p) => p.id !== holder)!.id);
    expect(seen.view?.toy?.holder).toBe(holder);
    const carrier = () => seen.actors!.find((a) => a.petId === holder)!;
    expect(frames(s, 40, () => carrier().mode === 'offer' || !s.away)).toBe(true);
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
    s.start(act, 'テストへ いくよ');
    frames(s, 0.5);
    // think が動いていれば、部屋の外（x = 5）に置いたペットは範囲の中へ戻される
    expect(seen.actors?.[0].x).toBe(5);
    s.down(1, 200, 700);
    s.trick('sit');
    expect(got).toEqual(['down', 'sit']);
    host?.end();
    frames(s, 0.2);
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
    s.visit(visit, 'テストへ いくよ');
    frames(s, 0.1);
    expect(s.activity).toBe(visit);
    frames(s, 0.2);
    expect(seen.actors).toEqual([guest]);
    host?.end();
    s.adopt('shiba', 'ポチ');
    frames(s, 0.2);
    // ひろばから戻る途中にむかえた子は、部屋の奥から歩いてくる
    expect(seen.actors?.[0].z).toBeLessThan(0);
    expect(s.scene).toBe('room');
    expect(seen.actors?.map((a) => a.petId)).toEqual([s.save.current]);
  });

  it('prepare が片づくまで「いどうちゅう」を出したまま待ち、片づくと enter する', async () => {
    const s = make();
    let resolvePrepare: () => void = () => {};
    const ready = new Promise<void>((r) => (resolvePrepare = r));
    let entered = false;
    const visit: Visit = {
      drives: true,
      prepare: () => ready,
      enter: () => void (entered = true),
      frame() {}
    };
    s.visit(visit, 'じゅんびちゅう');
    frames(s, 0.5);
    expect(entered).toBe(false);
    expect(s.moving).toBe('じゅんびちゅう');
    resolvePrepare();
    await ready;
    frames(s, 0.2);
    expect(entered).toBe(true);
    frames(s, 0.2);
    expect(s.moving).toBeNull();
  });

  it('prepare がいつまでも片づかなくても、1.5 秒待てば enter する', () => {
    vi.useFakeTimers();
    try {
      const s = make();
      let entered = false;
      const visit: Visit = {
        drives: true,
        prepare: () => new Promise(() => {}),
        enter: () => void (entered = true),
        frame() {}
      };
      s.visit(visit, 'じゅんびちゅう');
      frames(s, 0.5);
      expect(entered).toBe(false);
      vi.advanceTimersByTime(1500);
      frames(s, 0.2);
      expect(entered).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('シェーダーの準備が片づくまでは描かず、片づくと描いて busy が false になる', async () => {
    let resolveCompile: () => void = () => {};
    compiled = new Promise<void>((r) => (resolveCompile = r));
    const s = make();
    seen.renders = 0;
    frames(s, 0.1);
    expect(seen.renders).toBe(0);
    expect(s.busy).toBe(true);
    resolveCompile();
    await compiled;
    frames(s, 0.1);
    expect(seen.renders).toBeGreaterThan(0);
    expect(s.busy).toBe(false);
  });

  it('シェーダーの準備がいつまでも片づかなくても、1.5 秒待てば描く', () => {
    vi.useFakeTimers();
    try {
      compiled = new Promise(() => {});
      const s = make();
      seen.renders = 0;
      frames(s, 0.1);
      expect(seen.renders).toBe(0);
      vi.advanceTimersByTime(1500);
      frames(s, 0.1);
      expect(seen.renders).toBeGreaterThan(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('組み立てが済んでいないペットが残っているあいだは覆いを外さず busy のまま、そろうと外れる', () => {
    const s = make();
    s.adopt('shiba', 'ポチ');
    pending = 2;
    s.goPark();
    frames(s, 0.5);
    expect(s.scene).toBe('park');
    expect(s.moving).not.toBeNull();
    expect(s.busy).toBe(true);
    pending = 0;
    frames(s, 0.3);
    expect(s.moving).toBeNull();
    expect(s.busy).toBe(false);
  });

  it('組み立てが済んでいないあいだは precompile を呼ばず、そろってから呼ぶ', () => {
    const s = make();
    s.adopt('shiba', 'ポチ');
    seen.precompiles = 0;
    pending = 2;
    s.goPark();
    frames(s, 0.5);
    expect(seen.precompiles).toBe(0);
    pending = 0;
    frames(s, 0.2);
    expect(seen.precompiles).toBeGreaterThan(0);
  });

  it('prepare が失敗しても enter し、unhandledrejection にはならない', async () => {
    const onUnhandled = vi.fn();
    process.on('unhandledRejection', onUnhandled);
    try {
      const s = make();
      let entered = false;
      const visit: Visit = {
        drives: true,
        prepare: () => Promise.reject(new Error('x')),
        enter: () => void (entered = true),
        frame() {}
      };
      s.visit(visit, 'じゅんびちゅう');
      frames(s, 0.5);
      // reject が誰にも拾われないままだと unhandledrejection が次のタスクで上がるので、そこまで進める
      await new Promise((r) => setTimeout(r, 0));
      frames(s, 0.2);
      expect(entered).toBe(true);
      expect(onUnhandled).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });

  it('場面を変えるときは「いどうちゅう」を 1 度描かせてから組み立て、落ち着いたら外す。重ねた操作は捨てる', () => {
    const s = make();
    s.adopt('shiba', 'ポチ');
    seen.log = [];
    s.goPark();
    s.goPark();
    expect(s.moving).toBe('こうえんへ いくよ');
    s.frame(1 / 30);
    expect(seen.log).toEqual([]);
    s.frame(1 / 30);
    expect(seen.log).toEqual(['scene']);
    expect(s.scene).toBe('park');
    expect(s.moving).not.toBeNull();
    frames(s, 0.2);
    expect(s.moving).toBeNull();
    expect(seen.log).toEqual(['scene']);
  });

  it('モードを終えるときは、場面を片付ける前にモードの exit を呼ぶ（道の NPC の犬が共有の材質ごと捨てられないように）', () => {
    const s = make();
    s.adopt('shiba', 'ポチ');
    let host: ActivityHost | undefined;
    const act: Activity = {
      drives: true,
      enter: (h) => void (host = h),
      frame() {},
      exit: () => void seen.log.push('exit')
    };
    s.start(act, 'テストへ いくよ');
    frames(s, 0.2);
    seen.log = [];
    host?.end();
    frames(s, 0.2);
    expect(seen.log).toEqual(['exit', 'scene']);
  });

  it('天気の一言は 1 日 1 回だけ。同じ日にまた開いても言わない', () => {
    const clock = globalThis as { __asobibakoClock?: { hour?: number; weather?: string } };
    clock.__asobibakoClock = { hour: 13, weather: 'rain' };
    try {
      const first = make();
      expect(first.toast).toBe('きょうは あめだね');
      first.dispose();
      const again = make();
      expect(again.toast).toBe('');
      again.dispose();
    } finally {
      delete clock.__asobibakoClock;
    }
  });

  it('公園には飼っている子がみんな来て、いまの子を選び直しても並べ直さない。おさんぽの道はいまの子だけ', () => {
    const s = make();
    s.adopt('shiba', 'ポチ');
    s.adopt('mike', 'ミケ');
    s.adopt('poodle', 'モコ');
    const ids = s.save.pets.map((p) => p.id);
    s.select(ids[1]);
    s.goPark();
    frames(s, 0.5);
    expect(s.scene).toBe('park');
    expect(s.toast).toContain('みんなで');
    expect(seen.actors?.map((a) => a.petId).sort()).toEqual([...ids].sort());
    // いまの子が front、ほかの子は奥で待っている
    const me = seen.actors!.find((a) => a.petId === ids[1])!;
    expect(seen.actors!.every((a) => a === me || a.z < me.z)).toBe(true);
    const before = seen.actors;
    s.select(ids[2]);
    frames(s, 0.1);
    expect(seen.actors).toBe(before);

    s.goHome();
    frames(s, 0.5);
    expect(s.scene).toBe('room');
    expect(seen.actors).toHaveLength(3);

    let host: ActivityHost | undefined;
    const street: Activity = {
      drives: true,
      enter(h) {
        host = h;
        h.enter({ id: 'street', layout: { ...PARK }, build: () => ({}) } as unknown as ActivityScene);
      },
      frame() {}
    };
    s.start(street, 'おさんぽに いくよ');
    frames(s, 0.2);
    expect(seen.actors?.map((a) => a.petId)).toEqual([ids[2]]);
    host?.end('park');
    frames(s, 0.5);
    expect(s.scene).toBe('park');
    expect(seen.actors).toHaveLength(3);
    expect(s.toast).toContain('みんなも きてるよ');
  });

  it('寝ている子とはおさんぽを始めない', () => {
    const s = make();
    s.adopt('shiba', 'ポチ');
    s.save.pets[0].stats.energy = 5;
    // ソファで寝るとスタンプの一言が「ねているよ」を上書きするので、押し終えたことにしておく
    s.save.stamps = STAMPS.map((t) => t.id);
    expect(frames(s, 30, () => s.asleep)).toBe(true);
    const act: Activity = { drives: true, awakeOnly: true, enter() {}, frame() {} };
    s.start(act, 'おさんぽに いくよ');
    frames(s, 0.2);
    expect(s.activity).toBeNull();
    expect(s.moving).toBeNull();
    expect(s.toast).toContain('ねているよ');
  });

  it('投げたボールは持ってくるまで次を投げられず、持ってきたら手元に戻る', () => {
    const s = make();
    s.adopt('shiba', 'ポチ');
    s.goPark();
    s.setTool('toy', 'ball');
    frames(s, 1);
    const flick = () => {
      s.down(1, 200, 700);
      s.up(1, 200, 600, 0, -1500);
    };
    flick();
    frames(s, 0.1);
    const first = seen.view?.toy;
    expect(first).toBeTruthy();
    expect(s.away).toBe(true);
    flick();
    expect(seen.view?.toy).toBe(first);
    expect(s.toast).toContain('まってね');
    expect(frames(s, 30, () => !s.away)).toBe(true);
    flick();
    frames(s, 0.1);
    expect(seen.view?.toy).not.toBe(first);
  });

  it('床に残ったおもちゃはタップして拾える', () => {
    const s = make();
    s.adopt('shiba', 'ポチ');
    s.goPark();
    frames(s, 1);
    const view = seen.view!;
    view.toy = throwToy('ball', { x: 2, y: 0.05, z: -4 }, { x: 0, y: 0, z: 0 });
    s.frame(1 / 30);
    expect(s.away).toBe(true);
    // 台本の project はどの点も (0, 0) に写す
    s.down(1, 0, 0);
    expect(view.toy).toBeNull();
    expect(s.away).toBe(false);
  });

  it('犬が持ってきておすわりしてくわえているおもちゃは、タップすると受け取れる', () => {
    const s = make();
    s.adopt('shiba', 'ポチ');
    s.goPark();
    s.setTool('toy', 'ball');
    frames(s, 1);
    s.down(1, 200, 700);
    s.up(1, 200, 600, 0, -1500);
    const me = () => seen.actors?.find((a) => a.petId === s.save.current);
    expect(frames(s, 40, () => me()?.mode === 'offer')).toBe(true);
    expect(s.away).toBe(true);
    s.down(2, 0, 0);
    expect(seen.view?.toy).toBeNull();
    expect(s.away).toBe(false);
    frames(s, 0.2);
    expect(me()?.carrying).toBeNull();
  });

  it('止まったまま 20 秒だれも構わないおもちゃは、ひとりでに手元へ戻る', () => {
    const s = make();
    s.adopt('mike', 'タマ');
    s.goPark();
    frames(s, 1);
    const view = seen.view!;
    view.toy = throwToy('ball', { x: 2, y: 0.05, z: -4 }, { x: 0, y: 0, z: 0 });
    frames(s, 15);
    expect(view.toy).not.toBeNull();
    expect(frames(s, 10, () => !view.toy)).toBe(true);
    expect(s.toast).toBe('ボールが もどってきたよ');
    expect(s.away).toBe(false);
  });

  it('ソファをタップすると「〇〇、ソファに おいで」で呼んで、飛び乗らせる', () => {
    const s = make();
    s.adopt('mike', 'タマ');
    frames(s, 1);
    s.down(1, 200, 50);
    s.up(1, 200, 50, 0, 0);
    expect(s.toast).toBe('タマ、ソファに おいで');
    const me = () => seen.actors?.find((a) => a.petId === s.save.current);
    expect(frames(s, 20, () => me()?.perch === 'sofa')).toBe(true);
    expect(me()?.y).toBeGreaterThan(0.4);
  });

  it('開いた直後に満たしていたスタンプは 1 回にまとめ、そのあと満たしたものは 1 つずつ押す', () => {
    const pet = (id: string, breed: string, accessory: string | null) => ({
      id,
      breed,
      name: id,
      stats: {},
      love: 3.2,
      tricks: {},
      accessory
    });
    localStorage.setItem(
      'asobibako:pet-house',
      JSON.stringify({
        pets: [pet('a', 'shiba', 'ribbon'), pet('b', 'mike', null)],
        current: 'a',
        money: 0,
        accessories: ['ribbon']
      })
    );
    const s = new Session(document.createElement('canvas'), document.createElement('canvas'));
    s.resize(400, 800);
    const got = [...s.save.stamps];
    expect(got).toEqual(expect.arrayContaining(['heart1', 'heart3', 'pets2', 'both', 'dress']));
    const toasts = new Set<string>();
    const run = (sec: number) => {
      for (let t = 0; t < sec; t += 0.1) {
        s.frame(0.1);
        if (s.toast) toasts.add(s.toast);
      }
    };
    run(12);
    const batch = [...toasts].filter((t) => t.startsWith('これまでの がんばりで'));
    expect(batch).toEqual([`これまでの がんばりで スタンプが ${got.length}こ もらえたよ！ +${s.save.money}コイン`]);
    expect([...toasts].some((t) => t.startsWith('スタンプ ゲット'))).toBe(false);

    s.photo();
    run(6);
    expect(s.save.stamps).toContain('photo1');
    expect([...toasts].filter((t) => t.startsWith('スタンプ ゲット'))).toEqual(['スタンプ ゲット！']);
    localStorage.clear();
  });
});
