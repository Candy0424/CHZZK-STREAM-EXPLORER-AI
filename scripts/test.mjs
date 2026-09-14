import { cp, mkdtemp, rm, symlink } from "node:fs/promises";
import { resolve, join, sep } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
let testRoot = root;
let temporary;
// Vite interprets # in Windows paths as a URL fragment. Test the exact source
// in an isolated temporary directory; leave the user's checkout unchanged.
if (root.includes("#")) {
  temporary = await mkdtemp(join(tmpdir(), "livescope-tests-"));
  testRoot = temporary;
  for (const path of [
    "src",
    "tests",
    "drizzle",
    "vitest.config.mts",
    "tsconfig.json",
    "package.json",
  ]) {
    await cp(join(root, path), join(testRoot, path), { recursive: true });
  }
  await symlink(
    join(root, "node_modules"),
    join(testRoot, "node_modules"),
    process.platform === "win32" ? "junction" : "dir",
  );
  console.log("Testing an identical temporary source snapshot (Windows # path compatibility).");
}
try {
  const child = spawn(
    process.execPath,
    [
      "--preserve-symlinks",
      "--preserve-symlinks-main",
      join(testRoot, "node_modules/vitest/vitest.mjs"),
      "run",
      ...process.argv.slice(2),
    ],
    {
      cwd: testRoot,
      stdio: "inherit",
      env: process.env,
    },
  );
  process.exitCode = await new Promise((resolveExit, reject) => {
    child.on("error", reject);
    child.on("exit", (code) => resolveExit(code ?? 1));
  });
} finally {
  if (temporary) {
    const resolved = resolve(temporary);
    const allowedParent = resolve(tmpdir()) + sep;
    if (
      !resolved.startsWith(allowedParent) ||
      !resolved.slice(allowedParent.length).startsWith("livescope-tests-")
    )
      throw new Error("Unexpected test cleanup path");
    await rm(resolved, { recursive: true, force: true });
  }
}
