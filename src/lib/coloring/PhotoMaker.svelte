<script lang="ts">
  import { onDestroy } from 'svelte';
  import { initialCrop, zoomCrop, type Crop } from './crop';
  import CropView from './CropView.svelte';
  import { inkArt, lineArt } from './lineart';
  import { cropPixels, openPhoto } from './photo';
  import { SIZE } from './regions';
  import { colorWalls } from './walls';

  let { onmake, onback }: { onmake: (mask: Uint8Array) => void; onback: () => void } = $props();

  let bmp = $state.raw<ImageBitmap | null>(null);
  let crop = $state<Crop>({ x: 0, y: 0, size: 1 });
  let zoom = $state(1);
  /**
   * ink は線のある絵（マンホールなど）のもとの黒い線、color はそれに色の境目を足したもの（線が重なって途切れる絵でも
   * 色が違えば塗りがもれない）、edge はふつうの写真の明るさの変わり目を拾う
   */
  let mode = $state<'ink' | 'color' | 'edge'>('ink');
  let amount = $state(0.5);
  let rgba: Uint8ClampedArray | null = null;
  let mask = $state.raw<Uint8Array | null>(null);
  let note = $state('');
  let preview = $state<HTMLCanvasElement>();
  let timer: ReturnType<typeof setTimeout> | undefined;

  function build() {
    if (!rgba) return;
    if (mode === 'edge') return (mask = lineArt(rgba, SIZE, SIZE, amount));
    const ink = inkArt(rgba, SIZE, SIZE, amount);
    if (mode === 'ink') return (mask = ink);
    const walls = colorWalls(rgba, SIZE, SIZE, 5);
    mask = ink.map((v, i) => v | walls[i]);
  }

  // 線の量を動かすたびに作りなおすと iPad でも 100ms ほどかかるので、動かし終わりを待つ
  function later() {
    clearTimeout(timer);
    timer = setTimeout(build, 150);
  }

  function release() {
    bmp?.close();
    bmp = null;
    rgba = null;
    mask = null;
  }

  async function pick(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    // 同じ写真を選び直しても change が起きるよう、読み終える前に空にしておく
    input.value = '';
    if (!file) return;
    note = '';
    release();
    try {
      bmp = await openPhoto(file);
      crop = initialCrop(bmp.width, bmp.height);
      zoom = 1;
    } catch {
      note = 'この しゃしんは つかえませんでした';
    }
  }

  function makeLines() {
    if (!bmp) return;
    rgba = cropPixels(bmp, crop);
    build();
  }

  function setMode(next: 'ink' | 'color' | 'edge') {
    mode = next;
    build();
  }

  onDestroy(release);

  $effect(() => {
    const g = preview?.getContext('2d');
    if (!g || !mask) return;
    const img = g.createImageData(SIZE, SIZE);
    const d = img.data;
    for (let i = 0; i < mask.length; i++) {
      const line = mask[i] === 1;
      d[i * 4] = line ? 59 : 255;
      d[i * 4 + 1] = line ? 47 : 255;
      d[i * 4 + 2] = line ? 42 : 255;
      d[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  });
</script>

<div class="maker">
  <h2 class="yuru">しゃしんから つくる</h2>
  {#if bmp && mask}
    <canvas class="preview" width={SIZE} height={SIZE} bind:this={preview}></canvas>
    <div class="row">
      <button class="pill" aria-pressed={mode === 'ink'} onclick={() => setMode('ink')}>えの せん</button>
      <button class="pill" aria-pressed={mode === 'color'} onclick={() => setMode('color')}>いろで わける</button>
      <button class="pill" aria-pressed={mode === 'edge'} onclick={() => setMode('edge')}>しゃしんの りんかく</button>
    </div>
    <label class="slider">
      せんの おおさ
      <input type="range" min="0" max="1" step="0.05" bind:value={amount} oninput={later} />
    </label>
    <div class="row">
      <button class="pill" onclick={() => (mask = null)}>きりとりなおす</button>
      <button class="pill gold" onclick={() => mask && onmake(mask)}>これで ぬる</button>
    </div>
  {:else if bmp}
    <p>ぬりたい ところを わくに いれてね</p>
    <CropView {bmp} bind:crop />
    <label class="slider">
      おおきく
      <input
        type="range"
        min="1"
        max="4"
        step="0.05"
        bind:value={zoom}
        oninput={() => bmp && (crop = zoomCrop(crop, zoom, bmp.width, bmp.height))}
      />
    </label>
    <button class="pill gold" onclick={makeLines}>これで せんを つくる</button>
  {/if}
  <label class="pill pick" class:gold={!bmp}>
    {bmp ? 'しゃしんを えらびなおす' : 'しゃしんを えらぶ'}
    <input type="file" accept="image/*" onchange={pick} />
  </label>
  {#if note}<p role="alert">{note}</p>{/if}
  <button class="pill" onclick={onback}>もどる</button>
</div>

<style>
  .maker {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    /* 上の隅の共通の ✕ と ↻ に見出しが重ならないよう空けておく */
    padding: max(68px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom));
    overflow-y: auto;
    touch-action: pan-y;
    background: var(--paper-dots), var(--paper);
    color: var(--line);
    font-weight: 800;
  }

  .pick input {
    display: none;
  }

  .preview {
    width: min(86cqw, 52cqh);
    aspect-ratio: 1;
    border: 3px solid var(--line);
    border-radius: 12px;
    background: #fff;
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
  }

  [aria-pressed='true'] {
    --face: var(--pastel-gold);
  }

  .slider {
    display: grid;
    gap: 6px;
    width: min(86cqw, 420px);
    text-align: center;
  }
</style>
