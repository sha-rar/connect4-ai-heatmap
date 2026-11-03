import type { ChooseMoveRequest, ChooseMoveResult } from "@connect4/core";

/** Message sent to engine.worker.ts. */
export type WorkerRequest = {
  id: number;
  request: ChooseMoveRequest;
};

export type EngineResponse =
  | ({ ok: true; timedOut: boolean } & ChooseMoveResult)
  | { ok: false; error: string };

/** Message sent back by engine.worker.ts. */
export type WorkerResponse = {
  id: number;
  response: EngineResponse;
};
