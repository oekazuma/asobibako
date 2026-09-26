<script lang="ts">
  import { onMount } from 'svelte';
  import { version } from '$app/environment';
  import Icon from './Icon.svelte';
  import BackupConfirm from './BackupConfirm.svelte';
  import { backedUpAt, backupFile, backupName, exportAll, markBackedUp, parseBackup, type Backup } from '$lib/backup';

  let pending = $state<Backup | null>(null);
  let error = $state('');
  let canShare = $state(false);
  let lastAt = $state<string | null>(null);

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
    } catch {
      error = '読み込めませんでした。「記録を書き出す」で保存したファイルを選んでください。';
    }
  }
</script>

<div class="backup">
  <p>到達したレベルなどの記録を 1 つのファイルに書き出せます。端末を替えるときや、データを消す前に。</p>
  <p>{lastAt ? `最後に書き出した日: ${lastAt}` : 'まだ書き出していません。'}</p>
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
  {#if pending}
    {#key pending}
      <BackupConfirm
        {pending}
        oncancel={() => (pending = null)}
        onfail={(message) => {
          pending = null;
          error = message;
        }}
      />
    {/key}
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

  .err {
    color: var(--p2-deep);
  }
</style>
