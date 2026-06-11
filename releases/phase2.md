# Introd Phase 2 Release Notes

Release: `v0.9.0-phase2`
Release date: 2026-06-06
Status: frozen

Phase 2 establishes the production relationship-intelligence foundation for Introd. It brings Neo4j, canonical identity resolution, Microsoft metadata evidence, warm-path ranking, privacy-safe graph sharing, and the dashboard Relationship Intelligence experience into one production release.

## Identity Layer

- Deployed the production Neo4j trust graph.
- Added `PersonIdentity` as the canonical identity layer for profile/contact resolution.
- Added duplicate resolution through `REPRESENTS` relationships.
- Activated `HAS_CONTACT` traversal through `PersonIdentity`.
- Verified global person canonicalization coverage at 100%.

## Microsoft Evidence

- Activated Microsoft Graph OAuth for Outlook Email and Outlook Calendar.
- Ingested metadata only. No email body or calendar body content is stored or exposed.
- Created relationship evidence edges:
  - `COMMUNICATED_WITH`
  - `REPLIED_TO`
  - `MET`
  - `ATTENDED_MEETING`
- Connected dashboard Outlook controls to production OAuth, sync, status, and disconnect flows.

## Relationship Evidence

- Preserved LinkedIn relationship evidence.
- Added Microsoft email/calendar aggregate evidence onto graph contact relationships.
- Added evidence counts and relationship timestamps to canonical contact edges.
- Stored only aggregate relationship metadata for graph intelligence.

## Warm Path Intelligence

- Added Warm Path Ranking v2 using graph path evidence rather than raw LinkedIn mutual-count ordering.
- Added graph-confidence and path-strength inputs from relationship evidence.
- Added evidence chip support from relationship facts including LinkedIn, email metadata, and meeting metadata.
- Prevented invalid introducers, including target-as-introducer and current-user-as-introducer cases.

## Graph Sharing

- Added relationship visibility levels:
  - `private`
  - `team`
  - `community`
  - `public_intro`
- Added user graph-sharing preferences:
  - Private
  - Organization Only
  - Trusted Community
  - Public Warm Intros
- Added workspace graph sharing through `SHARES_WITH`.
- Added community sharing foundations through `MEMBER_OF` and `COMMUNITY_VISIBLE`.
- Added `calculateUnlockedWarmPaths()` to compute latent, available, and locked warm paths.

## Privacy Controls

- Existing users default to private relationship visibility.
- Shared traversal never exposes raw email content, calendar content, private notes, or private metadata.
- Share-safe responses expose only connector identity, aggregate evidence categories, relationship strength, and confidence.
- Graph sharing requires explicit opt-in.

## Dashboard Features

- Added Relationship Intelligence dashboard route: `/relationship-intelligence`.
- Added graph-sharing settings controls.
- Added available, potential, locked, and recommended unlock states.
- Added community-overlap and graph-readiness metrics.
- Added Outlook Email and Calendar connection status, sync status, last synced time, and evidence counts.

## Production Snapshot

- API image: `introd-api:431d120-graph-sharing-phase2b3`
- API status: healthy
- Dashboard deployment: Cloudflare Workers version `0295c234-c3df-4ee7-a438-87f3edb1da86`
- Neo4j migration level: schema setup plus graph migrations through `005_add_graph_sharing_visibility.cypher`
- Neo4j migration tracking: file-based/idempotent Cypher; no migration tracking table

## Before / After Metrics

Before graph sharing activation:

| Metric | Value |
| --- | ---: |
| Latent shared overlaps | 3,242 |
| Share-safe overlaps | 0 |

After Phase 2 finalization:

| Metric | Value |
| --- | ---: |
| Nodes | 14,817 |
| Relationships | 31,220 |
| PersonIdentity nodes | 5,400 |
| Duplicate identity groups | 1,609 |
| People in duplicate groups | 4,860 |
| Canonicalization coverage | 100% |
| `COMMUNICATED_WITH` | 134 |
| `REPLIED_TO` | 15 |
| `MET` | 4 |
| `ATTENDED_MEETING` | 8 |
| Latent overlaps | 9,887 |
| Share-safe overlaps | 3,242 |
| Locked overlaps | 6,645 |
| Warm-path candidates | 3,242 |
| Community overlap potential | 2,327 |
| Average connector count | 1 |
| Average path length | 2 |
| Average share-safe graph confidence | 0.652 |
| Average share-safe relationship strength | 0.741 |

## Known Limits

- Founder, investor, operator, and advisor labeling remains sparse in the current graph and should be expanded in Phase 3 enrichment work.
- Google/Gmail/Google Calendar/Google Contacts are explicitly out of scope for this release.
- Share-safe warm paths increase only after users opt into graph sharing; private remains the default.

## Readiness Assessment

| Area | Score |
| --- | ---: |
| Neo4j | 9.0/10 |
| Identity | 9.0/10 |
| Microsoft | 8.5/10 |
| Warm Paths | 8.5/10 |
| Graph Sharing | 8.4/10 |
| Dashboard | 8.3/10 |
| Overall Production Readiness | 8.6/10 |
