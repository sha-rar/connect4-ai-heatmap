import type { Page } from "@playwright/test";
import { expect, test as base } from "@playwright/test";

import { loadGames } from "../fixtures/load";

const games = loadGames();

// Every test opens the app and fails if the page or the engine worker logs a
// console error or throws.
const test = base.extend<{ app: Page }>({
  app: async ({ page }, use) => {
    const errors: string[] = [];
    const onConsole = (msg: { type(): string; text(): string }) => {
      if (msg.type() === "error") errors.push(msg.text());
    };
    page.on("console", onConsole);
    page.on("pageerror", (err) => errors.push(err.message));
    page.on("worker", (worker) => worker.on("console", onConsole));
    await page.goto("/");
    await use(page);
    expect(errors).toEqual([]);
  }
});

const status = (page: Page) => page.getByTestId("status");
const column = (page: Page, col: number) => page.getByTestId(`column-${col}`);
const cell = (page: Page, row: number, col: number) => page.getByTestId(`cell-${row}-${col}`);
const discs = (page: Page) => page.locator('[data-testid^="cell-"]:not([data-player="0"])');

async function turnAiOff(page: Page) {
  await page.getByRole("button", { name: "AI: On" }).click();
  await expect(page.getByRole("button", { name: "AI: Off" })).toBeVisible();
}

async function play(page: Page, moves: string) {
  for (const [i, ch] of [...moves].entries()) {
    await column(page, Number(ch)).click();
    await expect(discs(page)).toHaveCount(i + 1);
  }
}

test("starts with an empty board and seven playable columns", async ({ app: page }) => {
  await expect(status(page)).toHaveText("Player 1's turn");
  await expect(page.locator('[data-testid^="cell-"]')).toHaveCount(42);
  await expect(discs(page)).toHaveCount(0);
  for (let c = 0; c < 7; c++) {
    await expect(column(page, c)).toBeEnabled();
    await expect(column(page, c)).toHaveAccessibleName(`Drop in column ${c + 1}`);
  }
});

test("the AI answers a human move and fills the heatmap", async ({ app: page }) => {
  await column(page, 3).click();
  await expect(discs(page)).toHaveCount(2);
  await expect(status(page)).toHaveText("Player 1's turn");
  await expect(cell(page, 5, 3)).toHaveAttribute("data-player", "1");
  await expect(page.getByTestId("engine-info")).toContainText("C++ engine");

  // Every column is scored, and exactly one is marked as the AI's move.
  const labels = await page.locator('[data-testid^="column-"]').evaluateAll((els) =>
    els.map((el) => el.getAttribute("aria-label") ?? "")
  );
  expect(labels).toHaveLength(7);
  for (const label of labels) expect(label).toMatch(/score: -?\d+|forced (win|loss)/);
  expect(labels.filter((l) => l.endsWith("(AI's move)"))).toHaveLength(1);
});

test("the AI opens in column 3 when it moves first", async ({ app: page }) => {
  await page.getByLabel("AI plays as").selectOption("1");
  await page.getByRole("button", { name: "AI move" }).click();
  await expect(cell(page, 5, 3)).toHaveAttribute("data-player", "1");
  await expect(discs(page)).toHaveCount(1);
  await expect(page.getByTestId("engine-info")).toContainText("opening book");
  await expect(column(page, 3)).toHaveAccessibleName(/\(AI's move\)$/);
});

test("the AI still answers at the deepest setting", async ({ app: page }) => {
  await page.getByLabel("Max depth").selectOption("12");
  await page.getByLabel("Time limit").selectOption("1000");
  await column(page, 3).click();
  await expect(discs(page)).toHaveCount(2);
  await column(page, 2).click();
  await expect(discs(page)).toHaveCount(4, { timeout: 10_000 });
  await expect(page.getByTestId("engine-info")).toContainText(/depth \d+/);
});

test("a full column is disabled", async ({ app: page }) => {
  await turnAiOff(page);
  await play(page, "000000");
  await expect(column(page, 0)).toBeDisabled();
  await expect(column(page, 0)).toHaveAccessibleName("Column 1 is full");
  await expect(status(page)).toHaveText("Player 1's turn");
});

test("reset clears the board, heatmap and engine info", async ({ app: page }) => {
  await column(page, 3).click();
  await expect(discs(page)).toHaveCount(2);
  await page.getByRole("button", { name: "Reset" }).click();
  await expect(discs(page)).toHaveCount(0);
  await expect(page.getByTestId("engine-info")).toHaveCount(0);
  await expect(column(page, 3)).toHaveAccessibleName("Drop in column 4");
});

// Replay one game per result type from the shared corpus in human-vs-human
// mode, so the UI's game-over handling follows the same rules as the engines.
const samples = [
  ...(["horizontal", "vertical", "diagonal", "anti-diagonal"] as const).map(
    (d) => games.find((g) => g.direction === d)!
  ),
  games.find((g) => g.status === "draw")!
];

for (const game of samples) {
  test(`replays ${game.id} (${game.direction ?? "draw"}) to the right result`, async ({ app: page }) => {
    await turnAiOff(page);
    await play(page, game.moves);
    await expect(status(page)).toHaveText(game.status === "draw" ? "Draw" : `Player ${game.winner} wins`);

    // No more discs can be dropped once the game is over.
    const free = game.legal.at(-1)!;
    if (free) {
      await column(page, Number(free[0])).click();
      await expect(discs(page)).toHaveCount(game.moves.length);
    }
  });
}
