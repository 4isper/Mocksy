#!/usr/bin/env node
/**
 * npm audit wrapper that fails only on advisory IDs NOT in the known allowlist.
 *
 * The allowlisted advisories are all transitive dev/build-time dependencies —
 * postcss/sharp bundled inside next, and tmp/uuid pulled in by @lhci/cli.
 * There is no safe fix: `npm audit fix --force` would downgrade next to 9.3.3
 * (breaking). None of these reach the client bundle. Revisit and prune the
 * list when next/@lhci/cli bump the offending packages upstream.
 */
import { execFileSync } from "node:child_process";

const KNOWN = new Set([
  "GHSA-qx2v-qp2m-jg93", // postcss (next) — XSS in CSS stringify
  "GHSA-6g55-p6wh-862q", // postcss (next) — sourceMappingURL file read
  "GHSA-r28c-9q8g-f849", // postcss (next) — source map path traversal
  "GHSA-f88m-g3jw-g9cj", // sharp (next) — libvips CVEs
  "GHSA-52f5-9888-hmc6", // tmp (@lhci/cli) — symlink in dir param
  "GHSA-ph9p-34f9-6g65", // tmp (@lhci/cli) — prefix/postfix traversal
  "GHSA-w5hq-g745-h8pq", // uuid (@lhci/cli) — buffer bounds check
]);

function parseAudit(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

let data;
try {
  const stdout = execFileSync("npm", ["audit", "--json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  data = parseAudit(stdout);
} catch (err) {
  const stdout = typeof err.stdout === "string" ? err.stdout : "";
  data = parseAudit(stdout) ?? parseAudit(typeof err.stderr === "string" ? err.stderr : "");
}
if (!data) {
  console.error("npm audit failed");
  process.exit(1);
}

const found = new Set();
for (const info of Object.values(data.vulnerabilities ?? {})) {
  for (const via of info.via ?? []) {
    if (typeof via === "object" && via.url) {
      const id = via.url.split("/").pop();
      if (id) found.add(id);
    }
  }
}

const unknown = [...found].filter((id) => !KNOWN.has(id)).sort();
if (unknown.length > 0) {
  console.error(`audit FAIL: ${unknown.length} advisory(ies) not in allowlist: ${unknown.join(", ")}`);
  process.exit(1);
}

console.log(`audit ok: ${found.size} known advisory(ies), no new ones.`);
