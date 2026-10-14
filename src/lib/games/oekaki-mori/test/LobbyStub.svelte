<script lang="ts">
  import type { Party, Seat } from '$lib/net/party.svelte';
  import { lobby } from './lobby-hold';

  // 本物のロビーは QR の手順が要るので、つなぐ口だけをテストへ渡す
  let { onparty, was }: { onparty: (party: Party) => void; was?: Seat } & Record<string, unknown> = $props();
  $effect.pre(() => {
    lobby.onparty = onparty;
    lobby.was = was;
  });
</script>

<p>lobby</p>
