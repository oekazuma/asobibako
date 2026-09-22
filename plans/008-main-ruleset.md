# Plan 008: `main` に required status checks を付ける（リポジトリ設定。利用者が実行する）

> **この計画は実行エージェントには渡さない。** GitHub のリポジトリ設定を変えるもので、管理者権限と
> 利用者本人の判断が要る。利用者が読んで、自分で `gh` を実行する。
>
> **Drift check**: `gh api repos/oekazuma/table-duel/rulesets` が `[]` でなければ、既に誰かが
> ruleset を作っている。中身を読んでから進む。

## Status

| 項目       | 値                                                                                         |
| ---------- | ------------------------------------------------------------------------------------------ |
| Priority   | P2                                                                                         |
| Effort     | S                                                                                          |
| Risk       | LOW（マージできなくなる方向にしか働かない。bypass を付け忘れると自分の直接 push も止まる） |
| Depends on | none                                                                                       |
| Category   | security                                                                                   |
| Planned at | commit `b4b0196`, 2026-09-22                                                               |

## Why this matters

`renovate.json` は `platformAutomerge: true` で、コメントに「CI still has to pass first」とある。
ところが監査時点で `main` には branch protection も ruleset もなく（`gh api .../branches/main/protection` →
`Branch not protected`、`.../rulesets` → `[]`）、required status checks が 1 つもない。

今のところ CI ゲートは効いている。リポジトリの `allow_auto_merge` が `false` なので Renovate は
GitHub のネイティブ auto-merge を使えず、自前のマージにフォールバックし、そちらはブランチの
チェックが緑になるまで待つから。しかし「Allow auto-merge」を設定画面で一度 on にすると（`platformAutomerge: true`
がまさにそれを求める）、ネイティブ auto-merge は **required checks だけ** を見るので、何もない今の状態では
CI を待たずにマージされ、`deploy.yml` がそのまま本番へ出す。

ruleset で `lint` / `check` / `test` / `build` を required にしておけば、どちらの経路でも CI が門になる。

## Current state

- `.github/workflows/ci.yml` の job 名は `lint`、`check`、`test`、`build`（`build` は PR のときだけ走る。
  `if: github.event_name == 'pull_request'`）
- `.github/workflows/svelte-vitals.yml` の job 名は `svelte-vitals`（PR のときだけ）
- 利用者は `main` に直接 push している（`git log` にマージコミットがない）。required checks を付けると、
  直接 push もチェック待ちで拒否されるので、**管理者を bypass に入れる**。Renovate（GitHub App）は
  bypass に入らないので、PR のチェックを待つ

## Commands you will need

`gh` が認証済みで、リポジトリの admin であること（`gh auth status`、`gh api repos/oekazuma/table-duel --jq .permissions.admin` が `true`）。

## Scope

**In scope** — GitHub のリポジトリ設定（ruleset）だけ。コードは変えない。

**Out of scope**

- `renovate.json` — 007 で整理する。`platformAutomerge` は残してよい（ruleset が門になる）
- 「Allow auto-merge」の設定 — on にするかは利用者の判断。on にするなら ruleset のあとで
- `svelte-vitals` を required にするか — dogfooding なので、落ちたときに自分でマージしたいなら required にしない

## Steps（利用者が実行）

### Step 1: 現状を確かめる

```bash
gh api repos/oekazuma/table-duel/rulesets
```

期待 — `[]`。

### Step 2: ruleset を作る

`ruleset.json` を作業ディレクトリの外（例: `/tmp/ruleset.json`）に書く。

```json
{
  "name": "main: CI must pass",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "bypass_actors": [{ "actor_id": 5, "actor_type": "RepositoryRole", "bypass_mode": "always" }],
  "rules": [
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": false,
        "required_status_checks": [
          { "context": "lint" },
          { "context": "check" },
          { "context": "test" },
          { "context": "build" }
        ]
      }
    },
    { "type": "deletion" },
    { "type": "non_fast_forward" }
  ]
}
```

`actor_id: 5` は Repository role の admin。`bypass_mode: "always"` で、利用者本人の直接 push は今までどおり通る。
`deletion` と `non_fast_forward` は `main` の削除と force push を止める（副作用は小さい）。

```bash
gh api repos/oekazuma/table-duel/rulesets --method POST --input /tmp/ruleset.json
```

期待 — 201 と作られた ruleset の JSON。

### Step 3: 効いていることを確かめる

```bash
gh api repos/oekazuma/table-duel/rulesets --jq '.[] | {name, enforcement}'
gh api repos/oekazuma/table-duel/rules/branches/main --jq '.[] | .type'
```

期待 — `required_status_checks`、`deletion`、`non_fast_forward` が並ぶ。

次に、自分で小さな変更を `main` に直接 push できること（bypass が効いている）を確かめる。
たとえば `plans/README.md` の 008 の Status を DONE にするコミットを push する。拒否されたら
`bypass_actors` を見直す（Step 5）。

### Step 4: Renovate の PR で確かめる

次の Renovate PR が来たら、PR の Checks に「Required」の印が付き、CI が緑になるまで
マージボタンが無効なことを見る。

### Step 5: 直接 push が拒否された場合

`actor_id` は組織やリポジトリで違うことがある。`gh api repos/oekazuma/table-duel/collaborators/oekazuma/permission --jq .role_name`
が `admin` であること、ruleset の `bypass_actors` が空になっていないことを
`gh api repos/oekazuma/table-duel/rulesets/<id> --jq .bypass_actors` で見る。空なら PUT で足す。

## Done criteria

- [ ] `gh api repos/oekazuma/table-duel/rules/branches/main` に `required_status_checks` がある
- [ ] 利用者の直接 push が通る
- [ ] `plans/README.md` の 008 の Status を更新した

## STOP conditions

- `gh api ... --jq .permissions.admin` が `true` でない
- 既に ruleset がある（中身を読んで、必要なら required checks だけ足す）

## Maintenance notes

- `ci.yml` の job 名を変えたら、ruleset の `context` も変える。変え忘れると PR が永遠にマージできない
- 「Allow auto-merge」を on にするなら、この ruleset のあとにする
- `renovate.json` の automerge のコメント「CI still has to pass first」は、この ruleset が根拠になる
