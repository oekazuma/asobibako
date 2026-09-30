<script lang="ts">
  // 本物の Canvas は canvas の描画が要るので、代わりに置く。ボタンで場所 0 を塗れる
  let { onfill }: { onfill?: (region: number) => void } & Record<string, unknown> = $props();
</script>

<p class="stub-sheet">sheet</p>
<button class="stub-tap" onclick={() => onfill?.(0)}>tap</button>
