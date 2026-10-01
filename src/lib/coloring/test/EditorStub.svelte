<script lang="ts">
  import type { Edit } from '../edits';
  import { editor } from './editor-hold';

  // 本物は canvas に線画を描くので、直しを受け取る口だけをテストへ渡す
  let { onedit }: { onedit: (e: Edit) => void } & Record<string, unknown> = $props();
  $effect.pre(() => {
    editor.onedit = onedit;
  });
</script>

<p>editor</p>
