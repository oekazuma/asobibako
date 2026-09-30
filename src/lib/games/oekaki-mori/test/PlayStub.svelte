<script lang="ts">
  import type { Stroke } from '../strokes';

  // 本物の盤面は canvas が要るので、受け取った線の数だけを出す
  let { strokes }: { strokes: Stroke[] } & Record<string, unknown> = $props();
</script>

<p class="stub-strokes">{strokes.length}</p>
