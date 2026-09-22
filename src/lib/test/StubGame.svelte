<script lang="ts">
  import { hooks } from './hooks';

  // SoloProps / GameProps どちらの onfinish 型にも構造的に合わないので never で受け、呼び出し側で絞る
  let { level = 0, onfinish }: { level?: number; onfinish: (v: never) => void } = $props();

  hooks.level = level;
  hooks.solo = onfinish as (cleared: boolean) => void;
  hooks.duel = onfinish as (winner: 1 | 2) => void;
</script>

<div data-testid="game"></div>
