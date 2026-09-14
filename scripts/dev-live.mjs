import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
config({ path: path.join(root, ".env.local"), quiet: true, override: true });
process.env.DEMO_MODE = "false";
const children = new Set();
let stopping = false;

function launch(args, output = "inherit") {
  const child = spawn(process.execPath, args, {
    cwd: root,
    env: process.env,
    stdio: output,
    windowsHide: true,
  });
  children.add(child);
  child.once("exit", () => children.delete(child));
  return child;
}

function run(args) {
  return new Promise((resolve, reject) => {
    const child = launch(args);
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0 ? resolve() : reject(new Error("Startup step failed.")),
    );
  });
}

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.pid) continue;
    if (process.platform === "win32") {
      spawnSync("taskkill.exe", ["/pid", String(child.pid), "/t", "/f"], {
        stdio: "ignore",
        windowsHide: true,
      });
    } else child.kill("SIGTERM");
  }
  process.exitCode = code;
}

async function main() {
  if (
    !process.env.CHZZK_CLIENT_ID ||
    !process.env.CHZZK_CLIENT_SECRET ||
    !process.env.DATABASE_URL ||
    !process.env.CRON_SECRET
  ) {
    throw new Error("Configure the API keys, DATABASE_URL and CRON_SECRET in .env.local first.");
  }
  const url = new URL(process.env.DATABASE_URL);
  const port = process.env.PORT || "3001";
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535)
    throw new Error("Invalid PORT.");
  if (process.platform === "win32" && url.hostname === "127.0.0.1" && url.port === "55432") {
    await run(["scripts/local-db.mjs", "start"]);
  }
  await run(["--import", "tsx", "scripts/migrate.ts"]);
  const worker = launch(["--import", "tsx", "scripts/sync-worker.ts"]);
  const web = launch([
    require.resolve("next/dist/bin/next"),
    "dev",
    "--hostname",
    "127.0.0.1",
    "--port",
    port,
  ]);
  for (const child of [worker, web]) {
    child.once("error", () => stop(1));
    child.once("exit", (code) => {
      if (!stopping) stop(code || 1);
    });
  }
  console.log(
    `LiveScope real data mode: http://127.0.0.1:${port} (sync every 5 minutes by default).`,
  );
}

process.once("SIGINT", () => stop());
process.once("SIGTERM", () => stop());
main().catch((error) => {
  console.error(error.message);
  stop(1);
});
