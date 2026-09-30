<script lang="ts">
  import { lineArt } from './lineart';
  import { SIZE } from './regions';

  let { onmake, onback }: { onmake: (mask: Uint8Array) => void; onback: () => void } = $props();

  let rgba: Uint8ClampedArray | null = null;
  let amount = $state(0.5);
  let mask = $state.raw<Uint8Array | null>(null);
  let note = $state('');
  let preview = $state<HTMLCanvasElement>();
  let timer: ReturnType<typeof setTimeout> | undefined;

  function build() {
    if (!rgba) return;
    mask = lineArt(rgba, SIZE, SIZE, amount);
  }

  // 線の量を動かすたびに作りなおすと iPad でも 100ms ほどかかるので、動かし終わりを待つ
  function later() {
    clearTimeout(timer);
    timer = setTimeout(build, 150);
  }

  async function pick(event: Event) {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    note = '';
    try {
      const bmp = await createImageBitmap(file);
      const c = document.createElement('canvas');
      c.width = c.height = SIZE;
      const g = c.getContext('2d', { willReadFrequently: true })!;
      g.fillStyle = '#fff';
      g.fillRect(0, 0, SIZE, SIZE);
      // 切り取らずに収め、余白は白にする
      const s = Math.min(SIZE / bmp.width, SIZE / bmp.height);
      g.drawImage(bmp, (SIZE - bmp.width * s) / 2, (SIZE - bmp.height * s) / 2, bmp.width * s, bmp.height * s);
      rgba = g.getImageData(0, 0, SIZE, SIZE).data;
      build();
    } catch {
      note = 'この しゃしんは つかえませんでした';
    }
  }

  $effect(() => {
    if (!preview || !mask) return;
    const g = preview.getContext('2d')!;
    const img = g.createImageData(SIZE, SIZE);
    for (let i = 0; i < mask.length; i++) {
      const v = mask[i] ? 59 : 255;
      img.data.set([v, mask[i] ? 47 : 255, mask[i] ? 42 : 255, 255], i * 4);
    }
    g.putImageData(img, 0, 0);
  });
</script>

<div class="maker">
  <h2 class="yuru">しゃしんから つくる</h2>
  <label class="pill gold pick">
    しゃしんを えらぶ
    <input type="file" accept="image/*" onchange={pick} />
  </label>
  {#if mask}
    <canvas class="preview" width={SIZE} height={SIZE} bind:this={preview}></canvas>
    <label class="amount">
      せんの おおさ
      <input type="range" min="0" max="1" step="0.05" bind:value={amount} oninput={later} />
    </label>
    <button class="pill gold" onclick={() => mask && onmake(mask)}>これで ぬる</button>
  {/if}
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

  .amount {
    display: grid;
    gap: 6px;
    width: min(86cqw, 420px);
    text-align: center;
  }
</style>
