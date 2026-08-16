# Development

Install dependencies with `npm ci` in `potassium-mcp`. Keep changes focused on the standalone local bridge and preserve the protocol, loopback, ownership, bounds, and redaction guarantees.

For deployment work, use the canonical scripts in `scripts/`; do not create additional deployed payloads. The public bridge is read-only and must not acquire gameplay or arbitrary execution capabilities.
