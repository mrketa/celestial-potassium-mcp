# Configuration

Copy `potassium-mcp/config.example.json` to `config.json`, or use `tools/setup.ps1`. Keep `host` loopback-only and make `tokenFile` point to the token read by the bootstrap. `artifactRoots` contains one generic bounded root; add only paths you explicitly intend the safe artifact reader to expose. `httpAllowedHosts` is an allowlist for HTTPS reads.

Request and message limits are defensive boundaries. Do not place secrets in artifacts.
