<script lang="ts">
  import { lineArt } from './lineart';
  import { readPhoto } from './photo';
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
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    // 同じ写真を選び直しても change が起きるよう、読み終える前に空にしておく
    input.value = '';
    if (!file) return;
    note = '';
    try {
      rgba = await readPhoto(file);
      build();
    } catch {
      // 前の写真の線画を残すと、読めなかった写真で塗り始めたように見える
      rgba = null;
      mask = null;
      note = 'この しゃしんは つかえませんでした';
    }
  }

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
