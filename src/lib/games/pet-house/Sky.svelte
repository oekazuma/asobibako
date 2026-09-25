<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import type { IconName } from '$lib/icons';
  import { PHASE_NAME, WEATHER_NAME, type Phase, type Weather } from './daytime';

  let { sky }: { sky: { phase: Phase; weather: Weather } } = $props();

  /** 夕方と夜は時間帯の絵を先に出す。晴れの夜は月だけ、晴れの昼はお日さまだけ */
  const icons = $derived.by(() => {
    const time: IconName | null = sky.phase === 'evening' ? 'sunset' : sky.phase === 'night' ? 'moon' : null;
    const weather: IconName | null =
      sky.weather === 'sunny' ? (time ? null : 'sun') : sky.weather === 'cloudy' ? 'cloud' : sky.weather;
    return [time, weather].filter((i) => i !== null);
  });
</script>

<div class="sky" role="img" aria-label="{PHASE_NAME[sky.phase]}・{WEATHER_NAME[sky.weather]}">
  {#each icons as icon (icon)}
    <Icon name={icon} size="26px" />
  {/each}
</div>

<style>
  /* 左上の ✕ のすぐ下。札とヒントの吹き出しにはかぶらない */
  .sky {
    position: absolute;
    top: calc(max(12px, env(safe-area-inset-top)) + 58px);
    left: max(12px, env(safe-area-inset-left));
    z-index: 2;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 5px;
    border: 3px solid var(--line);
    border-radius: 999px;
    background: rgb(255 250 242 / 0.94);
    box-shadow: var(--soft-shadow);
    pointer-events: none;
  }
</style>
