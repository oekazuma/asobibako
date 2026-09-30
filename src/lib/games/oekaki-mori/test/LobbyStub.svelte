<script lang="ts">
  import type { Party } from '$lib/net/party.svelte';
  import { lobby } from './lobby-hold';

  // 本物のロビーは QR の手順が要るので、つなぐ口だけをテストへ渡す
  let { onparty }: { onparty: (party: Party) => void } & Record<string, unknown> = $props();
  $effect.pre(() => {
    lobby.onparty = onparty;
  });
</script>

<p>lobby</p>
