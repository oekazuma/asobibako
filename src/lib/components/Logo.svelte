<script lang="ts">
  /** mark は箱とキャラクターだけ（アプリのアイコン用）。星と文字を省く */
  let { width = '16rem', mark = false }: { width?: string; mark?: boolean } = $props();

  const LINE = '#5b4a42';
  const EYE = '#2e2522';
  const CHEEK = '#ffb3bf';
  const WORD = [
    { ch: 'あ', fill: '#ff9fb3', r: -6, dy: 0 },
    { ch: 'そ', fill: '#ffc86b', r: 4, dy: -4 },
    { ch: 'び', fill: '#8fd6a8', r: -3, dy: 2 },
    { ch: 'ば', fill: '#8ec9ff', r: 5, dy: -3 },
    { ch: 'こ', fill: '#c7a8f5', r: -4, dy: 1 }
  ];
</script>

<svg
  viewBox={mark ? '43 18 170 170' : '0 26 260 200'}
  style:width
  role="img"
  aria-label="あそびばこ"
  stroke={LINE}
  stroke-width="3"
  stroke-linejoin="round"
  stroke-linecap="round"
>
  <!-- ふたは箱の左上の角を軸に 20 度持ち上がっていて、中からキャラクターが押し上げている -->
  <path d="M52,112 L46.2,96 L190,43.7 Q195.6,41.6 197.6,47.3 L199.4,52 Q201.4,57.6 195.8,59.7 Z" fill="#ffc4d0" />
  <path d="M59.9,98.5 L86.2,88.9" stroke="#fff" stroke-width="4" opacity="0.8" />

  <!-- 大きくしたぶん線を細くして、ほかと同じ太さに見せる -->
  <g stroke-width="2.6">
    <g transform="translate(87 100) scale(1.15)">
      <circle cx="-13" cy="-13" r="7" fill="#f1cfa8" />
      <circle cx="13" cy="-13" r="7" fill="#f1cfa8" />
      <circle cx="-13" cy="-13" r="3" fill="#f6b8a4" stroke="none" />
      <circle cx="13" cy="-13" r="3" fill="#f6b8a4" stroke="none" />
      <ellipse rx="19" ry="17" fill="#f1cfa8" />
      <g stroke="none">
        <ellipse cx="0" cy="5" rx="7.5" ry="5.5" fill="#fbe7d2" />
        <circle cx="-7.5" cy="-2" r="2.6" fill={EYE} />
        <circle cx="7.5" cy="-2" r="2.6" fill={EYE} />
        <ellipse cx="0" cy="3" rx="2.8" ry="2" fill={EYE} />
        <ellipse cx="-12.5" cy="5" rx="3.6" ry="2.2" fill={CHEEK} />
        <ellipse cx="12.5" cy="5" rx="3.6" ry="2.2" fill={CHEEK} />
      </g>
    </g>

    <g transform="translate(173 102) scale(1.15)">
      <circle cx="-10" cy="-12" r="4.5" fill="#bfe88a" />
      <circle cx="10" cy="-12" r="4.5" fill="#bfe88a" />
      <circle r="15" fill="#bfe88a" />
      <g stroke="none" fill={EYE}>
        <circle cx="-5.5" cy="-1" r="2.6" />
        <circle cx="5.5" cy="-1" r="2.6" />
      </g>
      <path d="M-4.5,4.5 Q0,8 4.5,4.5" stroke={LINE} stroke-width="1.6" fill="none" />
      <path d="M-2,5.8 L-0.8,8.4 0.4,6.2" fill="#fff" stroke="none" />
    </g>

    <g transform="translate(130 97) scale(1.15)">
      <ellipse cx="-7" cy="-24" rx="5.5" ry="13" fill="#fffdfa" />
      <ellipse cx="7" cy="-24" rx="5.5" ry="13" fill="#fffdfa" />
      <ellipse rx="17" ry="15.5" fill="#fffdfa" />
      <g stroke="none">
        <ellipse cx="-7" cy="-23" rx="2.2" ry="8" fill="#ffd3dc" />
        <ellipse cx="7" cy="-23" rx="2.2" ry="8" fill="#ffd3dc" />
        <circle cx="-6.5" cy="-2" r="2.6" fill={EYE} />
        <circle cx="6.5" cy="-2" r="2.6" fill={EYE} />
        <path d="M-2.2,2 H2.2 L0,4.4 Z" fill="#ff8fa6" />
        <ellipse cx="-11" cy="4.5" rx="3.4" ry="2.1" fill={CHEEK} />
        <ellipse cx="11" cy="4.5" rx="3.4" ry="2.1" fill={CHEEK} />
      </g>
    </g>
  </g>

  <path d="M52,112 H208 V148 Q208,162 194,162 H66 Q52,162 52,148 Z" fill="#ff9fb3" />
  <path d="M52,112 H208 V126 H52 Z" fill="#ffc4d0" />
  <path d="M64,119 H90" stroke="#fff" stroke-width="4" opacity="0.8" />
  <path
    d="M130,151 C118,143 116,134 123,132 C127,131 129,134 130,136 C131,134 133,131 137,132 C144,134 142,143 130,151 Z"
    fill="#fff"
    stroke-width="2.6"
  />

  {#if !mark}
    <path
      transform="translate(224 42)"
      d="M0,-11 L3.3,-4.3 10.5,-3.4 5.2,1.6 6.6,8.8 0,5.3 -6.6,8.8 -5.2,1.6 -10.5,-3.4 -3.3,-4.3 Z"
      fill="#ffd45c"
    />
    <g font-size="46" font-weight="700" text-anchor="middle" stroke-width="5" paint-order="stroke">
      {#each WORD as w, k (w.ch)}
        {@const x = 42 + k * 44}
        <text {x} y={214 + w.dy} fill={w.fill} rotate={w.r}>{w.ch}</text>
      {/each}
    </g>
  {/if}
</svg>

<style>
  svg {
    display: block;
    overflow: visible;
  }

  text {
    font-family: 'Hiragino Maru Gothic ProN', 'Hiragino Maru Gothic Pro', system-ui, sans-serif;
  }
</style>
