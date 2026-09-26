<script lang="ts">
  import { onMount } from 'svelte';
  import { summarize, type Backup } from '$lib/backup';
  import { peek } from '$lib/mirror';
  import Icon from './Icon.svelte';
  import BackupConfirm from './BackupConfirm.svelte';

  let loading = $state(true);
  let found = $state<Backup | null>(null);
  let pending = $state<Backup | null>(null);
  let error = $state('');

  // プリレンダーには IndexedDB が無いので mount 後に読む
  onMount(() => {
    peek()
      .then((b) => (found = b))
      .finally(() => (loading = false));
  });

  const sum = $derived(found ? summarize(found) : null);
</script>

<div class="mirror">
  {#if loading}
    <p>自動バックアップを確かめています…</p>
  {:else if !sum}
    <p>まだ自動バックアップはありません。遊んだ記録は、アプリを閉じるときなどに、この端末の中へ自動で保存されます。</p>
  {:else}
    <p>
      <b>{sum.at}</b> に自動で保存した記録があります（{sum.games} 本のゲーム）。記録が消えてしまったときは、ここから元に戻せます。
    </p>
    <div class="row">
      <button class="pill" onclick={() => (pending = found)}><Icon name="upload" size="20px" />この記録に戻す</button>
    </div>
  {/if}
  {#if error}<p class="err" role="alert">{error}</p>{/if}
  {#if pending}
    {#key pending}
      <BackupConfirm
        {pending}
        from="自動で保存"
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

  .err {
    color: var(--p2-deep);
  }
</style>
