import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { Board, Player } from "@connect4/core";
import { applyMove, getStatus, isLegalMove, makeEmptyBoard, winningCells } from "@connect4/core";

import { chooseMove } from "../../lib/api";
import type { Analysis, GameMode, Settings } from "./types";
import { DEFAULT_SETTINGS, searchFor } from "./types";

const STORAGE_KEY = "connect4.settings";

function loadSettings(): Settings {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    return saved ? { ...DEFAULT_SETTINGS, ...saved } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function boardAfter(moves: number[]): Board {
  let board = makeEmptyBoard();
  moves.forEach((col, i) => {
    board = applyMove(board, col, i % 2 === 0 ? 1 : 2)!.board;
  });
  return board;
}

/**
 * Game state for one board: the move list (so undo is exact), the derived
 * board and result, and engine requests. Every new game, undo or move bumps a
 * request token so that a late engine answer for an old position is ignored.
 */
export function useGame() {
  const [mode, setMode] = useState<GameMode>("ai");
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [moves, setMoves] = useState<number[]>([]);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [busy, setBusy] = useState<"play" | "analyse" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const token = useRef(0);
  const pendingKey = useRef<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Storage unavailable (private mode); settings last for this visit only.
    }
  }, [settings]);

  const board = useMemo(() => boardAfter(moves), [moves]);
  const toMove: Player = moves.length % 2 === 0 ? 1 : 2;
  const status = useMemo(() => getStatus(board), [board]);
  const winCells = useMemo(
    () => (status.state === "won" ? winningCells(board, status.winner) : []),
    [board, status]
  );
  const over = status.state !== "playing";
  const aiPlayer = settings.aiPlayer;
  const aiToMove = mode === "ai" && !over && toMove === aiPlayer;

  /** Cancel any pending engine answer. */
  const invalidate = useCallback(() => {
    token.current++;
    pendingKey.current = null;
    setBusy(null);
  }, []);

  const runEngine = useCallback(
    async (kind: "play" | "analyse", position: number[]) => {
      const key = `${kind}:${position.join("")}`;
      if (pendingKey.current === key) return; // already asked (e.g. React StrictMode re-run)
      const mine = ++token.current;
      pendingKey.current = key;
      setBusy(kind);
      setError(null);

      const forPlayer: Player = position.length % 2 === 0 ? 1 : 2;
      const search = searchFor(settings);
      const resp = await chooseMove({ board: boardAfter(position), player: forPlayer, ...search });
      if (token.current !== mine) return; // superseded

      pendingKey.current = null;
      setBusy(null);
      if (!resp.ok) {
        setError(resp.error);
        return;
      }
      setAnalysis({
        ply: position.length,
        forPlayer,
        played: kind === "play",
        bestCol: resp.bestCol,
        columnScores: resp.columnScores,
        usedDepth: resp.usedDepth,
        requestedDepth: search.depth,
        timeLimitMs: search.timeLimitMs,
        ms: resp.ms,
        nodes: resp.nodes,
        opening: resp.opening,
        timedOut: resp.timedOut
      });
      if (kind === "play" && isLegalMove(boardAfter(position), resp.bestCol)) {
        setMoves([...position, resp.bestCol]);
      }
    },
    [settings]
  );

  // The engine moves on its own turn.
  useEffect(() => {
    if (aiToMove) void runEngine("play", moves);
  }, [aiToMove, moves, runEngine]);

  const drop = useCallback(
    (col: number) => {
      if (over || aiToMove || busy === "play" || !isLegalMove(board, col)) return;
      invalidate(); // a pending hint is for the old position
      setMoves((m) => [...m, col]);
    },
    [over, aiToMove, busy, board, invalidate]
  );

  /** Moves to take back so a human is to move again. */
  const undoCount = useMemo(() => {
    if (moves.length === 0) return 0;
    if (mode === "local") return 1;
    // Remove the last human move and any engine reply after it.
    const humanMoves = moves.filter((_, i) => (i % 2 === 0 ? 1 : 2) !== aiPlayer).length;
    if (humanMoves === 0) return 0;
    const lastByAi = ((moves.length - 1) % 2 === 0 ? 1 : 2) === aiPlayer;
    return lastByAi ? 2 : 1;
  }, [moves, mode, aiPlayer]);

  const undo = useCallback(() => {
    if (undoCount === 0) return;
    invalidate();
    setError(null);
    setMoves((m) => m.slice(0, m.length - undoCount));
  }, [undoCount, invalidate]);

  const newGame = useCallback(
    (nextMode: GameMode = mode) => {
      invalidate();
      setMode(nextMode);
      setMoves([]);
      setAnalysis(null);
      setError(null);
    },
    [mode, invalidate]
  );

  const analyse = useCallback(() => {
    if (!over && !busy) void runEngine("analyse", moves);
  }, [over, busy, moves, runEngine]);

  /** Ask again after an engine error. */
  const retry = useCallback(() => {
    pendingKey.current = null;
    void runEngine(aiToMove ? "play" : "analyse", moves);
  }, [aiToMove, moves, runEngine]);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((s) => ({ ...s, ...patch }));
  }, []);

  const setGameMode = useCallback(
    (next: GameMode) => {
      invalidate();
      setMode(next);
    },
    [invalidate]
  );

  // Analysis describes the current position, or the one the engine just
  // played from; anything older is hidden.
  const shownAnalysis =
    analysis &&
    (analysis.ply === moves.length || (analysis.played && analysis.ply === moves.length - 1))
      ? analysis
      : null;

  return {
    mode,
    setMode: setGameMode,
    settings,
    updateSettings,
    moves,
    board,
    toMove,
    status,
    winCells,
    over,
    aiToMove,
    busy,
    error,
    analysis: shownAnalysis,
    drop,
    undo,
    canUndo: undoCount > 0,
    newGame,
    analyse,
    retry
  };
}

export type Game = ReturnType<typeof useGame>;
