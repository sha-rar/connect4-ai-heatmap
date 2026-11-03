// Runs the C++ engine (compiled to WebAssembly) off the main thread so long
// searches never block rendering or animations.

import createConnect4Module from "./generated/connect4.js";
import type { WorkerRequest, WorkerResponse } from "./protocol";
import { createWasmEngine } from "./wasmEngine";

// Minimal view of the worker global; the app's tsconfig uses DOM types.
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage(message: WorkerResponse): void;
};

const enginePromise = createConnect4Module().then(createWasmEngine);

scope.onmessage = async (event) => {
  const { id, request } = event.data;
  try {
    const engine = await enginePromise;
    const result = engine.chooseMove(request.board, request.player, {
      depth: request.depth,
      timeLimitMs: request.timeLimitMs
    });
    scope.postMessage({ id, response: { ok: true, ...result } });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    scope.postMessage({ id, response: { ok: false, error: message } });
  }
};
