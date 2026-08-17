# Getting Started

1. Install Node.js 22 or later on Windows.
2. Start Potassium once so `%LOCALAPPDATA%\Potassium\workspace` exists.
3. Open the OMP project whose `.omp\mcp.json` should be updated.
4. Run:

   ```powershell
   npx --yes @mrketa/potassium-mcp@beta install
   ```

5. Restart or reload the MCP host, then restart Potassium.

The installer writes the stable runtime under `%LOCALAPPDATA%\Potassium\MCP`, creates or reuses a restricted local token, transactionally deploys the canonical Lua assets, merges only `mcpServers.potassium` into the active project's `.omp\mcp.json`, and runs `doctor`.

For alternate paths use `--workspace`, `--install-root`, and `--mcp-config`. Run `npx --yes @mrketa/potassium-mcp@beta doctor` from that OMP project to diagnose static configuration and deployment problems.
