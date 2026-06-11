# Edge Provenance

Introd's moat depends on whether the graph can distinguish a real relationship from a convenient inference.

A relationship edge is only useful when the system knows where it came from, how confident it is, and whether it is safe to use as introduction evidence.

## Runtime Contract

The backend path scorer models provenance through `RelationshipEdgeProvenance` in `server/services/graph/pathIntelligence.ts`.

```ts
type RelationshipProvenanceSource =
  | "linkedin_import"
  | "email_interaction"
  | "calendar_overlap"
  | "manual_confirmation"
  | "intro_history"
  | "unknown";

type RelationshipVerificationType =
  | "verified"
  | "observed"
  | "imported"
  | "inferred";
```

Each edge must resolve to:

- `source`: where the evidence came from.
- `confidence`: normalized confidence from `0` to `1`.
- `evidence`: short explainability lines shown to the user or used in diagnostics.
- `inferred`: whether the relationship is inferred rather than verified or observed.
- `verificationType`: whether this is verified, observed, imported, or inferred.

## Evidence Priority

Strongest evidence:

- `manual_confirmation`: a person explicitly confirmed the relationship.
- `intro_history`: an intro was requested, accepted, completed, or otherwise progressed.
- `email_interaction`: communication history exists.
- `linkedin_import`: first-degree LinkedIn import exists.

Weaker evidence:

- `calendar_overlap`: people appeared in the same meeting or event, but the relationship may be weaker than direct communication.
- `unknown`: the system lacks enough metadata to verify the edge.

## Inferred Edges

Inferred edges are allowed as signals, but not as fake trust.

Allowed:

- Show as low-confidence context.
- Use in weak-link diagnostics.
- Use to suggest "warm this route first" actions.

Not allowed:

- Treat inferred edges as equivalent to verified edges.
- Use same-company or shared-tag inference as proof of relationship.
- Inflate a route into a high-confidence warm intro path.

## Scoring Implications

`scoreEdgeQuality()` combines:

- relationship strength
- provenance confidence
- freshness
- interaction evidence
- provenance weight
- inferred-edge penalty

This means a shorter path with weak evidence should lose to a longer path with stronger trust evidence.

## Production Rule

If the graph cannot prove a route, Introd should say so clearly.

Correct behavior:

> We do not have enough verified relationship evidence to recommend a warm intro path yet.

Incorrect behavior:

> Here is a warm path because two people worked at the same company.

