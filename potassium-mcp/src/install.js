import { createHash, randomBytes } from "node:crypto";
import { access, lstat, mkdir, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deploy } from "./deploy.js";
import { doctor } from "./doctor.js";
import packageMetadata from "../package.json" with { type: "json" };

const exists = (target) => access(target, constants.F_OK).then(() => true).catch(() => false);
const hash = (value) => createHash("sha256").update(value).digest("hex");
const readJson = async (target, fallback) => await exists(target) ? JSON.parse(await readFile(target, "utf8")) : fallback;
const writeAtomic = async (target, value) => { const staged = `${target}.${randomBytes(8).toString("hex")}.tmp`; await mkdir(path.dirname(target), { recursive: true }); await writeFile(staged, typeof value === "string" || Buffer.isBuffer(value) ? value : `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 }); await rename(staged, target); };
async function rejectLinkedPath(target) {
  const resolved = path.resolve(target); const parsed = path.parse(resolved); let current = parsed.root;
  for (const part of resolved.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    try { if ((await lstat(current)).isSymbolicLink()) throw new Error(`refusing linked managed path: ${current}`); } catch (error) { if (error.code !== "ENOENT") throw error; break; }
  }
}
async function acquireInstallLock(installRoot) {
  const lockPath = `${installRoot}.lock`;
  await mkdir(path.dirname(lockPath), { recursive: true });
  let handle;
  try { handle = await open(lockPath, "wx", 0o600); } catch (error) { throw new Error(`another Potassium MCP operation holds ${lockPath}: ${error.code ?? error.message}`); }
  return async () => { await handle.close(); await rm(lockPath, { force: true }); };
}
export function defaults(cwd = process.cwd()) {
  const local = process.env.LOCALAPPDATA ?? path.join(os.homedir(), ".local", "share");
  return { installRoot: path.join(local, "Potassium", "MCP"), workspaceRoot: path.join(local, "Potassium", "workspace"), mcpConfigPath: path.join(cwd, ".omp", "mcp.json") };
}
function overlaps(left, right) {
  const relative = path.relative(left, right);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== "..");
}
function paths(options = {}) {
  const base = defaults(options.cwd);
  const installRoot = path.resolve(options.installRoot ?? base.installRoot);
  const workspaceRoot = path.resolve(options.workspaceRoot ?? base.workspaceRoot);
  const mcpConfigPath = path.resolve(options.mcpConfigPath ?? base.mcpConfigPath);
  if (overlaps(installRoot, workspaceRoot) || overlaps(workspaceRoot, installRoot)) {
    throw new Error("install root and workspace must not overlap");
  }
  if (overlaps(installRoot, mcpConfigPath)) {
    throw new Error("MCP config must be outside the install root");
  }
  return {
    installRoot,
    workspaceRoot,
    mcpConfigPath,
    appPath: path.join(installRoot, "app"),
    configPath: path.join(installRoot, "config.json"),
    statePath: path.join(installRoot, "ownership.json"),
  };
}
export async function restrictTokenAcl(tokenPath, run = spawnSync) {
  if (process.platform !== "win32") return;
  const user = process.env.USERDOMAIN && process.env.USERNAME
    ? `${process.env.USERDOMAIN}\\${process.env.USERNAME}`
    : process.env.USERNAME;
  if (!user) throw new Error("USERNAME is required to secure the token file");
  const result = run("icacls", [tokenPath, "/inheritance:r", "/grant:r", `${user}:F`], { encoding: "utf8", windowsHide: true });
  if (result.error || result.status !== 0) throw new Error("Unable to restrict token-file ACL");
}
async function applyFileAcl(target, source, options = {}) {
  if (source && options.copyAcl) {
    await options.copyAcl({ source, target });
    return;
  }
  if (process.platform !== "win32") return;
  if (!source) {
    await restrictTokenAcl(target, options.run ?? spawnSync);
    return;
  }
  const command = "$acl = Get-Acl -LiteralPath $env:POTASSIUM_ACL_SOURCE; Set-Acl -LiteralPath $env:POTASSIUM_ACL_TARGET -AclObject $acl";
  const result = (options.run ?? spawnSync)("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command], {
    encoding: "utf8",
    windowsHide: true,
    env: { ...process.env, POTASSIUM_ACL_SOURCE: source, POTASSIUM_ACL_TARGET: target },
  });
  if (result.error || result.status !== 0) throw new Error("Unable to preserve MCP-config ACL");
}
async function writeProtectedAtomic(target, value, options = {}, aclSource) {
  const staged = `${target}.${randomBytes(8).toString("hex")}.tmp`;
  await mkdir(path.dirname(target), { recursive: true });
  try {
    await writeFile(staged, "", { mode: 0o600, flag: "wx" });
    await applyFileAcl(staged, aclSource, options);
    await writeFile(staged, typeof value === "string" || Buffer.isBuffer(value) ? value : `${JSON.stringify(value, null, 2)}\n`);
    await rename(staged, target);
  } catch (error) {
    await rm(staged, { force: true });
    throw error;
  }
}
async function installRuntime(stage, source, options) {
  if (options.installPackage) return options.installPackage({ stage, source });
  const args = ["install", "--omit=dev", "--ignore-scripts", "--no-package-lock", "--prefix", stage, "--", source];
  let command = "npm";
  let commandArgs = args;
  if (process.platform === "win32") {
    const npmCli = process.env.npm_execpath ?? path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
    if (!await exists(npmCli)) throw new Error(`npm CLI was not found: ${npmCli}`);
    command = process.execPath;
    commandArgs = [npmCli, ...args];
  }
  const result = spawnSync(command, commandArgs, { encoding: "utf8", windowsHide: true });
  if (result.error || result.status !== 0) {
    const detail = result.error?.message ?? result.stderr?.trim() ?? result.stdout?.trim() ?? `exit ${result.status}`;
    throw new Error(`npm could not install the Potassium MCP runtime: ${detail}`);
  }
}
function runtimePath(appPath) { return path.join(appPath, "node_modules", "@mrketa", "potassium-mcp"); }
function runtimeConfig(workspaceRoot, tokenPath) { return { host: "127.0.0.1", port: 32145, tokenFile: tokenPath, requestTimeoutMs: 15000, maxMessageBytes: 1048576, maxPendingRequests: 64, shutdownGraceMs: 5000, artifactRoots: [{ name: "artifacts", path: path.join(workspaceRoot, "potassium-mcp-artifacts"), recursive: true, extensions: [".json", ".ndjson", ".txt", ".log"] }], httpAllowedHosts: ["apis.roblox.com", "games.roblox.com", "thumbnails.roblox.com", "users.roblox.com"] }; }
function launcher(serverPath, configPath) { return { type: "stdio", command: "node", args: [serverPath, "--config", configPath], timeout: 30000 }; }
function mergeLauncher(config, entry) { if (!config || typeof config !== "object" || Array.isArray(config)) throw new Error("MCP config must be a JSON object"); const mcpServers = config.mcpServers === undefined ? {} : config.mcpServers; if (!mcpServers || typeof mcpServers !== "object" || Array.isArray(mcpServers)) throw new Error("mcpServers must be a JSON object"); return { ...config, mcpServers: { ...mcpServers, potassium: entry } }; }

export async function install(options = {}) {
  const value = paths(options); const source = options.packageSource ?? `@mrketa/potassium-mcp@${packageMetadata.version}`;
  const stage = `${value.appPath}.${randomBytes(8).toString("hex")}.staging`;
  const deployStatePath = path.join(value.installRoot, "deploy-state.json");
  const backups = []; let scriptSnapshot = []; let deployStateSnapshot; let tokenSnapshot; let tokenChanged = false; let mcpConfigExisted = false; let priorOwnership; let releaseLock = async () => {};
  const remember = async (target) => { if (await exists(target)) { const backup = `${target}.${randomBytes(8).toString("hex")}.backup`; await rename(target, backup); backups.push([target, backup]); } else backups.push([target, null]); };
  try {
    if (typeof source !== "string" || source.startsWith("-")) throw new Error("package source must not begin with a dash");
    releaseLock = await acquireInstallLock(value.installRoot);
    if (!await exists(value.workspaceRoot)) throw new Error(`workspace does not exist: ${value.workspaceRoot}`);
    await Promise.all([value.installRoot, value.workspaceRoot, value.mcpConfigPath].map(rejectLinkedPath));
    priorOwnership = await readJson(value.statePath, null);
    const managedPaths = [value.appPath, value.configPath, deployStatePath, value.statePath, path.join(value.workspaceRoot, ".potassium-mcp-token"), path.join(value.workspaceRoot, ".potassium-mcp-bootstrap.lua"), path.join(value.workspaceRoot, "..", "autoexec", "potassium_mcp_autoexec.lua")];
    if (!priorOwnership) {
      if ((await Promise.all(managedPaths.map(exists))).some(Boolean) || (await readJson(value.mcpConfigPath, {}))?.mcpServers?.potassium !== undefined) throw new Error("refusing install: managed paths or launcher already exist without proven ownership");
    } else {
      if (priorOwnership.schema !== 1 || priorOwnership.installRoot !== value.installRoot || priorOwnership.workspaceRoot !== value.workspaceRoot || priorOwnership.mcpConfigPath !== value.mcpConfigPath || priorOwnership.appPath !== value.appPath || priorOwnership.configPath !== value.configPath || priorOwnership.tokenPath !== managedPaths[4] || !Array.isArray(priorOwnership.scripts) || priorOwnership.scripts.length !== 2) throw new Error("refusing repair: ownership state is invalid");
      const expectedLauncher = launcher(path.join(runtimePath(value.appPath), "src", "server.js"), value.configPath);
      const existingMcp = await readJson(value.mcpConfigPath, null);
      if (JSON.stringify(existingMcp?.mcpServers?.potassium) !== JSON.stringify(expectedLauncher) || !await exists(priorOwnership.tokenPath) || hash(await readFile(priorOwnership.tokenPath)) !== priorOwnership.tokenSha256 || !await exists(value.configPath) || hash(await readFile(value.configPath)) !== priorOwnership.configSha256 || !await exists(expectedLauncher.args[0]) || hash(await readFile(expectedLauncher.args[0])) !== priorOwnership.serverSha256) throw new Error("refusing repair: owned installation was modified");
      const targets = new Set(priorOwnership.scripts.map(({ target }) => target));
      if (targets.size !== 2 || !targets.has(managedPaths[5]) || !targets.has(managedPaths[6])) throw new Error("refusing repair: owned script paths are invalid");
      for (const script of priorOwnership.scripts) if (!await exists(script.target) || hash(await readFile(script.target)) !== script.sha256) throw new Error("refusing repair: owned scripts were modified");
    }
    await mkdir(stage, { recursive: true }); await installRuntime(stage, source, options);
    const stagedRuntime = runtimePath(stage);
    if (!await exists(path.join(stagedRuntime, "src", "server.js")) || !await exists(path.join(stagedRuntime, "assets", "potassium_mcp_bootstrap.lua")) || !await exists(path.join(stagedRuntime, "assets", "potassium_mcp_autoexec.lua"))) throw new Error("installed runtime is missing required server or assets");
    const tokenPath = path.join(value.workspaceRoot, ".potassium-mcp-token");
    tokenSnapshot = await exists(tokenPath) ? await readFile(tokenPath) : undefined;
    const currentToken = tokenSnapshot?.toString("utf8").trim() ?? "";
    if (currentToken.length < 32 || currentToken.length > 4096) {
      await writeProtectedAtomic(tokenPath, `${randomBytes(32).toString("hex")}\n`, options);
      tokenChanged = true;
    }
    await restrictTokenAcl(tokenPath, options.run ?? spawnSync);
    await mkdir(path.join(value.workspaceRoot, "potassium-mcp-artifacts"), { recursive: true });
    const config = runtimeConfig(value.workspaceRoot, tokenPath); const entry = launcher(path.join(runtimePath(value.appPath), "src", "server.js"), value.configPath);
    mcpConfigExisted = await exists(value.mcpConfigPath);
    const priorMcpText = mcpConfigExisted ? await readFile(value.mcpConfigPath, "utf8") : undefined;
    const priorMcp = priorMcpText === undefined ? {} : JSON.parse(priorMcpText); const mergedMcp = mergeLauncher(priorMcp, entry);
    await mkdir(value.installRoot, { recursive: true });
    await remember(value.appPath); await rename(stage, value.appPath);
    await remember(value.configPath); await writeAtomic(value.configPath, config);
    await options.beforeMcpCommit?.({ path: value.mcpConfigPath, operation: "install" });
    const currentMcpText = await exists(value.mcpConfigPath) ? await readFile(value.mcpConfigPath, "utf8") : undefined;
    if (currentMcpText !== priorMcpText) throw new Error("MCP config changed during installation");
    await remember(value.mcpConfigPath); await writeProtectedAtomic(value.mcpConfigPath, mergedMcp, options, mcpConfigExisted ? backups.at(-1)[1] : undefined);
    await remember(value.statePath);
    scriptSnapshot = await Promise.all([path.join(value.workspaceRoot, ".potassium-mcp-bootstrap.lua"), path.join(value.workspaceRoot, "..", "autoexec", "potassium_mcp_autoexec.lua")].map(async (target) => ({ target, content: await exists(target) ? await readFile(target) : undefined })));
    deployStateSnapshot = await exists(deployStatePath) ? await readFile(deployStatePath) : undefined;
    const deployed = await deploy({ scriptSourceRoot: path.join(runtimePath(value.appPath), "assets"), workspaceRoot: value.workspaceRoot, statePath: deployStatePath, compileProbe: options.compileProbe });
    const state = { schema: 1, installRoot: value.installRoot, workspaceRoot: value.workspaceRoot, mcpConfigPath: value.mcpConfigPath, mcpConfigCreated: priorOwnership?.mcpConfigCreated === true || !mcpConfigExisted, appPath: value.appPath, configPath: value.configPath, tokenPath, tokenSha256: hash(await readFile(tokenPath)), launcher: entry, scripts: deployed.files.map(({ target, sha256 }) => ({ target, sha256 })), configSha256: hash(await readFile(value.configPath)), serverSha256: hash(await readFile(entry.args[0])) };
    await writeAtomic(value.statePath, state);
    const result = await doctor({ installRoot: value.installRoot, workspaceRoot: value.workspaceRoot, mcpConfigPath: value.mcpConfigPath, packageRoot: runtimePath(value.appPath), configPath: value.configPath });
    if (!result.ok) throw new Error("installation doctor failed");
    await Promise.all(backups.map(([, backup]) => backup && (options.remove ?? rm)(backup, { recursive: true, force: true }).catch(() => {})));
    await releaseLock().catch(() => {});
    return { ...value, doctor: result };
  } catch (error) {
    await rm(stage, { recursive: true, force: true });
    await Promise.all(scriptSnapshot.map(async ({ target, content }) => content === undefined ? rm(target, { force: true }) : writeAtomic(target, content)));
    if (deployStateSnapshot === undefined) await rm(deployStatePath, { force: true }); else await writeAtomic(deployStatePath, deployStateSnapshot);
    if (tokenChanged) {
      if (tokenSnapshot === undefined) await rm(path.join(value.workspaceRoot, ".potassium-mcp-token"), { force: true });
      else await writeAtomic(path.join(value.workspaceRoot, ".potassium-mcp-token"), tokenSnapshot);
    }
    await Promise.all(backups.reverse().map(async ([target, backup]) => { await rm(target, { recursive: true, force: true }); if (backup && await exists(backup)) await rename(backup, target); }));
    await releaseLock().catch(() => {});
    throw error;
  }
}
export const repair = install;

async function uninstallLocked(value, options) {
  const state = await readJson(value.statePath, null);
  const expectedTokenPath = path.join(value.workspaceRoot, ".potassium-mcp-token");
  const expectedScriptPaths = new Set([
    path.join(value.workspaceRoot, ".potassium-mcp-bootstrap.lua"),
    path.join(value.workspaceRoot, "..", "autoexec", "potassium_mcp_autoexec.lua"),
  ]);
  const expectedLauncher = launcher(path.join(runtimePath(value.appPath), "src", "server.js"), value.configPath);
  const scriptPaths = new Set(Array.isArray(state?.scripts) ? state.scripts.map(({ target }) => target) : []);
  if (
    !state
    || state.schema !== 1
    || state.installRoot !== value.installRoot
    || state.workspaceRoot !== value.workspaceRoot
    || state.mcpConfigPath !== value.mcpConfigPath
    || state.appPath !== value.appPath
    || state.configPath !== value.configPath
    || state.tokenPath !== expectedTokenPath
    || JSON.stringify(state.launcher) !== JSON.stringify(expectedLauncher)
    || !Array.isArray(state.scripts)
    || state.scripts.length !== 2
    || scriptPaths.size !== 2
    || [...expectedScriptPaths].some((target) => !scriptPaths.has(target))
  ) throw new Error("refusing uninstall: installation ownership is ambiguous");
  const currentText = await readFile(value.mcpConfigPath, "utf8");
  const current = JSON.parse(currentText);
  const entry = current?.mcpServers?.potassium;
  if (JSON.stringify(entry) !== JSON.stringify(state.launcher)) throw new Error("refusing uninstall: MCP launcher ownership is ambiguous");
  if (!await exists(state.launcher.args[0]) || hash(await readFile(state.launcher.args[0])) !== state.serverSha256) throw new Error("refusing uninstall: runtime ownership is ambiguous");
  if (!await exists(state.tokenPath) || hash(await readFile(state.tokenPath)) !== state.tokenSha256) throw new Error("refusing uninstall: token ownership is ambiguous");
  for (const script of state.scripts) if (!await exists(script.target) || hash(await readFile(script.target)) !== script.sha256) throw new Error("refusing uninstall: deployed script ownership is ambiguous");
  if (!await exists(value.configPath) || hash(await readFile(value.configPath)) !== state.configSha256) throw new Error("refusing uninstall: runtime config ownership is ambiguous");
  const next = { ...current, mcpServers: { ...current.mcpServers } };
  delete next.mcpServers.potassium;
  const removeCreatedConfig = state.mcpConfigCreated === true && Object.keys(next.mcpServers).length === 0 && Object.keys(next).every((key) => key === "mcpServers");
  const quarantine = [];
  const moveAside = async (target) => {
    const parked = `${target}.${randomBytes(8).toString("hex")}.uninstall`;
    await rename(target, parked);
    quarantine.push([target, parked]);
  };
  try {
    for (const target of [...state.scripts.map(({ target }) => target), path.join(value.installRoot, "deploy-state.json"), value.configPath, value.appPath, value.statePath]) await moveAside(target);
    await options.beforeMcpCommit?.({ path: value.mcpConfigPath, operation: "uninstall" });
    if (await readFile(value.mcpConfigPath, "utf8") !== currentText) throw new Error("MCP config changed during uninstall");
    if (removeCreatedConfig) await rm(value.mcpConfigPath, { force: true });
    else await writeProtectedAtomic(value.mcpConfigPath, next, options, value.mcpConfigPath);
  } catch (error) {
    await Promise.all(quarantine.reverse().map(async ([target, parked]) => { if (await exists(parked)) await rename(parked, target); }));
    throw error;
  }
  await Promise.all(quarantine.map(([, parked]) => (options.remove ?? rm)(parked, { recursive: true, force: true }).catch(() => {})));
  return { uninstalled: true };
}

export async function uninstall(options = {}) {
  const value = paths(options);
  await Promise.all([value.installRoot, value.workspaceRoot, value.mcpConfigPath].map(rejectLinkedPath));
  const releaseLock = await acquireInstallLock(value.installRoot);
  try {
    return await uninstallLocked(value, options);
  } finally {
    await releaseLock().catch(() => {});
  }
}
