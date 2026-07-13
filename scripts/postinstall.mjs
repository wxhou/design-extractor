#!/usr/bin/env node
/**
 * Postinstall script — patches playwright-core/coreBundle.js so the
 * `require('./browsers.json')` call has a fallback inline value.
 *
 * WHY: @vercel/nft doesn't trace the dynamic require() for browsers.json,
 * so Vercel serverless deployments are missing the file at runtime.
 *
 * This script inlines the browsers.json content as a fallback, so the
 * module loads even when browsers.json isn't deployed separately.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const coreBundlePath = join(ROOT, 'node_modules', 'playwright-core', 'lib', 'coreBundle.js');
const browsersJsonPath = join(ROOT, 'node_modules', 'playwright-core', 'browsers.json');

if (!existsSync(coreBundlePath)) {
  console.log('[postinstall] playwright-core/coreBundle.js not found — skipping patch');
  process.exit(0);
}

if (!existsSync(browsersJsonPath)) {
  console.log('[postinstall] playwright-core/browsers.json not found — skipping patch');
  process.exit(0);
}

const browsersJson = JSON.parse(readFileSync(browsersJsonPath, 'utf-8'));
const browsersJsonStr = JSON.stringify(browsersJson);

let code = readFileSync(coreBundlePath, 'utf-8');

// The require pattern used in coreBundle.js — e.g. `require(p.join(packageRoot, "browsers.json"))`
// The variable names vary (import_path19, path_default, etc.), so we match flexibly.
const patterns = [
  // Pattern: require(import_pathXX.default.join(packageRoot, "browsers.json"))
  /require\([a-zA-Z_$][\w$]*(?:\.default)?\s*\.\s*join\s*\(\s*packageRoot\s*,\s*["']browsers\.json["']\s*\)\)/g,
  // Pattern: require(p.join(linkTarget, "browsers.json"))
  /require\([a-zA-Z_$][\w$]*(?:\.default)?\s*\.\s*join\s*\(\s*linkTarget\s*,\s*["']browsers\.json["']\s*\)\)/g,
];

let matchCount = 0;
for (const pattern of patterns) {
  code = code.replace(pattern, (match) => {
    matchCount++;
    // Wrap in try-catch: try the original require first, fall back to inline data
    return `(() => { try { return ${match}; } catch { return ${browsersJsonStr}; } })()`;
  });
}

if (matchCount === 0) {
  console.log('[postinstall] WARNING: No browsers.json require() calls found in coreBundle.js — patch may be out of date');
  console.log('[postinstall] coreBundle.js hash:', createHash(code));
} else {
  writeFileSync(coreBundlePath, code, 'utf-8');
  console.log(`[postinstall] ✅ Patched playwright-core/coreBundle.js — ${matchCount} browsers.json require() calls wrapped with inline fallback`);
}

function createHash(s) {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    const char = s.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}