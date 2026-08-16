import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const thisFile = fileURLToPath(import.meta.url);
const defaultProjectRoot = path.resolve(here, "../..");
const defaultWorkspaceRoot = process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, "Potassium", "workspace") : path.resolve(defaultProjectRoot, "../../workspace");
const scripts = [["bootstrap", "potassium_mcp_bootstrap.lua", ".potassium-mcp-bootstrap.lua"], ["autoexec", "potassium_mcp_autoexec.lua", "potassium_mcp_autoexec.lua"]];
const exists = async (target) => access(target, constants.F_OK).then(() => true).catch(() => false);
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const record = (checks, name, ok, detail, extra = {}) => checks.push({ name, ok, detail, ...extra });

function styLuaProbe(options) {
  if (options.checkStyLua === false) return null;
  if (options.styLuaCommand) return options.styLuaCommand;
  return process.env.POTASSIUM_LUA_COMPILE_PROBE ? JSON.parse(process.env.POTASSIUM_LUA_COMPILE_PROBE) : ["stylua", "--check"];
}
function validateStyLua(inputs, options) {
  try {
    const command = styLuaProbe(options);
    if (!command) return { ok: true, detail: "skipped by option", skipped: true };
    if (!Array.isArray(command) || !command.length || !command.every((part) => typeof part === "string")) return { ok: false, detail: "StyLua command must be a non-empty string array" };
    const [executable, ...baseArgs] = command;
    const commands = baseArgs.includes("{file}") ? inputs.map((file) => baseArgs.map((arg) => arg === "{file}" ? file : arg)) : [baseArgs.concat(inputs)];
    for (const [index, args] of commands.entries()) { const result = spawnSync(executable, args, { encoding: "utf8", windowsHide: true }); if (result.error) return { ok: false, detail: `StyLua unavailable: ${result.error.message}` }; if (result.status !== 0) return { ok: false, detail: `StyLua rejected ${baseArgs.includes("{file}") ? path.basename(inputs[index]) : `${inputs.length} Lua files`}: ${(result.stderr || result.stdout || `exit ${result.status}`).trim()}` }; }
    return { ok: true, detail: `StyLua checked ${inputs.length} Lua files` };
  } catch (error) { return { ok: false, detail: error.message }; }
}
async function scriptParity(scriptSourceRoot, workspaceRoot, autoexecRoot) {
  for (const [name, sourceName, targetName] of scripts) {
    const source = path.join(scriptSourceRoot, sourceName);
    const target = path.join(name === "bootstrap" ? workspaceRoot : autoexecRoot, targetName);
    if (!await exists(source)) return { ok: false, detail: `canonical ${sourceName} is missing` };
    if (!await exists(target)) return { ok: false, detail: `deployed ${targetName} is missing` };
    const [canonical, deployed] = await Promise.all([readFile(source), readFile(target)]);
    if (canonical.byteLength !== deployed.byteLength || sha256(canonical) !== sha256(deployed)) return { ok: false, detail: `deployed ${targetName} differs from canonical ${sourceName}` };
  }
  return { ok: true, detail: "both deployed scripts match their canonical sources" };
}

export async function doctor(options = {}) {
  const projectRoot = path.resolve(options.projectRoot ?? defaultProjectRoot);
  const workspaceRoot = path.resolve(options.workspaceRoot ?? process.env.POTASSIUM_WORKSPACE ?? defaultWorkspaceRoot);
  const scriptSourceRoot = path.resolve(options.scriptSourceRoot ?? path.join(projectRoot, "scripts"));
  const autoexecRoot = path.resolve(options.autoexecRoot ?? path.join(workspaceRoot, "..", "autoexec"));
  const checks = [];
  const canonical = scripts.map(([, sourceName]) => path.join(scriptSourceRoot, sourceName));
  record(checks, "canonical-scripts", (await Promise.all(canonical.map(exists))).every(Boolean), "requires exactly the canonical bootstrap and autoexec scripts");
  const style = validateStyLua(canonical, options); record(checks, "stylua", style.ok, style.detail, style.skipped ? { skipped: true } : {});
  try { const parity = await scriptParity(scriptSourceRoot, workspaceRoot, autoexecRoot); record(checks, "script-parity", parity.ok, parity.detail); } catch (error) { record(checks, "script-parity", false, error.message); }
  try {
    const configPath = path.join(projectRoot, "potassium-mcp", "config.json"); const config = JSON.parse(await readFile(configPath, "utf8")); const bootstrap = await readFile(canonical[0], "utf8");
    const endpoint = /^local\s+ENDPOINT\s*=\s*["']ws:\/\/([^:"']+):(\d+)["']\s*$/m.exec(bootstrap); const tokenFile = /pcall\(readfile,\s*["']([^"']+)["']\)/.exec(bootstrap);
    const tokenPath = typeof config.tokenFile === "string" ? path.resolve(path.dirname(configPath), config.tokenFile) : "";
    const ok = endpoint && tokenFile && config.host === endpoint[1] && config.port === Number(endpoint[2]) && tokenPath === path.resolve(workspaceRoot, tokenFile[1]) && Array.isArray(config.artifactRoots) && config.artifactRoots.length === 1;
    record(checks, "mcp-config", ok, ok ? "config endpoint, token path, and one bounded artifact root match bootstrap" : "config must match the bootstrap endpoint/token path and declare one bounded artifact root");
  } catch (error) { record(checks, "mcp-config", false, `config inspection failed: ${error.message}`); }
  try {
    const launcher = JSON.parse(await readFile(path.join(projectRoot, ".omp", "mcp.json"), "utf8"))?.mcpServers?.potassium; const server = path.join(projectRoot, "potassium-mcp", "src", "server.js");
    const ok = launcher?.type === "stdio" && launcher.command === "node" && Array.isArray(launcher.args) && launcher.args.length === 1 && path.resolve(launcher.args[0]) === path.resolve(server) && Number.isInteger(launcher.timeout) && launcher.timeout > 0;
    record(checks, "mcp-server-target", ok, ok ? "launcher targets the local MCP server" : "launcher must be a stdio Node command with the exact server path");
  } catch (error) { record(checks, "mcp-server-target", false, `launcher inspection failed: ${error.message}`); }
  return { ok: checks.every(({ ok }) => ok), checks };
}
if (process.argv[1] && path.resolve(process.argv[1]) === thisFile) doctor().then((result) => { console.log(JSON.stringify(result)); if (!result.ok) process.exitCode = 1; }).catch((error) => { console.error(`doctor failed: ${error.message}`); process.exitCode = 1; });
