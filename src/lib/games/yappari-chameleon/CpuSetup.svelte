<script lang="ts">
  import { STRENGTHS, type CpuChoice } from './cpu/levels';

  let {
    choice = $bindable(),
    onstart,
    onclose
  }: { choice: CpuChoice; onstart: () => void; onclose: () => void } = $props();
  const COUNTS = [1, 2] as const;
  const hide = $derived(choice.side === 'hide');

  // 隠れるときはプレイヤー 1 人が隠れ、見つかった時点で終わるので、増え鬼にしない
  function hiding() {
    choice.side = 'hide';
    choice.mode = 'normal';
  }
</script>

<div class="sheet" role="dialog" aria-label="CPU の設定">
  <h2>CPU の設定</h2>
  <div class="row">
    <span>役</span>
    <span class="pick">
      <button class:on={hide} aria-pressed={hide} onclick={hiding}>隠れる</button>
      <button class:on={!hide} aria-pressed={!hide} onclick={() => (choice.side = 'seek')}>探す</button>
    </span>
  </div>
  <div class="row">
    <span>CPU の人数</span>
    <span class="pick">
      {#each COUNTS as n (n)}
        <button class:on={choice.count === n} aria-pressed={choice.count === n} onclick={() => (choice.count = n)}
          >{n}</button
        >
      {/each}
    </span>
  </div>
  <div class="row" class:dim={hide}>
    <span>ゲームモード</span>
    <span class="pick">
      <button
        class:on={choice.mode === 'normal'}
        aria-pressed={choice.mode === 'normal'}
        onclick={() => (choice.mode = 'normal')}>通常</button
      >
      <button
        class:on={choice.mode === 'infect'}
        aria-pressed={choice.mode === 'infect'}
        disabled={hide}
        onclick={() => (choice.mode = 'infect')}>増え鬼</button
      >
    </span>
  </div>
  <div class="row">
    <span>強さ</span>
    <span class="pick">
      {#each STRENGTHS as s (s.id)}
        <button
          class:on={choice.strength === s.id}
          aria-pressed={choice.strength === s.id}
          onclick={() => (choice.strength = s.id)}>{s.name}</button
        >
      {/each}
    </span>
  </div>
  <p class="note">{hide ? 'CPU のハンターから隠れる。見つかったら終わり' : '隠れた CPU を探して撃つ'}</p>
  <div class="actions">
    <button onclick={onclose}>閉じる</button>
    <button class="go" onclick={onstart}>ゲームを始める</button>
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
    text-shadow: none;
  }

  h2 {
    margin: 0 0 4px;
    font-size: 22px;
    font-weight: normal;
  }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .dim {
    opacity: 0.4;
  }

  .pick {
    display: flex;
    gap: 8px;
  }

  .note {
    margin: 0;
    text-align: right;
    font-size: 14px;
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

  button:disabled {
    opacity: 0.45;
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
</style>
