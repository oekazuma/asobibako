<script lang="ts">
  import { onDestroy } from 'svelte';
  import { initialCrop, zoomCrop, type Crop } from './crop';
  import CropView from './CropView.svelte';
  import LineEditor from './LineEditor.svelte';
  import { Lines, type Mode } from './lines.svelte';
  import { cropPixels, openPhoto } from './photo';

  let { onmake, onback }: { onmake: (mask: Uint8Array) => void; onback: () => void } = $props();

  const MODES: [Mode, string][] = [
    ['ink', 'えの せん'],
    ['color', 'いろで わける'],
    ['edge', 'しゃしんの りんかく'],
    ['ai', 'AI で せんを かく']
  ];

  const lines = new Lines();
  let bmp = $state.raw<ImageBitmap | null>(null);
  let crop = $state<Crop>({ x: 0, y: 0, size: 1 });
  let zoom = $state(1);
  /** 写真を読み終える前に選び直す・閉じたときに、古い写真を受け取らないための番号 */
  let picks = 0;
  let alive = true;
  let note = $state('');

  function release() {
    lines.clear();
    bmp?.close();
    bmp = null;
  }

  async function pick(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    // 同じ写真を選び直しても change が起きるよう、読み終える前に空にしておく
    input.value = '';
    if (!file) return;
    note = '';
    release();
    const me = ++picks;
    try {
      const opened = await openPhoto(file);
      if (!alive || me !== picks) return opened.close();
      bmp = opened;
      crop = initialCrop(opened.width, opened.height);
      zoom = 1;
    } catch {
      note = 'この しゃしんは つかえませんでした';
    }
  }

  onDestroy(() => {
    alive = false;
    release();
    lines.dispose();
  });

  const drawing = $derived(lines.busy && lines.mode === 'ai');
</script>

<div class="maker">
  <h2 class="yuru">しゃしんから つくる</h2>
  {#if bmp && (lines.mask || drawing)}
    <div class="sheet">
      {#if lines.mask}
        <LineEditor
          mask={lines.mask}
          onedit={(e) => lines.edit(e)}
          onundo={() => lines.undoEdit()}
          canUndo={lines.edits.length > 0}
        />
      {:else}
        <div class="waiting"></div>
      {/if}
      {#if drawing}
        <p class="busy" role="status">
          AI が かいています…<br /><small>はじめての ときは よみこみに すこし じかんが かかるよ</small>
        </p>
      {/if}
    </div>
    <div class="row">
      {#each MODES as [mode, name] (mode)}
        <button class="pill" aria-pressed={lines.mode === mode} onclick={() => lines.setMode(mode)}>{name}</button>
      {/each}
    </div>
    <label class="slider">
      せんの おおさ
      <input type="range" min="0" max="1" step="0.05" bind:value={lines.amount} oninput={() => lines.later()} />
    </label>
    <div class="row">
      <button class="pill" onclick={() => lines.recrop()}>きりとりなおす</button>
      <button class="pill gold" disabled={drawing} onclick={() => lines.mask && onmake(lines.mask)}>これで ぬる</button>
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
    <button class="pill gold" onclick={() => bmp && lines.start(cropPixels(bmp, crop))}>これで せんを つくる</button>
  {/if}
  <label class="pill pick" class:gold={!bmp}>
    {bmp ? 'しゃしんを えらびなおす' : 'しゃしんを えらぶ'}
    <input type="file" accept="image/*" onchange={pick} />
  </label>
  {#if note || lines.note}<p role="alert">{note || lines.note}</p>{/if}
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

  .sheet {
    position: relative;
  }

  .busy {
    position: absolute;
    inset: 0;
    display: grid;
    place-content: center;
    gap: 6px;
    border-radius: 12px;
    background: rgb(255 250 244 / 0.85);
    text-align: center;
  }

  .waiting {
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
