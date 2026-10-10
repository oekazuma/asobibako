<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import './round-button.css';
  import type { Session } from './session.svelte';

  let { session }: { session: Session } = $props();
  const watching = $derived(session.watching);
  const free = $derived(watching === null);
</script>

<!-- 左右の矢印でほかの人を順に見るか、フリーカメラで見て回る。スティックの指を置いたまま押すので pointerdown で受ける -->
<div class="spectate">
  <p class="label">観戦中</p>
  <p class="who">{watching === null ? 'フリーカメラ' : session.match.name(watching)}</p>
  <div class="row">
    <button class="round-btn small" aria-label="前の人" onpointerdown={() => session.next(-1)}>
      <Icon name="arrow" size="26px" rotate={-90} />
    </button>
    <button class="round-btn small" aria-label="次の人" onpointerdown={() => session.next(1)}>
      <Icon name="arrow" size="26px" rotate={90} />
    </button>
    <button
      class="round-btn"
      class:on={free}
      aria-pressed={free}
      onpointerdown={() => (free ? session.next(1) : session.free())}
    >
      <Icon name="eye" size="26px" />
      <span>フリーカメラ</span>
    </button>
  </div>
</div>

<style>
  .spectate {
    position: absolute;
    bottom: max(14px, env(safe-area-inset-bottom));
    left: max(14px, env(safe-area-inset-left));
    color: #fff;
    font-family: 'Hiragino Mincho ProN', serif;
    text-shadow: 0 2px 4px #000;
  }

  p {
    margin: 0;
  }

  .label {
    font-size: 26px;
  }

  .who {
    margin-bottom: 8px;
    font-size: 16px;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .small {
    width: 64px;
    height: 64px;
  }
</style>
