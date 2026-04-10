#!/usr/bin/env node
/**
 * Preset maker: parse a shaderbox URL (or query string) and print a PRESETS entry for src/constants.js.
 * Usage: npm run preset-maker -- 'http://localhost:5174/?p=11&pal=2&...'
 *    or: npm run preset-maker -- '?p=11&pal=2&...'
 *    or: echo '?p=11&pal=2&...' | npm run preset-maker
 * Output is copy-pasteable into the PRESETS array in src/constants.js.
 * Parsing matches App.jsx parseUrlState(); only params present in the URL are included in the preset.
 */

import { PATTERNS } from '../src/patterns/index.js';
import { PALETTE_NAMES } from '../src/uiConstants.js';

const RECT_ASPECT_DEFAULT = 36 / 40;

/** Parse search params into state-like object (mirrors App.jsx parseUrlState). */
function parseUrlState(search) {
  const params = new URLSearchParams(search);
  const out = {};
  const num = (paramKey, stateKey, min, max) => {
    const v = params.get(paramKey);
    if (v == null) return;
    const n = Number(v);
    if (!Number.isFinite(n)) return;
    out[stateKey] = (min != null && max != null) ? Math.max(min, Math.min(max, n)) : n;
  };
  const grad = (prefix) => {
    const raw = params.get(prefix === 'warp' ? 'warpG' : 'weftG');
    if (!raw) return;
    const parts = raw.split(',').map(Number);
    if (parts.length !== 5 || parts.some((x) => !Number.isFinite(x))) return;
    const [startShade, endShade, direction, r0, r1] = parts;
    out[prefix === 'warp' ? 'warpGradient' : 'weftGradient'] = {
      startShade: Math.max(0, Math.min(4, startShade)),
      endShade: Math.max(0, Math.min(4, endShade)),
      direction: direction === 1 ? 1 : 0,
      range: [Math.max(0, Math.min(100, r0)), Math.max(0, Math.min(100, r1))],
    };
  };
  num('p', 'pattern', 0, PATTERNS.length - 1);
  num('pal', 'palette', 0, 3);
  num('bg', 'bgShade', 0, 4);
  num('warp', 'warpShade', 0, 4);
  num('weft', 'weftShade', 0, 4);
  num('grid', 'gridSize', 8, 256);
  num('steps', 'gradSteps', 0, 16);
  num('rect', 'rectAspect', 0.5, 1);
  num('corner', 'cornerRadius', 0, 0.5);
  num('canvas', 'canvasAspect', 0.5, 2);
  num('all', 'useAllColorways', 0, 1);
  num('seed', 'colorwaySeed', 0, 999);
  num('shimmer', 'shimmer', 0, 1);
  num('shimmerSp', 'shimmerSpeed', 1, 16);
  num('shimmerW', 'shimmerWidth', 0.25, 24);
  num('shimmerInt', 'shimmerIntensity', 0, 1);
  num('shimmerPos', 'shimmerPosition', 0, 1);
  num('shimmerRot', 'shimmerRotation', 0, 1);
  num('shimmerN', 'shimmerNoise', 0, 1);
  num('shimmerNS', 'shimmerNoiseSeed', 0, 1);
  num('shimmerNMin', 'shimmerNoiseMin', 0, 2);
  num('shimmerNMax', 'shimmerNoiseMax', 0, 2);
  num('shimmerBlend', 'shimmerBlendMode', 0, 10);
  grad('warp');
  grad('weft');
  // Infer shimmer on when any shimmer param is present
  if (out.shimmer === undefined && (out.shimmerWidth !== undefined || out.shimmerIntensity !== undefined || out.shimmerPosition !== undefined || out.shimmerRotation !== undefined || out.shimmerNoise !== undefined || out.shimmerBlendMode !== undefined))
    out.shimmer = 1;
  return out;
}

/** Slug from pattern id + palette name for preset id. */
function slug(str) {
  return str.replace(/\s+/g, '-').replace(/[^a-z0-9-]/gi, '').toLowerCase();
}

/** Suggest preset id and label from parsed state. */
function suggestIdAndLabel(q) {
  const patternIndex = q.pattern ?? 0;
  const paletteIndex = q.palette ?? 0;
  const patternName = PATTERNS[patternIndex]?.name ?? `Pattern ${patternIndex}`;
  const patternId = PATTERNS[patternIndex]?.id ?? `pattern-${patternIndex}`;
  const paletteName = PALETTE_NAMES[paletteIndex] ?? `Palette ${paletteIndex}`;
  const shortName = patternName.replace(/\s+Weave$/, '').replace(/\s+(\d\/\d)\s+/, ' · $1 ');
  const label = `${paletteName} · ${shortName}`;
  const suffix = [];
  if (q.shimmer === 1) suffix.push('Shimmer');
  if ((q.gradSteps ?? 0) >= 2) suffix.push('Grad');
  const labelFull = suffix.length ? `${label} · ${suffix.join(' · ')}` : label;
  const id = `${slug(paletteName)}-${patternId}${suffix.length ? '-' + suffix.map(slug).join('-') : ''}`;
  return { id, label: labelFull };
}

/** Build preset object from parsed URL state. */
function buildPreset(q) {
  const { id, label } = suggestIdAndLabel(q);
  const flatGrad = (shade) => ({ startShade: shade, endShade: shade, direction: 0, range: [0, 100] });
  const warpShade = q.warpShade ?? 1;
  const weftShade = q.weftShade ?? 3;
  const preset = {
    id,
    label,
    pattern: q.pattern ?? 0,
    palette: q.palette ?? 0,
    bgShade: q.bgShade ?? 2,
    warpShade,
    weftShade,
    warpGradient: q.warpGradient ?? flatGrad(warpShade),
    weftGradient: q.weftGradient ?? flatGrad(weftShade),
  };
  const extended = [
    'gridSize', 'gradSteps', 'rectAspect', 'cornerRadius', 'canvasAspect',
    'useAllColorways', 'colorwaySeed', 'shimmer', 'shimmerSpeed', 'shimmerWidth',
    'shimmerIntensity', 'shimmerPosition', 'shimmerRotation', 'shimmerNoise',
    'shimmerNoiseSeed', 'shimmerNoiseMin', 'shimmerNoiseMax', 'shimmerBlendMode',
  ];
  for (const key of extended) {
    if (q[key] != null) {
      if (key === 'useAllColorways') preset[key] = !!q[key];
      else if (key === 'shimmer') preset[key] = !!q[key];
      else preset[key] = q[key];
    }
  }
  return preset;
}

/** Format a value for JS source (numbers, booleans, arrays, objects). */
function formatValue(v) {
  if (v === true) return 'true';
  if (v === false) return 'false';
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v)) return `[${v.join(', ')}]`;
  if (typeof v === 'object' && v !== null) {
    const pairs = Object.entries(v).map(([k, val]) => `${k}: ${formatValue(val)}`);
    return `{ ${pairs.join(', ')} }`;
  }
  return JSON.stringify(v);
}

/** Serialize preset to a single JS object literal string. */
function presetToJs(preset) {
  const lines = [
    `  {`,
    `    id: ${JSON.stringify(preset.id)},`,
    `    label: ${JSON.stringify(preset.label)},`,
    `    pattern: ${preset.pattern},`,
    `    palette: ${preset.palette},`,
    `    bgShade: ${preset.bgShade},`,
    `    warpShade: ${preset.warpShade},`,
    `    weftShade: ${preset.weftShade},`,
    `    warpGradient: { startShade: ${preset.warpGradient.startShade}, endShade: ${preset.warpGradient.endShade}, direction: ${preset.warpGradient.direction}, range: [${preset.warpGradient.range.join(', ')}] },`,
    `    weftGradient: { startShade: ${preset.weftGradient.startShade}, endShade: ${preset.weftGradient.endShade}, direction: ${preset.weftGradient.direction}, range: [${preset.weftGradient.range.join(', ')}] },`,
  ];
  const optional = ['gridSize', 'gradSteps', 'rectAspect', 'cornerRadius', 'canvasAspect', 'useAllColorways', 'colorwaySeed', 'shimmer', 'shimmerSpeed', 'shimmerWidth', 'shimmerIntensity', 'shimmerPosition', 'shimmerRotation', 'shimmerNoise', 'shimmerNoiseSeed', 'shimmerNoiseMin', 'shimmerNoiseMax', 'shimmerBlendMode'];
  for (const key of optional) {
    if (preset[key] !== undefined)
      lines.push(`    ${key}: ${formatValue(preset[key])},`);
  }
  lines.push('  },');
  return lines.join('\n');
}

async function main() {
  let input = process.argv[2];
  if (input == null && !process.stdin.isTTY) {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    input = Buffer.concat(chunks).toString('utf8').trim();
  }
  if (!input) {
    console.error('Usage: npm run preset-maker -- \'<url or ?query>\'');
    console.error('   or: echo \'?p=11&pal=2&...\' | npm run preset-maker');
    process.exit(1);
  }
  const search = input.includes('?') ? input.slice(input.indexOf('?')) : (input.startsWith('&') ? input : `?${input}`);
  const q = parseUrlState(search);
  if (q.pattern === undefined && q.palette === undefined && !q.warpGradient && !q.weftGradient) {
    console.error('No preset-relevant params found in URL.');
    process.exit(1);
  }
  const preset = buildPreset(q);
  console.log('// Paste into PRESETS in src/constants.js:\n');
  console.log(presetToJs(preset));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
