# Getting Started

1. Install Node.js 22+ and Potassium on Windows.
2. Start Potassium once so its workspace exists.
3. Run `./tools/setup.ps1` from the repository root.
4. Confirm `cd potassium-mcp; npm run doctor` succeeds.

Setup creates a local bridge token and one generic artifact root, deploys the canonical bootstrap and autoexec scripts, and writes `.omp/mcp.json`. The resulting MCP server provides bounded read-only inspection only.
