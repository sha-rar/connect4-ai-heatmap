import type { Analysis, GameMode } from "../../features/game/types";
import { PLAYER_NAMES } from "../../features/game/types";
import type { ColumnHeat } from "../../lib/heatmap";
import { explainColumn, rankColumns, verdictLabel } from "../../lib/heatmap";
import { EvalBar } from "../EvalBar/EvalBar";

type Props = {
  mode: GameMode;
  analysis: Analysis | null;
  heat: ColumnHeat[];
  heatmap: boolean;
  onHeatmapChange: (on: boolean) => void;
  busy: "play" | "analyse" | null;
  canAnalyse: boolean;
  onAnalyse: () => void;
  aiPlayer: number;
};

function summary(analysis: Analysis, heat: ColumnHeat[], ranked: number[], who: string): string {
  const best = heat[ranked[0]];
  if (!best) return "";
  if (best.kind === "win") return `${who} can force a win in ${best.movesToMate} with column ${ranked[0] + 1}.`;
  if (best.kind === "loss") return `Every move loses against perfect play; column ${ranked[0] + 1} holds out longest.`;
  if (analysis.played && analysis.ply === 0 && ranked[0] !== analysis.bestCol) {
    return `The AI opened in the centre, the known best first move. The opening book's depth-limited scores rate column ${ranked[0] + 1} slightly higher.`;
  }
  if (analysis.opening) return "Opening position: scores come from the precomputed opening book.";
  return `No forced result within ${analysis.usedDepth} moves, so columns are compared by the evaluation.`;
}

export function AnalysisPanel(props: Props) {
  const { mode, analysis, heat, heatmap, onHeatmapChange, busy, canAnalyse, onAnalyse, aiPlayer } = props;
  const ranked = analysis ? rankColumns(heat) : [];

  let title = "AI analysis";
  let who = "";
  if (analysis) {
    const colour = PLAYER_NAMES[analysis.forPlayer];
    const isAi = mode === "ai" && analysis.forPlayer === aiPlayer;
    who = mode === "ai" ? (isAi ? "The AI" : "You") : colour;
    title = analysis.played ? `How the AI chose column ${analysis.bestCol + 1}` : `Best moves for ${isAi ? "the AI" : mode === "ai" ? "you" : colour}`;
  }

  return (
    <section className="panel analysis" aria-labelledby="analysis-title" data-testid="analysis">
      <div className="panel-head">
        <h2 id="analysis-title">{title}</h2>
        <div className="segmented small" role="group" aria-label="Board view">
          <button type="button" aria-pressed={!heatmap} onClick={() => onHeatmapChange(false)}>
            Standard
          </button>
          <button type="button" aria-pressed={heatmap} onClick={() => onHeatmapChange(true)}>
            Heatmap
          </button>
        </div>
      </div>

      {analysis ? (
        <>
          <p className="panel-summary">
            Scores for <span className={`chip p${analysis.forPlayer}`}>{PLAYER_NAMES[analysis.forPlayer]}</span>{" "}
            {summary(analysis, heat, ranked, who)}
          </p>
          <ol className="move-list">
            {ranked.map((col, i) => {
              const h = heat[col];
              return (
                <li key={col} className={`move-row kind-${h.kind}`} data-testid={`analysis-col-${col}`}>
                  <span className="move-rank">{i + 1}</span>
                  <div className="move-main">
                    <div className="move-line">
                      <span className="move-col">Column {col + 1}</span>
                      {h.chosen ? <span className="tag">AI's move</span> : null}
                      {!analysis.played && i === 0 ? <span className="tag">Suggested</span> : null}
                      <span className="move-verdict">{verdictLabel(h)}</span>
                    </div>
                    <EvalBar heat={h} />
                    {i === 0 || h.kind !== "heuristic" ? (
                      <p className="move-explain">{explainColumn(h, i === 0)}</p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
          <details className="engine-details">
            <summary>Engine statistics</summary>
            <dl>
              <dt>Search depth</dt>
              <dd data-testid="engine-depth">
                {analysis.opening ? `${analysis.usedDepth} (opening book)` : analysis.usedDepth} of {analysis.requestedDepth} requested
              </dd>
              <dt>Time</dt>
              <dd>
                {analysis.ms} ms of {analysis.timeLimitMs} ms{analysis.timedOut ? " (limit reached)" : ""}
              </dd>
              <dt>Positions searched</dt>
              <dd>{analysis.nodes.toLocaleString()}</dd>
              <dt>Engine</dt>
              <dd>C++ (WebAssembly), minimax with alpha–beta</dd>
            </dl>
          </details>
        </>
      ) : (
        <p className="panel-empty">
          {busy
            ? "The engine is thinking…"
            : mode === "ai"
              ? "After the AI moves, its score for every column appears here. Ask for a hint to see the best moves for you."
              : "Ask the engine to score every column for the player to move."}
        </p>
      )}

      <button type="button" className="btn secondary wide" onClick={onAnalyse} disabled={!canAnalyse}>
        {busy === "analyse" ? "Analysing…" : mode === "ai" ? "Hint: analyse my move" : "Analyse position"}
      </button>
      <p className="panel-note">
        Win in <i>n</i> and Loss in <i>n</i> count moves by the side that wins. Other scores compare positions:
        higher is better for the side shown.
      </p>
    </section>
  );
}
