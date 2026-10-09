<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import { nameOf } from './match.svelte';
  import type { Session } from './session.svelte';

  let { session }: { session: Session } = $props();
  const match = $derived(session.match);
  const used = $derived(match.view.liked.includes(match.me));
</script>

<!-- 頭の上の札は 3D の体の上にあって押しにくいので、右に名前とボタンを並べる -->
<ul class="iine" aria-label="ええやん">
  {#each match.view.hid as seat (seat)}
    <li>
      <span>{nameOf(seat)}</span>
      <span class="count"><Icon name="thumb" size="18px" />{match.view.likes[seat] ?? 0}</span>
      {#if seat !== match.me}
        <button
          data-seat={seat}
          aria-label="{nameOf(seat)}にええやん"
          disabled={used}
          onpointerdown={() => session.like(seat)}>ええやん</button
        >
      {/if}
    </li>
  {/each}
</ul>

<style>
  .iine {
    position: absolute;
    top: max(12px, env(safe-area-inset-top));
    right: max(14px, env(safe-area-inset-right));
    display: grid;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
    color: #fff;
    font-family: 'Hiragino Mincho ProN', serif;
    font-size: 16px;
    text-shadow: 0 1px 3px #000;
    pointer-events: none;
  }

  li {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
  }

  .count {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    color: #ffd23f;
    font-variant-numeric: tabular-nums;
  }

  button {
    padding: 4px 14px;
    border: 2px solid rgb(255 255 255 / 0.85);
    border-radius: 999px;
    background: rgb(0 0 0 / 0.4);
    color: #fff;
    font: inherit;
    pointer-events: auto;
  }

  button:disabled {
    opacity: 0.45;
  }
</style>
