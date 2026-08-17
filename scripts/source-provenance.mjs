const FLIGHT_CHUNK_PATTERN =
  /self\.__next_f\.push\(\[\d+\s*,\s*("(?:\\.|[^"\\])*")\s*\]\)/g;
const GIT_SOURCE_PATTERN = /"gitSource"\s*:\s*(\{[^{}]*\})/g;

export const EXPECTED_PRODUCTION_GIT_SOURCE = Object.freeze({
  type: "github",
  owner: "introd-technologies-inc",
  repo: "introd-docs",
  deployBranch: "main",
  contentDirectory: "",
});

const PROVENANCE_FIELDS = Object.keys(EXPECTED_PRODUCTION_GIT_SOURCE);

function provenanceShape(source) {
  return Object.fromEntries(PROVENANCE_FIELDS.map((field) => [field, source?.[field]]));
}

function formatSource(source) {
  return PROVENANCE_FIELDS.map((field) => {
    const value = source?.[field];
    const displayValue = field === "contentDirectory" && value === "" ? "<repository root>" : String(value);
    return `${field}=${displayValue}`;
  }).join(", ");
}

export function extractGitSourcesFromHtml(html) {
  const payloads = [html];

  for (const match of html.matchAll(FLIGHT_CHUNK_PATTERN)) {
    try {
      payloads.push(JSON.parse(match[1]));
    } catch {
      // Other checks cover malformed HTML. Ignore Flight chunks that are not
      // valid JSON strings and report missing provenance if none can be read.
    }
  }

  const sourcesByProvenance = new Map();
  for (const payload of payloads) {
    for (const match of payload.matchAll(GIT_SOURCE_PATTERN)) {
      try {
        const source = provenanceShape(JSON.parse(match[1]));
        sourcesByProvenance.set(JSON.stringify(source), source);
      } catch {
        // A malformed candidate is not authoritative source metadata.
      }
    }
  }

  return [...sourcesByProvenance.values()];
}

export function productionGitSourceFindings(html) {
  const sources = extractGitSourcesFromHtml(html);

  if (sources.length === 0) {
    return ["serialized production gitSource metadata is missing"];
  }

  if (sources.length > 1) {
    return [`serialized homepage exposes multiple Git sources: ${sources.map(formatSource).join(" | ")}`];
  }

  const actual = sources[0];
  const mismatchedFields = PROVENANCE_FIELDS.filter(
    (field) => actual[field] !== EXPECTED_PRODUCTION_GIT_SOURCE[field],
  );
  if (mismatchedFields.length === 0) return [];

  return [
    `unexpected production Git source (${mismatchedFields.join(", ")} mismatch): ` +
      `${formatSource(actual)}; expected ${formatSource(EXPECTED_PRODUCTION_GIT_SOURCE)}`,
  ];
}
