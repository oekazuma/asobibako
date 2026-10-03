<script lang="ts">
  let { epithet, name }: { epithet: string; name: string } = $props();
</script>

<div class="plate" role="alert">
  <span class="epithet">{epithet}</span>
  <!-- 面の主は 2 体の名前が並ぶので、iPhone の幅に収まるよう字を小さくする -->
  <strong class:long={name.length > 6}>{name}</strong>
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
    padding: min(1.4cqh, 10px) min(6cqw, 32px);
    border: 4px solid #24151f;
    background: rgb(36 21 31 / 0.88);
    box-shadow: 0 0 0 3px #d8463c;
    color: #fff;
    font-weight: 900;
    max-width: calc(100% - 24px);
    white-space: nowrap;
    translate: -50% 0;
    pointer-events: none;
    animation: enter 360ms steps(6);
  }

  .epithet {
    color: #ffd84a;
    font-size: min(4.4cqw, 2.6cqh, 24px);
    letter-spacing: 0.12em;
  }

  strong {
    font-size: min(9cqw, 5.4cqh, 54px);
    letter-spacing: 0.06em;
    text-shadow:
      3px 3px 0 #d8463c,
      -2px -2px 0 #24151f;
  }

  .long {
    font-size: min(6.4cqw, 4cqh, 40px);
  }

  @keyframes enter {
    from {
      scale: 1.6;
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .plate {
      animation: none;
    }
  }
</style>
