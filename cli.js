#!/usr/bin/env node
/**
 * design-extractor CLI (v2)
 * Usage: node cli.js <url> [--output file.md] [--no-ai]
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// 加载 .env.local（Next.js 约定）
dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '.env.local') });
import { extractDesignTokens } from './src/extractor-v2.js';
import * as fs from 'fs';

const args = process.argv.slice(2);

if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
  console.log(`
design-extractor — Extract DESIGN.md from any website

Usage:
  node cli.js <url> [--output file.md] [--no-ai] [--verbose]

Options:
  --output file.md   Save output to file
  --no-ai            Skip AI enrichment (faster, no semantic names)
  --verbose, -v      Show detailed progress

Examples:
  node cli.js https://stripe.com
  node cli.js https://linear.app --output linear-design.md
  node cli.js https://notion.so --output notion.md --no-ai
`);
  process.exit(0);
}

const verbose = args.includes('--verbose') || args.includes('-v');
const useAI = !args.includes('--no-ai');
const outputIdx = args.indexOf('--output');
const outputFile = outputIdx !== -1 ? args[outputIdx + 1] : null;
const url = args.find(a => !a.startsWith('--'));

if (!url) {
  console.error('Error: Please provide a URL');
  process.exit(1);
}

try {
  if (verbose) console.error(`\n🔍 Extracting design tokens from: ${url}${useAI ? ' (with AI)' : ' (fast mode)'}\n`);

  const result = await extractDesignTokens(url, { useAI });

  const { siteName, colors, designMd, northStar } = result;

  if (outputFile) {
    fs.writeFileSync(outputFile, designMd, 'utf8');
    console.log(`\n✅ Generated: ${outputFile}`);
  } else {
    console.log(designMd);
  }

  if (verbose) {
    console.error(`
📊 Extraction summary:
   URL: ${url}
   Site name: ${siteName}
   Colors extracted: ${colors?.length || 0}
   AI enriched: ${useAI ? 'Yes' : 'No'}
${northStar ? `   Design philosophy: "${northStar}"` : ''}
`);
  }

} catch (error) {
  console.error(`\n❌ Error: ${error.message}`);
  if (verbose) console.error(error.stack);
  process.exit(1);
}
