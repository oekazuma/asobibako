<script lang="ts">
  import { ICONS, type IconName } from '$lib/icons';

  /** rotate は時計回りの角度（矢印の向きを変えるのに使う） */
  let { name, size = '1em', rotate = 0 }: { name: IconName; size?: string; rotate?: number } = $props();
</script>

<svg class="icon" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" style:rotate="{rotate}deg">
  <!-- 同じパスを太いふちと細い芯で 2 度重ねるアイコンがあるので、d ではなく層そのもので見分ける -->
  {#each ICONS[name] as layer (layer)}
    <path
      d={layer.d}
      fill={'fill' in layer ? layer.fill : 'none'}
      stroke={'stroke' in layer ? layer.stroke : 'none'}
      stroke-width={'width' in layer ? layer.width : 0}
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  {/each}
</svg>

<style>
  .icon {
    display: inline-block;
    flex: none;
    vertical-align: -0.15em;
  }
</style>
