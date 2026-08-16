# Potassium MCP Bridge

`celestial-potassium-mcp-public` is a standalone, local MCP bridge for bounded Roblox inspection. It uses Protocol 2 mutual authentication over loopback transport and exposes only bounded, redacted read-only inspection, metadata, observability, configured artifact/trace reads, and configured HTTPS reads.

## Not included

Gameplay automation is intentionally not included: there are no routes, collectors, movement, teleports, remotes, input actions, rewards, or gameplay runtime controls. The bridge does not expose arbitrary filesystem, source, bytecode, remote, input, teleport, or hook access.

## Setup

On Windows, start Potassium once, then run:

```powershell
.\tools\setup.ps1
```

The script installs locked Node dependencies, creates a local token, writes `potassium-mcp/config.json`, deploys the canonical bootstrap and autoexec scripts, runs doctor, and writes the local MCP launcher. Use `-WorkspaceRoot` to select another Potassium workspace.

## Deploy and check

```powershell
cd potassium-mcp
npm run deploy
npm run doctor
```

Deployment is transactional and installs exactly two scripts: `.potassium-mcp-bootstrap.lua` and `potassium_mcp_autoexec.lua`. Doctor verifies their byte parity, config-to-bootstrap endpoint/token parity, the local server launcher, and StyLua.

## License and security

Released under Apache-2.0. See [SECURITY.md](SECURITY.md) for reporting guidance and [docs/](docs) for configuration, architecture, API, testing, and development details.
