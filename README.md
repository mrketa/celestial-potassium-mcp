# Potassium MCP Bridge

`@mrketa/potassium-mcp` is a local, read-only MCP bridge for bounded Potassium inspection. It uses loopback transport and mutual authentication; it does not expose gameplay automation, arbitrary filesystem access, source/bytecode access, remotes, input, teleport, or hook control.

## Install

Install from the OMP project whose `.omp\mcp.json` should receive the `potassium` server entry:

```powershell
npx --yes @mrketa/potassium-mcp@beta install
```

`@beta` is required while the published version is a prerelease. Replace it with the unqualified package name after the first stable release is published under npm's `latest` tag.

Windows and Node.js 22 or later are required. No administrator account, repository checkout, GitHub token, or GitHub Packages access is required.

The installer uses `%LOCALAPPDATA%\Potassium\MCP` and `%LOCALAPPDATA%\Potassium\workspace` by default. It installs the exact runtime package beneath the stable application directory, writes stable configuration outside `node_modules`, generates or reuses a restricted local token, transactionally deploys the canonical Lua assets, safely merges only `mcpServers.potassium`, and runs `doctor`.

Use a different location only when needed:

```powershell
npx --yes @mrketa/potassium-mcp@beta install --workspace <workspace-path> --install-root <install-root> --mcp-config <mcp-config-path>
```

## Operate

Run these commands from the same OMP project:

```powershell
npx --yes @mrketa/potassium-mcp@beta repair
npx --yes @mrketa/potassium-mcp@beta doctor
npx --yes @mrketa/potassium-mcp@beta uninstall
```

`repair` repeats the idempotent installation. `uninstall` removes only state that it can prove it owns; it preserves the workspace token, unrelated artifacts, and unrelated MCP configuration when ownership is ambiguous.

After installation or repair, restart or reload the MCP host first so the loopback server is listening, then restart Potassium so it loads the deployed bootstrap and connects within its bounded startup window.

## Diagnostics

`doctor` reports static deployment, launcher, and token-configuration readiness. Use `--json` for machine-readable output; failures return a nonzero exit status.

If the MCP host times out, confirm the generated `potassium` launcher uses a 30000 ms timeout, restart the MCP host before Potassium, then run `doctor`. Authentication failures usually mean the running Potassium bootstrap and stable MCP configuration do not share the same token; use `repair` rather than copying a token or weakening its ACL.

## Security and license

The bridge stays loopback-only and read-only. Keep the generated token private and do not add untrusted artifact roots or HTTP hosts. Released under [Apache-2.0](LICENSE). See [docs](docs/) for installation, deployment, configuration, and architecture details.
