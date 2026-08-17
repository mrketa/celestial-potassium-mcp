import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { doctor } from "../src/doctor.js";

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "potassium-doctor-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const assets = path.join(root, "runtime", "assets"); const workspace = path.join(root, "workspace"); const autoexec = path.join(root, "autoexec"); const installRoot = path.join(root, "MCP"); const configPath = path.join(installRoot, "config.json"); const mcpConfigPath = path.join(root, ".omp", "mcp.json"); const serverPath = path.join(installRoot, "app", "node_modules", "@mrketa", "potassium-mcp", "src", "server.js");
  await Promise.all([mkdir(assets, { recursive: true }), mkdir(workspace, { recursive: true }), mkdir(autoexec, { recursive: true }), mkdir(path.dirname(mcpConfigPath), { recursive: true }), mkdir(path.dirname(serverPath), { recursive: true })]);
  await writeFile(path.join(assets, "potassium_mcp_bootstrap.lua"), "bootstrap"); await writeFile(path.join(assets, "potassium_mcp_autoexec.lua"), "autoexec"); await writeFile(path.join(workspace, ".potassium-mcp-bootstrap.lua"), "bootstrap"); await writeFile(path.join(autoexec, "potassium_mcp_autoexec.lua"), "autoexec"); await writeFile(path.join(workspace, ".potassium-mcp-token"), "a".repeat(64)); await writeFile(serverPath, "// server");
  await writeFile(configPath, JSON.stringify({ host: "127.0.0.1", port: 32145, tokenFile: path.join(workspace, ".potassium-mcp-token"), requestTimeoutMs: 15000, maxMessageBytes: 1048576, maxPendingRequests: 64, shutdownGraceMs: 5000, artifactRoots: [{ name: "artifacts", path: path.join(workspace, "potassium-mcp-artifacts"), recursive: true, extensions: [".json"] }], httpAllowedHosts: [] })); await writeFile(mcpConfigPath, JSON.stringify({ mcpServers: { potassium: { type: "stdio", command: "node", args: [serverPath, "--config", configPath], timeout: 30000 } } }));
  return { assets, workspace, autoexec, installRoot, configPath, mcpConfigPath, serverPath };
}
test("doctor reports a missing workspace", async (t) => { const value = await fixture(t); await rm(value.workspace, { recursive: true }); const result = await doctor({ ...value, workspaceRoot: value.workspace, packageRoot: path.dirname(value.assets) }); assert.equal(result.checks.find(({ name }) => name === "workspace").ok, false); });
test("doctor verifies stable launcher paths and config arguments", async (t) => { const value = await fixture(t); const result = await doctor({ ...value, workspaceRoot: value.workspace, packageRoot: path.dirname(value.assets) }); assert.equal(result.ok, true); });
test("doctor reports changed deployed script", async (t) => { const value = await fixture(t); await writeFile(path.join(value.autoexec, "potassium_mcp_autoexec.lua"), "changed"); const result = await doctor({ ...value, workspaceRoot: value.workspace, packageRoot: path.dirname(value.assets) }); assert.equal(result.checks.find(({ name }) => name === "script-parity").ok, false); });
