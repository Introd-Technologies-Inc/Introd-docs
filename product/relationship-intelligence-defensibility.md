# Relationship Intelligence Defensibility

Introd is defensible when it behaves like relationship intelligence infrastructure, not a LinkedIn utility.

This document defines what the product should and should not claim.

## The Moat

The moat is not importing contacts.

The moat is turning evidence-backed relationship data into strategic decisions:

- who can unlock a goal
- which connector is reliable
- whether a relationship is fresh or decaying
- why a path is strong or weak
- whether an intro should happen now or after warming
- which mission a relationship advances
- what hidden opportunity emerged from graph movement

## Core Intelligence Systems

Current GitHub code already contains the core moat systems:

- `server/services/graph/pathIntelligence.ts`: edge provenance, weighted path scoring, weak-link diagnostics.
- `server/services/relationshipIntelligence.ts`: connector memory, company memory, relationship freshness, decay, recommendations.
- `server/services/strategicRelationshipIntelligence.ts`: mission alignment, opportunity radar, timeline, strategic guidance.
- `server/services/introExecution.ts`: intro lifecycle and connector execution evidence.
- `server/routes/extensionApi.ts`: LinkedIn sync ingestion, dedupe, change tracking, and status APIs.
- `graph-intel/`: Neo4j-powered TrustRank, pathfinding, and network search.

## Product Boundary

Introd is:

- relationship intelligence infrastructure
- a trust graph
- a warm introduction operating system
- a strategic relationship decision layer

Introd is not:

- a CRM clone
- a bulk outreach tool
- a generic LinkedIn sidebar
- a growth automation product
- a scraper that implies access to everyone

## Registered vs Non-Registered People

A person does not need to be an Introd user to appear in a warm intro path.

The person must be present in the requester's scoped graph with enough evidence to evaluate the route.

Registered Introd users add more data and consented relationship context, but registration is not the only way a `Person` node exists.

Examples of valid target representation:

- imported LinkedIn first-degree connection
- prior intro target
- contact from user-authorized sources
- observed email interaction
- manually confirmed relationship
- future approved enrichment source with clear provenance

If the target is unknown, Introd should not manufacture a path.

## Evidence Discipline

Every recommendation should answer:

- Why this person?
- Why this connector?
- Why now?
- What evidence supports this route?
- What is weak or missing?
- What should the user do next?

If confidence is weak, the product must say confidence is weak.

## Chrome Store and Public Claims

Do not market unreproducible claims in Chrome Store copy.

Safe claims:

- LinkedIn connection sync
- warm intro context
- sync status
- privacy and sync controls

Avoid broad claims unless the reviewer can reproduce the behavior immediately.

## Engineering Rule

When choosing between a flashy feature and a truthful confidence boundary, choose the confidence boundary.

Trust is the product.

