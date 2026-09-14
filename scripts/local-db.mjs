import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import postgres from "postgres";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
config({ path: path.join(root, ".env.local"), quiet: true });
const data = path.join(root, ".data", "postgres");
const bin = path.join(root, ".tools", "pgsql", "bin");
const passwordFile = path.join(root, ".data", "postgres-admin.pass");
const logFile = path.join(root, ".data", "postgres.log");

function run(name, args, allowStopped = false) {
  const result = spawnSync(path.join(bin, `${name}.exe`), args, {
    cwd: root,
    windowsHide: true,
    // pg_ctl launches a long-lived server. Inherited pipe handles on Windows
    // would keep spawnSync waiting even after pg_ctl itself has exited.
    stdio: "ignore",
    timeout: 60000,
  });
  if (result.status !== 0 && !(allowStopped && [3, 4].includes(result.status))) {
    throw new Error(`${name} failed. Check the local PostgreSQL files and .data/postgres.log.`);
  }
  return result.status;
}

async function main() {
  if (process.platform !== "win32")
    throw new Error("Use docker compose for PostgreSQL on this OS.");
  const action = process.argv[2] || "start";
  if (!["start", "stop", "status"].includes(action)) throw new Error("Use start, stop or status.");
  if (!existsSync(path.join(bin, "pg_ctl.exe"))) {
    throw new Error("Extract the official PostgreSQL Windows binaries into .tools/pgsql first.");
  }
  const status = run("pg_ctl", ["status", "-D", data], true);
  if (action === "status") {
    console.log(status === 0 ? "Local PostgreSQL is running." : "Local PostgreSQL is stopped.");
    return;
  }
  if (action === "stop") {
    if (status === 0) run("pg_ctl", ["stop", "-D", data, "-m", "fast", "-t", "30"]);
    console.log("Local PostgreSQL stopped.");
    return;
  }
  const url = new URL(process.env.DATABASE_URL || "");
  if (
    url.hostname !== "127.0.0.1" ||
    url.port !== "55432" ||
    url.username !== "livescope" ||
    url.pathname !== "/livescope"
  ) {
    throw new Error(
      "Local setup requires DATABASE_URL for livescope at 127.0.0.1:55432/livescope.",
    );
  }
  const appPassword = decodeURIComponent(url.password);
  if (appPassword.length < 24) throw new Error("Set a strong local database password first.");
  mkdirSync(path.dirname(data), { recursive: true });
  if (!existsSync(path.join(data, "PG_VERSION"))) {
    if (!existsSync(passwordFile))
      writeFileSync(passwordFile, randomBytes(32).toString("hex"), { mode: 0o600, flag: "wx" });
    run("initdb", [
      "-D",
      data,
      "-U",
      "postgres",
      "--pwfile",
      passwordFile,
      "--auth=scram-sha-256",
      "--encoding=UTF8",
      "--locale=C",
    ]);
  }
  if (status !== 0) {
    run("pg_ctl", ["start", "-D", data, "-l", logFile, "-o", "-h 127.0.0.1 -p 55432", "-t", "30"]);
  }
  const sql = postgres({
    host: "127.0.0.1",
    port: 55432,
    username: "postgres",
    database: "postgres",
    password: readFileSync(passwordFile, "utf8").trim(),
    max: 1,
    connect_timeout: 10,
  });
  try {
    const role = await sql`select 1 from pg_roles where rolname = 'livescope'`;
    if (!role.length) {
      // PostgreSQL DDL cannot parameterize PASSWORD. Escape a string literal explicitly.
      const literal = "'" + appPassword.replaceAll("'", "''") + "'";
      await sql.unsafe(
        `CREATE ROLE livescope LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD ${literal}`,
      );
    }
    const database = await sql`select 1 from pg_database where datname = 'livescope'`;
    if (!database.length) await sql.unsafe("CREATE DATABASE livescope OWNER livescope");
  } finally {
    await sql.end();
  }
  console.log("Local PostgreSQL is ready at 127.0.0.1:55432.");
}

main().catch((error) => {
  // Database exceptions may contain connection parameters; log only our own setup errors.
  console.error(
    error.constructor === Error
      ? error.message
      : "Local database setup failed. Check the database log.",
  );
  process.exitCode = 1;
});
