<script lang="ts">
  let { onback }: { onback: () => void } = $props();
</script>

<!-- 一覧をスクロールしても見えるよう、スクロールする .as-screen の外に置いて上に留める。
     帯は .as-screen と同じ地で、下を流れる一覧を隠す -->
<div class="bar">
  <button class="as-card back" onclick={onback}>‹ もどる</button>
</div>

<style>
  .bar {
    position: absolute;
    inset: 0 0 auto;
    z-index: 6;
    height: max(68px, calc(env(safe-area-inset-top) + 56px));
    padding: max(12px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) 0
      max(12px, env(safe-area-inset-left));
    background:
      radial-gradient(circle, rgb(255 255 255 / 0.06) 1.5px, transparent 2px) 0 0 / 18px 18px,
      #1f1530;
  }

  .back {
    padding: 8px 16px;
    font-size: min(4cqw, 2.4cqh, 20px);
  }
</style>
