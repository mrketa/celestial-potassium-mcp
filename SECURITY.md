# Security Policy

The Potassium MCP bridge is intentionally loopback-only, mutually authenticated, and read-only. Do not include bridge tokens, private artifact contents, or local configuration in issues.

If a token may be exposed, remove only the token through the supported recovery path and run `npx --yes @mrketa/potassium-mcp repair` from the OMP project. Do not copy tokens into chat, issue trackers, or MCP configuration by hand, and do not weaken the token ACL.

Report vulnerabilities privately to the maintainers with a minimal reproduction and impact description.
