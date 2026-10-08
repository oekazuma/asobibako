<script lang="ts">
  import { RADIUS } from './paint';

  let { value = $bindable() }: { value: number } = $props();
</script>

<label class="size">
  <span class="dot" style:width="{8 + (value / RADIUS[1]) * 56}px" style:height="{8 + (value / RADIUS[1]) * 56}px"
  ></span>
  <input type="range" min={RADIUS[0]} max={RADIUS[1]} step="0.005" bind:value aria-label="ブラシの大きさ" />
  <span class="label">{Math.round(value * 200)} cm</span>
</label>

<style>
  .size {
    position: absolute;
    right: max(110px, calc(env(safe-area-inset-right) + 98px));
    top: 50%;
    translate: 0 -50%;
    display: grid;
    justify-items: center;
    gap: 10px;
    color: #fff;
    font-family: 'Hiragino Mincho ProN', serif;
    text-shadow: 0 1px 3px #000;
  }

  .dot {
    border: 2px solid #fff;
    border-radius: 50%;
  }

  input {
    writing-mode: vertical-lr;
    direction: rtl;
    height: 46vh;
    accent-color: #fff;
  }
</style>
