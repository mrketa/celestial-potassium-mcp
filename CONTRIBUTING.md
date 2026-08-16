# Contributing

Contributions must preserve the standalone Potassium MCP boundary: loopback-only Protocol 2 mutual authentication, FIFO single-flight bridge ownership, and bounded/redacted read-only tools.

Gameplay automation is intentionally not included. Do not add route execution, collectors, movement, teleports, remotes, input actions, rewards, runtime controls, arbitrary code execution, filesystem access, source/bytecode reads, or hooks.

Install dependencies with `npm ci` in `potassium-mcp`. Run the focused test suite and `npm run doctor` before proposing deployment changes. Deployment must remain limited to the canonical bootstrap and autoexec scripts with byte-parity verification.
