# Plan 083: わんにゃんハウスの小さな直し 5 つ（夜のコンテストで眠る・おこづかい・来た日・お皿のごはん・写真の回数）

> **Executor instructions**: この計画を上から順に実行する。各ステップの確認コマンドを実行し、期待どおりの結果を
> 確かめてから次へ進む。「STOP 条件」のどれかに当たったら止めて報告する。終わったら `plans/README.md` の
> 自分の行の Status を更新する（レビュー担当に「索引は触らない」と言われたときは触らない）。
>
> **Drift check（最初に実行）**
> `git diff --stat 982455c..HEAD -- src/lib/games/pet-house/contest-play.svelte.ts src/lib/games/pet-house/session.svelte.ts src/lib/games/pet-house/session.svelte.test.ts src/lib/games/pet-house/engine.ts src/lib/games/pet-house/engine.test.ts src/lib/games/pet-house/bowls.ts`
> 何か出たら「Current state」の抜粋と今のコードを見比べ、食い違えば STOP。

## Status

| 項目       | 値                                                                  |
| ---------- | ------------------------------------------------------------------- |
| Priority   | P2                                                                  |
| Effort     | S                                                                   |
| Risk       | LOW（5 つとも 1〜数行の直しで、互いに関わらない。1 つずつコミット） |
| Depends on | none                                                                |
| Category   | bug                                                                 |
| Planned at | commit `982455c`, 2026-10-14                                        |

## Why this matters

わんにゃんハウス（`pet-house`、子犬・子猫と触れ合う 3D の自由あそび）の開発はいったん終えている。見つかった小さな不具合を
5 つ、それぞれ落ちるテストを先に書いてから最小の直しで直す。挙動を広げる直しはしない。

1. 夕方と夜にフリスビー大会・ねこじゃらし大会へ出ると、始まってすぐペットが眠ってしまい、大会のあいだ起きない。出るときに
   げんきを 20 使うので、出たあとのげんきが夜の眠気の線（`SLEEPY + 15 × night`）より下になることがあるため
2. おこづかい（1 日 500 コイン）は「前に払った日と今日の日付が違えば」払う。端末の時計を前の日へ戻しても払うので、時計を
   行き来させるたびにもらえる
3. 札の「うちに きて N にちめ」は、来た日（`since`）が今日より先だと 0 や負になる（時計を戻したときなど）
4. お皿に入れたばかりのごはんは在庫から 1 つ引いてある。やめるとき（`dispose`）は在庫へ戻すが、iOS が隠れたページを終わらせると
   `dispose` は呼ばれず、お皿は保存しないので、ごはんが 1 つ消える
5. 写真を撮ると、保存できなかったときも「撮った回数」（スタンプ帳の条件）が増える

## Current state

直すのはすべて `src/lib/games/pet-house/` の中。

- `contest-play.svelte.ts` — コンテストの進行（`ContestPlay`）
- `engine.ts` — ステータス・おこづかい・保存（DOM も three も使わない）
- `bowls.ts` — 部屋のお皿（`Bowls`）
- `session.svelte.ts` — 画面と 3D と行動をつなぐ `Session`
- `engine.test.ts`（node の unit project）と `session.svelte.test.ts`（happy-dom の dom project）— テストを足す

### 1. 夜のコンテストで眠る

出るのに要るげんきと、出ると減るげんきは `contest.ts:67-69` にある。コメントは「出たあとも眠くならない」と言っているが、
夜の線を数えていない。

```ts
/** 出るのにいるげんきと、出ると減るげんき。出たあとも眠くならない（SLEEPY より上に残る）ように決めてある */
export const ENTRY_COST = 20;
export const ENTRY_ENERGY = SLEEPY + ENTRY_COST + 5;
```

`SLEEPY` は 25（`engine.ts:412`）なので、ちょうど `ENTRY_ENERGY`（50）で出ると、出たあとは 30。

「はじめる」でげんきを引くのは `contest-play.svelte.ts:131-140` の `begin()`。

```ts
  begin(): void {
    if (this.phase !== 'intro') return;
    const pet = this.#host.pet;
    pet.stats.energy = Math.max(0, pet.stats.energy - ENTRY_COST);
```

フリスビーとねこじゃらしは、遊んでいるあいだ `drives` が false になる（`contest-play.svelte.ts:88-90`）。

```ts
  get drives(): boolean {
    return this.phase !== 'play' || this.id === 'agility' || this.id === 'obedience';
  }
```

`drives` が false だと、Session はふだんの頭 `think()` を回す（`session.svelte.ts:411-417`）。

```ts
    const act = this.activity;
    if (!act?.drives) {
      this.#view.current = this.save.current;
      this.#wand.step(dt);
      this.#rubbing.tick(dt);
      for (const e of think(this.#actors, pets, this.#view, dt, Math.random))
```

`think()` の中の `needs()` は、げんきが夜の線より低く `awake` が 0 なら眠る。会場は部屋ではないので、その場で `fallAsleep` する
（`behavior.ts:721-727`）。

```ts
if (s.energy < SLEEPY + 15 * (world.night ?? 0) && a.awake <= 0) {
  if (snuggle(a, c)) return true;
  const bed = room && nest(a, c);
  if (bed) goPerch(a, c, bed, 'sleep');
  else if (room) go(a, 'bed', clearNear(a, c, room.bed));
  else fallAsleep(a, c);
  return true;
}
```

`world.night` は夜が 1、夕方（18.5 時）が 0.6 なので、線は夜 40、夕方 34 で、30 は下になる。会場のペットは場面に入るときに
新しく作られ、`awake: 0`（`behavior.ts:295`）で始まる。`awake` は `think()` が毎コマ `dt` ずつ減らす（`behavior.ts:1785`）。
起きるのはげんきが `RESTED`（90、`behavior.ts:227`）に戻ったときで、寝ているあいだは 1 秒に 1.3（`engine.ts:102` の `REST_RATE`）
しか戻らない。30 から 90 まで約 46 秒で、大会（フリスビー 45 秒、ねこじゃらし 40 秒）より長い。
大会のあいだの `caught`・`fetched` はコンテストが受けて `play()` を呼ばない（`contest-play.svelte.ts:305-321`）ので、
大会中のげんきの減りは `tick()` のぶん（1 時間に 10）だけ。

遊びはじめは `#start()`（`contest-play.svelte.ts:173-197`）で、末尾でペットを止まった状態から動かしている。

```ts
    // ふだんの頭（think）に戻る種目は、止まったところから動きはじめる
    const a = host.actor;
    if (a) [a.mode, a.t, a.v] = ['idle', 0.5, 0];
  }
```

`#start()` は `frame()` の `count` の中から呼ばれ、同じコマのあとで `think()` が先に `awake` を 1 コマぶん減らす。
そのあと `#play` は毎コマ `clock` を減らし、`think()` は毎コマ `awake` を減らすので、`awake` を `this.contest.seconds` ちょうどに
すると、最後のコマで `awake` が先に 0 になる。少し長くする。

### 2. おこづかい

今のコードは `engine.ts:294-311` の `catchUp` にある。

```ts
  save.seen = now;
  const today = day(now);
  if (save.allowanceDay === today) return { allowance: 0 };
  save.allowanceDay = today;
  save.money += ALLOWANCE;
  count(save, 'days');
  return { allowance: ALLOWANCE };
}
```

`day()`（`engine.ts:125-128`）は `YYYY-MM-DD` の形の端末の日付で、文字列の大小が日付の前後と同じになる。`newSave` は
`allowanceDay: day(now)` で始め（`engine.ts:144-145`、初日は払わない）、`loadSave` は文字列でなければ今日にする（`engine.ts:227`）。

直し方は、前に払った日が今日と同じか先なら払わず、`allowanceDay` を今日に下ろす形にする。

```ts
if (save.allowanceDay >= today) {
  // 時計を戻して払わない。先の日付は今日へ下ろし、時計が直れば翌日から払う
  save.allowanceDay = today;
  return { allowance: 0 };
}
```

`today <= allowanceDay` で返すだけにすると、1 度でも時計を先に進めて開いた端末は、その日付が来るまでおこづかいが出なくなる。
今日へ下ろすと、時計を行き来させても 1 往復で 1 回までしか増えず、先の日付や読めない文字列も 1 日で直る。

### 3. 来た日

今のコードは `engine.ts:130-133` にある。

```ts
/** うちに来た日を 1 にちめとした、今日までの日数 */
export function daysTogether(pet: Pet, now: number): number {
  return Math.round((Date.parse(day(now)) - Date.parse(pet.since)) / 86_400_000) + 1;
}
```

表示は `PetCard.svelte:25` の 1 か所だけ。読み込みでは `repairPet` が形だけ確かめている（`engine.ts:191`）。

```ts
    since: typeof raw.since === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.since) ? raw.since : today,
```

`daysTogether` を 1 より小さくしないだけにする。`repairPet` で先の日付を今日へ下ろすと、時計が直ったときに来た日が
ずれたままになるので、`repairPet` は変えない。

### 4. お皿のごはん

今のコードは `bowls.ts:45-49` にある。

```ts
  /** お皿は保存しないので、入れたばかりで手つかずのごはんは在庫へ戻す */
  putBack() {
    const bowl = this.state;
    if (bowl.food && bowl.foodLeft > 0.9) this.#c.s.save.food[bowl.food] += 1;
  }
```

呼ぶのは `dispose()` だけ（`session.svelte.ts:821-828`）。

```ts
  dispose(): void {
    this.activity?.exit?.();
    this.#bowls.putBack();
    this.#write(false);
```

画面が隠れたときは書くだけ（`session.svelte.ts:243-244`）で、在庫へ戻さない。

```ts
  #onVisibility = () => {
    if (document.visibilityState === 'hidden') return this.#write(false);
```

書く本体は `session.svelte.ts:358-368` の `#write`。

```ts
  #write(stamp = true) {
    if (stamp) this.#stamps.add(...check(this.save));
    if (!writeSave($state.snapshot(this.save)) && !this.#full) {
```

ごはんを入れると在庫から 1 つ引く（`bowls.ts:30`、`save.food[food] -= 1`）。食べものを入れ替えるときは、手つかずの前の食べものを
その場で在庫へ戻している（`bowls.ts:28`）。

直し方は、書くたびに `$state.snapshot` で取った写しのほうへ手つかずのぶんを戻して書き、生きている `save` は変えない形にする。
`putBack` は写しの `food` を受け取る形にし、`dispose` の `this.#bowls.putBack()` は消す（`#write` がいつも戻すので要らない）。
生きている在庫は変わらないので、画面が戻っても数え直しは起きない。食べかけ（`foodLeft` が 0.9 以下）のお皿は今と同じく戻さない。

### 5. 写真の回数

今のコードは `session.svelte.ts:777-793` にある。

```ts
  photo(): void {
    addPhoto(this.save, this.#world.snapshot());
    this.#count('photo');
    if (!writePhotos(this.save)) {
      // 保存できず save.photos は元に戻っているので、撮れた体で見せる成功のトーストは出さない
      if (!this.#full) {
        this.#full = true;
        remember('わんにゃんハウスの記録を保存できませんでした（容量）');
      }
      this.#say('しゃしんが いっぱいで のこせないよ');
      return;
    }
    this.#fx.flash();
```

`writePhotos`（`engine.ts:278-291`）は 1 枚も書けなければ写真を保存済みに戻して `false` を返す。`#count('photo')` を
失敗の分かれ道のあとへ移す。

### テストの道具

- `engine.test.ts` の `withPet()`（`engine.test.ts:41-45`）は `NOW`（1000 時間前）で作った save とペットを返す。`HOUR` はミリ秒。
  localStorage を壊すお手本は「容量が足りず 1 枚も書けなければ…」（`engine.test.ts:183-203`）の `vi.stubGlobal('localStorage', …)`
- `session.svelte.test.ts` の `make()` は Session を作って `money` を 10000 にし、`frames(s, sec, until?)` は 1/30 秒ずつ進めて
  `until` が true になったら true を返す。`./world3d` と `./sounds` は偽物
- 時刻の差し替えは `globalThis.__asobibakoClock = { hour, weather }`（`daytime.ts:259-265`）。お手本は
  「天気の一言は 1 日 1 回だけ。…」（`session.svelte.test.ts:424-437`）。Session は作るときに時刻を読むので、`make()` より前に置く
- お皿のお手本は「入れたばかりのごはんは、やめるときに在庫へ戻す」（`session.svelte.test.ts:190-197`）

### 規約

コメントはコードから復元できない WHY だけを日本語で書く。変更履歴やチケット番号は書かない。テストの名前は日本語の文にする。
`.svelte` のファイルは触らない。

## Commands you will need

| Purpose          | Command                                                               | Expected on success           |
| ---------------- | --------------------------------------------------------------------- | ----------------------------- |
| engine のテスト  | `pnpm exec vitest run src/lib/games/pet-house/engine.test.ts`         | すべて pass                   |
| Session のテスト | `pnpm exec vitest run src/lib/games/pet-house/session.svelte.test.ts` | すべて pass                   |
| ゲーム全体       | `pnpm exec vitest run src/lib/games/pet-house/`                       | すべて pass                   |
| 型               | `pnpm check`                                                          | `0 ERRORS 0 WARNINGS`、exit 0 |
| 全部             | `pnpm verify`                                                         | exit 0                        |

## Scope

**In scope**

- `src/lib/games/pet-house/contest-play.svelte.ts`（`#start()` の 1 行とコメント）
- `src/lib/games/pet-house/engine.ts`（`catchUp` と `daysTogether`）
- `src/lib/games/pet-house/bowls.ts`（`putBack`）
- `src/lib/games/pet-house/session.svelte.ts`（`#write`・`dispose`・`photo`）
- `src/lib/games/pet-house/engine.test.ts` と `src/lib/games/pet-house/session.svelte.test.ts`（テストを足す）
- `plans/README.md`（自分の行の Status だけ）

**Out of scope**

- `contest.ts` の `ENTRY_COST`・`ENTRY_ENERGY` — 出られる線を上げると、昼に出られた子が出られなくなる
- `behavior.ts` の眠り方（`needs`・`fallAsleep`・`RESTED`）— 部屋の眠り方まで変わる
- `repairPet` と `loadSave` — 保存の読み方は変えない
- お皿を保存に入れること — 保存の形が変わり、古い保存の読み込みとバックアップに響く
- 公園のプレゼント（`session.svelte.ts:274`）— Maintenance notes の開いた問いを見る
- `src/lib/games/pet-house/CLAUDE.md` — 書いてある仕様は変わらない

## Git workflow

- ブランチは `advisor/083-pet-house-small-fixes`
- 直し 1 つにつき 1 コミット（テストと直しを同じコミットに入れる）。メッセージは英語の命令形 1 文で、`Co-Authored-By` などの
  trailer は付けない。例は `Keep a contest pet awake through a night contest`、`Stop paying allowance when the clock goes back`、
  `Never show fewer than one day together`、`Put untouched bowl food back into saved stock on every write`、
  `Count a photo only after it is saved`
- push しない（`main` への push は本番に自動デプロイされる）

## Steps

### Step 1: 夜のコンテストでも眠らない（コミット 1）

`session.svelte.test.ts` の import に `ContestPlay` と `ENTRY_ENERGY` を足す。`ContestPlay` はコンテストの音
（`./contest-sounds`）を読むので、`vi.mock('./sounds', …)` の行の下に同じ形の偽物を足す。

```ts
vi.mock('./contest-sounds', () => ({ contestSounds: new Proxy({}, { get: () => () => {} }) }));
```

`const { Session } = await import('./session.svelte');` の下に、同じ形で `ContestPlay` を読む行を足す（`vi.mock` より後に読むため）。

```ts
const { ContestPlay } = await import('./contest-play.svelte');
```

`ENTRY_ENERGY` はふつうの import でよい（`import { ENTRY_ENERGY } from './contest';`）。

「天気の一言は 1 日 1 回だけ。…」のテストの直後に、次のテストを足す。

```ts
it('夜にフリスビー大会へ出た子は、出たあとのげんきが夜の眠気の線より低くても、大会のあいだ眠らない', () => {
  const clock = globalThis as { __asobibakoClock?: { hour?: number; weather?: string } };
  clock.__asobibakoClock = { hour: 22, weather: 'sunny' };
  try {
    const s = make();
    s.adopt('shiba', 'ポチ');
    expect(s.sky.phase).toBe('night');
    s.save.pets[0].stats.energy = ENTRY_ENERGY;
    const play = new ContestPlay('frisbee', 0);
    s.start(play, 'コンテストの かいじょうへ いくよ');
    frames(s, 0.5);
    expect(s.activity).toBe(play);
    play.begin();
    expect(frames(s, 4, () => play.phase === 'play')).toBe(true);
    expect(seen.view?.night).toBeGreaterThan(0.9);
    expect(frames(s, play.contest.seconds - 1, () => s.asleep)).toBe(false);
  } finally {
    delete clock.__asobibakoClock;
  }
});
```

**Verify**: `pnpm exec vitest run src/lib/games/pet-house/session.svelte.test.ts -t '夜にフリスビー大会'` → 足したテストが
最後の `expect(...).toBe(false)` で FAIL する（true が返る）。手前の `expect` で落ちたり、import で落ちたりしたら STOP
（`./scene-contest` が three の読み込みで落ちるときだけは、`vi.mock('./scene-contest', () => ({ buildContest: () => null }))` を足して
よい。`world3d` の偽物は `build` を呼ばないので会場は作られない）。

次に `contest-play.svelte.ts` の `#start()` の末尾を次の形にする。

```ts
    // ふだんの頭（think）に戻る種目は、止まったところから動きはじめる。出たあとのげんきは夜の眠気の線より低いことが
    // あるので、終わるまで眠らせない。このコマのうちに think が先に 1 コマぶん減らすので、時計より少し長くする
    const a = host.actor;
    if (a) [a.mode, a.t, a.v, a.awake] = ['idle', 0.5, 0, this.contest.seconds + 1];
  }
```

アジリティ（`seconds: 60`）としつけ（`seconds: 0`）は遊んでいるあいだ `drives` が true で `think()` を回さないので、`awake` は
効かない。

**Verify**: `pnpm exec vitest run src/lib/games/pet-house/session.svelte.test.ts` → すべて pass。
そのあと `git commit`（コミット 1）。

### Step 2: 時計を戻してもおこづかいを払わない（コミット 2）

`engine.test.ts` の「daysTogether は来た日に 1、3 日後に 4」のテストの直後に、次の 2 つを足す。

```ts
it('時計を前の日へ戻しても、おこづかいは出ない', () => {
  const { save } = withPet();
  const later = NOW + 48 * HOUR;
  expect(catchUp(save, later).allowance).toBeGreaterThan(0);
  const money = save.money;
  expect(catchUp(save, NOW + 24 * HOUR).allowance).toBe(0);
  expect(save.money).toBe(money);
});

it('払った日が先の日付になっていても、今日は払わず、次の日からは払う', () => {
  const { save } = withPet();
  save.allowanceDay = '2999-01-01';
  const at = NOW + 24 * HOUR;
  expect(catchUp(save, at).allowance).toBe(0);
  expect(save.allowanceDay).toBe(day(at));
  expect(catchUp(save, at + 24 * HOUR).allowance).toBeGreaterThan(0);
});
```

`day` はこのファイルですでに import されている（`engine.test.ts:11`）。

**Verify**: `pnpm exec vitest run src/lib/games/pet-house/engine.test.ts -t 'おこづかい'` → 足した 2 つが FAIL する
（1 つめは戻した日に払う、2 つめは今日に払う）。もとからある「閉じていたあいだの減りは下限で止まり、…おこづかいは 1 日 1 回」は pass。

`engine.ts` の `catchUp` の `if (save.allowanceDay === today) return { allowance: 0 };` を、Current state の 2 に書いた形
（`>=` で比べて今日へ下ろす 4 行とコメント）に置き換える。

**Verify**: `pnpm exec vitest run src/lib/games/pet-house/engine.test.ts` → すべて pass。そのあと `git commit`（コミット 2）。

### Step 3: うちに来た日数を 1 より小さくしない（コミット 3）

`engine.test.ts` に次のテストを足す。

```ts
it('来た日が今日より先になっていても、daysTogether は 1 にちめ', () => {
  const { pet } = withPet();
  const now = Date.now();
  pet.since = day(now + 3 * 24 * HOUR);
  expect(daysTogether(pet, now)).toBe(1);
});
```

**Verify**: `pnpm exec vitest run src/lib/games/pet-house/engine.test.ts -t 'daysTogether'` → 足したテストが FAIL する（-2 になる）。

`daysTogether` の本体を `Math.max(1, …)` で包む。

```ts
export function daysTogether(pet: Pet, now: number): number {
  return Math.max(1, Math.round((Date.parse(day(now)) - Date.parse(pet.since)) / 86_400_000) + 1);
}
```

**Verify**: `pnpm exec vitest run src/lib/games/pet-house/engine.test.ts` → すべて pass。そのあと `git commit`（コミット 3）。

### Step 4: 手つかずのごはんは、書くたびに在庫へ戻した形で書く（コミット 4）

`session.svelte.test.ts` の「入れたばかりのごはんは、やめるときに在庫へ戻す」の直後に、次のテストを足す。

```ts
it('入れたばかりのごはんは、ふだんの保存でも在庫へ戻した形で書き、遊んでいるあいだの在庫とやめるときの保存は変えない', () => {
  const s = make();
  s.adopt('shiba', 'ポチ');
  const before = s.save.food.dogfood;
  s.feed('dogfood');
  frames(s, 2);
  const saved = () => JSON.parse(localStorage.getItem('asobibako:pet-house')!).food.dogfood;
  expect(saved()).toBe(before);
  expect(s.save.food.dogfood).toBe(before - 1);
  s.dispose();
  expect(saved()).toBe(before);
});
```

`frames(s, 2)` のあいだに、入れて `dirty` になってから 1 秒たった書き込み（`session.svelte.ts:434`）が走る。
画面が隠れたときの書き込みも同じ `#write` を通るので、隠れる場合のテストは要らない。

**Verify**: `pnpm exec vitest run src/lib/games/pet-house/session.svelte.test.ts -t 'ふだんの保存でも'` → 足したテストが
`expect(saved()).toBe(before)` の 1 つめで FAIL する（`before - 1` が書かれている）。

直しは 2 か所。`bowls.ts` の `putBack` を、渡した在庫へ戻す形にする（`./engine` の import に `type Save` を足す）。

```ts
  /** お皿は保存しないので、書く写しの在庫へ、入れたばかりで手つかずのごはんを戻す */
  putBack(food: Save['food']) {
    const bowl = this.state;
    if (bowl.food && bowl.foodLeft > 0.9) food[bowl.food] += 1;
  }
```

`session.svelte.ts` の `#write` で写しを 1 度取り、そちらへ戻してから書く。

```ts
  #write(stamp = true) {
    if (stamp) this.#stamps.add(...check(this.save));
    // iOS は隠れたページを dispose なしで終わらせるので、いつ書いても、お皿のごはんが在庫から消えたままにならない形で書く
    const snap = $state.snapshot(this.save);
    this.#bowls.putBack(snap.food);
    if (!writeSave(snap) && !this.#full) {
```

`dispose()` の `this.#bowls.putBack();` の行を消す（`#write(false)` が同じことをする）。`putBack` を呼ぶのはこの 1 か所になる。

**Verify**: `grep -n "putBack" src/lib/games/pet-house/*.ts` → `bowls.ts` の定義と `session.svelte.ts` の `#write` の中の 2 行だけ。
`pnpm exec vitest run src/lib/games/pet-house/session.svelte.test.ts` → すべて pass（もとからある「いまのペットが食べないごはんが…
手つかずなら在庫へ戻す」と「入れたばかりのごはんは、やめるときに在庫へ戻す」を含む）。`pnpm check` → `0 ERRORS 0 WARNINGS`。
そのあと `git commit`（コミット 4）。

### Step 5: 写真は保存できたときだけ数える（コミット 5）

`session.svelte.test.ts` に次のテストを足す（`describe('Session', …)` の中の最後）。

```ts
it('写真が保存できなかったときは、撮った回数を数えない', () => {
  const s = make();
  s.adopt('shiba', 'ポチ');
  s.photo();
  expect(s.save.counters.photo).toBe(1);
  const real = localStorage;
  vi.stubGlobal('localStorage', {
    getItem: real.getItem.bind(real),
    removeItem: real.removeItem.bind(real),
    setItem: (key: string, value: string) => {
      if (key === 'asobibako:pet-house:photos') throw new DOMException('full', 'QuotaExceededError');
      real.setItem(key, value);
    }
  });
  try {
    s.photo();
  } finally {
    vi.unstubAllGlobals();
  }
  expect(s.save.counters.photo).toBe(1);
  expect(s.toast).toBe('しゃしんが いっぱいで のこせないよ');
});
```

**Verify**: `pnpm exec vitest run src/lib/games/pet-house/session.svelte.test.ts -t '撮った回数'` → 足したテストが
2 つめの `toBe(1)` で FAIL する（2 になる）。1 つめの `toBe(1)` で落ちたら STOP（写真の保存の鍵の名前を読み違えている）。

`session.svelte.ts` の `photo()` で、`this.#count('photo');` の行を `if (!writePhotos(this.save)) { … return; }` の閉じかっこの
あと、`this.#fx.flash();` の前へ移す。ほかの行は変えない。

**Verify**: `pnpm exec vitest run src/lib/games/pet-house/session.svelte.test.ts` → すべて pass（もとからある
「開いた直後に満たしていたスタンプは…」の `photo1` のスタンプを含む）。そのあと `git commit`（コミット 5）。

### Step 6: 全体の確かめ

**Verify**: `pnpm verify` → exit 0。`git log --oneline 982455c..HEAD` → この計画のコミットが 5 つあり、どれも trailer が無い。

## Test plan

- `engine.test.ts` に 3 つ（時計を戻したおこづかい・先の日付の払った日・先の来た日）
- `session.svelte.test.ts` に 3 つ（夜のフリスビー大会・ふだんの保存のお皿・保存できなかった写真）
- どれも直す前に FAIL することを、各ステップの最初の Verify で確かめる
- もとからある `engine.test.ts:50` のおこづかいのテスト、`session.svelte.test.ts:172`・`:190` のお皿のテスト、`:581` の
  スタンプのテストが pass のままであること
- `pnpm exec vitest run src/lib/games/pet-house/` → すべて pass

## Done criteria

- [ ] `pnpm exec vitest run src/lib/games/pet-house/` が pass し、足した 6 つのテストを含む
- [ ] `grep -n "allowanceDay === today" src/lib/games/pet-house/engine.ts` が何も返さない
- [ ] `grep -n "putBack" src/lib/games/pet-house/session.svelte.ts` が `#write` の中の 1 行だけを返す
- [ ] `git diff 982455c --stat -- src/` が In scope の 6 ファイルだけを示す
- [ ] `pnpm verify` が exit 0
- [ ] `git log --oneline 982455c..HEAD` にこの計画のコミットが 5 つあり、`git log -5 --format=%B` に `Co-Authored-By` が無い
- [ ] `plans/README.md` の 083 の行を更新し、`pnpm exec prettier --write plans/README.md` を通した

## STOP 条件

- Current state の抜粋（`#start()` の末尾、`catchUp` の 3 行、`daysTogether`、`putBack`、`dispose`、`#write`、`photo()`）が今のコードと違う
- 足したテストのどれかが、直す前から pass する
- `ContestPlay` の import が、`./contest-sounds` と `./scene-contest` の偽物を足しても落ちる
- Step 1 の夜のテストで `s.sky.phase` が `'night'` にならない、または `seen.view?.night` が 0.9 以下（時刻の差し替えが効いていない）
- 直したあと、`engine.test.ts:50` のおこづかいのテストか `session.svelte.test.ts:190` のお皿のテストが落ちる
- 直すのに `behavior.ts`・`contest.ts`・保存の形（`Save` の項目）を変えたくなった

## Maintenance notes

- 夜のコンテストの直しは `awake` を大会の秒ぶんだけ延ばすもので、大会が終わって部屋へ戻ると新しく作られたペットは `awake: 0`
  に戻る。夜にげんき 30 で戻れば、そのままベッドへ行くのは今どおり
- おこづかいは、時計を先へ進めてから戻すと 1 往復で 1 回だけ多くもらえる。それ以上を防ぐには端末の外の時計が要るので、ここでは
  追わない。開いたときの天気の一言（`greetedDay`、`session.svelte.ts:190-192`）も「日付が違えば」の同じ形だが、何も増えないので
  そのままにした
- お皿を保存するようにするなら、`#write` の `putBack` は外す（二重に戻さないように）
- 開いた問い。公園に入るたびにプレゼントを 3 つ置き直している（`session.svelte.ts:274`
  `if (scene === 'park') for (let i = 0; i < 3; i++) this.#reactions.spawnPresent();`）。公園を出入りすればいくらでも拾えるが、
  意図した遊び方かもしれないので、この計画では触らない。持ち主に聞いてから決める
- 実機では、夜（端末の時計を 22 時に）にげんきがちょうど出られるくらいの子でフリスビー大会とねこじゃらし大会に出て、終わるまで
  起きていることを見る
