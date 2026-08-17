import assert from "node:assert/strict";
import test from "node:test";

import {
  EXPECTED_PRODUCTION_GIT_SOURCE,
  extractGitSourcesFromHtml,
  productionGitSourceFindings,
} from "./source-provenance.mjs";

const STALE_API_SOURCE = {
  type: "github",
  owner: "introd-technologies-inc",
  repo: "introd-api",
  deployBranch: "docs/getintrod-mintlify-portal",
  contentDirectory: "docs",
};

function flightHtml(...sources) {
  return sources
    .map((source, index) => {
      const payload = JSON.stringify({ value: { gitSource: source } });
      return `<script>self.__next_f.push([${index + 1},${JSON.stringify(payload)}])</script>`;
    })
    .join("");
}

test("accepts the dedicated introd-docs main branch at repository root", () => {
  const html = flightHtml(EXPECTED_PRODUCTION_GIT_SOURCE);

  assert.deepEqual(extractGitSourcesFromHtml(html), [EXPECTED_PRODUCTION_GIT_SOURCE]);
  assert.deepEqual(productionGitSourceFindings(html), []);
});

test("rejects the legacy introd-api docs source with precise mismatches", () => {
  const findings = productionGitSourceFindings(flightHtml(STALE_API_SOURCE));

  assert.equal(findings.length, 1);
  assert.match(findings[0], /repo, deployBranch, contentDirectory mismatch/);
  assert.match(findings[0], /repo=introd-api/);
  assert.match(findings[0], /repo=introd-docs/);
  assert.match(findings[0], /contentDirectory=<repository root>/);
});

test("rejects a homepage without serialized Git source metadata", () => {
  assert.deepEqual(productionGitSourceFindings("<html><body>Introd</body></html>"), [
    "serialized production gitSource metadata is missing",
  ]);
});

test("rejects conflicting serialized Git sources", () => {
  const findings = productionGitSourceFindings(
    flightHtml(EXPECTED_PRODUCTION_GIT_SOURCE, STALE_API_SOURCE),
  );

  assert.equal(findings.length, 1);
  assert.match(findings[0], /multiple Git sources/);
  assert.match(findings[0], /repo=introd-docs/);
  assert.match(findings[0], /repo=introd-api/);
});
