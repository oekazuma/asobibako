<script lang="ts">
  import { onMount } from 'svelte';
  import { version } from '$app/environment';
  import Icon from './Icon.svelte';
  import { Gate, MAX_FAILS } from '$lib/gate.svelte';
  import {
    backedUpAt,
    backupFile,
    backupName,
    exportAll,
    importAll,
    markBackedUp,
    parseBackup,
    summarize,
    type Backup
  } from '$lib/backup';

  let pending = $state<Backup | null>(null);
  let gate = $state<Gate | null>(null);
  let ans = $state('');
  let agreed = $state(false);
  let error = $state('');
  let canShare = $state(false);
  let lastAt = $state<string | null>(null);
  const sum = $derived(pending ? summarize(pending) : null);

  // ホーム画面のアプリはダウンロードが分かりにくいので、対応端末では共有シート（AirDrop・ファイル・メール）も出す。
  // プリレンダーには navigator が無いので mount 後に決める
  onMount(() => {
    canShare = typeof navigator.canShare === 'function' && navigator.canShare({ files: [backupFile(version)] });
    lastAt = backedUpAt();
  });

  function save() {
    const url = URL.createObjectURL(new Blob([exportAll(version)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = backupName();
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    done();
  }

  function share() {
    error = '';
    // Safari はユーザー操作のハンドラ内で同期に呼ばれた share() しか通さないため、await を挟まない
    navigator.share({ files: [backupFile(version)], title: 'あそびばこ の記録' }).then(done, (e: unknown) => {
      if (e instanceof Error && e.name === 'AbortError') return;
      error = '共有できませんでした。「記録を書き出す」をお使いください。';
    });
  }

  function done() {
    markBackedUp();
    lastAt = backedUpAt();
  }

  async function pick(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    error = '';
    pending = null;
    try {
      pending = parseBackup(await f.text());
      gate = new Gate();
      ans = '';
      agreed = false;
    } catch {
      error = '読み込めませんでした。「記録を書き出す」で保存したファイルを選んでください。';
    }
  }

  function submit(e: SubmitEvent) {
    e.preventDefault();
    if (!pending || !gate) return;
    if (!gate.submit(ans)) return void (ans = '');
    if (importAll(pending)) return location.reload();
    pending = null;
    error = '読み込めませんでした（保存できる容量を超えています）。いまの記録は元のままです。';
  }
</script>

<div class="backup">
  <p>到達したレベルなどの記録を 1 つのファイルに書き出せます。端末を替えるときや、データを消す前に。</p>
  <p class:warn={!lastAt}>
    {lastAt ? `最後に書き出した日: ${lastAt}` : 'まだ書き出していません。'}
    iPad の不具合で記録が消えることがあるので、週に 1 回ほど書き出して「ファイル」などに残しておくと戻せます。
  </p>
  <div class="row">
    <button class="pill" onclick={save}><Icon name="download" size="20px" />記録を書き出す</button>
    {#if canShare}
      <button class="pill" onclick={share}><Icon name="share" size="20px" />共有する</button>
    {/if}
    <label class="pill"
      ><Icon name="upload" size="20px" />記録を読み込む<input
        type="file"
        accept="application/json,.json"
        onchange={pick}
      /></label
    >
  </div>
  {#if error}<p class="err" role="alert">{error}</p>{/if}
  {#if pending && gate && sum}
    <form class="confirm" onsubmit={submit}>
      <p><b>{sum.games} 本</b>のゲームの記録・{sum.keys} 件（{sum.at} に書き出し）</p>
      <p class="warn">いまこの端末にある記録は<b>すべて置き換わります</b>。元に戻せません。</p>
      {#if gate.locked}
        <p class="err">きょうは {MAX_FAILS} 回間違えたため、読み込みは明日まで行えません。</p>
      {:else}
        <label class="gate"
          >保護者の方が計算に答えてください <b>{gate.a} × {gate.b} =</b>
          <input type="number" inputmode="numeric" bind:value={ans} required /></label
        >
        {#if gate.wrong}<p class="err">違います。あと {gate.left} 回。</p>{/if}
        <label class="agree"><input type="checkbox" bind:checked={agreed} /> 置き換えることを確認しました</label>
      {/if}
      <div class="row">
        <button type="button" class="pill" onclick={() => (pending = null)}>やめる</button>
        <button type="submit" class="pill p2" disabled={gate.locked || !agreed || !ans}>読み込む</button>
      </div>
    </form>
  {/if}
</div>

<style>
  p {
    font-size: 14px;
    font-weight: 700;
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 12px;
  }

  .pill {
    padding: 8px 18px;
    font-size: 14px;
  }

  .pill:disabled {
    cursor: default;
    opacity: 0.45;
  }

  label.pill input {
    display: none;
  }

  .confirm {
    margin-top: 14px;
    padding-top: 12px;
    border-top: 3px dashed var(--pastel-p2);
  }

  .warn,
  .err {
    color: var(--p2-deep);
  }

  .gate {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-top: 8px;
    font-size: 14px;
    font-weight: 700;
  }

  .gate input {
    width: 90px;
    padding: 4px 10px;
    border: 3px solid var(--line);
    border-radius: 12px;
    color: var(--line);
    font: inherit;
    font-size: 18px;
    /* 全体の user-select: none を継ぐと iOS Safari で入力できなくなる */
    user-select: text;
    -webkit-user-select: text;
  }

  .agree {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 8px;
    font-size: 14px;
    font-weight: 700;
  }

  .agree input {
    width: 20px;
    height: 20px;
    accent-color: var(--pastel-p2);
  }
</style>
