import type { Board, ChooseMoveOptions, ChooseMoveResult, Player } from "@connect4/core";
import { COLS, otherPlayer } from "@connect4/core";
import { applyMove, isLegalMove, legalMoves } from "@connect4/core";
import { checkWin } from "@connect4/core";

import { evaluateBoard, WIN_SCORE } from "./evaluate";
import { getOpeningMove } from "./openings";
import { TranspositionTable } from "./tt";

export type { ChooseMoveOptions, ChooseMoveResult };

function moveOrder(): number[] {
  const centre = Math.floor(COLS / 2);
  return Array.from({ length: COLS }, (_, c) => c).sort(
    (a, b) => Math.abs(a - centre) - Math.abs(b - centre)
  );
}

type SearchCtx = {
  tt: TranspositionTable;
  rootPlayer: Player;
  startMs: number;
  timeLimitMs: number;
  nodes: number;
};

function boardKey(board: Board, toMove: Player, rootPlayer: Player): string {
  // board is digits 0/1/2; joining is cheap and stable
  return `${rootPlayer}:${toMove}:${board.join("")}`;
}

function timeUp(ctx: SearchCtx): boolean {
  return Date.now() - ctx.startMs >= ctx.timeLimitMs;
}

function terminalScore(board: Board, rootPlayer: Player, ply: number): number | null {
  // Prefer faster wins / slower losses by subtracting/adding ply
  if (checkWin(board, rootPlayer)) return WIN_SCORE - ply;
  if (checkWin(board, otherPlayer(rootPlayer))) return -WIN_SCORE + ply;

  // Draw
  if (legalMoves(board).length === 0) return 0;

  return null;
}

function search(
  board: Board,
  depth: number,
  alpha: number,
  beta: number,
  toMove: Player,
  ply: number,
  ctx: SearchCtx
): number {
  ctx.nodes++;

  // Soft time cutoff: return heuristic eval
  if (timeUp(ctx)) return evaluateBoard(board, ctx.rootPlayer);

  const term = terminalScore(board, ctx.rootPlayer, ply);
  if (term !== null) return term;

  if (depth <= 0) return evaluateBoard(board, ctx.rootPlayer);

  const alphaOrig = alpha;
  const betaOrig = beta;

  const key = boardKey(board, toMove, ctx.rootPlayer);
  const cached = ctx.tt.get(key);
  if (cached && cached.depth >= depth) {
    if (cached.flag === "EXACT") return cached.score;

    if (cached.flag === "LOWER") alpha = Math.max(alpha, cached.score);
    else if (cached.flag === "UPPER") beta = Math.min(beta, cached.score);

    if (alpha >= beta) return cached.score;
  }

  const maximizing = toMove === ctx.rootPlayer;
  const moves = moveOrder().filter((c) => isLegalMove(board, c));

  let best = maximizing ? -Infinity : Infinity;

  for (const col of moves) {
    const res = applyMove(board, col, toMove);
    if (!res) continue;

    const score = search(res.board, depth - 1, alpha, beta, otherPlayer(toMove), ply + 1, ctx);

    if (maximizing) {
      best = Math.max(best, score);
      alpha = Math.max(alpha, best);
    } else {
      best = Math.min(best, score);
      beta = Math.min(beta, best);
    }

    if (alpha >= beta) break;
    if (timeUp(ctx)) break;
  }

  // Store TT entry with bounds flag
  let flag: "EXACT" | "LOWER" | "UPPER" = "EXACT";
  if (best <= alphaOrig) flag = "UPPER";
  else if (best >= betaOrig) flag = "LOWER";

  ctx.tt.set(key, { depth, score: best, flag });

  return best;
}

function immediateTactics(board: Board, player: Player): number | null {
  const moves = moveOrder().filter((c) => isLegalMove(board, c));

  // 1) Winning move now
  for (const col of moves) {
    const res = applyMove(board, col, player);
    if (res && checkWin(res.board, player)) return col;
  }

  // 2) Block opponent's winning move next
  const opp = otherPlayer(player);
  for (const col of moves) {
    const res = applyMove(board, col, opp);
    if (res && checkWin(res.board, opp)) return col;
  }

  return null;
}

/**
 * Main entry: returns best move + per-column scores (your "heatmap").
 */
export function chooseMove(board: Board, player: Player, opts: ChooseMoveOptions = {}): ChooseMoveResult {
  const usedDepth = Math.max(1, Math.floor(opts.depth ?? 6));
  const timeLimitMs = Math.max(10, Math.floor(opts.timeLimitMs ?? 250));

  const start = Date.now();

  // Opening book
  const openingCol = getOpeningMove(board);
  if (openingCol !== null && isLegalMove(board, openingCol)) {
    const ms = Date.now() - start;
    const columnScores = Array.from({ length: COLS }, (_, c) => (c === openingCol ? 0 : null));
    return {
      bestCol: openingCol,
      bestScore: 0,
      columnScores,
      nodes: 0,
      ms,
      usedDepth,
      opening: true
    };
  }

  // Tactics (immediate win/block) before full search
  const tacticCol = immediateTactics(board, player);
  if (tacticCol !== null) {
    const ms = Date.now() - start;
    const columnScores = Array.from({ length: COLS }, (_, c) => (c === tacticCol ? WIN_SCORE : null));
    return {
      bestCol: tacticCol,
      bestScore: WIN_SCORE,
      columnScores,
      nodes: 0,
      ms,
      usedDepth,
      opening: false
    };
  }

  const ctx: SearchCtx = {
    tt: new TranspositionTable(),
    rootPlayer: player,
    startMs: start,
    timeLimitMs,
    nodes: 0
  };

  const order = moveOrder();
  const columnScores: Array<number | null> = Array(COLS).fill(null);

  let bestCol = -1;
  let bestScore = -Infinity;

  // Evaluate each legal move from root, pick best
  for (const col of order) {
    if (!isLegalMove(board, col)) continue;

    const res = applyMove(board, col, player);
    if (!res) continue;

    // If this move wins immediately, treat as best possible
    if (checkWin(res.board, player)) {
      columnScores[col] = WIN_SCORE;
      bestCol = col;
      bestScore = WIN_SCORE;
      break;
    }

    const score = search(res.board, usedDepth - 1, -Infinity, Infinity, otherPlayer(player), 1, ctx);
    columnScores[col] = score;

    if (score > bestScore) {
      bestScore = score;
      bestCol = col;
    }

    if (timeUp(ctx)) break;
  }

  // Fallback: pick any legal move
  if (bestCol === -1) {
    const moves = legalMoves(board);
    bestCol = moves.length ? moves[Math.floor(moves.length / 2)] : 0;
    bestScore = 0;
  }

  const ms = Date.now() - start;

  return {
    bestCol,
    bestScore,
    columnScores,
    nodes: ctx.nodes,
    ms,
    usedDepth,
    opening: false
  };
}
