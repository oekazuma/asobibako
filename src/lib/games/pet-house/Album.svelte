<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import { MAX_PHOTOS } from './engine';

  let { photos }: { photos: string[] } = $props();

  // 同じ絵の写真が 2 枚あると each の鍵がぶつかるので 1 枚にまとめる
  const shots = $derived([...new Set(photos)]);
  let big = $state<number | null>(null);
</script>

{#if big !== null && shots[big]}
  <div class="big">
    <img src={shots[big]} width="480" height="640" alt="{big + 1}まいめの しゃしん" />
    <button class="pill" onclick={() => (big = null)}>もどる</button>
  </div>
{:else if shots.length === 0}
  <p class="empty">
    まだ しゃしんが ないよ。<br />ひだりの <Icon name="camera" /> で とってみよう
  </p>
{:else}
  <p class="lead">あたらしい じゅんに {MAX_PHOTOS}まいまで のこるよ</p>
  <div class="grid">
    {#each shots as url, i (url)}
      <button class="thumb" onclick={() => (big = i)} aria-label="{i + 1}まいめを おおきく みる">
        <img src={url} width="480" height="640" alt="" />
      </button>
    {/each}
  </div>
{/if}

<style>
  .lead,
  .empty {
    margin-bottom: 12px;
    font-size: 15px;
    font-weight: 700;
    text-align: center;
  }

  .empty {
    padding: 24px 0;
    line-height: 1.8;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
  }

  .thumb {
    overflow: hidden;
    aspect-ratio: 3 / 4;
    padding: 0;
    border: 3px solid var(--line);
    border-radius: 14px;
    background: #fff;
    box-shadow: var(--soft-shadow);
    cursor: pointer;
  }

  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .big {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .big img {
    width: auto;
    max-width: 100%;
    height: auto;
    max-height: 48cqh;
    border: 4px solid #fff;
    border-radius: 16px;
    box-shadow: var(--soft-shadow);
  }
</style>
