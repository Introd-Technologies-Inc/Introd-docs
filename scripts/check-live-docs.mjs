#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import process from "node:process";

import { productionGitSourceFindings } from "./source-provenance.mjs";

const BASE_URL = new URL(process.env.DOCS_BASE_URL || "https://docs.getintrod.ai");
const REQUEST_TIMEOUT_MS = 20_000;
const REQUEST_CONCURRENCY = 12;
const MAX_REPORTED_FINDINGS = Number.parseInt(process.env.DOCS_MAX_FINDINGS || "0", 10);

const CUSTOMER_REDIRECTS = [
  ["/quickstart", "/getting-started/quickstart"],
  ["/workspace/saved-lists", "/workspace/collections"],
  ["/companies/company-signals", "/companies"],
  ["/introductions/intro-outcomes", "/introductions/track-requests"],
];

// Every deleted internal Markdown source has explicit runtime assertions. These
// routes must not survive as HTML, trailing-slash HTML, `.md`, `.mdx`, or
// negotiated Markdown after cutover.
const RETIRED_INTERNAL_ROUTES = [
  "/api",
  "/api/authentication",
  "/api/companies-apis",
  "/api/graph-apis",
  "/api/intro-apis",
  "/api/people-apis",
  "/architecture",
  "/architecture/dashboard",
  "/architecture/extension",
  "/architecture/intro-marketplace",
  "/architecture/neograph",
  "/architecture/repository-systems",
  "/architecture/sync-pipeline",
  "/architecture/warm-path-engine",
  "/deployment/mintlify-cutover",
  "/graph/README",
  "/graph/edge-provenance",
  "/graph/non-user-targets",
  "/graph/trust-aware-pathfinding",
  "/migration/core-infra-manifest-2026-05-26",
  "/migration/moat-migration-audit-2026-05-26",
  "/operations",
  "/operations/cloudflare-cutover",
  "/operations/deployment-plan",
  "/operations/domain-setup",
  "/operations/generated-docs-inventory",
  "/operations/go-live-checklist",
  "/operations/infrastructure-audit",
  "/operations/migration-plan",
  "/operations/missing-docs-inventory",
  "/product/relationship-intelligence-defensibility",
  "/reference/generated/api-endpoint-inventory",
  "/reference/generated/environment-variables",
  "/releases/phase2",
  "/releases/rollback-phase2",
];

const RETIRED_INTERNAL_FILES = [
  "/api/authentication.mdx",
  "/api/companies-apis.mdx",
  "/api/graph-apis.mdx",
  "/api/index.mdx",
  "/api/intro-apis.mdx",
  "/api/people-apis.mdx",
  "/architecture/dashboard.mdx",
  "/architecture/extension.mdx",
  "/architecture/index.mdx",
  "/architecture/intro-marketplace.mdx",
  "/architecture/neograph.mdx",
  "/architecture/repository-systems.mdx",
  "/architecture/sync-pipeline.mdx",
  "/architecture/warm-path-engine.mdx",
  "/deployment/mintlify-cutover.mdx",
  "/graph/README.md",
  "/graph/edge-provenance.md",
  "/graph/non-user-targets.md",
  "/graph/trust-aware-pathfinding.md",
  "/migration/core-infra-manifest-2026-05-26.md",
  "/migration/moat-migration-audit-2026-05-26.md",
  "/operations/cloudflare-cutover.mdx",
  "/operations/deployment-plan.mdx",
  "/operations/domain-setup.mdx",
  "/operations/generated-docs-inventory.mdx",
  "/operations/go-live-checklist.mdx",
  "/operations/index.mdx",
  "/operations/infrastructure-audit.mdx",
  "/operations/migration-plan.mdx",
  "/operations/missing-docs-inventory.mdx",
  "/product/relationship-intelligence-defensibility.md",
  "/reference/generated/api-endpoint-inventory.mdx",
  "/reference/generated/environment-variables.mdx",
  "/releases/phase2.md",
  "/releases/rollback-phase2.md",
];

const RETIRED_MCP_PATHS = [
  ...new Set(
    RETIRED_INTERNAL_FILES.flatMap((file) =>
      file.endsWith(".md") ? [file, `${file}x`] : [file],
    ),
  ),
];

const RETIRED_SCREENSHOTS = [
  "/images/product/alumni-network.png",
  "/images/product/chrome-extension.png",
  "/images/product/collections.png",
  "/images/product/company-search.png",
  "/images/product/contact-profile.png",
  "/images/product/contacts.png",
  "/images/product/current-user-onboarding.png",
  "/images/product/groups.png",
  "/images/product/home.png",
  "/images/product/import-contacts.png",
  "/images/product/integrations.png",
  "/images/product/intro-composer.png",
  "/images/product/missions.png",
  "/images/product/network.png",
  "/images/product/onboarding.png",
  "/images/product/opportunity-flow.png",
  "/images/product/people-search-table.png",
  "/images/product/people-search.png",
  "/images/product/saved-lists.png",
  "/images/product/settings.png",
  "/images/product/setup-network.png",
  "/images/product/sign-in.png",
  "/images/product/sign-up.png",
  "/images/product/sync-network.png",
  "/images/product/team.png",
  "/images/product/warm-intro-path.png",
];

const PRIVATE_REPOSITORY_FILES = [
  "/AGENTS.md",
  "/agents.md",
  "/README.md",
  "/package.json",
  "/package-lock.json",
  "/.gitignore",
  "/.mintignore",
  "/.github/docs-release-checklist.md",
  "/.github/pull_request_template.md",
  "/.github/workflows/docs-quality.yml",
  "/.github/workflows/docs-live-trust.yml",
  "/scripts/check-public-docs.mjs",
  "/scripts/check-intercom-support.mjs",
  "/scripts/check-live-docs.mjs",
  "/scripts/source-provenance.mjs",
  "/scripts/source-provenance.test.mjs",
  "/intercom-support.js",
  "/intercom-support.css",
];

const MACHINE_SURFACES = [
  "/skill.md",
  "/llms.txt",
  "/llms-full.txt",
  "/sitemap.xml",
  "/robots.txt",
  "/.well-known/mcp/server-card.json",
  "/.well-known/agent-card.json",
  "/.well-known/skills/index.json",
  "/.well-known/agent-skills/index.json",
];

const DISABLED_DISCOVERY_SURFACES = ["/.well-known/api-catalog"];

const EXPECTED_DISCOVERY_LINKS = new Map([
  ["llms-txt", "/llms.txt"],
  ["llms-full-txt", "/llms-full.txt"],
  ["api-catalog", "/.well-known/api-catalog"],
  ["mcp-server-card", "/.well-known/mcp/server-card.json"],
  ["agent-card", "/.well-known/agent-card.json"],
  ["agent-skills", "/.well-known/agent-skills/index.json"],
]);

const EXACT_LINKEDIN_SKILL_BOUNDARY =
  "Do not claim that **Pause Sync** or the extension settings stop all LinkedIn processing.";

const FORBIDDEN_PUBLIC_PATTERNS = [
  ["dashboard secret header", /x-introd-dashboard-secret/i],
  ["dashboard secret environment variable", /INTROD_DASHBOARD_API_SECRET/i],
  ["internal dashboard API", /\/api\/dashboard/i],
  ["internal operations route", /\/operations(?:\/|\b)/i],
  ["internal architecture route", /\/architecture(?:\/|\b)/i],
  ["internal deployment route", /\/deployment(?:\/|\b)/i],
  ["internal graph route", /\/graph(?:\/|\b)/i],
  ["internal migration route", /\/migration(?:\/|\b)/i],
  ["internal product route", /\/product(?:\/|\b)/i],
  ["internal generated reference route", /\/reference\/generated(?:\/|\b)/i],
  ["internal release route", /\/releases(?:\/|\b)/i],
  ["generated environment inventory", /reference\/generated\/environment-variables/i],
  ["retired rollback document", /rollback-phase2/i],
  ["unsupported API reference", /API Reference/i],
  ["unsupported OpenAPI surface", /\bOpenAPI\b/i],
  ["internal developer navigation", />\s*Developers\s*</i],
  ["fabricated extension rating", /5\.0\s+(?:from|rating)|200\+\s+users/i],
  ["unverified Chrome Web Store availability", /Available in the Chrome Web Store/i],
];

const findings = [];

function addFinding(path, message) {
  findings.push({ path, message });
}

function addPriorityFinding(path, message) {
  findings.unshift({ path, message });
}

async function request(path, options = {}) {
  const url = new URL(path, BASE_URL);
  const key = options.key || path;
  try {
    const response = await fetch(url, {
      redirect: options.redirect || "follow",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        "user-agent": "introd-docs-live-trust-check/1.0",
        ...options.headers,
      },
    });
    return {
      key,
      path,
      status: response.status,
      finalUrl: response.url,
      contentType: response.headers.get("content-type") || "",
      linkHeader: response.headers.get("link") || "",
      body: await response.text(),
    };
  } catch (error) {
    addFinding(key, `request failed: ${error.message}`);
    return null;
  }
}

async function mapWithConcurrency(items, mapper, concurrency = REQUEST_CONCURRENCY) {
  const results = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
  return results;
}

function textFromSse(body) {
  const parts = [];
  for (const line of body.split(/\r?\n/)) {
    if (!line.startsWith("data:")) continue;
    try {
      const payload = JSON.parse(line.slice(5).trim());
      for (const item of payload?.result?.content || []) {
        if (item?.type === "text" && typeof item.text === "string") parts.push(item.text);
      }
    } catch {
      // A malformed event remains in the raw response for the status check.
    }
  }
  return parts.join("\n") || body;
}

async function requestMcpTool(name, args, label) {
  const path = label || `/mcp ${name}`;
  const url = new URL("/mcp", BASE_URL);
  try {
    const response = await fetch(url, {
      method: "POST",
      redirect: "follow",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        accept: "application/json, text/event-stream",
        "content-type": "application/json",
        "user-agent": "introd-docs-live-trust-check/1.0",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name,
          arguments: args,
        },
      }),
    });
    const body = await response.text();
    return {
      path,
      status: response.status,
      finalUrl: response.url,
      contentType: response.headers.get("content-type") || "",
      body: textFromSse(body),
    };
  } catch (error) {
    addFinding(path, `MCP tool request failed: ${error.message}`);
    return null;
  }
}

async function requestMcpTree() {
  return requestMcpTool(
    "query_docs_filesystem_introd",
    { command: "tree / -L 3" },
    "/mcp tree",
  );
}

function scanForbidden(surface) {
  for (const [label, pattern] of FORBIDDEN_PUBLIC_PATTERNS) {
    if (pattern.test(surface.body)) {
      addFinding(surface.key || surface.path, `contains ${label}`);
    }
  }
}

function parseJson(surface) {
  try {
    return JSON.parse(surface.body);
  } catch (error) {
    addFinding(surface.path, `invalid JSON: ${error.message}`);
    return null;
  }
}

function normalizedPathname(url) {
  const pathname = new URL(url).pathname.replace(/\/$/, "");
  return pathname || "/";
}

function normalizeTrackedText(value) {
  return value.replace(/\r\n/g, "\n").trimEnd();
}

function frontmatterScalar(markdown, field) {
  const frontmatter = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
  if (!frontmatter) return null;

  const escapedField = field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rawValue = frontmatter.match(new RegExp(`^${escapedField}:\\s*(.+?)\\s*$`, "m"))?.[1];
  if (!rawValue) return null;

  if (rawValue.startsWith('"') && rawValue.endsWith('"')) {
    try {
      return JSON.parse(rawValue);
    } catch {
      return null;
    }
  }
  if (rawValue.startsWith("'") && rawValue.endsWith("'")) {
    return rawValue.slice(1, -1).replace(/''/g, "'");
  }
  return rawValue;
}

function htmlAttribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}=(?:"([^"]*)"|'([^']*)')`, "i"));
  return match?.[1] ?? match?.[2] ?? null;
}

function verifyCanonical(surface, expectedPath) {
  const canonicalTag = [...surface.body.matchAll(/<link\b[^>]*>/gi)]
    .map((match) => match[0])
    .find((tag) => htmlAttribute(tag, "rel")?.toLowerCase() === "canonical");
  const href = canonicalTag ? htmlAttribute(canonicalTag, "href") : null;
  if (!href) {
    addFinding(surface.key, "canonical link is missing");
    return;
  }

  try {
    const canonical = new URL(href, surface.finalUrl);
    if (canonical.origin !== BASE_URL.origin || normalizedPathname(canonical) !== expectedPath) {
      addFinding(surface.key, `unexpected canonical URL: ${canonical.href}`);
    }
  } catch {
    addFinding(surface.key, `invalid canonical URL: ${href}`);
  }
}

function verifyDiscoveryLinks(surface) {
  const seen = new Map();
  const linkPattern = /<([^>]+)>\s*;[^,]*?\brel="?([^";,\s]+)"?/gi;
  for (const match of surface.linkHeader.matchAll(linkPattern)) {
    const [, href, rel] = match;
    if (!EXPECTED_DISCOVERY_LINKS.has(rel)) continue;
    try {
      const resolved = new URL(href, surface.finalUrl);
      if (resolved.origin !== BASE_URL.origin) {
        addFinding(surface.key, `discovery link ${rel} uses unexpected origin ${resolved.origin}`);
        continue;
      }
      seen.set(rel, normalizedPathname(resolved));
    } catch {
      addFinding(surface.key, `discovery link ${rel} has invalid URL ${href}`);
    }
  }

  for (const [rel, expectedPath] of EXPECTED_DISCOVERY_LINKS) {
    if (!seen.has(rel)) {
      addFinding(surface.key, `missing advertised discovery link ${rel}`);
    } else if (seen.get(rel) !== expectedPath) {
      addFinding(surface.key, `discovery link ${rel} points to ${seen.get(rel)}, expected ${expectedPath}`);
    }
  }
}

function collectNavigationRoutes(value, routes = new Set()) {
  if (Array.isArray(value)) {
    for (const item of value) collectNavigationRoutes(item, routes);
    return routes;
  }
  if (!value || typeof value !== "object") return routes;

  for (const [key, child] of Object.entries(value)) {
    if (key === "root" && typeof child === "string") {
      routes.add(child);
      continue;
    }
    if (key === "pages" && Array.isArray(child)) {
      for (const page of child) {
        if (typeof page === "string") routes.add(page);
        else collectNavigationRoutes(page, routes);
      }
      continue;
    }
    collectNavigationRoutes(child, routes);
  }
  return routes;
}

function routeToPath(route) {
  const withoutIndex = route.replace(/(?:^|\/)index$/, "");
  return normalizedPathname(new URL(`/${withoutIndex}`, BASE_URL));
}

async function expectedSitemapPaths() {
  const config = JSON.parse(await readFile(new URL("../docs.json", import.meta.url), "utf8"));
  const routes = collectNavigationRoutes(config.navigation);
  return new Set(["/", ...[...routes].map(routeToPath)]);
}

async function verifySkillDiscovery(byKey) {
  const rootSkill = byKey.get("/skill.md");
  const legacyIndexSurface = byKey.get("/.well-known/skills/index.json");
  const agentIndexSurface = byKey.get("/.well-known/agent-skills/index.json");
  if (
    rootSkill?.status !== 200 ||
    legacyIndexSurface?.status !== 200 ||
    agentIndexSurface?.status !== 200
  ) {
    return;
  }

  const legacyIndex = parseJson(legacyIndexSurface);
  const agentIndex = parseJson(agentIndexSurface);
  const legacyEntry = legacyIndex?.skills?.find((skill) => skill?.name === "introd");
  const agentEntry = agentIndex?.skills?.find((skill) => skill?.name === "introd");

  if (!Array.isArray(legacyIndex?.skills) || legacyIndex.skills.length !== 1) {
    addFinding(legacyIndexSurface.path, "legacy skill discovery must contain exactly one skill");
  }
  if (!Array.isArray(agentIndex?.skills) || agentIndex.skills.length !== 1) {
    addFinding(agentIndexSurface.path, "agent skill discovery must contain exactly one skill");
  }

  if (
    !legacyEntry ||
    !Array.isArray(legacyEntry.files) ||
    legacyEntry.files.length !== 1 ||
    legacyEntry.files[0] !== "SKILL.md"
  ) {
    addFinding(legacyIndexSurface.path, "introd SKILL.md discovery entry is missing");
  }
  if (
    !agentEntry ||
    agentEntry.type !== "skill-md" ||
    agentEntry.url !== "/.well-known/agent-skills/introd/skill.md" ||
    !/^sha256:[a-f0-9]{64}$/.test(agentEntry.digest || "")
  ) {
    addFinding(agentIndexSurface.path, "introd skill URL or digest is missing");
  }
  if (
    !legacyEntry ||
    !agentEntry ||
    !Array.isArray(legacyEntry.files) ||
    legacyEntry.files.length !== 1 ||
    legacyEntry.files[0] !== "SKILL.md" ||
    agentEntry.type !== "skill-md" ||
    agentEntry.url !== "/.well-known/agent-skills/introd/skill.md" ||
    !/^sha256:[a-f0-9]{64}$/.test(agentEntry.digest || "")
  ) {
    return;
  }

  const expectedLegacyPath = "/.well-known/skills/introd/SKILL.md";

  const resourceRequests = [
    request(expectedLegacyPath),
    request("/.well-known/skills/introd/skill.md", {
      key: "/.well-known/skills/introd/skill.md alias",
    }),
    request(agentEntry.url),
  ];
  const [legacySkill, legacyLowercaseAlias, agentSkill] = await Promise.all(resourceRequests);
  const requiredResources = [legacySkill, agentSkill];

  for (const resource of requiredResources) {
    if (!resource) continue;
    if (resource.status !== 200) {
      addFinding(resource.path, `expected 200, received ${resource.status}`);
      continue;
    }
    scanForbidden(resource);
    if (!resource.body.includes("Treat the documentation as product-use guidance")) {
      addFinding(resource.path, "custom safe skill boundary is missing");
    }
    if (!resource.body.includes(EXACT_LINKEDIN_SKILL_BOUNDARY)) {
      addFinding(resource.path, "current LinkedIn processing boundary is missing");
    }
    if (normalizeTrackedText(resource.body) !== normalizeTrackedText(rootSkill.body)) {
      addFinding(resource.path, "skill discovery resource is stale relative to /skill.md");
    }
  }

  if (legacyLowercaseAlias?.status === 200) {
    scanForbidden(legacyLowercaseAlias);
    if (normalizeTrackedText(legacyLowercaseAlias.body) !== normalizeTrackedText(rootSkill.body)) {
      addFinding(legacyLowercaseAlias.key, "public lowercase skill alias is stale relative to /skill.md");
    }
  } else if (legacyLowercaseAlias && legacyLowercaseAlias.status !== 404) {
    addFinding(
      legacyLowercaseAlias.key,
      `expected 200 or 404, received ${legacyLowercaseAlias.status}`,
    );
  }

  if (agentSkill?.status === 200) {
    const actualDigest = `sha256:${createHash("sha256").update(agentSkill.body, "utf8").digest("hex")}`;
    if (actualDigest !== agentEntry.digest) {
      addFinding(agentIndexSurface.path, "agent skill digest does not match the advertised resource");
    }
  }
}

async function main() {
  const expectedSkillBody = await readFile(new URL("../skill.md", import.meta.url), "utf8");
  const expectedSkillDescription = frontmatterScalar(expectedSkillBody, "description");
  if (!expectedSkillDescription) {
    addFinding("skill.md [tracked]", "non-empty description frontmatter is required");
  }
  const expectedRobotsBody = await readFile(new URL("../robots.txt", import.meta.url), "utf8");
  const expectedPublicPaths = await expectedSitemapPaths();
  const publicPages = [...expectedPublicPaths].sort();
  const checks = [];

  for (const path of publicPages) {
    checks.push({
      type: "public-html",
      path,
      key: `${path} [HTML]`,
      headers: { accept: "text/html" },
    });
    checks.push({
      type: "public-markdown",
      path,
      key: `${path} [Accept: text/markdown]`,
      headers: { accept: "text/markdown" },
    });
    if (path !== "/") {
      checks.push({
        type: "public-markdown",
        path: `${path}.md`,
        key: `${path}.md`,
        headers: { accept: "text/markdown" },
      });
    }
  }
  for (const [source, destination] of CUSTOMER_REDIRECTS) {
    checks.push({ type: "redirect", path: source, destination, key: `redirect ${source}` });
  }
  for (const path of RETIRED_INTERNAL_ROUTES) {
    checks.push({ type: "retired", path, key: `${path} [HTML]`, headers: { accept: "text/html" } });
    checks.push({ type: "retired", path: `${path}/`, key: `${path}/ [HTML]`, headers: { accept: "text/html" } });
    checks.push({ type: "retired", path: `${path}.md`, key: `${path}.md` });
    checks.push({ type: "retired", path: `${path}.mdx`, key: `${path}.mdx` });
    checks.push({
      type: "retired",
      path,
      key: `${path} [Accept: text/markdown]`,
      headers: { accept: "text/markdown" },
    });
  }
  for (const path of [...RETIRED_SCREENSHOTS, ...PRIVATE_REPOSITORY_FILES]) {
    checks.push({ type: "retired", path, key: path });
  }
  for (const path of MACHINE_SURFACES) {
    checks.push({ type: "machine", path, key: path });
  }
  for (const path of DISABLED_DISCOVERY_SURFACES) {
    checks.push({ type: "retired", path, key: path });
  }

  const responses = await mapWithConcurrency(checks, (check) =>
    request(check.path, { key: check.key, headers: check.headers }),
  );
  const byKey = new Map(responses.filter(Boolean).map((response) => [response.key, response]));

  for (const check of checks) {
    const response = byKey.get(check.key);
    if (!response) continue;

    if (check.type === "public-html") {
      if (response.status !== 200) {
        addFinding(check.key, `expected 200, received ${response.status}`);
      } else if (!response.contentType.toLowerCase().includes("text/html")) {
        addFinding(check.key, `expected HTML, received ${response.contentType || "no content type"}`);
      } else if (normalizedPathname(response.finalUrl) !== check.path) {
        addFinding(
          check.key,
          `expected final path ${check.path}, received ${normalizedPathname(response.finalUrl)}`,
        );
      } else {
        scanForbidden(response);
        verifyDiscoveryLinks(response);
        verifyCanonical(response, check.path);
      }
    }

    if (check.type === "public-markdown") {
      if (response.status !== 200) {
        addFinding(check.key, `expected 200, received ${response.status}`);
      } else if (!response.contentType.toLowerCase().includes("text/markdown")) {
        addFinding(
          check.key,
          `expected Markdown, received ${response.contentType || "no content type"}`,
        );
      } else {
        scanForbidden(response);
      }
    }

    if (check.type === "redirect") {
      if (response.status !== 200) {
        addFinding(check.key, `expected redirect destination 200, received ${response.status}`);
      } else if (normalizedPathname(response.finalUrl) !== check.destination) {
        addFinding(
          check.key,
          `expected final path ${check.destination}, received ${normalizedPathname(response.finalUrl)}`,
        );
      } else {
        scanForbidden(response);
      }
    }

    if (check.type === "retired" && response.status !== 404) {
      addFinding(check.key, `expected retired resource to return 404, received ${response.status}`);
    }

    if (check.type === "machine") {
      if (response.status !== 200) {
        addFinding(check.key, `expected 200, received ${response.status}`);
      } else {
        scanForbidden(response);
      }
    }

  }

  const homeHtml = byKey.get("/ [HTML]");
  if (homeHtml?.status === 200) {
    for (const finding of productionGitSourceFindings(homeHtml.body)) {
      addPriorityFinding("/ [HTML] source provenance", finding);
    }
    for (const [marker, message] of [
      ["v8fbftfu", "approved Intercom app ID is not globally injected"],
      ["https://api-iam.intercom.io", "US Intercom API base is not globally injected"],
      ["hide_default_launcher: true", "hidden-launcher setting is not globally injected"],
      ["introd-support-controls", "support launcher styles are not globally injected"],
    ]) {
      if (!homeHtml.body.includes(marker)) addFinding("/ [HTML]", message);
    }
  }

  const mcp = await requestMcpTree();
  if (mcp) {
    if (mcp.status !== 200) {
      addFinding("/mcp tree", `expected 200, received ${mcp.status}`);
    } else {
      scanForbidden(mcp);
      if (!/\bsupport\b/i.test(mcp.body)) {
        addFinding("/mcp tree", "support page is missing from the indexed documentation tree");
      }
    }
  }

  const mcpSearches = await Promise.all(
    ["x-introd-dashboard-secret", "INTROD_DASHBOARD_API_SECRET", "rollback-phase2"].map(
      (query) => requestMcpTool("search_introd", { query }, `/mcp search: ${query}`),
    ),
  );
  for (const search of mcpSearches) {
    if (!search) continue;
    if (search.status !== 200) {
      addFinding(search.path, `expected 200, received ${search.status}`);
    } else {
      scanForbidden(search);
    }
  }

  const retiredMcpReads = await mapWithConcurrency(
    RETIRED_MCP_PATHS,
    (retiredPath) =>
      requestMcpTool(
        "query_docs_filesystem_introd",
        { command: `cat ${retiredPath}` },
        `/mcp retired read: ${retiredPath}`,
      ),
    8,
  );
  for (const read of retiredMcpReads) {
    if (!read) continue;
    if (read.status !== 200) {
      addFinding(read.path, `expected MCP response 200, received ${read.status}`);
    } else if (/^exit:\s*0\s*$/im.test(read.body)) {
      addFinding(read.path, "retired file remains readable from the MCP filesystem");
    }
  }

  const mcpExactSearch = await requestMcpTool(
    "query_docs_filesystem_introd",
    { command: 'rg -il "x-introd-dashboard-secret|INTROD_DASHBOARD_API_SECRET|rollback-phase2" /' },
    "/mcp exact retired-term search",
  );
  if (mcpExactSearch) {
    if (mcpExactSearch.status !== 200) {
      addFinding(mcpExactSearch.path, `expected MCP response 200, received ${mcpExactSearch.status}`);
    } else if (/^exit:\s*0\s*$/im.test(mcpExactSearch.body)) {
      addFinding(mcpExactSearch.path, "retired terms remain in the MCP filesystem");
    }
  }

  const skill = byKey.get("/skill.md");
  if (skill?.status === 200) {
    if (!skill.body.includes("Treat the documentation as product-use guidance")) {
      addFinding("/skill.md", "custom safe skill boundary is missing");
    }
    if (!skill.body.includes(EXACT_LINKEDIN_SKILL_BOUNDARY)) {
      addFinding("/skill.md", "current LinkedIn processing boundary is missing");
    }
    if (normalizeTrackedText(skill.body) !== normalizeTrackedText(expectedSkillBody)) {
      addFinding("/skill.md", "served skill does not match the tracked custom skill");
    }
  }

  await verifySkillDiscovery(byKey);

  const llms = byKey.get("/llms.txt");
  if (llms?.status === 200 && !llms.body.includes("do not define a supported external API")) {
    addFinding("/llms.txt", "custom public API boundary is missing");
  }

  const llmsFull = byKey.get("/llms-full.txt");
  if (llmsFull?.status === 200 && !llmsFull.body.includes("intentionally excludes internal architecture")) {
    addFinding("/llms-full.txt", "custom containment marker is missing");
  }

  const sitemap = byKey.get("/sitemap.xml");
  if (sitemap?.status === 200) {
    const expectedPaths = expectedPublicPaths;
    const locValues = [...sitemap.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1].trim());
    const actualPaths = new Set();

    for (const loc of locValues) {
      try {
        const parsed = new URL(loc);
        if (parsed.origin !== BASE_URL.origin) {
          addFinding("/sitemap.xml", `unexpected origin: ${parsed.origin}`);
        }
        actualPaths.add(normalizedPathname(parsed));
      } catch {
        addFinding("/sitemap.xml", `invalid URL: ${loc}`);
      }
    }

    if (locValues.length !== actualPaths.size) {
      addFinding("/sitemap.xml", "contains duplicate or invalid URL entries");
    }

    const missing = [...expectedPaths].filter((path) => !actualPaths.has(path)).sort();
    const unexpected = [...actualPaths].filter((path) => !expectedPaths.has(path)).sort();
    if (missing.length > 0) {
      addFinding("/sitemap.xml", `missing expected paths: ${missing.join(", ")}`);
    }
    if (unexpected.length > 0) {
      addFinding("/sitemap.xml", `contains unexpected paths: ${unexpected.join(", ")}`);
    }
  }

  const robots = byKey.get("/robots.txt");
  if (
    robots?.status === 200 &&
    !/^Content-Signal:\s*ai-train=no,\s*search=yes,\s*ai-input=yes\s*$/im.test(robots.body)
  ) {
    addFinding("/robots.txt", "safe Content-Signal directive is missing");
  }
  if (
    robots?.status === 200 &&
    normalizeTrackedText(robots.body) !== normalizeTrackedText(expectedRobotsBody)
  ) {
    addFinding("/robots.txt", "served robots policy does not match the tracked allowlist and sitemap policy");
  }

  const mcpCardSurface = byKey.get("/.well-known/mcp/server-card.json");
  if (mcpCardSurface?.status === 200) {
    const card = parseJson(mcpCardSurface);
    try {
      const cardUrl = new URL(card?.url);
      if (cardUrl.origin !== BASE_URL.origin || normalizedPathname(cardUrl) !== "/mcp") {
        addFinding(mcpCardSurface.path, `unexpected MCP URL: ${cardUrl.href}`);
      }
    } catch {
      addFinding(mcpCardSurface.path, "valid MCP URL is missing");
    }
  }

  const agentCardSurface = byKey.get("/.well-known/agent-card.json");
  if (agentCardSurface?.status === 200) {
    const card = parseJson(agentCardSurface);
    const introdSkill = card?.skills?.find((skill) => skill?.id === "introd");
    if (expectedSkillDescription && introdSkill?.description !== expectedSkillDescription) {
      addPriorityFinding(
        agentCardSurface.path,
        `introd skill description does not match tracked skill.md frontmatter: received ${JSON.stringify(introdSkill?.description)}, expected ${JSON.stringify(expectedSkillDescription)}`,
      );
    }
    for (const [label, value] of [
      ["agent URL", card?.url],
      ["documentation URL", card?.documentationUrl],
      ["skill URL", introdSkill?.url],
    ]) {
      try {
        const parsed = new URL(value);
        if (parsed.origin !== BASE_URL.origin) {
          addFinding(agentCardSurface.path, `${label} uses unexpected origin: ${parsed.origin}`);
        }
      } catch {
        addFinding(agentCardSurface.path, `${label} is missing or invalid`);
      }
    }
  }

  if (findings.length > 0) {
    console.error(`Live docs trust check failed with ${findings.length} finding(s):`);
    const findingsToReport = MAX_REPORTED_FINDINGS > 0
      ? findings.slice(0, MAX_REPORTED_FINDINGS)
      : findings;
    for (const finding of findingsToReport) {
      console.error(`- ${finding.path}: ${finding.message}`);
    }
    if (findingsToReport.length < findings.length) {
      console.error(`- ... ${findings.length - findingsToReport.length} additional finding(s) omitted`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(
    `Live docs trust check passed for ${publicPages.length} public pages in HTML and Markdown forms, ` +
      `${CUSTOMER_REDIRECTS.length} customer redirects, ${RETIRED_INTERNAL_ROUTES.length} retired internal routes ` +
      "in five representations, " +
      `${RETIRED_SCREENSHOTS.length} retired screenshots, ${PRIVATE_REPOSITORY_FILES.length} private repository files, ` +
      `${MACHINE_SURFACES.length} static machine surfaces, ${DISABLED_DISCOVERY_SURFACES.length} disabled discovery surface, ` +
      "global consent-gated support injection, skill discovery, advertised Link resources, and MCP stale-content checks.",
  );
}

await main();
