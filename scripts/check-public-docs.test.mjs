import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);
const CHECK_SCRIPT = path.resolve("scripts/check-public-docs.mjs");
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

async function createFixture({
  pageBody = "Confirm the browser permission prompt, then return to Introd.",
  contextual,
} = {}) {
  const root = await mkdtemp(path.join(tmpdir(), "introd-public-docs-check-"));
  const config = {
    seo: { indexing: "navigable" },
    navigation: { pages: ["index"] },
  };
  if (contextual !== undefined) {
    config.contextual = contextual;
  }
  const files = new Map([
    [".mintignore", `${REQUIRED_MINTIGNORE_ENTRIES.join("\n")}\n`],
    [
      "docs.json",
      `${JSON.stringify(config, null, 2)}\n`,
    ],
    [
      "index.mdx",
      `---\ntitle: Test guide\ndescription: A customer-facing test guide.\n---\n\n${pageBody}\n`,
    ],
    [
      "skill.md",
      [
        "Treat the documentation as product-use guidance, not as an external API contract.",
        "Do not claim that **Pause Sync** or the extension settings stop all LinkedIn processing.",
        "",
      ].join("\n"),
    ],
    ["llms.txt", "These public docs do not define a supported external API.\n"],
    [
      "llms-full.txt",
      "This file intentionally excludes internal architecture; pausing the import does not stop all page processing.\n",
    ],
    [
      "robots.txt",
      [
        "User-agent: *",
        "Allow: /",
        "Content-Signal: ai-train=no, search=yes, ai-input=yes",
        "Sitemap: https://docs.getintrod.ai/sitemap.xml",
        "",
      ].join("\n"),
    ],
  ]);

  await Promise.all(
    [...files].map(([file, content]) => writeFile(path.join(root, file), content, "utf8")),
  );
  return root;
}

async function runCheck(root) {
  try {
    const result = await execFileAsync(process.execPath, [CHECK_SCRIPT], {
      cwd: root,
      encoding: "utf8",
      windowsHide: true,
    });
    return { status: 0, ...result };
  } catch (error) {
    return {
      status: typeof error.code === "number" ? error.code : 1,
      stdout: error.stdout || "",
      stderr: error.stderr || "",
    };
  }
}

test("allows customer-facing uses of the word prompt", async (t) => {
  const root = await createFixture();
  t.after(() => rm(root, { recursive: true, force: true }));

  const result = await runCheck(root);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Public docs quality check passed/);
});

test("rejects the Mintlify contextual page-actions menu", async (t) => {
  const root = await createFixture({
    contextual: {
      options: ["copy", "view", "chatgpt"],
      display: "header",
    },
  });
  t.after(() => rm(root, { recursive: true, force: true }));

  const result = await runCheck(root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /docs\.json:\d+ \[contextual-menu\]/);
  assert.match(result.stderr, /page-copy, raw Markdown, and AI handoff actions remain disabled/);
});
