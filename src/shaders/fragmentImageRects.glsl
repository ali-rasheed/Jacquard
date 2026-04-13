/**
 * Image-to-colored-rects (v2): sample an image per grid cell and draw each cell
 * as a rounded rectangle filled with that color. Like ASCII art but with colored rects.
 * Rect system (halfSize, cornerRadius, SDF) pulled from original fragment.glsl.
 *
 * Quantization (when u_quantizeSteps >= 2): optional gamma in/out, per-cell dither,
 * and mode — RGB (per-channel levels) vs HSV (posterized hue/sat/value).
 *
 * Rect color: u_rectColorSource 0 = brand palette (shade from luma/warp/weft), 1 = image RGB,
 * 2 = pattern-only (warp vs weft → two palette shades). Rect size can scale by image luminance.
 */
precision mediump float;

uniform vec2 u_resolution;
uniform float u_gridSize;
uniform sampler2D u_imageSampler;
uniform float u_palette;
uniform float u_bgShade;
uniform float u_rectColorSource; // 0 brand, 1 image, 2 warp/weft pattern colors
uniform float u_quantizeSteps; // 0–1 = off, 2+ = levels per band
uniform float u_quantizeMode;  // 0 = RGB, 1 = HSV
uniform float u_quantizeGamma; // >= ~0.05; 1 = linear; applied before/after banding
uniform float u_quantizeDither;// 0–1: jitter magnitude vs one level (cell-stable hash)
uniform float u_rectShade;     // palette shade for rect when brand mode (0–3)
uniform float u_shadeFrom;    // 0=color, 1=warp, 2=weft, 3=warp+weft (brand mode: what drives palette shade)
uniform sampler2D u_patternSampler;
uniform float u_patternIndex;
uniform float u_tileW;
uniform float u_tileH;
uniform float u_patternTexHeight;
uniform float u_rectRadius;   // corner radius in cell space (0 = sharp, ~0.18 = default)
uniform float u_rectAspect;   // rect width/height in cell space (e.g. 0.85 = 34/40)
uniform float u_rectRatio;    // scale of rect within cell (1 = full cell, <1 = inset)
uniform float u_patternWarpShade;  // palette shade 0–4 for warp cells (rectColorSource == 2)
uniform float u_patternWeftShade;
uniform float u_lumaSizeMix;     // 0 = ignore luma; 1 = full mapping (see lumaSizeFloor)
uniform float u_lumaSizeInvert;  // 0 = dark small / bright large; 1 = opposite
uniform float u_lumaSizeFloor;   // min scale multiplier at the “small” end (0.05–1)
// Cell geometry: 0 = always weave (rounded rects); 1 = plain full cell unless image luma ≤ u_stitchLumaMax
uniform float u_cellGeometryMode;
uniform float u_stitchLumaMax;    // darkness gate: weave stitch only when lum ≤ this (0=black … 1=white)
uniform float u_nonStitchShowsBg; // 1 = bright non-stitched cells use background instead of plain tile fill

// --- WEAVE PATTERN LOOKUP (from v1 fragment.glsl) ---
// row, col = cell position; returns 0 = warp, 1 = weft for rect orientation.
float getPatternFromTexture(float row, float col) {
  float r = mod(row, u_tileH);
  float c = mod(col, u_tileW);
  float stripY = u_patternIndex * 10.0;
  float texX = (c + 0.5) / 10.0;
  float texY = (stripY + r + 0.5) / u_patternTexHeight;
  return texture2D(u_patternSampler, vec2(texX, texY)).r;
}

// --- ENS COLOR PICK (from original fragment.glsl) ---
// Palette 0–4 = Citrine, Garnet, Lapis, Peridot, Quartz (Quartz = ENS Core quartz/900,500,100,400). Shade 0–4 = 950, 500, 100, 400, Transparent.
vec4 getPaletteColor(float palette, float shade) {
  int p = int(mod(floor(palette + 0.01), 5.0));
  int s = int(mod(floor(shade + 0.01), 5.0));
  if (s == 4) return vec4(0.0, 0.0, 0.0, 0.0);  // Transparent
  if (p == 0) { // Citrine
    if (s == 0) return vec4(0.247, 0.114, 0.035, 1.0);   // 950
    if (s == 1) return vec4(0.596, 0.302, 0.106, 1.0);   // 500 #984D1B
    if (s == 2) return vec4(0.973, 0.969, 0.886, 1.0);   // 100
    return vec4(0.855, 0.725, 0.525, 1.0);               // 400
  }
  if (p == 1) { // Garnet
    if (s == 0) return vec4(0.322, 0.024, 0.141, 1.0);   // 950
    if (s == 1) return vec4(0.941, 0.216, 0.576, 1.0);   // 500
    if (s == 2) return vec4(0.984, 0.922, 0.941, 1.0);   // 100
    return vec4(0.988, 0.706, 0.812, 1.0);               // 400
  }
  if (p == 2) { // Lapis
    if (s == 0) return vec4(0.008, 0.161, 0.231, 1.0);   // 950
    if (s == 1) return vec4(0.0, 0.502, 0.737, 1.0);    // 500
    if (s == 2) return vec4(0.902, 0.953, 0.973, 1.0);   // 100
    return vec4(0.455, 0.725, 0.875, 1.0);               // 400
  }
  if (p == 3) { // Peridot
    if (s == 0) return vec4(0.012, 0.188, 0.063, 1.0);   // 950
    if (s == 1) return vec4(0.0, 0.486, 0.137, 1.0);    // 500
    if (s == 2) return vec4(0.843, 0.914, 0.890, 1.0);   // 100
    return vec4(0.51, 0.816, 0.561, 1.0);                 // 400
  }
  // Quartz
  if (s == 0) return vec4(0.098039, 0.098039, 0.098039, 1.0);   // 900
  if (s == 1) return vec4(0.34902, 0.341176, 0.333333, 1.0);   // 500
  if (s == 2) return vec4(0.933333, 0.929412, 0.929412, 1.0);   // 100
  return vec4(0.45098, 0.45098, 0.45098, 1.0);                  // 400
}

// --- ROUNDED RECTANGLE SDF (from original fragment.glsl) ---
// Negative = inside, zero = edge, positive = outside.
// halfSize = half extents; radius = corner radius (~6/40 from Figma).
float roundedRect(vec2 p, vec2 halfSize, float radius) {
  vec2 d = abs(p) - halfSize + radius;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - radius;
}

vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hsv2rgb(vec3 c) {
  vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  return c.z * mix(vec3(1.0), rgb, c.y);
}

// Band scalar 0..1 to `steps` levels (inclusive endpoints).
float quantizeScalar(float x, float n) {
  return floor(x * n + 0.5) / n;
}

vec3 quantizeRgb(vec3 c, float steps, float dither, vec2 cellID) {
  float n = max(steps - 1.0, 1.0);
  vec3 jit = vec3(0.0);
  if (dither > 0.001) {
    float h = fract(sin(dot(cellID, vec2(12.9898, 78.233))) * 43758.5453);
    jit = (vec3(h, fract(h * 37.721), fract(h * 91.318)) - 0.5) * 2.0 * dither / n;
  }
  vec3 cq = clamp(c + jit, 0.0, 1.0);
  return vec3(
    quantizeScalar(cq.r, n),
    quantizeScalar(cq.g, n),
    quantizeScalar(cq.b, n)
  );
}

vec3 quantizeHsv(vec3 c, float steps, float dither, vec2 cellID) {
  float n = max(steps - 1.0, 1.0);
  float jitAmt = 0.0;
  if (dither > 0.001) {
    float h = fract(sin(dot(cellID + vec2(13.1, 9.7), vec2(12.9898, 78.233))) * 43758.5453);
    jitAmt = (h - 0.5) * 2.0 * dither / n;
  }
  vec3 hsv = rgb2hsv(clamp(c, 0.0, 1.0));
  float hn = fract(hsv.x + jitAmt * 0.15);
  float hq = quantizeScalar(hn, n);
  float sq = quantizeScalar(clamp(hsv.y + jitAmt, 0.0, 1.0), n);
  float vq = quantizeScalar(clamp(hsv.z + jitAmt, 0.0, 1.0), n);
  return hsv2rgb(vec3(hq, sq, vq));
}

vec3 quantizeImage(vec3 sampled, float steps, float mode, float gamma, float dither, vec2 cellID) {
  if (steps < 2.0) return sampled;
  float g = clamp(gamma, 0.08, 4.0);
  vec3 lifted = pow(max(sampled, vec3(1.0e-5)), vec3(1.0 / g));
  vec3 banded = (mode > 0.5)
    ? quantizeHsv(lifted, steps, dither, cellID)
    : quantizeRgb(lifted, steps, dither, cellID);
  return pow(max(banded, vec3(1.0e-5)), vec3(g));
}

void main() {
  // --- GRID SETUP (same as original) ---
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float aspect = u_resolution.x / u_resolution.y;
  uv.x *= aspect;

  float gridSize = clamp(u_gridSize, 2.0, 256.0);
  vec2 gridUV = uv * gridSize;
  vec2 cellUV = fract(gridUV);
  vec2 cellID = floor(gridUV);

  // Sample image at cell center. Grid: gridSize cells along vertical (y), gridSize*aspect along horizontal (x).
  // Flip texture Y so image matches screen (WebGL tex origin is bottom-left; image upload is often top-down).
  float texX = (cellID.x + 0.5) / (gridSize * aspect);
  float texY = 1.0 - (cellID.y + 0.5) / gridSize;
  vec3 sampled = texture2D(u_imageSampler, vec2(texX, texY)).rgb;
  vec3 quantized = quantizeImage(sampled, u_quantizeSteps, u_quantizeMode, u_quantizeGamma, u_quantizeDither, cellID);

  // --- RECT COLOR: image vs brand vs binary weave (two palette shades) ---
  vec4 rectVec;
  float isWeft = getPatternFromTexture(cellID.y, cellID.x);
  if (u_rectColorSource > 1.5) {
    // Pattern colors only: warp vs weft → two shades (independent of image hue).
    float shadePick = isWeft > 0.5 ? u_patternWeftShade : u_patternWarpShade;
    rectVec = getPaletteColor(u_palette, shadePick);
  } else if (u_rectColorSource > 0.5) {
    rectVec = vec4(quantized, 1.0);
  } else {
    float shade;
    float warpT = fract(cellID.y / gridSize);
    float weftT = fract(cellID.x / gridSize);
    if (u_shadeFrom < 0.5) {
      float lum = dot(quantized, vec3(0.2126, 0.7152, 0.0722));
      shade = clamp(floor(lum * 5.0), 0.0, 4.0);
    } else if (u_shadeFrom < 1.5) {
      shade = clamp(floor(warpT * 5.0), 0.0, 4.0);
    } else if (u_shadeFrom < 2.5) {
      shade = clamp(floor(weftT * 5.0), 0.0, 4.0);
    } else {
      float t = (warpT + weftT) * 0.5;
      shade = clamp(floor(t * 5.0), 0.0, 4.0);
    }
    rectVec = getPaletteColor(u_palette, shade);
  }

  // --- ROUNDED RECT: orient by weave (same as v1). Size from luminance × u_rectRatio. ---
  // Warp = portrait (halfX, halfY), weft = landscape (halfY, halfX).
  vec2 p = cellUV - 0.5;
  float lumRaw = dot(sampled, vec3(0.2126, 0.7152, 0.0722));
  float lumT = u_lumaSizeInvert > 0.5 ? (1.0 - lumRaw) : lumRaw;
  float floorClamped = clamp(u_lumaSizeFloor, 0.05, 1.0);
  float sizeMul = mix(1.0, mix(floorClamped, 1.0, lumT), clamp(u_lumaSizeMix, 0.0, 1.0));
  float ratio = clamp(u_rectRatio * sizeMul, 0.02, 1.0);
  float aspectClamped = clamp(u_rectAspect, 0.2, 2.0);
  float halfY = 0.5 * ratio;
  float halfX = halfY * aspectClamped;
  float cornerRadius = clamp(u_rectRadius, 0.0, 0.5);
  vec2 halfSize = isWeft > 0.5 ? vec2(halfY, halfX) : vec2(halfX, halfY);
  float d = roundedRect(p, halfSize, cornerRadius);
  float cellStitch = 1.0 - smoothstep(0.0, 0.01, d);
  // Darkness gate: bright cells → full tile (plain); dark enough → weave geometry.
  float useStitchGeom = u_cellGeometryMode < 0.5 ? 1.0 : (1.0 - step(u_stitchLumaMax + 0.0001, lumRaw));
  float nonStitchFill = u_nonStitchShowsBg > 0.5 ? 0.0 : 1.0;
  float cell = mix(nonStitchFill, cellStitch, useStitchGeom);

  // --- COLORING (same as original: palette + bg shade for background). Supports transparent. ---
  vec4 bgVec = getPaletteColor(u_palette, u_bgShade);
  vec4 inRectVec = rectVec.a > 0.001 ? rectVec : vec4(bgVec.rgb, 1.0);
  gl_FragColor = mix(bgVec, inRectVec, cell);
}
