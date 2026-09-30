<script lang="ts">
  let {
    level,
    time,
    followers,
    combo,
    keep,
    gauge,
    onshout
  }: {
    level: number;
    time: number;
    followers: number;
    combo: number;
    /** コンボが切れるまでの残り（1 から 0） */
    keep: number;
    /** 大声のゲージ（0 から 1） */
    gauge: number;
    onshout: () => void;
  } = $props();

  const full = $derived(gauge >= 1);
</script>

<div class="hud">
  <span class="chip sticker">レベル {level}</span>
  <span class="chip time" class:low={time <= 10}>のこり {Math.ceil(time)}</span>
  <span class="chip fans">フォロワー {followers}</span>
</div>

{#if combo > 0}
  {#key combo}
    <div class="combo">
      <b>{combo}</b>
      <small>コンボ</small>
    </div>
  {/key}
  <div class="keep" style:--keep={keep}></div>
{/if}

<div class="gauge" class:full>
  <span style:width="{gauge * 100}%"></span>
</div>
{#if full}
  <!-- 盤面の指の操作（走る向き）に拾われないよう、ここで止める -->
  <button
    class="shout pill gold"
    onpointerdown={(e) => {
      e.stopPropagation();
      onshout();
    }}>さけぶ！</button
  >
{/if}

<style>
  .hud {
    position: absolute;
    top: 14px;
    left: 72px;
    right: 72px;
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
    font-size: min(2.2cqh, 4cqw);
    font-weight: 800;
  }

  .fans {
    background: #ffd6e7;
  }

  .low {
    background: var(--p2);
    color: #fff;
  }

  .combo {
    position: absolute;
    left: 4cqw;
    top: 30%;
    display: grid;
    justify-items: center;
    color: #fff;
    text-shadow:
      0 4px 0 #ff3d8b,
      0 0 12px rgb(255 61 139 / 0.6);
    pointer-events: none;
    animation: bump 0.18s var(--spring);
  }

  .combo b {
    font-size: min(10cqh, 17cqw);
    line-height: 1;
  }

  .combo small {
    font-size: min(2.2cqh, 4cqw);
    font-weight: 800;
  }

  .keep {
    position: absolute;
    left: 4cqw;
    top: calc(30% + min(14cqh, 23cqw));
    width: min(14cqh, 22cqw);
    height: 8px;
    border-radius: 999px;
    background: linear-gradient(90deg, #ff3d8b calc(var(--keep) * 100%), rgb(255 255 255 / 0.5) 0);
    pointer-events: none;
  }

  .gauge {
    position: absolute;
    left: 50%;
    bottom: 3cqh;
    translate: -50% 0;
    width: min(60cqw, 460px);
    height: min(2cqh, 3.4cqw);
    border: 3px solid #fff;
    border-radius: 999px;
    background: rgb(43 45 66 / 0.45);
    overflow: hidden;
    pointer-events: none;
  }

  .gauge span {
    display: block;
    height: 100%;
    background: linear-gradient(90deg, #ff8ac4, #ffcf33);
    transition: width 0.12s;
  }

  .gauge.full span {
    animation: glow 0.5s ease-in-out infinite alternate;
  }

  .shout {
    position: absolute;
    left: 50%;
    bottom: calc(3cqh + min(3cqh, 5cqw));
    translate: -50% 0;
    padding: min(1.6cqh, 2.6cqw) min(6cqh, 10cqw);
    font-size: min(4cqh, 7cqw);
    animation: bump 0.4s var(--spring) infinite alternate;
  }

  @keyframes bump {
    from {
      scale: 1.25;
    }
    to {
      scale: 1;
    }
  }

  @keyframes glow {
    to {
      filter: brightness(1.4);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .combo,
    .shout,
    .gauge.full span {
      animation: none;
    }
  }
</style>
