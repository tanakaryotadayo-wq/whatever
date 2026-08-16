# ADR-0006 — Google Drive Immutable Artifact Adapter and Mailbox Projection

Status: ACCEPTED FOR v0.8 RC  
Date: 2026-08-16  
Packet: KPK-010

## Decision

Use Google Drive API v3 through Google's official `@googleapis/drive` Node.js client. Drive remains an Artifact / Context / Evidence / Handoff plane and never becomes Workflow or Queue Authority.

## Imported mechanisms

- `appProperties` as the private, searchable metadata index for digest, task, kind and projection identity.
- Content-addressed names and SHA-256/size verification before upload.
- Staging-folder upload followed by one metadata/parent update into the immutable artifact folder.
- Resumable upload sessions for payloads at or above 5 MiB.
- Bounded exponential backoff for 429, retryable 403 reasons and 5xx errors.
- `changes.getStartPageToken` plus paged `changes.list` for observer refresh.
- Mutable task-status projections with monotonically increasing `state_seq`.
- Write-once mailbox envelopes in `inbox`, `outbox`, `receipts` and `dead_letter`; no file-move claim protocol.

## Authority boundary

```text
Temporal / selected Workflow backend = state authority
Drive immutable object + projection  = bytes and rebuildable read model
Drive mailbox envelope               = offline handoff / interoperability
                                    != queue lease / execution ownership
```

Deleting every Drive projection must not destroy or alter a Task. A projection can be rebuilt from Workflow state and ArtifactRefs.

## Idempotency and races

`appProperties` does not provide a uniqueness constraint. Logical exactly-once-like adoption remains protected by the Akashic Effect Ledger and fencing checks. Digest lookup makes repeated Drive storage harmless; duplicate physical files are a storage concern, not a second Task state.

## Authentication

Production uses OAuth or Application Default Credentials. Credential JSON and refresh tokens are never committed. The live acceptance gate is explicit and fail-closed:

```bash
AKASHIC_DRIVE_LIVE=1 npm run test:live -w @akashic/drive-adapter
```

## Evidence sources

- Google Drive API v3 custom properties and custom-property search.
- Google Drive API v3 resumable upload protocol.
- Google Drive Changes API and retry/error guidance.
- Google-maintained `@googleapis/drive` package, pinned to `20.2.0`.
