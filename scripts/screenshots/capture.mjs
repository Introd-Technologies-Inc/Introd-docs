#!/usr/bin/env node
// Introd docs screenshot pipeline. Direct Playwright captures of the REAL dashboard frontend running
// against the dashboard's synthetic fixture API (npm run dev:fixtures). No mockups, no image editing.
// See scripts/screenshots/README.md. This is NOT staging and NOT production.
//
//   node scripts/screenshots/capture.mjs [--only id,id] [--labels-only]
import { createRequire } from "node:module";
import { spawn, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const docsRoot = path.resolve(here, "..", "..");
const DASHBOARD_REPO =
  process.env.DASHBOARD_REPO ||
  "L:/projects/Introd Technologies Inc/worktrees/introd-dashboard/docs-screenshots";
const APP = process.env.FIXTURE_BASE_URL || "http://127.0.0.1:8081";
const FIXTURE_API = process.env.FIXTURE_API_URL || "http://127.0.0.1:8082";
const ENVIRONMENT = "fixture: real dashboard frontend, synthetic API";

// Safety: this pipeline only ever talks to loopback fixture hosts.
for (const u of [APP, FIXTURE_API]) {
  const host = new URL(u).hostname;
  if (!["127.0.0.1", "localhost"].includes(host)) {
    console.error(`Refusing non-loopback host ${host}. This pipeline is fixture-only.`);
    process.exit(2);
  }
}

const require = createRequire(path.join(DASHBOARD_REPO, "package.json"));
const { chromium } = require("@playwright/test");
const playwrightVersion = require("@playwright/test/package.json").version;

const args = process.argv.slice(2);
const only = args.includes("--only") ? args[args.indexOf("--only") + 1].split(",") : null;
const config = JSON.parse(readFileSync(path.join(here, "captures.json"), "utf8"));
const VIEWPORTS = config.viewports;
const FORBIDDEN = [/owen/i, /sakawa/i, /elloe/i];
const EMAIL = /[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;

const git = (a) => execFileSync("git", ["-C", DASHBOARD_REPO, ...a], { encoding: "utf8" }).trim();
const dashboardCommit = git(["rev-parse", "HEAD"]);
const dashboardCommitSubject = git(["log", "-1", "--format=%s"]);

const outDir = path.join(docsRoot, "images", "product");
const artDir = path.join(docsRoot, "artifacts", "screenshots");
mkdirSync(outDir, { recursive: true });
mkdirSync(artDir, { recursive: true });

async function up(url) {
  try {
    const r = await fetch(url);
    return r.status < 500;
  } catch {
    return false;
  }
}

let server = null;
async function ensureApp() {
  if (await up(APP)) return;
  console.log("Starting fixture app (npm run dev:fixtures)...");
  server = spawn("npm", ["run", "dev:fixtures"], {
    cwd: DASHBOARD_REPO,
    shell: true,
    stdio: "ignore",
  });
  for (let i = 0; i < 90; i++) {
    if (await up(APP)) return;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("Fixture app did not start within 90s");
}

async function resetFixtures() {
  const r = await fetch(`${FIXTURE_API}/__fixture/reset`, { method: "POST" });
  if (!r.ok) throw new Error(`fixture reset failed: ${r.status}`);
}

const locate = (page, spec) => {
  if (typeof spec === "string") return page.getByText(spec).first();
  if (spec.role) return page.getByRole(spec.role, { name: spec.name, exact: spec.exact }).first();
  if (spec.label) return page.getByLabel(spec.label, { exact: spec.exact }).first();
  if (spec.placeholder) return page.getByPlaceholder(spec.placeholder).first();
  if (spec.text) return page.getByText(spec.text, { exact: spec.exact }).first();
  throw new Error(`bad locator ${JSON.stringify(spec)}`);
};

async function settle(page, ms) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(ms);
}

async function declineAnalytics(page) {
  await page
    .getByRole("button", { name: "Decline analytics" })
    .click({ timeout: 1500 })
    .catch(() => {});
}

async function runStep(page, step) {
  if (step.click) await locate(page, step.click).click({ timeout: 8000 });
  else if (step.fill) await locate(page, step.fill).fill(step.fill.value, { timeout: 8000 });
  else if (step.check) await locate(page, step.check).check({ timeout: 8000 });
  else if (step.waitForText)
    await page.getByText(step.waitForText).first().waitFor({ state: "visible", timeout: 15000 });
  else if (step.wait) await page.waitForTimeout(step.wait);
  else if (step.goto) {
    await page.goto(APP + step.goto);
    await declineAnalytics(page);
  } else if (step.gotoFromClipboard) {
    // The app copies the private link to the clipboard when the user clicks "Copy private link".
    const text = await page.evaluate(() => navigator.clipboard.readText());
    const m = text.match(new RegExp(step.gotoFromClipboard));
    if (!m) throw new Error("clipboard did not contain a URL matching " + step.gotoFromClipboard);
    await page.goto(m[0].startsWith("http") ? m[0] : APP + m[0]);
    await declineAnalytics(page);
  } else if (step.gotoFromText) {
    // Follow a URL that the app itself displayed (e.g. the connector review link).
    const body = await page.evaluate(
      () =>
        document.body.innerText +
        " " +
        [...document.querySelectorAll("a,input")].map((e) => e.href || e.value).join(" "),
    );
    const m = body.match(new RegExp(step.gotoFromText));
    if (!m) throw new Error(`no URL matching ${step.gotoFromText} displayed by the app`);
    const u = m[0].startsWith("http") ? m[0] : APP + m[0];
    await page.goto(u);
    await declineAnalytics(page);
  } else throw new Error(`unknown step ${JSON.stringify(step)}`);
  await page.waitForTimeout(step.settle ?? 500);
}

async function collectLabels(page) {
  return page.evaluate(() => {
    const vis = (e) => !!(e.offsetWidth || e.offsetHeight || e.getClientRects().length);
    const t = (e) => (e.innerText || e.textContent || "").replace(/\s+/g, " ").trim();
    const uniq = (a) => [...new Set(a.filter(Boolean))];
    const q = (sel) => uniq([...document.querySelectorAll(sel)].filter(vis).map(t));
    const root = document.querySelector("main") || document.body;
    const labelOf = (e) =>
      e.getAttribute("aria-label") ||
      (e.labels && e.labels[0] && t(e.labels[0])) ||
      e.placeholder ||
      e.name ||
      "";
    return {
      title: document.title,
      headings: uniq([...root.querySelectorAll("h1,h2,h3,h4")].filter(vis).map(t)),
      tabs: q('[role="tab"]'),
      buttons: uniq(
        [...document.querySelectorAll("button,[role=button]")]
          .filter(vis)
          .map(
            (e) =>
              t(e) + (e.disabled || e.getAttribute("aria-disabled") === "true" ? " [disabled]" : ""),
          ),
      ),
      links: uniq([...root.querySelectorAll("a")].filter(vis).map(t)),
      switchesAndCheckboxes: uniq(
        [...document.querySelectorAll('[role="switch"],input[type="checkbox"]')].map(
          (e) => (labelOf(e) || t(e.parentElement)) + (e.disabled ? " [disabled]" : ""),
        ),
      ),
      fields: uniq(
        [...document.querySelectorAll("input,textarea,select")].filter(vis).map(labelOf),
      ),
      textLines: uniq(root.innerText.split("\n").map((s) => s.trim())),
    };
  });
}

async function forbiddenHits(page) {
  const text = await page.evaluate(() => document.body.innerText);
  const hits = [];
  for (const re of FORBIDDEN) if (re.test(text)) hits.push(String(re));
  for (const m of text.matchAll(EMAIL)) {
    if (!/(^|\.)example\.(com|edu)$/i.test(m[1])) hits.push(`email:${m[0]}`);
  }
  return hits;
}

const sha = (b) => createHash("sha256").update(b).digest("hex");
const pngSize = (b) => ({ width: b.readUInt32BE(16), height: b.readUInt32BE(20) });

async function main() {
  await ensureApp();
  const browser = await chromium.launch(
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : {},
  );
  const manifest = [];
  const labels = {};
  const date = new Date().toISOString();

  for (const vpName of Object.keys(VIEWPORTS)) {
    const vp = VIEWPORTS[vpName];
    let ctx = null;
    let page = null;
    const pages = {}; // id -> page, for continueFrom chains
    for (const cap of config.captures) {
      if (only && !only.includes(cap.id)) continue;
      if (cap.viewports && !cap.viewports.includes(vpName)) continue;
      const file = `dash-${cap.surface}-${cap.state}-${vpName}.png`;
      const entry = {
        id: `${cap.id}-${vpName}`,
        file: `images/product/${file}`,
        route: cap.route,
        viewport: `${vp.width}x${vp.height}@${vp.deviceScaleFactor}x`,
        environment: ENVIRONMENT,
        dashboardCommit,
        dashboardCommitSubject,
        captureDate: date,
        playwrightVersion,
        docPages: cap.docPages || [],
        description: cap.description,
        caveats: cap.caveats || "",
        required: cap.required !== false && !cap.bonus,
        bonus: !!cap.bonus,
        assertions: [],
        status: "failed",
        reason: "",
      };
      try {
        if (cap.continueFrom) {
          page = pages[cap.continueFrom];
          if (!page) throw new Error(`continueFrom ${cap.continueFrom} not available`);
        } else {
          if (ctx) await ctx.close();
          await resetFixtures();
          ctx = await browser.newContext({
            viewport: { width: vp.width, height: vp.height },
            deviceScaleFactor: vp.deviceScaleFactor,
            isMobile: vpName === "mobile",
            permissions: ["clipboard-read", "clipboard-write"],
          });
          page = await ctx.newPage();
          await page.goto(APP + cap.route, { waitUntil: "networkidle" });
          await declineAnalytics(page);
        }
        pages[cap.id] = page;
        for (const step of cap.steps || []) await runStep(page, step);
        await settle(page, cap.stabilityMs ?? 1500);
        await declineAnalytics(page);

        labels[`${cap.id}@${vpName}`] = {
          route: cap.route,
          url: page.url().replace(APP, ""),
          ...(await collectLabels(page)),
        };

        if (cap.unavailable) {
          entry.status = "unavailable";
          entry.reason = cap.unavailable;
          manifest.push(entry);
          console.log(`unavailable ${entry.id}`);
          continue;
        }
        if (cap.mobileUnavailable && vpName === "mobile") {
          entry.status = "unavailable";
          entry.reason = cap.mobileUnavailable;
          manifest.push(entry);
          continue;
        }
        for (const e of cap.expect || []) {
          await locate(page, e)
            .waitFor({ state: "visible", timeout: 8000 })
            .catch(() => {
              throw new Error(`expected label not found: ${JSON.stringify(e)}`);
            });
          entry.assertions.push(
            typeof e === "string" ? e : e.name || e.text || e.label || e.placeholder,
          );
        }
        for (const e of cap.expectAbsent || []) {
          if (await page.getByText(e).first().isVisible().catch(() => false))
            throw new Error(`unexpected text present: ${e}`);
          entry.assertions.push(`absent:${e}`);
        }
        const hits = await forbiddenHits(page);
        if (hits.length) throw new Error(`forbidden strings in rendered text: ${hits.join(", ")}`);
        entry.assertions.push("no forbidden strings (Owen/Sakawa/Elloe/non-example emails)");

        if (!args.includes("--labels-only")) {
          const buf = await page.screenshot({
            fullPage: cap.fullPage !== false,
            animations: "disabled",
          });
          writeFileSync(path.join(outDir, file), buf);
          Object.assign(entry, { sha256: sha(buf), bytes: buf.length, ...pngSize(buf) });
          if (buf.length > 500 * 1024)
            entry.caveats += ` File is ${Math.round(buf.length / 1024)}KB (over 500KB target).`;
        }
        entry.status = "captured";
      } catch (err) {
        entry.status = "failed";
        entry.reason = String(err.message || err).split("\n")[0];
      }
      manifest.push(entry);
      console.log(
        `${entry.status.padEnd(11)} ${entry.id}${entry.reason ? "  - " + entry.reason : ""}`,
      );
    }
    if (ctx) await ctx.close();
  }
  await browser.close();
  if (server) server.kill();

  writeFileSync(
    path.join(artDir, "manifest.json"),
    JSON.stringify(
      {
        generatedBy: "scripts/screenshots/capture.mjs",
        environment: ENVIRONMENT,
        dashboardCommit,
        dashboardCommitSubject,
        shots: manifest,
      },
      null,
      2,
    ),
  );
  writeFileSync(
    path.join(artDir, "ui-labels.json"),
    JSON.stringify({ environment: ENVIRONMENT, dashboardCommit, pages: labels }, null, 2),
  );

  const rows = manifest.map((m) => {
    const cell = (v) => String(v || "").replace(/\|/g, "/").replace(/\s+/g, " ");
    return "| " + [m.file.replace("images/product/", ""), m.description, m.route, m.viewport, m.status + (m.bonus ? " (bonus)" : ""), (m.docPages || []).join(", "), m.status === "captured" ? m.caveats : m.reason].map(cell).join(" | ") + " |";
  });
  writeFileSync(
    path.join(artDir, "inventory.md"),
    [
      "# Screenshot inventory",
      "",
      `Environment: ${ENVIRONMENT}. Dashboard commit ${dashboardCommit}. NOT staging, NOT production; fixture states do not demonstrate live feature gating or API-driven availability. Doc-page names are suggestions for the docs owner.`,
      "",
      "| File | What it shows | Route | Viewport | Status | Suggested doc page(s) | Caveats / reason |",
      "| --- | --- | --- | --- | --- | --- | --- |",
      ...rows,
      "",
    ].join("\n"),
  );

  const count = (s) => manifest.filter((m) => m.status === s).length;
  console.log(
    `captured=${count("captured")} unavailable=${count("unavailable")} failed=${count("failed")}`,
  );
  process.exit(manifest.some((m) => m.status === "failed" && m.required) ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
