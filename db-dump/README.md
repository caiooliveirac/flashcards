# Database dump: `polyglot_db`

Generated on 2026-05-28T14:12:18Z before archiving this application.

## Contents
- `polyglot_db.sql.gz` — full pg_dump (gzipped), generated with:
  ```bash
  pg_dump -p 5432 -d polyglot_db --clean --if-exists --no-owner --no-privileges | gzip -9
  ```

## Row counts at dump time
- LangBloco: 5175 (AI-generated language blocks)
- GenerationBatch: 1244
- GenerationJob: 301
- ChunkRegistry: 229
- Card: 207
- GrammarModule: 104
- Review: 3


## Restore
```bash
createdb polyglot_db
gunzip -c polyglot_db.sql.gz | psql -d polyglot_db
```

Or in one shot (PostgreSQL must already have the target user/db):
```bash
gunzip -c polyglot_db.sql.gz | psql -d polyglot_db
```
