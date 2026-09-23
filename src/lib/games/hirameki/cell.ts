import { toBoardPoint, TURNED_QUERY } from '$lib/board-input';

/**
 * 指の位置を、cols × rows の盤のます目の番号（y * cols + x）にする。盤の外なら -1。
 * 横向きで .stage が回っていても、盤そのものの向きで数える
 */
export function cellAt(event: PointerEvent, board: HTMLElement, cols: number, rows: number): number {
  const turned = matchMedia(TURNED_QUERY).matches;
  const [u, v] = toBoardPoint(event.clientX, event.clientY, board.getBoundingClientRect(), turned);
  const x = Math.floor(u * cols);
  const y = Math.floor(v * rows);
  return x < 0 || y < 0 || x >= cols || y >= rows ? -1 : y * cols + x;
}
