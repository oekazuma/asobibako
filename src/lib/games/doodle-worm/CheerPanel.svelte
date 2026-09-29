<script lang="ts">
  import type { Info } from './arena-draw';

  let {
    info,
    color,
    top,
    flip,
    oncheer,
    onguard
  }: {
    info: Info;
    color: string;
    /** 画面の上に置く。flip なら向かいの人から読める向きに回す */
    top: boolean;
    flip: boolean;
    /** 無ければ応援とガードのボタンを出さない（コンピュータが応援する側） */
    oncheer?: () => void;
    onguard?: () => void;
  } = $props();

  /** 連打は指ごとの pointerdown で数える。click を待つと 2 本指の連打や速い連打を取りこぼす */
  const press = (fn: () => void) => (e: PointerEvent) => {
    e.preventDefault();
    fn();
  };
</script>

<div class="panel" class:top class:flip style:--c={color}>
  <div class="bars">
    <span class="name">{info.name}<small>{info.trait}</small></span>
    <span class="bar"><i style:width="{info.hp * 100}%"></i></span>
    <span class="bar gauge" class:full={info.gauge >= 1}><i style:width="{info.gauge * 100}%"></i></span>
  </div>
  {#if oncheer && onguard}
    <div class="buttons">
      <button
        class="cheer"
        class:full={info.gauge >= 1}
        onpointerdown={press(oncheer)}
        onclick={(e) => e.detail === 0 && oncheer()}
      >
        {info.gauge >= 1 ? 'ひっさつ！' : 'がんばれ！'}
      </button>
      <button
        class="guard"
        class:cooling={info.cool > 0}
        style:--cool={info.cool}
        onpointerdown={press(onguard)}
        onclick={(e) => e.detail === 0 && onguard()}
      >
        ガード
      </button>
    </div>
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

  .buttons {
    display: flex;
    gap: 10px;
    width: 100%;
  }

  .cheer {
    flex: 1;
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

  /* 次に構えられるまでの残りを、時計の針のように暗く重ねる */
  .guard {
    flex: none;
    width: clamp(64px, 11cqh, 120px);
    height: clamp(64px, 11cqh, 120px);
    border: 5px solid #fff;
    border-radius: 50%;
    background: conic-gradient(rgb(43 45 66 / 0.45) calc(var(--cool) * 360deg), transparent 0), #63a8f7;
    color: #fff;
    font-size: clamp(14px, 2.4cqh, 24px);
    font-weight: 800;
    box-shadow: 0 6px 0 #3b7fcf;
    cursor: pointer;
  }

  .guard.cooling {
    box-shadow: none;
    translate: 0 4px;
  }

  .guard:active,
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
