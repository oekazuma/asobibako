<script lang="ts">
  import { onMount } from 'svelte';
  import type { Party, Seat } from '$lib/net/party.svelte';
  import { saveImage } from '$lib/share';
  import type { Entry, Task } from './relay';
  import { relayAlbum } from './relay-album';
  import RelayPlay from './RelayPlay.svelte';
  import RelayReveal from './RelayReveal.svelte';
  import type { Ink } from './strokes';

  type Page = { chain: number; index: number; entry: Entry; last: boolean };
  type View = { phase: 'play' | 'reveal' | 'done'; step: number; steps: number; left: number; done: Seat[] };

  let { party, looks, onagain }: { party: Party; looks: Record<number, string>; onagain: () => void } = $props();

  let task = $state.raw<Task>({ kind: 'wait' });
  let view = $state.raw<View>({ phase: 'play', step: 0, steps: 0, left: 0, done: [] });
  let pages = $state.raw<Page[]>([]);

  /** めくったこまを、リレーごとに順に並べ直して 1 枚にする */
  function save() {
    const chains = [...new Set(pages.map((p) => p.chain))].sort((a, b) => a - b);
    const columns = chains.map((c) =>
      pages
        .filter((p) => p.chain === c)
        .sort((a, b) => a.index - b.index)
        .map((p) => p.entry)
    );
    saveImage(relayAlbum(columns, looks), 'oekaki-relay.png');
  }

  onMount(() =>
    party.onTell((m) => {
      if (m.t === 'relayTask') task = m.task as Task;
      else if (m.t === 'relayView') view = m as unknown as View;
      else if (m.t === 'relayPage') {
        const page = m as unknown as Page;
        // 戻った子への送り直しで同じこまが 2 度届いても、1 こまにまとめる
        pages = [...pages.filter((p) => p.chain !== page.chain || p.index !== page.index), page];
      }
    })
  );
</script>

{#if view.phase === 'play'}
  <RelayPlay
    {task}
    {view}
    {looks}
    onink={(ink: Ink) => party.act({ t: 'ink', ink })}
    ondone={(text?: string) => party.act({ t: 'relayDone', text })}
    ontype={(text) => party.act({ t: 'typing', text })}
  />
{:else}
  <RelayReveal
    {pages}
    finished={view.phase === 'done'}
    host={party.host}
    {looks}
    onnext={() => party.act({ t: 'relayNext' })}
    {onagain}
    onsave={save}
  />
{/if}
