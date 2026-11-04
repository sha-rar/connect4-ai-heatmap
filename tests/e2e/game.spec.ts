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

async function startAi(page: Page) {
  await page.getByRole("button", { name: "Play vs AI" }).click();
  await expect(status(page)).toHaveText("Your turn");
}

async function startTwoPlayer(page: Page) {
  await page.getByRole("button", { name: "Two players" }).click();
  await expect(status(page)).toHaveText("Red's turn");
}

async function play(page: Page, moves: string) {
  for (const [i, ch] of [...moves].entries()) {
    await column(page, Number(ch)).click();
    await expect(discs(page)).toHaveCount(i + 1);
  }
}

test.describe("start screen", () => {
  test("offers both modes and explains the game and the analysis", async ({ app: page }) => {
    await expect(page.getByRole("heading", { name: "Connect 4" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Play vs AI" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Two players" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "How to play" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "AI analysis" })).toBeVisible();
    await expect(page.getByTestId("board")).toHaveCount(0);
  });

  test("Menu returns to the start screen", async ({ app: page }) => {
    await startAi(page);
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    await expect(page.getByRole("button", { name: "Play vs AI" })).toBeVisible();
  });
});

test.describe("playing the AI", () => {
  test("starts with an empty board and seven playable columns", async ({ app: page }) => {
    await startAi(page);
    await expect(page.locator('[data-testid^="cell-"]')).toHaveCount(42);
    await expect(discs(page)).toHaveCount(0);
    for (let c = 0; c < 7; c++) {
      await expect(column(page, c)).toBeEnabled();
      await expect(column(page, c)).toHaveAccessibleName(`Drop in column ${c + 1}`);
    }
  });

  test("the AI answers and the analysis scores every column", async ({ app: page }) => {
    await startAi(page);
    await column(page, 3).click();
    await expect(discs(page)).toHaveCount(2);
    await expect(status(page)).toHaveText("Your turn");
    await expect(cell(page, 5, 3)).toHaveAttribute("data-player", "1");

    // Heatmap: every column is scored, and exactly one is the AI's move.
    const labels = await page
      .locator('[data-testid^="column-"]')
      .evaluateAll((els) => els.map((el) => el.getAttribute("aria-label") ?? ""));
    expect(labels).toHaveLength(7);
    for (const label of labels) expect(label).toMatch(/score: -?\d+|forced (win|loss)/);
    expect(labels.filter((l) => l.endsWith("(AI's move)"))).toHaveLength(1);

    // Analysis panel: seven ranked columns, the AI's move tagged.
    const analysis = page.getByTestId("analysis");
    await expect(analysis.getByRole("heading")).toHaveText(/How the AI chose column \d/);
    await expect(analysis.locator("li")).toHaveCount(7);
    await expect(analysis.getByText("AI's move", { exact: true })).toHaveCount(1);
    await expect(page.getByTestId("engine-depth")).toContainText("requested");
  });

  test("the AI opens in column 3 when it moves first", async ({ app: page }) => {
    await page.getByRole("group", { name: "You play as" }).getByRole("button", { name: /Yellow/ }).click();
    await page.getByRole("button", { name: "Play vs AI" }).click();
    await expect(cell(page, 5, 3)).toHaveAttribute("data-player", "1");
    await expect(discs(page)).toHaveCount(1);
    await expect(status(page)).toHaveText("Your turn");
    await expect(page.getByTestId("engine-depth")).toContainText("opening book");
    await expect(column(page, 3)).toHaveAccessibleName(/\(AI's move\)$/);
  });

  test("the AI still answers at Expert difficulty", async ({ app: page }) => {
    await page.getByRole("group", { name: "Difficulty" }).getByRole("button", { name: "Expert" }).click();
    await startAi(page);
    await column(page, 3).click();
    await expect(discs(page)).toHaveCount(2);
    await column(page, 2).click();
    await expect(discs(page)).toHaveCount(4, { timeout: 10_000 });
    await expect(page.getByTestId("engine-depth")).toContainText("of 12 requested");
  });

  test("advanced settings switch the difficulty to custom", async ({ app: page }) => {
    await startAi(page);
    await page.getByText("Advanced settings").click();
    await page.getByLabel("Max depth").selectOption("3");
    await expect(page.getByText("Custom: depth 3, 250 ms")).toBeVisible();
    const difficulty = page.getByRole("group", { name: "Difficulty" });
    await expect(difficulty.locator('[aria-pressed="true"]')).toHaveCount(0);
  });

  test("undo takes back the human move and the AI's reply", async ({ app: page }) => {
    await startAi(page);
    await expect(page.getByRole("button", { name: "Undo" })).toBeDisabled();
    await column(page, 3).click();
    await expect(discs(page)).toHaveCount(2);
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(discs(page)).toHaveCount(0);
    await expect(status(page)).toHaveText("Your turn");
    await expect(page.getByRole("button", { name: "Undo" })).toBeDisabled();
  });

  test("a hint analyses the position for the player", async ({ app: page }) => {
    await startAi(page);
    await page.getByRole("button", { name: "Hint: analyse my move" }).click();
    const analysis = page.getByTestId("analysis");
    await expect(analysis.getByRole("heading")).toHaveText("Best moves for you");
    await expect(analysis.locator("li")).toHaveCount(7);
    await expect(analysis.getByText("Suggested", { exact: true })).toBeVisible();
    await expect(discs(page)).toHaveCount(0); // a hint never plays
  });

  test("the standard view hides the heatmap", async ({ app: page }) => {
    await startAi(page);
    await column(page, 3).click();
    await expect(discs(page)).toHaveCount(2);
    await expect(page.getByTestId("heat-strip")).toBeVisible();

    await page.getByRole("group", { name: "Board view" }).getByRole("button", { name: "Standard" }).click();
    await expect(page.getByTestId("heat-strip")).toHaveCount(0);
    await expect(column(page, 0)).toHaveAccessibleName("Drop in column 1");
    // The analysis panel still lists the scores.
    await expect(page.getByTestId("analysis").locator("li")).toHaveCount(7);
  });

  test("New game clears the board and the analysis", async ({ app: page }) => {
    await startAi(page);
    await column(page, 3).click();
    await expect(discs(page)).toHaveCount(2);
    await page.getByRole("button", { name: "New game" }).click();
    await expect(discs(page)).toHaveCount(0);
    await expect(page.getByTestId("analysis").locator("li")).toHaveCount(0);
    await expect(column(page, 3)).toHaveAccessibleName("Drop in column 4");
  });
});

test.describe("two players", () => {
  test("a full column is disabled", async ({ app: page }) => {
    await startTwoPlayer(page);
    await play(page, "000000");
    await expect(column(page, 0)).toBeDisabled();
    await expect(column(page, 0)).toHaveAccessibleName("Column 1 is full");
    await expect(status(page)).toHaveText("Red's turn");
  });

  test("undo takes back one move", async ({ app: page }) => {
    await startTwoPlayer(page);
    await play(page, "334");
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(discs(page)).toHaveCount(2);
    await expect(status(page)).toHaveText("Red's turn");
  });

  // Replay one game per result type from the shared corpus, so the UI's
  // game-over handling follows the same rules as the engines.
  const samples = [
    ...(["horizontal", "vertical", "diagonal", "anti-diagonal"] as const).map(
      (d) => games.find((g) => g.direction === d)!
    ),
    games.find((g) => g.status === "draw")!
  ];

  for (const game of samples) {
    test(`replays ${game.id} (${game.direction ?? "draw"}) to the right result`, async ({ app: page }) => {
      await startTwoPlayer(page);
      await play(page, game.moves);
      const winner = game.winner === 1 ? "Red" : "Yellow";
      await expect(status(page)).toHaveText(game.status === "draw" ? "It's a draw" : `${winner} wins!`);
      await expect(page.getByRole("button", { name: "Play again" })).toBeVisible();

      // The winning discs are highlighted.
      const highlighted = page.locator(".disc.win");
      if (game.status === "won") expect(await highlighted.count()).toBeGreaterThanOrEqual(4);
      else await expect(highlighted).toHaveCount(0);

      // No more discs can be dropped once the game is over.
      const free = game.legal.at(-1)!;
      if (free) {
        await column(page, Number(free[0])).click();
        await expect(discs(page)).toHaveCount(game.moves.length);
      }

      await page.getByRole("button", { name: "Play again" }).click();
      await expect(discs(page)).toHaveCount(0);
    });
  }
});

test.describe("small screens", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("stack the board above the controls without horizontal scrolling", async ({ app: page }) => {
    await startAi(page);
    const board = await page.getByTestId("board").boundingBox();
    const controls = await page.getByRole("region", { name: "Game controls" }).boundingBox();
    expect(board && controls && board.y + board.height <= controls.y).toBe(true);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
