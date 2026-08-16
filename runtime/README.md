# Runtime configuration boundary

This directory contains non-secret runtime templates only. Live credentials, subscription sessions, TLS keys, Google ADC files and provider configuration remain outside Git and are injected by the deployment environment.

Canonical runtime roles:

- `temporal/`: Workflow/Activity Worker and control-server templates.
- `gateway/`: Vercel environment contract.
- `workers/`: self-hosted Codex/Claude/local worker contract.
- `drive/`: folder-role and acceptance configuration examples.

Google Drive also has a top-level `runtime/` folder for environment-specific manifests and deployment evidence. GitHub keeps portable templates; Drive keeps deployment-instance values.
