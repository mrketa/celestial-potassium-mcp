import { createHash } from "node:crypto";
import { cp, lstat, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const projectRoot = path.resolve(here, "..");
const outputRoot = path.join(projectRoot, "release-out", "public");

export function portableRelative(from, target) {
  const relative = path.relative(from, target);
  if (!relative || path.isAbsolute(relative) || relative.split(path.sep).includes("..")) throw new Error(`Path escapes its base: ${target}`);
  return relative.split(path.sep).join("/");
}
const sha256 = (content) => createHash("sha256").update(content).digest("hex");



function assertSafeContent(relative, content) {
  const absolutePath = /(?:^|[\s"'=(])(?:[A-Za-z]:[\\/](?![<>])|\\\\[A-Za-z0-9._-]+[\\/]|\/(?:home|Users|root|tmp)\/[A-Za-z0-9_.-]+)/m;
  if (absolutePath.test(content)) throw new Error(`Absolute local path found in ${relative}`);
  const credentialAssignment = /(?:^|\n)\s*(?:(?:export\s+)?(?:const|let|var|local)\s+)?(?:\$env:)?(?:token|secret|api[_-]?key|password|passwd|authorization)\s*(?::|=)\s*(?:["'](?!(?:test|fixture|example|replace-me)-)[^"'\r\n]{16,}["']|(?!(?:test|fixture|example|replace-me)-)[A-Za-z0-9_+/=-]{32,})/i;
  const bearerLiteral = /\bBearer\s+(?!(?:test|fixture|example|replace-me)-)[A-Za-z0-9._~+/=-]{16,}/i;
  const structuredSecret = /["'](?:token|secret|api[_-]?key|password|passwd|authorization)["']\s*:\s*["'](?!(?:test|fixture|example|replace-me)-)[^"'\r\n]{16,}["']/i;
  if (credentialAssignment.test(content) || bearerLiteral.test(content) || structuredSecret.test(content)) {
    throw new Error(`Potential secret literal found in ${relative}`);
  }
}

export async function loadReleaseManifest(root = projectRoot) {
  const source = await readFile(path.join(root, "release-manifest.json"), "utf8");
  const manifest = JSON.parse(source);
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.files) || manifest.files.length === 0) throw new Error("Release manifest must declare schemaVersion 1 and a non-empty files list");
  const files = [...manifest.files].sort();
  if (new Set(files).size !== files.length) throw new Error("Release manifest contains duplicate files");
  for (const file of files) {
    if (typeof file !== "string" || !file || file.includes("\\") || file.startsWith("/") || file.split("/").includes("..")) throw new Error(`Invalid release manifest path: ${file}`);
  }
  return { manifest, files };
}

export async function selectPublicFiles(root = projectRoot) {
  const { files } = await loadReleaseManifest(root);
  const records = [];
  for (const relative of files) {
    const full = path.join(root, relative);
    let info;
    try {
      info = await lstat(full);
    } catch (error) {
      if (error.code === "ENOENT") throw new Error(`Release manifest file is missing: ${relative}`);
      throw error;
    }
    if (!info.isFile() || info.isSymbolicLink()) throw new Error(`Release file must be a regular file: ${relative}`);
    const content = await readFile(full);
    assertSafeContent(relative, content.toString("utf8"));
    records.push({ path: relative, bytes: info.size, sha256: sha256(content) });
  }
  return records;
}

function lockEvidence(lock) {
  const packages = Object.entries(lock.packages ?? {}).map(([name, entry]) => ({ name, version: entry.version ?? null, integrity: entry.integrity ?? null })).sort((a, b) => a.name.localeCompare(b.name));
  return { lockfileVersion: lock.lockfileVersion, packages };
}

export async function checkRelease(root = projectRoot) {
  const files = await selectPublicFiles(root);
  const lock = JSON.parse(await readFile(path.join(root, "potassium-mcp", "package-lock.json"), "utf8"));
  return { schemaVersion: 1, files, sbom: lockEvidence(lock) };
}

export async function packRelease(root = projectRoot, destination = outputRoot) {
  const report = await checkRelease(root);
  await rm(destination, { recursive: true, force: true });
  await mkdir(destination, { recursive: true });
  for (const record of report.files) {
    const source = path.join(root, record.path);
    const target = path.join(destination, record.path);
    await mkdir(path.dirname(target), { recursive: true });
    await cp(source, target, { force: true, verbatimSymlinks: true });
  }
  const evidence = `${JSON.stringify(report, null, 2)}\n`;
  await writeFile(path.join(destination, "RELEASE-EVIDENCE.json"), evidence, "utf8");
  for (const record of report.files) {
    const copied = await readFile(path.join(destination, record.path));
    if (copied.length !== record.bytes || sha256(copied) !== record.sha256) throw new Error(`Release copy verification failed: ${record.path}`);
  }
  return { destination: portableRelative(root, destination), files: report.files.length, evidenceSha256: sha256(evidence) };
}

async function main() {
  const command = process.argv[2];
  if (command === "check") console.log(JSON.stringify(await checkRelease(), null, 2));
  else if (command === "pack") console.log(JSON.stringify(await packRelease(), null, 2));
  else throw new Error("Usage: node tools/release.mjs <check|pack>");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(`release failed: ${error.message}`); process.exitCode = 1; });
