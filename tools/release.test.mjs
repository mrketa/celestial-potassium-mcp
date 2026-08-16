import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { portableRelative, selectPublicFiles } from "./release.mjs";

async function fixture(files) {
  const root = await mkdtemp(path.join(os.tmpdir(), "celestial-release-"));
  const listed = Object.keys(files);
  await writeFile(path.join(root, "release-manifest.json"), `${JSON.stringify({ schemaVersion: 1, files: ["release-manifest.json", ...listed] })}\n`);
  for (const [relative, content] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(root, relative)), { recursive: true });
    await writeFile(path.join(root, relative), content);
  }
  return root;
}

test("portableRelative emits separator-stable paths and rejects escapes", () => {
  const drive = "C:";
  const slash = String.fromCharCode(92);
  assert.equal(portableRelative(drive + slash + "repo", drive + slash + "repo" + slash + "potassium-mcp" + slash + "src" + slash + "server.js"), "potassium-mcp/src/server.js");
  assert.throws(() => portableRelative(drive + slash + "repo", drive + slash + "outside" + slash + "config.json"), /escapes/);
});

test("selectPublicFiles accepts precisely manifest-listed regular files", async (t) => {
  const root = await fixture({ "src/main.js": "export const safe = true;\n" });
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, ".github", "workflows"), { recursive: true });
  await writeFile(path.join(root, ".github", "workflows", "release.yml"), "name: fixture\n");
  const files = await selectPublicFiles(root);
  assert.deepEqual(files.map(({ path: file }) => file), ["release-manifest.json", "src/main.js"]);
});

test("selectPublicFiles rejects unexpected and secret-bearing files", async (t) => {
  const root = await fixture({ "src/main.js": "export const safe = true;\n" });
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(path.join(root, "unexpected.js"), "do not publish\n");
  await assert.rejects(selectPublicFiles(root), /Unexpected public-release files/);
  await rm(path.join(root, "unexpected.js"));
  await writeFile(path.join(root, "src/main.js"), `export const config = { "token": "${"1".repeat(32)}" };\n`);
  await assert.rejects(selectPublicFiles(root), /Potential secret literal/);
});

test("selectPublicFiles rejects common credential assignments and local absolute paths", async (t) => {
  const root = await fixture({ "src/main.js": "export const safe = true;\n" });
  t.after(() => rm(root, { recursive: true, force: true }));
  const target = path.join(root, "src/main.js");
  const secret = "s".repeat(40);
  for (const unsafe of [
    `TOKEN=${secret}\n`,
    `$env:API_KEY = "${secret}"\n`,
    `local password = "${secret}"\n`,
    `Authorization: Bearer ${secret}\n`,
    "cache = C:" + String.fromCharCode(92) + "Users" + String.fromCharCode(92) + "operator" + String.fromCharCode(92) + "private.json\n",
    "share = " + String.fromCharCode(92, 92) + "workstation" + String.fromCharCode(92) + "private" + String.fromCharCode(92) + "token.txt\n",
    "cache = /home/" + "operator/private.json\n",
  ]) {
    await writeFile(target, unsafe);
    await assert.rejects(selectPublicFiles(root), /Potential secret literal|Absolute local path/);
  }
});
