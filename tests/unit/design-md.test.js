import test from 'node:test';
import assert from 'node:assert/strict';
import {
  inferColorGroup,
  generateColorRole,
  assignColorSemantics,
  generateDesignMd,
  uniqueTokenKey,
} from '../../src/extractor-v2.js';

test('inferColorGroup understands plural extractor contexts', () => {
  assert.equal(inferColorGroup(['buttons', 'nav'], '#5e6ad2'), 'brand');
  assert.equal(inferColorGroup(['headings'], '#f7f8f8'), 'neutral');
  assert.equal(inferColorGroup(['badges'], '#db2777'), 'accent');
});

test('generateColorRole understands plural extractor contexts', () => {
  const role = generateColorRole({ hex: '#5e6ad2' }, ['buttons', 'nav']);
  assert.match(role, /CTA|Primary|button/i);
});

test('assignColorSemantics maps text/background/primary roles', () => {
  const colors = assignColorSemantics([
    {
      hex: '#f7f8f8',
      frequency: 200,
      contexts: ['headings', 'buttons', 'links'],
      properties: ['color'],
      name: 'White',
      group: 'neutral',
      role: 'text',
    },
    {
      hex: '#08090a',
      frequency: 80,
      contexts: ['backgrounds'],
      properties: ['backgroundColor'],
      name: 'Ink',
      group: 'neutral',
      role: 'bg',
    },
    {
      hex: '#5e6ad2',
      frequency: 40,
      contexts: ['buttons', 'nav'],
      properties: ['backgroundColor', 'color'],
      name: 'Indigo',
      group: 'brand',
      role: 'brand',
    },
    {
      hex: '#62666d',
      frequency: 60,
      contexts: ['buttons'],
      properties: ['color'],
      name: 'Muted',
      group: 'neutral',
      role: 'muted',
    },
  ]);

  const byHex = Object.fromEntries(colors.map((c) => [c.hex, c]));
  assert.equal(byHex['#f7f8f8'].semantic, 'text');
  assert.equal(byHex['#08090a'].semantic, 'background');
  assert.equal(byHex['#5e6ad2'].semantic, 'primary');
  assert.equal(byHex['#62666d'].semantic, 'text');
  assert.ok(byHex['#f7f8f8'].semanticKey);
  assert.ok(byHex['#62666d'].semanticKey);
  assert.notEqual(byHex['#f7f8f8'].semanticKey, byHex['#62666d'].semanticKey);
});

test('uniqueTokenKey avoids collisions', () => {
  const used = new Set();
  assert.equal(uniqueTokenKey('Deep Azure', used), 'deep-azure');
  assert.equal(uniqueTokenKey('Deep Azure', used), 'deep-azure-2');
  assert.equal(uniqueTokenKey('Deep Azure', used), 'deep-azure-3');
});

test('generateDesignMd emits stitch-like agent sections and valid unique yaml keys', () => {
  const colors = assignColorSemantics([
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
  ]);

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
  assert.match(md, /## Typography\n/);
  assert.match(md, /## Layout\n/);
  assert.match(md, /## Elevation/);
  assert.match(md, /## Shapes\n/);
  assert.match(md, /## Components\n/);
  assert.match(md, /## Do's and Don'ts\n/);
  assert.match(md, /## Agent Prompt Guide\n/);
  assert.match(md, /primary:/);
  assert.match(md, /text:/);
  assert.match(md, /background:/);
  assert.match(md, /cubic-bezier\(0\.25, 0\.1, 0\.25, 1\)/);
  assert.ok(md.length > 3500, `expected stitch-like length, got ${md.length}`);

  const frontMatter = md.slice(3, md.indexOf('\n---\n', 3));
  const colorLines = frontMatter.split('\n').filter((l) => /^\s{2}[A-Za-z0-9_-]+:\s*"#/.test(l));
  const keys = colorLines.map((l) => l.trim().split(':')[0]);
  assert.equal(keys.length, new Set(keys).size, `duplicate yaml color keys: ${keys.join(', ')}`);
});
