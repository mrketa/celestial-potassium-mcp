import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { commandConfigPath } from "../src/server.js";

test("server accepts an explicit stable --config path", () => { assert.equal(commandConfigPath(["--config", "stable/config.json"]), path.resolve("stable/config.json")); });
test("server rejects a missing --config value", () => { assert.throws(() => commandConfigPath(["--config"]), /requires a path/); });
