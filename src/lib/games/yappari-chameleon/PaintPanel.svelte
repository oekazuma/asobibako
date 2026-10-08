<script lang="ts">
  import { hsvToRgb, rgbToHsv, toHex, type RGB } from './color';
  import ColorDisk from './ColorDisk.svelte';
  import ColorSliders from './ColorSliders.svelte';
  import type { Play } from './play.svelte';
  import Swatches from './Swatches.svelte';

  let { play }: { play: Play } = $props();
  let open = $state(true);
  /** 色相と彩度は持っておく。彩度か明るさが 0（白・黒・灰色）になると RGB からは戻らない。始めの値は下の $effect.pre が入れる */
  let hsv = $state<[number, number, number]>([0, 0, 1]);

  $effect.pre(() => {
    const c = play.brush.color;
    const mine = hsvToRgb(...hsv);
    if (c.every((v, i) => Math.abs(v - mine[i]) < 0.5 / 255)) return;
    const [h, s, v] = rgbToHsv(c);
    hsv = [s > 0 ? h : hsv[0], v > 0 ? s : hsv[1], v];
  });

  function setHsv(next: [number, number, number]) {
    hsv = next;
    play.tune({ color: hsvToRgb(...next) });
  }

  function setRgb(c: RGB) {
    play.tune({ color: c });
  }
</script>

<section class="panel" class:open aria-label="パレット">
  <button class="fold" onclick={() => (open = !open)}>{open ? 'パレットを閉じる' : 'パレット'}</button>
  {#if open}
    <div class="top">
      <ColorDisk hue={hsv[0]} sat={hsv[1]} onpick={(h, sat) => setHsv([h, sat, hsv[2] || 1])} />
      <input
        class="tall"
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={hsv[1]}
        oninput={(e) => setHsv([hsv[0], +e.currentTarget.value, hsv[2]])}
        aria-label="彩度"
        style:--from={toHex(hsvToRgb(hsv[0], 0, hsv[2] || 1))}
        style:--to={toHex(hsvToRgb(hsv[0], 1, hsv[2] || 1))}
      />
      <input
        class="tall"
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={hsv[2]}
        oninput={(e) => setHsv([hsv[0], hsv[1], +e.currentTarget.value])}
        aria-label="明るさ"
        style:--from="#000000"
        style:--to={toHex(hsvToRgb(hsv[0], hsv[1], 1))}
      />
      <div class="pair" data-part="pair">
        <span class="current" role="img" style:background={toHex(play.brush.color)} aria-label="今の色"></span>
        <button
          class="previous"
          style:background={toHex(play.previous)}
          onclick={() => play.setColor(play.previous)}
          aria-label="前の色"
        ></button>
      </div>
    </div>
    {#snippet sliders(which: 'color' | 'gloss')}
      <ColorSliders
        {which}
        {hsv}
        rgb={play.brush.color}
        opacity={play.brush.opacity}
        metal={play.brush.metal}
        rough={play.brush.rough}
        onhsv={setHsv}
        onrgb={setRgb}
        onopacity={(v) => play.tune({ opacity: Math.max(0.05, v) })}
        onmetal={(v) => play.tune({ metal: v })}
        onrough={(v) => play.tune({ rough: v })}
      />
    {/snippet}
    {@render sliders('color')}
    <Swatches recent={play.recent} onpick={(c) => play.setColor(c)} />
    {@render sliders('gloss')}
    <button class="spoit" class:on={play.spoit} data-part="spoit" onclick={() => play.toggleSpoit()}>3D スポイト</button
    >
  {/if}
</section>

<style>
  .panel {
    position: absolute;
    top: max(86px, calc(env(safe-area-inset-top) + 74px));
    left: max(12px, env(safe-area-inset-left));
    display: grid;
    gap: 10px;
    width: 330px;
    max-height: calc(100% - 106px);
    overflow-y: auto;
    padding: 12px;
    border-radius: 14px;
    background: rgb(20 18 16 / 0.72);
    color: #fff;
    font-family: 'Hiragino Mincho ProN', serif;
    text-shadow: 0 1px 2px #000;
    touch-action: pan-y;
  }

  .panel:not(.open) {
    width: auto;
  }

  .fold {
    justify-self: start;
    padding: 6px 12px;
    border: 1px solid rgb(255 255 255 / 0.8);
    border-radius: 999px;
    background: transparent;
    color: #fff;
    font: inherit;
  }

  .top {
    display: flex;
    gap: 10px;
    align-items: flex-start;
  }

  .tall {
    touch-action: none;
    writing-mode: vertical-lr;
    direction: rtl;
    width: 22px;
    height: 140px;
    appearance: none;
    border-radius: 4px;
    background: linear-gradient(to top, var(--from), var(--to));
  }

  /* appearance: none の縦のスライダーは、つまみが青いままになる */
  .tall::-webkit-slider-thumb {
    width: 22px;
    height: 10px;
    appearance: none;
    border: 2px solid #222;
    border-radius: 3px;
    background: #fff;
  }

  .pair {
    display: grid;
    gap: 6px;
  }

  .current,
  .previous {
    width: 64px;
    height: 32px;
    border: 2px solid #fff;
    border-radius: 6px;
  }

  .spoit {
    padding: 10px;
    border: 1px solid rgb(255 255 255 / 0.5);
    border-radius: 8px;
    background: rgb(255 255 255 / 0.12);
    color: #fff;
    font: inherit;
    font-size: 16px;
  }

  .spoit.on {
    background: rgb(255 255 255 / 0.9);
    color: #1d1a17;
    text-shadow: none;
  }
</style>
