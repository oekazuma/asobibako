<script lang="ts">
  let {
    level,
    time,
    combo,
    followers,
    mps,
    boss
  }: {
    level: number;
    time: number;
    combo: number;
    followers: number;
    mps: number;
    boss: { hp: number; max: number } | null;
  } = $props();
</script>

<div class="hud">
  <div class="row">
    <span class="chip sticker">レベル {level}</span>
    <span class="chip time" class:low={time <= 10}>のこり {time.toFixed(1)}</span>
    <span class="chip fans">フォロワー {followers}</span>
  </div>
  {#if boss}
    <div
      class="bar"
      role="meter"
      aria-label="ボスの体力"
      aria-valuemin="0"
      aria-valuemax={boss.max}
      aria-valuenow={boss.hp}
    >
      <span style:width="{(boss.hp / boss.max) * 100}%"></span>
    </div>
  {/if}
</div>
<div class="combo" aria-live="polite">
  <b>{combo}</b>
  <small>コンボ {mps.toFixed(1)} m/s</small>
</div>

<style>
  .hud {
    position: absolute;
    top: 14px;
    left: 72px;
    right: 72px;
    display: grid;
    gap: 8px;
    justify-items: center;
    pointer-events: none;
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
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

  .bar {
    width: min(60cqw, 420px);
    height: min(1.6cqh, 3cqw);
    border: 3px solid #fff;
    border-radius: 999px;
    background: rgb(43 45 66 / 0.5);
    overflow: hidden;
  }

  .bar span {
    display: block;
    height: 100%;
    background: #ff2a3d;
    transition: width 0.15s;
  }

  .combo {
    position: absolute;
    left: 5cqw;
    top: 52%;
    display: grid;
    justify-items: center;
    color: #fff;
    text-shadow:
      0 3px 0 rgb(43 45 66 / 0.35),
      0 0 6px rgb(43 45 66 / 0.4);
    pointer-events: none;
  }

  .combo b {
    font-size: min(8cqh, 14cqw);
    line-height: 1;
  }

  .combo small {
    font-size: min(1.8cqh, 3.2cqw);
    font-weight: 800;
  }
</style>
