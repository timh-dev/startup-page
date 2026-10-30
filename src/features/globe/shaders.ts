// Shaders for the dot globe widget, ported from the design-lab "Atmosphere
// Posters" reference (itself a recreation of Maxime Heckel's posters for "On
// Rendering the Sky, Sunsets, and Planets"). WebGL2 / GLSL ES 3.00.
//
// SCENE_FS renders the planet: single-scattering atmosphere (Rayleigh + Mie +
// ozone, Hillaire 2020 coefficients) over an ocean with land drawn as dots.
// It's heavy and only re-runs when the sun moves. COMPOSITE_FS runs every
// frame: the viewer's pulsing dot and the ripple, halation, the print's
// lifted black, grain and dust.

export const FULLSCREEN_VS = /* glsl */ `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

// Shared by both passes: camera, sphere hits, the dot lattice, noise.
const COMMON = /* glsl */ `
#define PI 3.14159265359
uniform float uAspect;
uniform float uTanHalfFov;
uniform vec2 uPlanetUv;    // planet centre on the tile (y up)
uniform vec3 uCamera;      // camera position, planet-centred (km)
uniform float uRadius;     // ground radius (km)
uniform mat3 uViewToEarth; // view space -> Earth-fixed (x: 0N 0E, y: 0N 90E, z: north)
uniform sampler2D uLand;   // equirectangular land mask
uniform float uDotSpacing; // radians between dots
uniform float uDotRadius;  // radians
uniform float uTileH;      // tile height in pixels

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float hash13(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float vnoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash13(i), hash13(i + vec3(1, 0, 0)), f.x), mix(hash13(i + vec3(0, 1, 0)), hash13(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(hash13(i + vec3(0, 0, 1)), hash13(i + vec3(1, 0, 1)), f.x), mix(hash13(i + vec3(0, 1, 1)), hash13(i + vec3(1, 1, 1)), f.x), f.y),
    f.z);
}
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

// Lens shift: the camera looks straight at the planet; the tile is offset on
// the image plane, so the outline is an exact circle wherever it sits.
vec3 viewRay(vec2 uv) {
  vec2 s = (uv - uPlanetUv) * vec2(uAspect, 1.0);
  return normalize(vec3(s * 2.0 * uTanHalfFov, -1.0));
}

// Ray vs a sphere at the origin, measuring the miss distance first so a huge,
// distant planet keeps its limb (Ray Tracing Gems, ch. 7).
vec2 hitSphere(vec3 ro, vec3 rd, float r) {
  float b = dot(ro, rd);
  vec3 miss = ro - b * rd;
  float d = r * r - dot(miss, miss);
  if (d < 0.0) return vec2(-1.0);
  float s = sqrt(d);
  return vec2(-b - s, -b + s);
}

// Land as dots: rows of equal latitude spacing, each row with as many dots as
// fit around it (so spacing stays even toward the poles), alternate rows
// offset half a step. Returns the nearest dot's centre; onLand is 1 if the
// land mask has land there.
vec3 dotCenter(vec3 e, out float onLand) {
  float lat = asin(clamp(e.z, -1.0, 1.0));
  float lon = atan(e.y, e.x);
  float row = floor(lat / uDotSpacing + 0.5);
  float latC = row * uDotSpacing;
  float count = max(1.0, floor(2.0 * PI * cos(latC) / uDotSpacing + 0.5));
  float stepLon = 2.0 * PI / count;
  float offset = mod(row, 2.0) * 0.5 * stepLon;
  float lonC = floor((lon - offset) / stepLon + 0.5) * stepLon + offset;
  vec2 uv = vec2(fract((lonC + PI) / (2.0 * PI)), clamp((0.5 * PI - latC) / PI, 0.0, 1.0));
  onLand = step(0.5, texture(uLand, uv).r);
  return vec3(cos(latC) * cos(lonC), cos(latC) * sin(lonC), sin(latC));
}

// 0..1 coverage of a land dot at an Earth-fixed point, antialiased.
float landDot(vec3 e, out vec3 center) {
  float onLand;
  center = dotCenter(e, onLand);
  float aa = max(length(fwidth(e)), 1e-5);
  return onLand * (1.0 - smoothstep(uDotRadius - aa, uDotRadius + aa, length(e - center)));
}
`;

export const SCENE_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;

${COMMON}

uniform float uTop;        // atmosphere height above the ground (km)
uniform vec4 uHeights;     // Rayleigh and Mie scale heights, ozone peak and half-width (km)
uniform vec3 uRayleigh;    // per km
uniform vec3 uMieScatter;
uniform vec3 uMieExtinct;
uniform vec3 uOzone;
uniform float uMieG;
uniform float uSun;
uniform vec3 uSunDir;      // view space
uniform vec3 uOcean;       // linear albedo
uniform vec3 uDotColor;    // linear albedo of the land dots
uniform float uNightGlow;  // how much the dots glow on the night side
uniform float uStars;

const int VIEW_STEPS = 40;
const int LIGHT_STEPS = 10;

float phaseRayleigh(float mu) { return 3.0 / (16.0 * PI) * (1.0 + mu * mu); }
float phaseHG(float mu, float g) {
  float g2 = g * g;
  return (1.0 - g2) / (4.0 * PI * pow(max(1.0 + g2 - 2.0 * g * mu, 1e-4), 1.5));
}

vec3 density(float h) {
  return vec3(exp(-h / uHeights.x), exp(-h / uHeights.y), max(0.0, 1.0 - abs(h - uHeights.z) / uHeights.w));
}
vec3 extinction(vec3 depth) {
  return uRayleigh * depth.x + uMieExtinct * depth.y + uOzone * depth.z;
}

// Spreads samples over [t0, t1] so they bunch up around tc, where the ray
// passes lowest: a limb ray crosses thousands of km of thin air but only a
// few dozen of thick air.
float warp(float u, float t0, float tc, float t1) {
  float x = 2.0 * u - 1.0;
  float s = x * abs(x);
  return tc + s * (s < 0.0 ? tc - t0 : t1 - tc);
}

// Optical depth from p toward the sun; x < 0 when the planet is in the way.
vec3 sunDepth(vec3 p) {
  if (hitSphere(p, uSunDir, uRadius).x > 0.0) return vec3(-1.0);
  float t1 = hitSphere(p, uSunDir, uRadius + uTop).y;
  float tc = clamp(-dot(p, uSunDir), 0.0, t1);
  vec3 depth = vec3(0.0);
  float prev = 0.0;
  for (int i = 1; i <= LIGHT_STEPS; i++) {
    float t = warp(float(i) / float(LIGHT_STEPS), 0.0, tc, t1);
    depth += density(length(p + uSunDir * (0.5 * (prev + t))) - uRadius) * (t - prev);
    prev = t;
  }
  return depth;
}

// Stars sized to the tile, hidden by the planet.
vec3 starfield(vec2 uv) {
  vec2 p = uv * vec2(uAspect, 1.0) * 60.0;
  vec2 id = floor(p);
  if (hash12(id) > uStars * 0.08) return vec3(0.0);
  vec2 o = (vec2(hash12(id + 7.1), hash12(id + 3.3)) - 0.5) * 0.6;
  float r = mix(0.05, 0.12, pow(hash12(id + 1.7), 4.0));
  float px = 60.0 / uTileH;
  float d = length(fract(p) - 0.5 - o);
  float b = smoothstep(r + px, max(r - px, 0.0), d) * mix(0.15, 1.4, pow(hash12(id + 9.2), 3.0));
  return b * mix(vec3(1.0, 0.9, 0.82), vec3(0.85, 0.92, 1.0), hash12(id + 4.4));
}

void main() {
  vec3 rd = viewRay(vUv);
  vec3 ro = uCamera;
  float jitter = hash12(gl_FragCoord.xy);
  float mu = dot(rd, uSunDir);

  vec2 atmo = hitSphere(ro, rd, uRadius + uTop);
  vec2 ground = hitSphere(ro, rd, uRadius);
  bool hitGround = ground.x > 0.0;

  vec3 behind = starfield(vUv);
  if (hitGround) {
    vec3 p = ro + rd * ground.x;
    vec3 n = normalize(p);
    vec3 e = uViewToEarth * n;
    vec3 center;
    float land = landDot(e, center);
    float cosSun = dot(n, uSunDir);
    vec3 sd = sunDepth(p + n * 0.01);
    vec3 sunlight = sd.x < 0.0 ? vec3(0.0) : uSun * exp(-extinction(sd)) * max(cosSun, 0.0);
    // A little blue skylight wraps past the terminator.
    vec3 skylight = uSun * 0.025 * vec3(0.35, 0.55, 1.0) * smoothstep(-0.12, 0.5, cosSun);
    vec3 albedo = mix(uOcean, uDotColor, land);
    // The dots glow faintly on the night side so the map still reads there.
    float night = 1.0 - smoothstep(-0.15, 0.1, cosSun);
    behind = albedo / PI * (sunlight + skylight) + uDotColor * land * uNightGlow * night;
  }

  vec3 col = behind;
  if (atmo.y > 0.0) {
    float t0 = max(atmo.x, 0.0);
    float t1 = hitGround ? ground.x : atmo.y;
    float tc = clamp(-dot(ro, rd), t0, t1);
    vec3 depth = vec3(0.0);
    vec3 sumR = vec3(0.0);
    vec3 sumM = vec3(0.0);
    float prev = t0;
    for (int i = 1; i <= VIEW_STEPS; i++) {
      float t = warp(float(i) / float(VIEW_STEPS), t0, tc, t1);
      vec3 p = ro + rd * mix(prev, t, jitter);
      vec3 d = density(length(p) - uRadius) * (t - prev);
      prev = t;
      depth += d;
      vec3 sd = sunDepth(p);
      if (sd.x < 0.0) continue;
      vec3 T = exp(-extinction(depth + sd));
      sumR += T * d.x;
      sumM += T * d.y;
    }
    vec3 inscatter = uSun * (uRayleigh * phaseRayleigh(mu) * sumR + uMieScatter * phaseHG(mu, uMieG) * sumM);
    col = behind * exp(-extinction(depth)) + inscatter;
  }
  fragColor = vec4(col, 1.0);
}
`;

export const COMPOSITE_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;

${COMMON}

uniform sampler2D uScene;
uniform float uExposure;
uniform vec3 uPaper;
uniform float uGrain;
uniform float uDust;
uniform float uGlow;
uniform float uAberration;
uniform vec3 uHere;        // the viewer's location, Earth-fixed
uniform float uTime;       // seconds
uniform float uPulse;      // 0 = still (reduced motion), 1 = pulsing

const float PULSE_PERIOD = 6.0;   // seconds between ripples

// Dust on the print: sparse, slightly soft specks over everything.
float dust(vec2 uv) {
  vec2 p = uv * vec2(uAspect, 1.0) * 30.0;
  vec2 id = floor(p);
  if (hash12(id + 17.0) > uDust * 0.05) return 0.0;
  vec2 o = (vec2(hash12(id + 2.3), hash12(id + 5.9)) - 0.5) * 0.7;
  float r = mix(0.012, 0.04, pow(hash12(id + 8.1), 3.0));
  float px = 30.0 / uTileH;
  float d = length(fract(p) - 0.5 - o);
  return smoothstep(r + px, max(r - px * 0.5, 0.0), d) * mix(0.3, 0.9, hash12(id + 4.4));
}

// One mip level, softened: small mips upsampled bilinearly look blocky.
vec3 blurLod(vec2 uv, float lod) {
  vec2 o = exp2(lod) / vec2(textureSize(uScene, 0));
  return textureLod(uScene, uv, lod).rgb * 0.36
    + (textureLod(uScene, uv + vec2(o.x, o.y * 0.5), lod).rgb + textureLod(uScene, uv - vec2(o.x, o.y * 0.5), lod).rgb
    + textureLod(uScene, uv + vec2(-o.x * 0.5, o.y), lod).rgb + textureLod(uScene, uv + vec2(o.x * 0.5, -o.y), lod).rgb) * 0.16;
}

vec3 aces(vec3 c) {
  return clamp((c * (2.51 * c + 0.03)) / (c * (2.43 * c + 0.59) + 0.14), 0.0, 1.0);
}

// The viewer's dot and the ripple, drawn after tone mapping so the yellow
// stays yellow on bright land. Returns colour in rgb and coverage in a.
vec4 here(vec2 uv) {
  vec3 rd = viewRay(uv);
  vec2 ground = hitSphere(uCamera, rd, uRadius);
  if (ground.x < 0.0) return vec4(0.0);
  vec3 n = normalize(uCamera + rd * ground.x);
  // Fade toward the limb, where the surface turns away.
  float facing = smoothstep(0.0, 0.25, dot(n, -rd));
  vec3 e = uViewToEarth * n;
  vec3 yellow = vec3(1.0, 0.8, 0.2);

  float t = uTime * uPulse;
  float cycle = mod(t, PULSE_PERIOD) / PULSE_PERIOD;
  float aa = max(length(fwidth(e)), 1e-5);

  // The viewer's dot: a solid core that breathes, and a ring that expands
  // and fades with each pulse.
  float d = length(e - uHere);
  float coreR = uDotRadius * 2.3;
  float core = 1.0 - smoothstep(coreR - aa, coreR + aa, d);
  // A thin dark outline so the dot stands out on bright land dots.
  float outline = (1.0 - smoothstep(coreR + aa, coreR * 1.45 + aa, d)) * (1.0 - core);
  float breathe = 0.85 + 0.15 * sin(t * 2.0 * PI / PULSE_PERIOD * 2.0);
  float ringR = coreR * mix(1.3, 5.5, cycle);
  float ring = (1.0 - smoothstep(0.0, aa * 1.5 + uDotRadius * 0.45, abs(d - ringR))) * (1.0 - cycle) * uPulse;
  float halo = exp(-d * d / (coreR * coreR * 9.0)) * 0.45;

  // The ripple: a band of light running out across the globe along the
  // surface, lighting the land dots it passes and fading as it travels.
  vec3 center;
  float land = landDot(e, center);
  // Width, speed and reach are in dot spacings, so the ripple looks the
  // same in the zoomed-in limb view as on the whole globe.
  float angle = acos(clamp(dot(e, uHere), -1.0, 1.0));
  float reach = min(PI * 0.75, uDotSpacing * 70.0);
  float front = cycle * reach * 1.15;
  float fade = 1.0 - smoothstep(0.0, reach, front);
  float band = exp(-pow((angle - front) / (uDotSpacing * 1.6), 2.0)) * fade * uPulse;
  float wake = exp(-max(front - angle, 0.0) / (uDotSpacing * 4.0)) * step(angle, front) * 0.25 * fade * uPulse;

  float ripple = land * clamp(band * 1.2 + wake, 0.0, 1.0);
  float glowA = clamp(halo * breathe + ring * 0.9, 0.0, 1.0);
  float a = clamp(max(core * breathe, max(glowA, max(ripple * 0.85, outline * 0.8))), 0.0, 1.0) * facing;
  vec3 rgb = mix(yellow, vec3(1.0, 0.93, 0.7), clamp(ripple - core, 0.0, 1.0) * 0.4);
  // The outline is near-black ink, except where the ring or halo is brighter.
  rgb = mix(rgb, vec3(0.08, 0.06, 0.03), outline * (1.0 - glowA));
  return vec4(rgb, a);
}

void main() {
  vec2 uv = vUv;
  vec2 shift = (uv - 0.5) * uAberration;
  vec3 col = vec3(texture(uScene, uv + shift).r, texture(uScene, uv).g, texture(uScene, uv - shift).b);

  // Halation from the mip chain, picked by tile size.
  float lod = log2(max(uTileH / 600.0, 1.0));
  vec3 glow = blurLod(uv, lod + 1.5) * 0.3 + blurLod(uv, lod + 3.0) * 0.4 + blurLod(uv, lod + 4.5) * 0.3;
  col += glow * uGlow;
  col = pow(aces(col * uExposure), vec3(1.0 / 2.2));
  vec4 mark = here(uv);
  col = mix(col, mark.rgb, mark.a);

  // The print's black, then grain: strongest in the midtones.
  col = uPaper + col * (1.0 - uPaper);
  float cell = max(1.0, uTileH / 600.0);
  vec2 g = gl_FragCoord.xy / cell;
  float noise = vnoise(vec3(g, 3.7)) + vnoise(vec3(g * 1.9, 9.1)) - 1.0;
  float l = luma(col);
  col += noise * uGrain * 0.06 * (0.35 + 2.5 * l * (1.0 - l));
  col += dust(uv) * (1.0 - l);
  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;
