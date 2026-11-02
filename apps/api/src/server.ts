import express from "express";
import cors from "cors";

import healthRouter from "./routes/health";
import aiRouter from "./routes/ai";

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/", (_req, res) => {
  res.json({ ok: true, service: "connect4-api" });
});

app.use("/health", healthRouter);
app.use("/ai", aiRouter);

const PORT = Number(process.env.PORT ?? 3001);

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
