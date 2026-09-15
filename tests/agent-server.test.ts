import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport, type McpServer } from "@modelcontextprotocol/server";
import { createAgentServer } from "../src/lib/agent-server";
import { demoSnapshot } from "../src/lib/demo-data";
import type { Snapshot } from "../src/types/streamer";

describe("MCP tool protocol", () => {
  let client: Client;
  let server: McpServer;
  let snapshot: Snapshot;
  const load = vi.fn<() => Promise<Snapshot>>();
  const now = Date.parse("2026-09-15T00:00:00Z");
  beforeEach(async () => {
    snapshot = demoSnapshot(now);
    load.mockReset().mockImplementation(async () => snapshot);
    server = createAgentServer(load, () => now);
    client = new Client({ name: "test", version: "1" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
  });
  afterEach(async () => {
    await client.close();
    await server.close();
  });

  it("advertises exactly three read-only tools and input schemas", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name)).toEqual([
      "search_streamers",
      "get_channel_status",
      "get_catalog_stats",
    ]);
    expect(
      tools.every((tool) => tool.annotations?.readOnlyHint && tool.inputSchema.type === "object"),
    ).toBe(true);
  });
  it("dispatches search with filters and marks sample data", async () => {
    const response = await client.callTool({
      name: "search_streamers",
      arguments: { query: "모카" },
    });
    expect(response.structuredContent).toMatchObject({
      mode: "demo",
      total: 1,
      items: [{ channelName: "모카플레이", status: "ONLINE", url: null }],
    });
  });
  it("looks up a selected real channel and only links online results", async () => {
    snapshot.mode = "live";
    const online = snapshot.streamers.find((item) => item.status === "ONLINE")!;
    const response = await client.callTool({
      name: "get_channel_status",
      arguments: { channelId: online.channelId.toUpperCase() },
    });
    expect(response.structuredContent).toMatchObject({
      found: true,
      channel: { channelId: online.channelId, url: `https://chzzk.naver.com/${online.channelId}` },
    });
    const offline = snapshot.streamers.find((item) => item.status === "OFFLINE")!;
    const off = await client.callTool({
      name: "get_channel_status",
      arguments: { channelId: offline.channelId },
    });
    expect(off.structuredContent).toMatchObject({ channel: { status: "OFFLINE", url: null } });
  });
  it("does not misreport unregistered channels as offline", async () => {
    const response = await client.callTool({
      name: "get_channel_status",
      arguments: { channelId: "f".repeat(32) },
    });
    expect(response.structuredContent).toMatchObject({ found: false, channel: null });
  });
  it("carries failed-sync freshness through the protocol", async () => {
    snapshot.lastAttemptFailed = true;
    const response = await client.callTool({ name: "get_catalog_stats", arguments: {} });
    expect(response.structuredContent).toMatchObject({
      freshness: "stale",
      counts: { online: 8, offline: 8, delayed: 16 },
    });
  });
  it("rejects oversized and unexpected arguments before DB access", async () => {
    for (const args of [{ pageSize: 21 }, { sql: "DROP TABLE channels" }]) {
      expect((await client.callTool({ name: "search_streamers", arguments: args })).isError).toBe(
        true,
      );
    }
    expect(load).not.toHaveBeenCalled();
  });
  it("rejects unknown tools and malformed channel IDs", async () => {
    await expect(client.callTool({ name: "delete_channel", arguments: {} })).rejects.toThrow();
    expect(
      (await client.callTool({ name: "get_channel_status", arguments: { channelId: "../secret" } }))
        .isError,
    ).toBe(true);
    expect(load).not.toHaveBeenCalled();
  });
  it("returns safe errors without connection secrets or fake data", async () => {
    load.mockRejectedValue(new Error("postgresql://secret:password@database/private"));
    const response = await client.callTool({ name: "get_catalog_stats", arguments: {} });
    expect(response.isError).toBe(true);
    expect(JSON.stringify(response)).not.toMatch(/password|postgresql|private/);
    expect(response.structuredContent).toBeUndefined();
  });
});
