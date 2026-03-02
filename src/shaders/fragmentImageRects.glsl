/**
 * Image-to-colored-rects (v2): sample an image per grid cell and draw each cell
 * as a rounded rectangle filled with that color. Like ASCII art but with colored rects.
 * Rect system (halfSize, cornerRadius, SDF) pulled from original fragment.glsl.
 */
precision mediump float;

uniform vec2 u_resolution;
uniform float u_gridSize;
uniform sampler2D u_imageSampler;
uniform float u_palette;
uniform float u_bgShade;
uniform float u_colorizeMode;  // 1.0 = colorization (image), 0.0 = brand (palette)
uniform float u_quantizeSteps; // 0 = off, 2+ = steps per channel
uniform float u_rectShade;     // palette shade for rect when brand mode (0–3)
uniform float u_shadeFrom;    // 0=color, 1=warp, 2=weft, 3=warp+weft (brand mode: what drives palette shade)
uniform sampler2D u_patternSampler;
uniform float u_patternIndex;
uniform float u_tileW;
uniform float u_tileH;
uniform float u_patternTexHeight;

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
// Palette 0–3 = Citrine, Garnet, Lapis, Peridot. Shade 0–3 = 950, 500, 100, 400 (Figma tokens).
vec3 getPaletteColor(float palette, float shade) {
  int p = int(mod(floor(palette + 0.01), 4.0));
  int s = int(mod(floor(shade + 0.01), 4.0));
  if (p == 0) { // Citrine
    if (s == 0) return vec3(0.247, 0.114, 0.035);   // 950
    if (s == 1) return vec3(0.569, 0.294, 0.110);     // 500 #914B1C
    if (s == 2) return vec3(0.973, 0.969, 0.886);   // 100
    return vec3(0.855, 0.725, 0.525);               // 400
  }
  if (p == 1) { // Garnet
    if (s == 0) return vec3(0.322, 0.024, 0.141);   // 950
    if (s == 1) return vec3(0.941, 0.216, 0.576);   // 500
    if (s == 2) return vec3(0.984, 0.922, 0.941);   // 100
    return vec3(0.988, 0.706, 0.812);               // 400
  }
  if (p == 2) { // Lapis
    if (s == 0) return vec3(0.008, 0.161, 0.231);   // 950
    if (s == 1) return vec3(0.0, 0.502, 0.737);    // 500
    if (s == 2) return vec3(0.902, 0.953, 0.973);   // 100
    return vec3(0.455, 0.725, 0.875);               // 400
  }
  // Peridot
  if (s == 0) return vec3(0.012, 0.188, 0.063);   // 950
  if (s == 1) return vec3(0.0, 0.486, 0.137);    // 500
  if (s == 2) return vec3(0.843, 0.914, 0.890);   // 100
  return vec3(0.51, 0.816, 0.561);                 // 400
}

// --- ROUNDED RECTANGLE SDF (from original fragment.glsl) ---
// Negative = inside, zero = edge, positive = outside.
// halfSize = half extents; radius = corner radius (~6/40 from Figma).
float roundedRect(vec2 p, vec2 halfSize, float radius) {
  vec2 d = abs(p) - halfSize + radius;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - radius;
}

// Quantize each channel to n steps (2–256). steps < 2.0 = no quantize.
vec3 quantize(vec3 c, float steps) {
  if (steps < 2.0) return c;
  float n = max(steps - 1.0, 1.0);
  return floor(c * n + 0.5) / n;
}

void main() {
  // --- GRID SETUP (same as original) ---
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float aspect = u_resolution.x / u_resolution.y;
  uv.x *= aspect;

  float gridSize = clamp(u_gridSize, 2.0, 128.0);
  vec2 gridUV = uv * gridSize;
  vec2 cellUV = fract(gridUV);
  vec2 cellID = floor(gridUV);

  // Sample image at cell center. Grid: gridSize cells along vertical (y), gridSize*aspect along horizontal (x).
  // Flip texture Y so image matches screen (WebGL tex origin is bottom-left; image upload is often top-down).
  float texX = (cellID.x + 0.5) / (gridSize * aspect);
  float texY = 1.0 - (cellID.y + 0.5) / gridSize;
  vec3 sampled = texture2D(u_imageSampler, vec2(texX, texY)).rgb;
  vec3 quantized = quantize(sampled, u_quantizeSteps);

  // --- RECT COLOR: colorization (quantized image RGB) vs brand (palette shade from color / warp / weft) ---
  vec3 rectColor;
  if (u_colorizeMode > 0.5) {
    rectColor = quantized;
  } else {
    float shade;
    // Match v1: warp = vertical (height / Y), weft = horizontal (width / X). Same formulas as fragment.glsl.
    float warpT = fract(cellID.y / gridSize);   // warp along Y (height)
    float weftT = fract(cellID.x / gridSize);   // weft along X (width)
    if (u_shadeFrom < 0.5) {
      float lum = dot(quantized, vec3(0.2126, 0.7152, 0.0722));
      shade = clamp(floor(lum * 4.0), 0.0, 3.0);
    } else if (u_shadeFrom < 1.5) {
      shade = clamp(floor(warpT * 4.0), 0.0, 3.0);
    } else if (u_shadeFrom < 2.5) {
      shade = clamp(floor(weftT * 4.0), 0.0, 3.0);
    } else {
      float t = (warpT + weftT) * 0.5;
      shade = clamp(floor(t * 4.0), 0.0, 3.0);
    }
    rectColor = getPaletteColor(u_palette, shade);
  }

  // --- ROUNDED RECT: orient by weave (same as v1) ---
  // Warp = portrait (halfX, halfY), weft = landscape (halfY, halfX).
  float isWeft = getPatternFromTexture(cellID.y, cellID.x);
  vec2 p = cellUV - 0.5;
  float halfY = 0.5;
  float halfX = halfY * (34.0 / 40.0);
  float cornerRadius = 0.18;
  vec2 halfSize = isWeft > 0.5 ? vec2(halfY, halfX) : vec2(halfX, halfY);
  float d = roundedRect(p, halfSize, cornerRadius);
  float cell = 1.0 - smoothstep(0.0, 0.01, d);

  // --- COLORING (same as original: palette + bg shade for background) ---
  vec3 bgColor = getPaletteColor(u_palette, u_bgShade);
  gl_FragColor = vec4(mix(bgColor, rectColor, cell), 1.0);
}
