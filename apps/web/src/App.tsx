import { useMemo, useState } from "react";

import { COLS, findDropRow } from "@connect4/core";

import { AnalysisPanel } from "./components/Analysis/AnalysisPanel";
import { Board } from "./components/Board/Board";
import { GameControls } from "./components/Controls/GameControls";
import { StartScreen } from "./components/StartScreen/StartScreen";
import { StatusBanner } from "./components/StatusBanner/StatusBanner";
import type { GameMode } from "./features/game/types";
import { useGame } from "./features/game/useGame";
import { classifyColumns } from "./lib/heatmap";

export default function App() {
  const game = useGame();
  const [screen, setScreen] = useState<"start" | "game">("start");
  const { analysis, board, moves, settings } = game;

  // Heatmap columns for the analysed position. The AI's chosen column is
  // marked only when it actually played it.
  const heat = useMemo(
    () =>
      classifyColumns(
        board,
        analysis ? analysis.columnScores : Array(COLS).fill(null),
        analysis?.played ? analysis.bestCol : null
      ),
    [board, analysis]
  );

  // The disc just placed is the top one in its column; it gets the drop animation.
  const lastMove = useMemo(() => {
    if (moves.length === 0) return null;
    const col = moves[moves.length - 1];
    return { row: findDropRow(board, col) + 1, col, key: moves.length };
  }, [board, moves]);

  function start(mode: GameMode) {
    game.newGame(mode);
    setScreen("game");
  }

  if (screen === "start") {
    return (
      <StartScreen
        aiPlayer={settings.aiPlayer}
        difficulty={settings.difficulty}
        onAiPlayerChange={(aiPlayer) => game.updateSettings({ aiPlayer })}
        onDifficultyChange={(difficulty) => game.updateSettings({ difficulty })}
        onPlayAi={() => start("ai")}
        onPlayLocal={() => start("local")}
      />
    );
  }

  const humanCanDrop = !game.over && !game.aiToMove && game.busy !== "play";

  return (
    <div className="app">
      <header className="topbar">
        <button type="button" className="brand" onClick={() => setScreen("start")} aria-label="Back to menu">
          <span className="disc p1" aria-hidden="true" />
          <span className="disc p2" aria-hidden="true" />
          Connect 4
        </button>
        <span className="mode-label">{game.mode === "ai" ? "Playing the AI" : "Two players"}</span>
        <button type="button" className="btn ghost" onClick={() => setScreen("start")}>
          Menu
        </button>
      </header>

      <main className="game-layout">
        <div className="play-area">
          <StatusBanner
            mode={game.mode}
            status={game.status}
            toMove={game.toMove}
            aiPlayer={settings.aiPlayer}
            thinking={game.busy === "play"}
            error={game.error}
            onRetry={game.retry}
            onPlayAgain={() => game.newGame()}
          />
          <Board
            board={board}
            lastMove={lastMove}
            winCells={game.winCells}
            heat={heat}
            showHeat={settings.heatmap}
            previewPlayer={humanCanDrop ? game.toMove : null}
            onDrop={game.drop}
          />
        </div>

        <aside className="side">
          <GameControls
            mode={game.mode}
            onModeChange={game.setMode}
            settings={settings}
            onSettingsChange={game.updateSettings}
            canUndo={game.canUndo}
            onUndo={game.undo}
            onNewGame={() => game.newGame()}
          />
          <AnalysisPanel
            mode={game.mode}
            analysis={analysis}
            heat={heat}
            heatmap={settings.heatmap}
            onHeatmapChange={(heatmap) => game.updateSettings({ heatmap })}
            busy={game.busy}
            canAnalyse={!game.over && !game.busy && !game.aiToMove}
            onAnalyse={game.analyse}
            aiPlayer={settings.aiPlayer}
          />
        </aside>
      </main>
    </div>
  );
}
