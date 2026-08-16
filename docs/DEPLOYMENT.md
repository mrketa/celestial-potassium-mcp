# Deployment

Run `npm run deploy` from `potassium-mcp`, or use `tools/setup.ps1`. Deployment stages and transactionally replaces exactly two canonical scripts:

- `.potassium-mcp-bootstrap.lua` in the workspace
- `potassium_mcp_autoexec.lua` in its autoexec directory

The deployment state records byte hashes and sizes. A failed activation restores prior managed artifacts. `npm run doctor` checks config/bootstrap parity, launcher parity, deployed script parity, and StyLua. `tools/uninstall.ps1` removes only artifacts proven by that state file.

## Publishing a release

The GitHub Actions release workflow runs only for tags matching `v*`. The tag, `version.txt`, and `potassium-mcp/package.json` version must match exactly. For example:

```powershell
git tag v0.7.0-beta.1
git push origin v0.7.0-beta.1
```

The Windows runner installs locked dependencies, runs the full test suite, checks and packs the public allowlist, then publishes:

- `celestial-potassium-mcp-v*-windows.zip`
- the matching `.sha256` checksum
- `RELEASE-EVIDENCE.json`

Prerelease version strings such as `0.7.0-beta.1` create a GitHub prerelease. The packaged ZIP contains no generated local configuration, token, deployment state, diagnostics, or gameplay automation.
