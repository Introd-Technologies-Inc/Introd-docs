# Phase 2 Rollback Point

Release: `v0.9.0-phase2`
Recorded: 2026-06-06

This document records the production rollback point for the Phase 2 freeze.

## Component Commits

| Component | Commit |
| --- | --- |
| `introd-api` Phase 2 code freeze | `2fa191f` |
| `introd-dashboard` Phase 2 code freeze | `7e641ca` |
| `introd-extension` Phase 2 code freeze | `a2e95c6` |

## Production Deployment Artifacts

| Artifact | Value |
| --- | --- |
| API image | `introd-api:431d120-graph-sharing-phase2b3` |
| API deployed | 2026-06-06 12:55 CT |
| API health | `healthy` |
| Dashboard Worker version | `0295c234-c3df-4ee7-a438-87f3edb1da86` |
| Dashboard deployed | 2026-06-06 12:58 CT |
| Dashboard route | `app.getintrod.ai/*` |
| Neo4j migration level | through `005_add_graph_sharing_visibility.cypher` |

## Rollback Procedure

1. API rollback: run the previous `introd-api-prev-*` container or redeploy `introd-api:431d120-graph-sharing-phase2b3` if the goal is to return to the Phase 2 frozen image.
2. Dashboard rollback: use Cloudflare Workers deployment rollback to version `0295c234-c3df-4ee7-a438-87f3edb1da86`.
3. Code rollback: checkout tag `v0.9.0-phase2` in each repository after the release tag is created.
4. Neo4j rollback: do not drop schema or visibility properties. Existing migration `005_add_graph_sharing_visibility.cypher` is additive and idempotent.

## Data Safety Notes

- Relationship visibility defaults to private for existing users.
- The Phase 2 graph-sharing activation stores aggregate visibility and evidence metadata only.
- Microsoft evidence is metadata-only and does not include email bodies or calendar bodies.
- Neo4j migration rollback is not recommended because the schema/index changes are additive.

## Validation At Freeze

| Check | Result |
| --- | --- |
| API `npm test` | passed, 81 tests |
| API `npm run build` | passed |
| Dashboard `npm test` | passed, 16 tests |
| Dashboard `npm run build` | passed |
| Extension `npm test` | passed, 24 tests |
| Extension `npm run build` | passed |
| Extension `npm run typecheck` | passed |
