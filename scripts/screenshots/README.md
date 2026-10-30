# Docs screenshot pipeline

Reusable capture of Introd product screenshots for the customer docs. Every PNG is a direct Playwright
capture of the real, rendered dashboard frontend. No mockups, no recreated layouts, no image editing,
no cropping, no overlays or blurring.

## What environment this is (and is not)

- It **is**: the real dashboard routes, components and server functions running through the dashboard's
  own fixture harness (`npm run dev:fixtures`: app on `http://127.0.0.1:8081`, fake API on `8082`)
  against clearly synthetic data (persona "Avery Example, Founder, Example Co"; people at `@example.com`).
- It is **not staging and not production**. Nothing here contacts `app.getintrod.ai`, `api.getintrod.ai`
  or any other real host, and no real credentials are used. `capture.mjs` refuses non-loopback hosts.
- Fixture states do **not** demonstrate live feature gating, plan entitlements, provider availability or any
  API-driven state. Where the fixture API does not serve an endpoint (billing status, workspace
  integrations), the real page renders a degraded state; those shots are recorded as `unavailable`
  instead of being faked. See `artifacts/screenshots/inventory.md` for per-shot caveats.

## Rerun

Prerequisites: a worktree of the dashboard repo at `origin/main` (commit recorded in the manifest) with
dependencies installed and the fixture-data patch applied.

```powershell
# 1. Dashboard worktree (do not commit anything there)
git -C "L:\projects\Introd Technologies Inc\introd-dashboard" worktree add --detach `
  "L:\projects\Introd Technologies Inc\worktrees\introd-dashboard\docs-screenshots" 51ccaba
cd "L:\projects\Introd Technologies Inc\worktrees\introd-dashboard\docs-screenshots"
git apply "L:\projects\Introd Technologies Inc\worktrees\introd-docs\stage-0-audit\scripts\screenshots\fixtures\synthetic-data.patch"
npm ci --ignore-scripts; npm rebuild esbuild      # esbuild needs its install script
npx playwright install chromium

# 2. Capture (starts the fixture app itself if it is not already running)
cd "L:\projects\Introd Technologies Inc\worktrees\introd-docs\stage-0-audit"
$env:DASHBOARD_REPO = "L:/projects/Introd Technologies Inc/worktrees/introd-dashboard/docs-screenshots"   # default
node scripts/screenshots/capture.mjs
```

Options: `--only id1,id2` (subset), `--labels-only` (refresh `ui-labels.json`/manifest without writing PNGs).
Optional env: `FIXTURE_BASE_URL`, `FIXTURE_API_URL` (loopback only), `PLAYWRIGHT_CHROMIUM_EXECUTABLE`
(use a specific Chromium build if the version Playwright expects is not installed).

Playwright is resolved from `DASHBOARD_REPO`, so the docs repo gets no new dependencies.

The synthetic-data patch replaces real-looking names, firms and domains in the dashboard's fixtures
(e2e/fixtures/**) with synthetic ones; data shapes are unchanged. Re-create it with `git diff` in the
dashboard worktree if the fixtures change.

## How it works

`captures.json` declares each capture: `id`, `surface`/`state` (output name
`images/product/dash-<surface>-<state>-<desktop|mobile>.png`), `route`, `steps` (real interactions only:
`click`, `fill`, `check`, `wait`, `waitForText`, `goto`, `gotoFromClipboard`), `expect` (labels/roles that must be
visible), `docPages`, `caveats`, optional `unavailable` reason, and `continueFrom` to chain a flow in one
page. Viewports: desktop 1440x900 @1x, mobile 390x844 @1x, full-page screenshots.

For each capture the script resets fixtures (`POST /__fixture/reset`), opens a fresh browser context, waits
for network idle and `document.fonts.ready`, dismisses the analytics banner with the real
"Decline analytics" button, runs the steps, asserts every expected label (failing loudly otherwise), scans the
rendered text for forbidden strings (`Owen`, `Sakawa`, `Elloe`, any email not on `example.com`/`example.edu`),
saves the PNG, and records the results. It exits non-zero if any required shot fails.

Outputs (in `artifacts/screenshots/`): `manifest.json` (sha256, bytes, size, route, viewport, environment,
dashboard commit + subject, date, Playwright version, assertions, status/reason), `ui-labels.json` (visible
headings, tabs, buttons, fields, text lines per page: the source for correcting docs wording), `inventory.md`.

## Switching to a real staging or test workspace later

The dashboard's `docs/visual-qa.md` documents authenticated runs against a non-production deployment:

```powershell
npx playwright codegen --save-storage=e2e/.auth/state.json https://your-staging-dashboard.example/sign-in
$env:INTROD_E2E_STORAGE_STATE = "e2e/.auth/state.json"
$env:INTROD_E2E_BASE_URL = "https://your-staging-dashboard.example"
$env:INTROD_E2E_API_URL = "https://your-staging-api.example"
```

The dashboard's Playwright config rejects known Introd production hosts. To use that environment with this
pipeline, the loopback guard and fixture reset in `capture.mjs` would need to be replaced with a storage-state
context and the staging base URL, and the staging workspace must be seeded with synthetic, non-customer data.
Until that exists, do not describe these images as staging or production verified.
