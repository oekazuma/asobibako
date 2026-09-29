<script lang="ts">
  import { wake } from '$lib/audio.svelte';
  import Closet from './Closet.svelte';
  import IdolPreview from './IdolPreview.svelte';
  import type { Level } from './chart';
  import type { Idol3D } from './idol3d';
  import type { Save, Slot, Theme } from './outfits';
  import SongCard from './SongCard.svelte';
  import { trackOf } from './songs';

  /** ステージのじゅんび。アイドルのプロフィールと着がえ、きょうの曲とむずかしさを選んで、ライブを始める */
  let {
    idol,
    save,
    onwear,
    onsong,
    onlevel,
    onstart
  }: {
    /** 読みこんだアイドル。読みおわるまでは null */
    idol: Idol3D | null;
    save: Save;
    onwear: (slot: Slot, theme: Theme) => void;
    onsong: (id: string) => void;
    onlevel: (level: Level) => void;
    onstart: () => void;
  } = $props();
</script>

<div class="dress">
  <header>
    <h2 class="yuru">ステージの じゅんび</h2>
    <p class="fans">ファン <b>{save.fans.toLocaleString()}</b> にん</p>
  </header>
  <section class="idol">
    <div class="spot" aria-hidden="true"></div>
    {#if idol}
      <IdolPreview {idol} coord={save.coord} />
    {:else}
      <p class="loading" role="status">よみこみちゅう…</p>
    {/if}
    <div class="profile">
      <p class="name">ひなた ミオ</p>
      <p class="about">げんき いっぱいの しんじん アイドル。すきな ものは いちごミルク と ジャンプ！</p>
      <p class="about">ゆめは みんなを えがおに する ステージ</p>
    </div>
  </section>
  <Closet coord={save.coord} fans={save.fans} match={trackOf(save.song).def.theme} {onwear} />
  <SongCard {save} {onsong} {onlevel} />
  <button
    class="pill gold go"
    disabled={!idol}
    onclick={() => {
      wake();
      onstart();
    }}>ライブ スタート！</button
  >
</div>

<style>
  .dress {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    gap: clamp(8px, 1.4cqh, 16px);
    padding: max(72px, calc(env(safe-area-inset-top) + 64px)) 16px max(16px, env(safe-area-inset-bottom));
    overflow-y: auto;
    touch-action: pan-y;
    background: var(--paper-dots), linear-gradient(#fff4fa, #ffe3f0);
    color: var(--line);
  }

  header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
  }

  h2 {
    margin: 0;
    --fill: #ff9cc4;
    font-size: clamp(22px, min(3.6cqh, 6.4cqw), 40px);
  }

  .fans {
    margin: 0;
    font-weight: 800;
    font-size: clamp(14px, min(2cqh, 3.8cqw), 22px);
  }

  .idol {
    position: relative;
    display: grid;
    grid-template-columns: 1fr 1fr;
    align-items: end;
    flex: 1;
    min-height: 34cqh;
    border: 3px solid var(--line);
    border-radius: 24px;
    background: linear-gradient(#3a1c6e, #b0508a);
    overflow: hidden;
  }

  .spot {
    position: absolute;
    inset: auto 0 0 0;
    height: 30%;
    background: radial-gradient(ellipse at 25% 90%, rgb(255 255 255 / 0.5), transparent 60%);
  }

  .idol :global(.preview) {
    height: 100%;
  }

  .profile {
    align-self: center;
    margin-right: 12px;
    padding: 12px 14px;
    border: 3px solid var(--line);
    border-radius: 18px;
    background: rgb(255 255 255 / 0.92);
    font-size: clamp(12px, min(1.8cqh, 3.4cqw), 19px);
    word-break: keep-all;
  }

  .profile p {
    margin: 0;
  }

  .name {
    color: #ff5c9a;
    font-weight: 800;
    font-size: 1.4em;
  }

  .about + .about {
    margin-top: 0.4em;
  }

  .loading {
    align-self: center;
    margin: 0;
    color: #fff;
    font-weight: 800;
  }

  .go:disabled {
    opacity: 0.5;
    animation: none;
  }

  .go {
    align-self: center;
    font-size: clamp(20px, min(3cqh, 5.6cqw), 32px);
    animation: bob 1.6s ease-in-out infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    .go {
      animation: none;
    }
  }
</style>
