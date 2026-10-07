<script lang="ts">
  import { cardInfo, cardKey } from './choice-view';
  import { isFiller, type Choice } from './choices';
  import PixelIcon from './PixelIcon.svelte';

  let {
    options,
    locked,
    tools,
    onpick,
    ontool,
    onbanish
  }: {
    options: Choice[];
    locked: boolean;
    /** 引き直す・飛ばす・除外の残り */
    tools: { rerolls: number; skips: number; banishes: number };
    onpick: (c: Choice) => void;
    ontool: (t: 'reroll' | 'skip') => void;
    onbanish: (c: Choice) => void;
  } = $props();

  /** 限界突破の札は引き直せば別の能力が出るので、ほかの埋め草の札だけのときに引き直しを出さない。除外は埋め草だけなら出さない */
  const rerolls = $derived(options.every((c) => isFiller(c) && c.kind !== 'limit') ? 0 : tools.rerolls);
  const banishes = $derived(options.every(isFiller) ? 0 : tools.banishes);
  /** 除外を押したあと、消す札を選んでいるところ */
  let banishing = $state(false);

  function choose(c: Choice) {
    if (!banishing) return onpick(c);
    if (isFiller(c)) return;
    banishing = false;
    onbanish(c);
  }

  function key(event: KeyboardEvent) {
    if (!locked && event.key.toLowerCase() === 'r' && rerolls > 0) {
      event.preventDefault();
      ontool('reroll');
      return;
    }
    const n = Number(event.key);
    if (locked || !Number.isInteger(n) || n < 1 || n > options.length) return;
    event.preventDefault();
    choose(options[n - 1]);
  }
</script>

<svelte:window onkeydown={key} />

<div class="veil">
  <section class="as-panel pop" class:as-locked={locked} class:banishing aria-label="レベルアップ">
    <h2 class="as-title">LEVEL UP!</h2>
    {#each options as c, i (cardKey(c))}
      {@const d = cardInfo(c)}
      <button class="as-card" onclick={() => choose(c)}>
        <span class="key">{i + 1}</span>
        <PixelIcon art={d.art} size="min(10cqw, 6cqh, 64px)" />
        <span class="body">
          <span class="name"
            >{d.name}{#if d.tag}<span class="tag" class:new={d.tag === 'NEW'} class:limit={d.tag === '限界突破'}
                >{d.tag}</span
              >{/if}{#if d.evo}<span class="tag evo">進化</span>{/if}</span
          >
          <span class="text">{d.text}</span>
        </span>
      </button>
    {/each}
    {#if rerolls + tools.skips + banishes > 0}
      <div class="tools">
        {#if rerolls > 0}
          <button class="as-card tool" onclick={() => ontool('reroll')}>引き直す {rerolls}</button>
        {/if}
        {#if tools.skips > 0}
          <button class="as-card tool" onclick={() => ontool('skip')}>飛ばす {tools.skips}</button>
        {/if}
        {#if banishes > 0}
          <button class="as-card tool" class:on={banishing} onclick={() => (banishing = !banishing)}
            >除外 {banishes}</button
          >
        {/if}
      </div>
    {/if}
  </section>
</div>

<style>
  .veil {
    position: absolute;
    inset: 0;
    z-index: 4;
    display: grid;
    place-items: center;
    padding: 16px;
    background: rgb(20 10 30 / 0.55);
  }

  .pop {
    animation: pop 280ms steps(4);
  }

  .tools {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(6em, 1fr));
    gap: 8px;
  }

  .tool {
    justify-content: center;
    background: #d6e8ff;
    font-size: min(3.8cqw, 2.3cqh, 19px);
  }

  .tool.on,
  .banishing .as-card:not(.tool) {
    background: #ffb4a8;
  }

  .key {
    color: #8a6a4a;
    font-size: min(3.4cqw, 2cqh, 18px);
  }

  .body {
    display: grid;
    gap: 4px;
  }

  .name {
    display: flex;
    gap: 10px;
    align-items: center;
    font-size: min(5cqw, 3cqh, 26px);
  }

  .tag {
    padding: 1px 8px;
    background: #2a64c8;
    color: #fff;
    font-size: 0.6em;
  }

  .tag.new {
    background: #d8463c;
  }

  .tag.limit {
    background: #8e2430;
  }

  .tag.evo {
    background: #e09a1c;
  }

  .text {
    font-size: min(3.8cqw, 2.3cqh, 19px);
    font-weight: 700;
    color: #5d3a2a;
  }

  @keyframes pop {
    from {
      scale: 0.6;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .pop {
      animation: none;
    }
  }
</style>
