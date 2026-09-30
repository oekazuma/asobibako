<script lang="ts">
  import type { View } from '../engine';
  import Play from '../Play.svelte';

  // ターンを進めるボタンをテストから押す
  let view = $state<View>({
    mode: 'egokoro',
    phase: 'draw',
    turn: 0,
    turns: 4,
    drawer: 1,
    players: [1, 2],
    scores: { 1: 0, 2: 0 },
    left: 80,
    word: null,
    mask: '○○',
    solved: [],
    buzzer: null,
    answerLeft: 0,
    options: null,
    out: []
  });
</script>

<Play {view} me={2} strokes={[]} bubbles={[]} close={false} onink={() => {}} act={() => {}} />
<button class="next-turn" onclick={() => (view = { ...view, turn: view.turn + 1 })}>next</button>
