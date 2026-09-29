<script lang="ts">
  import { wake } from '$lib/audio.svelte';
  import Closet from './Closet.svelte';
  import IdolCanvas from './IdolCanvas.svelte';
  import { bonusOf, THEMES, type Save, type Slot, type Theme } from './outfits';
  import { THEME, TITLE } from './song';

  /** ステージのじゅんび。アイドルのプロフィールと着がえ、きょうの曲を見て、ライブを始める */
  let { save, onwear, onstart }: { save: Save; onwear: (slot: Slot, theme: Theme) => void; onstart: () => void } =
    $props();

  const bonus = $derived(Math.round(bonusOf(save.coord, THEME) * 100));
</script>

<div class="dress">
  <header>
    <h2 class="yuru">ステージの じゅんび</h2>
    <p class="fans">ファン <b>{save.fans.toLocaleString()}</b> にん</p>
  </header>
  <section class="idol">
    <div class="spot" aria-hidden="true"></div>
    <IdolCanvas coord={save.coord} />
    <div class="profile">
      <p class="name">ひなた ミオ</p>
      <p class="about">げんき いっぱいの しんじん アイドル。すきな ものは いちごミルク と ジャンプ！</p>
      <p class="about">ゆめは みんなを えがおに する ステージ</p>
    </div>
  </section>
  <Closet coord={save.coord} fans={save.fans} match={THEME} {onwear} />
  <section class="song">
    <p class="label">きょうの きょく</p>
    <p class="title">{TITLE}</p>
    <p class="theme" style:--c={THEMES[THEME].color}>テーマ {THEMES[THEME].name}</p>
    <p class="bonus">コーデ ボーナス <b>+{bonus}%</b></p>
  </section>
  <button
    class="pill gold go"
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

  .idol :global(canvas) {
    position: relative;
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

  .song {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 14px;
    padding: 10px 16px;
    border: 3px solid var(--line);
    border-radius: 18px;
    background: #fff;
    font-size: clamp(13px, min(1.9cqh, 3.6cqw), 20px);
  }

  .song p {
    margin: 0;
  }

  .label {
    width: 100%;
    font-size: 0.8em;
  }

  .title {
    font-weight: 800;
    font-size: 1.4em;
  }

  .theme {
    padding: 2px 10px;
    border-radius: 999px;
    background: var(--c);
    color: #fff;
    font-weight: 800;
  }

  .bonus b {
    color: #ff5c9a;
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
