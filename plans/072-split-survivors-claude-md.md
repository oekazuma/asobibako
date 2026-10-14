# Plan 072: アニマルサバイバーの CLAUDE.md を、全体の決まりの短い本体と話題ごとの docs/ の文書に分ける

> **Executor instructions**: この計画を上から順に実行する。各ステップの確認コマンドを実行し、期待どおりの結果を
> 確かめてから次へ進む。「STOP 条件」のどれかに当たったら止めて報告する。終わったら `plans/README.md` の
> 自分の行の Status を更新する（レビュー担当に「索引は触らない」と言われたときは触らない）。
>
> **Drift check（最初に実行）**
> 触るのは `CLAUDE.md` だけで、毎日のように変わるので `git diff` ではなく、この計画が頼る形を確かめる。次の 3 つを実行する。
>
> 1. `ls src/lib/games/animal-survivors/docs` は「No such file or directory」
> 2. `node -e 'const l=require("fs").readFileSync("src/lib/games/animal-survivors/CLAUDE.md","utf8").split("\n");console.log(l.length,l[0])'` は `242 # アニマルサバイバー`
> 3. ``grep -c '^知らせの版は `COOP_VERSION`' src/lib/games/animal-survivors/CLAUDE.md`` は `1`
>
> 食い違えば STOP（行が足されたか消された。Step 2 のスクリプトの行の範囲が合わない）。

## Status

| 項目       | 値                                                                                  |
| ---------- | ----------------------------------------------------------------------------------- |
| Priority   | P3                                                                                  |
| Effort     | S                                                                                   |
| Risk       | LOW（文書だけを動かす。コードは触らない。消えた文が無いことをスクリプトで確かめる） |
| Depends on | none                                                                                |
| Category   | docs / dx                                                                           |
| Planned at | commit `ea56ff6`, 2026-10-14                                                        |

## Why this matters

`src/lib/games/animal-survivors/CLAUDE.md` は約 56KB（241 行、1 文 1 行、見出しは題だけ）ある。Claude Code はこのフォルダのファイルを
読んだときにこの `CLAUDE.md` を丸ごと読み込むので、ガチャの色 1 つを直すセッションでも、協力プレイ・ボス・延長戦の細かい数まで
毎回読む。見出しが無いので、読む側も目当ての話題を探しにくい。

この計画は、全体にかかわる決まり（概要・ルールの置き場所・ドット絵と座標・画面の決まり・記録・協力プレイの版・一時停止）だけを
`CLAUDE.md` に残し、残りを話題ごとの 8 つの文書 `src/lib/games/animal-survivors/docs/*.md` へ中身を変えずに移す。本体は約 8KB になる。

### どちらの分け方にするか

| 分け方                                                   | 毎回読み込む量 | 話題の見つけやすさ                                                     |
| -------------------------------------------------------- | -------------- | ---------------------------------------------------------------------- |
| A. 全部を `CLAUDE.md` に残し、見出しで節に分ける         | 約 56KB のまま | 見出しで探せる。読み忘れは起きない                                     |
| B. 本体に全体の決まりと索引を残し、話題を `docs/` へ移す | 約 8KB         | 索引から開く。開かなければ、その話題の決まりを知らずに直すおそれがある |

B にする。`docs/` の `.md` は Claude Code が自動では読み込まないので、索引の各行に「このファイルを直す前にこの文書を開く」と
ファイル名を並べて、読み忘れを減らす。どの話題にもかかわる決まりは本体に残すので、文書を開かなくても破りにくい。

## Current state

### 今のファイルの形

`src/lib/games/animal-survivors/CLAUDE.md` は 1 行目が `# アニマルサバイバー`、2 行目が空行、3〜241 行が 1 行 1 文の本文、最後に改行が
1 つある（`split("\n")` で 242 要素）。話題は行の並びでまとまっていて、この計画は次のように分ける（行番号は ea56ff6 のもの）。

| 行                            | 話題                                                                                                          | 移す先              |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------- |
| 3                             | 概要                                                                                                          | `CLAUDE.md`（残す） |
| 30〜42、45〜48、112、238〜241 | ルールの置き場所・乱数・ドット絵と座標・点滅・HUD と画面・合成 click の防ぎ方・記録・協力プレイの版・一時停止 | `CLAUDE.md`（残す） |
| 4〜27、127〜133               | 面・障害物・遺物・祠・吹雪・噴火・出来事                                                                      | `docs/stages.md`    |
| 28〜29、49〜72、85、134〜138  | ボス・ヌシ・強化個体・きらきらハリネズミ                                                                      | `docs/bosses.md`    |
| 73〜84、113〜126、139         | 宝箱・限界突破・武器・落とし物・能力・進化・合体                                                              | `docs/weapons.md`   |
| 86〜100                       | 動物と育ち                                                                                                    | `docs/animals.md`   |
| 43〜44、101〜111、140〜148    | パワーアップと実績の画面・店・コイン・実績・図鑑・BGM・延長戦                                                 | `docs/progress.md`  |
| 149〜177                      | キャラ選択・今日のお題・まじょの釜・アルカナ                                                                  | `docs/menus.md`     |
| 178〜206                      | 装備・ガチャ                                                                                                  | `docs/gear.md`      |
| 207〜237                      | ふたりで遊ぶ（協力プレイ）                                                                                    | `docs/coop.md`      |

3〜241 行のどれもちょうど 1 か所へ行く（Step 2 のスクリプトが数えて確かめる）。各範囲の 1 行目の書き出しは、たとえば
4 行目が「面の表は `stages/`」、207 行目が「ふたりで遊ぶ（`CoopRoom.svelte`。」、238 行目が「知らせの版は `COOP_VERSION`」で、
スクリプトはこの書き出しが合わなければ何も書かずに止まる。

### 本体に残す行の例

30 行目（ルールの置き場所）と 112 行目（記録）は、どの話題を直しても触れる決まりなので残す。

```text
ルールは DOM を使わない `world.ts`（移動・出現・敵の動き・押し合い・接触・時計）・`arms.ts`（武器の動き方）・`drops.ts`（経験値の曲線・玉・肉・磁石）・`choices.ts`（レベルアップの 3 択）で、…
記録（いちばん長い生存・撃破の合計・倒したボス・クリア・クリアした動物・開けた宝箱・コイン・店の段・達成した実績・解放した動物・図鑑）は `records.ts` が `asobibako:animal-survivors` に持ち、…
```

### 直下の `CLAUDE.md` の索引

リポジトリ直下の `CLAUDE.md` の「ゲームごとの説明」に「アニマルサバイバー（`animal-survivors`）は `src/lib/games/animal-survivors/CLAUDE.md`」の
行がある。本体の場所は変わらないので、直下は触らない。

### 規約

- 利用者の決まりで、docs には今の仕様だけを書く（経緯・課題の番号・「〜から分けた」のような変更の話は書かない）。足す文（見出し・
  文書の始めの 1 文・索引）もこれに従う
- `.md` には textlint（ai-writing）がかかる。太字とコロンを組み合わせた箇条書きや、コロンで終わる文は通らない。下のスクリプトが書く文は、
  計画を書いたときに textlint と `prettier --check` を通ることを確かめてある
- `pnpm format` は木全体を整形するので使わない

## Commands you will need

| Purpose      | Command                                                                                                        | Expected on success |
| ------------ | -------------------------------------------------------------------------------------------------------------- | ------------------- |
| 整形         | `pnpm exec prettier --write src/lib/games/animal-survivors/CLAUDE.md src/lib/games/animal-survivors/docs/*.md` | exit 0              |
| 整形の確かめ | `pnpm exec prettier --check src/lib/games/animal-survivors/CLAUDE.md src/lib/games/animal-survivors/docs/*.md` | exit 0              |
| textlint     | `~/.claude/textlint/node_modules/.bin/textlint --config ~/.claude/textlint/.textlintrc.json <file>`            | 何も出ない          |
| 全部         | `pnpm verify`                                                                                                  | exit 0              |

## Scope

**In scope**

- `src/lib/games/animal-survivors/CLAUDE.md`（全体の決まりと索引だけにする）
- `src/lib/games/animal-survivors/docs/stages.md`・`bosses.md`・`weapons.md`・`animals.md`・`progress.md`・`menus.md`・`gear.md`・`coop.md`（作る）
- `plans/README.md`（自分の行の Status だけ）

**Out of scope**

- コードのすべて（`.ts`・`.svelte`・設定）。文書と合わないところを見つけても直さず、報告に書く
- 移す文の言い回しを直すこと・文の順を変えること。行をそのまま移すだけにする
- リポジトリ直下の `CLAUDE.md` と、ほかのゲームの `CLAUDE.md`
- `stages/` や `art/` に `CLAUDE.md` を置くこと（話題とフォルダが合わない）

## Git workflow

- ブランチは `advisor/072-split-survivors-claude-md`
- コミットは 1 つ。英語の命令形 1 文で、署名などの行は付けない（例 `Split the animal survivors notes into a short core and topic docs`）
- push しない（`main` への push は本番へ配信される）

## Steps

### Step 1: 今のファイルを控える

ブランチを切り、手を入れる前のファイルをリポジトリの外へ写す。

```bash
git switch -c advisor/072-split-survivors-claude-md
cp src/lib/games/animal-survivors/CLAUDE.md "${TMPDIR:-/tmp}/survivors-before.md"
```

**Verify**: `cmp src/lib/games/animal-survivors/CLAUDE.md "${TMPDIR:-/tmp}/survivors-before.md" && echo same` → `same`

### Step 2: スクリプトで本体と 8 つの文書に分ける

手で切り貼りすると長い行を落としやすいので、リポジトリの直下で次のスクリプトをそのまま実行する。行の範囲ごとに書き出しを確かめ、
3〜241 行がちょうど 1 回ずつ使われることを数えてから、`docs/` の 8 つの文書（題・始めの 1 文・移した行）と、本体（題・概要・
「全体の決まり」・「話題ごとの文書」の索引）を書く。

```bash
node -e '
const fs=require("fs");
const dir=process.argv[1];
const lines=fs.readFileSync(dir+"/CLAUDE.md","utf8").split("\n");
if(lines.length!==242||lines[0]!=="# アニマルサバイバー"||lines[241]!=="")throw new Error("drift: "+lines.length+" lines");
const TOP=[[3,3,"アニマルサバイバー（`animal-survivors`）は、"],[30,42,"ルールは DOM を使わない"],[45,48,"3 択とリザルトは移動の指の"],[112,112,"記録（いちばん長い生存・撃破"],[238,241,"知らせの版は `COOP_VERSION`"]];
const DOCS=[
["stages","アニマルサバイバーの面と出来事","面・障害物・遺物・祠・吹雪・噴火・出来事","`stages/`・`obstacles.ts`・`relics.ts`・`shrines.ts`・`storm.ts`・`eruption.ts`・`events.ts`・`carry.ts`・`draw-obstacles.ts`・`draw-storm.ts`・`draw-volcano.ts`・`draw-events.ts`・`draw-carry.ts`",[[4,27,"面の表は `stages/`"],[127,133,"面には出来事（`stages"]]],
["bosses","アニマルサバイバーのボスとヌシ","ボス・ヌシ・強化個体・きらきらハリネズミ","`bosses.ts`・`bosses-forest.ts`・`bosses-snow.ts`・`bosses-volcano.ts`・`enemies.ts`・`draw-boss.ts`・`BossIntro.svelte`・`BossWarning.svelte`",[[28,29,"火山のボスは溶岩の巨人"],[49,72,"ボスは墓地・雪山・火山では"],[85,85,"強化個体は 2:40 から出"],[134,138,"1:00・3:00・5:00"]]],
["weapons","アニマルサバイバーの武器と落とし物","武器・宝箱・限界突破・落とし物・能力・進化・合体","`weapons.ts`・`arms.ts`・`zones.ts`・`chest.ts`・`limit.ts`・`choices.ts`・`choice-view.ts`・`drops.ts`・`passives.ts`・`evolutions.ts`・`unions.ts`・`draw-arms.ts`・`LevelUp.svelte`・`ChestOpen.svelte`・`Evolutions.svelte`・`DamageTable.svelte`",[[73,84,"中身は `chest.ts`"],[113,126,"自分の周りには壊せるランタン"],[139,139,"`damageEnemy` "]]],
["animals","アニマルサバイバーの動物と育ち","動物と育ち","`animals.ts`・`specials.ts`・`grow.ts`・`art/animals.ts`・`art/grown.ts`・`GrowPlate.svelte`",[[86,100,"動物は 10 匹で、強さの段"]]],
["progress","アニマルサバイバーの店・実績・図鑑・延長戦","店・コイン・実績・図鑑・BGM・延長戦","`upgrades.ts`・`achievements.ts`・`trophy-groups.ts`・`book.ts`・`book-view.ts`・`songs.ts`・`overtime.ts`・`Shop.svelte`・`Trophies.svelte`・`Trophy.svelte`・`Book.svelte`・`OvertimeAsk.svelte`",[[43,44,"パワーアップは残りのコインを"],[101,111,"遊ぶたびにコインが貯まり、店"],[140,148,"BGM は `songs.t"]]],
["menus","アニマルサバイバーのキャラ選択・お題・釜・アルカナ","キャラ選択・今日のお題・まじょの釜・アルカナ","`CharSelect.svelte`・`AnimalCard.svelte`・`MenuLinks.svelte`・`daily.ts`・`cauldron.ts`・`arcana.ts`・`Daily.svelte`・`DailyCard.svelte`・`Cauldron.svelte`・`ArcanaPick.svelte`・`ArcanaRow.svelte`",[[149,177,"キャラ選択は 10 匹の顔の"]]],
["gear","アニマルサバイバーの装備とガチャ","装備・ガチャ","`gear.ts`・`gacha.ts`・`gacha-show.ts`・`gacha-sounds.ts`・`gacha3d.ts`・`gacha3d-parts.ts`・`Gear.svelte`・`GearDetail.svelte`・`GearIcon.svelte`・`Bag.svelte`・`GachaRoom.svelte`・`Gacha.svelte`・`Gacha3D.svelte`・`GachaList.svelte`・`GachaOdds.svelte`・`RunKit.svelte`",[[178,206,"装備（`gear.ts`）は"]]],
["coop","アニマルサバイバーの協力プレイ（ふたりで遊ぶ）","ふたりで遊ぶ（協力プレイ）","`coop.ts`・`coop-run.ts`・`coop-stats.ts`・`coop-quit.ts`・`heroes.ts`・`snap.ts`・`link.ts`・`link-halves.ts`・`draw-link.ts`・`CoopRoom.svelte`・`CoopPick.svelte`・`CoopPlay.svelte`・`CoopOverlay.svelte`・`CoopStats.svelte`・`CoopBook.svelte`・`LinkButton.svelte`・`LinkCutIn.svelte`",[[207,237,"ふたりで遊ぶ（`CoopRo"]]]
];
const used=new Array(242).fill(0);
for(const [a,b] of [...TOP,...DOCS.flatMap(d=>d[4])])for(let i=a;i<=b;i++)used[i]++;
for(let i=3;i<=241;i++)if(used[i]!==1)throw new Error("line "+i+" used "+used[i]+" times");
const take=rs=>rs.flatMap(([a,b,pre])=>{if(!lines[a-1].startsWith(pre))throw new Error("drift at line "+a+": "+lines[a-1].slice(0,20));return lines.slice(a-1,b)});
const docs=DOCS.map(([name,title,topic,files,rs])=>[name,"# "+title+"\n\nアニマルサバイバーの"+topic+"の仕様。全体の決まりとほかの話題の文書の一覧は `src/lib/games/animal-survivors/CLAUDE.md` にある。\n\n"+take(rs).join("\n")+"\n"]);
const index=DOCS.map(([name,,topic,files])=>"- "+topic+"は `docs/"+name+".md`（"+files+"）");
const top=["# アニマルサバイバー","",...take(TOP.slice(0,1)),"","## 全体の決まり","",...take(TOP.slice(1)),"","## 話題ごとの文書","","次の話題は、このフォルダの `docs/` の文書に書いてある。`docs/` の文書は Claude Code が自動では読み込まないので、かっこの中のファイルを直す前に、その話題の文書を開く。","",...index,""].join("\n");
fs.mkdirSync(dir+"/docs");
for(const [name,text] of docs)fs.writeFileSync(dir+"/docs/"+name+".md",text);
fs.writeFileSync(dir+"/CLAUDE.md",top);
console.log("docs",docs.length);
' src/lib/games/animal-survivors
```

**Verify**

- 出力が `docs 8`
- `ls src/lib/games/animal-survivors/docs | wc -l` → `8`
- `head -1 src/lib/games/animal-survivors/docs/coop.md` → `# アニマルサバイバーの協力プレイ（ふたりで遊ぶ）`
- `grep -c '^- .*`docs/' src/lib/games/animal-survivors/CLAUDE.md`→`8`

`drift at line <n>` か `line <n> used <k> times` で止まったら STOP（Drift check を通っていれば起きない）。止まったときは何も書いていない。

### Step 3: 整形して、textlint を通す

```bash
pnpm exec prettier --write src/lib/games/animal-survivors/CLAUDE.md src/lib/games/animal-survivors/docs/*.md
for f in src/lib/games/animal-survivors/CLAUDE.md src/lib/games/animal-survivors/docs/*.md; do ~/.claude/textlint/node_modules/.bin/textlint --config ~/.claude/textlint/.textlintrc.json "$f"; done
```

指摘が出たら、足した文（見出し・文書の始めの 1 文・索引の行と、その前の 1 文）のものだけを、意味を変えずに直す。直すときは、
見出しは `#` で始め、文書の始めの 1 文は「アニマルサバイバーの…の仕様」と `CLAUDE.md` を含む文の 2 つを保ち、索引の行と
その前の 1 文は `docs/` を含むようにする（Step 4 の確かめがこの形で足した文を見分ける）。移した行への指摘は直さずに、
ファイル名・行・規則の名前を報告に書く。

**Verify**: `pnpm exec prettier --check src/lib/games/animal-survivors/CLAUDE.md src/lib/games/animal-survivors/docs/*.md` → exit 0

### Step 4: 消えた文が無く、索引が全部の文書と今あるファイルを指すことを確かめる

Step 1 の控えと、今の本体と 8 つの文書を比べる。どちらも `。` と改行で切り、前後の空白と行頭の `- ` を落とした断片の多重集合として
比べる（plan 050 と同じ確かめ方）。あわせて、本体の大きさ、どの文書も本体から `docs/<名前>.md` で指されていること、索引に
並べたファイル名がフォルダに実在することを見る。

```bash
node -e '
const fs=require("fs");
const [dir,beforeFile]=process.argv.slice(1);
const frag=t=>t.split(/。|\n/).map(s=>s.trim().replace(/^[-*] /,"")).filter(Boolean);
const docs=fs.readdirSync(dir+"/docs").filter(f=>f.endsWith(".md")).sort();
const top=fs.readFileSync(dir+"/CLAUDE.md","utf8");
const now=frag([top,...docs.map(f=>fs.readFileSync(dir+"/docs/"+f,"utf8"))].join("\n"));
const before=frag(fs.readFileSync(beforeFile,"utf8"));
const bag=a=>a.reduce((m,s)=>m.set(s,(m.get(s)||0)+1),new Map());
const diff=(a,b)=>{const m=bag(b);return a.filter(s=>{const n=m.get(s)||0;if(n){m.set(s,n-1);return false}return true})};
const missing=diff(before,now),extra=diff(now,before);
const badExtra=extra.filter(s=>!/^#|docs\/|CLAUDE\.md|^アニマルサバイバーの.*の仕様$/.test(s));
const unref=docs.filter(f=>!top.includes("`docs/"+f+"`"));
const index=top.split("\n").filter(l=>l.startsWith("- ")&&l.includes("`docs/"));
const absent=index.flatMap(l=>[...l.matchAll(/`([\w./-]+\.(?:ts|svelte))`/g)].map(m=>m[1])).filter(f=>!fs.existsSync(dir+"/"+f));
const bytes=Buffer.byteLength(top);
console.log("docs",docs.length,"index",index.length,"top bytes",bytes);
console.log("missing",missing);console.log("extra",extra.length,"badExtra",badExtra);console.log("unref",unref);console.log("absent",absent);
process.exit(docs.length===8&&index.length===8&&bytes<=10000&&!missing.length&&!badExtra.length&&!unref.length&&!absent.length?0:1);
' src/lib/games/animal-survivors "${TMPDIR:-/tmp}/survivors-before.md"; echo "exit $?"
```

**Verify**: 最後の行が `exit 0`。中身は次のとおりになる。

- `docs 8 index 8 top bytes 7938` に近い行（大きさは 10000 以下ならよい）
- `missing []`（移すときに落ちた文が無い）
- `extra 36 badExtra []`（増えたのは見出し・文書の始めの 1 文・索引だけ。textlint のために足した文を直しても数は変わらない）
- `unref []`（索引から指されていない文書が無い）
- `absent []`（索引に並べたファイル名がどれもフォルダにある）

`exit 1` なら、どの行が空でないかを見て STOP（`missing` なら文が落ちた、`absent` ならファイル名が変わっている）。

### Step 5: 全体の確かめとコミット

```bash
pnpm verify
git add src/lib/games/animal-survivors/CLAUDE.md src/lib/games/animal-survivors/docs
git commit -m "Split the animal survivors notes into a short core and topic docs"
```

**Verify**

- `pnpm verify` → exit 0
- `wc -c < src/lib/games/animal-survivors/CLAUDE.md` → 10000 以下
- `git status --short -- . ':!plans'` → 何も出ない

## Test plan

- コードを変えないので、足すテストは無い
- 消えた文が無いことは Step 4 のスクリプトで見る（241 行ぶんの断片の全部）
- 整形は `pnpm exec prettier --check`、全体は `pnpm verify` で見る

## Done criteria

- [ ] Step 4 のスクリプトが `exit 0`
- [ ] `ls src/lib/games/animal-survivors/docs/*.md | wc -l` が `8`
- [ ] `wc -c < src/lib/games/animal-survivors/CLAUDE.md` が 10000 以下
- [ ] ``grep -c '^- .*`docs/' src/lib/games/animal-survivors/CLAUDE.md`` が `8`
- [ ] `pnpm verify` が exit 0
- [ ] `git show --stat --format=%B HEAD` に出るファイルが `src/lib/games/animal-survivors/CLAUDE.md` と `src/lib/games/animal-survivors/docs/` の 8 つだけで、
      メッセージが英語の 1 文だけ（trailer が無い）
- [ ] `plans/README.md` の 072 の行を更新し、`pnpm exec prettier --write plans/README.md` を通した

## STOP 条件

- Drift check の 3 つのどれかが期待と違う（`docs/` がすでにある、行の数が 242 でない、`COOP_VERSION` の行が無い）
- Step 2 のスクリプトが `drift at line` か `used` で止まる
- Step 4 が `exit 1` になり、1 回見直しても理由が分からない
- `prettier --write` が移した行の文字を変えた（Step 4 の `missing` と `extra` に同じ文の 2 つの形が並ぶ）
- 移した行の言い回しを直したくなった、または分け方（どの行をどの文書へ）を変えたくなった（変えずに報告する）

## Maintenance notes

- アニマルサバイバーの仕様を足すときは、索引の話題に合う `docs/*.md` の、関係する行の近くに 1 文 1 行で書く。どの話題を直すときも
  守る決まり（ルールの置き場所・座標・画面の作法・記録・協力プレイの版のような）だけを本体に書く
- 話題の文書を足したら、本体の「話題ごとの文書」に 1 行足し、かっこの中にその話題のファイル名を並べる。ファイルの名前を変えたら索引も直す
  （Step 4 の `absent` の確かめを、そのときにもう一度走らせるとよい）
- 本体が 10KB を超えてきたら、全体の決まりのうち 1 つの話題にしかかからない行を、その文書へ移す
- レビューでは、Step 4 の出力（`missing []` と `extra` の数）を PR の説明に貼ってもらい、本体に残した行が「どの話題を直しても守る決まり」に
  なっているかを見る
