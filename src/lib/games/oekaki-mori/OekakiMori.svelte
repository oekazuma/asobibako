<script lang="ts">
  import { onDestroy } from 'svelte';
  import { resolve } from '$app/paths';
  import { audio, toggleMute, wake } from '$lib/audio.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import type { Message } from '$lib/net/link';
  import type { Party, Seat } from '$lib/net/party.svelte';
  import type { Bubble } from './Bubbles.svelte';
  import type { Mode, View } from './engine';
  import Invite from './Invite.svelte';
  import Lobby from './Lobby.svelte';
  import Menu from './Menu.svelte';
  import ModeSelect from './ModeSelect.svelte';
  import Play from './Play.svelte';
  import { Referee } from './referee';
  import Result, { type Drawing } from './Result.svelte';
  import Together from './Together.svelte';
  import { sounds } from './sounds';
  import { catchUp, type Screen } from './sync';
  import { apply, type Ink, type Stroke } from './strokes';
  import { typed } from './typing';

  let party = $state.raw<Party | null>(null);
  let screen = $state<Screen>('lobby');
  let view = $state.raw<View | null>(null);
  let strokes = $state.raw<Stroke[]>([]);
  let bubbles = $state.raw<Bubble[]>([]);
  let gallery = $state.raw<Drawing[]>([]);
  /** 当てる人ごとの打っている字。描く人にはそのまま、ほかの人には字数だけ届く */
  let typing = $state.raw<Record<number, string>>({});
  let close = $state(false);
  let inviting = $state(false);
  /** 親とのつながりが切れた子。ロビーで「もういちど つなぐ」を出す */
  let lost = $state(false);
  let note = $state('');
  let referee: Referee | null = null;
  let bubbleId = 0;

  function joined(next: Party) {
    note = '';
    lost = false;
    party = next;
    next.onTell(receive);
    if (next.host)
      next.onAct((m, from) => {
        if (m.t === 'join') next.tell(from, catchUp(screen, strokes, gallery));
      });
  }

  function receive(m: Message) {
    if (m.t === 'screen') {
      screen = m.screen as 'lobby' | 'mode' | 'together';
      view = null;
      strokes = [];
      gallery = [];
    } else if (m.t === 'view') show(m.view as View);
    else if (m.t === 'ink') strokes = apply(strokes, m.ink as Ink);
    else if (m.t === 'sync') {
      strokes = m.strokes as Stroke[];
      gallery = m.gallery as Drawing[];
    } else if (m.t === 'typing') typing = typed(typing, Number(m.seat), String(m.text));
    else if (m.t === 'bubble') {
      const b: Bubble = { id: ++bubbleId, seat: m.seat as Seat, text: String(m.text), note: m.note === true };
      bubbles = [...bubbles.slice(-4), b];
      setTimeout(() => (bubbles = bubbles.filter((x) => x !== b)), 3000);
      sounds.wrong();
    } else if (m.t === 'close') {
      close = true;
      setTimeout(() => (close = false), 1500);
      sounds.close();
    }
  }

  function show(next: View) {
    const prev = view;
    if (prev && next.turn !== prev.turn) {
      strokes = [];
      typing = {};
      sounds.turn();
    }
    if (prev?.phase === 'draw' && next.phase === 'reveal')
      gallery = [...gallery, { word: next.word ?? '', by: next.drawer, strokes }];
    if (prev && next.solved.length > prev.solved.length) sounds.right();
    if (prev && next.buzzer !== null && next.buzzer !== prev.buzzer) sounds.buzz();
    view = next;
    screen = next.phase === 'done' ? 'result' : 'play';
  }

  function ink(i: Ink) {
    strokes = apply(strokes, i);
    party?.act({ t: 'ink', ink: i });
  }

  function begin(mode: Mode | 'together') {
    referee?.stop();
    referee = null;
    if (mode === 'together') return party?.tell('all', { t: 'screen', screen: 'together' });
    referee = new Referee(party!);
    referee.start(mode);
  }

  function toMode() {
    referee?.stop();
    referee = null;
    party?.tell('all', { t: 'screen', screen: 'mode' });
  }

  // 親とのつながりが切れた子は、ロビーからつなぎ直す
  $effect(() => {
    if (!party?.lost) return;
    party = null;
    screen = 'lobby';
    lost = true;
    note = 'つながりが きれました';
  });

  onDestroy(() => {
    referee?.stop();
    party?.close();
  });
</script>

<svelte:window onpagehide={() => party?.close()} />

<!-- 当てる人は盤面に触れずに 50 音盤だけを押すので、どこに触れても音を起こす（iOS は操作の中でしか鳴らし始められない） -->
<main class="stage mori" onpointerdown={wake}>
  {#if screen === 'lobby' || !party}
    <Lobby {party} {note} retry={lost} onparty={joined} onstart={toMode} />
  {:else if screen === 'mode'}
    <ModeSelect {party} onpick={begin} />
  {:else if screen === 'together'}
    <Together {party} onagain={toMode} />
  {:else if screen === 'play' && view}
    <Play
      {view}
      me={party.me}
      {strokes}
      {bubbles}
      {close}
      onink={ink}
      act={(m) => party?.act(m)}
      {typing}
      ontype={(text) => party?.act({ t: 'typing', text })}
    />
  {:else if screen === 'result' && view}
    <Result {view} me={party.me} {gallery} host={party.host} onagain={toMode} />
  {/if}
  {#if party}
    <Menu {party} oninvite={() => (inviting = true)} />
    {#if party.host}<Invite away={party.away} onlink={(link) => party?.add(link)} bind:open={inviting} />{/if}
  {:else}
    <a class="round back" href={resolve('/')} aria-label="ゲーム選択へ戻る">✕</a>
    <button class="round mute" onclick={toggleMute} aria-label="ミュート" aria-pressed={audio.muted}>
      <Icon name={audio.muted ? 'mute' : 'speaker'} size="26px" />
    </button>
  {/if}
</main>

<style>
  .mori {
    background: var(--paper);
  }

  .back,
  .mute {
    position: absolute;
    top: max(10px, env(safe-area-inset-top));
  }

  .back {
    left: max(10px, env(safe-area-inset-left));
  }

  .mute {
    right: max(10px, env(safe-area-inset-right));
  }
</style>
