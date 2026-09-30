<script lang="ts">
  import { COLUMNS, cycle } from './kana';

  let { disabled = false, onsubmit }: { disabled?: boolean; onsubmit: (text: string) => void } = $props();

  const MAX = 10;
  /** 50 音表のポスターと同じく、あ行を右端に置いて左へ並べる */
  const KEYS = COLUMNS.flatMap((column, x) =>
    column.map((ch, y) => ({ ch, column: COLUMNS.length - x, row: y + 1 })).filter((key) => key.ch)
  );
  let text = $state('');

  const put = (ch: string) => {
    if (!disabled && text.length < MAX) text += ch;
  };
  const turn = () => {
    if (!disabled && text) text = text.slice(0, -1) + cycle(text.slice(-1));
  };
  function send() {
    if (disabled || !text) return;
    onsubmit(text);
    text = '';
  }
</script>

<div class="pad">
  <p class="typed" aria-live="polite">{text || 'こたえを いれてね'}</p>
  <div class="keys">
    {#each KEYS as key (key.ch)}
      <button class="key" style:grid-column={key.column} style:grid-row={key.row} {disabled} onclick={() => put(key.ch)}
        >{key.ch}</button
      >
    {/each}
  </div>
  <div class="row">
    <button class="key wide" {disabled} aria-label="だくてん・はんだくてん・ちいさいじ" onclick={turn}>゛゜小</button>
    <button class="key" {disabled} onclick={() => put('ー')}>ー</button>
    <button class="key wide" {disabled} onclick={() => (text = text.slice(0, -1))}>1じ けす</button>
    <button class="pill gold send" disabled={disabled || !text} onclick={send}>こたえる</button>
  </div>
</div>

<style>
  .pad {
    display: grid;
    gap: 6px;
    padding: 8px max(8px, env(safe-area-inset-left)) max(8px, env(safe-area-inset-bottom));
    background: var(--paper);
    border-top: 3px solid var(--line);
  }

  .typed {
    min-height: 1.6em;
    font-size: clamp(20px, 3.4cqh, 30px);
    font-weight: 800;
    color: var(--line);
    text-align: center;
    letter-spacing: 0.1em;
  }

  .keys {
    display: grid;
    grid-template-columns: repeat(10, 1fr);
    gap: 4px;
  }

  .row {
    display: flex;
    gap: 6px;
  }

  .key {
    min-height: clamp(34px, 5.2cqh, 54px);
    border: 2px solid var(--line);
    border-radius: 10px;
    background: #fff;
    color: var(--line);
    font-size: clamp(16px, 2.6cqh, 24px);
    font-weight: 800;
    box-shadow: var(--soft-press);
    cursor: pointer;
  }

  .key:active {
    translate: 0 2px;
    box-shadow: none;
  }

  .row > .key {
    min-width: 2.6em;
  }

  .key.wide {
    flex: 1;
    font-size: clamp(14px, 2.2cqh, 20px);
  }

  .send {
    flex: 1.4;
    padding: 8px 12px;
  }

  button:disabled {
    opacity: 0.45;
  }
</style>
