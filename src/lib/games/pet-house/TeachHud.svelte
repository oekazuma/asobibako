<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import { trickName, TRICKS } from './engine';
  import type { Session } from './session.svelte';
  import type { Kind, TrickId } from './types';

  /** 体で教えているあいだの札。指の動かし方の案内はヒントの欄と 3D の上の印が出す */
  let { session, trick, kind }: { session: Session; trick: TrickId; kind: Kind } = $props();

  const t = $derived(TRICKS.find((k) => k.id === trick));
</script>

<div class="teach">
  <span class="name">「{t ? trickName(t, kind) : ''}」を おしえてるよ</span>
  <button class="pill" onclick={() => session.teach(null)}><Icon name="cross" size="18px" />おわる</button>
</div>

<style>
  .teach {
    position: absolute;
    bottom: calc(max(10px, env(safe-area-inset-bottom)) + clamp(64px, 8.5cqh, 110px));
    left: 50%;
    z-index: 2;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 6px 6px 16px;
    border: 3px solid var(--line);
    border-radius: 999px;
    background: var(--paper);
    box-shadow: var(--soft-shadow);
    white-space: nowrap;
    translate: -50% 0;
  }

  .name {
    font-size: clamp(15px, 2.6cqw, 19px);
    font-weight: 800;
  }
</style>
