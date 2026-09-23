<script lang="ts">
  /** 上から見たネコかネズミ。頭が上を向いた姿で描き、向きは親が回す。首輪と足もとの影は親の --c（プレイヤーの色） */
  let { kind }: { kind: 'cat' | 'mouse' } = $props();
</script>

<!-- 当たり判定の半径が 33 になる座標で描く（親は半径の 3.6 倍の四角に置く） -->
<svg viewBox="-60 -60 120 120" aria-hidden="true">
  {#if kind === 'cat'}
    <ellipse class="glow" cx="0" cy="2" rx="30" ry="46" />
    <g class="tail">
      <path d="M0 30C2 44 16 48 22 56" stroke="#c9691f" stroke-width="10" />
      <path d="M0 30C2 44 16 48 22 56" stroke="#f0a04b" stroke-width="7" />
    </g>
    <g fill="#e8913b">
      <ellipse cx="-14" cy="-8" rx="5" ry="7" />
      <ellipse cx="14" cy="-8" rx="5" ry="7" />
      <ellipse cx="-15" cy="26" rx="5.5" ry="7" />
      <ellipse cx="15" cy="26" rx="5.5" ry="7" />
    </g>
    <ellipse cx="0" cy="8" rx="18" ry="27" fill="#f0a04b" stroke="#c9691f" stroke-width="1.5" />
    <path d="M-15 0q15 5 30 0M-17 10q17 5 34 0M-16 20q16 5 32 0" stroke="#d27a2a" stroke-width="3" />
    <path d="M-13 -36L-17 -50-3 -41zM13 -36l4 -14-14 9z" fill="#f0a04b" stroke="#c9691f" stroke-width="1.5" />
    <path d="M-12 -39l-2 -7 6 4zM12 -39l2 -7-6 4z" fill="#ffb3b8" />
    <circle cx="0" cy="-27" r="16" fill="#f5ad5c" stroke="#c9691f" stroke-width="1.5" />
    <path d="M-5 -38l1 8M0 -40v9M5 -38l-1 8" stroke="#d27a2a" stroke-width="2.4" />
    <path class="collar" d="M-12 -14q12 6 24 0" stroke-width="5" />
    <circle cx="0" cy="-10" r="2.6" fill="#ffc233" stroke="#c98a00" stroke-width="1" />
    <circle cx="-6" cy="-35" r="2.2" fill="#2b2d42" />
    <circle cx="6" cy="-35" r="2.2" fill="#2b2d42" />
    <path d="M0 -41.5l-2 -2.5h4z" fill="#ff7a8f" />
    <path d="M-7 -39l-12 -5M-7 -37l-13 1M7 -39l12 -5M7 -37l13 1" stroke="#fff" stroke-width="1" />
  {:else}
    <ellipse class="glow" cx="0" cy="0" rx="28" ry="42" />
    <g class="tail">
      <path d="M0 26C10 38-10 46 4 60" stroke="#e7a3ac" stroke-width="3.5" />
    </g>
    <g fill="#f2b8c0">
      <ellipse cx="-14" cy="-6" rx="3.5" ry="4.5" />
      <ellipse cx="14" cy="-6" rx="3.5" ry="4.5" />
      <ellipse cx="-14" cy="20" rx="4" ry="5" />
      <ellipse cx="14" cy="20" rx="4" ry="5" />
    </g>
    <path
      d="M0 -44C9 -40 18 -14 18 6 18 24 10 30 0 30S-18 24-18 6C-18 -14-9 -40 0 -44z"
      fill="#a3a3b2"
      stroke="#6f6f80"
      stroke-width="1.5"
    />
    <ellipse cx="0" cy="8" rx="9" ry="14" fill="#b9b9c6" />
    <circle cx="-13" cy="-22" r="9.5" fill="#a3a3b2" stroke="#6f6f80" stroke-width="1.5" />
    <circle cx="13" cy="-22" r="9.5" fill="#a3a3b2" stroke="#6f6f80" stroke-width="1.5" />
    <circle cx="-13" cy="-22" r="6" fill="#f2b8c0" />
    <circle cx="13" cy="-22" r="6" fill="#f2b8c0" />
    <path class="collar" d="M-11 -14q11 5 22 0" stroke-width="4" />
    <circle cx="-5" cy="-31" r="2.4" fill="#2b2d42" />
    <circle cx="5" cy="-31" r="2.4" fill="#2b2d42" />
    <circle cx="0" cy="-44" r="3" fill="#ff7a8f" />
    <path d="M-3 -41l-14 -4M-3 -40l-14 3M3 -41l14 -4M3 -40l14 3" stroke="#4a4a58" stroke-width="0.8" />
  {/if}
</svg>

<style>
  svg {
    display: block;
    width: 100%;
    height: 100%;
    overflow: visible;
  }

  path {
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  path:not([fill]) {
    fill: none;
  }

  .glow {
    fill: var(--c);
    fill-opacity: 0.22;
    stroke: var(--c);
    stroke-width: 3;
  }

  .collar {
    stroke: var(--c);
  }

  .tail {
    transform-box: view-box;
    transform-origin: 50% 75%;
    animation: wag 700ms ease-in-out infinite alternate;
  }

  @keyframes wag {
    from {
      rotate: -10deg;
    }
    to {
      rotate: 10deg;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .tail {
      animation: none;
    }
  }
</style>
