const FLIGHT_CHUNK_PATTERN =
  /self\.__next_f\.push\(\[\d+\s*,\s*("(?:\\.|[^"\\])*")\s*\]\)/g;
const FLIGHT_TEXT_RECORD_PATTERN = /^([a-z0-9]+):T[0-9a-f]+,$/i;
const JAVASCRIPT_BINDING_PATTERN =
  /"filePath":"([^"]+)"[\s\S]*?"content":"\$([a-z0-9]+)"/gi;
const CSS_BINDING_PATTERN =
  /"data-custom-css-path":"([^"]+)"[\s\S]*?"__html":"\$([a-z0-9]+)"/gi;
const FORBIDDEN_HOME_CONTROLS = [
  ["Mintlify contextual page-actions menu", /id=["']page-context-menu-button["']/i],
  ["Mintlify documentation assistant", /id=["']chat-assistant-textarea["']/i],
];

function normalizeAssetPath(path) {
  return path.replace(/^\/+/, "");
}

function normalizeTrackedText(value) {
  return value.replace(/\r\n/g, "\n").trimEnd();
}

export function flightPayloadsFromHtml(html) {
  const payloads = [];
  for (const match of html.matchAll(FLIGHT_CHUNK_PATTERN)) {
    try {
      payloads.push(JSON.parse(match[1]));
    } catch {
      // Invalid Flight chunks cannot provide authoritative embedded assets.
    }
  }
  return payloads;
}

export function embeddedCustomAssetsFromHtml(html) {
  const payloads = flightPayloadsFromHtml(html);
  const textRecords = new Map();
  const assets = new Map();

  for (let index = 0; index < payloads.length - 1; index += 1) {
    const record = payloads[index].match(FLIGHT_TEXT_RECORD_PATTERN);
    if (record) textRecords.set(record[1], payloads[index + 1]);
  }

  function collectBindings(pattern) {
    for (const payload of payloads) {
      for (const match of payload.matchAll(pattern)) {
        const path = normalizeAssetPath(match[1]);
        const bindings = assets.get(path) || [];
        bindings.push({ id: match[2], content: textRecords.get(match[2]) });
        assets.set(path, bindings);
      }
    }
  }

  collectBindings(JAVASCRIPT_BINDING_PATTERN);
  collectBindings(CSS_BINDING_PATTERN);
  return assets;
}

export function embeddedCustomAssetFindings(html, expectedAssets) {
  const embeddedAssets = embeddedCustomAssetsFromHtml(html);
  const findings = [];

  for (const [expectedPath, expectedContent] of expectedAssets) {
    const path = normalizeAssetPath(expectedPath);
    const bindings = embeddedAssets.get(path);
    if (!bindings || bindings.length === 0) {
      findings.push({ path: expectedPath, message: "embedded custom asset declaration is missing" });
      continue;
    }

    const contents = bindings
      .map((binding) => binding.content)
      .filter((content) => typeof content === "string");
    if (contents.length === 0) {
      findings.push({ path: expectedPath, message: "embedded custom asset payload is missing" });
      continue;
    }

    const normalizedContents = new Set(contents.map(normalizeTrackedText));
    if (normalizedContents.size > 1) {
      findings.push({ path: expectedPath, message: "embedded custom asset has conflicting payloads" });
      continue;
    }
    if (!normalizedContents.has(normalizeTrackedText(expectedContent))) {
      findings.push({
        path: expectedPath,
        message: "embedded custom asset does not match the tracked release asset",
      });
    }
  }

  return findings;
}

export function forbiddenHomeControlFindings(html) {
  return FORBIDDEN_HOME_CONTROLS.filter(([, pattern]) => pattern.test(html)).map(
    ([name]) => ({ name, message: "unexpected AI-facing control is enabled" }),
  );
}

export function isVercelSecurityCheckpoint(status, body) {
  return status === 403 && /<title>\s*Vercel Security Checkpoint\s*<\/title>/i.test(body);
}

export function isRetryableLiveResponse(status, body) {
  return (
    isVercelSecurityCheckpoint(status, body) ||
    status === 408 ||
    status === 425 ||
    status === 429 ||
    status === 502 ||
    status === 503 ||
    status === 504
  );
}

export function liveRetryDelayMs(status, body, attempt) {
  const baseDelay = isVercelSecurityCheckpoint(status, body) ? 5_000 : 1_000;
  return baseDelay * 2 ** attempt;
}
