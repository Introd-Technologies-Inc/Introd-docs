# Core Infrastructure Migration Manifest

Date: 2026-05-26

Source: `https://gitlab.com/introd1/introd-platform.git`

Target: `https://github.com/Introd-Technologies-Inc/introd-api`

## Included

- `server/`: Express API, auth/session handling, extension API routes, graph services, intelligence services, observability, storage, and operational scripts.
- `shared/`: Drizzle schema and shared API/domain types required by the backend.
- `tests/`: Backend, security, graph, extension API, and intelligence tests that validate production API behavior.
- `graph/`: Neo4j schema, migrations, seed utilities, and TrustRank Cypher assets.
- `graph-intel/`: Python FastAPI graph intelligence service for TrustRank, pathfinding, and network search.
- Root API runtime files: `package.json`, `package-lock.json`, `tsconfig.json`, `vitest.config.ts`, `drizzle.config.ts`, `Dockerfile`, `docker-compose.yml`, `.gitignore`, `.dockerignore`, and `.env.example`.

## Excluded

- `client/`: legacy GitLab dashboard and marketing UI. The active dashboard is `Introd-Technologies-Inc/introd-dashboard`.
- `extensions/chrome/`: Chrome extension source. The active extension is `Introd-Technologies-Inc/introd-extension`.
- Local-only runtime artifacts such as `.env`, logs, browser profiles, screenshots, CRX/PEM files, and build outputs.
- Legacy demo/mockup folders and non-runtime workspace artifacts.

## Production Corrections Applied

- Neo4j identity is tenant-scoped with composite `(org_id, id)` constraints.
- Graph ingestion now merges `Person` nodes by `(id, org_id)` instead of globally by `id`.
- Root graph search/scoring indexes are tenant-scoped.
- `graph-intel` requests and queries include `org_id` boundaries.
- API Docker build no longer depends on a missing frontend-style `dist` output.
- Local compose uses non-TLS Redis for the local Valkey container and includes a runnable `graph-intel` service.

## Guardrails

- Do not migrate or serve the legacy dashboard from this repo.
- Keep Introd production domains on `.ai`.
- Do not add unrelated product references, third-party mail routing domains, or production secrets.
- Treat LinkedIn sync and relationship graph data as user-scoped PII.
