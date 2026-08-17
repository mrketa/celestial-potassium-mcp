# Potassium MCP Bridge

Local, loopback-only MCP bridge for bounded, redacted, read-only Potassium inspection. Gameplay automation, arbitrary filesystem access, source/bytecode access, remotes, input, teleports, and hooks are not exposed.

## Requirements

- Windows
- Node.js 22 or later
- Potassium started once so `%LOCALAPPDATA%\Potassium\workspace` exists

## Install

Run from the OMP project whose `.omp\mcp.json` should receive the `potassium` server entry:

```powershell
npx --yes @mrketa/potassium-mcp@beta install
```

`@beta` selects the current prerelease without moving npm's stable `latest` tag.

Then restart or reload the MCP host first, followed by Potassium.

## Operate

```powershell
npx --yes @mrketa/potassium-mcp@beta doctor
npx --yes @mrketa/potassium-mcp@beta repair
npx --yes @mrketa/potassium-mcp@beta uninstall
```

Alternate paths can be supplied with `--workspace`, `--install-root`, and `--mcp-config`. Add `--json` for machine-readable output.

Installation is local and requires no administrator account or GitHub token. The installer generates or reuses a private workspace token, restricts its Windows ACL, installs a version-pinned runtime beneath `%LOCALAPPDATA%\Potassium\MCP`, transactionally deploys the Lua assets, preserves unrelated MCP configuration, and runs static diagnostics.

Source, documentation, and security policy: https://github.com/mrketa/celestial-potassium-mcp

Licensed under Apache-2.0.
