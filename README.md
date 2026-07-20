# `@llanesleonardo/saas-platform`

Reusable multi-tenant **SaaS chassis** (private GitHub Package). Product-agnostic.

## Exports (`0.3.0`)

| Export | Purpose |
|--------|---------|
| `.` / `./contracts` | Types (users, workspaces, jobs, keys, PlanSnapshot) |
| `./core` | Registries + `evaluateFeature` / `evaluateQuota` + job handlers |
| `./db` | `PlatformDatabaseAdapter` port + `createMemoryPlatformAdapter` |
| `./server` | Worker loop, API-key scope helpers, tenancy helpers |
| `./logging` | File + optional JSON stdout logger |
| `./secrets` | AES-GCM at-rest secret helpers (`SECRETS_ENCRYPTION_KEY`) |
| `./rate-limit` | In-memory token-bucket limiter |
| `./storage` | Local / Azure Blob / S3 object storage factory |
| `./security` | Trusted client IP + log redaction |

## Boot pattern (any product)

```ts
import { setPlatformConfig, registerApiKeyScopes, registerFeatures } from "@llanesleonardo/saas-platform";

setPlatformConfig({ productName: "AcmeCRM", apiKeyPrefix: "acme_" });
registerApiKeyScopes(["contacts:read"]);
registerFeatures(["pipelines"]);
```

## Env (storage)

Chassis `./storage` reads:

| Variable | Notes |
|----------|--------|
| `STORAGE_PROVIDER` | `local` (default) \| `azure` \| `s3` |
| `AZURE_STORAGE_ACCOUNT_NAME` | Required for azure |
| `AZURE_STORAGE_BLOB_ENDPOINT` | Optional; defaults to `https://<account>.blob.core.windows.net` |
| `AZURE_STORAGE_CONTAINER_UPLOADS` | Default `uploads` |
| `AZURE_STORAGE_CONTAINER_POLICIES` | Default `policies` |
| `AZURE_CLIENT_ID` | User-assigned managed identity |
| `AZURE_STORAGE_PUBLIC_URL` | Optional CDN base |
| `S3_ENDPOINT` / `S3_BUCKET` / `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | Required for s3 |
| `S3_PUBLIC_URL` / `S3_REGION` | Optional (`region` default `auto`) |

Optional peers: `@azure/storage-blob` + `@azure/identity`, or `@aws-sdk/client-s3`.

## Hard rules

No form/CRM types, no `@/` aliases, no Next in `contracts`/`core`.

## Publish

Tag `vX.Y.Z` matching `package.json` version.
