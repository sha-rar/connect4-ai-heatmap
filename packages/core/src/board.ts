import { Board, Cell, Player, ROWS, COLS, EMPTY, idx } from "./constants";

export function makeEmptyBoard(): Board {
  return Array(ROWS * COLS).fill(EMPTY) as Board;
}

export function cloneBoard(board: Board): Board {
  return board.slice() as Board;
}

export function getCell(board: Board, row: number, col: number): Cell {
  return board[idx(row, col)];
}

export function setCell(board: Board, row: number, col: number, value: Cell): Board {
  const next = cloneBoard(board);
  next[idx(row, col)] = value;
  return next;
}

export function findDropRow(board: Board, col: number): number {
  if (col < 0 || col >= COLS) return -1;

  for (let r = ROWS - 1; r >= 0; r--) {
    if (getCell(board, r, col) === EMPTY) return r;
  }
  return -1;
}

export type ApplyMoveResult = {
  board: Board;
  row: number;
  col: number;
};

export function applyMove(board: Board, col: number, player: Player): ApplyMoveResult | null {
  const row = findDropRow(board, col);
  if (row === -1) return null;

  const next = cloneBoard(board);
  next[idx(row, col)] = player;

  return { board: next, row, col };
}

export function isLegalMove(board: Board, col: number): boolean {
  if (col < 0 || col >= COLS) return false;
  return getCell(board, 0, col) === EMPTY;
}

export function legalMoves(board: Board): number[] {
  const moves: number[] = [];
  for (let c = 0; c < COLS; c++) {
    if (isLegalMove(board, c)) moves.push(c);
  }
  return moves;
}

export function boardFull(board: Board): boolean {
  return legalMoves(board).length === 0;
}

export function toMatrix(board: Board): Cell[][] {
  const grid: Cell[][] = [];
  for (let r = 0; r < ROWS; r++) {
    const row: Cell[] = [];
    for (let c = 0; c < COLS; c++) row.push(getCell(board, r, c));
    grid.push(row);
  }
  return grid;
}

export function fromMatrix(grid: Cell[][]): Board {
  const flat: Cell[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      flat.push((grid?.[r]?.[c] ?? EMPTY) as Cell);
    }
  }
  return flat as Board;
}
