# Agent-assisted installation

Give the prompt below to a trusted local coding agent that can run PowerShell and edit your MCP client configuration. The agent must not claim success until it completes the live checks. Installation is Windows-only and requires Potassium plus a compatible executor.

## Copy this prompt

```text
Install and connect the latest official release of Potassium MCP Bridge from:
https://github.com/mrketa/celestial-potassium-mcp

Complete the installation rather than only explaining it. Follow these requirements:

1. Work only on this Windows computer. Keep the bridge on 127.0.0.1 or ::1. Never expose it through a firewall rule, LAN address, tunnel, proxy, port-forward, remote host, or relay. Never print, paste, or commit the generated token.
2. Use the latest non-draft GitHub Release. Download its `celestial-potassium-mcp-v*-windows.zip` and matching `.sha256` asset from the official `mrketa/celestial-potassium-mcp` repository. Verify the ZIP with `Get-FileHash -Algorithm SHA256` before extracting it. Stop on any checksum mismatch.
3. Extract the release to a stable user-owned directory, not a temporary directory. Preserve any unrelated files and MCP server entries. Do not install from an unverified source archive.
4. Confirm Node.js 22 or newer and npm are available. If Node.js is missing or too old, install the official Node.js 22 LTS package using the normal Windows package manager; ask before any elevation. Do not substitute an unofficial binary.
5. Confirm Potassium is installed and has been started once. The default workspace is `%LOCALAPPDATA%\Potassium\workspace`. If it does not exist, ask me to start Potassium once, then continue. Do not invent another workspace path. Use `-WorkspaceRoot` only if I provide or you can verify a different Potassium workspace.
6. From the extracted release root, run `powershell -ExecutionPolicy Bypass -File .\tools\setup.ps1` with the verified workspace. This must install locked npm dependencies, create the local token and bounded configuration, deploy exactly the canonical bootstrap and autoexec scripts, run doctor, and generate the MCP launcher.
7. Run `npm --prefix potassium-mcp run doctor` again and inspect its JSON. Every check must have `ok: true`. Do not suppress failures. Report an ACL warning because it can weaken local token protection.
8. Register the generated `potassium` stdio server with the MCP client I am currently using. Preserve every existing MCP server entry. The server command must be `node`, its only argument must be the absolute path to `<install-root>\potassium-mcp\src\server.js`, and its timeout must be at least 30000 ms. For Oh My Pi, use or merge the generated `.omp\mcp.json` entry into the active project configuration. For another MCP host, use that host's documented local stdio configuration instead of guessing a format.
9. Reload or restart the MCP host after changing its configuration. If restarting ends this session, leave a concise handoff containing only the install path, MCP configuration path, completed checks, and the instruction: `Continue Potassium MCP live connection verification.` Do not include the token. Ask me to restart and send that instruction to the next session.
10. Ensure Roblox and Potassium are running with the executor attached after deployment so `potassium_mcp_autoexec.lua` executes. If user interaction is required, ask me only for that action and then continue. Do not add arbitrary auto-execution, input, teleport, remote, or gameplay code.
11. Once the tools are mounted, call `potassium_status`. Success requires `connected: true`; a running Node process alone is not success. Then call `potassium_capabilities`, `potassium_client_state`, and `potassium_list_children` with `path: "workspace"` and a bounded limit. Retry only after a concrete corrective action, never in an unbounded loop.
12. Finish with an evidence table covering: release tag, ZIP checksum match, stable install path, Node version, setup result, every doctor check, MCP configuration path, `potassium_status.connected`, capability response, client-state response, and workspace-list response. Clearly label anything that still requires user action. Never claim compatibility with every game or executor.

Treat the repository's README, SECURITY.md, AGENTS.md, and docs as authoritative. Do not weaken loopback, authentication, redaction, read-only boundaries, or bounded request limits to make a check pass.
```

## What “connected” means

Setup and `doctor` prove the local files and configuration. They do not prove that a live Potassium client has authenticated. The installation is complete only when the MCP host has reloaded the server and `potassium_status` reports `connected: true`. The remaining three calls verify that requests cross the complete MCP → local bridge → Potassium path in the current client.

Tool availability can still vary with the executor and game. A missing instance or unsupported executor capability is not an installation failure when the connection and generic workspace read succeed.
