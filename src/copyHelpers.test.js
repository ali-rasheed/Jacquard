/**
 * Unit tests for copy helpers (v1–v4). Ensures v3/v4 use halftone canvas, v1/v2 use main canvas.
 */
import { describe, it, expect } from 'vitest';
import { getCopyCanvas, HALFTONE_VIEWS } from './copyHelpers.js';

function makeRef(value) {
  return { current: value };
}

describe('copyHelpers', () => {
  const mainCanvas = document.createElement('canvas');
  mainCanvas.width = 800;
  mainCanvas.height = 600;
  const halftoneCanvas = document.createElement('canvas');
  halftoneCanvas.width = 1280;
  halftoneCanvas.height = 720;
  const container = document.createElement('div');
  container.appendChild(halftoneCanvas);

  it('HALFTONE_VIEWS includes v3 and v4 view names', () => {
    expect(HALFTONE_VIEWS).toContain('weavingHalftone');
    expect(HALFTONE_VIEWS).toContain('imageRectsHalftone');
    expect(HALFTONE_VIEWS).toHaveLength(2);
  });

  it('v1 (weaving) uses main canvasRef', () => {
    const canvasRef = makeRef(mainCanvas);
    const halftoneCanvasRef = makeRef(null);
    const halftoneContainerRef = makeRef(null);
    const out = getCopyCanvas('weaving', canvasRef, halftoneCanvasRef, halftoneContainerRef);
    expect(out).toBe(mainCanvas);
  });

  it('v2 (imageRects) uses main canvasRef', () => {
    const canvasRef = makeRef(mainCanvas);
    const halftoneCanvasRef = makeRef(halftoneCanvas);
    const halftoneContainerRef = makeRef(container);
    const out = getCopyCanvas('imageRects', canvasRef, halftoneCanvasRef, halftoneContainerRef);
    expect(out).toBe(mainCanvas);
  });

  it('v3 (weavingHalftone) uses halftoneCanvasRef when set', () => {
    const canvasRef = makeRef(mainCanvas);
    const halftoneCanvasRef = makeRef(halftoneCanvas);
    const halftoneContainerRef = makeRef(container);
    const out = getCopyCanvas('weavingHalftone', canvasRef, halftoneCanvasRef, halftoneContainerRef);
    expect(out).toBe(halftoneCanvas);
  });

  it('v4 (imageRectsHalftone) uses halftoneCanvasRef when set', () => {
    const canvasRef = makeRef(mainCanvas);
    const halftoneCanvasRef = makeRef(halftoneCanvas);
    const halftoneContainerRef = makeRef(container);
    const out = getCopyCanvas('imageRectsHalftone', canvasRef, halftoneCanvasRef, halftoneContainerRef);
    expect(out).toBe(halftoneCanvas);
  });

  it('v3 falls back to container querySelector when halftoneCanvasRef is null', () => {
    const canvasRef = makeRef(mainCanvas);
    const halftoneCanvasRef = makeRef(null);
    const halftoneContainerRef = makeRef(container);
    const out = getCopyCanvas('weavingHalftone', canvasRef, halftoneCanvasRef, halftoneContainerRef);
    expect(out).toBe(halftoneCanvas);
  });

  it('v4 falls back to container querySelector when halftoneCanvasRef is null', () => {
    const canvasRef = makeRef(mainCanvas);
    const halftoneCanvasRef = makeRef(null);
    const halftoneContainerRef = makeRef(container);
    const out = getCopyCanvas('imageRectsHalftone', canvasRef, halftoneCanvasRef, halftoneContainerRef);
    expect(out).toBe(halftoneCanvas);
  });

  it('v3 returns null when neither halftone ref nor container has canvas', () => {
    const canvasRef = makeRef(mainCanvas);
    const halftoneCanvasRef = makeRef(null);
    const halftoneContainerRef = makeRef(document.createElement('div'));
    const out = getCopyCanvas('weavingHalftone', canvasRef, halftoneCanvasRef, halftoneContainerRef);
    expect(out).toBeNull();
  });

  it('v1 returns null when canvasRef is null', () => {
    const canvasRef = makeRef(null);
    const out = getCopyCanvas('weaving', canvasRef, makeRef(null), makeRef(null));
    expect(out).toBeNull();
  });
});
