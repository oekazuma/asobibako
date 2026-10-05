# アニマルサバイバー ふたり協力プレイ 作り込み Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 試作の協力プレイに、各自の 3 択と宝箱・起こす・子の端末の演出・一時停止・動物とステージと釜を選ぶ流れ・延長戦・リザルトと記録・もう一度・切れたときの扱いを入れ、ふつうに 1 回を遊び切れるようにする。

**Architecture:** 親の端末だけが World を進める形はそのまま。動物ごとの出来事には持ち主の番号（`hero`）を付け、画面の効果と演出は自分の動物のものだけを見せる。子の 3 択と宝箱は親が作って子へ送り、子の端末の `Prompts`（`remote`）は World を書き換えずに選んだものを親へ送る。終わったときは、親が子の動物のぶんの `RunSummary` を作って送り、子は自分の記録に入れる。

**Tech Stack:** SvelteKit（Svelte 5 runes）、TypeScript、vitest、WebRTC（`src/lib/net`）、playwright-core の headless Chrome

**Spec:** `docs/superpowers/specs/2026-10-05-animal-survivors-coop-design.md`（「作り込みで決めたこと」）

## Global Constraints

- 1 人で遊ぶときは今と同じに動く。今あるテストは書き換えずに通す（協力プレイの今のテストは、形が変わる部分だけ直す）。
- コインとガチャ券は 2 人で共通にし、終わると 2 台ともそれぞれの記録に入れる。賭けは親だけが払い、戻るのも親だけ。
- 宝箱は拾った動物のもの。開けるあいだは 2 人とも止まる。
- 一時停止はどちらが押しても 2 人とも止まり、止めた人の「つづける」で再開する。止めた人の「やめる」でその人だけ抜ける。
- 倒れた動物のそばにもう 1 匹が 3 秒いると、HP 半分で起き上がる。
- 端末の名前（iPad など）で限る言い方はしない。
- コンポーネントは 200 行未満。コメントは非自明な WHY だけ。絵文字は使わない。`pnpm verify` が通ること。

## Review Focus

- 子の 3 択の「選んだ」が届く前に、同じ 3 択がもう一度送られて、2 回選ばれる。Task 3 のテストで固める。
- 子が抜けた・切れたあと、親の World に子の動物の 3 択や宝箱が残って、親のゲームが止まったままになる。Task 7 のテストで固める。
- 延長戦のあとの 2 回めの記録で、子の倒した数や図鑑が 2 重に入る。Task 6 のテストで固める。
- 一時停止のあいだに子の位置の知らせが届き続けて、再開した瞬間に子の動物が飛ぶ。Task 4 のテストで固める。
- 起こしているあいだに起こす側が倒れたら、起こす時計が止まる。Task 2 のテストで固める。

---

### Task 1: 出来事の持ち主・追う相手の向き・子の遅さと吹雪

**Files:**

- Modify: `world.ts`（`createWorld` の `events` を持ち主つきの並びにする。敵の向き）
- Modify: `effects.ts`（`take` で持ち主の違う出来事を読み飛ばす）
- Modify: `prompts.svelte.ts`（`take` で持ち主の違う `grow`・`special` を読み飛ばす）
- Modify: `snap.ts`（動物ごとの `slow` を送る）、`coop.ts`（子の `move` で遅さと吹雪を足す）
- Modify: `draw.ts`（敵の向きを追っている動物へ）
- Test: `coop-events.test.ts`

**Interfaces:**

- Produces: `GameEvent` に `hero?: number`。`createWorld` が作る `w.events` の `push` は、動物が 2 匹以上のとき出来事に `hero: w.cur` を付ける（`events.ts` に `tagged(w)` を作り、`createWorld` で使う）。
- Produces: `ownEvent(w: World, e: GameEvent): boolean`（`hero` が無いか、`w.cur` と同じ）。`Effects.take` は `hurt`・`heal`・`pickup`・`coin`・`revive`・`fire` を、`Prompts.take` は `grow`・`special` を、`ownEvent` でないとき読み飛ばす。

決まりは次のとおり。

- 敵の絵の向き（`draw.ts` で `w.player` と比べているところ）は、`nearestHero(w, e.x, e.y)` の動物と比べる。
- `snap` の動物の列に `slow`（小数 1 けた）を足す。子の `move` は、自分の動物の `slow > 0` で速さに `SLOW` を掛け、`view.storm.left > 0 && view.freeze <= 0` のあいだは `world.ts` の `step` と同じ式で風下へ流す（`fx.wind` は自分の動物のもの）。

- [ ] **Step 1: 失敗するテストを書く**

```ts
it('2 匹のときの出来事には持ち主が付き、1 匹のときは付かない', () => {
  const one = createWorld('dog', 1, VIEW);
  one.events.push({ type: 'levelup' });
  expect(one.events[0]).toEqual({ type: 'levelup' });
  const w = createWorld('dog', 1, VIEW);
  addHero(w, 'cat');
  w.cur = 1;
  w.events.push({ type: 'hurt', dmg: 3 });
  w.cur = 0;
  expect(w.events[0]).toEqual({ type: 'hurt', dmg: 3, hero: 1 });
  expect(ownEvent(w, w.events[0])).toBe(false);
});

it('相棒の被弾では自分の画面の縁を光らせない', () => {
  const w = createWorld('dog', 1, VIEW);
  addHero(w, 'cat');
  const fx = new Effects();
  w.cur = 1;
  w.events.push({ type: 'hurt', dmg: 3 });
  w.cur = 0;
  fx.take(w);
  expect(fx.hurt).toBe(0);
});

it('子の動物は、親から届いた遅さで遅くなる', () => {
  // CoopGuest の move を、slow のある snap を写した view で 1 秒動かし、slow の無いときより進まない
});
```

3 つめは、`coop.test.ts` の `pipes()`・`pair()` を使って書く（`snap` の `slow` を 1 にした様子を親から送り、`move({x:1,y:0}, 1)` の進み方を `slow` 0 と比べる）。

- [ ] **Step 2: 落ちるのを確かめる**（`pnpm vitest run src/lib/games/animal-survivors/coop-events.test.ts`、FAIL）
- [ ] **Step 3: 直す**（上の決まりどおり）
- [ ] **Step 4: 通るのを確かめる**（同じコマンドと `pnpm vitest run src/lib/games/animal-survivors` で PASS）
- [ ] **Step 5: Commit**（`git commit -m "Tag co-op events with their hero and slow the guest like the host does"`）

### Task 2: 宝箱を動物ごとにし、倒れた動物を起こす

**Files:**

- Modify: `heroes.ts`（`HERO_KEYS` に `chests` を足し、`Hero` に `revive: number` を足す）、`world.ts`（`step` の止まる条件と起こす時計、`makeHero`）
- Modify: `draw.ts`（倒れた動物のまわりに起こす残りの輪）
- Test: `coop-world.test.ts` に足す

**Interfaces:**

- Produces: `anyChest(w: World): boolean`（`heroes.ts`）。`step` は `anyPending(w) || anyChest(w)` のあいだ止まる。
- Produces: `REVIVE_SECS = 3`・`REVIVE_REACH = 24`（`heroes.ts`）。倒れた動物の `revive` は、倒れていない動物が `REVIVE_REACH` の中にいるあいだ `dt` ずつ増え、いなければ 0 に戻る。`REVIVE_SECS` に届いたら `down = false`・`hp = maxHp / 2`・`invuln = 2`・`revive = 0`、出来事 `{ type: 'revive' }` を `cur` をその動物にして積む。

- [ ] **Step 1: 失敗するテストを書く**

```ts
it('拾った動物の宝箱になり、どちらかに宝箱が残っていれば止まる', () => {
  const w = two();
  w.items.push({ alive: true, kind: 'chest', x: 200, y: 0, pulled: false });
  step(w, still, 1 / 60);
  expect(w.heroes[1].chests).toBe(1);
  expect(w.heroes[0].chests).toBe(0);
  const t = w.time;
  step(w, still, 1 / 60);
  expect(w.time).toBe(t);
});

it('倒れた動物のそばに 3 秒いると HP 半分で起き上がり、離れると時計が戻る', () => {
  const w = two();
  w.heroes[1].down = true;
  w.heroes[1].player.hp = 0;
  w.heroes[0].player.x = 190;
  for (let i = 0; i < 120; i++) step(w, still, 1 / 60);
  expect(w.heroes[1].down).toBe(true);
  w.heroes[0].player.x = 0;
  step(w, still, 1 / 60);
  expect(w.heroes[1].revive).toBe(0);
  w.heroes[0].player.x = 190;
  for (let i = 0; i < 185; i++) step(w, still, 1 / 60);
  expect(w.heroes[1].down).toBe(false);
  expect(w.heroes[1].player.hp).toBe(Math.round(w.heroes[1].stats.maxHp / 2));
});

it('起こす側が倒れたら、起こす時計は進まない', () => {
  const w = two();
  w.heroes[1].down = true;
  w.heroes[0].player.x = 190;
  w.heroes[0].down = true;
  w.over = null;
  for (let i = 0; i < 200; i++) step(w, still, 1 / 60);
  expect(w.heroes[1].down).toBe(true);
});
```

`two()` の敵が湧かない形（`waves: []`）のまま使う。最後のテストは、2 匹とも倒れた World を `step` が止めずに回すかどうかに頼らないよう、`step` の前に `w.over` を確かめて止まっていれば `revive` が増えていないことを見る形に直してよい。

- [ ] **Step 2〜5:** 落ちるのを確かめ、直し、通し、commit（`"Give each co-op hero their own chests and let partners revive the downed"`）

### Task 3: 子の 3 択と宝箱を子の端末で開ける

**Files:**

- Modify: `prompts.svelte.ts`（`remote` の口）
- Modify: `coop.ts`（親が子の 3 択と宝箱を作って送り、子の選んだものを当てる。子は `Prompts` を `remote` で持つ）
- Modify: `CoopPlay.svelte`（子の端末にも `PromptLayer` を出す）
- Test: `coop.test.ts` に足す

**Interfaces:**

- Produces（`prompts.svelte.ts`）: `new Prompts(w, still?, remote?)`。`remote` は `{ send(m: Message): void }`。`remote` があるとき、`next` は World から 3 択・宝箱・アルカナを開かず（ボスの登場と育つ瞬間だけ進める）、`choose`・`reroll`・`skip`・`banish`・`close` は World を書き換えずに `remote.send` で `{ t: 'choose', i }`・`{ t: 'reroll' }`・`{ t: 'skip' }`・`{ t: 'banish', i }`・`{ t: 'close' }` を送り、画面を閉じる。
- Produces（`Prompts`）: `offer(options: Choice[], tools)`・`openRewards(rewards: Reward[])`（子の端末で、親から届いた 3 択と宝箱を出す）。
- 親 → 子の知らせ: `{ t: 'offer', options, tools }`・`{ t: 'rewards', rewards }`
- 親の `CoopHost.before()` は、子の動物（`heroes[1]`）に宝箱があれば `cur = 1` で `openChest(w)` して `rewards` を送り、無ければ `pending` があれば `cur = 1` で `choices(w)` を送る。送ったあとは子の返事（`choose`・`skip`・`close` など）が届くまで次を送らない（`#asked`）。返事は `cur = 1` で `Prompts` と同じ処理（`apply`・回数を減らす・`banished` に足す・`choices` を引き直して送り直す）を当て、`cur` を 0 に戻す。

- [ ] **Step 1: 失敗するテストを書く**

```ts
it('子の 3 択は子へ送られ、子が選ぶと子の動物に入り、返事の前には送り直さない', async () => {
  const { host, guest, w, h, g } = await started();
  w.heroes[1].pending = 1;
  h.before();
  h.before();
  await settle();
  expect(g.prompts.options).toHaveLength(3);
  expect(sent(guest, 'offer')).toBe(1);
  const before = owned(w.heroes[1]);
  g.prompts.choose(g.prompts.options![0], null);
  await settle();
  h.before();
  expect(w.heroes[1].pending).toBe(0);
  expect(owned(w.heroes[1])).toBeGreaterThan(before);
  expect(w.cur).toBe(0);
});

it('子が拾った宝箱は子の端末で開け、とじるで親のゲームが進む', async () => {
  const { w, h, g } = await started();
  w.heroes[1].chests = 1;
  h.before();
  await settle();
  expect(g.prompts.rewards?.length).toBeGreaterThan(0);
  g.prompts.close(null);
  await settle();
  h.before();
  expect(w.heroes[1].chests).toBe(0);
});

it('remote の Prompts は World の 3 択を自分で開かない', () => {
  const w = createWorld('dog', 1, VIEW);
  w.pending = 1;
  const p = new Prompts(w, true, { send: () => {} });
  p.next(null);
  expect(p.options).toBeNull();
});
```

`started()` は `pair()` のあと `CoopHost`・`CoopGuest` を作って `start` まで進めた組を返す助け関数。`sent(guest, t)` は子へ届いた知らせの数を数える（`guest.onTell` で数える）。`owned` は武器の Lv の合計とパッシブの数。

- [ ] **Step 2〜5:** 落ちるのを確かめ、直し、通し、commit（`"Let the co-op guest pick their own level-ups and open their own chests"`）

### Task 4: どちらからでも止める一時停止

**Files:**

- Modify: `coop.ts`（`pause`・`resume`・`quit` の知らせ）、`CoopPlay.svelte`（「Ⅱ」と `Pause.svelte`、相手が止めたときの帯）
- Test: `coop.test.ts` に足す

**Interfaces:**

- Produces: `CoopHost.paused: 'host' | 'guest' | null`・`CoopGuest.paused: 'host' | 'guest' | null`・`pause()`・`resume()`（どちらの class にも）。親は `paused` のあいだ `step` を回さず（`CoopPlay` が見る）、子の位置の並び（`Timeline`）を `resume` で空にする（再開の瞬間に止まっていたあいだの位置へ飛ばないように）。
- 知らせ: `{ t: 'pause', by }`・`{ t: 'resume' }`（子 → 親は `act`、親 → 子は `tell`）
- `CoopPlay` の「Ⅱ」は `paused` が無いときだけ出し、押すと自分の `pause()`。止めたのが自分なら `Pause.svelte` を出し、相手なら「なかまが とめています」の帯を出す。`Pause` の「つづける」は `resume()`、「やめる」は Task 7 の抜け方を呼ぶ。「最初からやり直す」は協力プレイでは出さない（`Pause.svelte` に `restart?: boolean` を足して隠す）。

- [ ] **Step 1: 失敗するテストを書く**

```ts
it('子が止めると親も止まり、子のつづけるで再開し、止まっていたあいだの位置は捨てる', async () => {
  const { w, h, g } = await started();
  g.pause();
  await settle();
  expect(h.paused).toBe('guest');
  g.move({ x: 1, y: 0 }, 2);
  await settle();
  g.resume();
  await settle();
  expect(h.paused).toBeNull();
  const x = w.heroes[1].player.x;
  h.before();
  expect(w.heroes[1].player.x).toBe(x);
});

it('親が止めると子の画面にも知らせが届く', async () => {
  const { h, g } = await started();
  h.pause();
  await settle();
  expect(g.paused).toBe('host');
});
```

- [ ] **Step 2〜5:** 落ちるのを確かめ、直し、通し、commit（`"Pause co-op play from either device"`）

### Task 5: つながったあとに動物・ステージ・釜を選ぶ

**Files:**

- Create: `CoopPick.svelte`（つながったあとに出す、自分の仲間の動物のタイルと「この子で遊ぶ」）
- Modify: `CoopRoom.svelte`（つなぐ → 2 人が動物を選ぶ → 親がステージと釜を選ぶ → 始める）
- Modify: `coop.ts`（`CoopHost` は World を `start(w)` で受け取る。子の動物は `pick` の知らせで受ける）
- Test: `coop.test.ts`・`coop-room.svelte.test.ts` を直して足す

**Interfaces:**

- 子 → 親: `{ t: 'pick', animal, ranks, gear }`（`hi` は版だけにする）。親 → 子: `{ t: 'picked' }`（子の画面を「おやが えらんでいます」にする）
- `CoopHost`
  - `constructor(party: Party)`（World は持たない）
  - `guest: Me | null`（子が選んだ動物。選ぶまで null）
  - `start(w: World, seed: number, stage: string): void`（子の動物を `addHero` で足し、`start` を送る）
- `CoopRoom` は、親で子の `pick` が届き、自分も動物を選んだら、`StageSelect.svelte` と `Cauldron.svelte`（今の画面をそのまま）を出し、釜の「はじめる」で `payHeat` を払ってから `createWorld(...)` と `host.start(...)` を呼ぶ。アルカナは今の `createWorld` の `arcana` で始めに親が選ぶ（`Prompts` が出す）。

- [ ] **Step 1: 失敗するテストを書く**（`coop.test.ts` の始め方を新しい形に直し、`pick` が届くまで `guest` が null・届いたら動物が入ることを足す。`coop-room.svelte.test.ts` は、つながったあとの画面の代わりに `CoopPick` を出して、仲間でない子は選べないことを足す）
- [ ] **Step 2〜5:** 落ちるのを確かめ、直し、通し、commit（`"Choose animals, stage and heat after connecting for co-op"`）

### Task 6: 終わったとき・延長戦・リザルトと記録・もう一度

**Files:**

- Modify: `coop.ts`（`record`・`keep` の知らせ）
- Modify: `CoopPlay.svelte`（終わりの画面をリザルトにする。親は延長戦を聞く）
- Create: `coop-run.ts`（2 匹の World から、動物ごとの `RunSummary` を作る。`Survivors.svelte` の `over` と同じ並びで延長戦の 2 回めの差も扱う）
- Test: `coop-run.test.ts`

**Interfaces:**

- Produces（`coop-run.ts`）: `heroRun(w: World, i: number, first: RunSummary | null): RunSummary`（`cur = i` で `w.overtime ? overtimeRun(w) : summary(w)` を作り、`cur` を戻す。`i` が 0 でなければ `heat.bet` を 0 にする）。
- 親 → 子: `{ t: 'record', run }`（親が記録するたびに、子の動物のぶんを送る）、`{ t: 'keep', run }`（10 秒ごと。子が切れたときに使う）
- 子は `record` が届いたら `record(loadRecords(), run)` で記録して保存し、リザルト（`Result.svelte`）を出す。「もう一度」は子では押せず「おやを まっています」を出し、親が「もう一度」を押して `start` が届いたら新しい回に入る。
- 親はクリアしたら今の `Prompts.ask` で延長戦を聞き、子の画面には「おやが えらんでいます」を出す。

- [ ] **Step 1: 失敗するテストを書く**

```ts
it('子のぶんのまとめは子の動物の武器と、2 人で共通のコイン・倒した数で、賭けは入らない', () => {
  const w = createWorld('dog', 1, VIEW, {}, 'forest', { heat: { level: 4, bet: 120 } });
  addHero(w, 'cat');
  w.heroes[1].weapons.push({ id: 'howl', level: 3, cd: 0 });
  w.coins = 50;
  w.kills = 300;
  w.over = 'dead';
  const run = heroRun(w, 1, null);
  expect(run.animal).toBe('cat');
  expect(run.weapons.map((o) => o.id)).toContain('howl');
  expect([run.coins, run.kills]).toEqual([summary(w).coins, 300]);
  expect(run.heat.bet).toBe(0);
  expect(w.cur).toBe(0);
});

it('延長戦の 2 回めの記録で、子の倒した数と図鑑を 2 重に入れない', () => {
  // クリアで heroRun → record、startOvertime、倒した数を増やしてから heroRun(w, 1, first) → record。
  // 記録の kills が 1 回ぶんの合計と同じになる
});
```

2 つめは、`overtime.test.ts` の延長戦の記録のテストの組み立てをまねて書く。

- [ ] **Step 2〜5:** 落ちるのを確かめ、直し、通し、commit（`"Record each co-op hero's run and show the result on both devices"`）

### Task 7: 抜けたとき・切れたとき

**Files:**

- Modify: `coop.ts`、`CoopPlay.svelte`
- Test: `coop.test.ts` に足す

**Interfaces:**

- 子が「やめる」か切れたら（親の `Party` の `leave`）、親は子の動物を `gone`（`Hero` に足す。`down` と同じく動かず撃たず描かない）にし、子の 3 択と宝箱を 0 にして、1 人で続ける。子のやめるでは、抜ける前に親が `record` を送ってから閉じる（子の `quit()` → 親が `record` を返す → 子が記録してから閉じる）。
- 親が「やめる」か切れたら、子は最後の `keep` を記録して「つながりが きれました」とリザルトを出す（子の `Party.lost` を見る）。

- [ ] **Step 1: 失敗するテストを書く**

```ts
it('子が切れると、子の動物の 3 択と宝箱を消して、親は止まらずに続ける', async () => {
  const { w, h, guestPipe } = await started();
  w.heroes[1].pending = 2;
  w.heroes[1].chests = 1;
  guestPipe.close();
  await settle();
  h.before();
  expect(w.heroes[1].gone).toBe(true);
  const t = w.time;
  step(w, { x: 0, y: 0 }, 1 / 60);
  expect(w.time).toBeGreaterThan(t);
});

it('親が切れたら、子は最後に届いたまとめを記録する', async () => {
  // keep を 1 回送ってから親の管を閉じ、子の記録の best がそのまとめの time になる
});
```

- [ ] **Step 2〜5:** 落ちるのを確かめ、直し、通し、commit（`"Handle co-op leaving and disconnects on both sides"`）

### Task 8: 2 ページで 1 回を通して確かめる

**Files:**

- 変更: scratchpad の `coop-play.mjs`（動物を選ぶ・ステージと釜・子の 3 択と宝箱を自動で選ぶ・一時停止・クリアか全滅・リザルトまで）
- Modify: `CLAUDE.md`

- [ ] **Step 1:** 2 ページでつなぎ、動物・ステージ・釜を選んで始め、子と親の 3 択と宝箱を自動で選びながら 3 分遊ばせる。途中で子から一時停止して再開する。
- [ ] **Step 2:** 子の画面で、3 択・宝箱・ボスの WARNING と登場が出ること、相棒が倒れたら起こせることを撮って確かめる。
- [ ] **Step 3:** 親の「やめる」で終え、両方のページにリザルトが出て、両方の記録にコインと倒した数が入ったことを localStorage で確かめる。
- [ ] **Step 4:** CLAUDE.md の協力プレイの段落を今の作りに書き直し（試作の言い方をやめる）、`pnpm verify` を通して commit する。
