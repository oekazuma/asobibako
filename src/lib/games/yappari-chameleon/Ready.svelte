<script lang="ts">
  import type { Session } from './session.svelte';

  let { session }: { session: Session } = $props();
  const match = $derived(session.match);
  const pressed = $derived(match.view.ready.includes(match.me));
  // 本家の「もうええよ」だけでは押すと何が起きるか伝わらないので、全員がそろうと起きることを書く
  const label = $derived(
    `${match.phase === 'reveal' ? 'ロビーへ戻る' : '隠れタイムを飛ばす'} ${match.view.ready.length}/${session.party.members.length}`
  );
</script>

<button class="ready" class:on={pressed} aria-pressed={pressed} onpointerdown={() => session.ready()}>
  {label}
</button>

<style>
  .ready {
    position: absolute;
    bottom: max(14px, env(safe-area-inset-bottom));
    left: 50%;
    translate: -50% 0;
    padding: 10px 26px;
    border: 2px solid rgb(255 255 255 / 0.85);
    border-radius: 999px;
    background: rgb(0 0 0 / 0.4);
    color: #fff;
    font-family: 'Hiragino Mincho ProN', serif;
    font-size: 18px;
    text-shadow: 0 1px 3px #000;
  }

  .ready.on {
    background: rgb(255 255 255 / 0.9);
    color: #1d1a17;
    text-shadow: none;
  }
</style>
