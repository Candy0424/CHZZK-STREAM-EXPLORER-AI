import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport, getDefaultEnvironment } from "@modelcontextprotocol/client/stdio";

async function main() {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const client = new Client({ name: "livescope-verification", version: "1.0.0" });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [
      fileURLToPath(new URL("../node_modules/tsx/dist/cli.mjs", import.meta.url)),
      fileURLToPath(new URL("agent-server.ts", import.meta.url)),
    ],
    cwd: root,
    env: {
      ...getDefaultEnvironment(),
      ...(process.env.DEMO_MODE ? { DEMO_MODE: process.env.DEMO_MODE } : {}),
    },
    stderr: "inherit",
  });
  try {
    await client.connect(transport);
    const listed = await client.listTools();
    assert.equal(listed.tools.length, 3);
    const stats = await client.callTool({ name: "get_catalog_stats", arguments: {} });
    assert.ok(!stats.isError);
    const search = await client.callTool({ name: "search_streamers", arguments: { pageSize: 3 } });
    assert.ok(!search.isError);
    const items = (search.structuredContent as { items: { channelId: string }[] }).items;
    assert.ok(items.length > 0, "수집된 온라인 방송이 필요합니다.");
    const channel = await client.callTool({
      name: "get_channel_status",
      arguments: { channelId: items[0].channelId },
    });
    assert.ok(!channel.isError);
    assert.equal((channel.structuredContent as { found: boolean }).found, true);
    const invalid = await client.callTool({
      name: "search_streamers",
      arguments: { pageSize: 10000 },
    });
    assert.equal(invalid.isError, true);
    console.log(
      JSON.stringify(
        {
          checkedAt: new Date().toISOString(),
          tools: listed.tools.map((tool) => tool.name),
          stats: stats.structuredContent,
          search: search.structuredContent,
          channel: channel.structuredContent,
          invalidInputRejected: true,
        },
        null,
        2,
      ),
    );
  } finally {
    await client.close();
  }
}
main().catch(() => {
  console.error("MCP 검증 실패: DB·환경 설정 및 도구 응답을 확인하세요.");
  process.exitCode = 1;
});
