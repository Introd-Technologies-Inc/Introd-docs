# Trust-Aware Pathfinding

Introd should optimize for the highest probability of a successful introduction, not the fewest hops.

The legacy GitLab docs described BFS/shortest-path style traversal. That is not the production principle. GitHub now preserves the safer direction: trust-aware path scoring, provenance checks, weak-link diagnostics, and tenant-scoped graph queries.

## Ranking Principle

A path is only useful if the connector is likely to help and the route can be explained.

The scorer favors:

- evidence-backed relationship edges
- higher connector trust
- relationship freshness
- recent interaction history
- intro-history evidence
- stronger first-hop connector quality
- fewer weak links
- clearer explainability

The scorer penalizes:

- inferred edges
- stale relationships
- low-confidence evidence
- little interaction history
- excessive hops
- unknown provenance

## Why Shortest Path Is Wrong

A weak two-hop path can be worse than a trusted three-hop path.

Example:

- Weak 2-hop route: imported LinkedIn edge plus unknown connector relationship.
- Strong 3-hop route: prior intro history, recent email interaction, and a manually confirmed connector.

The second path should rank higher because it is more likely to produce a real introduction.

## Backend Implementation

Primary scoring file:

- `server/services/graph/pathIntelligence.ts`

Key outputs:

- `path_score`: route quality score.
- `path_confidence`: confidence in the complete path.
- `weakest_link_score`: lowest quality relationship in the path.
- `weak_link_penalty`: penalty applied when one relationship is weak.
- `freshness_score`: relationship freshness across the route.
- `avg_node_trust`: average trust quality of people in the route.
- `explainability`: evidence lines explaining the route.
- `weak_link_diagnostics`: warnings explaining weak confidence.

Graph query service:

- `graph-intel/app/pathfinder.py`

Graph-intel must keep queries tenant-scoped with `org_id`, must filter out unsafe inferred edges, and must rank by relationship confidence before hop count.

## Result Semantics

High confidence means:

- Introd has verified or observed evidence for the route.
- The route has no severe weak link.
- The connector relationship is fresh or historically reliable.

Low confidence means:

- The route may be relevant, but the graph cannot prove trust strongly enough.
- The user should nurture, verify, or add context before asking for an intro.

No result means:

- The target is not represented in the user's scoped graph.
- Or no path has enough evidence to recommend responsibly.

## Production Rule

Never hide weak evidence behind confident product language.

The product should say:

> This route is possible, but confidence is limited because the connector relationship is stale.

Not:

> Best warm intro path.

