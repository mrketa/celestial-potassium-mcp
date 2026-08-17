# Changelog

## Unreleased
- Prepared the public npm package `@mrketa/potassium-mcp` with the `potassium-mcp` executable and npx-only install, repair, doctor, and uninstall commands.
- Removed GitHub Packages and legacy PowerShell setup/uninstall flows from public installation and release publishing.

- Converted the public package to a standalone Potassium MCP bridge for bounded local inspection.
- Removed gameplay automation and runtime deployment surfaces.
- Deployment now transactionally installs only canonical bootstrap and autoexec scripts with byte parity.
- Simplified configuration, setup, uninstall, doctor, and release contents around the local bridge.
- Added tag-driven GitHub Releases with a verified Windows ZIP, SHA-256 checksum, release evidence, generated notes, and automatic prerelease classification.
- Bounded unauthenticated executor connection cycles to 10 seconds so failed MCP startup cannot reconnect indefinitely.
- Added a copy-ready trusted-agent installation prompt with checksum, MCP registration, restart handoff, and live connection verification requirements.
