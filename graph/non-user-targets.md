# Non-User Targets and Warm Intros

This answers a recurring product question:

> If someone is not an Introd user, can I still get a warm intro path to them?

## Short Answer

Yes, if the target exists as a person in the requester's trusted graph or can be safely resolved into that graph.

No, if Introd has no verified, imported, or observed evidence that connects the requester to that target.

The target does not need to have an Introd account. The target does need to be represented as a graph `Person` node or resolvable from trusted network data.

## What "Not In Introd" Means

There are three different cases:

1. The target is not a registered Introd account holder.
2. The target is not in the requester's imported or enriched network.
3. The target is completely unknown to Introd.

Only case 1 can still produce warm intro paths.

Cases 2 and 3 should not produce confident warm intro claims.

## When A Warm Intro Can Work

Warm intro paths can work when:

- The requester has synced their LinkedIn first-degree network.
- The target appears in the requester's graph through LinkedIn import, contact data, intro history, email interaction, calendar context, or future approved enrichment.
- The graph has evidence-backed edges between the requester, connectors, and the target.
- The path passes trust-aware scoring and weak-link checks.

In this case, Introd can recommend:

- who can unlock the route
- why that connector matters
- how strong the evidence is
- whether to ask now or warm the relationship first

## When A Warm Intro Should Not Be Claimed

Introd should not claim a warm intro when:

- The target is only known by name.
- The target only shares a company, school, tag, or industry with someone.
- There is no verified edge between the requester and a connector.
- There is no evidence-backed route from the connector to the target.
- The path is inferred and confidence is weak.

In those cases, Introd should say:

> We found a potentially relevant person, but we do not have enough verified relationship evidence to recommend a warm intro path yet.

## Product Language

Use:

- "No verified warm path yet."
- "Low confidence route."
- "Warm this connector before asking."
- "Target found, but relationship evidence is limited."

Avoid:

- "Guaranteed intro."
- "Best path" when confidence is weak.
- "Warm intro available" when the graph only has inferred context.

## Why This Is Defensible

This makes Introd stronger than a generic LinkedIn extension because the product is not claiming access to everyone.

The moat is:

- evidence-backed relationship memory
- connector reliability
- intro history
- path confidence
- weak-link diagnostics
- strategic timing guidance

Not:

- a list of people scraped from LinkedIn
- inferred company overlap
- bulk outreach
- social graph vanity metrics

