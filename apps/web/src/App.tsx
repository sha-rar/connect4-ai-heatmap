import React, { useMemo, useState } from "react";

import type { Board, Player, Cell } from "@connect4/core";
import { COLS, ROWS, otherPlayer } from "@connect4/core";
import { makeEmptyBoard, applyMove, getCell, isLegalMove } from "@connect4/core";
import { getStatus } from "@connect4/core";

import { chooseMove } from "./lib/api";

function normaliseScores(scores: Array<number | null>) {
  const vals = scores.filter((x): x is number => typeof x === "number");
  if (vals.length === 0) return Array(scores.length).fill(0);

  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;

  return scores.map((s) => {
    if (typeof s !== "number") return 0;
    return (s - min) / span; // 0..1
  });
}

export default function App() {
  const [board, setBoard] = useState<Board>(() => makeEmptyBoard());
  const [currentPlayer, setCurrentPlayer] = useState<Player>(1);
  const [winner, setWinner] = useState<Player | 0>(0);
  const [status, setStatus] = useState<"playing" | "won" | "draw">("playing");

  // AI settings
  const [aiEnabled, setAiEnabled] = useState(true);
  const [aiPlayer, setAiPlayer] = useState<Player>(2);
  const [depth, setDepth] = useState(6);
  const [timeLimitMs, setTimeLimitMs] = useState(250);

  // Heatmap overlay (per-column)
  const [columnScores, setColumnScores] = useState<Array<number | null>>(() =>
    Array(COLS).fill(null)
  );

  const [aiBusy, setAiBusy] = useState(false);
  const [aiInfo, setAiInfo] = useState<{
    nodes: number;
    ms: number;
    usedDepth: number;
    opening: boolean;
  } | null>(null);

  const title = useMemo(() => {
    if (status === "won") return `Player ${winner} wins`;
    if (status === "draw") return "Draw";
    return `Player ${currentPlayer}'s turn`;
  }, [status, winner, currentPlayer]);

  const heat = useMemo(() => normaliseScores(columnScores), [columnScores]);

  function reset() {
    setBoard(makeEmptyBoard());
    setCurrentPlayer(1);
    setWinner(0);
    setStatus("playing");
    setColumnScores(Array(COLS).fill(null));
    setAiInfo(null);
    setAiBusy(false);
  }

  /**
   * Apply game status logic and update state.
   * Returns the next player if still playing, otherwise null.
   */
  function applyAndAdvance(nextBoard: Board, playedBy: Player): Player | null {
    const st = getStatus(nextBoard, playedBy);

    if (st.state === "won") {
      setBoard(nextBoard);
      setWinner(st.winner);
      setStatus("won");
      return null;
    }

    if (st.state === "draw") {
      setBoard(nextBoard);
      setWinner(0);
      setStatus("draw");
      return null;
    }

    const nextPlayer = otherPlayer(playedBy);
    setBoard(nextBoard);
    setCurrentPlayer(nextPlayer);
    setWinner(0);
    setStatus("playing");
    return nextPlayer;
  }

  /**
   * IMPORTANT: AI must use the *board we pass in*, not React state,
   * because React state updates are async and can be stale.
   */
  async function requestAiMove(boardState: Board, forPlayer: Player) {
    if (status !== "playing") return;
    if (aiBusy) return;

    setAiBusy(true);

    try {
      const resp = await chooseMove({
        board: boardState,
        player: forPlayer,
        depth,
        timeLimitMs
      });

      if (!resp.ok) {
        console.error("AI error:", resp.error);
        return;
      }

      setColumnScores(resp.columnScores);
      setAiInfo({
        nodes: resp.nodes,
        ms: resp.ms,
        usedDepth: resp.usedDepth,
        opening: resp.opening
      });

      const col = resp.bestCol;
      if (!isLegalMove(boardState, col)) return;

      const moved = applyMove(boardState, col, forPlayer);
      if (!moved) return;

      applyAndAdvance(moved.board, forPlayer);
    } finally {
      setAiBusy(false);
    }
  }

  async function maybeAutoAi(boardState: Board, nextPlayer: Player | null) {
    if (!aiEnabled) return;
    if (status !== "playing") return;
    if (!nextPlayer) return;
    if (nextPlayer !== aiPlayer) return;

    await requestAiMove(boardState, nextPlayer);
  }

  function onDropHuman(col: number) {
    if (status !== "playing") return;
    if (aiBusy) return;

    // Don’t allow the human to play for the AI side
    if (aiEnabled && currentPlayer === aiPlayer) return;

    const res = applyMove(board, col, currentPlayer);
    if (!res) return;

    // Clear heatmap on human move
    setColumnScores(Array(COLS).fill(null));
    setAiInfo(null);

    const nextBoard = res.board;
    const nextPlayer = applyAndAdvance(nextBoard, currentPlayer);

    // Kick AI using the *fresh* board (not state)
    void maybeAutoAi(nextBoard, nextPlayer);
  }

  const styles: Record<string, React.CSSProperties> = {
    page: {
      minHeight: "100vh",
      display: "grid",
      placeItems: "center",
      background: "#0b1220",
      color: "#e7eefc",
      fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif"
    },
    card: {
      width: "min(560px, 92vw)",
      padding: 20,
      borderRadius: 16,
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.12)",
      boxShadow: "0 8px 30px rgba(0,0,0,0.35)"
    },
    headerRow: {
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 12,
      marginBottom: 14
    },
    title: { margin: 0, fontSize: 18, fontWeight: 700 },
    sub: { margin: "6px 0 0 0", opacity: 0.85, fontSize: 13, lineHeight: 1.25 },
    button: {
      appearance: "none",
      border: "1px solid rgba(255,255,255,0.18)",
      background: "rgba(255,255,255,0.08)",
      color: "#e7eefc",
      borderRadius: 12,
      padding: "10px 12px",
      cursor: "pointer",
      fontWeight: 600
    },
    buttonRow: { display: "flex", gap: 10, flexWrap: "wrap" },
    gridWrap: { position: "relative", marginTop: 14 },
    board: {
      display: "grid",
      gridTemplateColumns: `repeat(${COLS}, 1fr)`,
      gap: 10,
      padding: 14,
      borderRadius: 16,
      background: "rgba(0,0,0,0.25)",
      border: "1px solid rgba(255,255,255,0.10)",
      userSelect: "none"
    },
    cell: {
      width: "100%",
      aspectRatio: "1 / 1",
      borderRadius: 999,
      background: "rgba(255,255,255,0.08)",
      border: "1px solid rgba(255,255,255,0.10)"
    },
    disc1: { background: "#ff4d4d" },
    disc2: { background: "#ffd43b" },

    columnsOverlay: {
      position: "absolute",
      inset: 0,
      display: "grid",
      gridTemplateColumns: `repeat(${COLS}, 1fr)`,
      gap: 10,
      padding: 14,
      borderRadius: 16
    },
    colButton: {
      border: "1px solid rgba(255,255,255,0.0)",
      background: "transparent",
      cursor: "pointer",
      borderRadius: 12
    },

    controls: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 10,
      marginTop: 12
    },
    controlCard: {
      padding: 12,
      borderRadius: 14,
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.10)"
    },
    label: { fontSize: 12, opacity: 0.8, marginBottom: 6 },
    row: { display: "flex", alignItems: "center", gap: 10, justifyContent: "space-between" },
    select: {
      width: "100%",
      borderRadius: 10,
      border: "1px solid rgba(255,255,255,0.14)",
      background: "rgba(0,0,0,0.25)",
      color: "#e7eefc",
      padding: "8px 10px"
    },
    small: { fontSize: 12, opacity: 0.85 }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.headerRow}>
          <div>
            <h1 style={styles.title}>Connect 4</h1>
            <p style={styles.sub}>
              {title}
              {aiInfo ? (
                <>
                  <br />
                  <span style={{ opacity: 0.75 }}>
                    AI: depth {aiInfo.usedDepth} · {aiInfo.ms}ms · {aiInfo.nodes} nodes
                    {aiInfo.opening ? " · opening" : ""}
                  </span>
                </>
              ) : null}
            </p>
          </div>

          <div style={styles.buttonRow}>
            <button style={styles.button} onClick={reset}>
              Reset
            </button>

            <button
              style={{ ...styles.button, opacity: aiBusy ? 0.6 : 1 }}
              disabled={aiBusy || status !== "playing"}
              onClick={async () => {
                // Manual AI move for whoever is currently to play,
                // using the current board state.
                await requestAiMove(board, currentPlayer);
              }}
            >
              {aiBusy ? "Thinking..." : "AI move"}
            </button>

            <button
              style={{ ...styles.button, opacity: aiEnabled ? 1 : 0.7 }}
              onClick={() => setAiEnabled((v) => !v)}
            >
              AI: {aiEnabled ? "On" : "Off"}
            </button>
          </div>
        </div>

        <div style={styles.controls}>
          <div style={styles.controlCard}>
            <div style={styles.label}>AI plays as</div>
            <select
              style={styles.select}
              value={aiPlayer}
              onChange={(e) => setAiPlayer(Number(e.target.value) as Player)}
            >
              <option value={1}>Player 1 (Red)</option>
              <option value={2}>Player 2 (Yellow)</option>
            </select>
            <div style={{ ...styles.small, marginTop: 8 }}>
              Tip: set AI to Player 2 so you go first.
            </div>
          </div>

          <div style={styles.controlCard}>
            <div style={styles.label}>Difficulty</div>
            <div style={styles.row}>
              <span style={styles.small}>Depth</span>
              <select
                style={{ ...styles.select, width: 120 }}
                value={depth}
                onChange={(e) => setDepth(Number(e.target.value))}
              >
                <option value={4}>4</option>
                <option value={5}>5</option>
                <option value={6}>6</option>
                <option value={7}>7</option>
                <option value={8}>8</option>
              </select>
            </div>

            <div style={{ ...styles.row, marginTop: 10 }}>
              <span style={styles.small}>Time</span>
              <select
                style={{ ...styles.select, width: 120 }}
                value={timeLimitMs}
                onChange={(e) => setTimeLimitMs(Number(e.target.value))}
              >
                <option value={100}>100ms</option>
                <option value={250}>250ms</option>
                <option value={500}>500ms</option>
                <option value={1000}>1000ms</option>
              </select>
            </div>
          </div>
        </div>

        <div style={styles.gridWrap}>
          {/* Click overlay for dropping + heatmap */}
          <div style={styles.columnsOverlay}>
            {Array.from({ length: COLS }, (_, c) => {
              const intensity = heat[c]; // 0..1

              const bg = `rgba(80, 190, 255, ${0.06 + intensity * 0.22})`;
              const outline = `rgba(80, 190, 255, ${intensity * 0.55})`;

              return (
                <button
                  key={c}
                  style={{
                    ...styles.colButton,
                    background: columnScores[c] === null ? "transparent" : bg,
                    borderColor: columnScores[c] === null ? "rgba(255,255,255,0.0)" : outline,
                    opacity: status === "playing" && !aiBusy ? 1 : 0.65
                  }}
                  onClick={() => onDropHuman(c)}
                  aria-label={`Drop in column ${c + 1}`}
                  title={
                    columnScores[c] === null
                      ? `Drop in column ${c + 1}`
                      : `Column ${c + 1} score: ${columnScores[c]?.toFixed(0)}`
                  }
                />
              );
            })}
          </div>

          {/* Visual board */}
          <div style={styles.board}>
            {Array.from({ length: ROWS }, (_, r) =>
              Array.from({ length: COLS }, (_, c) => {
                const cell = getCell(board, r, c) as Cell;
                const discStyle =
                  cell === 1 ? styles.disc1 : cell === 2 ? styles.disc2 : undefined;

                return <div key={`${r}-${c}`} style={{ ...styles.cell, ...discStyle }} />;
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
