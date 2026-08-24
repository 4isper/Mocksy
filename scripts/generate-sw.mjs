#!/usr/bin/env node
/**
 * Stamps a build-time cache version into public/sw.js from scripts/sw-template.js.
 *
 * The cache version is derived from the build time, so every deploy gets a fresh
 * cache name and the service worker's activate handler purges the previous
 * generation of cached chunks — no manual version bump required.
 *
 * Run automatically before `next build` (see package.json). In dev the committed
 * public/sw.js is served unchanged to keep the working tree stable.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const templatePath = join(root, "scripts", "sw-template.js");
const outputPath = join(root, "public", "sw.js");

const template = readFileSync(templatePath, "utf8");
if (!template.includes("__SW_VERSION__")) {
  throw new Error("scripts/sw-template.js is missing the __SW_VERSION__ placeholder");
}

const version = Date.now().toString(36);
const sw = template.replaceAll("__SW_VERSION__", version);
writeFileSync(outputPath, sw);
console.log(`generate-sw: wrote public/sw.js (cache version mocksy-sw-${version})`);
