import test from "node:test";
import assert from "node:assert/strict";
import { access, cp, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { install, repair, uninstall } from "../src/install.js";

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "potassium-install-")); t.after(() => rm(root, { recursive: true, force: true }));
  const installRoot = path.join(root, "MCP"); const workspaceRoot = path.join(root, "workspace"); const mcpConfigPath = path.join(root, ".omp", "mcp.json"); await Promise.all([mkdir(workspaceRoot, { recursive: true }), mkdir(path.dirname(mcpConfigPath), { recursive: true })]); await writeFile(mcpConfigPath, JSON.stringify({ mcpServers: { existing: { command: "keep" } }, preserved: true }));
  const installPackage = async ({ stage }) => { const runtime = path.join(stage, "node_modules", "@mrketa", "potassium-mcp"); await mkdir(path.join(runtime, "src"), { recursive: true }); await cp(path.resolve("assets"), path.join(runtime, "assets"), { recursive: true }); await writeFile(path.join(runtime, "src", "server.js"), "// fixture server\n"); };
  return { root, installRoot, workspaceRoot, mcpConfigPath, installPackage, run: () => ({ status: 0 }), compileProbe: () => {} };
}
test("install refuses a missing workspace without creating it", async (t) => { const value = await fixture(t); await rm(value.workspaceRoot, { recursive: true }); await assert.rejects(install(value), /workspace does not exist/); });
test("install rejects overlapping managed paths before mutation", async (t) => {
  const value = await fixture(t);
  await assert.rejects(install({ ...value, installRoot: value.workspaceRoot }), /must not overlap/);
  await assert.rejects(install({ ...value, mcpConfigPath: path.join(value.installRoot, "mcp.json") }), /must be outside/);
});
test("fresh install and repair preserve unrelated MCP configuration and stable launcher arguments", async (t) => { const value = await fixture(t); const first = await install(value); const config = JSON.parse(await readFile(value.mcpConfigPath, "utf8")); assert.deepEqual(config.mcpServers.existing, { command: "keep" }); assert.deepEqual(config.mcpServers.potassium.args.slice(1), ["--config", path.join(value.installRoot, "config.json")]); assert.equal(first.doctor.ok, true); const second = await repair(value); assert.equal(second.doctor.ok, true); });
test("uninstall preserves token, artifacts, and unrelated MCP servers", async (t) => { const value = await fixture(t); await install(value); const token = path.join(value.workspaceRoot, ".potassium-mcp-token"); const artifact = path.join(value.workspaceRoot, "potassium-mcp-artifacts", "keep.txt"); await mkdir(path.dirname(artifact), { recursive: true }); await writeFile(artifact, "keep"); await uninstall(value); const config = JSON.parse(await readFile(value.mcpConfigPath, "utf8")); assert.deepEqual(config.mcpServers, { existing: { command: "keep" } }); assert.equal(await readFile(token, "utf8"), await readFile(token, "utf8")); assert.equal(await readFile(artifact, "utf8"), "keep"); });
test("uninstall removes an installer-created MCP config but preserves token and artifacts", async (t) => {
  const value = await fixture(t);
  await rm(value.mcpConfigPath);
  await install(value);
  const tokenPath = path.join(value.workspaceRoot, ".potassium-mcp-token");
  await access(path.join(value.workspaceRoot, "potassium-mcp-artifacts"));

  await repair(value);
  await uninstall(value);
  await assert.rejects(readFile(value.mcpConfigPath, "utf8"), { code: "ENOENT" });
  assert.ok((await readFile(tokenPath, "utf8")).trim().length >= 32);
});
test("fresh install refuses unmanaged fixed resources and package option injection", async (t) => {
  const tokenCollision = await fixture(t);
  await writeFile(path.join(tokenCollision.workspaceRoot, ".potassium-mcp-token"), "a".repeat(64));
  await assert.rejects(install(tokenCollision), /without proven ownership/);

  const launcherCollision = await fixture(t);
  await writeFile(launcherCollision.mcpConfigPath, JSON.stringify({
    mcpServers: { potassium: { command: "unmanaged" } },
  }));
  await assert.rejects(install(launcherCollision), /launcher already exist/);

  const sourceInjection = await fixture(t);
  await assert.rejects(install({ ...sourceInjection, packageSource: "--prefix=C:\\victim" }), /must not begin/);
});

test("install preserves MCP config ACL and ignores post-commit cleanup failures", async (t) => {
  const value = await fixture(t);
  const copied = [];
  const result = await install({
    ...value,
    copyAcl: async (operation) => copied.push(operation),
    remove: async () => { throw new Error("cleanup locked"); },
  });
  assert.equal(result.doctor.ok, true);
  assert.equal(copied.length, 1);
  assert.match(copied[0].source, /\.backup$/);
  assert.match(copied[0].target, /\.tmp$/);
});

test("install compare-and-swap preserves a concurrent MCP config update", async (t) => {
  const value = await fixture(t);
  const concurrent = JSON.stringify({ mcpServers: { concurrent: { command: "keep-new" } } });
  await assert.rejects(install({
    ...value,
    beforeMcpCommit: async ({ operation }) => {
      if (operation === "install") await writeFile(value.mcpConfigPath, concurrent);
    },
  }), /changed during installation/);
  assert.equal(await readFile(value.mcpConfigPath, "utf8"), concurrent);
});

test("operation lock and strict ownership state prevent concurrent or redirected deletion", async (t) => {
  const locked = await fixture(t);
  await writeFile(`${locked.installRoot}.lock`, "held");
  await assert.rejects(install(locked), /another Potassium MCP operation/);

  const value = await fixture(t);
  await install(value);
  const statePath = path.join(value.installRoot, "ownership.json");
  const state = JSON.parse(await readFile(statePath, "utf8"));
  const victim = path.join(value.root, "victim.txt");
  await writeFile(victim, "keep");
  state.scripts[0].target = victim;
  await writeFile(statePath, JSON.stringify(state));
  await assert.rejects(uninstall(value), /ownership is ambiguous/);
  assert.equal(await readFile(victim, "utf8"), "keep");
});

test("failed MCP config commit restores quarantined uninstall resources", async (t) => {
  const value = await fixture(t);
  await install(value);
  await assert.rejects(uninstall({
    ...value,
    copyAcl: async () => { throw new Error("ACL copy failed"); },
  }), /ACL copy failed/);
  await access(path.join(value.workspaceRoot, ".potassium-mcp-bootstrap.lua"));
  await access(path.join(value.installRoot, "app"));
  await access(path.join(value.installRoot, "ownership.json"));
});
test("uninstall refuses modified owned scripts and install rolls back a late doctor failure", async (t) => { const value = await fixture(t); await install(value); await writeFile(path.join(value.workspaceRoot, ".potassium-mcp-bootstrap.lua"), "modified"); await assert.rejects(uninstall(value), /ownership is ambiguous/); const failed = await fixture(t); await assert.rejects(install({ ...failed, installPackage: async ({ stage }) => { await failed.installPackage({ stage }); await rm(path.join(stage, "node_modules", "@mrketa", "potassium-mcp", "assets", "potassium_mcp_autoexec.lua")); } }), /missing required/); });
