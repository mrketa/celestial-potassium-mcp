# Architecture

The local Node MCP server accepts stdio requests and forwards bounded operations across a loopback WebSocket bridge. Protocol 2 uses mutual authentication; bridge ownership is FIFO and single-flight. The executor bootstrap connects only to the configured loopback endpoint.
Unauthenticated executor connection cycles fail closed after 10 seconds. A late native WebSocket result is discarded, and reconnects after an established-session disconnect receive the same bounded window.

Safe tools inspect bounded Roblox metadata, instances, properties, tags, logs, performance, and configured artifacts/traces/HTTPS hosts. Responses are bounded and redacted. The bridge has no gameplay automation or arbitrary access paths.
