# Plan 050: リポジトリ直下の CLAUDE.md からゲームごとの長い段落を各ゲームのフォルダへ分ける

> **Executor instructions**: この計画を上から順に実行する。各ステップの確認コマンドを実行し、期待どおりの結果を
> 確かめてから次へ進む。「STOP 条件」のどれかに当たったら止めて報告する。終わったら `plans/README.md` の
> 自分の行の Status を更新する（レビュー担当に「索引は触らない」と言われたときは触らない）。
>
> **Drift check（最初に実行）**
> `CLAUDE.md` は毎日のように変わるので `git diff` ではなく、この計画が頼る文を grep で確かめる。次の 3 つを実行する。
>
> 1. `ls src/lib/games/*/CLAUDE.md` は「no matches found」か「No such file」で、1 つも出ない
> 2. `grep -c 'ランタイム依存は three（雪原サバイバル・わんにゃんハウスの 3D 表示が使い、そのゲームを遊ぶときに読み込む）と onnxruntime-web' CLAUDE.md` は `1`
> 3. ``grep -c '1 曲を繰り返し流す `loop.ts` の `Loop`。ピコピコ音の楽器' CLAUDE.md`` は `1`
>
> 食い違えば STOP。

## Status

| 項目       | 値                                                                                  |
| ---------- | ----------------------------------------------------------------------------------- |
| Priority   | P2                                                                                  |
| Effort     | M                                                                                   |
| Risk       | LOW（文書だけを動かす。コードは触らない。消えた文が無いことをスクリプトで確かめる） |
| Depends on | none                                                                                |
| Category   | docs / dx                                                                           |
| Planned at | commit `36cc037`, 2026-10-14                                                        |

## Why this matters

リポジトリ直下の `CLAUDE.md` は約 131KB（83 行）あり、エージェントのどのセッションでも最初に丸ごと読み込まれる。
そのうち約 114KB は 7 本のゲームの段落で、1 本 1 行の長い段落になっている（アニマルサバイバーは 1 行で約 56KB、
やっぱりカメレオンは約 36KB）。ほかのゲームや共通部品を直すセッションでも、毎回これを読む。

Claude Code は、サブディレクトリにある `CLAUDE.md` を、そのディレクトリのファイルを読んだときに読み込む（この計画はこの
前提に立つ。実行する側では確かめられない）。そこで 7 本のゲームの段落を `src/lib/games/<id>/CLAUDE.md` へ中身を変えずに
移し、直下には共通の部分と短い索引だけを残す。直下は約 18KB になる。

移すついでに、今のコードと合わない 2 か所を直す。

1. 概要の「ランタイム依存」の文が、依存の `jsqr` と `uqr`（QR でつなぐ手順）を書いておらず、three を使うゲームも
   雪原サバイバルとわんにゃんハウスだけと書いている（やっぱりカメレオンとアニマルサバイバーのガチャも使う）
2. わんにゃんハウスの BGM の文が、BGM を共通の `src/lib/music/`（`loop.ts` の `Loop` を含む）で鳴らすと読める。実際は
   `pet-house/bgm.ts` が自分の `Bgm` を持ち、`tune.ts` と `synth.ts` だけを使う。この文の中の `src/lib/music/` の説明は
   ゲームをまたぐので、直下の共通の部分へ移す

## Current state

### 直下の `CLAUDE.md` の形

`git show 36cc037:CLAUDE.md` の行の並びは次のとおりで、行番号は 36cc037 のもの。

- 1〜23 行は見出し・概要（7 行）・コマンド
- 25 行の `## 構成` のあと、27〜39 行が共通の段落（27 ルーティングと保存、29 シェル、31 200 行の決まり、33 border-rush、
  35 盤面の指と `Pips`、37 canvas とアイコン、39 bomb-relay と hockey）
- 41〜53 行の奇数行が、移す 7 本の段落（41 わんにゃんハウス、43 らくがきパレード、45 ぬりえ、47 おえかきのもり、
  49 ひらめきナゾ、51 アニマルサバイバー、53 やっぱりカメレオン）。どれも `<ゲーム名>（`<id>`）` で始まり、次の行は空行
- 55 行から `## 見た目`・`## 横向き`・`## 更新`・`## 入力`・`## 規約`

border-rush（33 行）と bomb-relay・hockey（39 行）の段落は 1KB 未満で、29 行が hockey の `engine.ts` を型として
挙げているので、直下に残す。

段落の中の `。` は、全角の丸かっこ（`（` と `）`）の中にもある。たとえば 41 行の BGM の文は「…`loop.ts` の `Loop`。ピコピコ音の
楽器 … が使う）で鳴らし、…」で、かっこの中に `。` がある。だから行を分けるのは、かっこの外の `。` のところだけにする
（Step 2 のスクリプトがそうする）。36cc037 の時点で、どの行も `（` と `）` の数がそろっている。

### 直す 1 つめ（概要の依存の文）

`CLAUDE.md:7` の中の文で、今は次のようになっている。

```text
ランタイム依存は three（雪原サバイバル・わんにゃんハウスの 3D 表示が使い、そのゲームを遊ぶときに読み込む）と onnxruntime-web（ぬりえの「AI で せんを かく」が Web Worker の中で使い、押したときに読み込む）で、効果音は Web Audio のオシレータ合成、アプリのアイコンは `scripts/make-icon.ts` がロゴ（`Logo.svelte`）を端末の Chrome で撮って作る。
```

実際の依存は `package.json:58-63` にある。

```json
  "dependencies": {
    "jsqr": "catalog:",
    "onnxruntime-web": "catalog:",
    "three": "catalog:",
    "uqr": "catalog:"
  }
```

`jsqr` は `src/lib/net/camera.ts:1`（`import jsQR from 'jsqr';`）、`uqr` は `src/lib/net/Qr.svelte:2`
（`import { encode } from 'uqr';`）が使う。three は `snow-camp`・`pet-house`・`yappari-chameleon` の各ファイルと、
`src/lib/games/animal-survivors/gacha3d.ts:1`（`import * as THREE from 'three';`）が使う。ガチャの 3D は開くときに読み込む
（`src/lib/games/animal-survivors/Gacha3D.svelte:22` の `new (await import('./gacha3d')).GachaScene(c)`）。

### 直す 2 つめ（わんにゃんハウスの BGM の文）

`CLAUDE.md:41` の中の文で、今は次のようになっている。

```text
BGM は `bgm.ts`（曲は `songs.ts`）が場面ごとのループを、共通の `src/lib/music/`（楽譜を楽器の音で先読みして鳴らす `tune.ts`、楽器の `instruments.ts`、波形の部品と出口の `synth.ts`、1 曲を繰り返し流す `loop.ts` の `Loop`。ピコピコ音の楽器 `pulse`・`tri`・`kick`・`hat` と 8 ビートの伴奏 `drive` は アニマルサバイバー が使う）で鳴らし、鳴き声は `cries.ts` がフォルマントで種類ごとに合成する。
```

`src/lib/games/pet-house/bgm.ts:1-5` の import は次の 5 つで、`loop.ts` も `instruments.ts` も読んでいない。

```ts
import { bus } from '$lib/audio.svelte';
import { AHEAD, FADE, playStep, ramp, scoreOf } from '$lib/music/tune';
import { bgmOut } from '$lib/music/synth';
import { SONGS, type SongId } from './songs';
import type { Scene } from './types';
```

`bgm.ts:47` が `export class Bgm {`、`bgm.ts:73` が `tick(): void {` で、`bgm.ts:9` のコメントのとおり
「Session が毎フレーム tick() を呼び、AudioContext の時計で AHEAD 秒先までの音を予約する」。

`src/lib/music/loop.ts` の `Loop` を読むのは `src/lib/games/animal-survivors/Survivors.svelte:5` と
`src/lib/games/yappari-chameleon/Online.svelte:4` だけ。8 ビートの伴奏 `drive` はアニマルサバイバーの曲のほかに
`src/lib/games/yappari-chameleon/songs.ts:39`（`style: 'drive',`）も使うので、直下へ移す文では「アニマルサバイバー が使う」を
「ここにある」に変える。

### 規約

- 利用者の決まりで、docs には今の仕様だけを書く（経緯・変更履歴・issue の番号は書かない）
- `pnpm lint` は `prettier --check .` を含み、`.md` も検査する（`.prettierrc` は `printWidth: 120`、`proseWrap` は既定の
  `preserve` なので長い行は折り返さない）。`.prettierignore` に `CLAUDE.md` は入っていない
- svelte-vitals の名前の決まりはディレクトリ名だけ（`svelte-vitals.config.ts` の `architecture/directory-naming`）なので、
  `CLAUDE.md` というファイル名は引っかからない
- `CLAUDE.md` を読むテストやビルドは無い（`grep -rln "CLAUDE.md" src scripts` は何も返さない）

## Commands you will need

| Purpose      | Command                                                                                             | Expected on success |
| ------------ | --------------------------------------------------------------------------------------------------- | ------------------- |
| 整形         | `pnpm exec prettier --write CLAUDE.md src/lib/games/*/CLAUDE.md`                                    | exit 0              |
| 整形の確かめ | `pnpm exec prettier --check CLAUDE.md src/lib/games/*/CLAUDE.md`                                    | exit 0              |
| textlint     | `~/.claude/textlint/node_modules/.bin/textlint --config ~/.claude/textlint/.textlintrc.json <file>` | Step 6 を見る       |
| lint         | `pnpm lint`                                                                                         | exit 0              |
| 全部         | `pnpm verify`                                                                                       | exit 0              |

`pnpm format` は木全体を整形するので使わない。

## Scope

**In scope**

- `CLAUDE.md`（7 本の段落を抜き、2 か所を直し、`src/lib/music/` の段落と索引を足す）
- `src/lib/games/pet-house/CLAUDE.md`（作る）
- `src/lib/games/doodle-worm/CLAUDE.md`（作る）
- `src/lib/games/nurie/CLAUDE.md`（作る）
- `src/lib/games/oekaki-mori/CLAUDE.md`（作る）
- `src/lib/games/hirameki/CLAUDE.md`（作る）
- `src/lib/games/animal-survivors/CLAUDE.md`（作る）
- `src/lib/games/yappari-chameleon/CLAUDE.md`（作る）
- `plans/README.md`（自分の行の Status だけ）

**Out of scope**

- コードのすべて（`.ts`・`.svelte`・設定）。文書と合わないところを見つけても直さず、報告に書く
- 移す段落の言い回しを直すこと。直すのは上の 2 か所だけで、ほかは句点の位置で行を分けるだけにする
- 直下に残す border-rush・bomb-relay・hockey の段落を分けること
- `plans/` のほかのファイル、`docs/superpowers/` の仕様書
- アニマルサバイバーの約 56KB をさらに小さなファイルへ分けること

## Git workflow

- ブランチは `advisor/050-split-claude-md-per-game`
- コミットは 1 つでよい。英語の命令形 1 文で、署名などの行は付けない（例 `Move per-game notes from the root CLAUDE.md into each game folder`）
- push しない（`main` への push は本番へ配信される）

## Steps

### Step 1: 今の `CLAUDE.md` を控える

あとで消えた文が無いかを比べるため、手を入れる前の `CLAUDE.md` をリポジトリの外へ写す。

```bash
cp CLAUDE.md "${TMPDIR:-/tmp}/claude-before.md"
```

**Verify**: `cmp CLAUDE.md "${TMPDIR:-/tmp}/claude-before.md" && echo same` → `same`

### Step 2: 7 本の段落をスクリプトで各ゲームのフォルダへ移す

手で切り貼りすると長い段落で文を落としやすいので、リポジトリの直下で次のスクリプトをそのまま実行する。段落を
かっこの外の `。` ごとに 1 行へ分け、`# <ゲーム名>` の見出しを付けて `src/lib/games/<id>/CLAUDE.md` に書き、直下からは
その段落と後ろの空行を消す。始まりの文字が見つからないか、後ろが空行でなければ、何も書かずに止まる。

```bash
node -e '
const fs=require("fs");
const G=[["pet-house","わんにゃんハウス"],["doodle-worm","らくがきパレード"],["nurie","ぬりえ"],["oekaki-mori","おえかきのもり"],["hirameki","ひらめきナゾ"],["animal-survivors","アニマルサバイバー"],["yappari-chameleon","やっぱりカメレオン"]];
const lines=fs.readFileSync("CLAUDE.md","utf8").split("\n");
const sentences=p=>{const out=[];let d=0,cur="";for(const ch of p){cur+=ch;if(ch==="（")d++;else if(ch==="）")d--;else if(ch==="。"&&d===0){out.push(cur.trim());cur=""}}if(cur.trim())out.push(cur.trim());return out};
const files={};
for(const [id,name] of G){const i=lines.findIndex(l=>l.startsWith(name+"（`"+id+"`）"));if(i<0||lines[i+1]!=="")throw new Error("not found: "+id);files[id]="# "+name+"\n\n"+sentences(lines[i]).join("\n")+"\n";lines.splice(i,2);}
for(const [id,text] of Object.entries(files))fs.writeFileSync("src/lib/games/"+id+"/CLAUDE.md",text);
fs.writeFileSync("CLAUDE.md",lines.join("\n"));
console.log("moved",Object.keys(files).length);
'
```

**Verify**

- 出力が `moved 7`
- `ls src/lib/games/*/CLAUDE.md | wc -l` → `7`
- ``grep -c '（`animal-survivors`）は' CLAUDE.md`` → `0`（数が 0 のとき grep は exit 1 を返すが、出た数が期待どおりなら成功。
  この計画の `→ 0` の確かめはどれも同じ）
- `head -3 src/lib/games/yappari-chameleon/CLAUDE.md` → 1 行目が `# やっぱりカメレオン`、2 行目が空、3 行目が
  「やっぱりカメレオン（`yappari-chameleon`）は、Steam の『めっちゃカメレオン』に寄せたかくれんぼで、…」

スクリプトが `not found: <id>` で止まったら STOP（段落の始まりが変わっている）。

できたファイルは 1 文 1 行で、空行は無い。読みやすくするため、話題が変わる文の前に空行を入れてもよい（Step 7 の確かめは
空行を数えない）。文の途中で行を分けること、文を並べ替えること、見出しや文を足すことはしない。

### Step 3: 概要の依存の文を直す

`CLAUDE.md` の概要の段落で、次の文字列を置き換える（Edit で完全一致で置き換える）。

置き換える前の文字列（1 つめ）は次のとおり。

```text
ランタイム依存は three（雪原サバイバル・わんにゃんハウスの 3D 表示が使い、そのゲームを遊ぶときに読み込む）と onnxruntime-web（ぬりえの「AI で せんを かく」が Web Worker の中で使い、押したときに読み込む）で、
```

置き換えた後の文字列は次のとおり。

```text
ランタイム依存は three（雪原サバイバル・わんにゃんハウス・やっぱりカメレオンの 3D 表示と、アニマルサバイバーのガチャの 3D の演出が使い、そのゲームや演出を開くときに読み込む）と onnxruntime-web（ぬりえの「AI で せんを かく」が Web Worker の中で使い、押したときに読み込む）と jsqr・uqr（端末どうしを QR でつなぐ手順で、`src/lib/net/camera.ts` が QR を読み取り、`src/lib/net/Qr.svelte` が QR を描く）で、
```

文の残り（「効果音は Web Audio のオシレータ合成、…撮って作る。」）は変えない。

**Verify**

- `grep -c 'jsqr・uqr（端末どうしを QR でつなぐ手順で' CLAUDE.md` → `1`
- `grep -c '雪原サバイバル・わんにゃんハウスの 3D 表示が使い' CLAUDE.md` → `0`

### Step 4: わんにゃんハウスの BGM の文を直し、`src/lib/music/` の説明を直下へ移す

`src/lib/games/pet-house/CLAUDE.md` では、Step 2 のスクリプトがこの文を 1 行にしている。その 1 行を丸ごと置き換える。

置き換える前の行は「Current state」の「直す 2 つめ」の文と同じ。置き換えた後の行は次のとおり。

```text
BGM は `bgm.ts` の `Bgm`（曲は `songs.ts`）が場面ごとのループを毎フレームの `tick()` で先の拍まで予約し、共通の `src/lib/music/` の `tune.ts`（`playStep`）と `synth.ts`（出口の `bgmOut`）で鳴らし、鳴き声は `cries.ts` がフォルマントで種類ごとに合成する。
```

次の行の「どちらも `$lib/audio.svelte` の `bus()`（wake 前・ミュート中は無い）から出す。」はそのまま残す（`Bgm` の
`constructor` の既定が `bus`、`bgm.ts:54`）。

続けて、直下の `CLAUDE.md` の `## 構成` で、「得点の丸表示は `src/lib/components/Pips.svelte`。」で終わる段落のあとに、
空行をはさんで次の段落を 1 つ足す。

```text
BGM の部品は共通の `src/lib/music/` にある。楽譜を楽器の音で先読みして鳴らす `tune.ts`、楽器の `instruments.ts`、波形の部品と出口の `synth.ts`、1 曲を繰り返し流す `loop.ts` の `Loop`（アニマルサバイバーとやっぱりカメレオンの BGM が使う）があり、ピコピコ音の楽器 `pulse`・`tri`・`kick`・`hat` と 8 ビートの伴奏 `drive` もここにある。
```

**Verify**

- ``grep -rc '1 曲を繰り返し流す `loop.ts` の `Loop`。ピコピコ' CLAUDE.md src/lib/games/pet-house/CLAUDE.md`` → どちらも `0`
- ``grep -c 'BGM は `bgm.ts` の `Bgm`' src/lib/games/pet-house/CLAUDE.md`` → `1`
- ``grep -c 'BGM の部品は共通の `src/lib/music/` にある' CLAUDE.md`` → `1`

### Step 5: 直下に索引を足す

直下の `CLAUDE.md` で、`## 構成` の最後の段落（「bomb-relay と hockey は物理があるので…」で始まる段落）と `## 見た目` の
あいだに、次の節を足す。前後は空行 1 つずつにする。

```markdown
## ゲームごとの説明

次のゲームは、仕様をそのゲームのフォルダの `CLAUDE.md` に書いてある（そのフォルダのファイルを読むと Claude Code が読み込む）。

- わんにゃんハウス（`pet-house`）は `src/lib/games/pet-house/CLAUDE.md`
- らくがきパレード（`doodle-worm`）は `src/lib/games/doodle-worm/CLAUDE.md`
- ぬりえ（`nurie`、ぬりえの共用部品 `src/lib/coloring/` も）は `src/lib/games/nurie/CLAUDE.md`
- おえかきのもり（`oekaki-mori`、つなぐ部品 `src/lib/net/` の `Handshake` と `Party` も）は `src/lib/games/oekaki-mori/CLAUDE.md`
- ひらめきナゾ（`hirameki`）は `src/lib/games/hirameki/CLAUDE.md`
- アニマルサバイバー（`animal-survivors`）は `src/lib/games/animal-survivors/CLAUDE.md`
- やっぱりカメレオン（`yappari-chameleon`）は `src/lib/games/yappari-chameleon/CLAUDE.md`
```

**Verify**: `grep -c '^- .*src/lib/games/.*/CLAUDE.md' CLAUDE.md` → `7`

### Step 6: 整形して、textlint を通す

```bash
pnpm exec prettier --write CLAUDE.md src/lib/games/*/CLAUDE.md
```

次に 8 つのファイルそれぞれに textlint をかける。

```bash
for f in CLAUDE.md src/lib/games/*/CLAUDE.md; do ~/.claude/textlint/node_modules/.bin/textlint --config ~/.claude/textlint/.textlintrc.json "$f"; done
```

指摘が、Step 3〜5 で足した・書き換えた文（依存の文・BGM の 2 か所・索引）にあれば、意味を変えずにその文を直す。そのときは
Step 7 のスクリプトが許す書き出し（「ランタイム依存は three」「BGM の部品は」「楽譜を楽器の音で」「BGM は `bgm.ts` の `Bgm`」、
索引の行は `CLAUDE.md` を含むこと）を保つ。指摘が移しただけの文（36cc037 から変えていない文）にあれば、文は直さずに残し、
ファイル名・行・規則の名前を報告に書く（中身を変えないほうを優先する）。

**Verify**: `pnpm exec prettier --check CLAUDE.md src/lib/games/*/CLAUDE.md` → exit 0

### Step 7: 消えた文・増えた文が決めたものだけであることを確かめる

整形のあとに、Step 1 の控えと今の 8 つのファイルを比べる。どちらも `。` と改行で切り、前後の空白と行頭の `- ` を落とした
断片の多重集合として比べる。あわせて、どの行も `（` と `）` の数がそろっていること（かっこの中で行を分けていないこと）を見る。

```bash
node -e '
const fs=require("fs");
const frag=t=>t.split(/。|\n/).map(s=>s.trim().replace(/^[-*] /,"")).filter(Boolean);
const before=frag(fs.readFileSync(process.argv[1],"utf8"));
const files=["CLAUDE.md",...fs.readdirSync("src/lib/games").map(d=>"src/lib/games/"+d+"/CLAUDE.md").filter(f=>fs.existsSync(f))];
const texts=files.map(f=>fs.readFileSync(f,"utf8"));
const now=frag(texts.join("\n"));
const bag=a=>a.reduce((m,s)=>m.set(s,(m.get(s)||0)+1),new Map());
const diff=(a,b)=>{const m=bag(b);return a.filter(s=>{const n=m.get(s)||0;if(n){m.set(s,n-1);return false}return true})};
const missing=diff(before,now),extra=diff(now,before);
const okMissing=missing.length===3&&missing.every(s=>/^(ランタイム依存は three（雪原サバイバル・わんにゃんハウスの 3D|BGM は `bgm.ts`（曲は|ピコピコ音の楽器 `pulse`)/.test(s));
const okExtra=extra.every(s=>/^#|CLAUDE\.md|^ランタイム依存は three（雪原サバイバル・わんにゃんハウス・やっぱりカメレオン|^BGM の部品は共通の|^楽譜を楽器の音で先読みして鳴らす|^BGM は `bgm.ts` の `Bgm`/.test(s));
const count=(l,c)=>l.split(c).length-1;
const unbalanced=files.flatMap((f,i)=>texts[i].split("\n").filter(l=>count(l,"（")!==count(l,"）")).map(l=>f+": "+l.slice(0,40)));
console.log("files",files.length);console.log("missing",missing);console.log("extra",extra);console.log("unbalanced",unbalanced);
process.exit(files.length===8&&okMissing&&okExtra&&unbalanced.length===0?0:1);
' "${TMPDIR:-/tmp}/claude-before.md"; echo "exit $?"
```

**Verify**: 最後の行が `exit 0`。中身は次のとおりになる。

- `files 8`
- `missing` はちょうど 3 つで、書き出しが「ランタイム依存は three（雪原サバイバル・わんにゃんハウスの 3D」「BGM は `bgm.ts`（曲は」
  「ピコピコ音の楽器 `pulse`」（直した 2 つの文。BGM の文はかっこの中の `。` で 2 つに分かれる）
- `extra` は 20 個で、直した依存の文 1、`src/lib/music/` の段落の 2、`## ゲームごとの説明` 1、その説明の文 1、索引の行 7、
  `# <ゲーム名>` の見出し 7、直した BGM の文 1 からなる。textlint のために足した文を直したなら数は変わらない
- `unbalanced []`

`exit 1` なら、`missing` か `extra` に上のどれでもない断片が出ているので STOP（移すときに文が落ちたか、整形が文字を変えた）。

### Step 8: 全体の確かめ

**Verify**

- `wc -c CLAUDE.md` → 20000 以下（36cc037 のままなら約 17700）
- `pnpm verify` → exit 0
- `git status --short -- . ':!plans'` → `M CLAUDE.md` と、7 つの `?? src/lib/games/<id>/CLAUDE.md` だけ（`plans/` の
  変化は数えない。ほかの計画のファイルや `plans/README.md` が出ることがある）

## Test plan

- コードを変えないので、足すテストは無い
- 消えた文が無いことは Step 7 のスクリプトで見る（7 本ぶんの約 700 の断片と、直下に残る文の全部）
- 整形は `pnpm exec prettier --check`、全体は `pnpm verify` で見る

## Done criteria

- [ ] Step 7 のスクリプトが `exit 0`
- [ ] `ls src/lib/games/*/CLAUDE.md | wc -l` が `7`
- [ ] `wc -c CLAUDE.md` が 20000 以下
- [ ] `grep -rn '雪原サバイバル・わんにゃんハウスの 3D 表示が使い' CLAUDE.md src/lib/games` が何も返さない
- [ ] ``grep -rn '1 曲を繰り返し流す `loop.ts` の `Loop`。ピコピコ' CLAUDE.md src/lib/games`` が何も返さない
- [ ] `grep -c 'jsqr・uqr' CLAUDE.md` が `1`
- [ ] `pnpm verify` が exit 0
- [ ] `git status --short -- . ':!plans'` が `CLAUDE.md` の `M` と 7 つの `src/lib/games/<id>/CLAUDE.md` の `??` だけ
- [ ] `plans/README.md` の 050 の行を更新し、`pnpm exec prettier --write plans/README.md` を通した

## STOP 条件

- Drift check の 3 つのどれかが期待と違う（すでに `src/lib/games/*/CLAUDE.md` がある、直す 2 つの文が無いか 2 つ以上ある）
- Step 2 のスクリプトが `not found: <id>` で止まる
- Step 7 が `exit 1` になり、1 回見直しても理由が分からない
- `prettier --write` が移した文の文字を変えた（Step 7 の `extra` と `missing` に同じ文の 2 つの形が並ぶ）
- `src/lib/games/pet-house/bgm.ts` が `$lib/music/loop` を import するようになっている（2 つめの直しの前提が崩れる。
  `grep -n "music/loop" src/lib/games/pet-house/bgm.ts` で見る）
- `package.json` の `dependencies` が `jsqr`・`onnxruntime-web`・`three`・`uqr` の 4 つでない
- 文書を今のコードに合わせるために、2 か所のほかの言い回しも直したくなった（直さずに報告する）

## Maintenance notes

- ゲームを足すとき、そのゲームの説明が長くなるなら `src/lib/games/<id>/CLAUDE.md` に書き、直下の「ゲームごとの説明」に 1 行足す。
  直下に書くのは、ゲームをまたぐ決まりと共通部品だけにする
- サブディレクトリの `CLAUDE.md` は、そのフォルダのファイルを読んだときにしか読まれない。`src/lib/coloring/` を直すときは
  ぬりえの、`src/lib/net/` を直すときはおえかきのもりとやっぱりカメレオンの `CLAUDE.md` を自分で開く必要がある（索引に書いた）
- アニマルサバイバーの `CLAUDE.md` はまだ約 56KB ある。協力プレイ・ガチャ・面と障害物などの節に分けるのは、別の計画にする
- レビューでは、Step 7 の `missing` と `extra` の出力を PR の説明に貼ってもらい、直した 2 か所の文が今のコード
  （`package.json`・`src/lib/net/camera.ts`・`src/lib/net/Qr.svelte`・`src/lib/games/pet-house/bgm.ts`）と合っているかを見る
