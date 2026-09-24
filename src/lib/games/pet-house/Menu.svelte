<script module lang="ts">
  export type Panel = 'feed' | 'tricks' | 'shop' | 'album' | 'pets' | 'contest';
</script>

<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import type { IconName } from '$lib/icons';
  import type { Kind, Scene } from './types';

  let {
    scene,
    kind,
    onopen,
    oncall,
    onwalk
  }: {
    scene: Scene;
    kind: Kind;
    onopen: (panel: Panel) => void;
    oncall: () => void;
    onwalk: () => void;
  } = $props();

  const home = $derived(scene === 'room');
  const items = $derived<
    { label: string; icon: IconName; run: () => void; off?: boolean; tint?: string; small?: boolean }[]
  >([
    // お皿は部屋にしかない
    { label: 'ごはん', icon: 'bowl', run: () => onopen('feed'), off: !home },
    { label: 'しつけ', icon: 'paw', run: () => onopen('tricks') },
    { label: 'よぶ', icon: 'heart', run: oncall },
    home
      ? { label: 'おさんぽ', icon: 'pine', run: onwalk, tint: 'var(--pastel-p1)' }
      : { label: 'おうちへ', icon: 'house', run: onwalk, tint: 'var(--pastel-p2)' },
    { label: 'コンテスト', icon: 'trophy', run: () => onopen('contest'), small: true },
    { label: 'おみせ', icon: 'bag', run: () => onopen('shop') },
    { label: 'アルバム', icon: 'star', run: () => onopen('album') },
    { label: 'なかま', icon: kind, run: () => onopen('pets') }
  ]);
</script>

<nav class="menu" aria-label="メニュー">
  {#each items as item (item.label)}
    <button class="item" class:small={item.small} style:--face={item.tint} disabled={item.off} onclick={item.run}>
      <Icon name={item.icon} size="52%" /><span>{item.label}</span>
    </button>
  {/each}
</nav>

<style>
  .menu {
    position: absolute;
    bottom: max(10px, env(safe-area-inset-bottom));
    left: 50%;
    z-index: 2;
    display: flex;
    gap: clamp(4px, 1cqw, 10px);
    translate: -50% 0;
  }

  .item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: clamp(40px, min(10.5cqw, 8cqh), 80px);
    aspect-ratio: 1;
    border: 3px solid var(--line);
    border-radius: 22%;
    background: var(--face, #fff);
    box-shadow: var(--soft-shadow);
    color: var(--line);
    font-size: clamp(9px, min(2.5cqw, 1.4cqh), 14px);
    font-weight: 800;
    white-space: nowrap;
    cursor: pointer;
    container-type: inline-size;
  }

  /* ラベルはボタンの幅から文字の大きさを決める。画面の幅から決めると、iPhone で 4〜5 文字がはみ出す */
  .item span {
    font-size: min(1em, 19cqi);
  }

  .small span {
    font-size: min(1em, 16cqi);
    letter-spacing: -0.04em;
  }

  .item:active {
    translate: 0 3px;
    box-shadow: var(--soft-press);
  }

  .item:disabled {
    opacity: 0.45;
    box-shadow: none;
    cursor: default;
  }
</style>
