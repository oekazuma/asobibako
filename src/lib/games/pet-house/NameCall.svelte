<script lang="ts">
  import { onDestroy } from 'svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { BREEDS } from './breeds';
  import { speak } from './cries';
  import { pushToTalk } from './listen';
  import { sounds } from './sounds';
  import type { BreedId } from './types';
  import { addCalls, callKey, CALLS_TO_LEARN } from './voice';

  let {
    name,
    breed,
    onfinish,
    onheard
  }: {
    name: string;
    breed: BreedId;
    /** 覚えた呼び名。「あとで」で飛ばしたときは、そこまでに聞けた分（空のこともある） */
    onfinish: (calls: string[]) => void;
    /** 名前として聞けた回数（1 から）。渡すと、絵の顔を出さずにそちらで反応させる（3D の子） */
    onheard?: (count: number) => void;
  } = $props();

  const REACT = ['', 'perk', 'tilt', 'joy'];
  const NOTE = ['', 'ピクッ！', 'ん？', 'おぼえた！'];

  let calls = $state<string[]>([]);
  let count = $state(0);
  let listening = $state(false);
  let said = $state('');
  const b = $derived(BREEDS[breed]);
  const done = $derived(count >= CALLS_TO_LEARN);

  const talk = pushToTalk(() => {
    listening = true;
    said = '';
    return {
      result(alts) {
        said = `「${alts[0]}」`;
        if (!alts.some((t) => callKey(t))) {
          said += ' なまえだけを よんでね';
          return;
        }
        calls = addCalls(calls, alts);
        count++;
        if (count >= CALLS_TO_LEARN) sounds.learned();
        if (onheard) onheard(count);
        else if (count < CALLS_TO_LEARN) speak(breed, 'answer');
      },
      error(reason) {
        said = reason;
      },
      end() {
        listening = false;
      }
    };
  });
  onDestroy(() => talk.stop());
</script>

<div class="name-call">
  {#if !onheard}
    <div style:position="relative">
      {#key count}
        <span class="face {REACT[count]}" style:background={b.color}>
          <Icon name={done ? `${b.kind}-happy` : b.kind} size="78%" />
        </span>
        {#if count > 0}<span class="note">{NOTE[count]}</span>{/if}
      {/key}
    </div>
  {/if}
  <h2 class="yuru">なまえを よんで おぼえさせよう</h2>
  <p class="guide">
    {done
      ? `${name}は じぶんの なまえを おぼえたよ`
      : `マイクを おしながら「${name}」と よんでね（${count} / ${CALLS_TO_LEARN}）`}
  </p>
  {#if said}<p class="said" role="status">{said}</p>{/if}
  {#if done}
    <button class="pill p2" onclick={() => onfinish(calls)}>できた！</button>
  {:else}
    <button
      class="mic"
      class:live={listening}
      aria-label="マイク。おしながら なまえを よぶ"
      aria-pressed={listening}
      onpointerdown={talk.down}
      onpointerup={talk.up}
      onpointercancel={talk.up}
      onclick={talk.click}
    >
      <svg viewBox="0 0 24 24" width="50%" height="50%">
        <rect x="8.5" y="2.5" width="7" height="12" rx="3.5" fill="currentColor" />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v3.5M8 21.5h8" fill="none" stroke="currentColor" stroke-width="2.2" />
      </svg>
    </button>
    <button class="pill" onclick={() => onfinish(calls)}>あとで</button>
  {/if}
</div>

<style>
  .name-call {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: clamp(10px, 1.8cqh, 18px);
    width: min(100%, 520px);
    text-align: center;
  }

  .face {
    display: grid;
    place-items: center;
    width: clamp(88px, 14cqh, 140px);
    aspect-ratio: 1;
    border: 3px solid var(--line);
    border-radius: 50%;
  }

  .perk {
    animation: perk 500ms var(--spring);
  }

  .tilt {
    rotate: -14deg;
  }

  .joy {
    animation: joy 420ms ease-in-out 3 alternate;
  }

  .note {
    position: absolute;
    top: -6px;
    right: -34px;
    padding: 4px 10px;
    border: 3px solid var(--line);
    border-radius: 14px;
    background: #fff;
    font-size: 18px;
    font-weight: 800;
    white-space: nowrap;
    animation: perk 400ms var(--spring);
  }

  h2 {
    --fill: var(--pastel-gold);
    font-size: clamp(18px, min(3.4cqh, 5.4cqw), 34px);
    white-space: nowrap;
  }

  .guide,
  .said {
    margin: 0;
    font-size: 17px;
    font-weight: 800;
    word-break: keep-all;
  }

  .mic {
    display: grid;
    place-items: center;
    width: clamp(84px, 12cqh, 120px);
    aspect-ratio: 1;
    border: 3px solid var(--line);
    border-radius: 50%;
    background: #fff;
    box-shadow: var(--soft-shadow);
    color: var(--line);
    cursor: pointer;
  }

  .live {
    outline: 10px solid rgb(255 77 94 / 0.3);
    background: var(--pastel-p2);
    color: #fff;
  }

  @keyframes perk {
    40% {
      scale: 1.08 1.18;
    }
  }

  @keyframes joy {
    to {
      translate: 0 -14px;
      rotate: 6deg;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .face,
    .note {
      animation: none;
    }
  }
</style>
