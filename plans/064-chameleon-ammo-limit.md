# Plan 064: カメレオンのマップの設定に、本家の「弾数制限」を入れる（外すと減り、全ハンターが 0 で隠れる側の勝ち）

> **Executor instructions**: この計画を上から順に実行する。各ステップの確認コマンドを実行し、期待どおりの結果を
> 確かめてから次へ進む。「STOP 条件」のどれかに当たったら止めて報告する。終わったら `plans/README.md` の
> 自分の行の Status を更新する（レビュー担当に「索引は触らない」と言われたときは触らない）。
>
> **Drift check（最初に実行）**
> `git diff --stat 36cc037..HEAD -- src/lib/games/yappari-chameleon/referee.ts src/lib/games/yappari-chameleon/referee.test.ts src/lib/games/yappari-chameleon/host.ts src/lib/games/yappari-chameleon/host.test.ts src/lib/games/yappari-chameleon/net.ts src/lib/games/yappari-chameleon/session.svelte.ts src/lib/games/yappari-chameleon/HunterButtons.svelte src/lib/games/yappari-chameleon/HunterButtons.svelte.test.ts src/lib/games/yappari-chameleon/Settings.svelte src/lib/games/yappari-chameleon/Settings.svelte.test.ts src/lib/games/yappari-chameleon/prefs.ts src/lib/games/yappari-chameleon/prefs.test.ts src/lib/games/yappari-chameleon/cpu/hunter.ts src/lib/games/yappari-chameleon/cpu/hunter.test.ts`
> 何か出たら「Current state」の抜粋と今のコードを見比べ、食い違えば STOP。CLAUDE.md は毎日変わるので drift check に
> 入れていない。Step 8 で直す文は grep で探す。

## Status

| 項目       | 値                                                                                           |
| ---------- | -------------------------------------------------------------------------------------------- |
| Priority   | P2                                                                                           |
| Effort     | M                                                                                            |
| Risk       | MED（知らせの形が変わるので `CHAMELEON_VERSION` を上げる。既定はオフで、今の遊びは変えない） |
| Depends on | none                                                                                         |
| Category   | direction                                                                                    |
| Planned at | commit `36cc037`, 2026-10-14                                                                 |

## Why this matters

やっぱりカメレオンは Steam の『めっちゃカメレオン』を iPad に移したかくれんぼで、2〜3 人がそれぞれの iPad を QR でつないで遊ぶ。
今のハンターは 2 秒おきに何発でも撃てるので、怪しい所を片端から撃てば隠れる側はほぼ勝てない。2〜3 人だとハンター 1・隠れる人 1〜2 で、
この差がそのまま勝敗に出る。

本家にはマップの設定の「弾数制限」（既定オフ、v2.3.0）があり、外すと 1 発減り、当てると減らず、全ハンターの弾が 0 になったら
隠れる側の勝ちになる。設計書（`docs/superpowers/specs/2026-10-08-yappari-chameleon-design.md:15`）は 3 段めの中身に弾数制限を
挙げている。入れると、ハンターは「当てずっぽうに撃つ」か「よく見てから撃つ」かを選ぶことになり、大胆に隠れる遊びが生きる。

## Current state

### 本家の仕様（`docs/superpowers/specs/2026-10-08-yappari-chameleon-original.md`）

設定の表（149 行）は「弾数制限 | オフ | v2.3.0。弾数は設定できる（5 発の部屋の報告あり [報 S20]）」。
ハンターの節（172 行）の要点は、外すと 1 減り、当てると 1 戻り、リロードは無く、全ハンターが 0 になったら隠れ側の勝ち、弾は画面下に出る、の 5 つ。
勝敗（192 行）は「弾数制限ありなら全ハンターの弾 0 で隠れ側の勝ち」、終わり方（235 行）は「全ハンターの弾が 0 でも終わる（弾数制限）」。

この計画では「撃つと 1 発使い、当てたらその 1 発が戻る」と読み、外した数だけ減らす。当てても弾は最初の数を超えない。
172 行の「逃げ回っている（動いている）人を撃ったときは減らない」は、どの弾を「動いている人を撃った」と数えるかが本家から読み取れないので、
この計画では入れない（Out of scope）。

### 設定と試合の決めごと（`src/lib/games/yappari-chameleon/referee.ts`）

DOM と three を使わない純粋なルール。設定は `referee.ts:15-37` にある。

```ts
export interface Settings {
  mode: GameMode;
  hunters: number;
  hide: number;
  search: number;
  reveal: number;
  taunt: number;
  /** ハンターの画面に「見落とした敵」の順位を出す */
  overlook: boolean;
  petit: boolean;
}

export const DEFAULTS: Settings = {
  mode: 'infect',
  hunters: 1,
  hide: 120,
  search: 300,
  reveal: 30,
  taunt: 0,
  overlook: true,
  petit: false
};
export const LIMITS = { hide: [30, 300], search: [60, 600], reveal: [10, 120], taunt: [5, 120] } as const;
```

`fit`（`referee.ts:55-66`）が値を範囲に収める。強制挑発は「0 はなし、それ以外は範囲に収める」形で、弾数制限も同じ形にする。

```ts
    taunt: s.taunt <= 0 ? 0 : clamp(s.taunt, LIMITS.taunt),
```

試合の状態 `Match`（`referee.ts:68-107`）には撃った時刻 `shots` はあるが、弾の数は無い。`newMatch`（`:109-133`）、
`start`（`:165-205`、`Object.assign(m, { ... shots: {}, toots: {}, ... })`）、ロビーに戻るときの `enter(m, 'lobby')`
（`:222-239`）が試合ごとの値を空にする。

撃てるかの判定は `shoot`（`referee.ts:317-322`）。

```ts
export function shoot(m: Match, seat: Seat): boolean {
  if (m.roles[seat] !== 'hunter' || (m.phase !== 'search' && m.phase !== 'reveal')) return false;
  if (m.clock - (m.shots[seat] ?? -Infinity) < COOLDOWN - SHOT_SLACK - EPS) return false;
  m.shots[seat] = m.clock;
  return true;
}
```

答え合わせ（`reveal`）でも撃てる（本家と同じ。しぶきだけ）。弾数制限は探索（`search`）の弾だけに効かせる。

切れた人の処理 `leave`（`referee.ts:295-310`）は、いるハンターがいなくなると隠れる人の勝ちで答え合わせへ入り、最後に `settle(m, present)` を呼ぶ。

各端末へ配る形 `View`（`referee.ts:397-427`）と、作る `view(m)`（`:429-466`）がある。知らせの形はここで決まる。

### 当たりを決める所（`src/lib/games/yappari-chameleon/host.ts:265-295`）

当たったかは `fire()` のあとでしか分からないので、弾を減らすのは `rules.shoot` ではなくここの後ろでする。

```ts
  #shot(m: Message, from: Seat) {
    const { o, d: dir, from: muzzle } = m;
    if (!v3(o) || !v3(dir) || !num(m.ms)) return;
    const len = Math.hypot(...dir);
    if (len < 1e-6 || !rules.shoot(this.match, from)) return;
    ...
    for (const r of rays) {
      const seat = r.seat as Seat | null;
      if (seat === null) continue;
      if (double) {
        if (rules.spot(this.match, from, seat)) this.#port.tell('all', { t: 'found', seat, by: from, at: r.end });
        continue;
      }
      if (!rules.hit(this.match, seat)) continue;
      const body = this.#lines.get(seat)?.last();
      if (body) this.#found.set(seat, body);
      this.#port.tell('all', { t: 'found', seat, by: from, at: r.end, body });
    }
    this.#push(true);
  }
```

ダブルは全員が探す人で「隠れる側」がいないので、この計画では弾数制限をダブルに効かせない（設定はそのまま持つが数えない）。

### 撃つ側の画面

`session.svelte.ts:612-616` の `Session.shoot` は手元で筋を引いてから親へ送る。弾が 0 なら手元でも撃たないようにする。

```ts
  /** 十字の向きへ撃つ。当たりは親が決め、ここでは銃口から筋を引く（from は筋の始点で、当たりの判定には使わない） */
  shoot(): void {
    if (this.cool > 0 || this.play.role !== 'hunter') return;
    this.cool = COOLDOWN;
```

ハンターの操作の部品は `HunterButtons.svelte`（87 行。200 行未満に保つ）。撃つボタンは `HunterButtons.svelte:38-41`。

```svelte
<button class="round-btn shoot" style:--wait={wait} disabled={wait > 0} onpointerdown={() => session.shoot()}>
  <Icon name="aim" size="44px" />
  <span>うつ</span>
</button>
```

`HunterButtons.svelte.test.ts` は `session` を `{ cool, play, shoot, toggleCrouch }` だけの偽物で作る（`match` が無い）。
そこで弾の数は `session.match` を直接読まず、`Session` に足す `ammo` の getter で読む（偽物では `undefined` になり、今のテストは変えずに通る）。

### マップの設定の画面と保存

`Settings.svelte`（170 行）の数の行はデータで並ぶ（`Settings.svelte:12-17`）。

```ts
const rows = [
  { key: 'hide', label: 'ハンター待機時間（秒）', step: 10, range: LIMITS.hide },
  { key: 'search', label: '探索時間（秒）', step: 30, range: LIMITS.search },
  { key: 'reveal', label: '答え合わせ時間（秒）', step: 5, range: LIMITS.reveal },
  { key: 'taunt', label: '強制挑発間隔（秒）', step: 5, range: [0, LIMITS.taunt[1]] }
] as const;
```

値の表示は `Settings.svelte:57` の `<span class="value">{settings[r.key]}</span>`。CPU と遊ぶ（`cpu` が true）でもこの行は出る。

`prefs.ts:5` が数として読む項目を並べる（`const NUMBERS = ['hunters', 'hide', 'search', 'reveal', 'taunt'] as const;`）。
`readSettings` は `{ ...DEFAULTS, ...saved }` を `fit` に通すので、前の保存に `ammo` が無くても既定の 0 で読める。

### 探す CPU（`src/lib/games/yappari-chameleon/cpu/hunter.ts`）

CPU と遊ぶの「隠れる」では、CPU がハンターになる。試し撃ち（怪しさが半端な体へときどき撃つ）は `cpu/hunter.ts:210-212`。

```ts
if (this.#sus(top) >= SHOOT_AT) this.#aim = { seat: top, wait: this.#skill.wait, lost: false, shots: 0 };
else if (this.#sus(top) >= PROBE_AT && this.#cool === 0 && this.#rand() < PROBE_CHANCE)
  this.#fire(ctx, top, this.#skill.aim * 2);
```

狙って撃つのは `cpu/hunter.ts:244`（`if ((aim.wait -= dt) > 0 || this.#cool > 0) return;` のあとで `#fire`）。
CPU は試合の様子を `ctx.view`（`View`）で読む。

### 知らせの版（`src/lib/games/yappari-chameleon/net.ts:7-8`）

```ts
/** このゲームの知らせの形の版。形か屋敷の当たり（家具の箱）を変えたら 1 上げる。親の弾の当たりと子の歩きがずれるため（Party の PROTOCOL とは別） */
export const CHAMELEON_VERSION = 4;
```

`View` に項目を足すと、古い子は残りの弾を出せず撃ち続けるので上げる。版ちがいの子を迎えないテストの型は
`host.test.ts:114-119`（「プチカメレオンの前の子（版 3）は迎えない」）。

### 規約

- コメントは「コードから復元できない WHY」だけを日本語で書く（変更履歴やタスク番号は書かない）
- `.svelte` は 200 行未満（svelte-vitals の `architecture/component-size` がファイル全体を数える）。`HunterButtons.svelte` は 87 行、`Settings.svelte` は 170 行
- テストの名前は日本語の文にする
- 画面の言葉は本家に合わせる。設定の項目名は本家の「弾数制限」に、ほかの行と同じく単位を付けて「弾数制限（発）」にする。
  画面下の残りの弾の字は本家の字が仕様書に無いので「残り N 発」とし、iPad で見てもらう

## Commands you will need

| Purpose        | Command                                                                                                      | Expected on success           |
| -------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------- |
| 審判のテスト   | `pnpm exec vitest run src/lib/games/yappari-chameleon/referee.test.ts`                                       | すべて pass                   |
| 親のテスト     | `pnpm exec vitest run src/lib/games/yappari-chameleon/host.test.ts`                                          | すべて pass                   |
| カメレオン全部 | `pnpm exec vitest run src/lib/games/yappari-chameleon/`                                                      | すべて pass                   |
| 型             | `pnpm check`                                                                                                 | `0 ERRORS 0 WARNINGS`、exit 0 |
| 行数           | `wc -l src/lib/games/yappari-chameleon/HunterButtons.svelte src/lib/games/yappari-chameleon/Settings.svelte` | どちらも 200 未満             |
| 全部           | `pnpm verify`                                                                                                | exit 0                        |

## Scope

**In scope**

- `src/lib/games/yappari-chameleon/referee.ts` と `referee.test.ts`（設定・外した数・撃てるか・0 で決着・View）
- `src/lib/games/yappari-chameleon/host.ts` と `host.test.ts`（外れを数える、版ちがいのテスト）
- `src/lib/games/yappari-chameleon/net.ts`（`CHAMELEON_VERSION` を 1 上げる）
- `src/lib/games/yappari-chameleon/session.svelte.ts`（`ammo` の getter と `shoot` の 1 行）
- `src/lib/games/yappari-chameleon/HunterButtons.svelte` と `HunterButtons.svelte.test.ts`（画面下の残りの弾、0 で押せない）
- `src/lib/games/yappari-chameleon/Settings.svelte` と `Settings.svelte.test.ts`（弾数制限の行）
- `src/lib/games/yappari-chameleon/prefs.ts` と `prefs.test.ts`（覚える）
- `src/lib/games/yappari-chameleon/cpu/hunter.ts` と `cpu/hunter.test.ts`（0 なら撃たない、制限中は試し撃ちしない）
- `CLAUDE.md`（やっぱりカメレオンの段落に 1 文足す）
- `plans/README.md`（自分の行の Status だけ）

**Out of scope**

- 「動いている人を撃ったときは減らない」（本家 172 行）。どの弾を数えるかの決め方が要る。iPad で遊んでから決める
- ダブルでの弾数制限。隠れる側がいないので「全ハンターが 0 で隠れる側の勝ち」が成り立たない
- 答え合わせの弾。本家どおり撃てて、数えない
- 弾が 0 になったときの専用の演出や音、勝敗の専用の言葉（今の「勝者カメレオン!」を使う）
- `CpuSetup.svelte`（CPU の設定）。弾数はマップの設定で決め、CPU と遊ぶでもマップの設定の行がそのまま効く
- `match.svelte.ts`・`Hud.svelte`・`Overlay.svelte` — 残りの弾は `HunterButtons.svelte` だけに出す

## Git workflow

- ブランチは `advisor/064-chameleon-ammo-limit`
- コミットは英語の命令形 1 文で、Co-Authored-By などの trailer は付けない（例 `Add the ammo limit setting to the chameleon match`）。ステップごとに分けてよい
- push しない（`main` への push は本番に自動デプロイされる）

## Steps

### Step 1: 審判のテストを先に書く（落ちる）

`referee.test.ts` の import に `ammoOf` と `missed` を足し、`describe('撃つ間隔', ...)` のあとに次の describe を足す。
`begun()` は席 3 がハンター、1 と 2 が隠れる人で始める。`run(m, 3 + 60)` で探索に入る。

```ts
describe('弾数制限', () => {
  it('既定はオフで、範囲の外の値は 1〜20 に収め、0 以下はオフ', () => {
    expect(DEFAULTS.ammo).toBe(0);
    expect(fit({ ...DEFAULTS, ammo: 99 }, 3).ammo).toBe(20);
    expect(fit({ ...DEFAULTS, ammo: -3 }, 3).ammo).toBe(0);
    expect(fit({ ...DEFAULTS, ammo: undefined as unknown as number }, 3).ammo).toBe(0);
  });

  it('探索で外すと 1 減り、当てたときは減らない。答え合わせの弾は数えない', () => {
    const m = begun({ mode: 'normal', ammo: 3 });
    run(m, 3 + 60);
    expect(view(m).ammo).toEqual({ 3: 3 });
    missed(m, 3, ALL);
    expect(ammoOf(m, 3)).toBe(2);
    hit(m, 1);
    expect(ammoOf(m, 3)).toBe(2);
    hit(m, 2);
    expect(m.phase).toBe('reveal');
    missed(m, 3, ALL);
    expect(ammoOf(m, 3)).toBe(2);
  });

  it('弾が 0 のハンターは探索では撃てないが、答え合わせでは撃てる', () => {
    const m = begun({ mode: 'normal', ammo: 1, search: 60 });
    run(m, 3 + 60);
    m.misses[3] = 1;
    expect(shoot(m, 3)).toBe(false);
    run(m, 60);
    expect(m.phase).toBe('reveal');
    expect(shoot(m, 3)).toBe(true);
  });

  it('いるハンターが全員 0 になったら、隠れる側の勝ちで答え合わせへ入る', () => {
    const m = begun({ mode: 'normal', ammo: 2, hunters: 2 }, [2, 3]);
    run(m, 3 + 60);
    missed(m, 2, ALL);
    missed(m, 2, ALL);
    expect(m.phase).toBe('search');
    missed(m, 3, ALL);
    missed(m, 3, ALL);
    expect(m.phase).toBe('reveal');
    expect(m.winner).toBe('chameleon');
  });

  it('弾の残ったハンターが抜けて、残りが全員 0 なら、そこで隠れる側の勝ち', () => {
    const m = begun({ mode: 'normal', ammo: 1, hunters: 2 }, [2, 3]);
    run(m, 3 + 60);
    missed(m, 3, ALL);
    expect(m.phase).toBe('search');
    leave(m, 2, [1, 3]);
    expect(m.phase).toBe('reveal');
    expect(m.winner).toBe('chameleon');
  });

  it('増え鬼で見つかってハンターになった人は、最初の数の弾を持つ', () => {
    const m = begun({ mode: 'infect', ammo: 2 });
    run(m, 3 + 60);
    missed(m, 3, ALL);
    hit(m, 2);
    expect(view(m).ammo).toEqual({ 2: 2, 3: 1 });
  });

  it('制限がオフか、ダブルなら数えず、View の ammo は空', () => {
    const off = begun({ mode: 'normal' });
    run(off, 3 + 60);
    missed(off, 3, ALL);
    expect(view(off).ammo).toEqual({});
    expect(shoot(off, 3)).toBe(true);
    const double = begun({ mode: 'double', ammo: 1 });
    run(double, 3 + 60 + 1);
    missed(double, 1, ALL);
    expect(view(double).ammo).toEqual({});
    expect(double.phase).toBe('search');
  });

  it('次の試合とロビーでは外した数を 0 に戻す', () => {
    const m = begun({ mode: 'normal', ammo: 2, search: 60 });
    run(m, 3 + 60);
    missed(m, 3, ALL);
    run(m, 60 + 30);
    expect(m.phase).toBe('lobby');
    expect(m.misses).toEqual({});
  });
});
```

**Verify**: `pnpm exec vitest run src/lib/games/yappari-chameleon/referee.test.ts` → 足した describe が `ammoOf` / `missed` が無いことで
FAIL（import のエラーで、ファイル全体が落ちてよい）。足す前のテストを消したり変えたりしていない（`git diff --stat` で referee.test.ts だけ増えている）。

### Step 2: 審判に弾数制限を入れる

`referee.ts` を次のように変える。

1. `Settings` に `ammo` を足し（`petit` の前）、`DEFAULTS` と `LIMITS` にも足す。

```ts
/** 弾数制限（ハンター 1 人の弾）。0 は制限なし */
ammo: number;
```

`DEFAULTS` は `ammo: 0`、`LIMITS` は `ammo: [1, 20]` を足す。

2. `fit` に `ammo: s.ammo > 0 ? clamp(s.ammo, LIMITS.ammo) : 0,` を足す（`undefined > 0` は false なので 0 になる）。
3. `Match` に外した数を足し、`newMatch` と `start` の `Object.assign` と `enter` の `lobby` の `Object.assign` に `misses: {}` を足す。

```ts
/** 弾数制限で、探索で外した数（ハンターごと）。増え鬼で途中からハンターになった人は 0 から */
misses: Partial<Record<Seat, number>>;
```

4. 次の関数を `shoot` の上に足す。

```ts
/** 弾数制限が効くか。ダブルは全員が探す人で、0 になっても勝つ側がいないので数えない */
const limited = (m: Match): boolean => m.settings.ammo > 0 && m.settings.mode !== 'double';

export const ammoOf = (m: Match, seat: Seat): number => Math.max(0, m.settings.ammo - (m.misses[seat] ?? 0));

/** いるハンターが全員 0 になったら、隠れる側の勝ちで答え合わせへ */
function dry(m: Match, present: Seat[]): void {
  if (!limited(m) || m.phase !== 'search') return;
  const live = seatsOf(m, 'hunter').filter((s) => present.includes(s));
  if (live.length && live.every((s) => ammoOf(m, s) === 0)) {
    m.winner = 'chameleon';
    enter(m, 'reveal');
  }
}

/** 探索で撃った弾がだれにも当たらなかった。撃つと 1 発使い、当てたらその 1 発が戻る、を外した数で数える */
export function missed(m: Match, seat: Seat, present: Seat[]): void {
  if (!limited(m) || m.phase !== 'search') return;
  m.misses[seat] = (m.misses[seat] ?? 0) + 1;
  dry(m, present);
}
```

5. `shoot` の 1 行めのあとに足す。

```ts
if (m.phase === 'search' && limited(m) && ammoOf(m, seat) === 0) return false;
```

6. `leave` の最後の `settle(m, present);` の前に `dry(m, present);` を足す（弾の残ったハンターが抜けたとき）。
7. `View` に足し、`view(m)` の戻り値にも足す。

```ts
/** 弾数制限のあるとき、ハンターごとの残りの弾。制限が無いかダブルなら空 */
ammo: Partial<Record<Seat, number>>;
```

```ts
    ammo: limited(m) ? Object.fromEntries(seatsOf(m, 'hunter').map((s) => [s, ammoOf(m, s)])) : {},
```

**Verify**: `pnpm exec vitest run src/lib/games/yappari-chameleon/referee.test.ts` → すべて pass（足した 8 つを含む）。
`pnpm check` → `0 ERRORS 0 WARNINGS`（`Settings` を作っている所が型で落ちたら、その所に `ammo` を足す。テストの偽物の `View`
が落ちたら `ammo: {}` を足す）。

### Step 3: 親が外れを数える

`host.test.ts` の `describe('Host の当たり', ...)` に次の 2 つを足す（`searching()` は席 3 がハンター、2 が z = 5 の隠れる人を撃つ形）。

```ts
it('弾数制限のある探索で外すと残りの弾が減り、当てると減らない', () => {
  const { act, told, host } = searching({ mode: 'normal', ammo: 3 });
  act(me(0, [0, 0, 5]), 2);
  act(me(0, [0, 0, 0]), 3);
  act({ t: 'shot', o: [0, 0.75, 0], d: [1, 0, 0], ms: 0 }, 3);
  expect(lastView(told).ammo).toEqual({ 3: 2 });
  host.tick(2);
  act({ ...SHOT, ms: 0 }, 3);
  expect(of(told, 'found')).toHaveLength(1);
  expect(lastView(told).ammo).toEqual({ 3: 2 });
});

it('弾数制限で全ハンターの弾が 0 になると、隠れる側の勝ちで答え合わせへ', () => {
  const { act, told } = searching({ mode: 'normal', ammo: 1 });
  act(me(0, [0, 0, 0]), 3);
  act({ t: 'shot', o: [0, 0.75, 0], d: [1, 0, 0], ms: 0 }, 3);
  expect(lastView(told).phase).toBe('reveal');
  expect(lastView(told).winner).toBe('chameleon');
});
```

`host.ts` の `#shot` で、当たったかを数えて、外れなら `rules.missed` を呼ぶ。

```ts
    let struck = false;
    for (const r of rays) {
      ...
      if (!rules.hit(this.match, seat)) continue;
      struck = true;
      ...
    }
    if (!struck) rules.missed(this.match, from, this.#port.members);
    this.#push(true);
```

ダブルの `spot` のあとの `continue` はそのままでよい（`missed` はダブルでは何もしない）。

**Verify**: `pnpm exec vitest run src/lib/games/yappari-chameleon/host.test.ts` → すべて pass（足した 2 つを含む）。
`searching()` の床だけの屋敷では `d: [1, 0, 0]` の弾はだれにも当たらない。もし足した 1 つめで `found` が出たら STOP（的の置き方の読み違い）。

### Step 4: 知らせの版を上げる

`net.ts` の `CHAMELEON_VERSION` を今の値から 1 上げる（36cc037 では 4 → 5）。`host.test.ts` の「プチカメレオンの前の子（版 3）は迎えない」の
すぐ下に、同じ形で版 4 を断るテストを足す。

```ts
it('弾数制限の前の子（版 4）は迎えない', () => {
  const { act, told } = setup([1, 2]);
  act({ t: 'leave' }, 2);
  act({ t: 'hi', v: 4 }, 2);
  expect(told.at(-1)).toEqual({ to: 2, m: { t: 'chameleon-mismatch' } });
});
```

**Verify**: `pnpm exec vitest run src/lib/games/yappari-chameleon/host.test.ts src/lib/games/yappari-chameleon/session.svelte.test.ts src/lib/games/yappari-chameleon/cpu/` → すべて pass。
`grep -n "CHAMELEON_VERSION = " src/lib/games/yappari-chameleon/net.ts` → `CHAMELEON_VERSION = 5`（36cc037 から始めた場合）。

### Step 5: ハンターの画面に残りの弾を出し、0 では撃たない

1. `session.svelte.ts` の `shoot()` の上に getter を足し、`shoot()` の 1 行めの条件に足す。

```ts
  /** 弾数制限のある探索で、自分の残りの弾。制限が無いか探索でなければ null */
  get ammo(): number | null {
    return this.match.phase === 'search' ? (this.match.view.ammo[this.match.me] ?? null) : null;
  }
```

```ts
if (this.cool > 0 || this.play.role !== 'hunter' || this.ammo === 0) return;
```

2. `HunterButtons.svelte` で読み、撃つボタンを 0 で押せなくし、画面下の真ん中に残りの弾を出す（本家は弾を画面下に出す）。

```ts
// 弾数制限が無いときは null（テストの偽物の session では undefined）
const ammo = $derived(session.ammo ?? null);
```

撃つボタンは `disabled={wait > 0 || ammo === 0}` にする。`.column` の div の後ろに足す。

```svelte
{#if ammo !== null}<p class="ammo" role="status">残り {ammo} 発</p>{/if}
```

`<style>` に足す。

```css
.ammo {
  position: absolute;
  bottom: max(14px, env(safe-area-inset-bottom));
  left: 50%;
  translate: -50% 0;
  margin: 0;
  color: #fff;
  font-family: 'Hiragino Mincho ProN', serif;
  font-size: 22px;
  text-shadow: 0 1px 3px #000;
  pointer-events: none;
}
```

3. `HunterButtons.svelte.test.ts` に足す（今の 2 つのテストの偽物は変えない）。

```ts
it('弾数制限のあるときは画面下に残りの弾を出し、0 では「うつ」を押せない', () => {
  const session = $state({
    cool: 0,
    ammo: 1 as number | null,
    play: { crouch: false, jump: vi.fn() },
    shoot: vi.fn(),
    toggleCrouch: () => {}
  });
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(HunterButtons, { target, props: { session: session as unknown as Session } });
  flushSync();
  const shoot = target.querySelector<HTMLButtonElement>('.shoot')!;
  expect(target.querySelector('.ammo')?.textContent).toBe('残り 1 発');
  expect(shoot.disabled).toBe(false);
  session.ammo = 0;
  flushSync();
  expect(shoot.disabled).toBe(true);
  session.ammo = null;
  flushSync();
  expect(target.querySelector('.ammo')).toBeNull();
  unmount(app);
});
```

**Verify**: `pnpm exec vitest run src/lib/games/yappari-chameleon/HunterButtons.svelte.test.ts src/lib/games/yappari-chameleon/session.svelte.test.ts` → すべて pass。
`wc -l src/lib/games/yappari-chameleon/HunterButtons.svelte` → 200 未満（110 前後）。

### Step 6: マップの設定の行と保存

1. `Settings.svelte` の `rows` の最後に `{ key: 'ammo', label: '弾数制限（発）', step: 1, range: [0, LIMITS.ammo[1]] }` を足す。
2. 値の表示（57 行）を、弾数制限が 0 のときだけ「オフ」と出す形にする。

```svelte
<span class="value">{r.key === 'ammo' && !settings.ammo ? 'オフ' : settings[r.key]}</span>
```

3. `prefs.ts` の `NUMBERS` に `'ammo'` を足す。
4. `Settings.svelte.test.ts` に足す。

```ts
it('弾数制限の行は既定でオフと出し、CPU と遊ぶでも出す', () => {
  for (const cpu of [false, true]) {
    const { target, settings, done } = show(cpu);
    const row = [...target.querySelectorAll('.row')].find((r) => r.textContent?.includes('弾数制限（発）'))!;
    expect(row.querySelector('.value')?.textContent).toBe('オフ');
    settings.ammo = 5;
    flushSync();
    expect(row.querySelector('.value')?.textContent).toBe('5');
    done();
  }
});
```

5. `prefs.test.ts` の `describe` で、`saveSettings` と `readSettings` の試しの近くに足す。

```ts
it('弾数制限も覚え、前の版の保存（弾数制限の無い形）はオフで読む', () => {
  saveSettings({ ...DEFAULTS, ammo: 5 });
  expect(readSettings().ammo).toBe(5);
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ hide: 90, v: 2 }));
  expect(readSettings().ammo).toBe(0);
});
```

**Verify**: `pnpm exec vitest run src/lib/games/yappari-chameleon/Settings.svelte.test.ts src/lib/games/yappari-chameleon/prefs.test.ts src/lib/games/yappari-chameleon/Lobby.svelte.test.ts` → すべて pass。
`wc -l src/lib/games/yappari-chameleon/Settings.svelte` → 200 未満。

### Step 7: 探す CPU が弾数制限を守る

1. `cpu/hunter.ts` の試し撃ち（211 行）の条件に、制限中でないことを足す。乱数を引く前に置き、制限が無いときの乱数の流れを変えない。

```ts
    else if (
      this.#sus(top) >= PROBE_AT &&
      this.#cool === 0 &&
      // 弾数制限のあいだは、外すと減るので当てずっぽうに撃たない
      ctx.view.ammo[ctx.me] === undefined &&
      this.#rand() < PROBE_CHANCE
    )
```

2. 狙って撃つ所（244 行）を `if ((aim.wait -= dt) > 0 || this.#cool > 0 || ctx.view.ammo[ctx.me] === 0) return;` にする。
3. `cpu/hunter.test.ts` の `describe('探す CPU の気づきと撃つ', ...)` に足す。

```ts
it('弾数制限で弾が 0 なら撃たない', () => {
  const { c, run } = hunt('strong', eyes(1));
  c.view = { ...search, settings: { ...search.settings, ammo: 3 }, ammo: { 2: 0 } };
  run(10);
  expect(c.shots).toEqual([]);
});

it('弾数制限のあいだは、半端に怪しい体へ試し撃ちしない', () => {
  const probes = (limited: boolean) => {
    const { c, run } = hunt('weak', eyes(0.12), OPEN, rng(9));
    if (limited) c.view = { ...search, settings: { ...search.settings, ammo: 3 }, ammo: { 2: 3 } };
    run(6);
    return c.shots.length;
  };
  expect(probes(true)).toBeLessThanOrEqual(probes(false));
});
```

2 つめのテストは、制限なしでも試し撃ちが 1 発も出ない目立ち（`eyes(0.12)`）だと何も確かめられない。制限なしで `probes(false)` が 0 なら、
`eyes` の値を 0.1〜0.3 のあいだで変え、`probes(false) > 0` かつ `probes(true) === 0` になる値を探して、最後の行を
`expect(probes(true)).toBe(0)` と `expect(probes(false)).toBeGreaterThan(0)` の 2 行に直す。0.1〜0.3 のどの値でも
`probes(false)` が 0 なら、このテストは足さずに報告する。

**Verify**: `pnpm exec vitest run src/lib/games/yappari-chameleon/cpu/` → すべて pass（足したテストを含む）。

### Step 8: CLAUDE.md に仕様を 1 文足す

`grep -n "マップの設定（\`Settings.svelte\`）は親の端末の" CLAUDE.md` で出た行（やっぱりカメレオンの段落）の、
「「プチカメレオンを許可」は初めからオフ。」の直後に次の文を足す。

```text
「弾数制限（発）」（`Settings.ammo`、既定 0 でオフ、1〜20）は、探索で外した弾だけを数え（当てると撃った 1 発が戻る扱いで減らない。答え合わせの弾とダブルは数えない、`referee.ts` の `missed`）、残りはハンターの画面下に「残り N 発」（`HunterButtons.svelte`）で出し、いるハンターが全員 0 になったら隠れる側の勝ちで答え合わせへ入る。探す CPU は制限のあいだ試し撃ちをしない。
```

grep で行が出なければ STOP（CLAUDE.md の文が変わっている）。

**Verify**: `grep -c "弾数制限（発）" CLAUDE.md` → 1。

### Step 9: 全体の確かめ

**Verify**: `pnpm verify` → exit 0。

## Test plan

- 審判（`referee.test.ts`）に 8 つ。既定・範囲、外すと減り当てると減らない、0 では探索で撃てない（答え合わせは撃てる）、全員 0 で隠れる側の勝ち、
  抜けたあとの 0 で決着、増え鬼の新しいハンター、オフとダブルは数えない、次の試合で戻す
- 親（`host.test.ts`）に 3 つ。外すと View の残りが減る、全員 0 で答え合わせ、版 4 の子を断る
- 画面（`HunterButtons.svelte.test.ts`・`Settings.svelte.test.ts`）に 1 つずつ、保存（`prefs.test.ts`）に 1 つ
- 探す CPU（`cpu/hunter.test.ts`）に 2 つ
- 型にするテストは `referee.test.ts` の「撃つ間隔」、`host.test.ts` の「隠れる人に当たれば found と splat を…」
- `pnpm exec vitest run src/lib/games/yappari-chameleon/` → すべて pass

## Done criteria

- [ ] `pnpm exec vitest run src/lib/games/yappari-chameleon/` が pass し、上の新しいテストを含む
- [ ] `grep -n "CHAMELEON_VERSION = " src/lib/games/yappari-chameleon/net.ts` が始めたときより 1 大きい値を出す
- [ ] `grep -n "ammo: 0" src/lib/games/yappari-chameleon/referee.ts` が `DEFAULTS` の行を出す（既定はオフ）
- [ ] `wc -l` で `HunterButtons.svelte` と `Settings.svelte` がどちらも 200 未満
- [ ] `grep -c "弾数制限（発）" CLAUDE.md` が 1
- [ ] `pnpm verify` が exit 0
- [ ] `git status` で in scope 以外のファイルが変わっていない
- [ ] `plans/README.md` の 064 の行を更新し、`pnpm exec prettier --write plans/README.md` を通した

## STOP 条件

- `referee.ts` の `Settings` / `fit` / `shoot` / `leave` / `view`、`host.ts` の `#shot`、`net.ts` の `CHAMELEON_VERSION` が上の抜粋と違う
- `CHAMELEON_VERSION` が 4 でない（ほかの計画が先に上げた）。そのときは今の値から 1 上げ、版ちがいのテストの `v:` を今の値にそろえてよいが、
  `host.test.ts` の版 1〜3 の既存のテストは変えない。ほかの計画が `View` に足した項目と名前がぶつかったら STOP
- Step 1 のテストのどれかが、Step 2 の前から pass する
- Step 3 の外れの弾が `searching()` の屋敷で何かに当たり、`found` が出る
- 既存の `Lobby.svelte.test.ts` / `Overlay.svelte.test.ts` / `cpu/crew.test.ts` が落ち、直すのに in scope 以外のファイルを変えたくなった
- `HunterButtons.svelte` か `Settings.svelte` が 200 行以上になる

## Maintenance notes

- 「動いている人を撃ったときは減らない」（本家 172 行）を足すときは、親の `#shot` で、弾の線のそばに直前 `STILL_MS` に動いた隠れる人がいたかを
  `#hidden()` の `still` で見て、`missed` を呼ばないようにするのが近い。iPad で遊んで、外れの減り方が厳しいと言われたら検討する
- 弾が 0 のハンターは試合に残り、歩いて見て回れる（本家にリロードは無い）。0 のハンターの画面に何を出すか（「弾切れ」など）は iPad の感想で決める
- 逆算チキンレース（3 段めの別の計画）で `View` や `Settings` に項目を足すときは、`CHAMELEON_VERSION` をさらに 1 上げる
- 実機では、2 台で「弾数制限 3・通常」にして、外すたびに画面下の数が減る・当てると減らない・0 で「うつ」が押せない・全員 0 で「勝者カメレオン!」の答え合わせになる、を見る。
  CPU と遊ぶの「隠れる」でも、CPU の弾が尽きて勝てることを見る
