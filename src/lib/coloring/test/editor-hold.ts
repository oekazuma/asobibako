import type { Edit } from '../edits';

/** EditorStub が受け取った onedit。テストから直しを起こす */
export const editor: { onedit?: (e: Edit) => void } = {};
