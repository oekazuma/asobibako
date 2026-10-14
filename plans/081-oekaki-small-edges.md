# Plan 081: おえかきのもりで、戻った子にも打っている字を見せ、リレーで抜けた人の打ちかけの字を答えに使う

> **Executor instructions**: この計画を上から順に実行する。各ステップの確認コマンドを実行し、期待どおりの結果を
> 確かめてから次へ進む。「STOP 条件」のどれかに当たったら止めて報告する。終わったら `plans/README.md` の
> 自分の行の Status を更新する（レビュー担当に「索引は触らない」と言われたときは触らない）。
>
> **Drift check（最初に実行）**
> `git diff --stat 982455c..HEAD -- src/lib/games/oekaki-mori/referee.ts src/lib/games/oekaki-mori/referee.test.ts src/lib/games/oekaki-mori/relay.ts src/lib/games/oekaki-mori/relay.test.ts src/lib/games/oekaki-mori/relay-referee.ts src/lib/games/oekaki-mori/relay-referee.test.ts`
> 何か出たら「Current state」の抜粋と今のコードを見比べ、食い違えば STOP。`src/lib/games/oekaki-mori/CLAUDE.md` は
> 毎日変わるので drift check に入れていない。Step 3 で直す 2 つの文を grep で確かめる。

## Status

| 項目       | 値                                                                 |
| ---------- | ------------------------------------------------------------------ |
| Priority   | P3                                                                 |
| Effort     | S                                                                  |
| Risk       | LOW（親の審判 2 つの小さな変更。知らせの形と画面の部品は変えない） |
| Depends on | none（067・069・077・078・079 はもう入っている）                   |
| Category   | bug                                                                |
| Planned at | commit `982455c`, 2026-10-14                                       |

## Why this matters

おえかきのもり（2〜3 台の iPad をつないで遊ぶお絵かきクイズ）の、つなぎ直しまわりの小さな食い違いを 2 つ直す。

1. エゴコロクイズでは、当てる人が 50 音盤で打っている字を、描く人にはそのまま、ほかの当てる人には字数だけ（●）で上の帯に出す。
   切れて戻った子は、打っている人が次の 1 字を打つまで、その人の字も ● も見えない。親の審判（`referee.ts`）は打っている字を
   中継するだけで覚えておらず、戻った子へ送り直す材料が無いため。
2. おえかきリレーで、当てるだんの途中に切れた人の答えは、打ちかけの字があっても「わからなかった」になる。時間切れなら打ちかけの字を
   答えにする（仕様）ので、切れたときだけ答えが消える。親の審判（`relay-referee.ts`）は人ごとの打ちかけの字を持っているのに、
   `relay.ts` の `leave` に渡していない。

どちらも、親の審判の中だけで直る。知らせの形・画面の部品（`.svelte`）・子の端末の処理は変えない。

## Current state

### 1 つめ（戻った子に打っている字が見えない）

`src/lib/games/oekaki-mori/referee.ts:81-94`。戻った子（`join`）には見え方だけを送り直し、抜けた人（`leave`）の ● は全員から消す。

```ts
    } else if (message.t === 'join') {
      rejoin(s, from);
      // 戻った子の画面は何も持っていないので、前に送った見え方と同じでも送り直す
      this.#sent.delete(from);
    } else if (message.t === 'typing') return this.#typing(s, from, String(message.text));
    else if (message.t === 'stamp') return this.#stamp(s, from, String(message.id));
    else if (message.t === 'leave') {
      leave(s, from);
      // 打っている途中で切れた人の ● が、番の終わりまで残らないようにする
      for (const seat of this.#party.members)
        if (seat !== from) this.#party.tell(seat, { t: 'typing', seat: from, text: '' });
    }
    this.#push();
  }
```

`src/lib/games/oekaki-mori/referee.ts:105-117`。打っている字はその場で配るだけで、どこにも残さない。

```ts
  /**
   * 描く人には打っている字をそのまま、ほかの当てる人には字数だけ見せる（字が見えると答えがばれる）。
   * 空の字は、当てたあとや描く時間のあとでも配る。50 音盤は答えを送ってから空を知らせるので、捨てると ● が残る
   */
  #typing(s: Quiz, from: Seat, text: string) {
    if (s.mode !== 'egokoro' || from === drawer(s)) return;
    if (text && (s.phase !== 'draw' || s.solved.includes(from))) return;
    const hidden = '●'.repeat([...text].length);
    for (const seat of this.#party.members) {
      if (seat === from) continue;
      this.#party.tell(seat, { t: 'typing', seat: from, text: seat === drawer(s) ? text : hidden });
    }
  }
```

子の画面の側（読むだけで、変えない）。

- `OekakiMori.svelte:33-44` の `joined()` は、つなぎ直すと `round.reset()` で `round.typing = {}` にしてから知らせを聞き始める。
  親は `join` を受けると `catchUp`（`sync.ts`。絵と外れた答えだけ）を送り、そのあと審判が見え方（`view`）を送る
- `round.svelte.ts:65` は届いた `typing` を `typed()` で人ごとの欄に入れる。`round.svelte.ts:94-99` は前の見え方があって番（`turn`）が
  変わったときだけ `typing` を消す。戻った子は前の見え方を持たない（`reset()` で `null`）ので、`view` より前でも後でも、届いた
  `typing` は消されずに残る
- 50 音盤（`KanaPad.svelte`）は `Play.svelte:77` の `{#key view.turn}` で番ごとに作り直され、そのとき空の字を送らない。
  そのため審判が覚える字には、前の番の打ちかけが残りうる。覚えるときに番（`s.turn`）も一緒に覚え、いまの番の字だけを送り直す

ルールの型は `engine.ts`。`Quiz.turn`（番の番号）・`Quiz.phase`（`'ready' | 'draw' | 'reveal' | 'done'`）・`drawer(s)` を使う。
描く人が切れると `leave` が次の番へ進める（`engine.ts:262` の `if (wasDrawing) return begin(s, s.turn + 1, rand, words);`）。

### 2 つめ（リレーで抜けた人の打ちかけの字が消える）

`src/lib/games/oekaki-mori/relay.ts:134-141`。「できた」を受けたこまを埋める。当てるこまなら字（空なら `null`）を入れる。

```ts
export function finish(s: Relay, seat: Seat, text?: string): void {
  if (s.phase !== 'play' || s.done.includes(seat)) return;
  const c = chainOf(s, seat);
  if (c < 0) return;
  const entry = s.chains[c].entries.at(-1);
  if (entry?.kind === 'guess') entry.text = text?.trim() || null;
  s.done.push(seat);
}
```

`src/lib/games/oekaki-mori/relay.ts:171-178`。時間切れは打ちかけの字（`typed`）を答えにする。

```ts
if (s.left <= 0)
  s.chains.forEach((chain, c) => {
    const by = assignee(s, c, s.step);
    if (s.done.includes(by)) return;
    const entry = chain.entries.at(-1);
    if (entry?.kind === 'guess') entry.text = typed[by]?.trim() || null;
    s.done.push(by);
  });
```

`src/lib/games/oekaki-mori/relay.ts:182-187`。抜けた人のこまは、字を見ずに埋める（当てるこまは `open` で `text: null` のまま）。

```ts
/** 抜けた人のいまのこまは、描きかけの線のまま、答えはわからなかったとして埋める。1 人になったら、呼び直すのを待ってからふりかえりへ */
export function leave(s: Relay, seat: Seat): void {
  s.present = s.present.filter((p) => p !== seat);
  if (s.phase === 'play' && chainOf(s, seat) >= 0 && !s.done.includes(seat)) s.done.push(seat);
  if (s.phase === 'play' && s.present.length < 2) s.wait = GRACE_S;
}
```

`leave` の 2 行めの条件（`phase === 'play'`・`chainOf >= 0`・まだ `done` でない）は、`finish` の守りとまったく同じ。`finish` は
当てるこまなら字を入れ、描くこまなら線に触らずに `done` へ入れる。なので `leave` の 2 行めを `finish(s, seat, typed)` にすれば、
描くこまの扱いは今のままで、当てるこまだけ打ちかけの字が入る（`typed` が無ければ今と同じ `null`）。

`src/lib/games/oekaki-mori/relay-referee.ts:16-17` と `:43-53`。審判は人ごとの打ちかけの字を `#typed` に持っているが、`leave` に渡していない。

```ts
  /** 時間切れの当てるこまに使う、打ちかけの字 */
  #typed: Record<number, string> = {};
```

```ts
  #act(message: Message, from: Seat) {
    const s = this.#state;
    if (!s) return;
    if (message.t === 'ink') addInk(s, from, message.ink);
    else if (message.t === 'typing') this.#typed[from] = String(message.text);
    else if (message.t === 'relayDone') {
      // 二度押しや時間切れまぎわの「できた」が遅れて届いても、次のだんのこまを終わらせない
      if (Number(message.step) === s.step)
        finish(s, from, message.text === undefined ? undefined : String(message.text));
    } else if (message.t === 'relayNext' && from === 1) next(s);
    else if (message.t === 'leave') leave(s, from);
```

`#typed` はだんが替わると `#push` が空にする（`relay-referee.ts:91-94`）ので、前のだんの字は残らない。`null` の答えは、次の描くだんで
新しいお題に置き換わる（`relay.ts:81-83`）。ゲームの仕様（`src/lib/games/oekaki-mori/CLAUDE.md` の 6 行め）は
「時間切れの答えは打ちかけの字、無ければ「わからなかった」にして次の描く人へ新しいお題を配る」。

### テストの道具

- `referee.test.ts:9-22` の `fakeParty(members)` は、`act(message, from)` で審判へ操作を入れ、`told` に `[宛先, 知らせ]` を積む。
  `$lib/loop` の `animate` は何もしない関数に差し替えてあり、時間は進まない（`referee.test.ts:7`）
- `relay-referee.test.ts:7-29` は `animate` を控えて `frame(dt)` で 1 フレーム進める型。`of(told, t)` で知らせを種類で絞る
- `relay.test.ts:20-27` の `relay(players)` は 'short'（4 だん）のリレーを作り、`allDone(s, text)` で全員を「できた」にしてだんを進める

### 規約

- コメントは「コードから復元できない WHY」だけを日本語で書く。変更の経緯やプランの番号は書かない
- テストの名前は日本語の文にする
- この計画では `.svelte` を触らない（200 行の上限に関わらない）
- 計画の中のコード例は、整形のためにインデントを省いてある。書くときは周りのコードのインデントに合わせ、最後に
  `pnpm exec prettier --write <file>` で整える

### 見送ったもの（この計画ではやらない）

子が描く人のとき、描く時間の終わりまぎわ（1 往復ぶん）に描いた線は、親が描く時間の外として配らず、描く人の端末にだけ残る。
直し方として「答えを見せるあいだ（`reveal`）に届いた描く人の線も配り、各端末の `Round` がその番の絵（`gallery` の最後）にも入れる」
が考えられるが、食い違うのは最後の線の 1 往復ぶんの先だけで、配る規則を広げる割に得るものが小さいので、この計画では扱わない。

## Commands you will need

| Purpose        | Command                                                                                                                                                  | Expected on success           |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| 足すテスト     | `pnpm exec vitest run src/lib/games/oekaki-mori/referee.test.ts src/lib/games/oekaki-mori/relay.test.ts src/lib/games/oekaki-mori/relay-referee.test.ts` | すべて pass                   |
| ゲームのテスト | `pnpm exec vitest run src/lib/games/oekaki-mori/`                                                                                                        | すべて pass                   |
| 全テスト       | `pnpm test:run`                                                                                                                                          | exit 0                        |
| 型             | `pnpm check`                                                                                                                                             | `0 ERRORS 0 WARNINGS`、exit 0 |
| lint           | `pnpm lint`                                                                                                                                              | exit 0                        |
| svelte-vitals  | `pnpm vitals --diff`                                                                                                                                     | 警告 0                        |
| 全部           | `pnpm verify`                                                                                                                                            | exit 0                        |

## Scope

**In scope**

- `src/lib/games/oekaki-mori/referee.ts`
- `src/lib/games/oekaki-mori/referee.test.ts`（テストを足す）
- `src/lib/games/oekaki-mori/relay.ts`
- `src/lib/games/oekaki-mori/relay.test.ts`（テストを足す）
- `src/lib/games/oekaki-mori/relay-referee.ts`
- `src/lib/games/oekaki-mori/relay-referee.test.ts`（テストを足す）
- `src/lib/games/oekaki-mori/CLAUDE.md`（Step 3 の 2 つの文だけ）
- `plans/README.md`（自分の行の Status だけ）

**Out of scope**

- `sync.ts` の `catchUp` — 絵を送る口で、ルールの状態を知らない。打っている字はルールを持つ審判が送る
- `round.svelte.ts`・`OekakiMori.svelte`・`Play.svelte`・`KanaPad.svelte` — 子の側は今のままで、届いた `typing` を正しく出せる
- `engine.ts` の `leave`・`rejoin` — 番やルールの決まりは変えない
- 知らせの種類を足すこと（`typing` をそのまま使う）
- 「見送ったもの」に書いた、描く時間の終わりまぎわの線の食い違い

## Git workflow

- ブランチは `advisor/081-oekaki-small-edges`
- コミットは直すもの 1 つにつき 1 つ（Step 1 と Step 2 で 1 つずつ、Step 3 は Step 2 のコミットに含めてよい）。
  英語の命令形 1 文で、`Co-Authored-By` などの署名の行は付けない。例 `Resend who is typing to a guest who rejoins mid-turn`
- push しない（`main` への push は本番へ出る）

## Steps

### Step 1: 戻った子へ、いまの番で打っている人の字を送り直す

まず `referee.test.ts` の `describe('Referee', ...)` の中に、落ちるテストを 2 つ足す。

```ts
// 戻った子の帯は空から始まるので、打っている人が次の 1 字を打つまで ● が出ない
it('戻った人に、いまの番で打っている人の字を見せ方どおりに送り直す', () => {
  const { party, told, act } = fakeParty([1, 2, 3]);
  new Referee(party).start('egokoro');
  act({ t: 'start' }, 1);
  act({ t: 'typing', text: 'りん' }, 2);
  act({ t: 'leave' }, 3);
  told.length = 0;
  act({ t: 'join' }, 3);
  expect(told.filter(([seat, m]) => seat === 3 && m.t === 'typing')).toEqual([
    [3, { t: 'typing', seat: 2, text: '●●' }]
  ]);
});

// 50 音盤は番が替わると空の字を送らずに作り直されるので、前の番の打ちかけが残っている
it('前の番の打ちかけの字は、戻った人へ送らない', () => {
  const { party, told, act } = fakeParty([1, 2, 3]);
  new Referee(party).start('egokoro');
  act({ t: 'start' }, 1);
  act({ t: 'typing', text: 'り' }, 3);
  act({ t: 'leave' }, 1);
  act({ t: 'start' }, 2);
  told.length = 0;
  act({ t: 'join' }, 1);
  expect(told.filter(([, m]) => m.t === 'typing')).toEqual([]);
});
```

2 つめは、描く人の 1 が切れると次の番（描く人は 2）へ進むことを使う（`engine.ts:262`）。

**Verify**: `pnpm exec vitest run src/lib/games/oekaki-mori/referee.test.ts` → 1 つめが落ち（`typing` が届かない）、2 つめは pass
（今は何も送らないので）。

次に `referee.ts` を直す。

1. `#stamped` の下に、覚える欄を足す。

   ```ts
     /** 当てる人ごとのいまの打っている字。50 音盤は番が替わっても空の字を送らないので、打った番も覚えて古い字を見分ける */
     #typed = new Map<Seat, { turn: number; text: string }>();
   ```

2. `#typing` を、覚えてから配る形にし、見せ方を `#tellTyping` に出す。

   ```ts
     /** 空の字は、当てたあとや描く時間のあとでも配る。50 音盤は答えを送ってから空を知らせるので、捨てると ● が残る */
     #typing(s: Quiz, from: Seat, text: string) {
       if (s.mode !== 'egokoro' || from === drawer(s)) return;
       if (text && (s.phase !== 'draw' || s.solved.includes(from))) return;
       if (text) this.#typed.set(from, { turn: s.turn, text });
       else this.#typed.delete(from);
       for (const seat of this.#party.members) if (seat !== from) this.#tellTyping(s, seat, from, text);
     }

     /** 描く人には打っている字をそのまま、ほかの当てる人には字数だけ見せる（字が見えると答えがばれる） */
     #tellTyping(s: Quiz, to: Seat, from: Seat, text: string) {
       this.#party.tell(to, { t: 'typing', seat: from, text: to === drawer(s) ? text : '●'.repeat([...text].length) });
     }
   ```

3. `#act` の `join` の分岐の `this.#sent.delete(from);` の下に足す。

   ```ts
   // 打っている人の ● は字が変わるまで届かないので、いまの番の分を送り直す
   if (s.phase === 'draw')
     for (const [seat, typed] of this.#typed)
       if (seat !== from && typed.turn === s.turn) this.#tellTyping(s, from, seat, typed.text);
   ```

4. `#act` の `leave` の分岐の `leave(s, from);` の下に `this.#typed.delete(from);` を足す（抜けた人の字を、あとで戻った人へ送らない）。

`join` の分岐で `this.#push()` より先に `typing` を送っても、戻った子の `Round` は前の見え方を持たないので消されない
（Current state の「子の画面の側」）。

**Verify**: `pnpm exec vitest run src/lib/games/oekaki-mori/referee.test.ts` → すべて pass（もとからある「打っている字は、描く人には
そのまま…」「抜けた人の打っている字を全員の画面から消す」「当てたあとや描く時間のあとでも、空の字は配って消させる」を含む）。
`pnpm check` → `0 ERRORS 0 WARNINGS`。

コミットする（例 `Resend who is typing to a guest who rejoins mid-turn`）。

### Step 2: リレーで抜けた人の当てるこまに、打ちかけの字を入れる

まず落ちるテストを 2 つ足す。

`relay.test.ts` の `describe('relay', ...)` の中。

```ts
it('抜けた人の当てるこまは、時間切れと同じく打ちかけの字を答えにし、無ければわからなかったにする', () => {
  const s = relay();
  allDone(s);
  leave(s, 2, 'りん');
  leave(s, 3);
  const guesses = s.chains.map((c) => c.entries.at(-1));
  expect(guesses).toContainEqual({ kind: 'guess', by: 2, text: 'りん' });
  expect(guesses).toContainEqual({ kind: 'guess', by: 3, text: null });
});
```

`relay-referee.test.ts` の `describe('RelayReferee', ...)` の中。

```ts
// 当てる途中で切れた人の答えが消えると、次に描く人へ新しいお題が配られ、リレーがつながらない
it('当てる途中で抜けた人の打ちかけの字を、次に描く人へ渡す', () => {
  frames.list = [];
  const { party, told, act } = fakeParty([1, 2, 3]);
  new RelayReferee(party).start('short', null);
  for (const seat of [1, 2, 3]) act({ t: 'relayDone', step: 0 }, seat as Seat);
  frame();
  act({ t: 'typing', text: 'りん' }, 2);
  act({ t: 'leave' }, 2);
  act({ t: 'relayDone', step: 1, text: 'いぬ' }, 1);
  act({ t: 'relayDone', step: 1, text: 'いぬ' }, 3);
  frame();
  const task = of(told, 'relayTask').find(([seat, m]) => seat === 3 && m.step === 2)!;
  expect(task[1].task).toEqual({ kind: 'draw', word: 'りん' });
});
```

並びの確かめ。受け持ちは `assignee(s, c, step) = players[(c + step) % 3]`（`relay.ts:55-57`）。だん 1 でリレー 0 を当てるのは
`players[1]` = 2、だん 2 でリレー 0 を描くのは `players[2]` = 3 なので、3 の描くお題が 2 の打ちかけの字になる。

**Verify**: `pnpm exec vitest run src/lib/games/oekaki-mori/relay.test.ts src/lib/games/oekaki-mori/relay-referee.test.ts` → 足した 2 つが落ちる
（`relay.test.ts` は型の上でも `leave` の引数が多いと言われるが、vitest は型を見ないので答えの違いで落ちる）。

次に直す。

1. `relay.ts` の `leave` を次にする（コメントも替える）。

   ```ts
   /** 抜けた人のいまのこまは、描きかけの線のまま、答えは時間切れと同じく打ちかけの字（無ければわからなかった）で埋める。1 人になったら、呼び直すのを待ってからふりかえりへ */
   export function leave(s: Relay, seat: Seat, typed?: string): void {
     s.present = s.present.filter((p) => p !== seat);
     finish(s, seat, typed);
     if (s.phase === 'play' && s.present.length < 2) s.wait = GRACE_S;
   }
   ```

2. `relay-referee.ts` の `#act` の `leave` の分岐を `else if (message.t === 'leave') leave(s, from, this.#typed[from]);` にする。

**Verify**: `pnpm exec vitest run src/lib/games/oekaki-mori/` → すべて pass（もとからある「抜けた人のこまは埋めて進め、1 人になったら
GRACE_S 秒待ってからふりかえりに入る」「1 人で待つあいだはだんを進めず、戻ったら続ける」「戻った人は次のだんから受け持ち、
そのだんでは待つ」を含む）。`pnpm check` → `0 ERRORS 0 WARNINGS`。

### Step 3: ゲームの仕様の 2 つの文を今の動きに合わせる

`src/lib/games/oekaki-mori/CLAUDE.md` の 2 か所を直す（文の前後は変えない）。

- 6 行めの「時間切れの答えは打ちかけの字、無ければ「わからなかった」にして」を「時間切れと抜けた人の答えは打ちかけの字、無ければ「わからなかった」にして」にする
- 17 行めの「戻った子には `sync.ts` の `catchUp` で絵を送り、審判が見え方を送り直す」を「戻った子には `sync.ts` の `catchUp` で絵を送り、審判が見え方といまの番で打っている字を送り直す」にする

**Verify**: `grep -c "時間切れと抜けた人の答えは打ちかけの字" src/lib/games/oekaki-mori/CLAUDE.md` → `1`。
`grep -c "審判が見え方といまの番で打っている字を送り直す" src/lib/games/oekaki-mori/CLAUDE.md` → `1`。
直す前の文が見つからなければ STOP。

Step 2 と Step 3 を 1 つのコミットにする（例 `Keep a leaving relay guesser's half-typed answer`）。

### Step 4: 全体の確かめ

**Verify**: `pnpm verify` → exit 0。

## Test plan

- 足すテストは 4 つ。`referee.test.ts` に 2 つ（戻った人へ ● を送り直す・前の番の字は送らない）、`relay.test.ts` に 1 つ
  （抜けた人の当てるこまに打ちかけの字・無ければ `null`）、`relay-referee.test.ts` に 1 つ（審判が抜けた人の字を渡し、次の描く人の
  お題になる）
- 型にするテストは同じファイルの既存のテスト（`fakeParty` と `frame`）
- `pnpm exec vitest run src/lib/games/oekaki-mori/` → すべて pass

## Done criteria

- [ ] Commands の「足すテスト」が pass し、足した 4 つを含む
- [ ] `grep -n "leave(s, from, this.#typed\[from\])" src/lib/games/oekaki-mori/relay-referee.ts` が 1 行返す
- [ ] `grep -c "#tellTyping" src/lib/games/oekaki-mori/referee.ts` が `3` 以上（定義・`#typing` の中・`join` の分岐）
- [ ] Step 3 の 2 つの grep がどちらも `1`
- [ ] `pnpm verify` が exit 0
- [ ] `git status` で in scope 以外のファイルが変わっていない
- [ ] `plans/README.md` の 081 の行を更新し、`pnpm exec prettier --write plans/README.md` を通した（レビュー担当が索引を持つと言われたら触らない）

## STOP 条件

- Current state の抜粋（`referee.ts` の `join`・`leave`・`#typing`、`relay.ts` の `finish`・`leave`、`relay-referee.ts` の `#act`）が今のコードと違う
- `finish` の守り（`phase !== 'play'`・`done.includes`・`chainOf < 0`）が `leave` の今の条件と同じでなくなっている
  （同じでなければ、`leave` を `finish` に寄せると描くこまの扱いが変わる）
- Step 1 のテストを通すのに `round.svelte.ts` や `OekakiMori.svelte` を変えたくなった（子の側は変えない前提。違えば報告）
- 既存のテストが落ち、直すのに既存のテストの期待を書き換えたくなった
- どれかの確認が 2 回直しても通らない

## Maintenance notes

- 審判の `#typed` は打ったときの番を持つので、番が替わっても消さない。古い字は送り直すときに番で捨てる。
  50 音盤が番の替わりに空の字を送るようになったら、番を覚える必要はなくなる
- エゴコロクイズで打っている字を見せる人を増やす・減らすときは、`#tellTyping` だけを直せば、ふだんの配り方と戻った子への送り直しの
  両方に効く
- リレーで抜けた人の答えは、時間切れと同じ扱いになった。抜けた人が同じだんのうちに戻っても、そのだんは待つ（`taskOf` が `wait`）ので、
  入った答えは変わらない
- 実機では、3 台のエゴコロクイズで 1 人が打っている途中にもう 1 人のアプリを閉じて戻し、戻った端末の上の帯に ● が出ることを見る
- 見送った「描く時間の終わりまぎわの線」は、子の描く人の端末で保存する 1 枚にだけ、最後の線の先が少し長く入ることがある
