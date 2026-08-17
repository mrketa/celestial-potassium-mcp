import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const thisFile = fileURLToPath(import.meta.url);
const packageDirectory = dirname(thisFile);
const packageMetadata = JSON.parse(await readFile(new URL("./package.json", import.meta.url), "utf8"));

export function distTagForVersion(version) {
  const prerelease = String(version).split("-", 2)[1];
  return prerelease?.split(/[.+-]/, 1)[0] || "latest";
}

export function validatePublishArgs(argv) {
  const allowed = [];
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--dry-run" || value === "--provenance") {
      allowed.push(value);
      continue;
    }
    if (value === "--otp" && /^\d{6}$/.test(argv[index + 1] ?? "")) {
      allowed.push(value, argv[++index]);
      continue;
    }
    if (/^--otp=\d{6}$/.test(value)) {
      allowed.push(value);
      continue;
    }
    throw new Error(`Unsupported npm publish option: ${value}`);
  }
  return allowed;
}

export function main(argv = process.argv.slice(2), env = process.env) {
  const token = env.NPM_TOKEN;
  if (!token) throw new Error("NPM_TOKEN must be set to publish @mrketa/potassium-mcp to npmjs.");

  const publishArgs = [
    "publish",
    ...validatePublishArgs(argv),
    "--access",
    "public",
    "--registry=https://registry.npmjs.org/",
    "--tag",
    distTagForVersion(packageMetadata.version),
  ];
  const publishEnv = { ...env, NODE_AUTH_TOKEN: token };
  if (env.npm_execpath) {
    execFileSync(process.execPath, [env.npm_execpath, ...publishArgs], {
      cwd: packageDirectory,
      env: publishEnv,
      stdio: "inherit",
    });
    return;
  }
  execFileSync("npm", publishArgs, {
    cwd: packageDirectory,
    env: publishEnv,
    stdio: "inherit",
  });
}

if (process.argv[1] && resolve(process.argv[1]) === thisFile) {
  try {
    main();
  } catch (error) {
    console.error(`publish failed: ${error.message}`);
    process.exitCode = 1;
  }
}
