/**
 * URL sync for canvas-demo.html — active specimen + play hints (`shp`, `cwp`, same as main app).
 */
import {
  clampColorwayAnimBits,
  decodeColorwayAnimBitsToPartial,
  encodeColorwayAnimPlaying,
} from './colorwayAnimUrl';
import { COLORWAY_ANIM_INITIAL } from './colorwayUtils';

export const CANVAS_DEMO_DEFAULT_SECTION = 'weave';
export const CANVAS_DEMO_DEFAULT_SPEC = 'weave';

export function findDemoSection(sectionId, sections) {
  if (sectionId && sections.some((s) => s.id === sectionId)) return sectionId;
  return sections[0]?.id ?? CANVAS_DEMO_DEFAULT_SECTION;
}

export function findDemoSpec(specId, section) {
  if (specId && section.specs.some((s) => s.id === specId)) return specId;
  return section.specs[0]?.id ?? CANVAS_DEMO_DEFAULT_SPEC;
}

/** @param {string} search @param {{ id: string, specs: { id: string }[] }[]} sections */
export function parseCanvasDemoUrl(search, sections) {
  const params = new URLSearchParams(search);
  const sectionId = findDemoSection(params.get('section'), sections);
  const section = sections.find((s) => s.id === sectionId) ?? sections[0];
  const specId = findDemoSpec(params.get('spec'), section);
  const out = {
    sectionId,
    specId,
    shimmerPlaying: params.get('shp') !== '0',
    colorwayPlayBits: null,
  };
  const cwp = params.get('cwp');
  if (cwp != null) {
    const n = Number(cwp);
    if (Number.isFinite(n)) out.colorwayPlayBits = clampColorwayAnimBits(n);
  }
  return out;
}

/** @param {{ sectionId: string, specId: string, shimmerPlaying: boolean, colorwayAnimPlaying: Record<string, boolean> }} state */
export function buildCanvasDemoSearchParams(state) {
  const p = new URLSearchParams();
  if (state.sectionId !== CANVAS_DEMO_DEFAULT_SECTION) p.set('section', state.sectionId);
  if (state.specId !== CANVAS_DEMO_DEFAULT_SPEC) p.set('spec', state.specId);
  if (state.shimmerPlaying === false) p.set('shp', '0');
  const cwp = encodeColorwayAnimPlaying(state.colorwayAnimPlaying || COLORWAY_ANIM_INITIAL);
  if (cwp !== 0) p.set('cwp', String(cwp));
  return p;
}

export function replaceCanvasDemoUrl(state) {
  const qs = buildCanvasDemoSearchParams(state).toString();
  const path = window.location.pathname;
  window.history.replaceState(null, '', qs ? `${path}?${qs}` : path);
}

export { decodeColorwayAnimBitsToPartial };
