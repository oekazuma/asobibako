<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import { COOLDOWN } from './referee';
  import './round-button.css';
  import type { Session } from './session.svelte';

  let { session }: { session: Session } = $props();
  /** 次を撃てるまでを、ボタンのふちを時計のように埋めて見せる（0 で撃てる、1 で撃った直後） */
  const wait = $derived(session.cool / COOLDOWN);
</script>

<span class="cross" aria-hidden="true"></span>

<!-- スティックと見回しの指を置いたまま押すので、pointerdown で受ける -->
<div class="column">
  <button class="round-btn" onpointerdown={() => session.play.jump()}>
    <Icon name="lift" size="30px" />
    <span>ジャンプ</span>
  </button>
  <button
    class="round-btn"
    class:on={session.play.crouch}
    aria-pressed={session.play.crouch}
    onpointerdown={() => session.toggleCrouch()}
  >
    <Icon name="crouch" size="30px" />
    <span>しゃがむ</span>
  </button>
  <button class="round-btn shoot" style:--wait={wait} disabled={wait > 0} onpointerdown={() => session.shoot()}>
    <Icon name="aim" size="44px" />
    <span>うつ</span>
  </button>
</div>

<style>
  .cross {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 26px;
    height: 26px;
    translate: -50% -50%;
    background:
      linear-gradient(#fff, #fff) center / 2px 100% no-repeat,
      linear-gradient(#fff, #fff) center / 100% 2px no-repeat;
    filter: drop-shadow(0 0 1px #000);
    pointer-events: none;
  }

  .column {
    position: absolute;
    right: max(14px, env(safe-area-inset-right));
    bottom: max(14px, env(safe-area-inset-bottom));
    display: grid;
    justify-items: end;
    gap: 10px;
  }

  .shoot {
    width: 128px;
    height: 128px;
    position: relative;
    border-width: 0;
    background: rgb(0 0 0 / 0.4);
    font-size: 16px;
  }

  /* 待ちの輪はふちだけに描く。下に敷くと、真ん中の白いアイコンが白っぽい地に乗って読めない */
  .shoot::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: conic-gradient(rgb(255 255 255 / 0.25) calc(var(--wait) * 360deg), #fff 0);
    mask: radial-gradient(closest-side, transparent 92%, #000 93%);
    pointer-events: none;
  }
</style>
