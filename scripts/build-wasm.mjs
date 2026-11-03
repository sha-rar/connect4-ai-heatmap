// Builds the C++ engine to WebAssembly and copies the output into the web app.
//
// Requires an activated Emscripten SDK (emcc and emcmake on PATH, e.g. after
// running emsdk_env). Usage: pnpm build:wasm

import { copyFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = join(root, "engine", "build", "wasm");
const outDir = join(root, "apps", "web", "src", "engine", "generated");
const isWindows = process.platform === "win32";

function run(cmd, args) {
  console.log(`> ${cmd} ${args.join(" ")}`);
  const result = spawnSync(cmd, args, { cwd: root, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const probe = spawnSync("emcc", ["--version"], { encoding: "utf8" });
if (probe.status !== 0) {
  console.error("emcc not found. Install the Emscripten SDK and activate it (emsdk_env) first.");
  process.exit(1);
}
console.log(probe.stdout.split("\n")[0]);

// emcmake cannot use the Visual Studio generators; default to Makefiles.
const generator = process.env.CMAKE_GENERATOR ?? (isWindows ? "MinGW Makefiles" : "Unix Makefiles");

run("emcmake", ["cmake", "-S", "engine", "-B", buildDir, "-G", generator, "-DCMAKE_BUILD_TYPE=Release"]);
run("cmake", ["--build", buildDir]);

mkdirSync(outDir, { recursive: true });
for (const file of ["connect4.js", "connect4.wasm"]) {
  copyFileSync(join(buildDir, file), join(outDir, file));
  console.log(`copied ${file} -> ${outDir}`);
}
