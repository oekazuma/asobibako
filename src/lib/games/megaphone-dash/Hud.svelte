<script lang="ts">
  let {
    time,
    followers,
    gauge,
    onshout
  }: {
    time: number;
    followers: number;
    /** 大声のゲージ（0 から 1） */
    gauge: number;
    onshout: () => void;
  } = $props();

  const full = $derived(gauge >= 1);
  const clock = $derived.by(() => {
    const t = Math.max(0, time);
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    const d = Math.floor((t * 10) % 10);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${d}`;
  });
  const digits = (n: number) => String(Math.min(9999999, n)).padStart(7, '0');
</script>

<div class="panel timer" class:low={time <= 10}>
  <small>TIME LIMIT</small>
  <b>{clock}</b>
  <div class="bar" class:full>
    <span style:width="{gauge * 100}%"></span>
    <em>{full ? 'さけべる！' : 'こえ'}</em>
  </div>
</div>

<div class="panel counter">
  <b>{digits(followers)}</b>
  <small>FOLLOWERS</small>
</div>

{#if full}
  <!-- 盤面の指の操作（走る向き）に拾われないよう、ここで止める -->
  <button
    class="shout"
    onpointerdown={(e) => {
      e.stopPropagation();
      onshout();
    }}>さけぶ！</button
  >
{/if}

<style>
  /* 番組風の画面：太い縁の黄色いパネルを斜めに傾け、白い太字に濃い縁を付ける */
  .panel {
    position: absolute;
    pointer-events: none;
    color: #fff;
    font-style: italic;
    font-weight: 900;
    -webkit-text-stroke: 0.06em #262833;
    paint-order: stroke fill;
  }

  .timer {
    top: calc(max(12px, env(safe-area-inset-top)) + 56px);
    left: 3cqw;
    display: grid;
    gap: 2px;
    rotate: -4deg;
  }

  .timer small {
    font-size: min(1.8cqh, 3.2cqw);
  }

  .timer b {
    font-size: min(6cqh, 11cqw);
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }

  .timer.low b {
    color: #ff5a6e;
  }

  .bar {
    position: relative;
    width: min(26cqh, 44cqw);
    height: min(2.6cqh, 4.6cqw);
    margin-top: 6px;
    border: 3px solid #262833;
    background: #3a3c48;
    transform: skewX(-12deg);
    overflow: hidden;
  }

  .bar span {
    position: absolute;
    inset: 0 auto 0 0;
    background: linear-gradient(90deg, #ff4d6d, #ff9a3c);
    transition: width 0.12s;
  }

  .bar em {
    position: absolute;
    right: 8px;
    top: 50%;
    translate: 0 -50%;
    color: rgb(255 255 255 / 0.85);
    font-size: min(1.6cqh, 2.8cqw);
    -webkit-text-stroke: 0;
  }

  .bar.full span {
    animation: glow 0.45s ease-in-out infinite alternate;
  }

  .counter {
    right: 4cqw;
    bottom: 4cqh;
    display: grid;
    justify-items: center;
    padding: 6px 18px 4px;
    border: 4px solid #262833;
    background: #ffd23a;
    box-shadow: 6px 6px 0 rgb(38 40 51 / 0.85);
    rotate: -3deg;
    transform: skewX(-8deg);
  }

  .counter b {
    font-size: min(4.4cqh, 7.6cqw);
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }

  .counter small {
    color: #262833;
    font-size: min(1.5cqh, 2.6cqw);
    -webkit-text-stroke: 0;
  }

  .shout {
    position: absolute;
    /* 右下のフォロワーの数字と重ならないよう、左に寄せる */
    left: 34%;
    bottom: 5cqh;
    translate: -50% 0;
    padding: min(1.6cqh, 2.6cqw) min(6cqh, 10cqw);
    border: 4px solid #262833;
    border-radius: 10px;
    background: linear-gradient(#ff5a78, #ff2d55);
    box-shadow: 0 6px 0 #262833;
    color: #fff;
    font-size: min(4.4cqh, 7.6cqw);
    font-style: italic;
    font-weight: 900;
    -webkit-text-stroke: 0.05em #262833;
    paint-order: stroke fill;
    animation: bump 0.4s var(--spring) infinite alternate;
  }

  @keyframes bump {
    from {
      scale: 1.2;
    }
    to {
      scale: 1;
    }
  }

  @keyframes glow {
    to {
      filter: brightness(1.5);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .shout,
    .bar.full span {
      animation: none;
    }
  }
</style>
