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
    <button class="pill gold" onclick={update} disabled={updating}>{updating ? '更新中…' : '最新版に更新'}</button>
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
    margin: 0 auto 26px;
    padding: 12px 18px;
    border: 3px solid #fff;
    border-radius: 20px;
    background: rgb(255 255 255 / 0.7);
    color: var(--ink-soft);
    font-size: 13px;
    font-weight: 700;
    text-align: center;
  }

  /* 新版があるときだけ目立たせる */
  .ready {
    background: #fff3c4;
    box-shadow: 0 6px 0 var(--gold);
    color: var(--ink);
  }

  .ready .state {
    font-size: 15px;
    font-weight: 800;
  }

  .ready .pill {
    padding: 10px 24px;
    font-size: 16px;
  }

  .check {
    padding: 6px 14px;
    border: 2px solid var(--card-edge);
    border-radius: 999px;
    background: var(--card);
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
  }

  button:disabled {
    cursor: default;
    opacity: 0.6;
  }

  .version {
    flex-basis: 100%;
    font-size: 11px;
    opacity: 0.7;
  }

  .error {
    flex-basis: 100%;
    color: var(--p2-deep);
  }
</style>
