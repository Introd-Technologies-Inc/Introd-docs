# Moat Migration Audit

Date: 2026-05-26

Source: `https://gitlab.com/introd1/introd-platform.git`

Targets checked:

- `Introd-Technologies-Inc/introd-api`
- `Introd-Technologies-Inc/introd-extension`
- `Introd-Technologies-Inc/introd-web`
- `Introd-Technologies-Inc/introd-dashboard`

## Result

The extension runtime moat is migrated cleanly.

The following files matched the GitLab extension worktree exactly at audit time:

- `src/runtime/contracts.ts`
- `src/content/linkedin.ts`
- `src/content/linkedinSync.ts`
- `src/background/index.ts`
- `src/lib/api.ts`
- `src/lib/oauth.ts`
- `src/lib/messaging.ts`
- `src/sidebar/index.ts`
- `src/popup/index.ts`
- `manifest.json`

The backend moat code is already present in `introd-api`. Some GitLab files differ because GitHub has safer production corrections, including tenant-scoped `org_id` graph constraints and trust-aware path query filtering. Those GitHub versions should remain authoritative.

## Safe Moat Code Already In GitHub

- Graph provenance and weighted scoring: `server/services/graph/pathIntelligence.ts`
- Relationship memory and recommendations: `server/services/relationshipIntelligence.ts`
- Strategic relationship intelligence: `server/services/strategicRelationshipIntelligence.ts`
- Intro execution telemetry: `server/services/introExecution.ts`
- Network search scoring: `server/services/networkSearchScoring.ts`
- Extension sync API: `server/routes/extensionApi.ts`
- LinkedIn compatibility routes: `server/routes/extensionLinkedinCompat.ts`
- People and company search APIs: `server/routes/peopleSearchApi.ts`
- Tenant-scoped Neo4j schema: `graph/schema/constraints.cypher`
- Tenant-scoped search indexes: `graph/schema/search_indexes.cypher`
- Graph-intel service: `graph-intel/`

## Material Not Migrated As Code

These GitLab items were not migrated as code because they are stale, dashboard-bound, or conflict with the current split:

- old dashboard/client network setup helpers
- WhatsApp-agent graph tests tied to legacy communication flows
- old extension docs that mention Cortex, multi-browser overlays, or unsupported Chrome Store claims
- old pathfinding docs that describe shortest-path/BFS behavior without current provenance boundaries
- old deployment docs containing stale domains or old dashboard assumptions

## Material Migrated As Clean Documentation

Instead of copying stale docs verbatim, this PR adds GitHub-native docs for:

- edge provenance
- trust-aware pathfinding
- non-user warm intro targets
- relationship intelligence defensibility

## Production Position

If a target is not an Introd user, Introd can still produce a warm intro path only when the target exists in the requester's scoped graph with sufficient evidence-backed relationship paths.

If the target is unknown or evidence is weak, Introd must return low confidence or no path.

This is intentional. It protects the product from fake trust and keeps the moat defensible.

## Fast-Track Migration Gate

Future GitLab migration work should accelerate production readiness, not reopen the monorepo.

Migrate only when all of the following are true:

- The artifact belongs to API/backend, graph intelligence, sync ingestion, or the Chrome extension.
- It improves production readiness, correctness, reliability, security, or test coverage.
- It does not reintroduce the legacy dashboard, old marketing site, stale domains, or broad public claims.
- It can be reviewed in a small PR with clear validation.
- GitHub does not already contain a newer or safer implementation.

Do not migrate:

- Legacy dashboard/client code.
- Marketing-site artifacts.
- Old docs that describe shortest-path behavior, synthetic inference, or unsupported claims.
- Large files or directories without a specific production use.
- Anything that increases scope without reducing launch risk.

If a GitLab artifact is useful but stale, rewrite it as a small GitHub-native contract or test instead of copying it verbatim.
