import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { createAgentServer } from "../src/lib/agent-server";
import { getSnapshot } from "../src/lib/snapshot";
import { getSql } from "../src/lib/database";

// Explicit host environment wins; dotenv must never print on MCP stdout.
config({ path: fileURLToPath(new URL("../.env.local", import.meta.url)), quiet: true });
const server = createAgentServer(getSnapshot);
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  await server.close();
  if (process.env.DATABASE_URL) await getSql().end({ timeout: 2 });
}
process.stdin.on("end", () => {
  void close();
});
process.on("SIGINT", () => {
  void close();
});
process.on("SIGTERM", () => {
  void close();
});
server.connect(new StdioServerTransport()).catch(() => {
  console.error("LiveScope MCP 서버를 시작하지 못했습니다.");
  process.exitCode = 1;
  void close();
});
