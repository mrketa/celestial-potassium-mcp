import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./server.js";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const exists = (target) => access(target, constants.F_OK).then(() => true).catch(() => false);
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const record = (checks, name, ok, detail) => checks.push({ name, ok, detail });
const assets = [["bootstrap", "potassium_mcp_bootstrap.lua", ".potassium-mcp-bootstrap.lua"], ["autoexec", "potassium_mcp_autoexec.lua", "potassium_mcp_autoexec.lua"]];

export async function doctor(options = {}) {
  const installRoot = path.resolve(options.installRoot ?? (process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, "Potassium", "MCP") : path.join(packageRoot, "..", "MCP")));
  const workspaceRoot = path.resolve(options.workspaceRoot ?? (process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, "Potassium", "workspace") : path.join(installRoot, "workspace")));
  const sourceRoot = path.resolve(options.scriptSourceRoot ?? options.packageRoot ?? packageRoot, "assets");
  const configPath = path.resolve(options.configPath ?? path.join(installRoot, "config.json"));
  const mcpConfigPath = path.resolve(options.mcpConfigPath ?? path.join(process.cwd(), ".omp", "mcp.json"));
  const serverPath = path.resolve(options.serverPath ?? path.join(installRoot, "app", "node_modules", "@mrketa", "potassium-mcp", "src", "server.js"));
  const autoexecRoot = path.resolve(options.autoexecRoot ?? path.join(workspaceRoot, "..", "autoexec"));
  const checks = [];
  record(checks, "workspace", await exists(workspaceRoot), "workspace exists");
  const canonical = assets.map(([, source]) => path.join(sourceRoot, source));
  record(checks, "canonical-assets", (await Promise.all(canonical.map(exists))).every(Boolean), "both canonical Lua assets exist");
  try {
    const parity = await Promise.all(assets.map(async ([name, source, target]) => {
      const deployed = path.join(name === "bootstrap" ? workspaceRoot : autoexecRoot, target);
      return await exists(deployed) && sha256(await readFile(path.join(sourceRoot, source))) === sha256(await readFile(deployed));
    }));
    record(checks, "script-parity", parity.every(Boolean), "deployed scripts match canonical assets");
  } catch (error) { record(checks, "script-parity", false, error.message); }
  try {
    if (!await exists(serverPath)) throw new Error("stable server is missing");
    const config = await loadConfig(configPath);
    const tokenPath = path.resolve(path.dirname(configPath), JSON.parse(await readFile(configPath, "utf8")).tokenFile ?? "");
    record(checks, "runtime-config", config.host === "127.0.0.1" && await exists(tokenPath) && config.artifactRoots.length === 1, "server accepts the loopback runtime config");
  } catch (error) { record(checks, "runtime-config", false, error.message); }
  try {
    const launcher = JSON.parse(await readFile(mcpConfigPath, "utf8"))?.mcpServers?.potassium;
    const expectedArgs = [serverPath, "--config", configPath];
    const ok = launcher?.type === "stdio" && launcher.command === "node" && JSON.stringify(launcher.args) === JSON.stringify(expectedArgs) && launcher.timeout === 30000;
    record(checks, "mcp-launcher", ok, ok ? "launcher targets the stable server and config" : "launcher must target the stable server with --config");
  } catch (error) { record(checks, "mcp-launcher", false, error.message); }
  return { ok: checks.every(({ ok }) => ok), checks };
}
