<script lang="ts">
  let { from, to }: { from: string; to: string } = $props();
</script>

<div class="plate" role="status">
  <strong>{from} → {to}</strong>
  <span>攻撃 +10%・最大 HP +20・HP 全快</span>
</div>

<style>
  .plate {
    position: absolute;
    top: 60%;
    left: 50%;
    z-index: 4;
    display: grid;
    place-items: center;
    gap: 4px;
    max-width: calc(100% - 24px);
    padding: min(1.4cqh, 10px) min(5cqw, 28px);
    border: 4px solid #24151f;
    background: #ffd84a;
    box-shadow: 0 0 0 3px #fff3d6;
    color: #24151f;
    font-weight: 900;
    white-space: nowrap;
    translate: -50% 0;
    pointer-events: none;
    animation: enter 300ms steps(5);
  }

  strong {
    font-size: min(5.6cqw, 3.4cqh, 36px);
  }

  span {
    color: #8e2430;
    font-size: min(3.6cqw, 2.1cqh, 18px);
  }

  @keyframes enter {
    from {
      scale: 1.5;
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .plate {
      animation: none;
    }
  }
</style>
