<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import type { SoloProps } from '$lib/games';
  import { saveImage } from '$lib/share';
  import { photoArt, snapshot, templateArt, type Art } from '$lib/coloring/art';
  import { listWorks, newId, pack, removeWork, saveWork, unpack, type Work } from '$lib/coloring/book';
  import Canvas from '$lib/coloring/Canvas.svelte';
  import { empty, fill, undo, type Coloring } from '$lib/coloring/paint';
  import Palette, { COLORS } from '$lib/coloring/Palette.svelte';
  import PhotoMaker from '$lib/coloring/PhotoMaker.svelte';
  import Picker from '$lib/coloring/Picker.svelte';
  import { hideCovered, label, type Regions } from '$lib/coloring/regions';
  import { sounds } from '$lib/coloring/sounds';
  import { TEMPLATES, type Template } from '$lib/coloring/templates';

  // 自由あそびなので、シェルから受ける level と onfinish は使わない
  const _props: SoloProps = $props();

  interface Current {
    id: string;
    art: Art;
    regions: Regions;
    template?: string;
    photo?: Uint8Array;
    lines?: Uint8Array;
  }

  let screen = $state<'pick' | 'paint' | 'photo'>('pick');
  let works = $state.raw<Work[]>([]);
  let current = $state.raw<Current | null>(null);
  let coloring = $state.raw<Coloring>(empty());
  let color = $state<string>(COLORS[0].hex);
  let timer: ReturnType<typeof setTimeout> | undefined;

  // IndexedDB が開けない端末でも、塗ること自体はできるようにする
  const refresh = async () => (works = await listWorks().catch(() => []));
  onMount(refresh);

  function open(next: Omit<Current, 'regions'>, start: Coloring, mask = next.art.mask) {
    const regions = label(mask);
    current = { ...next, regions: next.art.kind === 'template' ? hideCovered(regions, next.art.cover) : regions };
    coloring = start;
    screen = 'paint';
  }

  function fromTemplate(t: Template) {
    const art = templateArt(t);
    open({ id: newId(), art, template: t.id, lines: pack(art.mask) }, empty());
  }
  const fromPhoto = (mask: Uint8Array) => open({ id: newId(), art: photoArt(mask), photo: pack(mask) }, empty());

  function fromWork(w: Work) {
    const template = TEMPLATES.find((t) => t.id === w.template);
    const bits = w.lines ?? w.photo;
    // 線の見た目はいまのテンプレートで描き、場所は作品に保存した線画で分ける（番号がずれて色がばらばらにならないように）
    const mask = bits ? unpack(bits) : undefined;
    const art = template ? templateArt(template) : photoArt(mask!);
    open(
      { id: w.id, art, template: w.template, photo: w.photo, lines: w.lines },
      { colors: w.colors, history: w.history },
      mask ?? art.mask
    );
  }

  function save(): Promise<void> {
    clearTimeout(timer);
    timer = undefined;
    const c = current;
    if (!c) return Promise.resolve();
    // 何も塗っていない（ぜんぶ戻した）作品は、ぬりえちょうに置かない
    if (!Object.keys(coloring.colors).length) return removeWork(c.id).catch(() => {});
    const thumb = snapshot(c.art, c.regions, coloring.colors, 200, 'image/jpeg');
    const { id, template, photo, lines } = c;
    return saveWork({ id, template, photo, lines, ...coloring, thumb, updated: Date.now() }).catch(() => {});
  }

  /** まだ保存していない塗りがあれば、すぐ保存する（閉じる・裏に回るときに最後の塗りを落とさないように） */
  const flush = () => void (timer !== undefined && save());
  onDestroy(flush);

  function paint(region: number) {
    const next = fill(coloring, region, color);
    if (next === coloring) return;
    coloring = next;
    sounds.fill();
    clearTimeout(timer);
    timer = setTimeout(save, 800);
  }

  // iOS の IndexedDB は開くところで止まることがあるので、保存を待たずに戻る
  function done() {
    sounds.done();
    void save().then(refresh);
    screen = 'pick';
  }

  // 共有シートは押したときの処理の中で同期に呼ばないと通らないので、await をはさまない
  function exportImage() {
    if (current) saveImage(snapshot(current.art, current.regions, coloring.colors, 1536), 'nurie.png');
  }
</script>

<svelte:window onpagehide={flush} />
<svelte:document onvisibilitychange={() => document.hidden && flush()} />

{#if screen === 'paint' && current}
  <div class="middle">
    <Canvas art={current.art} regions={current.regions} colors={coloring.colors} onfill={paint} />
  </div>
  <Palette
    bind:color
    canUndo={coloring.history.length > 0}
    onundo={() => {
      coloring = undo(coloring);
      sounds.undo();
      clearTimeout(timer);
      timer = setTimeout(save, 800);
    }}
    ondone={done}
    onsave={exportImage}
  />
{:else if screen === 'photo'}
  <PhotoMaker onmake={fromPhoto} onback={() => (screen = 'pick')} />
{:else}
  <Picker
    {works}
    ontemplate={fromTemplate}
    onwork={fromWork}
    onphoto={() => (screen = 'photo')}
    onremove={async (w) => {
      await removeWork(w.id).catch(() => {});
      await refresh();
    }}
  />
{/if}

<style>
  .middle {
    flex: 1;
    display: grid;
    place-items: center;
    min-height: 0;
    /* 上の隅には共通の ✕ と ↻ があるので、線画の角が重ならないよう空けておく */
    padding: max(68px, env(safe-area-inset-top)) 12px 12px;
    container-type: size;
  }
</style>
