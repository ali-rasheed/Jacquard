/**
 * Image-to-colored-rects (v2): sample an image per grid cell and draw each cell
 * as a rounded rectangle filled with that color. Like ASCII art but with colored rects.
 * Rect system (halfSize, cornerRadius, SDF) pulled from original fragment.glsl.
 */
precision mediump float;

uniform vec2 u_resolution;
uniform float u_gridSize;
uniform sampler2D u_imageSampler;

// --- ROUNDED RECTANGLE SDF (from original fragment.glsl) ---
// Negative = inside, zero = edge, positive = outside.
// halfSize = half extents; radius = corner radius (~6/40 from Figma).
float roundedRect(vec2 p, vec2 halfSize, float radius) {
  vec2 d = abs(p) - halfSize + radius;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - radius;
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

  // Sample image at cell center. Grid has gridSize cells in y, gridSize*aspect in x; normalize to 0..1.
  vec2 texCoord = vec2((cellID.x + 0.5) / (gridSize * aspect), (cellID.y + 0.5) / gridSize);
  vec3 color = texture2D(u_imageSampler, texCoord).rgb;

  // --- ROUNDED RECT (36:40 atomic unit from original) ---
  // Same p, halfY, halfX, cornerRadius as fragment.glsl; single orientation (portrait).
  vec2 p = cellUV - 0.5;
  float halfY = 0.5;
  float halfX = halfY * (34.0 / 40.0);
  float cornerRadius = 0.12;
  float d = roundedRect(p, vec2(halfX, halfY), cornerRadius);
  float cell = 1.0 - smoothstep(0.0, 0.01, d);

  vec3 bgColor = vec3(0.12, 0.12, 0.14);
  gl_FragColor = vec4(mix(bgColor, color, cell), 1.0);
}
