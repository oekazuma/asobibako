<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import type { Save } from './engine';
  import { progress, STAMPS, suggest } from './stamps';

  let { save }: { save: Save } = $props();

  const got = $derived(new Set(save.stamps));
  const count = $derived(STAMPS.filter((s) => got.has(s.id)).length);
  let picked = $state<string | null>(null);
  const shown = $derived(STAMPS.find((s) => s.id === picked) ?? suggest(save));
  const title = $derived(
    !picked ? 'つぎの おすすめ' : shown && got.has(shown.id) ? 'もらった スタンプ' : 'まだの スタンプ'
  );
</script>

<p class="count"><b>{count}</b> / {STAMPS.length}こ あつめたよ</p>

{#if shown}
  {@const done = got.has(shown.id)}
  <div class="detail">
    <span class="face big" class:done style:--c={shown.color}>
      <Icon name={shown.icon} size="64%" />
    </span>
    <div class="text">
      <p class="title">{title}</p>
      <p class="name">{shown.name}</p>
      <p>{shown.note}</p>
      {#if !done && shown.need > 1}
        <p class="bar">
          <span class="fill" style:width="{progress(save, shown) * 100}%"></span>
          <span class="num">{Math.min(shown.have(save), shown.need)} / {shown.need}</span>
        </p>
      {/if}
      {#if shown.reward}
        <p><Icon name="coin" /> {done ? 'もらった' : 'ごほうび'} {shown.reward}コイン</p>
      {/if}
    </div>
  </div>
{:else}
  <p class="detail name">ぜんぶ あつめたよ！ すごい！</p>
{/if}

<div class="sheet">
  {#each STAMPS as s (s.id)}
    {@const done = got.has(s.id)}
    <button
      class="face"
      class:done
      class:on={shown?.id === s.id}
      style:--c={s.color}
      aria-label={done ? s.name : `まだの スタンプ ${s.name}`}
      aria-pressed={shown?.id === s.id}
      onclick={() => (picked = s.id)}
    >
      <Icon name={s.icon} size="60%" />
      {#if !done}<span class="q">？</span>{/if}
    </button>
  {/each}
</div>

<style>
  p {
    margin: 0;
  }

  .count {
    margin-bottom: 10px;
    font-size: 16px;
    font-weight: 800;
    text-align: center;
  }

  b {
    font-size: 24px;
    color: #ff7a00;
  }

  /* 台紙を下までスクロールしても、押したスタンプの説明が見えるように上に留める */
  .detail {
    position: sticky;
    top: 0;
    z-index: 1;
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 12px;
    padding: 12px 14px;
    border: 3px solid var(--line);
    border-radius: 20px;
    background: #fff;
    box-shadow: var(--soft-shadow);
    font-size: 14px;
    font-weight: 700;
    line-height: 1.5;
  }

  .text {
    flex: 1;
    min-width: 0;
  }

  .title {
    font-size: 12px;
    color: #a08c80;
  }

  .name {
    font-size: 18px;
    font-weight: 800;
  }

  .bar {
    position: relative;
    height: 20px;
    margin-top: 6px;
    overflow: hidden;
    border: 2px solid var(--line);
    border-radius: 999px;
    background: #f4ece2;
  }

  .fill {
    position: absolute;
    inset: 0 auto 0 0;
    background: var(--pastel-gold);
  }

  .num {
    position: relative;
    display: block;
    font-size: 12px;
    font-weight: 800;
    line-height: 16px;
    text-align: center;
  }

  /* 台紙。押したスタンプは少し傾けて、はんこらしくする */
  .sheet {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(52px, 1fr));
    gap: 10px;
    padding: 14px;
    border: 3px dashed #d9c7b5;
    border-radius: 20px;
    background: #fffaf0;
  }

  .face {
    position: relative;
    display: grid;
    place-items: center;
    width: 100%;
    aspect-ratio: 1;
    padding: 0;
    border: 3px dashed #cdbcad;
    border-radius: 50%;
    background: #f6efe6;
    cursor: pointer;
  }

  .face :global(svg) {
    opacity: 0.22;
    filter: grayscale(1);
  }

  .face.done {
    border: 5px solid var(--c);
    background: color-mix(in srgb, var(--c) 18%, #fff);
    rotate: -8deg;
  }

  .face.done :global(svg) {
    opacity: 1;
    filter: none;
  }

  .face.on {
    outline: 4px solid var(--pastel-gold);
    outline-offset: 2px;
  }

  .big {
    flex: none;
    width: 72px;
    cursor: default;
  }

  .q {
    position: absolute;
    font-size: 22px;
    font-weight: 800;
    color: #a08c80;
  }
</style>
