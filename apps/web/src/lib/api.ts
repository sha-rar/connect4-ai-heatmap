import type { ChooseMoveRequest } from "@connect4/core";

import type { EngineResponse, WorkerRequest, WorkerResponse } from "../engine/protocol";

export type { ChooseMoveRequest };

export type ChooseMoveResponse = EngineResponse;

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, (response: ChooseMoveResponse) => void>();

function failAll(error: string) {
  for (const resolve of pending.values()) resolve({ ok: false, error });
  pending.clear();
}

/** The engine worker, created on first use and recreated if it crashes. */
function getWorker(): Worker {
  if (worker) return worker;

  const w = new Worker(new URL("../engine/engine.worker.ts", import.meta.url), { type: "module" });
  w.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const { id, response } = event.data;
    pending.get(id)?.(response);
    pending.delete(id);
  };
  w.onerror = (event) => {
    event.preventDefault();
    failAll(event.message || "engine worker failed to load");
    w.terminate();
    worker = null;
  };
  worker = w;
  return w;
}

/**
 * Ask the C++ engine (WebAssembly, in a Web Worker) for a move.
 * Never rejects: failures resolve as `{ ok: false, error }`.
 */
export function chooseMove(req: ChooseMoveRequest): Promise<ChooseMoveResponse> {
  return new Promise((resolve) => {
    const id = nextId++;
    pending.set(id, resolve);
    const message: WorkerRequest = { id, request: req };
    try {
      getWorker().postMessage(message);
    } catch (error) {
      pending.delete(id);
      resolve({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  });
}
