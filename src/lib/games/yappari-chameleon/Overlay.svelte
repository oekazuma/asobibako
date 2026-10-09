<script lang="ts">
  import BrushSize from './BrushSize.svelte';
  import Buttons from './Buttons.svelte';
  import Hud from './Hud.svelte';
  import HunterButtons from './HunterButtons.svelte';
  import Intro from './Intro.svelte';
  import Invite from './Invite.svelte';
  import Lobby from './Lobby.svelte';
  import { winnerText } from './match.svelte';
  import PaintPanel from './PaintPanel.svelte';
  import Plates from './Plates.svelte';
  import PoseWheel from './PoseWheel.svelte';
  import QuitConfirm from './QuitConfirm.svelte';
  import Ranking from './Ranking.svelte';
  import Ready from './Ready.svelte';
  import Reveal from './Reveal.svelte';
  import type { Session } from './session.svelte';
  import Spectate from './Spectate.svelte';
  import StickView from './StickView.svelte';
  import TopButtons from './TopButtons.svelte';

  let {
    session,
    radius,
    center,
    onleave
  }: { session: Session; radius: number; center: () => [number, number]; onleave: () => void } = $props();
  let inviting = $state(false);
  let asking = $state(false);
  const play = $derived(session.play);
  const match = $derived(session.match);
  const phase = $derived(match.phase);
  const won = $derived(winnerText(match.view));

  function ask() {
    // 確かめが出ているあいだは、押していた指の続きを操作にしない
    play.interrupt();
    asking = true;
  }
</script>

{#snippet top()}<TopButtons {session} />{/snippet}

<Plates plates={session.plates} />
{#if play.stick.active}
  <StickView ox={play.stick.ox} oy={play.stick.oy} x={play.stick.x} y={play.stick.y} r={radius} />
{/if}
{#if play.mode === 'paint'}
  <PaintPanel {play} />
  <BrushSize bind:value={play.brush.radius} onchange={() => play.showCursor(...center())} />
{/if}
{#if play.wheel}<PoseWheel {play} />{/if}
{#if phase === 'lobby'}
  <Lobby {session} oninvite={() => (inviting = true)} />
{:else}
  <Hud {session} />
{/if}
{#if play.role === 'hunter'}
  <HunterButtons {session} />
{:else if play.role === 'watch'}
  <Spectate {session} />
{:else}
  <!-- 控室で待つハンターは、フリーカメラで屋敷を下見できないようにする -->
  <Buttons {play} {top} free={!(match.role === 'hunter' && (phase === 'intro' || phase === 'hide'))} />
{/if}
{#if (phase === 'hide' || phase === 'reveal') && play.mode !== 'paint'}<Ready {session} />{/if}
{#if phase !== 'lobby'}
  <!-- ✕ と重ならないよう、その下に縦に積む。左の操作域の上に載るので、箱そのものは指を受けない（テストが読めるよう style 属性で書く） -->
  <div class="side" style:pointer-events="none">
    {#if match.double && (phase === 'search' || phase === 'reveal')}<Ranking {match} />{/if}
  </div>
{/if}
<Intro {match} />
{#if phase === 'reveal' && won}<Reveal text={won} />{/if}
<button class="quit" onclick={ask} aria-label="抜ける">✕</button>
{#if session.party.host}
  <Invite away={session.party.away} bind:open={inviting} onlink={(link) => session.invite(link)} />
{/if}
{#if asking}
  <QuitConfirm
    text={session.party.host ? 'ホストが抜けると、全員の試合が終わります。' : '抜けると、この試合から外れます。'}
    leave="抜ける"
    onstay={() => (asking = false)}
    {onleave}
  />
{/if}

<style>
  .side {
    position: absolute;
    top: calc(max(12px, env(safe-area-inset-top)) + 62px);
    left: max(14px, env(safe-area-inset-left));
    display: grid;
    justify-items: start;
    gap: 14px;
  }

  .quit {
    position: absolute;
    top: max(12px, env(safe-area-inset-top));
    left: max(12px, env(safe-area-inset-left));
    width: 48px;
    height: 48px;
    border: 2px solid rgb(255 255 255 / 0.85);
    border-radius: 50%;
    background: rgb(0 0 0 / 0.35);
    color: #fff;
    font-size: 22px;
  }
</style>
