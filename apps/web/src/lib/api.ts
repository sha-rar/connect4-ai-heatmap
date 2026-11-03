import type { ChooseMoveRequest, ChooseMoveResult } from "@connect4/core";

export type { ChooseMoveRequest };

export type ChooseMoveResponse =
  | ({ ok: true } & ChooseMoveResult)
  | { ok: false; error: unknown };

export async function chooseMove(req: ChooseMoveRequest): Promise<ChooseMoveResponse> {
  const res = await fetch("/api/ai/move", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req)
  });

  return res.json();
}
