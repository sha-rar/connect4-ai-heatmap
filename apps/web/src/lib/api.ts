import type { Board, Player } from "@connect4/core";

export type ChooseMoveRequest = {
  board: Board;
  player: Player;
  depth?: number;
  timeLimitMs?: number;
};

export type ChooseMoveResponse =
  | { ok: true; bestCol: number; bestScore: number; columnScores: Array<number | null>; nodes: number; ms: number; usedDepth: number; opening: boolean }
  | { ok: false; error: unknown };

export async function chooseMove(req: ChooseMoveRequest): Promise<ChooseMoveResponse> {
  const res = await fetch("/api/ai/move", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req)
  });

  return res.json();
}
