#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import process from "node:process";

const findings = [];

async function text(file) {
  return readFile(new URL(`../${file}`, import.meta.url), "utf8");
}

function requireText(source, file, expected, reason) {
  if (!source.includes(expected)) findings.push(`${file}: ${reason}`);
}

function forbidText(source, file, forbidden, reason) {
  if (source.includes(forbidden)) findings.push(`${file}: ${reason}`);
}

const [client, styles, configSource, support, mintignore, workflow, packageSource] =
  await Promise.all([
    text("intercom-support.js"),
    text("intercom-support.css"),
    text("docs.json"),
    text("support/index.mdx"),
    text(".mintignore"),
    text(".github/workflows/docs-quality.yml"),
    text("package.json"),
  ]);

const config = JSON.parse(configSource);
const packageJson = JSON.parse(packageSource);

if (config.integrations?.intercom) {
  findings.push("docs.json: native Intercom integration would load before consent");
}

for (const [expected, reason] of [
  ['const APP_ID = "v8fbftfu"', "approved Messenger app ID is missing"],
  ['const API_BASE = "https://api-iam.intercom.io"', "US Intercom API base is missing"],
  ['hide_default_launcher: true', "default Intercom launcher must stay hidden"],
  ['const CONSENT_COOKIE = "introd.analytics-consent"', "shared consent cookie is missing"],
  ['window.navigator.globalPrivacyControl === true', "GPC gate is missing"],
  ['doNotTrack === "1"', "Do Not Track gate is missing"],
  ['effectiveConsent() !== "granted"', "Messenger loading must fail closed"],
  ['script.src = INTERCOM_SCRIPT_URL', "Intercom must load lazily after consent"],
  ['callIntercom("shutdown")', "consent withdrawal must shut Messenger down"],
  ['clearIntercomCookies()', "consent withdrawal must clear Messenger cookies"],
  ['Domain=.getintrod.ai', "cross-subdomain cookie cleanup is missing"],
  ['href = "mailto:help@getintrod.ai"', "accessible email fallback is missing"],
  ['setAttribute("aria-labelledby"', "dialog labelling is missing"],
  ['openCookieSettings', "reversible cookie settings control is missing"],
  ['window.location.pathname', "path-only SPA navigation tracking is missing"],
  ['callIntercom("update");', "SPA navigation must update Messenger without attributes"],
  ['new MutationObserver(synchronizeRoute)', "Mintlify client-side navigation observer is missing"],
]) {
  requireText(client, "intercom-support.js", expected, reason);
}

const settingsMatch = client.match(
  /const INTERCOM_SETTINGS = Object\.freeze\(\{([\s\S]*?)\}\);/,
);
if (!settingsMatch) {
  findings.push("intercom-support.js: exact anonymous Intercom settings object is missing");
} else {
  const keys = [...settingsMatch[1].matchAll(/^\s*([a-z_]+):/gm)].map((match) => match[1]);
  const expectedKeys = ["api_base", "app_id", "hide_default_launcher"];
  if (JSON.stringify(keys) !== JSON.stringify(expectedKeys)) {
    findings.push(
      `intercom-support.js: anonymous settings keys must be ${expectedKeys.join(", ")}; received ${keys.join(", ")}`,
    );
  }
}

for (const forbidden of ["user_id:", "email:", "name:", "phone:", "company:", "custom_attributes:", "intercom_user_jwt:"]) {
  forbidText(client, "intercom-support.js", forbidden, `PII/authenticated field is forbidden: ${forbidden}`);
}
forbidText(
  client,
  "intercom-support.js",
  "window.intercomSettings =",
  "global settings could auto-boot Messenger before the explicit consent-controlled boot",
);
forbidText(
  client,
  "intercom-support.js",
  "window.location.search",
  "SPA support updates must not collect query parameters",
);
forbidText(
  client,
  "intercom-support.js",
  "window.location.href",
  "SPA support updates must not pass full URLs",
);

for (const [expected, reason] of [
  ["#introd-support-controls", "support control styling is missing"],
  [".introd-support-dialog", "support dialog styling is missing"],
  [":focus-visible", "keyboard focus styling is missing"],
  ["@media (max-width: 40rem)", "mobile support styling is missing"],
]) {
  requireText(styles, "intercom-support.css", expected, reason);
}

requireText(
  configSource,
  "docs.json",
  "#introd-cookie-settings",
  "docs.json footer must expose persistent cookie settings",
);
requireText(support, "support/index.mdx", "AI-assisted support", "support page disclosure is missing");
requireText(support, "support/index.mdx", "Cookie settings", "support page cookie control guidance is missing");
requireText(support, "support/index.mdx", "help@getintrod.ai", "support page email fallback is missing");

for (const bundledAsset of ["intercom-support.js", "intercom-support.css"]) {
  if (mintignore.split(/\r?\n/).map((line) => line.trim()).includes(bundledAsset)) {
    findings.push(`.mintignore: ${bundledAsset} must remain available to Mintlify's global bundler`);
  }
}

requireText(
  workflow,
  ".github/workflows/docs-quality.yml",
  "npm run check:intercom",
  "GitHub docs-quality workflow must enforce the Intercom contract",
);
if (packageJson.scripts?.["check:intercom"] !== "node scripts/check-intercom-support.mjs") {
  findings.push("package.json: check:intercom must execute the contract verifier");
}
requireText(
  packageJson.scripts?.check || "",
  "package.json",
  "check:intercom",
  "the local full gate must include the Intercom contract",
);
const liveGate = await text("scripts/check-live-docs.mjs");
for (const asset of ["/intercom-support.js", "/intercom-support.css"]) {
  requireText(liveGate, "scripts/check-live-docs.mjs", asset, `live gate must verify ${asset}`);
}

if (findings.length) {
  console.error(`Intercom docs contract failed with ${findings.length} finding(s):`);
  findings.forEach((finding) => console.error(`- ${finding}`));
  process.exitCode = 1;
} else {
  console.log(
    "Intercom docs contract verified: consent/GPC gating, anonymous US boot, hidden launcher, cleanup, accessible fallback, and reversible settings.",
  );
}
