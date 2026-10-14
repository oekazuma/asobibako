import type { Party, Seat } from '$lib/net/party.svelte';

/** LobbyStub が受け取った onparty と was。ロビーが画面から消えたあとも、テストから次の Party を渡せる */
export const lobby: { onparty?: (party: Party) => void; was?: Seat } = {};
