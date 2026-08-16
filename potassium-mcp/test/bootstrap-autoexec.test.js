import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const autoexecPath = resolve("../scripts/potassium_mcp_autoexec.lua");
const bootstrapPath = resolve("../scripts/potassium_mcp_bootstrap.lua");

test("autoexec loads the standalone bootstrap and retries only bounded failures", async () => {
  const source = await readFile(autoexecPath, "utf8");

  assert.match(source, /local BOOTSTRAP_PATH = "\.potassium-mcp-bootstrap\.lua"/);
  assert.match(source, /local RETRYABLE_REASONS = \{/);
  assert.match(source, /\["bootstrap file is unavailable"\] = true/);
  assert.match(source, /\["connection unavailable"\] = true/);
  assert.match(source, /\["connection failed"\] = true/);
  assert.match(source, /pcall\(readfile, BOOTSTRAP_PATH\)/);
  assert.match(source, /loadstring\(source, "@" \.\. BOOTSTRAP_PATH\)/);
  assert.match(source, /pcall\(chunk\)/);
  assert.match(source, /if not retryable or attempt == MAX_LOAD_ATTEMPTS then\s+break\s+end/);
  assert.match(source, /warnUnavailable\(reason\)/);
  assert.doesNotMatch(source, /queue_?on_teleport|TELEPORT_SOURCE|TeleportService/i);
});

test("bootstrap preserves Protocol 2 diagnostics and generic read-only capabilities", async () => {
  const source = await readFile(bootstrapPath, "utf8");

  assert.match(source, /local PROTOCOL = 2/);
  assert.match(source, /function handshakeProof\(role, clientNonce, serverNonce\)/);
  assert.match(source, /pcall\(crypt\.hmac, key, message, "sha256"\)/);
  assert.match(source, /startupStatus\s*=/);
  assert.match(source, /startupReason\s*=/);
  assert.match(source, /function handlers\.capabilities\(\)/);
  assert.match(source, /"diagnostic_snapshot"/);
  assert.match(source, /"observe_changes"/);
  assert.match(source, /function handlers\.client_state\(\)/);
  assert.doesNotMatch(source, /\bWins\b/);
  assert.doesNotMatch(source, /\bexecute_luau\b/);
  assert.doesNotMatch(
    source,
    /runtime_(?:status|stop|eject|command)|approved_teleport|registered_(?:input|remote)_action/i,
  );
  assert.doesNotMatch(
    source,
    /CoinBattle|World 3|TeleportService|queue_?on_teleport|PotassiumNextRuntime|approvalNonce/i,
  );
  assert.doesNotMatch(source, /HMAC_BLOCK_BYTES|base64ToBytes|writeHmacDiagnostic|protocol2-diagnostic/);
});

test("standalone Lua sources have no legacy gameplay markers", async () => {
  const [bootstrap, autoexec] = await Promise.all([
    readFile(bootstrapPath, "utf8"),
    readFile(autoexecPath, "utf8"),
  ]);

  for (const source of [bootstrap, autoexec]) {
    assert.doesNotMatch(source, /Celestial|Stage [1567]|Coin Battle|World 3|Wins/i);
  }
});
