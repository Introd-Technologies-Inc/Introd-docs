import assert from "node:assert/strict";
import test from "node:test";

import {
  embeddedCustomAssetFindings,
  embeddedCustomAssetsFromHtml,
  forbiddenHomeControlFindings,
  isRetryableLiveResponse,
  isVercelSecurityCheckpoint,
  liveRetryDelayMs,
} from "./live-gate-helpers.mjs";

function flightChunk(payload) {
  return `<script>self.__next_f.push([1,${JSON.stringify(payload)}])</script>`;
}

function embeddedAssetHtml({ css = "body { color: green; }\n", js = "(() => true)();\n" } = {}) {
  return [
    flightChunk("50:T16,"),
    flightChunk(css),
    flightChunk(
      '39:["$","style",null,{"data-custom-css-path":"intercom-support.css","dangerouslySetInnerHTML":{"__html":"$50"}}]',
    ),
    flightChunk("59:T12,"),
    flightChunk(js),
    flightChunk(
      '51:["$",null,null,{"jsFiles":[{"filePath":"intercom-support.js","content":"$59"}]}]',
    ),
  ].join("");
}

test("extracts Mintlify custom JS and CSS from bound Flight text records", () => {
  const assets = embeddedCustomAssetsFromHtml(embeddedAssetHtml());

  assert.equal(assets.get("intercom-support.js")?.[0]?.content, "(() => true)();\n");
  assert.equal(assets.get("intercom-support.css")?.[0]?.content, "body { color: green; }\n");
});

test("accepts exact embedded assets with newline normalization", () => {
  const expected = new Map([
    ["/intercom-support.js", "(() => true)();\r\n"],
    ["/intercom-support.css", "body { color: green; }\r\n"],
  ]);

  assert.deepEqual(embeddedCustomAssetFindings(embeddedAssetHtml(), expected), []);
});

test("rejects a stale embedded custom asset", () => {
  const expected = new Map([["/intercom-support.js", "different();\n"]]);

  assert.deepEqual(embeddedCustomAssetFindings(embeddedAssetHtml(), expected), [
    {
      path: "/intercom-support.js",
      message: "embedded custom asset does not match the tracked release asset",
    },
  ]);
});

test("rejects missing and conflicting embedded assets", () => {
  const expected = new Map([
    ["/intercom-support.js", "(() => true)();\n"],
    ["/missing.css", "body {}\n"],
  ]);
  const conflictingHtml = `${embeddedAssetHtml()}${flightChunk("60:T11,")}${flightChunk(
    "stale();\n",
  )}${flightChunk(
    '61:["$",null,null,{"jsFiles":[{"filePath":"intercom-support.js","content":"$60"}]}]',
  )}`;

  assert.deepEqual(embeddedCustomAssetFindings(conflictingHtml, expected), [
    {
      path: "/intercom-support.js",
      message: "embedded custom asset has conflicting payloads",
    },
    { path: "/missing.css", message: "embedded custom asset declaration is missing" },
  ]);
});

test("detects enabled Mintlify AI-facing controls on the homepage", () => {
  const html = [
    '<button id="page-context-menu-button">Copy page</button>',
    '<textarea id="chat-assistant-textarea" placeholder="Ask a question..."></textarea>',
  ].join("");

  assert.deepEqual(forbiddenHomeControlFindings(html), [
    {
      name: "Mintlify contextual page-actions menu",
      message: "unexpected AI-facing control is enabled",
    },
    {
      name: "Mintlify documentation assistant",
      message: "unexpected AI-facing control is enabled",
    },
  ]);
  assert.deepEqual(forbiddenHomeControlFindings("<main>Customer documentation</main>"), []);
});

test("retries only transient responses and the exact Vercel checkpoint", () => {
  const checkpoint = "<html><title>Vercel Security Checkpoint</title></html>";

  assert.equal(isVercelSecurityCheckpoint(403, checkpoint), true);
  assert.equal(isVercelSecurityCheckpoint(403, "ordinary forbidden"), false);
  assert.equal(isRetryableLiveResponse(403, checkpoint), true);
  assert.equal(isRetryableLiveResponse(403, "ordinary forbidden"), false);
  assert.equal(isRetryableLiveResponse(429, "rate limited"), true);
  assert.equal(isRetryableLiveResponse(404, "missing"), false);
  assert.equal(liveRetryDelayMs(403, checkpoint, 0), 5_000);
  assert.equal(liveRetryDelayMs(503, "unavailable", 1), 2_000);
});
