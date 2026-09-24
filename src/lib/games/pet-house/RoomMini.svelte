<script lang="ts">
  import type { RoomPart } from './decor';

  let { swatch }: { swatch: Record<RoomPart, string> } = $props();
</script>

<span class="mini" aria-hidden="true">
  <span class="wall" style:background={swatch.wall}></span>
  <span class="view" style:background={swatch.view}></span>
  <span class="floor" style:background={swatch.floor}></span>
  <span class="rug" style:background={swatch.rug}></span>
  <span class="sofa" style:background={swatch.sofa}></span>
</span>

<style>
  /* セットの見本は、壁・窓・床・ラグ・ソファを重ねた小さな部屋の絵 */
  .mini {
    position: relative;
    width: 140px;
    height: 84px;
    overflow: hidden;
    border: 3px solid var(--line);
    border-radius: 12px;
  }

  .mini > span {
    position: absolute;
    border-radius: 5px;
  }

  .wall {
    inset: 0 0 38% 0;
  }

  .view {
    top: 10%;
    left: 10%;
    width: 24%;
    height: 34%;
    border: 2px solid #fff;
  }

  .floor {
    inset: 62% 0 0 0;
  }

  .rug {
    bottom: 6%;
    left: 30%;
    width: 44%;
    height: 22%;
  }

  .sofa {
    top: 38%;
    left: 44%;
    width: 46%;
    height: 26%;
  }
</style>
