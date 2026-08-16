# Codex Hosted Provider Probe

This bounded probe runs the official Codex App Server certification on GitHub-hosted macOS only when the repository already contains an `OPENAI_API_KEY` Actions secret. The secret is never emitted. A missing secret produces a machine-readable BLOCKED evidence record rather than a false PASS.
