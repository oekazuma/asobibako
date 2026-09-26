<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import { BathPlay } from './bath.svelte';
  import { SHOP } from './engine';
  import type { Session } from './session.svelte';
  import type { ToyId } from './types';
  import { ITEM_ICON } from './ui';

  type Tool = 'hand' | 'brush' | 'toy';

  let {
    tool,
    toy,
    toys,
    onpick,
    onphoto,
    session
  }: {
    tool: Tool;
    toy: ToyId;
    /** いまのペットと遊べる、持っているおもちゃ */
    toys: ToyId[];
    onpick: (tool: Tool, toy?: ToyId) => void;
    onphoto: () => void;
    /** おふろへ行く・投げたおもちゃを待つのに使う */
    session: Session;
  } = $props();

  const toyName = (id: ToyId) => SHOP.find((i) => i.id === id)?.name ?? '';

  let open = $state(false);

  function pick(next: Tool) {
    open = false;
    onpick(next);
  }

  // 持ち替えられることに気づけるよう、おもちゃが 2 つ以上なら最初のタップから選ぶ吹き出しを出す
  function pickToy() {
    if (tool !== 'toy') onpick('toy', toys.includes(toy) ? toy : toys[0]);
    if (toys.length > 1) open = !open;
  }
</script>

<div class="tools">
  <button class="tool" class:on={tool === 'hand'} aria-pressed={tool === 'hand'} onclick={() => pick('hand')}>
    <Icon name="pat" size="60%" /><span>なでる</span>
  </button>
  <button class="tool" class:on={tool === 'brush'} aria-pressed={tool === 'brush'} onclick={() => pick('brush')}>
    <Icon name="brush" size="60%" /><span>ブラシ</span>
  </button>
  <button class="tool" onclick={() => session.start(new BathPlay(), 'おふろへ いくよ')}>
    <Icon name="drop" size="60%" /><span>おふろ</span>
  </button>
  {#if toys.length > 0}
    <div class="with-bubble">
      <button
        class="tool"
        class:on={tool === 'toy'}
        class:out={session.away}
        aria-pressed={tool === 'toy'}
        onclick={pickToy}
      >
        <Icon name={ITEM_ICON[toys.includes(toy) ? toy : toys[0]]} size="60%" />
        <span>{session.away ? 'なげてるよ' : 'おもちゃ'}</span>
      </button>
      {#if open}
        <div class="bubble">
          {#each toys as id (id)}
            <button
              class="pick"
              class:on={id === toy}
              onclick={() => {
                open = false;
                onpick('toy', id);
              }}
            >
              <Icon name={ITEM_ICON[id]} size="28px" />{toyName(id)}
            </button>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
  <button class="tool photo" onclick={onphoto}>
    <Icon name="camera" size="60%" /><span>しゃしん</span>
  </button>
</div>

<style>
  .tools {
    position: absolute;
    top: 50%;
    left: max(10px, env(safe-area-inset-left));
    z-index: 2;
    display: flex;
    flex-direction: column;
    gap: clamp(6px, 1.2cqh, 12px);
    translate: 0 -50%;
  }

  .tool {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: clamp(52px, min(8cqh, 15cqw), 76px);
    aspect-ratio: 1;
    border: 3px solid var(--line);
    border-radius: 22%;
    background: #fff;
    box-shadow: var(--soft-shadow);
    color: var(--line);
    font-size: clamp(10px, min(1.3cqh, 2.6cqw), 13px);
    font-weight: 800;
    cursor: pointer;
  }

  .tool:active,
  .pick:active {
    translate: 0 3px;
    box-shadow: var(--soft-press);
  }

  .on {
    background: var(--pastel-gold);
  }

  /* 投げたおもちゃが手元に戻るまで。手に持っていないのが見てわかるよう絵を薄くする */
  .out {
    border-style: dashed;
  }

  .out :global(svg) {
    opacity: 0.3;
  }

  .photo {
    margin-top: clamp(6px, 1.5cqh, 16px);
    background: var(--pastel-p1);
  }

  .with-bubble {
    position: relative;
  }

  .bubble {
    position: absolute;
    top: 50%;
    left: calc(100% + 10px);
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px;
    border: 3px solid var(--line);
    border-radius: 20px;
    background: var(--paper);
    box-shadow: var(--soft-shadow);
    translate: 0 -50%;
    animation: pop 320ms var(--spring);
  }

  .pick {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px 6px 8px;
    border: 2px solid var(--line);
    border-radius: 999px;
    background: #fff;
    box-shadow: var(--soft-shadow);
    color: var(--line);
    font-size: 15px;
    font-weight: 800;
    white-space: nowrap;
    cursor: pointer;
  }

  .pick.on {
    background: var(--pastel-gold);
  }

  @keyframes pop {
    from {
      scale: 0.5;
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .bubble {
      animation: none;
    }
  }
</style>
