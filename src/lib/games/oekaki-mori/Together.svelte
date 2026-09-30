<script lang="ts">
  import { onMount } from 'svelte';
  import { photoArt, snapshot, templateArt, type Art } from '$lib/coloring/art';
  import { newId, pack, saveWork } from '$lib/coloring/book';
  import Canvas from '$lib/coloring/Canvas.svelte';
  import Palette, { COLORS } from '$lib/coloring/Palette.svelte';
  import PhotoMaker from '$lib/coloring/PhotoMaker.svelte';
  import Picker from '$lib/coloring/Picker.svelte';
  import { hideCovered, label, type Regions } from '$lib/coloring/regions';
  import { sounds } from '$lib/coloring/sounds';
  import { TEMPLATES, type Template } from '$lib/coloring/templates';
  import { decodeLines, encodeLines } from '$lib/coloring/wire';
  import type { Message } from '$lib/net/link';
  import type { Party } from '$lib/net/party.svelte';
  import { saveImage } from '$lib/share';
  import Finished from './Finished.svelte';
  import { paintBy, shared, undoBy } from './together';

  let { party, onagain }: { party: Party; onagain: () => void } = $props();

  let phase = $state<'pick' | 'photo' | 'wait' | 'paint' | 'done'>('wait');
  let sheet = $state.raw<{ art: Art; regions: Regions; mask: Uint8Array; template?: string } | null>(null);
  let colors = $state.raw<Record<number, string>>({});
  let color = $state<string>(COLORS[0].hex);
  /** 親だけが使う。塗った順番と、戻すための手順 */
  let host = shared();
  /** 線画を戻すのは非同期なので、そのあいだに届いた塗りを落とさないよう、届いた順に 1 本の列で処理する */
  let queue = Promise.resolve();
  let note = $state('');
  /** 親が「できた！」を押したあと。まだ届いていない塗りを受け付けると、保存した絵と画面が食い違う */
  let closed = false;

  async function send(mask: Uint8Array, template?: Template) {
    // 配り終えるまでに別の絵を押されると 2 枚配られ、親の塗り手順と画面の色が食い違うので、すぐ待つ画面にする
    phase = 'wait';
    host = shared();
    party.tell('all', { t: 'art', template: template?.id ?? null, lines: await encodeLines(mask) });
  }

  async function receive(m: Message) {
    if (m.t === 'art') {
      const mask = await decodeLines(String(m.lines));
      const template = TEMPLATES.find((t) => t.id === m.template);
      // 場所は配られた線画で分ける。端末ごとにテンプレートを描き直すと、番号がずれることがある
      const art = template ? templateArt(template) : photoArt(mask);
      const regions = label(mask);
      sheet = {
        art,
        regions: art.kind === 'template' ? hideCovered(regions, art.cover) : regions,
        mask,
        template: template?.id
      };
      colors = {};
      phase = 'paint';
    } else if (m.t === 'painted') {
      const next = { ...colors };
      if (m.color === null) delete next[Number(m.region)];
      else next[Number(m.region)] = String(m.color);
      colors = next;
    } else if (m.t === 'undone') sounds.undo();
    else if (m.t === 'finished') finish();
  }

  function finish() {
    phase = 'done';
    sounds.done();
    const s = sheet;
    // 何も塗っていない絵は、ぬりえちょうに入れない（ひとりのぬりえと同じ）
    if (!s || !Object.keys(colors).length) return;
    const bits = pack(s.mask);
    const thumb = snapshot(s.art, s.regions, colors, 200, 'image/jpeg');
    const photo = s.template ? undefined : bits;
    const lines = s.template ? bits : undefined;
    const work = { id: newId(), template: s.template, photo, lines, colors, history: [], thumb };
    saveWork({ ...work, updated: Date.now() }).catch(() => {});
  }

  function exportImage() {
    if (sheet) saveImage(snapshot(sheet.art, sheet.regions, colors, 1536), 'nurie.png');
  }

  onMount(() => {
    phase = party.host ? 'pick' : 'wait';
    const off = [
      party.onTell(
        (m) =>
          (queue = queue
            .then(() => receive(m))
            // 1 つの知らせでしくじっても、あとの知らせは続けて受ける
            .catch(() => {
              if (m.t === 'art') note = 'えを うけとれませんでした';
            }))
      )
    ];
    if (party.host)
      off.push(
        party.onAct((m, from) => {
          if (closed) return;
          const change =
            m.t === 'paint'
              ? paintBy(host, from, Number(m.region), String(m.color))
              : m.t === 'unpaint'
                ? undoBy(host, from)
                : null;
          if (!change) return;
          party.tell('all', { t: 'painted', ...change });
          // 戻す音は、実際に戻ったときだけ押した人に鳴らす（子の端末は戻せるものがあるか知らない）
          if (m.t === 'unpaint') party.tell(from, { t: 'undone' });
        })
      );
    return () => off.forEach((stop) => stop());
  });
</script>

{#if note}<p class="note" role="alert">{note}</p>{/if}
{#if phase === 'pick'}
  <Picker
    works={[]}
    ontemplate={(t) => send(templateArt(t).mask, t)}
    onwork={() => {}}
    onphoto={() => (phase = 'photo')}
    onremove={() => {}}
    onback={onagain}
  />
{:else if phase === 'photo'}
  <PhotoMaker onmake={(mask) => send(mask)} onback={() => (phase = 'pick')} />
{:else if phase === 'wait' || !sheet}
  <p class="wait" role="status">おやが えを えらんでいます…</p>
{:else}
  <div class="middle">
    <Canvas
      art={sheet.art}
      regions={sheet.regions}
      {colors}
      onfill={(region) => {
        if (phase !== 'paint') return;
        party.act({ t: 'paint', region, color });
        if (colors[region] !== color) sounds.fill();
      }}
    />
    {#if phase === 'done'}
      <Finished host={party.host} onsave={exportImage} {onagain} />
    {/if}
  </div>
  {#if phase === 'paint'}
    <Palette
      bind:color
      canUndo={true}
      onundo={() => {
        party.act({ t: 'unpaint' });
      }}
      ondone={party.host
        ? () => {
            closed = true;
            party.tell('all', { t: 'finished' });
          }
        : undefined}
      onsave={exportImage}
    />
  {/if}
{/if}

<style>
  .middle {
    position: relative;
    flex: 1;
    display: grid;
    place-items: center;
    min-height: 0;
    /* 上の隅の ✕ などに線画の角が重ならないよう空けておく */
    padding: max(68px, env(safe-area-inset-top)) 12px 12px;
    container-type: size;
  }

  .note {
    padding: max(64px, env(safe-area-inset-top)) 16px 0;
    color: var(--p2-deep);
    font-weight: 800;
    text-align: center;
  }

  .wait {
    flex: 1;
    display: grid;
    place-items: center;
    color: var(--line);
    font-weight: 800;
  }
</style>
