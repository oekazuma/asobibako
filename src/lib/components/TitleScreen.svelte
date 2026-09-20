<script lang="ts">
  import { audio, toggleMute } from '$lib/audio.svelte';
  import type { Player } from '$lib/player';

  let {
    gameName,
    ready,
    onpaddown,
    onpadup
  }: {
    gameName: string;
    ready: Record<Player, boolean>;
    onpaddown: (event: PointerEvent, player: Player) => void;
    onpadup: (event: PointerEvent, player: Player) => void;
  } = $props();
</script>

{#snippet face(player: Player)}
  <!-- 向かい側は手前側を 180 度回した写しなので、見出しとして数えるのは手前側だけ -->
  {#if player === 1}
    <h1 class="title">{gameName}</h1>
  {:else}
    <span class="title">{gameName}</span>
  {/if}
  <span class="rule">自分の玉を消して境界線を押し込む</span>
  <span class="legend">
    <span class="item"><span class="mark tap"></span>タップ</span>
    <span class="item"><span class="mark hold"></span>長押し</span>
    <span class="item"><span class="mark contest"></span>早い者勝ち</span>
  </span>
  <span class="cta">{ready[player] ? '相手を待っています…' : '長押しでスタート'}</span>
{/snippet}

{#each [2, 1] as const as player (player)}
  <button
    class="half p{player}"
    class:armed={ready[player]}
    onpointerdown={(e) => onpaddown(e, player)}
    onpointerup={(e) => onpadup(e, player)}
    onpointercancel={(e) => onpadup(e, player)}
  >
    {@render face(player)}
  </button>
{/each}

<button class="mute" onclick={toggleMute} aria-pressed={audio.muted}>
  {audio.muted ? '🔇' : '🔊'}
  <span class="sr-only">音を{audio.muted ? 'オンにする' : 'オフにする'}</span>
</button>

<style>
  .half.p1.armed {
    background: var(--zone-1);
  }

  .half.p2.armed {
    background: var(--zone-2);
  }

  .title {
    font-size: clamp(26px, 5dvh, 46px);
    font-weight: 800;
    letter-spacing: 0.12em;
  }

  .rule {
    font-size: clamp(12px, 1.9dvh, 17px);
    opacity: 0.75;
  }

  .legend {
    display: flex;
    gap: clamp(12px, 3vw, 28px);
    font-size: clamp(11px, 1.6dvh, 15px);
    opacity: 0.85;
  }

  .item {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .mark {
    width: clamp(14px, 2.2dvh, 22px);
    aspect-ratio: 1;
    border-radius: 50%;
  }

  .mark.tap {
    background: currentColor;
  }

  .mark.hold {
    border: 3px solid currentColor;
  }

  .mark.contest {
    background: var(--gold);
  }

  .cta {
    margin-top: clamp(4px, 1dvh, 12px);
    padding: 10px 22px;
    border: 1px solid #39404f;
    border-radius: 999px;
    font-size: clamp(13px, 2dvh, 18px);
  }

  /* どちらのプレイヤーからも等距離になるよう、境界線の高さの右端に置く */
  .mute {
    position: absolute;
    top: 50%;
    right: 10px;
    translate: 0 -50%;
    width: 44px;
    height: 44px;
    border: 1px solid #262c39;
    border-radius: 50%;
    background: #171c26;
    font-size: 18px;
    cursor: pointer;
  }
</style>
