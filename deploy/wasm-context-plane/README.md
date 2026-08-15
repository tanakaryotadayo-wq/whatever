# WASM target: Context Plane only

WASM is useful here, but not as the whole Akashic server.

Good WASM candidates:

- canonical JSON and content hashing
- JSON Schema validation
- Context candidate ranking
- known-set subtraction
- approximate token accounting
- deterministic ContextPacketDelta packing
- diff parsing and evidence normalization

Bad WASM candidates for the first implementation:

- long-lived Codex App Server or Claude Code processes
- process-group cancellation
- Git worktree management
- provider subscription login/session storage
- durable task/event authority

The intended boundary is:

```text
ChatGPT / A2A / MCP
        -> durable Kernel
        -> WASM Context Compiler library
        -> local/VM/container AgentPort
```

A later Rust/WASI package can share the deterministic compiler between Vercel,
Cloudflare, the browser/Sites preview, and local Python. v0.6 deliberately keeps
the Python compiler as the tested reference implementation.
