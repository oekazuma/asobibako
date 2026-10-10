<script lang="ts">
  import { onDestroy } from 'svelte';
  import { animate } from '$lib/loop';
  import type { Message } from '$lib/net/link';
  import { MISMATCH, Party, type Seat } from '$lib/net/party.svelte';
  import Chameleon from './Chameleon.svelte';
  import { Crew } from './cpu/crew';
  import type { CpuChoice } from './cpu/levels';
  import Entry from './Entry.svelte';
  import { Host } from './host';
  import { levelOf, mansion } from './mansion/layout';
  import Online from './Online.svelte';
  import { readSettings } from './prefs';
  import type { Inbox } from './session.svelte';

  let screen = $state<'entry' | 'solo' | 'online'>('entry');
  let party = $state.raw<Party | null>(null);
  let host = $state.raw<Host | null>(null);
  let crew = $state.raw<Crew | null>(null);
  let note = $state('');
  /** 親とのつながりが切れた子の、切れる前の番号。入口で「もう一度つなぐ」を出し、同じ番号で戻る */
  let was = $state<Seat>();
  let stopHost: (() => void) | null = null;
  let inbox = $state.raw<Inbox | null>(null);

  function unhost() {
    stopHost?.();
    stopHost = null;
    host = null;
    crew?.stop();
    crew = null;
  }

  /** 審判は描画と別に回す。親が縦持ちにして描くのを止めても、試合の時計と CPU は進める */
  function hosting(p: Party) {
    unhost();
    const h = new Host(p, (seed) => levelOf(mansion(seed)));
    const stop = animate((dt, now) => {
      h.step();
      crew?.step(dt, now);
    });
    host = h;
    stopHost = () => {
      stop();
      h.stop();
    };
    return () => host === h && unhost();
  }

  /** CPU を席に着けてからつないだ画面へ移り、試合は 3D ができてから始める（Online が crew.go を呼ぶ） */
  async function cpu(choice: CpuChoice) {
    const p = Party.host();
    hosting(p);
    const c = new Crew(p, host!);
    crew = c;
    await c.seat(choice);
    // 待つあいだにもう一度押されて、別の親に替わった
    if (crew !== c) return p.close();
    c.queue(choice, readSettings());
    joined(p);
  }

  function joined(p: Party) {
    // 親は迎えてすぐ全員の体と塗りを送る。3D を作り終えるまで落とさないよう、ここからためる
    inbox?.stop();
    const messages: Message[] = [];
    inbox = { messages, stop: p.onTell((m) => messages.push(m)) };
    note = '';
    was = undefined;
    party = p;
    screen = 'online';
  }

  function leave(text = '', seat?: Seat) {
    inbox?.stop();
    inbox = null;
    party?.close();
    party = null;
    unhost();
    note = text;
    was = seat;
    screen = 'entry';
  }

  // 子で親とのつながりが切れたら、入口から同じ番号でつなぎ直せるようにする（版ちがいで切られたら戻れない）
  $effect(() => {
    if (!party?.lost) return;
    if (party.mismatch) leave(MISMATCH);
    else leave('ホストとの接続が切れました', party.me);
  });

  onDestroy(() => leave());
</script>

<svelte:window onpagehide={() => party?.close()} />

<!-- 横持ちで遊ぶので、共通の .stage を横向きで回さない（.wide） -->
<main class="stage wide">
  {#if screen === 'solo'}
    <Chameleon onquit={() => (screen = 'entry')} />
  {:else if screen === 'online' && party}
    <Online {party} {host} {inbox} {crew} onleave={(text) => leave(text)} />
  {:else}
    <Entry {note} {was} onhost={hosting} onparty={joined} onsolo={() => (screen = 'solo')} oncpu={cpu} />
  {/if}
</main>
