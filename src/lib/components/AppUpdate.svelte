<script lang="ts">
  import { version } from '$app/environment';
  import { updated } from '$app/state';
  import { updateApp } from '$lib/pwa';

  // version は「ビルド時刻(ms)-git の短いハッシュ」（vite.config.ts）
  const [stamp, hash = ''] = version.split('-');
  const built = Number.isFinite(Number(stamp)) ? new Date(Number(stamp)).toLocaleString('ja-JP') : stamp;

  let checking = $state(false);
  let checked = $state(false);
  let updating = $state(false);
  let error = $state('');

  async function check() {
    checking = true;
    try {
      await updated.check();
    } finally {
      checking = false;
      checked = true;
    }
  }

  function update() {
    if (!navigator.onLine) {
      error = 'インターネットに接続してから押してください';
      return;
    }
    updating = true;
    error = '';
    updateApp().catch(() => {
      updating = false;
      error = '更新できませんでした。しばらくしてからもう一度押してください';
    });
  }
</script>

<section class="update" class:ready={updated.current} aria-live="polite">
  {#if updated.current}
    <p class="state">あたらしいバージョンがあります</p>
    <button class="primary" onclick={update} disabled={updating}>{updating ? '更新中…' : '最新版に更新'}</button>
  {:else}
    <p class="state">{checking ? '確認しています…' : checked ? '確認しました（最新版です）' : '最新版です'}</p>
    <button class="check" onclick={check} disabled={checking}>あたらしいバージョンがないか確認する</button>
  {/if}
  {#if error}<small class="error">{error}</small>{/if}
  <small class="version">いまのバージョン: {built}（{hash || version}）</small>
</section>

<style>
  .update {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 8px 14px;
    max-width: 960px;
    margin: 0 auto 24px;
    padding: 12px 16px;
    border: 1px solid #262c39;
    border-radius: 14px;
    font-size: 13px;
    text-align: center;
  }

  /* 新版があるときだけ目立たせる */
  .ready {
    border-color: var(--gold);
    background: rgb(251 191 36 / 0.1);
  }

  .state {
    opacity: 0.8;
  }

  .ready .state {
    font-weight: 700;
    opacity: 1;
  }

  button {
    border-radius: 999px;
    cursor: pointer;
  }

  .primary {
    padding: 10px 22px;
    border: none;
    background: var(--gold);
    color: #1b1e27;
    font-size: 15px;
    font-weight: 700;
  }

  .check {
    padding: 6px 14px;
    border: 1px solid #39404f;
    background: transparent;
    font-size: 12px;
  }

  button:disabled {
    cursor: default;
    opacity: 0.6;
  }

  .version {
    flex-basis: 100%;
    opacity: 0.5;
  }

  .error {
    flex-basis: 100%;
    color: #fca5a5;
  }
</style>
