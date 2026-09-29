<script module lang="ts">
  export type Mode = 'duo' | 'solo' | 'cup';
</script>

<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import type { IconName } from '$lib/icons';

  let { onpick }: { onpick: (mode: Mode) => void } = $props();

  const MODES: { mode: Mode; name: string; note: string; icon: IconName; color: string }[] = [
    {
      mode: 'duo',
      name: 'ふたりで たいせん',
      note: '1P と 2P が むかいあって おうえん',
      icon: 'two',
      color: 'var(--p1)'
    },
    {
      mode: 'solo',
      name: 'ひとりで たいせん',
      note: '2ひき えらんで コンピュータと しょうぶ',
      icon: 'kid',
      color: 'var(--p2)'
    },
    {
      mode: 'cup',
      name: 'トーナメント',
      note: '3かい かって ゆうしょうを めざそう',
      icon: 'trophy',
      color: 'var(--gold)'
    }
  ];
</script>

<h2 class="banner yuru">バトル</h2>
<p class="lead">ずかんの こが じどうで たたかうよ。<br />ボタンを れんだして おうえんしよう！</p>
<div class="modes">
  {#each MODES as m (m.mode)}
    <button class="mode" style:--c={m.color} onclick={() => onpick(m.mode)}>
      <span class="badge"><Icon name={m.icon} size="70%" /></span>
      <span class="text">
        <strong>{m.name}</strong>
        <small>{m.note}</small>
      </span>
    </button>
  {/each}
</div>

<style>
  .banner {
    margin: 0 0 8px;
    font-size: clamp(28px, min(5cqh, 8cqw), 48px);
  }

  .lead {
    margin: 0 auto 20px;
  }

  .modes {
    display: grid;
    gap: 14px;
    max-width: 520px;
    margin: 0 auto 20px;
  }

  .mode {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 14px 18px;
    border: 3px solid var(--line);
    border-radius: 24px;
    background: linear-gradient(100deg, color-mix(in srgb, var(--c), #fff 70%), #fff 70%);
    box-shadow: 0 5px 0 color-mix(in srgb, var(--c), var(--line) 40%);
    color: var(--line);
    text-align: left;
    cursor: pointer;
    transition: translate 100ms;
  }

  .mode:active {
    translate: 0 4px;
    box-shadow: none;
  }

  .badge {
    display: grid;
    flex: none;
    place-items: center;
    width: 64px;
    height: 64px;
    border: 3px solid #fff;
    border-radius: 50%;
    background: var(--c);
    box-shadow: var(--soft-shadow);
  }

  .text {
    display: grid;
    gap: 2px;
  }

  strong {
    font-size: 22px;
  }

  small {
    font-size: 14px;
    font-weight: 700;
    opacity: 0.8;
  }
</style>
