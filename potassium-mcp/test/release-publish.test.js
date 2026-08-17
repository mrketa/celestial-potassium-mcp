import assert from "node:assert/strict";
import test from "node:test";
import { distTagForVersion, validatePublishArgs } from "../release-publish.js";

test("npm publication keeps prereleases off the latest tag", () => {
  assert.equal(distTagForVersion("1.2.3"), "latest");
  assert.equal(distTagForVersion("1.2.3-beta.1"), "beta");
  assert.equal(distTagForVersion("1.2.3-rc.2+build"), "rc");
});

test("npm publication accepts only non-routing options", () => {
  assert.deepEqual(validatePublishArgs(["--dry-run", "--provenance", "--otp", "123456"]), [
    "--dry-run",
    "--provenance",
    "--otp",
    "123456",
  ]);
  assert.deepEqual(validatePublishArgs(["--otp=654321"]), ["--otp=654321"]);
  assert.throws(() => validatePublishArgs(["--registry=https://example.invalid"]), /Unsupported/);
  assert.throws(() => validatePublishArgs(["--tag", "latest"]), /Unsupported/);
  assert.throws(() => validatePublishArgs(["--otp", "not-valid"]), /Unsupported/);
});
