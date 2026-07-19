# Bridge note

Existing databases already applied `000_postgres_baseline` and versioned files
from the PeopleForms app. Future platform-owned DDL must use new ids such as:

- `platform_001_usage_metrics_json`
- `platform_002_job_resource_columns`

The migrate runner applies platform ids first, then product version ids.
