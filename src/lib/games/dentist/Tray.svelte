<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import type { ToolId } from './engine';

  const NAMES: Record<ToolId, string> = {
    brush: 'ブラシ',
    drill: 'ドリル',
    tweezers: 'ピンセット',
    filling: 'つめもの',
    pliers: 'ペンチ',
    shot: 'ちゅうしゃ',
    pat: 'よしよし'
  };

  let {
    tools,
    current,
    nudge,
    spent,
    onselect
  }: { tools: ToolId[]; current: ToolId; nudge: ToolId | null; spent: ToolId[]; onselect: (tool: ToolId) => void } =
    $props();
</script>

<div class="tray" role="toolbar" aria-label="どうぐ">
  {#each tools as tool (tool)}
    <button
      class="tool"
      class:on={tool === current}
      class:nudge={tool === nudge}
      class:spent={spent.includes(tool)}
      aria-label={NAMES[tool]}
      aria-pressed={tool === current}
      onpointerdown={(event) => {
        event.preventDefault();
        onselect(tool);
      }}
      onclick={(event) => {
        // 指では pointerdown で持ちかえ済み。キーボードや VoiceOver の操作だけがここで選ぶ
        if (event.detail === 0) onselect(tool);
      }}
    >
      <Icon name={tool} size="72%" />
    </button>
  {/each}
</div>

<style>
  .tray {
    display: flex;
    justify-content: center;
    gap: min(2.4cqw, 16px);
    padding: min(2.4cqh, 18px) 12px max(min(2.4cqh, 18px), env(safe-area-inset-bottom));
    border-top: 4px solid #5b4a42;
    background: #e9dcc4;
  }

  .tool {
    display: grid;
    place-items: center;
    width: min(12cqw, 9cqh, 96px);
    aspect-ratio: 1;
    border: 4px solid #5b4a42;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 5px 0 rgb(74 46 31 / 0.25);
    transition:
      translate 120ms,
      opacity 200ms;
  }

  .tool:active {
    translate: 0 3px;
    box-shadow: 0 2px 0 rgb(74 46 31 / 0.25);
  }

  .on {
    background: #fff3c4;
    box-shadow:
      0 0 0 5px var(--gold),
      0 5px 0 rgb(74 46 31 / 0.25);
  }

  .spent {
    opacity: 0.4;
  }

  .nudge {
    animation: nudge 700ms var(--spring) infinite;
  }

  @keyframes nudge {
    30% {
      translate: 0 -14px;
      rotate: -8deg;
    }
    60% {
      translate: 0 0;
      rotate: 6deg;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .nudge {
      animation: none;
      outline: 5px dashed var(--gold);
    }
  }
</style>
