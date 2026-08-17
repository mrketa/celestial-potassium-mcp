# Configuration

`npx --yes @mrketa/potassium-mcp@beta install` writes stable configuration beneath `%LOCALAPPDATA%\Potassium\MCP`, outside `node_modules`. Do not copy `config.example.json` over that configuration or manually change the generated token path.

The bridge remains loopback-only. Its token must be shared only by the stable MCP configuration and the deployed bootstrap; installer and repair preserve restricted ACLs. `artifactRoots` and `httpAllowedHosts` are explicit bounded allowlists. Add entries only when you intentionally want that data exposed through the read-only bridge.

Use `--workspace`, `--install-root`, and `--mcp-config` to select non-default paths. Use `doctor --json` to inspect the effective configuration without printing secret material.
