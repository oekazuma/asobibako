<script lang="ts">
  let { name }: { name: string } = $props();
</script>

<div class="band" role="alert">
  <strong>WARNING!</strong>
  <span>{name}が出現！</span>
</div>

<style>
  .band {
    position: absolute;
    top: 28%;
    left: 0;
    right: 0;
    z-index: 3;
    display: grid;
    place-items: center;
    gap: 2px;
    padding: min(1.6cqh, 12px) 0;
    border-block: 4px solid #24151f;
    background: repeating-linear-gradient(-45deg, rgb(216 70 60 / 0.9) 0 18px, rgb(36 21 31 / 0.9) 18px 36px);
    color: #fff;
    font-weight: 900;
    text-shadow:
      2px 2px 0 #24151f,
      -2px -2px 0 #24151f,
      2px -2px 0 #24151f,
      -2px 2px 0 #24151f;
    pointer-events: none;
    animation:
      enter 300ms steps(5),
      blink 600ms steps(2) infinite 300ms;
  }

  strong {
    font-size: min(9cqw, 5.4cqh, 56px);
    letter-spacing: 0.16em;
    color: #ffd84a;
  }

  span {
    font-size: min(5cqw, 3cqh, 28px);
  }

  @keyframes enter {
    from {
      translate: -100% 0;
    }
  }

  @keyframes blink {
    50% {
      opacity: 0.55;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .band {
      animation: none;
    }
  }
</style>
