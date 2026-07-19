# Platform migrations

Own tables: users, sessions, workspaces, workspace_members, workspace_invites,
api_keys, audit_events, usage_counters, job_outbox, referral_*.

## Ordering

1. Apply files in this directory (platform)
2. Apply product migrations under `apps/people-forms/src/lib/db/migrations/`

Historical `001`–`003` product/version files remain in the PeopleForms app ledger
and must not be rewritten. New platform-only changes use `platform_NNN_*.sql` ids
in the shared `schema_migrations` table.
