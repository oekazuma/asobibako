<script lang="ts">
  import type { Info } from './arena-draw';

  let {
    info,
    color,
    top,
    flip,
    oncheer
  }: {
    info: Info;
    color: string;
    /** 画面の上に置く。flip なら向かいの人から読める向きに回す */
    top: boolean;
    flip: boolean;
    /** 無ければ応援のボタンを出さない（コンピュータが応援する側） */
    oncheer?: () => void;
  } = $props();
</script>

<div class="panel" class:top class:flip style:--c={color}>
  <div class="bars">
    <span class="name">{info.name}<small>{info.trait}</small></span>
    <span class="bar"><i style:width="{info.hp * 100}%"></i></span>
    <span class="bar gauge" class:full={info.gauge >= 1}><i style:width="{info.gauge * 100}%"></i></span>
  </div>
  {#if oncheer}
    <!-- 連打は指ごとの pointerdown で数える。click を待つと 2 本指の連打や速い連打を取りこぼす -->
    <button
      class="cheer"
      class:full={info.gauge >= 1}
      onpointerdown={(e) => {
        e.preventDefault();
        oncheer();
      }}
      onclick={(e) => e.detail === 0 && oncheer()}
    >
      {info.gauge >= 1 ? 'ひっさつ！' : 'がんばれ！'}
    </button>
  {/if}
</div>

<style>
  .panel {
    position: absolute;
    bottom: max(12px, env(safe-area-inset-bottom));
    left: 50%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    width: min(86%, 520px);
    translate: -50% 0;
  }

  .panel.top {
    top: 12px;
    bottom: auto;
    flex-direction: column-reverse;
    width: min(62%, 420px);
  }

  .panel.flip {
    flex-direction: column;
    rotate: 180deg;
  }

  .bars {
    display: grid;
    gap: 5px;
    width: 100%;
    padding: 8px 12px;
    border: 3px solid #fff;
    border-radius: 18px;
    background: rgb(255 255 255 / 0.9);
    box-shadow: var(--lift);
  }

  .name {
    font-weight: 800;
    color: var(--ink);
  }

  small {
    margin-left: 8px;
    padding: 1px 8px;
    border-radius: 999px;
    background: var(--c);
    color: #fff;
    font-size: 0.75em;
  }

  .bar {
    height: 12px;
    overflow: hidden;
    border-radius: 999px;
    background: #e8e8ef;
  }

  .bar i {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: var(--c);
    transition: width 150ms;
  }

  .gauge {
    height: 8px;
  }

  .gauge i {
    background: var(--gold);
  }

  .gauge.full i {
    background: var(--gold-deep);
  }

  .cheer {
    width: 100%;
    height: clamp(64px, 11cqh, 120px);
    border: 5px solid #fff;
    border-radius: 999px;
    background: var(--c);
    color: #fff;
    font-size: clamp(22px, 4.2cqh, 44px);
    font-weight: 800;
    box-shadow: 0 6px 0 color-mix(in srgb, var(--c), #000 25%);
    cursor: pointer;
  }

  .cheer.full {
    background: var(--gold);
    box-shadow: 0 6px 0 var(--gold-deep);
  }

  .cheer:active {
    translate: 0 4px;
    box-shadow: none;
  }

  @media (prefers-reduced-motion: reduce) {
    .bar i {
      transition: none;
    }
  }
</style>
