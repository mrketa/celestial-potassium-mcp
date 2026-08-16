# Deployment

Run `npm run deploy` from `potassium-mcp`, or use `tools/setup.ps1`. Deployment stages and transactionally replaces exactly two canonical scripts:

- `.potassium-mcp-bootstrap.lua` in the workspace
- `potassium_mcp_autoexec.lua` in its autoexec directory

The deployment state records byte hashes and sizes. A failed activation restores prior managed artifacts. `npm run doctor` checks config/bootstrap parity, launcher parity, deployed script parity, and StyLua. `tools/uninstall.ps1` removes only artifacts proven by that state file.
