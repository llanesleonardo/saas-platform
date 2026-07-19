# `@llanesleonardo/saas-platform`

Reusable multi-tenant **SaaS chassis** (private GitHub Package). Product-agnostic.

## Exports (`0.2.0`)

| Export | Purpose |
|--------|---------|
| `.` / `./contracts` | Types (users, workspaces, jobs, keys, PlanSnapshot) |
| `./core` | Registries + `evaluateFeature` / `evaluateQuota` + job handlers |
| `./db` | `PlatformDatabaseAdapter` port + `createMemoryPlatformAdapter` |
| `./server` | Worker loop, API-key scope helpers, tenancy helpers |

## Boot pattern (any product)

```ts
import { setPlatformConfig, registerApiKeyScopes, registerFeatures } from "@llanesleonardo/saas-platform";

setPlatformConfig({ productName: "AcmeCRM", apiKeyPrefix: "acme_" });
registerApiKeyScopes(["contacts:read"]);
registerFeatures(["pipelines"]);
```

## Hard rules

No form/CRM types, no `@/` aliases, no Next in `contracts`/`core`.

## Publish

Tag `vX.Y.Z` matching `package.json` version.
