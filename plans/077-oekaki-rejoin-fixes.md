# Plan 077: おえかきのもりで、つなぎ直しとみんなでぬりえの小さな食い違いを 4 つ直す

> **Executor instructions**: この計画を上から順に実行する。各ステップの確認コマンドを実行し、期待どおりの結果を
> 確かめてから次へ進む。「STOP 条件」のどれかに当たったら止めて報告する。終わったら `plans/README.md` の
> 自分の行の Status を更新する（レビュー担当に「索引は触らない」と言われたときは触らない）。
>
> **Drift check（最初に実行）**
> `git diff --stat ea56ff6..HEAD -- src/lib/games/oekaki-mori/OekakiMori.svelte src/lib/games/oekaki-mori/OekakiMori.svelte.test.ts src/lib/games/oekaki-mori/test/LobbyStub.svelte src/lib/games/oekaki-mori/test/lobby-hold.ts src/lib/games/oekaki-mori/Together.svelte src/lib/games/oekaki-mori/Together.svelte.test.ts src/lib/games/oekaki-mori/together.ts src/lib/games/oekaki-mori/together.test.ts`
> 何か出たら「Current state」の抜粋と今のコードを見比べ、食い違えば STOP。
> ただし plan 069（子から届いた線と塗りの形を確かめる）が先に入っていれば、次の差は想定どおりなので先へ進んでよい。
> `Together.svelte` の 18 行め（import）・`painted` の分岐（64〜69 行め）・`paintBy` を呼ぶ 111 行め、
> `together.ts` の import と `paintBy` の中の `dabs` の上限と新しい関数 `paintFrom` / `recolor`、
> `Together.svelte.test.ts` の塗りの番号と色（110 行めと 155 行め）。行番号はずれるので、下の抜粋は記号で探す。

## Status

| 項目       | 値                                                                                              |
| ---------- | ----------------------------------------------------------------------------------------------- |
| Priority   | P2                                                                                              |
| Effort     | S（4 つとも数行の直しと、落ちるテストを先に書く）                                               |
| Risk       | LOW（ルールの純粋な関数 1 つと、画面の 2 ファイル。`Party` と知らせの版は変えない）             |
| Depends on | none（plan 069 と同じファイルを触る。どちらが先でもよい。069 が先なら上の差を想定どおりとする） |
| Category   | bug                                                                                             |
| Planned at | commit `ea56ff6`, 2026-10-14                                                                    |

## Why this matters

おえかきのもりは 2〜3 台の iPad を QR でつなぎ、親の端末が審判になる。子のつながりが切れたら、子は「もういちど つなぐ」で
切れる前の番号（`was`）を `hello` で送り、親はその番号が空いていれば同じ番号で迎えて点数を引き継ぐ。みんなでぬりえ
（`Together.svelte`）では、戻った子に親が線画・塗った色・「できた！」を送り直す。この流れに 4 つの食い違いがある。

1. つなぎ直しが席をもらう前に切れると（親が QR を閉じた・迎えられなかった）、子は切れる前の番号を忘れ、`1` を覚えてしまう。
   子の `Party` の `me` は、親から `seat` が届くまで初めの値の `1` のままだから。2 人が同時に切れたときなど、次のつなぎ直しで
   前の番号に戻れず、点数と描く番を別の人のものと取り違える
2. 「できた！」のあとに切れて戻った子は、送り直された `finished` でもう一度ぬりえちょうに保存し、同じ絵が 2 枚並ぶ。
   保存のたびに新しい番号（`newId()`）を作るから
3. 親が戻った子に送る色は、親の画面の色（届いた順に 1 本の列で非同期に入る）で、親の塗り手順の色（`host.colors`）ではない。
   親の画面が線画を戻しているあいだに戻った子には、そのあいだの塗りが届かない
4. 「1つ もどす」が、ほかの人の塗りを消すことがある。A が赤、B が青、B がまた赤と同じ場所を塗ったあとで A が戻すと、
   B の最後の赤が消える。戻す判定が「いまの色が自分の塗った色と同じか」だけを見ているから

直したあとは、子は席をもらうまで前の番号を覚えたままにし、ぬりえちょうは線画ごとに 1 作品にまとめ、戻った子には親の手順の色を送り、
戻すのは「その場所のいちばん新しい塗りが自分のもので、いまもその色」のときだけにする。

## Current state

規約として、コメントは「コードから復元できない WHY」だけを日本語で書き、変更の経緯やチケット番号は書かない。
`.svelte` は 200 行未満（svelte-vitals `architecture/component-size` がファイル全体の行数を数える）。テストの名前は日本語の文にする。

### 1. 子が覚える切れる前の番号（`OekakiMori.svelte`）

`src/lib/games/oekaki-mori/OekakiMori.svelte`（163 行）。`joined` はつながるたびに `was` を消し（36 行め）、切れたときの
`$effect` は `party.me` を覚える（80 行め）。

```ts
// src/lib/games/oekaki-mori/OekakiMori.svelte:33-45
function joined(next: Party) {
  round.reset();
  note = '';
  was = undefined;
  party = next;
  next.onTell((m) => round.receive(m));
  ...
}
```

```ts
// src/lib/games/oekaki-mori/OekakiMori.svelte:76-84
// 親とのつながりが切れた子は、ロビーからつなぎ直す
$effect(() => {
  if (!party?.lost) return;
  // 版ちがいで切られた子は、同じ番号で戻っても遊べないので、もういちど つなぐ を出さない
  was = party.mismatch ? undefined : party.me;
  note = party.mismatch ? MISMATCH : 'つながりが きれました';
  party = null;
  round.screen = 'lobby';
});
```

子の `Party` は `me` を `1` で始め、親の `seat` が届いたときだけ変える（`src/lib/net/party.svelte.ts:31` と `:61`）。

```ts
  me = $state<Seat>(1);
  ...
      if (message.t === 'seat') party.me = message.seat as Seat;
```

ロビーは子の QR がつながった瞬間に `Party.guest` を作って `onparty` を呼ぶ（`src/lib/games/oekaki-mori/Lobby.svelte:46-48`）。
親が `seat` を送らずに閉じる道は、満員（`party.svelte.ts:83-85`）・空いた番号が無い（`:116-118`）・`hello` の前の切断。
親（番号 1）が `lost` になることはなく、子の番号は 2 か 3 なので、「切れたときの `me` が 1」は「席をもらっていない」と同じ意味になる。
`Party` を変える必要はない。`was` を読むのはロビーだけで、ロビーは `party` が無いときにしか読まない
（`Lobby.svelte:48` の `Party.guest(link, { was, look })` と `:70-76` の `retry`）。席をもらったあとも `was` が残っていても害はない。

テストの道具は `src/lib/games/oekaki-mori/test/LobbyStub.svelte` と `test/lobby-hold.ts`。今は `onparty` しか控えない。

```svelte
<!-- src/lib/games/oekaki-mori/test/LobbyStub.svelte:1-12 -->
<script lang="ts">
  import type { Party } from '$lib/net/party.svelte';
  import { lobby } from './lobby-hold';

  // 本物のロビーは QR の手順が要るので、つなぐ口だけをテストへ渡す
  let { onparty }: { onparty: (party: Party) => void } & Record<string, unknown> = $props();
  $effect.pre(() => {
    lobby.onparty = onparty;
  });
</script>
```

```ts
// src/lib/games/oekaki-mori/test/lobby-hold.ts:1-4
import type { Party } from '$lib/net/party.svelte';

/** LobbyStub が受け取った onparty。ロビーが画面から消えたあとも、テストから次の Party を渡せる */
export const lobby: { onparty?: (party: Party) => void } = {};
```

`.svelte.test.ts` の中では `$state` が使える（`src/lib/games/oekaki-mori/Invite.svelte.test.ts:13` が使っている）。
`lost` を `$state` にした偽の `Party` を渡せば、`OekakiMori` の `$effect` が動く。

### 2〜3. みんなでぬりえ（`Together.svelte`）

`src/lib/games/oekaki-mori/Together.svelte` は今 **199 行**で、上限まで余りが無い。

線画の知らせは親が `send` で作り、全員（親自身も）が `receive` で受ける（`Together.svelte:22-24`・`:33-47`・`:49-63`）。

```ts
  let sheet = $state.raw<{ art: Art; regions: Regions; mask: Uint8Array; template?: string } | null>(null);
  let colors = $state.raw<Record<number, string>>({});
  ...
  /** 配った線画の知らせ。戻った子には、配り終えるのを待ってから同じものを送る */
  let dealt: Promise<Message> | null = null;
  const catchUp = (seat: Seat) =>
    catchUpTogether(
      (m) => party.tell(seat, m),
      () => ({ dealt, colors, closed })
    );

  async function send(mask: Uint8Array, template?: Template) {
    // 配り終えるまでに別の絵を押されると 2 枚配られ、親の塗り手順と画面の色が食い違うので、すぐ待つ画面にする
    phase = 'wait';
    host = shared();
    dealt = encodeLines(mask).then((lines) => ({ t: 'art', template: template?.id ?? null, lines }));
    party.tell('all', await dealt);
  }

  async function receive(m: Message) {
    if (m.t === 'art') {
      const mask = await decodeLines(String(m.lines));
      const template = TEMPLATES.find((t) => t.id === m.template);
      // 場所は配られた線画で分ける。端末ごとにテンプレートを描き直すと、番号がずれることがある
      const art = template ? templateArt(template) : photoArt(mask);
      const regions = label(mask);
      sheet = {
        art,
        regions: art.kind === 'template' ? hideCovered(regions, art.cover) : regions,
        mask,
        template: template?.id
      };
      colors = {};
      phase = 'paint';
```

`finished` が届くたびに `finish()` が新しい番号で保存する（`Together.svelte:70` と `:73-85`）。

```ts
    else if (m.t === 'finished') finish();
  }

  function finish() {
    phase = 'done';
    sounds.done();
    const s = sheet;
    // 何も塗っていない絵は、ぬりえちょうに入れない（ひとりのぬりえと同じ）
    if (!s || !Object.keys(colors).length) return;
    const bits = pack(s.mask);
    const thumb = snapshot(s.art, s.regions, colors, 200, 'image/jpeg');
    const photo = s.template ? undefined : bits;
    const lines = s.template ? bits : undefined;
    const work = { id: newId(), template: s.template, photo, lines, colors, history: [], thumb };
    saveWork({ ...work, updated: Date.now() }).catch(() => {});
  }
```

保存は IndexedDB の `put`（keyPath は `id`）なので、同じ番号で 2 度保存すれば 1 作品のまま上書きされる
（`src/lib/coloring/book.ts:81-82` の `saveWork` が `s.put(work)`）。

戻った子へ送り直す中身は `src/lib/games/oekaki-mori/catch-up.ts:16-23`。`now()` は待ったあとで読む。

```ts
export async function catchUpTogether(tell: (m: Message) => void, now: () => Sheet): Promise<void> {
  const { dealt } = now();
  if (!dealt) return;
  tell(await dealt);
  const { colors, closed } = now();
  for (const [region, color] of Object.entries(colors)) tell({ t: 'painted', region: +region, color });
  if (closed) tell({ t: 'finished' });
}
```

親の画面の `colors` は、届いた知らせを 1 本の列（`queue`）で順に入れたもので、線画を戻す（非同期の `decodeLines`）あいだは
前のままになり、戻し終えると `colors = {}` で空になる（`Together.svelte:62`）。親の塗り手順の色は `host.colors`（`let host = shared();`、
27 行め。`send` で作り直す）で、`paintBy` がその場で書く。`host.colors` は親の画面の色を必ず含む。

「1つ もどす」のボタン（`Together.svelte:156-169`）は、中身が 1 行なのに 3 行で書いてある。

```svelte
    <Palette
      bind:color
      canUndo={true}
      onundo={() => {
        party.act({ t: 'unpaint' });
      }}
```

テストは `src/lib/games/oekaki-mori/Together.svelte.test.ts`。`soloHost()`（33-51 行め）は親 1 台だけの `Party` で、`tell` は
`sent` と `sentTo` に控えてから、宛先が `'all'` か `1` なら自分の聞き手に JSON を通して渡す。`join(seat)` で戻った子の
`join` を起こせる。`show(onagain)`（61-71 行め）が mount して `button(label)` を返す。`book.saveWork` は `vi.fn` に差し替えてある。
テンプレートの「りんご」の id は `'apple'`（`src/lib/coloring/templates.ts:27`）。テストの `templateArt` の偽物は全部 0 の線画を返すので、
場所は番号 0 の 1 つだけになる。塗る色はパレットの `'#f04438'`（`src/lib/coloring/Palette.svelte:3`）を使う（plan 069 が入っても通るように）。

### 4. 戻す判定（`together.ts`）

```ts
// src/lib/games/oekaki-mori/together.ts:32-44
/** 押した人の塗りを新しい順に見て、ほかの人が上から塗っていたら捨てて前を見る（押しても何も起きない、を減らす） */
export function undoBy(s: Shared, seat: Seat): Change | null {
  for (let i = s.dabs.length - 1; i >= 0; i--) {
    const dab = s.dabs[i];
    if (dab.seat !== seat) continue;
    s.dabs.splice(i, 1);
    if (s.colors[dab.region] !== dab.after) continue;
    if (dab.before === null) delete s.colors[dab.region];
    else s.colors[dab.region] = dab.before;
    return { region: dab.region, color: dab.before };
  }
  return null;
}
```

上から塗られた自分の塗りを捨てるのは意図した決まり（コメントと仕様「ほかの人が上から塗ったところは飛ばす」）なので残す。
直すのは「上から塗られたか」の見分け方だけ。色が同じかだけを見ると、別の人が同じ色で塗り直したときに見分けられない。
「同じ場所にあとから塗った手順が残っていない」ことも見る。色の確かめは消さない。A 赤・B 青・A 緑のあと B が戻す（B の青は
上から塗られているので捨てる）、A が戻す（緑 → 青）、A がもう一度戻すと、A の赤はその場所のいちばん新しい手順だが、
見えているのは青なので、色の確かめが無いと青を白に消してしまう。

## Commands you will need

| Purpose       | Command                                                                                                                                                                 | Expected on success           |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| 足すテスト    | `pnpm exec vitest run src/lib/games/oekaki-mori/OekakiMori.svelte.test.ts src/lib/games/oekaki-mori/Together.svelte.test.ts src/lib/games/oekaki-mori/together.test.ts` | すべて pass                   |
| 行数          | `wc -l < src/lib/games/oekaki-mori/Together.svelte`                                                                                                                     | 199 以下                      |
| 全テスト      | `pnpm test:run`                                                                                                                                                         | exit 0                        |
| 型            | `pnpm check`                                                                                                                                                            | `0 ERRORS 0 WARNINGS`、exit 0 |
| lint          | `pnpm lint`                                                                                                                                                             | exit 0                        |
| svelte-vitals | `pnpm vitals --diff`                                                                                                                                                    | 警告 0                        |
| 全部          | `pnpm verify`                                                                                                                                                           | exit 0                        |

## Scope

**In scope**

- `src/lib/games/oekaki-mori/OekakiMori.svelte`
- `src/lib/games/oekaki-mori/OekakiMori.svelte.test.ts`（テストを足す）
- `src/lib/games/oekaki-mori/test/LobbyStub.svelte` と `src/lib/games/oekaki-mori/test/lobby-hold.ts`（`was` も控える）
- `src/lib/games/oekaki-mori/Together.svelte`
- `src/lib/games/oekaki-mori/Together.svelte.test.ts`（テストを足し、`show` に `party` の引数を足す）
- `src/lib/games/oekaki-mori/together.ts`（`undoBy` だけ）
- `src/lib/games/oekaki-mori/together.test.ts`（テストを足す）
- `plans/README.md`（自分の行の Status だけ）

**Out of scope**

- `src/lib/net/party.svelte.ts` — 席をもらったかは `me === 1` で分かるので、`seated` の旗は足さない。plan 067 がこのファイルを直す
- `src/lib/games/oekaki-mori/catch-up.ts` — 送り直す手順は正しい。渡す色を変えるのは呼ぶ側（`Together.svelte`）
- `src/lib/games/oekaki-mori/Lobby.svelte` — `was` の受け方は正しい
- `PROTOCOL` を上げること — 線画の知らせに `id` を足すだけで、古い子は読み飛ばし、古い親からの知らせには新しい子が番号を作る
- 子どうしの塗りの順番や、`undoBy` の「上から塗られた自分の塗りを捨てる」決まりを変えること
- `src/lib/games/oekaki-mori/CLAUDE.md` — 書いてある決まり（「親の「できた！」で全員のぬりえちょうに入る」「戻すのは押した人の塗りだけ」）は変わらない

## Git workflow

- ブランチは `advisor/077-oekaki-rejoin-fixes`
- ブランチを作る前に `git rev-parse HEAD` を控える（以下 `BASE`。Done criteria で、このブランチの変更だけを見るのに使う）
- 直し 1 つごとに 1 コミット（4 つ）。英語の命令形 1 文で、Co-Authored-By などの trailer は付けない。例は Steps に書く
- push しない（`main` への push は本番に出る）

## Steps

### Step 1: 席をもらう前に切れたつなぎ直しで、前の番号を忘れない

1. `test/lobby-hold.ts` の型に `was?: Seat` を足す（`import type { Party, Seat } from '$lib/net/party.svelte';`）。
   コメントは「LobbyStub が受け取った onparty と was。…」にする。
2. `test/LobbyStub.svelte` の `$props()` で `was` も受け、`$effect.pre` で `lobby.was = was;` も書く。型は
   `{ onparty: (party: Party) => void; was?: Seat } & Record<string, unknown>`。
3. `OekakiMori.svelte.test.ts` の import を `import type { Party, Seat } from '$lib/net/party.svelte';` にし、`guest()` の下に
   次の道具を足す。

   ```ts
   /** 切れたことをテストから起こせる子の Party。me は親から seat が届くまで 1 */
   function linked(me: Seat) {
     const party = $state({
       host: false,
       me,
       members: [1, me],
       lost: false,
       mismatch: false,
       away: [] as Seat[],
       looks: {},
       onTell: () => () => {},
       onAct: () => () => {},
       act: () => {},
       close: () => {}
     });
     return party;
   }
   ```

   `$state` は変数の宣言にしか書けないので、いったん `party` に入れてから返す。

4. `describe('OekakiMori')` の最後に次のテストを足す。

   ```ts
   // 子の me は seat が届くまで 1 のまま。それを覚えると、次のつなぎ直しで前の番号に戻れない
   it('席をもらう前に切れたつなぎ直しでは、切れる前の番号を覚えたままにする', () => {
     const { app } = show();
     const seated = linked(2);
     lobby.onparty!(seated as unknown as Party);
     flushSync();
     seated.lost = true;
     flushSync();
     expect(lobby.was).toBe(2);
     const refused = linked(1);
     lobby.onparty!(refused as unknown as Party);
     flushSync();
     refused.lost = true;
     flushSync();
     expect(lobby.was).toBe(2);
     unmount(app);
   });
   ```

**Verify**: `pnpm exec vitest run src/lib/games/oekaki-mori/OekakiMori.svelte.test.ts` → 足したテストだけが
`expected 1 to be 2` で FAIL、ほかは pass。1 つめの `expect` で落ちたら道具の作りが違うので STOP。

5. `OekakiMori.svelte` を直す。`joined` から `was = undefined;` の行を消す。`$effect` の `was = …` を次の 2 行にする
   （コメントは既存の版ちがいの 1 行のあとに足す）。

   ```ts
   // 版ちがいで切られた子は、同じ番号で戻っても遊べないので、もういちど つなぐ を出さない
   // me が 1 のままなら席をもらう前に切れたので、前の番号を覚えたままにする（子の番号は 2 か 3）
   was = party.mismatch ? undefined : party.me === 1 ? was : party.me;
   ```

この `$effect` は `was` を読んで書くので、書いたあとにもう一度走るが、そのときは `party` がもう `null` で最初の行で戻る。
繰り返し走ることはないので、`untrack` で包まない。

**Verify**: `pnpm exec vitest run src/lib/games/oekaki-mori/OekakiMori.svelte.test.ts` → すべて pass。
`grep -c "was = undefined" src/lib/games/oekaki-mori/OekakiMori.svelte` → `0`。

コミットする。`Keep the previous seat when a rejoin attempt drops before the host seats the guest`

### Step 2: 戻すとき、ほかの人があとから同じ場所を塗っていれば消さない

`together.test.ts` の `describe('undoBy')` の最後に 2 つ足す。

```ts
// 色が同じかだけを見ると、ほかの人が同じ色で塗り直したところを自分の塗りと見分けられない
it('ほかの人が上から同じ色で塗り直していたら、その塗りを消さない', () => {
  const s = shared();
  paintBy(s, 2, 1, '#f00');
  paintBy(s, 3, 1, '#00f');
  paintBy(s, 3, 1, '#f00');
  expect(undoBy(s, 2)).toBeNull();
  expect(s.colors).toEqual({ 1: '#f00' });
  expect(undoBy(s, 3)).toEqual({ region: 1, color: '#00f' });
});

it('その場所のいちばん新しい自分の塗りでも、いまの色がちがえば戻さない', () => {
  const s = shared();
  paintBy(s, 2, 1, '#f00');
  paintBy(s, 3, 1, '#00f');
  paintBy(s, 2, 1, '#0f0');
  expect(undoBy(s, 3)).toBeNull();
  expect(undoBy(s, 2)).toEqual({ region: 1, color: '#00f' });
  expect(undoBy(s, 2)).toBeNull();
  expect(s.colors).toEqual({ 1: '#00f' });
});
```

**Verify**: `pnpm exec vitest run src/lib/games/oekaki-mori/together.test.ts` → 1 つめだけ FAIL（`undoBy(s, 2)` が
`{ region: 1, color: null }` を返す）。2 つめは直す前から pass する（色の確かめを消さないための見張り）。

`together.ts` の `undoBy` の色の確かめの行を次の 2 行にする。

```ts
// 同じ場所にあとから塗った手順が残っていれば、見えているのはその塗り。色が同じでも、戻すとその人の塗りを消してしまう
if (s.colors[dab.region] !== dab.after || s.dabs.slice(i).some((d) => d.region === dab.region)) continue;
```

`splice(i, 1)` のあとなので、`slice(i)` はこの手順より新しい手順だけになる。

**Verify**: `pnpm exec vitest run src/lib/games/oekaki-mori/together.test.ts` → すべて pass（もとからある 4 つを含む）。

コミットする。`Leave another player's later dab alone when undoing in shared coloring`

### Step 3: 戻った子へ、親の塗り手順の色を送る

`Together.svelte.test.ts` の `show` に 2 つめの引数を足す。`function show(onagain = () => {}, party = soloHost()) {` にして、
中の `const party = soloHost();` の行を消す。そして `describe('Together')` の最後に次のテストを足す。

```ts
// 親の画面の色は、線画を戻し終えるまで空のまま。その色を送ると、そのあいだに塗られた色が戻った子に届かない
it('親の画面が線画を戻すあいだに戻った子にも、そのあいだの塗りを送る', async () => {
  const party = soloHost() as unknown as {
    tell: (to: unknown, m: Message) => void;
    act: (m: Message) => void;
    join: (seat: Seat) => void;
  };
  const tell = party.tell;
  let first = true;
  party.tell = (to, m) => {
    tell(to, m);
    if (m.t !== 'art' || !first) return;
    first = false;
    party.act({ t: 'paint', region: 0, color: '#f04438' });
    party.join(2);
  };
  const { app, button } = show(undefined, party as unknown as Party);
  button('りんご')!.click();
  await settle();
  expect(sentTo.filter(([to]) => to === 2).map(([, m]) => m.t)).toEqual(['art', 'painted']);
  unmount(app);
});
```

線画を全員へ配った直後（親の画面はまだ線画を戻していない）に、塗りと戻った子を同じ流れの中で起こす。`painted` の全員への
知らせは宛先が `'all'` なので、`to === 2` で数えるのは送り直しだけ。

**Verify**: `pnpm exec vitest run src/lib/games/oekaki-mori/Together.svelte.test.ts` → 足したテストだけが `['art']` を受けて FAIL。

`Together.svelte` の `catchUp` の中の `() => ({ dealt, colors, closed })` を `() => ({ dealt, colors: host.colors, closed })` にする。
`host` は `send` で作り直す `let` だが、`now()` は呼ばれたときに読むので、いまの線画の手順を読む。

**Verify**: `pnpm exec vitest run src/lib/games/oekaki-mori/Together.svelte.test.ts` → すべて pass（「戻った子に、いまの線画と
塗った色を送り、…」と「配り終える前に戻った子にも、…」を含む）。

コミットする。`Send the host's own coloring steps to a guest who rejoins shared coloring`

### Step 4: 同じ線画の「できた！」は、ぬりえちょうの同じ作品に入れる

`Together.svelte.test.ts` の import に `import { encodeLines } from '$lib/coloring/wire';` を足し、`describe('Together')` の最後に
2 つ足す。

```ts
// 戻った子には「できた！」も送り直すので、そのたびに新しい作品にすると、ぬりえちょうに同じ絵が並ぶ
it('同じ線画の できた！ が 2 度届いても、ぬりえちょうの同じ作品に入れる', async () => {
  const { app, party } = show();
  const lines = await encodeLines(new Uint8Array(SIZE * SIZE));
  for (let i = 0; i < 2; i++) {
    party.tell('all', { t: 'art', template: 'apple', lines, id: 'sheet-1' });
    party.tell('all', { t: 'painted', region: 0, color: '#f04438' });
    party.tell('all', { t: 'finished' });
    await settle();
  }
  const ids = (book.saveWork.mock.calls as unknown as [{ id: string }][]).map(([w]) => w.id);
  expect(ids).toEqual(['sheet-1', 'sheet-1']);
  unmount(app);
});

it('親は、配った線画の知らせと同じ番号で作品を入れる', async () => {
  const { app, button, party } = show();
  button('りんご')!.click();
  await settle();
  party.act({ t: 'paint', region: 0, color: '#f04438' });
  await settle();
  button('できた！')!.click();
  await settle();
  const art = sent.find((m) => m.t === 'art')!;
  expect(typeof art.id).toBe('string');
  expect((book.saveWork.mock.calls as unknown as [{ id: string }][])[0][0].id).toBe(art.id);
  unmount(app);
});
```

**Verify**: `pnpm exec vitest run src/lib/games/oekaki-mori/Together.svelte.test.ts` → 足した 2 つが FAIL（1 つめは番号が
2 つとも別の値、2 つめは `art.id` が `undefined`）。

`Together.svelte` を次のように直す。行は 1 つ増えて 2 つ減り、198 行になる。

1. 23 行めの `sheet` の型に `id: string` を足す。
   `let sheet = $state.raw<{ art: Art; regions: Regions; mask: Uint8Array; template?: string; id: string } | null>(null);`
   （119 字で 120 字に収まる。`id?: string` にすると 120 字を超え、prettier が型を数行に広げるので、必ず省略しない形にする）
2. `dealt` の JSDoc（33 行め）を
   `/** 配った線画の知らせ。戻った子には、配り終えるのを待ってから同じものを送る（番号つきなので、送り直した「できた！」も同じ作品に入る） */`
   にする。
3. `send` の `dealt = …` の行の知らせに `id: newId()` を足す。
   `dealt = encodeLines(mask).then((lines) => ({ t: 'art', template: template?.id ?? null, lines, id: newId() }));`
4. `receive` の `sheet = { … }` の `template: template?.id` の行を `template: template?.id,` にし、その下に
   `id: typeof m.id === 'string' ? m.id : newId()` を足す（古い版の親は番号を送らないので、そのときは自分で作る）。
5. `finish` の `const work = { id: newId(), …` を `const work = { id: s.id, …` にする。
6. `Palette` の `onundo` の 3 行を `onundo={() => party.act({ t: 'unpaint' })}` の 1 行にする。

**Verify**: `pnpm exec prettier --write src/lib/games/oekaki-mori/Together.svelte` のあと
`wc -l < src/lib/games/oekaki-mori/Together.svelte` → 199 以下（069 が先に入っていなければ 198）。
`pnpm exec vitest run src/lib/games/oekaki-mori/Together.svelte.test.ts` → すべて pass。

コミットする。`Save a shared coloring sheet under one id so a resent finish does not duplicate it`

### Step 5: 全体を通す

**Verify**: `pnpm verify` → exit 0（lint・check の `0 ERRORS 0 WARNINGS`・全テスト・vitals・build）。

## Test plan

- `OekakiMori.svelte.test.ts` に 1 つ（席をもらったつなぎ直しは番号を覚え、席をもらう前に切れたつなぎ直しはそれを上書きしない）
- `together.test.ts` に 2 つ（同じ色で塗り直したほかの人の塗りを消さない、色がちがえば戻さないの見張り）
- `Together.svelte.test.ts` に 3 つ（線画を戻すあいだに戻った子へ塗りを送る、同じ線画の「できた！」は同じ番号、親の番号は配った知らせと同じ）
- 形は同じファイルの既存のテストにならう（`Together.svelte.test.ts` の「戻った子に、いまの線画と塗った色を送り、…」、
  `OekakiMori.svelte.test.ts` の「つなぎ直したら、…」）
- 確かめは `pnpm exec vitest run src/lib/games/oekaki-mori/` → すべて pass（新しい 6 つを含む）

## Done criteria

- [ ] `pnpm verify` が exit 0
- [ ] 新しいテスト 6 つがあり pass する（上の Test plan のとおり）
- [ ] `wc -l < src/lib/games/oekaki-mori/Together.svelte` が 199 以下
- [ ] `grep -c "was = undefined" src/lib/games/oekaki-mori/OekakiMori.svelte` が `0`
- [ ] `grep -c "colors: host.colors" src/lib/games/oekaki-mori/Together.svelte` が `1`
- [ ] `grep -c "lines, id: newId()" src/lib/games/oekaki-mori/Together.svelte` が `1`、`grep -c "id: s.id" src/lib/games/oekaki-mori/Together.svelte` が `1`
- [ ] `git diff --stat BASE..HEAD -- src/lib/net/` が空（`Party` を変えていない。`BASE` は Git workflow で控えた値）
- [ ] `git status` で In scope の外のファイルが変わっていない
- [ ] コミットが 4 つ（直し 1 つに 1 つ）

## STOP 条件

- 「Current state」の抜粋が今のコードと違う（plan 069 による想定どおりの差は除く）
- Step 1 の足したテストが直す前から pass する、または 1 つめの `expect(lobby.was).toBe(2)` で落ちる（偽の `Party` の作りが
  `$effect` を動かしていない。道具を工夫して通そうとせず報告する）
- Step 3 の足したテストが直す前から pass する（線画を戻すのが同期になっていて、窓が無い。テストを変えず報告する）
- `Together.svelte` が prettier のあとで 199 行を超える（行を詰めるために中身を変えない。報告する）
- 直すために `src/lib/net/` のファイルや `catch-up.ts` を変える必要が出てくる
- 確かめのコマンドが、手直しを 2 回しても通らない

## Maintenance notes

- 子が `Party` の `me` を 1 以外で始めるように変えたら、`OekakiMori.svelte` の「`me === 1` なら席をもらっていない」が成り立たなくなる。
  そのときは `Party` に席をもらったかの旗を足す
- みんなでぬりえの作品の番号は、親が線画を配るたびに作る。同じ絵を 2 回配れば別の作品になる（意図どおり）。
  線画を配り直す機能を足すときは、同じ番号を使い回すかを決める
- レビューでは、`undoBy` の 2 つの条件（色が同じ・あとから同じ場所の手順が無い）がどちらも残っていることを見る
- 子が途中から来た（席をもらって初めて切れた）ときに `was` が残るのは、ロビーの「もういちど つなぐ」を出すため。
  `was` を消すのは、版ちがいで切られたときだけ
