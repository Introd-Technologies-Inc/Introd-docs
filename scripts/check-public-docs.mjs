#!/usr/bin/env node

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const REPOSITORY_ROOT = process.cwd();
const CONFIG_PATH = "docs.json";
const CONTENT_EXTENSIONS = new Set([".md", ".mdx"]);
const INTERNAL_DIRECTORIES = new Set([
  "api",
  "reference",
  "architecture",
  "graph",
  "product",
  "operations",
  "deployment",
  "migration",
  "releases",
  "research",
]);
const FORBIDDEN_TERMS = [
  "x-introd-dashboard-secret",
  "INTROD_DASHBOARD_API_SECRET",
  "/api/dashboard",
  "x-csrf-token",
  "introd-api-prod",
  "FoundersNest",
  "rollback-phase2",
];
const PUBLIC_MACHINE_FILES = ["llms.txt", "llms-full.txt", "skill.md"];
const REQUIRED_MACHINE_BOUNDARIES = new Map([
  [
    "skill.md",
    [
      "Treat the documentation as product-use guidance, not as an external API contract.",
      "Do not claim that **Pause Sync** or the extension settings stop all LinkedIn processing.",
    ],
  ],
  ["llms.txt", ["These public docs do not define a supported external API."]],
  [
    "llms-full.txt",
    [
      "This file intentionally excludes internal architecture",
      "pausing the import does not stop all page processing",
    ],
  ],
]);
const NON_PAGE_MARKDOWN_FILES = new Set(["AGENTS.md", "README.md", "skill.md"]);
const REQUIRED_MINTIGNORE_ENTRIES = [
  "AGENTS.md",
  "README.md",
  ".github/",
  ".gitignore",
  "package.json",
  "package-lock.json",
  "scripts/",
  "api/",
  "architecture/",
  "deployment/",
  "graph/",
  "migration/",
  "operations/",
  "product/",
  "reference/",
  "releases/",
  "research/",
];
const LOCAL_DOCS_HOSTS = new Set(["docs.getintrod.ai", "www.docs.getintrod.ai"]);
const IGNORED_DIRECTORIES = new Set([".git", ".github", ".mintlify", "node_modules"]);

const findings = [];
const navigationReferences = [];
const publicEntryReferences = [];
const checkedContentFiles = new Set();
let checkedLocalLinks = 0;
let checkedMachineFiles = 0;

function toPosix(filePath) {
  return filePath.split(path.sep).join("/");
}

function addFinding(code, file, line, message) {
  findings.push({ code, file: toPosix(file), line: line || 1, message });
}

function lineNumberAt(content, index) {
  return content.slice(0, index).split("\n").length;
}

async function collectRepositoryFiles(directory = REPOSITORY_ROOT, relativeDirectory = "") {
  const files = [];
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) {
      continue;
    }

    const relativePath = relativeDirectory
      ? `${relativeDirectory}/${entry.name}`
      : entry.name;
    const absolutePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectRepositoryFiles(absolutePath, relativePath)));
    } else if (entry.isFile()) {
      files.push(relativePath);
    }
  }

  return files;
}

function addReference(collection, target, location, kind) {
  if (typeof target !== "string" || target.trim() === "") {
    return;
  }

  collection.push({ target: target.trim(), location, kind });
}

function collectNavigationReferences(value, location = "navigation") {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      collectNavigationReferences(item, `${location}[${index}]`),
    );
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    const childLocation = `${location}.${key}`;

    if (key === "root" && typeof child === "string") {
      addReference(navigationReferences, child, childLocation, "navigation root");
      continue;
    }

    if (key === "pages" && Array.isArray(child)) {
      child.forEach((page, index) => {
        const pageLocation = `${childLocation}[${index}]`;
        if (typeof page === "string") {
          addReference(navigationReferences, page, pageLocation, "navigation page");
        } else {
          collectNavigationReferences(page, pageLocation);
        }
      });
      continue;
    }

    if (key === "href" && typeof child === "string") {
      addReference(publicEntryReferences, child, childLocation, "navigation link");
      continue;
    }

    collectNavigationReferences(child, childLocation);
  }
}

function collectHrefReferences(value, location) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectHrefReferences(item, `${location}[${index}]`));
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    const childLocation = `${location}.${key}`;
    if (key === "href" && typeof child === "string") {
      addReference(publicEntryReferences, child, childLocation, "site navigation link");
    } else {
      collectHrefReferences(child, childLocation);
    }
  }
}

function collectPublicEntryReferences(config) {
  collectNavigationReferences(config.navigation);
  collectHrefReferences(config.navbar, "navbar");
  collectHrefReferences(config.footer, "footer");
  collectHrefReferences(config.logo, "logo");

  if (Array.isArray(config.redirects)) {
    config.redirects.forEach((redirect, index) => {
      addReference(
        publicEntryReferences,
        redirect?.destination,
        `redirects[${index}].destination`,
        "redirect destination",
      );
    });
  }
}

function firstInternalDirectory(relativePath) {
  const firstSegment = relativePath.replace(/^\/+/, "").split("/")[0].toLowerCase();
  return INTERNAL_DIRECTORIES.has(firstSegment) ? firstSegment : null;
}

function parseLocalTarget(rawTarget, sourceFile) {
  let target = rawTarget.trim();
  if (!target || target.startsWith("#") || target.startsWith("?")) {
    return { local: false };
  }

  if (target.startsWith("<") && target.endsWith(">")) {
    target = target.slice(1, -1).trim();
  }

  if (target.startsWith("//")) {
    target = `https:${target}`;
  }

  if (/^[a-z][a-z\d+.-]*:/i.test(target)) {
    let url;
    try {
      url = new URL(target);
    } catch {
      return { local: false };
    }

    if (!LOCAL_DOCS_HOSTS.has(url.hostname.toLowerCase())) {
      return { local: false };
    }
    target = `${url.pathname}${url.search}${url.hash}`;
  }

  const withoutFragment = target.split("#", 1)[0].split("?", 1)[0];
  if (!withoutFragment) {
    return { local: false };
  }

  let decodedTarget;
  try {
    decodedTarget = decodeURIComponent(withoutFragment);
  } catch {
    return { local: true, invalid: `contains invalid URL encoding: ${rawTarget}` };
  }

  const sourceDirectory = path.posix.dirname(toPosix(sourceFile));
  const relativePath = decodedTarget.startsWith("/")
    ? decodedTarget.replace(/^\/+/, "")
    : path.posix.join(sourceDirectory === "." ? "" : sourceDirectory, decodedTarget);
  const normalizedPath = path.posix.normalize(relativePath || ".").replace(/^\.\//, "");

  if (normalizedPath === ".." || normalizedPath.startsWith("../")) {
    return { local: true, invalid: `escapes the documentation repository: ${rawTarget}` };
  }

  return {
    local: true,
    relativePath: normalizedPath === "." ? "" : normalizedPath,
  };
}

function targetCandidates(relativePath) {
  if (!relativePath) {
    return ["index.mdx", "index.md"];
  }

  const extension = path.posix.extname(relativePath);
  if (extension) {
    return [relativePath];
  }

  const withoutTrailingSlash = relativePath.replace(/\/$/, "");
  return [
    `${withoutTrailingSlash}.mdx`,
    `${withoutTrailingSlash}.md`,
    `${withoutTrailingSlash}/index.mdx`,
    `${withoutTrailingSlash}/index.md`,
  ];
}

function resolveRepositoryTarget(rawTarget, sourceFile, exactFiles, filesByLowerCase) {
  const parsedTarget = parseLocalTarget(rawTarget, sourceFile);
  if (!parsedTarget.local || parsedTarget.invalid) {
    return parsedTarget;
  }

  const candidates = targetCandidates(parsedTarget.relativePath);
  const exactCandidate = candidates.find((candidate) => exactFiles.has(candidate));
  if (exactCandidate) {
    return { ...parsedTarget, resolvedPath: exactCandidate };
  }

  for (const candidate of candidates) {
    const differentlyCasedPath = filesByLowerCase.get(candidate.toLowerCase());
    if (differentlyCasedPath) {
      return {
        ...parsedTarget,
        caseMismatch: differentlyCasedPath,
        expectedPath: candidate,
      };
    }
  }

  return { ...parsedTarget, missing: true, candidates };
}

function routeKey(target) {
  const parsed = parseLocalTarget(target, CONFIG_PATH);
  if (!parsed.local || parsed.invalid) {
    return null;
  }

  return parsed.relativePath
    .replace(/\.(?:md|mdx)$/i, "")
    .replace(/\/index$/i, "")
    .replace(/\/$/, "")
    .toLowerCase() || "/";
}

function frontmatterMetadata(content) {
  const normalized = content.replace(/^\uFEFF/, "");
  const match = normalized.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/);
  if (!match) {
    return { title: false, description: false };
  }

  const lines = match[1].split(/\r?\n/);
  const hasValue = (field) => {
    const fieldPattern = new RegExp(`^${field}:\\s*(.*)$`, "i");
    for (let index = 0; index < lines.length; index += 1) {
      const fieldMatch = lines[index].match(fieldPattern);
      if (!fieldMatch) {
        continue;
      }

      const value = fieldMatch[1].trim();
      if (value && !/^[>|][-+]?$/.test(value)) {
        return value !== '""' && value !== "''" && value !== "null" && value !== "~";
      }

      if (/^[>|][-+]?$/.test(value)) {
        return lines.slice(index + 1).some((line) => /^\s+\S/.test(line));
      }

      return false;
    }
    return false;
  };

  return { title: hasValue("title"), description: hasValue("description") };
}

function maskNonLinkMarkup(content) {
  const preserveNewlines = (match) => match.replace(/[^\r\n]/g, " ");
  return content
    .replace(/(^|\n)[ \t]*(`{3,}|~{3,})[^\n]*\n[\s\S]*?\n[ \t]*\2(?=\r?\n|$)/g, preserveNewlines)
    .replace(/<!--[\s\S]*?-->/g, preserveNewlines)
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, preserveNewlines)
    .replace(/`[^`\r\n]+`/g, preserveNewlines);
}

function markdownDestination(rawDestination) {
  const destination = rawDestination.trim();
  if (destination.startsWith("<")) {
    const closingBracket = destination.indexOf(">");
    return closingBracket === -1
      ? destination
      : destination.slice(0, closingBracket + 1);
  }
  return destination.split(/\s+/, 1)[0];
}

function extractLocalLinkCandidates(content) {
  const maskedContent = maskNonLinkMarkup(content);
  const links = [];
  const patterns = [
    {
      expression: /!?\[[^\]\r\n]*\]\(([^)\r\n]+)\)/g,
      target: (match) => markdownDestination(match[1]),
    },
    {
      expression: /^\s*\[[^\]\r\n]+\]:\s*(\S+)/gm,
      target: (match) => match[1],
    },
    {
      expression: /(?:href|src)\s*=\s*["']([^"']+)["']/g,
      target: (match) => match[1],
    },
    {
      expression: /(?:href|src)\s*=\s*\{\s*["']([^"']+)["']\s*\}/g,
      target: (match) => match[1],
    },
  ];

  for (const { expression, target } of patterns) {
    for (const match of maskedContent.matchAll(expression)) {
      links.push({ target: target(match), index: match.index });
    }
  }

  return links.sort((left, right) => left.index - right.index);
}

function scanForbiddenTerms(content, file) {
  for (const term of FORBIDDEN_TERMS) {
    const expression = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const match = expression.exec(content);
    if (match) {
      addFinding(
        "forbidden-term",
        file,
        lineNumberAt(content, match.index),
        `public content contains forbidden term "${term}"`,
      );
    }
  }
}

function reportTargetProblem(reference, resolution, sourceFile, line) {
  if (resolution.invalid) {
    addFinding("invalid-link", sourceFile, line, resolution.invalid);
    return true;
  }

  if (resolution.caseMismatch) {
    addFinding(
      "link-case",
      sourceFile,
      line,
      `"${reference}" uses the wrong case; repository path is "${resolution.caseMismatch}"`,
    );
    return true;
  }

  if (resolution.missing) {
    addFinding(
      "missing-target",
      sourceFile,
      line,
      `"${reference}" does not resolve to a repository file`,
    );
    return true;
  }

  return false;
}

function enforcePublicBoundary(target, resolvedPath, sourceFile, line) {
  const pathToCheck = resolvedPath || parseLocalTarget(target, sourceFile).relativePath;
  if (!pathToCheck) {
    return false;
  }

  const internalDirectory = firstInternalDirectory(pathToCheck);
  if (!internalDirectory) {
    return false;
  }

  addFinding(
    "internal-boundary",
    sourceFile,
    line,
    `public navigation reaches internal directory "${internalDirectory}" through "${target}"`,
  );
  return true;
}

async function main() {
  const repositoryFiles = await collectRepositoryFiles();
  const exactFiles = new Set(repositoryFiles);
  const filesByLowerCase = new Map(
    repositoryFiles.map((file) => [file.toLowerCase(), file]),
  );

  for (const file of PUBLIC_MACHINE_FILES) {
    if (!exactFiles.has(file)) {
      addFinding("machine-surface", file, 1, "required curated machine-readable surface is missing");
    }
  }

  try {
    const mintignore = await readFile(path.join(REPOSITORY_ROOT, ".mintignore"), "utf8");
    const entries = new Set(
      mintignore
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#")),
    );
    for (const entry of REQUIRED_MINTIGNORE_ENTRIES) {
      if (!entries.has(entry)) {
        addFinding("mintignore", ".mintignore", 1, `required publish exclusion is missing: ${entry}`);
      }
    }
  } catch (error) {
    addFinding("mintignore", ".mintignore", 1, `cannot read publish exclusions: ${error.message}`);
  }

  let configContent;
  let config;
  try {
    configContent = await readFile(path.join(REPOSITORY_ROOT, CONFIG_PATH), "utf8");
    config = JSON.parse(configContent);
  } catch (error) {
    addFinding("config", CONFIG_PATH, 1, `cannot read valid JSON: ${error.message}`);
    printResults();
    return;
  }

  scanForbiddenTerms(configContent, CONFIG_PATH);
  if (Object.prototype.hasOwnProperty.call(config, "contextual")) {
    const contextualIndex = configContent.search(/"contextual"\s*:/);
    addFinding(
      "contextual-menu",
      CONFIG_PATH,
      lineNumberAt(configContent, contextualIndex < 0 ? 0 : contextualIndex),
      "omit the contextual setting so page-copy, raw Markdown, and AI handoff actions remain disabled",
    );
  }
  if (config?.seo?.indexing !== "navigable") {
    addFinding(
      "seo-indexing",
      CONFIG_PATH,
      1,
      'seo.indexing must remain "navigable" so non-navigation content is not indexed',
    );
  }
  collectPublicEntryReferences(config);

  const navigationRoutes = new Map();
  for (const reference of navigationReferences) {
    const key = routeKey(reference.target);
    if (!key) {
      addFinding(
        "navigation-target",
        CONFIG_PATH,
        1,
        `${reference.location} must be a local documentation path, received "${reference.target}"`,
      );
      continue;
    }

    if (navigationRoutes.has(key)) {
      addFinding(
        "duplicate-navigation",
        CONFIG_PATH,
        1,
        `duplicate navigation path "${reference.target}" at ${navigationRoutes.get(key)} and ${reference.location}`,
      );
    } else {
      navigationRoutes.set(key, reference.location);
    }
  }

  const publicContentQueue = [];
  const queuedContentFiles = new Set();
  const enqueueContentFile = (file) => {
    if (CONTENT_EXTENSIONS.has(path.posix.extname(file).toLowerCase()) && !queuedContentFiles.has(file)) {
      queuedContentFiles.add(file);
      publicContentQueue.push(file);
    }
  };

  for (const file of PUBLIC_MACHINE_FILES.filter((candidate) => exactFiles.has(candidate))) {
    checkedMachineFiles += 1;
    const content = await readFile(path.join(REPOSITORY_ROOT, file), "utf8");
    scanForbiddenTerms(content, file);

    for (const boundary of REQUIRED_MACHINE_BOUNDARIES.get(file) || []) {
      if (!content.includes(boundary)) {
        addFinding("machine-boundary", file, 1, `required boundary is missing: ${boundary}`);
      }
    }

    for (const link of extractLocalLinkCandidates(content)) {
      const resolution = resolveRepositoryTarget(link.target, file, exactFiles, filesByLowerCase);
      if (!resolution.local) {
        continue;
      }

      checkedLocalLinks += 1;
      const line = lineNumberAt(content, link.index);
      const targetProblem = reportTargetProblem(link.target, resolution, file, line);
      const crossesBoundary = enforcePublicBoundary(
        link.target,
        resolution.resolvedPath,
        file,
        line,
      );
      if (!targetProblem && !crossesBoundary && resolution.resolvedPath) {
        enqueueContentFile(resolution.resolvedPath);
      }
    }
  }

  for (const reference of [...navigationReferences, ...publicEntryReferences]) {
    const resolution = resolveRepositoryTarget(
      reference.target,
      CONFIG_PATH,
      exactFiles,
      filesByLowerCase,
    );
    if (!resolution.local) {
      continue;
    }

    const targetProblem = reportTargetProblem(reference.target, resolution, CONFIG_PATH, 1);
    const crossesBoundary = enforcePublicBoundary(
      reference.target,
      resolution.resolvedPath,
      CONFIG_PATH,
      1,
    );
    if (!targetProblem && !crossesBoundary && resolution.resolvedPath) {
      enqueueContentFile(resolution.resolvedPath);
    }
  }

  while (publicContentQueue.length > 0) {
    const file = publicContentQueue.shift();
    checkedContentFiles.add(file);
    const content = await readFile(path.join(REPOSITORY_ROOT, file), "utf8");
    const metadata = frontmatterMetadata(content);

    if (!metadata.title) {
      addFinding("metadata-title", file, 1, "navigable content needs non-empty title frontmatter");
    }
    if (!metadata.description) {
      addFinding(
        "metadata-description",
        file,
        1,
        "navigable content needs non-empty description frontmatter",
      );
    }

    scanForbiddenTerms(content, file);

    for (const link of extractLocalLinkCandidates(content)) {
      const resolution = resolveRepositoryTarget(link.target, file, exactFiles, filesByLowerCase);
      if (!resolution.local) {
        continue;
      }

      checkedLocalLinks += 1;
      const line = lineNumberAt(content, link.index);
      const targetProblem = reportTargetProblem(link.target, resolution, file, line);
      const crossesBoundary = enforcePublicBoundary(
        link.target,
        resolution.resolvedPath,
        file,
        line,
      );
      if (!targetProblem && !crossesBoundary && resolution.resolvedPath) {
        enqueueContentFile(resolution.resolvedPath);
      }
    }
  }

  for (const file of repositoryFiles) {
    if (!CONTENT_EXTENSIONS.has(path.posix.extname(file).toLowerCase())) continue;
    if (NON_PAGE_MARKDOWN_FILES.has(file)) continue;
    if (firstInternalDirectory(file)) continue;
    if (!checkedContentFiles.has(file)) {
      addFinding(
        "orphan-public-page",
        file,
        1,
        "page is publishable but unreachable from public navigation or curated machine surfaces",
      );
    }
  }

  try {
    const robots = await readFile(path.join(REPOSITORY_ROOT, "robots.txt"), "utf8");
    if (!/^Content-Signal:\s*ai-train=no,\s*search=yes,\s*ai-input=yes\s*$/im.test(robots)) {
      addFinding(
        "robots-content-signal",
        "robots.txt",
        1,
        "Content-Signal must opt out of AI training while allowing search and user-requested AI input",
      );
    }
    if (!/^Sitemap:\s*https:\/\/docs\.getintrod\.ai\/sitemap\.xml\s*$/im.test(robots)) {
      addFinding("robots-sitemap", "robots.txt", 1, "canonical sitemap declaration is missing");
    }
    if (!/^User-agent:\s*\*\s*$/im.test(robots) || !/^Allow:\s*\/\s*$/im.test(robots)) {
      addFinding("robots-access", "robots.txt", 1, "public crawler allow policy is missing");
    }
  } catch (error) {
    addFinding("robots", "robots.txt", 1, `cannot read robots policy: ${error.message}`);
  }

  printResults(navigationRoutes.size);
}

function printResults(navigationRouteCount = 0) {
  if (findings.length > 0) {
    findings.sort((left, right) =>
      left.file.localeCompare(right.file) || left.line - right.line || left.code.localeCompare(right.code),
    );
    console.error(`Public docs quality check failed with ${findings.length} finding(s):`);
    for (const finding of findings) {
      console.error(
        `- ${finding.file}:${finding.line} [${finding.code}] ${finding.message}`,
      );
    }
    process.exitCode = 1;
    return;
  }

  console.log(
    `Public docs quality check passed: ${checkedContentFiles.size} content files, ` +
      `${navigationRouteCount} navigation routes, ${checkedMachineFiles} machine-readable surfaces, ` +
      `and ${checkedLocalLinks} local links checked.`,
  );
}

await main();
