export const ROWS = 6 as const;
export const COLS = 7 as const;
export const WIN_LENGTH = 4 as const;

export type Player = 1 | 2;
export type Cell = 0 | Player;
export type Board = Cell[];

export const EMPTY: Cell = 0;

export function otherPlayer(p: Player): Player {
  return (p === 1 ? 2 : 1) as Player;
}

export function inBounds(row: number, col: number): boolean {
  return row >= 0 && row < ROWS && col >= 0 && col < COLS;
}

export function idx(row: number, col: number): number {
  return row * COLS + col;
}
