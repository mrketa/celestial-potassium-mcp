import { createHash, randomUUID } from "node:crypto";
import { access, mkdir, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const thisFile = fileURLToPath(import.meta.url);
const defaultProjectRoot = path.resolve(here, "../..");
const defaultWorkspaceRoot = process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, "Potassium", "workspace") : path.resolve(defaultProjectRoot, "../../workspace");
const files = [["bootstrap", "potassium_mcp_bootstrap.lua", ".potassium-mcp-bootstrap.lua"], ["autoexec", "potassium_mcp_autoexec.lua", "potassium_mcp_autoexec.lua"]];
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const exists = async (target) => access(target, constants.F_OK).then(() => true).catch(() => false);

function compileProbe(inputs, injectedProbe) {
  const supplied = injectedProbe ?? (process.env.POTASSIUM_LUA_COMPILE_PROBE ? JSON.parse(process.env.POTASSIUM_LUA_COMPILE_PROBE) : ["stylua", "--check"]);
  if (!Array.isArray(supplied) || !supplied.length || !supplied.every((part) => typeof part === "string")) throw new Error("StyLua command must be a non-empty string array");
  const [executable, ...baseArgs] = supplied;
  const commands = baseArgs.includes("{file}") ? inputs.map((file) => baseArgs.map((arg) => arg === "{file}" ? file : arg)) : [baseArgs.concat(inputs)];
  for (const [index, args] of commands.entries()) {
    const result = spawnSync(executable, args, { encoding: "utf8", windowsHide: true });
    if (result.error) throw new Error(`StyLua is unavailable: ${result.error.message}`);
    if (result.status !== 0) throw new Error(`StyLua rejected ${baseArgs.includes("{file}") ? inputs[index] : `${inputs.length} Lua files`}: ${(result.stderr || result.stdout || `exit ${result.status}`).trim()}`);
  }
}
async function resolvedPath(target) { return await exists(target) ? realpath(target) : path.resolve(target); }
function overlaps(left, right) { const relative = path.relative(left, right); return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".."); }
async function rejectUnsafePaths({ scriptSourceRoot, workspaceRoot, autoexecRoot, targets, statePath }) {
  const [source, workspace, autoexec, state, ...resolvedTargets] = await Promise.all([scriptSourceRoot, workspaceRoot, autoexecRoot, statePath, ...targets].map(resolvedPath));
  const protectedRoots = [workspace, autoexec, state, ...resolvedTargets];
  if (protectedRoots.some((target) => overlaps(source, target) || overlaps(target, source))) throw new Error("scriptSourceRoot must not overlap a deployment target");
  const outputs = [state, ...resolvedTargets];
  for (let index = 0; index < outputs.length; index += 1) for (let other = index + 1; other < outputs.length; other += 1) if (overlaps(outputs[index], outputs[other]) || overlaps(outputs[other], outputs[index])) throw new Error("deployment targets must not overlap");
}
async function stage(target, content) { const staged = `${target}.${randomUUID()}.staging`; await mkdir(path.dirname(staged), { recursive: true }); await writeFile(staged, content); return staged; }
async function backup(target) { const present = await exists(target); const backupPath = `${target}.${randomUUID()}.backup`; if (present) await rename(target, backupPath); return { target, backupPath, present, activated: false }; }
async function restore(item) { if (item.activated) await rm(item.target, { force: true }); if (item.present && await exists(item.backupPath)) await rename(item.backupPath, item.target); }
async function canonicalScripts(scriptSourceRoot, workspaceRoot, autoexecRoot) { return Promise.all(files.map(async ([name, sourceName, targetName]) => { const source = path.join(scriptSourceRoot, sourceName); const content = await readFile(source); return { name, source, target: path.join(name === "bootstrap" ? workspaceRoot : autoexecRoot, targetName), content, sha256: sha256(content), bytes: content.byteLength }; })); }

async function deploy(options = {}) {
  const projectRoot = path.resolve(options.projectRoot ?? defaultProjectRoot);
  const scriptSourceRoot = path.resolve(options.scriptSourceRoot ?? path.join(projectRoot, "scripts"));
  const workspaceRoot = path.resolve(options.workspaceRoot ?? process.env.POTASSIUM_WORKSPACE ?? defaultWorkspaceRoot);
  const autoexecRoot = path.resolve(options.autoexecRoot ?? path.join(workspaceRoot, "..", "autoexec"));
  const statePath = path.resolve(options.statePath ?? path.join(projectRoot, "DEPLOY_STATE.json"));
  const scripts = await canonicalScripts(scriptSourceRoot, workspaceRoot, autoexecRoot);
  await rejectUnsafePaths({ scriptSourceRoot, workspaceRoot, autoexecRoot, targets: scripts.map(({ target }) => target), statePath });
  await (options.compileProbe ?? ((inputs) => compileProbe(inputs, options.styLuaCommand)))(scripts.map(({ source }) => source));
  const state = { schema: 2, deployedAt: new Date().toISOString(), scriptSourceRoot, workspaceRoot, autoexecRoot, files: scripts.map(({ name, source, target, sha256: digest, bytes }) => ({ name, source, target, sourceSha256: digest, targetSha256: digest, sourceBytes: bytes, targetBytes: bytes, byteParity: true })) };
  const staged = await Promise.all([...scripts.map(({ target, content }) => stage(target, content)), stage(statePath, `${JSON.stringify(state, null, 2)}\n`)]);
  const transaction = [];
  try {
    for (const target of [...scripts.map(({ target }) => target), statePath]) transaction.push(await backup(target));
    for (let index = 0; index < transaction.length; index += 1) { await rename(staged[index], transaction[index].target); transaction[index].activated = true; await options.onActivation?.(index < scripts.length ? scripts[index].name : "state"); }
    for (const item of scripts) { const deployed = await readFile(item.target); if (deployed.byteLength !== item.bytes || sha256(deployed) !== item.sha256) throw new Error(`deployed ${item.name} differs from canonical source`); }
  } catch (error) { await Promise.all(transaction.slice().reverse().map(restore)); throw error; }
  finally { await Promise.all(staged.map((file) => rm(file, { force: true }))); }
  for (const item of transaction) { try { await (options.remove ?? rm)(item.backupPath, { force: true }); } catch { /* committed deployment remains authoritative */ } }
  return state;
}
if (process.argv[1] && path.resolve(process.argv[1]) === thisFile) deploy().then((result) => console.log(JSON.stringify(result))).catch((error) => { console.error(`deploy failed: ${error.message}`); process.exitCode = 1; });
export { deploy, rejectUnsafePaths };
