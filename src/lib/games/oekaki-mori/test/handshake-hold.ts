import type { Link } from '$lib/net/link';

/** HandshakeStub が受け取った onlink。テストから「つながった」を起こす */
export const handshake: { onlink?: (link: Link) => void } = {};
