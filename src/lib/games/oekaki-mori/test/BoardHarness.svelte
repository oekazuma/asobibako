<script lang="ts">
  import Board from '../Board.svelte';
  import type { Ink } from '../strokes';

  // 描いている途中でペンを取り上げる（描く時間が終わる）ところを、テストから押せるボタンで起こす
  let { onink }: { onink: (ink: Ink) => void } = $props();
  let pen = $state<{ color: string; size: number } | null>({ color: '#000', size: 0.01 });
</script>

<Board strokes={[]} {pen} {onink} />
<button class="drop-pen" onclick={() => (pen = null)}>drop</button>
