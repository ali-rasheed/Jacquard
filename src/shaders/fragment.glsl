// Weaving draft fragment shader — grid of warp/weft rounded rects, palette colors, gradients, mouse warp, reveal animation.
// WebGL 1 / GLSL ES 1.00. Uniforms set from useShaderSandbox; pattern data from src/patterns/index.js.
precision mediump float;

// Time and framebuffer
uniform float u_time;              // Seconds since context creation
uniform vec2 u_resolution;         // Canvas size in pixels (for aspect and AA)

// Pattern texture: one strip per pattern, R channel = 0 warp / 1 weft per cell
uniform sampler2D u_patternSampler;
uniform float u_patternIndex;     // Which strip (pattern) to use
uniform float u_tileW;
uniform float u_tileH;            // Repeat size of this pattern (e.g. 8×8)
uniform float u_patternTexHeight; // Total texture height (10 * numPatterns)

// Colorway and shades (palette 0–3, shade 0–3 per warp/weft/bg)
uniform float u_palette;
uniform float u_bgShade;
uniform float u_warpShade;
uniform float u_weftShade;
uniform float u_gridSize;         // Cells along vertical axis (8–64); higher = finer grid

// Warp/weft 2-stop gradients: start/end RGB, direction (0 or 1), range (startPos..endPos in 0..1)
uniform vec3 u_warpStart;
uniform vec3 u_warpEnd;
uniform vec3 u_weftStart;
uniform vec3 u_weftEnd;
uniform float u_warpDir;
uniform float u_weftDir;
uniform float u_warpStartPos;
uniform float u_warpEndPos;
uniform float u_weftStartPos;
uniform float u_weftEndPos;
uniform float u_gradSteps;        // 0 or 1 = smooth; >= 2 = discrete bands

// Mouse interaction: position (0..1), radius, strength, down (0/1), falloff curve (0–3)
uniform vec2 u_mouse;
uniform float u_mouseRadius;
uniform float u_mouseStrength;
uniform float u_mouseDown;
uniform float u_falloffCurve;

// Reveal animation: time when current wave started (resets on pattern change)
uniform float u_revealStartTime;
// Rect aspect: halfX/halfY (warp orientation). Default 36/40 = 0.9; range ~0.5–1.5.
uniform float u_rectAspect;


// ============================================================
// ENS LABS WEAVING DRAFT SHADER
// ============================================================
//
// Atomic unit (Figma ref: ens.domains design system):
//   36×40 px rounded rect, border-radius 6px, fill #0080bc.
//   Aspect ratio width:height = 36:40 (0.9).
//
// This shader recreates the ENS Labs brand pattern system:
// a grid of rounded rectangles that alternate between
// "warp" (horizontal, color 1) and "weft" (vertical, color 2)
// based on a binary weave draft matrix.
//
// ARCHITECTURE:
// 1. Divide canvas into a grid (fract/floor)
// 2. Look up the weave matrix to decide warp vs weft
// 3. Draw a rounded rect SDF per cell
// 4. Color based on warp/weft assignment
//
// WEAVE DRAFT PRIMER:
// In real weaving, the "draft" is a binary grid that tells
// the loom which threads go over/under at each crossing.
// 0 = warp thread on top (horizontal rect)
// 1 = weft thread on top (vertical rect)
// The matrix repeats (tiles) infinitely across the fabric.
// ============================================================


// --- ROUNDED RECTANGLE SDF ---
// A Signed Distance Function returns the distance from point p
// to the nearest edge of the shape.
//   negative = inside the shape
//   zero     = exactly on the edge
//   positive = outside the shape
//
// This lets us draw shapes purely with math — no geometry needed.
// The smoothstep on the result gives us anti-aliased edges.
//
// How it works for a rounded rect:
//   1. abs(p) exploits symmetry — we only need to solve one quadrant
//   2. Subtract halfSize to shift the corner to the origin
//   3. Add radius back, then subtract it from the final distance
//      This effectively "inflates" the sharp corner into a round one

float roundedRect(vec2 p, vec2 halfSize, float radius) {
    vec2 d = abs(p) - halfSize + radius;
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - radius;
}


// --- WEAVE PATTERN LOOKUP (texture-based) ---
// Patterns are defined in JS (src/patterns/index.js) and uploaded as a single texture.
// Texture layout: width = 10, height = 10 * numPatterns. Each pattern occupies a 10-row strip.
// u_tileW / u_tileH define the active pattern's repeat size (e.g. 8x8 or 4x10).
// Sample at (col, row + patternIndex*10) to get warp (0) vs weft (1) from R channel.
float getPatternFromTexture(float row, float col) {
    float r = mod(row, u_tileH);
    float c = mod(col, u_tileW);
    float stripY = u_patternIndex * 10.0;
    float texX = (c + 0.5) / 10.0;
    float texY = (stripY + r + 0.5) / u_patternTexHeight;
    return texture2D(u_patternSampler, vec2(texX, texY)).r;
}

// --- ENS COLOR PICK (colorway + shade) ---
// Palette 0–3 = Citrine, Garnet, Lapis, Peridot. Shade 0–3 = 950, 500, 100, 400 (Figma tokens).
// Returns sRGB vec3 for the given palette and shade so we can pick warp/weft/bg independently.
vec3 getPaletteColor(float palette, float shade) {
    int p = int(mod(floor(palette + 0.01), 4.0));
    int s = int(mod(floor(shade + 0.01), 4.0));
    if (p == 0) { // Citrine
        if (s == 0) return vec3(0.247, 0.114, 0.035);   // 950
        if (s == 1) return vec3(0.51, 0.2, 0.149);       // 500
        if (s == 2) return vec3(0.973, 0.969, 0.886);   // 100
        return vec3(0.855, 0.725, 0.525);               // 400
    }
    if (p == 1) { // Garnet
        if (s == 0) return vec3(0.322, 0.024, 0.141);   // 950
        if (s == 1) return vec3(0.941, 0.216, 0.576);  // 500
        if (s == 2) return vec3(0.984, 0.922, 0.941);   // 100
        return vec3(0.988, 0.706, 0.812);               // 400
    }
    if (p == 2) { // Lapis
        if (s == 0) return vec3(0.008, 0.161, 0.231);   // 950
        if (s == 1) return vec3(0.0, 0.502, 0.737);   // 500
        if (s == 2) return vec3(0.902, 0.953, 0.973);  // 100
        return vec3(0.455, 0.725, 0.875);               // 400
    }
    // Peridot
    if (s == 0) return vec3(0.012, 0.188, 0.063);   // 950
    if (s == 1) return vec3(0.0, 0.486, 0.137);    // 500
    if (s == 2) return vec3(0.843, 0.914, 0.890);  // 100
    return vec3(0.51, 0.816, 0.561);                 // 400
}

// 2-stop gradient: t in [0,1], direction flips t, range maps to startPos..endPos.
// u_gradSteps: 0 or 1 = smooth; >= 2 = discrete bands (gradation steps).
vec3 sampleGradient2(vec3 startColor, vec3 endColor, float dir, float startPos, float endPos, float tRaw) {
    float t = (dir > 0.5) ? (1.0 - tRaw) : tRaw;
    float span = endPos - startPos;
    float tGrad = (span < 0.001) ? 0.5 : clamp((t - startPos) / span, 0.0, 1.0);
    if (u_gradSteps >= 2.0) {
        float steps = floor(u_gradSteps);
        tGrad = floor(tGrad * steps) / max(steps - 1.0, 1.0);
    }
    return mix(startColor, endColor, tGrad);
}

void main() {
    // --- GRID SETUP ---
    // Normalize pixel coordinates to 0..1 range
    vec2 uv = gl_FragCoord.xy / u_resolution;

    // Correct for aspect ratio so grid cells are square
    float aspect = u_resolution.x / u_resolution.y;
    uv.x *= aspect;

    // --- FABRIC WARP (finger-on-taut-cloth) ---
    // Displace UV toward mouse so the grid appears to sink under the press.
    // Raw falloff 0..1 from distance; u_falloffCurve: 0=linear, 1=ease, 2=ease-in, 3=ease-out.
    vec2 toMouse = u_mouse - uv;
    float dist = length(toMouse);
    float raw = 1.0 - smoothstep(0.0, u_mouseRadius, dist);
    float t = clamp(raw, 0.0, 1.0);
    float falloff;
    if (u_falloffCurve < 0.5) {
      falloff = t;
    } else if (u_falloffCurve < 1.5) {
      falloff = t * t * (3.0 - 2.0 * t);
    } else if (u_falloffCurve < 2.5) {
      falloff = t * t;
    } else {
      falloff = 1.0 - (1.0 - t) * (1.0 - t);
    }
    falloff *= u_mouseStrength * u_mouseDown;
    uv += toMouse * falloff;

    // Scale: u_gridSize = number of cells along the vertical axis (8–64).
    // Higher = smaller tiles (finer weave), lower = larger tiles.
    float gridSize = clamp(u_gridSize, 2.0, 64.0);
    vec2 gridUV = uv * gridSize;

    // fract = local position within this cell (0..1)
    // floor = which cell we're in (integer ID)
    vec2 cellUV = fract(gridUV);
    vec2 cellID = floor(gridUV);

    // --- WEAVE MATRIX LOOKUP ---
    // Look up the binary matrix to decide: warp or weft?
    // u_patternIndex selects which weave structure (0..N from patterns registry)
    float isWeft = getPatternFromTexture(cellID.y, cellID.x);

    // --- ROUNDED RECT — ORIENT BY WARP/WEFT ---
    // Warp = rect (halfX, halfY); weft = (halfY, halfX). halfX/halfY = u_rectAspect.
    vec2 p = cellUV - 0.5;

    float halfY = 0.5;
    float halfX = halfY * clamp(u_rectAspect, 0.3, 2.0);
    float cornerRadius = 0.18;              // ~6/40 from Figma
    vec2 halfSize = isWeft > 0.5 ? vec2(halfY, halfX) : vec2(halfX, halfY);
    float d = roundedRect(p, halfSize, cornerRadius);

    // Convert distance to a mask: 1.0 inside, 0.0 outside.
    // WebGL 1 has no fwidth(); use ~1 pixel in cell space for AA.
    float edge = gridSize / min(u_resolution.x, u_resolution.y);
    float cell = 1.0 - smoothstep(-edge, edge, d);

    // --- COLORING ---
    vec3 bgColor = getPaletteColor(u_palette, u_bgShade);
    // Gradient param 0..1 along warp (Y) and weft (X) for 2-stop gradient
    float tWarp = fract(cellID.y / gridSize);
    float tWeft = fract(cellID.x / gridSize);
    vec3 warpColor = sampleGradient2(u_warpStart, u_warpEnd, u_warpDir, u_warpStartPos, u_warpEndPos, tWarp);
    vec3 weftColor = sampleGradient2(u_weftStart, u_weftEnd, u_weftDir, u_weftStartPos, u_weftEndPos, tWeft);
    vec3 threadColor = mix(warpColor, weftColor, isWeft);

    // --- ANIMATION ---
    // Weave-in reveal: diagonal wave on load and when pattern changes (u_revealStartTime resets in JS).
    float speed = 2.0 * gridSize / 1.8;
    float elapsed = u_time - u_revealStartTime;
    float wave = (cellID.x + cellID.y) - elapsed * speed;  // Diagonal coord; wave front advances as elapsed grows
    float reveal = smoothstep(1.0, 0.0, wave);            // 1 ahead of wave, 0 behind

    cell *= reveal;

    // Output: background where no rect; thread color inside rect (masked by cell)
    vec3 color = mix(bgColor, threadColor, cell);
    gl_FragColor = vec4(color, 1.0);
}
