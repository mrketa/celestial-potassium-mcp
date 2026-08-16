# Security Policy

Report suspected vulnerabilities privately to the repository maintainers. Include a minimal reproduction, impact, affected version, and any relevant logs with secrets removed.

The bridge is intentionally local and bounded: Protocol 2 mutual authentication, loopback-only transport, request-size/time limits, FIFO ownership, and redacted read-only tools are security boundaries. Do not report gameplay automation requests as feature proposals; that capability is intentionally absent.

Never include bridge tokens or private artifact contents in issues. Rotate a suspected token by removing it and rerunning `tools/setup.ps1`.
