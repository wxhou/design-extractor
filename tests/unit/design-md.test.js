import test from 'node:test';
import assert from 'node:assert/strict';
import { inferColorGroup, generateColorRole } from '../../src/color-utils.js';
import { generateDesignMd } from '../../src/code-generators.js';

test('inferColorGroup classifies singular extractor contexts', () => {
  assert.equal(inferColorGroup(['button'], '#5e6ad2'), 'brand');
  assert.equal(inferColorGroup(['headings'], '#f7f8f8'), 'neutral');
  assert.equal(inferColorGroup(['badges'], '#db2777'), 'accent');
});

test('generateColorRole understands plural extractor contexts', () => {
  const role = generateColorRole({ hex: '#5e6ad2' }, ['buttons', 'nav']);
  assert.match(role, /CTA|Primary|button/i);
});

// assignColorSemantics / uniqueTokenKey tests removed: these functions were
// replaced by LLM enrichment (src/ai-enrich.js) in the extractor-v2 refactor.

test('generateDesignMd emits stitch-like agent sections and valid unique yaml keys', () => {
  const colors = [
    {
      hex: '#f7f8f8',
      frequency: 200,
      contexts: ['headings', 'links'],
      properties: ['color'],
      name: 'White',
      group: 'neutral',
      role: 'Primary text',
    },
    {
      hex: '#08090a',
      frequency: 90,
      contexts: ['backgrounds'],
      properties: ['backgroundColor'],
      name: 'Deep Azure',
      group: 'neutral',
      role: 'Page background',
    },
    {
      hex: '#24282c',
      frequency: 40,
      contexts: ['cards', 'backgrounds'],
      properties: ['backgroundColor'],
      name: 'Deep Azure',
      group: 'neutral',
      role: 'Surface',
    },
    {
      hex: '#5e6ad2',
      frequency: 30,
      contexts: ['buttons', 'nav'],
      properties: ['backgroundColor'],
      name: 'Indigo',
      group: 'brand',
      role: 'Primary action',
    },
  ];

  const md = generateDesignMd({
    siteName: 'Linear',
    url: 'https://linear.app',
    northStar: 'Productive dark UI with restrained accent.',
    colorScheme: 'dark',
    colors,
    fonts: [
      { fontFamily: 'Inter Variable', weights: ['400', '500', '600'], source: 'google' },
      { fontFamily: 'Berkeley Mono', weights: ['400'], source: 'custom' },
    ],
    typeScale: {
      base: 13,
      steps: [
        { name: 'h1', size: '64px', px: 64, fontWeight: '500', lineHeight: '72px' },
        { name: 'body', size: '15px', px: 15, fontWeight: '400', lineHeight: '24px' },
      ],
    },
    spacing: {
      tokens: {
        'spacing-xs': '8px',
        'spacing-sm': '12px',
        'spacing-md': '16px',
        'spacing-lg': '24px',
      },
    },
    shadows: {
      tokens: {
        'shadow-sm': 'rgba(0, 0, 0, 0.4) 0px 2px 4px 0px',
      },
    },
    borderRadius: {
      tokens: {
        'radius-sm': '2px',
        'radius-md': '6px',
        'radius-full': '9999px',
      },
    },
    animations: {
      durationTokens: { tokens: { 'duration-fast': '0.1s', 'duration-base': '0.16s' } },
      easings: { 'cubic-bezier(0.25, 0.1, 0.25, 1)': { count: 10 } },
    },
    gradients: [],
  });

  assert.match(md, /^---\n/);
  assert.match(md, /\n---\n\n## Overview\n/);
  assert.match(md, /## Colors\n/);
  assert.match(md, /### Brand Colors\n/);
  assert.match(md, /### Neutral Colors\n/);
  assert.ok(md.length > 1500, `expected substantial output, got ${md.length}`);

  // Duplicate color names must not produce duplicate YAML keys
  const frontMatter = md.slice(3, md.indexOf('\n---\n', 3));
  const colorLines = frontMatter.split('\n').filter((l) => /^\s{2}[A-Za-z0-9_-]+:\s*"#/.test(l));
  const keys = colorLines.map((l) => l.trim().split(':')[0]);
  assert.equal(keys.length, new Set(keys).size, `duplicate yaml color keys: ${keys.join(', ')}`);
  assert.ok(keys.includes('deep-azure') && keys.includes('deep-azure-2'), `duplicate names should be suffixed: ${keys.join(', ')}`);
});
