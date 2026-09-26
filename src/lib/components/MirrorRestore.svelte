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
    <p>控えを読んでいます…</p>
  {:else if !sum}
    <p>この端末にはまだ控えがありません。遊んだ記録は、画面を閉じるときなどに自動で控えます。</p>
  {:else}
    <p>
      <b>{sum.at}</b> 時点の控えがあります（{sum.games} 本のゲームの記録・{sum.keys} 件）。記録が消えて自動で戻らなかったときは、ここから戻せます。
    </p>
    <div class="row">
      <button class="pill" onclick={() => (pending = found)}><Icon name="upload" size="20px" />控えから戻す</button>
    </div>
  {/if}
  {#if error}<p class="err" role="alert">{error}</p>{/if}
  {#if pending}
    {#key pending}
      <BackupConfirm
        {pending}
        from="控え"
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
