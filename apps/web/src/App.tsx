import React, { useMemo, useState } from "react";

import type { Board, Player, Cell } from "@connect4/core";
import { COLS, ROWS, otherPlayer } from "@connect4/core";
import { makeEmptyBoard, applyMove, getCell, isLegalMove } from "@connect4/core";
import { getStatus } from "@connect4/core";

import { chooseMove } from "./lib/api";
import type { ColumnHeat } from "./lib/heatmap";
import { classifyColumns, columnBadge, describeColumn } from "./lib/heatmap";

// Overlay colours per column kind; see docs/heatmap.md.
function columnColours(heat: ColumnHeat): { background: string; borderColor: string } {
  switch (heat.kind) {
    case "illegal":
      return {
        background:
          "repeating-linear-gradient(135deg, rgba(0,0,0,0.35) 0 6px, rgba(255,255,255,0.04) 6px 12px)",
        borderColor: "rgba(255,255,255,0.08)"
      };
    case "win":
      return { background: "rgba(64, 200, 120, 0.30)", borderColor: "rgba(64, 200, 120, 0.85)" };
    case "loss":
      return { background: "rgba(255, 90, 90, 0.26)", borderColor: "rgba(255, 90, 90, 0.80)" };
    case "heuristic":
      return {
        background: `rgba(80, 190, 255, ${0.06 + heat.intensity * 0.22})`,
        borderColor: `rgba(80, 190, 255, ${heat.intensity * 0.55})`
      };
    case "unscored":
      return { background: "transparent", borderColor: "rgba(255,255,255,0.0)" };
  }
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

  const heat = useMemo(() => classifyColumns(board, columnScores), [board, columnScores]);

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
      borderRadius: 12,
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "center",
      padding: "4px 0",
      color: "#e7eefc"
    },
    badge: {
      fontSize: 11,
      fontWeight: 700,
      padding: "1px 6px",
      borderRadius: 999,
      background: "rgba(0,0,0,0.55)"
    },
    legend: {
      display: "flex",
      flexWrap: "wrap",
      gap: 12,
      marginTop: 10,
      fontSize: 12,
      opacity: 0.85
    },
    swatch: {
      display: "inline-block",
      width: 10,
      height: 10,
      borderRadius: 3,
      marginRight: 6,
      verticalAlign: "middle"
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
            {heat.map((h, c) => {
              const illegal = h.kind === "illegal";
              const badge = columnBadge(h);
              const description = describeColumn(h, c);

              return (
                <button
                  key={c}
                  style={{
                    ...styles.colButton,
                    ...columnColours(h),
                    cursor: illegal ? "not-allowed" : "pointer",
                    opacity: status === "playing" && !aiBusy ? 1 : 0.65
                  }}
                  disabled={illegal}
                  onClick={() => onDropHuman(c)}
                  aria-label={description}
                  title={description}
                >
                  {badge ? <span style={styles.badge}>{badge}</span> : null}
                </button>
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

        <div style={styles.legend}>
          <span>
            <span style={{ ...styles.swatch, background: "rgba(64, 200, 120, 0.85)" }} />
            W<i>n</i> forced win in <i>n</i>
          </span>
          <span>
            <span style={{ ...styles.swatch, background: "rgba(255, 90, 90, 0.80)" }} />
            L<i>n</i> forced loss in <i>n</i>
          </span>
          <span>
            <span style={{ ...styles.swatch, background: "rgba(80, 190, 255, 0.55)" }} />
            stronger evaluation
          </span>
          <span>
            <span
              style={{
                ...styles.swatch,
                background:
                  "repeating-linear-gradient(135deg, rgba(0,0,0,0.6) 0 3px, rgba(255,255,255,0.25) 3px 6px)"
              }}
            />
            full column
          </span>
        </div>
      </div>
    </div>
  );
}
