<script lang="ts">
  import { untrack } from 'svelte';
  import { hooks } from './hooks';

  // SoloProps / GameProps どちらの onfinish 型にも構造的に合わないので never で受け、呼び出し側で絞る
  let {
    level = 0,
    onfinish,
    onhint
  }: { level?: number; onfinish: (v: never) => void; onhint?: (text: string) => void } = $props();

  // スタブは mount 時の値だけ受け皿に写せばよい（追従は要らない）
  untrack(() => {
    hooks.level = level;
    hooks.solo = onfinish as (cleared: boolean) => void;
    hooks.duel = onfinish as (winner: 1 | 2) => void;
    hooks.hint = onhint;
  });
</script>

<div data-testid="game"></div>
