<script lang="ts">
  import { LIMITS, type Settings } from './referee';

  let {
    settings = $bindable(),
    players,
    onstart,
    onclose
  }: { settings: Settings; players: number; onstart: () => void; onclose: () => void } = $props();

  const rows = [
    { key: 'hide', label: 'ハンター待機時間（秒）', step: 10, range: LIMITS.hide },
    { key: 'search', label: '探索時間（秒）', step: 30, range: LIMITS.search },
    { key: 'reveal', label: '答え合わせ時間（秒）', step: 5, range: LIMITS.reveal },
    { key: 'taunt', label: '強制挑発間隔（秒）', step: 5, range: [0, LIMITS.taunt[1]] }
  ] as const;
  const most = $derived(Math.max(1, players - 1));
  // 保存した人数が今の人数より多くても、見せる数と増減はいまの上限に合わせる
  const hunters = $derived(Math.min(settings.hunters, most));
</script>

<div class="sheet" role="dialog" aria-label="マップの設定">
  <h2>マップの設定</h2>
  <div class="row">
    <span>ゲームモード</span>
    <span class="pick">
      <button class:on={settings.mode === 'normal'} onclick={() => (settings.mode = 'normal')}>通常</button>
      <button class:on={settings.mode === 'infect'} onclick={() => (settings.mode = 'infect')}>増え鬼</button>
    </span>
  </div>
  <div class="row">
    <span>ハンターの人数</span>
    <span class="pick">
      <button aria-label="減らす" onclick={() => (settings.hunters = Math.max(1, hunters - 1))}>−</button>
      <span class="value">{hunters}</span>
      <button aria-label="増やす" onclick={() => (settings.hunters = Math.min(most, hunters + 1))}>＋</button>
    </span>
  </div>
  {#each rows as r (r.key)}
    <label class="row">
      <span>{r.label}</span>
      <input type="range" min={r.range[0]} max={r.range[1]} step={r.step} bind:value={settings[r.key]} />
      <span class="value">{settings[r.key]}</span>
    </label>
  {/each}
  {#if players < 2}<p class="note">2人以上そろうと始められます</p>{/if}
  <div class="actions">
    <button onclick={onclose}>閉じる</button>
    <button class="go" disabled={players < 2} onclick={onstart}>ゲームを始める</button>
  </div>
</div>

<style>
  .sheet {
    position: absolute;
    top: 50%;
    left: 50%;
    translate: -50% -50%;
    display: grid;
    gap: 12px;
    width: min(560px, 92cqw);
    padding: 20px 26px;
    border-radius: 14px;
    background: rgb(20 18 16 / 0.92);
    color: #fff;
    font-family: 'Hiragino Mincho ProN', serif;
    font-size: 16px;
  }

  h2 {
    margin: 0 0 4px;
    font-size: 22px;
    font-weight: normal;
  }

  .note {
    margin: 0;
    text-align: right;
    font-size: 14px;
  }

  .row {
    display: grid;
    grid-template-columns: 1fr auto auto;
    align-items: center;
    gap: 12px;
  }

  .pick {
    display: flex;
    align-items: center;
    gap: 8px;
    grid-column: 2 / 4;
    justify-self: end;
  }

  .value {
    min-width: 4.5em;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  input {
    width: min(200px, 30cqw);
  }

  button {
    padding: 6px 16px;
    border: 2px solid rgb(255 255 255 / 0.85);
    border-radius: 999px;
    background: rgb(0 0 0 / 0.35);
    color: #fff;
    font: inherit;
  }

  button.on {
    background: rgb(255 255 255 / 0.9);
    color: #1d1a17;
  }

  .actions {
    display: flex;
    justify-content: space-between;
    margin-top: 6px;
  }

  .go {
    border-color: #7cc243;
    background: #3f8a2a;
  }

  .go:disabled {
    opacity: 0.45;
  }
</style>
