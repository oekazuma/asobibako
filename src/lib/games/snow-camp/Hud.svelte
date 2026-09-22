<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';

  let { level, wallet, goal }: { level: number; wallet: number; goal: number } = $props();
</script>

<div class="hud">
  <span class="chip sticker">レベル {level}</span>
  <span class="chip wallet"><Icon name="coin" /> {wallet}</span>
  <span class="chip goal"><Icon name="house" /> まで あと {goal}</span>
</div>

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
