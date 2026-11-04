import { Board, Player, ROWS, COLS, idx } from "./constants";
import { boardFull } from "./board";

const DIRECTIONS: Array<[dr: number, dc: number]> = [
  [0, 1],   // right
  [1, 0],   // down
  [1, 1],   // down-right
  [-1, 1]   // up-right
];

/**
 * Board indices of every disc that is part of a four-in-a-row for `player`
 * (more than four when lines overlap or extend), in ascending order. Empty
 * when the player has not won.
 */
export function winningCells(board: Board, player: Player): number[] {
  const cells = new Set<number>();
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      for (const [dr, dc] of DIRECTIONS) {
        const line: number[] = [];
        for (let k = 0; k < 4; k++) {
          const rr = r + dr * k;
          const cc = c + dc * k;
          if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS || board[idx(rr, cc)] !== player) break;
          line.push(idx(rr, cc));
        }
        if (line.length === 4) line.forEach((i) => cells.add(i));
      }
    }
  }
  return [...cells].sort((a, b) => a - b);
}

export function checkWin(board: Board, player: Player): boolean {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[idx(r, c)] !== player) continue;

      for (const [dr, dc] of DIRECTIONS) {
        // We already have 1 at (r,c), so need 3 more
        let ok = true;
        for (let k = 1; k < 4; k++) {
          const rr = r + dr * k;
          const cc = c + dc * k;
          if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS) {
            ok = false;
            break;
          }
          if (board[idx(rr, cc)] !== player) {
            ok = false;
            break;
          }
        }
        if (ok) return true;
      }
    }
  }
  return false;
}

export type GameStatus =
  | { state: "playing"; winner: 0 }
  | { state: "won"; winner: Player }
  | { state: "draw"; winner: 0 };

export function getStatus(board: Board, _currentPlayer?: Player): GameStatus {
  const p1Won = checkWin(board, 1);
  if (p1Won) return { state: "won", winner: 1 };

  const p2Won = checkWin(board, 2);
  if (p2Won) return { state: "won", winner: 2 };

  if (boardFull(board)) return { state: "draw", winner: 0 };

  return { state: "playing", winner: 0 };
}
