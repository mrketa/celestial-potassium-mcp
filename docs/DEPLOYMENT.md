# Deployment

Deploy and repair through the public installer, from the OMP project that owns the MCP configuration:

```powershell
npx --yes @mrketa/potassium-mcp@beta install
npx --yes @mrketa/potassium-mcp@beta repair
```

The default installation root is `%LOCALAPPDATA%\Potassium\MCP`; the default workspace is `%LOCALAPPDATA%\Potassium\workspace`. Installation uses npm to place the exact runtime package in the stable application directory, keeps its configuration outside `node_modules`, creates or reuses the workspace token with restricted ACL, and transactionally installs these canonical assets:

- `.potassium-mcp-bootstrap.lua` in the workspace
- `potassium_mcp_autoexec.lua` in the workspace autoexec directory

It safely merges only `mcpServers.potassium` into `<cwd>\.omp\mcp.json`. The launcher invokes the stable Node server with its stable `--config` path and a 30000 ms MCP timeout.

Restart or reload the MCP host after deployment, then restart Potassium so the local server is already listening. Run `npx --yes @mrketa/potassium-mcp@beta doctor` for static deployment, launcher, and token-configuration diagnostics. Do not manually copy tokens or scripts to resolve an authentication failure; run `repair`.

## Publishing a release

The release workflow installs locked dependencies, runs tests, verifies the release allowlist, creates and inspects the npm tarball, and publishes `@mrketa/potassium-mcp` publicly to npmjs with `npm publish --access public`. Publishing requires the repository `NPM_TOKEN` secret; there is no GitHub Packages registry or token path.

A matching `v<version>` tag also produces verified GitHub release source assets, a checksum, and release evidence. Those assets are supplementary; end users install only with the npx command above.
