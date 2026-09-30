<script lang="ts">
  let {
    combo,
    speed,
    keep
  }: {
    combo: number;
    /** 速さの倍率（1 から 2） */
    speed: number;
    /** コンボが切れるまでの残り（1 から 0） */
    keep: number;
  } = $props();
</script>

{#if combo > 0}
  {#key combo}
    <div class="combo">
      <b>{combo}</b>
      <span class="spd">SPD × {speed.toFixed(1)}</span>
      <i style:--keep={keep}></i>
    </div>
  {/key}
{/if}

<style>
  .combo {
    position: absolute;
    pointer-events: none;
    color: #fff;
    font-style: italic;
    font-weight: 900;
    -webkit-text-stroke: 0.06em #262833;
    paint-order: stroke fill;
    left: 5cqw;
    top: 44%;
    display: grid;
    justify-items: center;
    animation: bump 0.18s var(--spring);
  }
  .combo b {
    font-size: min(10cqh, 17cqw);
    line-height: 1;
  }
  .spd {
    padding: 2px 10px;
    border: 3px solid #262833;
    background: #ffd23a;
    color: #262833;
    font-size: min(1.8cqh, 3.2cqw);
    -webkit-text-stroke: 0;
    transform: skewX(-12deg);
  }
  .combo i {
    width: 100%;
    height: 7px;
    margin-top: 4px;
    border: 2px solid #262833;
    background: linear-gradient(90deg, #ff4d8b calc(var(--keep) * 100%), rgb(255 255 255 / 0.6) 0);
  }

  @keyframes bump {
    from {
      scale: 1.2;
    }
    to {
      scale: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .combo {
      animation: none;
    }
  }
</style>
