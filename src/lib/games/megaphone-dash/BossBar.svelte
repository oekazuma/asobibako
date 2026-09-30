<script lang="ts">
  let { hp, max }: { hp: number; max: number } = $props();
</script>

<!-- ボスの体力。画面の上の真ん中に、名前と一緒に出す -->
<div class="boss" role="meter" aria-label="ふきげんオニの体力" aria-valuemin="0" aria-valuemax={max} aria-valuenow={hp}>
  <b>ふきげんオニ</b>
  <span class="bar"><i style:width="{(hp / max) * 100}%"></i></span>
</div>

<style>
  .boss {
    position: absolute;
    top: 17%;
    left: 50%;
    translate: -50% 0;
    display: grid;
    justify-items: center;
    gap: 4px;
    pointer-events: none;
    rotate: -2deg;
  }

  b {
    color: #fff;
    font-size: min(2.2cqh, 3.8cqw);
    font-style: italic;
    font-weight: 900;
    -webkit-text-stroke: 0.06em #262833;
    paint-order: stroke fill;
  }

  .bar {
    width: min(40cqh, 66cqw);
    height: min(2cqh, 3.4cqw);
    border: 3px solid #262833;
    background: #3a3c48;
    transform: skewX(-14deg);
    overflow: hidden;
  }

  i {
    display: block;
    height: 100%;
    background: repeating-linear-gradient(-45deg, #ff2a3d 0 12px, #d9142a 12px 24px);
    transition: width 0.15s;
  }
</style>
