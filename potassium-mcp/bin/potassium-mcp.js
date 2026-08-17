#!/usr/bin/env node
import { doctor } from "../src/doctor.js";
import { install, repair, uninstall } from "../src/install.js";

const help = `Potassium MCP\n\nUsage: potassium-mcp <install|repair|doctor|uninstall|help> [options]\n\nOptions:\n  --workspace <path>\n  --install-root <path>\n  --mcp-config <path>\n  --package-source <spec-or-path>\n  --json\n`;
function parse(argv) {
  const [command = "help", ...rest] = argv; const options = {};
  for (let index = 0; index < rest.length; index += 1) {
    const flag = rest[index]; if (flag === "--json") { options.json = true; continue; }
    const key = { "--workspace": "workspaceRoot", "--install-root": "installRoot", "--mcp-config": "mcpConfigPath", "--package-source": "packageSource" }[flag];
    if (!key || !rest[index + 1]) throw new Error(`unknown or incomplete option: ${flag}`);
    options[key] = rest[++index];
  }
  return { command, options };
}
function human(value, command) {
  if (typeof value === "string") return value;
  if (command === "doctor") {
    return value.checks.map((check) => `[${check.ok ? "ok" : "fail"}] ${check.name}: ${check.detail}`).join("\n");
  }
  if (command === "uninstall") {
    return "Potassium MCP uninstalled. The workspace token, artifacts, and unrelated MCP configuration were preserved.";
  }
  return [
    `Potassium MCP ${command === "repair" ? "repaired" : "installed"}.`,
    `Runtime: ${value.installRoot}`,
    `Workspace: ${value.workspaceRoot}`,
    `MCP config: ${value.mcpConfigPath}`,
    "Next: restart or reload the MCP host, then restart Potassium.",
  ].join("\n");
}
const emit = (value, json, command) => process.stdout.write(json ? `${JSON.stringify(value)}\n` : `${human(value, command)}\n`);
try {
  const { command, options } = parse(process.argv.slice(2));
  if (command === "help") emit(help, false, command);
  else if (command === "install") emit(await install(options), options.json, command);
  else if (command === "repair") emit(await repair(options), options.json, command);
  else if (command === "doctor") { const result = await doctor(options); emit(result, options.json, command); if (!result.ok) process.exitCode = 1; }
  else if (command === "uninstall") emit(await uninstall(options), options.json, command);
  else throw new Error(`unknown command: ${command}`);
} catch (error) { const json = process.argv.includes("--json"); process.stderr.write(json ? `${JSON.stringify({ ok: false, error: error.message })}\n` : `potassium-mcp: ${error.message}\n`); process.exitCode = 1; }
