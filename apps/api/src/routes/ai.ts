import type { Request, Response } from "express";
import { Router } from "express";
import { z } from "zod";

import type { Board, Player } from "@connect4/core";
import { fromMatrix } from "@connect4/core";

import { chooseMove } from "../engine/minimax";

const router = Router();

const BodySchema = z.object({
  // Accept either 1D board (length 42) OR 6x7 matrix
  board: z.union([
    z.array(z.number().int().min(0).max(2)).length(42),
    z.array(z.array(z.number().int().min(0).max(2)).length(7)).length(6)
  ]),
  player: z.union([z.literal(1), z.literal(2)]),
  depth: z.number().int().min(1).max(12).optional(),
  timeLimitMs: z.number().int().min(10).max(2000).optional()
});

router.post("/move", (req: Request, res: Response) => {
  const parsed = BodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      error: parsed.error.flatten()
    });
  }

  const { board, player, depth, timeLimitMs } = parsed.data;

  const flatBoard: Board =
    Array.isArray(board[0]) ? (fromMatrix(board as number[][]) as Board) : (board as Board);

  const result = chooseMove(flatBoard, player as Player, { depth, timeLimitMs });

  return res.json({
    ok: true,
    ...result
  });
});

export default router;
