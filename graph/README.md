# Introd Graph Intelligence

This directory documents the defensible graph layer in `introd-api`.

Introd's graph is not a social graph viewer. It is an evidence-backed trust graph for finding and explaining warm introduction routes.

## Core Docs

- `edge-provenance.md`: how relationship edges are verified, scored, and constrained.
- `trust-aware-pathfinding.md`: how paths are ranked by probability of successful introduction, not shortest distance.
- `non-user-targets.md`: how warm intros work when the target is not an Introd user.

## Current Runtime Assets

- `graph/schema/constraints.cypher`: tenant-scoped Neo4j constraints and relationship indexes.
- `graph/schema/search_indexes.cypher`: tenant-scoped search and scoring indexes.
- `graph/trustrank/neo4j_gds_trustrank.cypher`: TrustRank computation assets.
- `graph-intel/app/pathfinder.py`: graph-intel path query service.
- `server/services/graph/pathIntelligence.ts`: backend path scoring, provenance, weak-link diagnostics, and explainability.
- `server/services/relationshipIntelligence.ts`: connector memory, company memory, relationship freshness, decay, and recommendations.
- `server/services/strategicRelationshipIntelligence.ts`: mission alignment, opportunity radar, timeline, and strategic guidance.

## Non-Negotiable Graph Rules

- Do not fabricate warm intro paths.
- Do not treat same-company, shared-tag, or shared-context inference as verified trust.
- Every path must be scoped to the requesting user or organization.
- Every edge must carry provenance, confidence, and explainability metadata where available.
- Low evidence must produce low confidence or no path.
- The product should explain why a route is strong, weak, stale, or unavailable.

