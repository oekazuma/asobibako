<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';

  let { level, wallet, goal, hint }: { level: number; wallet: number; goal: number; hint: string } = $props();
</script>

<div class="hud">
  <span class="chip sticker">レベル {level}</span>
  <span class="chip wallet"><Icon name="coin" /> {wallet}</span>
  <span class="chip goal"><Icon name="house" /> まで あと {goal}</span>
</div>
{#key hint}
  <p class="hint sticker" role="status">{hint}</p>
{/key}

<style>
  .hud {
    position: absolute;
    top: 14px;
    left: 72px;
    right: 16px;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
    pointer-events: none;
  }

  /* いまやることの吹き出し。変わるたびに弾んで出る */
  .hint {
    position: absolute;
    top: 62px;
    left: 50%;
    padding: 8px 20px;
    border: 4px solid #fff;
    border-radius: 999px;
    background: var(--gold);
    box-shadow: var(--lift);
    color: var(--ink);
    font-size: clamp(18px, 2.6dvh, 24px);
    white-space: nowrap;
    translate: -50% 0;
    pointer-events: none;
    animation: pop 420ms var(--spring);
  }

  @keyframes pop {
    from {
      scale: 0.4;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .hint {
      animation: none;
    }
  }

  .chip {
    padding: 4px 14px;
    border: 3px solid #fff;
    border-radius: 999px;
    background: rgb(255 255 255 / 0.85);
    box-shadow: 0 3px 0 rgb(43 45 66 / 0.12);
    font-size: 18px;
    font-weight: 800;
  }

  .wallet {
    background: var(--gold);
  }
</style>
