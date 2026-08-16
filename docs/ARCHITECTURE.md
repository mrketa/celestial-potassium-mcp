# Architecture

The local Node MCP server accepts stdio requests and forwards bounded operations across a loopback WebSocket bridge. Protocol 2 uses mutual authentication; bridge ownership is FIFO and single-flight. The executor bootstrap connects only to the configured loopback endpoint.

Safe tools inspect bounded Roblox metadata, instances, properties, tags, logs, performance, and configured artifacts/traces/HTTPS hosts. Responses are bounded and redacted. The bridge has no gameplay automation or arbitrary access paths.
