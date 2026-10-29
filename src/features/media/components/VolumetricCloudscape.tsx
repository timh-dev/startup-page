import React, { useEffect, useRef, useState } from "react";
import { createAdaptiveResolution } from "@/lib/adaptive-resolution";
import { getFlashEnvelope } from "@/features/weather/lightning";
import { ambientFrameMs } from "@/lib/power";
import { debugNow, debugTimeZone, wallClock } from "@/lib/debug";
import { motionTime, replayNow } from "@/lib/motion";

const VERTEX_SHADER = `
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision highp float;

uniform vec2  u_resolution;
uniform float u_time;
uniform float u_phase;      // 0=day → 1=sunset → 2=night (continuous)
uniform float u_coverage;   // 0-1 real cloud-sky fraction (OpenWeather clouds.all)
uniform float u_density;    // 0-1 optical thickness — how dark/heavy the deck reads
uniform float u_style;      // 1=stratocumulus,2=cumulus,3=stratus,4=nimbostratus,5=cumulonimbus,6=supercell
uniform float u_hour;       // 0-24 wall-clock hour
uniform float u_fog;        // 0-1 fog intensity
uniform float u_wind;       // drift-speed multiplier ~0.4..2.6
uniform float u_flash;      // 0-1 lightning illumination envelope
uniform sampler2D u_textTex; // alpha mask of overlay text (e.g. location label), canvas-sized

// ---- noise ----
float hash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float noise(vec3 x) {
  vec3 i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash(i),           hash(i+vec3(1,0,0)), f.x),
        mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x), f.y),
    mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),
        mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x), f.y),
    f.z);
}
float fbm(vec3 p) {
  float v = 0.0, a = 0.55;
  mat3 m = mat3(1.6,0.2,0.0, -0.2,1.5,0.1, 0.1,-0.1,1.7);
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = m * p + vec3(11.7,3.4,7.1); a *= 0.52; }
  return v;
}
// Cheaper 3-octave fbm for directional-light density taps
float fbm3(vec3 p) {
  float v = 0.0, a = 0.58;
  mat3 m = mat3(1.6,0.2,0.0, -0.2,1.5,0.1, 0.1,-0.1,1.7);
  for (int i = 0; i < 3; i++) { v += a * noise(p); p = m * p + vec3(11.7,3.4,7.1); a *= 0.52; }
  return v;
}
float ridge(float x) { return 1.0 - abs(x * 2.0 - 1.0); }

// Gloom factor: thick rain/storm decks desaturate + darken every cloud colour.
float gloom() {
  float styleGloom = clamp((u_style - 3.5) / 2.5, 0.0, 1.0);
  return max(styleGloom, u_density * 0.72);
}

// ---- sky & cloud colours ----
// Eight-stop piecewise sky aligned to real twilight bands.
// Phase bands (mirror of getTimePhase() civil/nautical/astronomical encoding):
//   0.00→0.55  day
//   0.55→0.85  day → pre-golden
//   0.85→1.00  pre-golden → golden hour
//   1.00→1.18  golden → civil twilight peak / sunset
//   1.18→1.45  sunset → civil (blue hour)
//   1.45→1.80  civil → nautical
//   1.80→1.92  nautical → astronomical
//   1.92→2.00  astronomical → full night
vec3 skyColor(float y) {
  float tY = mix(0.34, 0.68, y);
  float p = clamp(u_phase, 0.0, 2.0);

  // Supercell: sickly green-gray, still responsive to time of day
  if (u_style > 5.5) {
    vec3 sc = mix(vec3(0.10,0.13,0.095), vec3(0.17,0.21,0.16), tY);
    return sc * mix(1.0, 0.18, smoothstep(0.9, 2.0, p));
  }

  vec3 sDay   = mix(vec3(0.56,0.82,1.00), vec3(0.10,0.30,0.84), tY); // crisp azure
  vec3 sPreGo = mix(vec3(0.88,0.66,0.26), vec3(0.16,0.24,0.70), tY);
  vec3 sGold  = mix(vec3(1.00,0.60,0.08), vec3(0.18,0.12,0.52), tY);
  vec3 sSunst = mix(vec3(0.98,0.32,0.06), vec3(0.28,0.06,0.42), tY);
  vec3 sCivil = mix(vec3(0.51,0.51,0.98), vec3(0.04,0.04,0.22), tY); // Belt of Venus → deep indigo
  vec3 sNaut  = mix(vec3(0.07,0.11,0.32), vec3(0.02,0.02,0.12), tY);
  vec3 sAstro = mix(vec3(0.03,0.05,0.16), vec3(0.01,0.01,0.07), tY);
  vec3 sNight = mix(vec3(0.02,0.04,0.12), vec3(0.01,0.015,0.05), tY);

  // Overcast grey-shift, scaled by real coverage AND density: an 85% deck with
  // thin spots stays noticeably brighter than a 100% slab of nimbostratus.
  float oc = clamp((u_style - 2.5) / 2.0, 0.0, 1.0) * smoothstep(0.45, 0.95, u_coverage);
  float ocStrength = oc * mix(0.42, 0.82, u_density);
  if (ocStrength > 0.01) {
    sDay    = mix(sDay,    mix(vec3(0.46,0.54,0.66), vec3(0.22,0.28,0.44), tY), ocStrength);
    sPreGo  = mix(sPreGo,  mix(vec3(0.38,0.32,0.32), vec3(0.15,0.13,0.19), tY), ocStrength);
    sGold   = mix(sGold,   mix(vec3(0.38,0.30,0.25), vec3(0.15,0.11,0.17), tY), ocStrength);
    sSunst  = mix(sSunst,  mix(vec3(0.28,0.17,0.17), vec3(0.11,0.07,0.15), tY), ocStrength);
    sCivil  = mix(sCivil,  mix(vec3(0.15,0.17,0.33), vec3(0.04,0.04,0.14), tY), ocStrength * 0.95);
    sNaut   = mix(sNaut,   mix(vec3(0.06,0.07,0.14), vec3(0.02,0.02,0.07), tY), ocStrength * 0.8);
  }
  // Cumulonimbus bruised shift
  float cb = clamp((u_style - 4.5), 0.0, 1.0);
  if (cb > 0.01) {
    sDay   = mix(sDay,   mix(vec3(0.16,0.18,0.24), vec3(0.07,0.08,0.15), tY), cb * 0.78);
    sPreGo = mix(sPreGo, mix(vec3(0.20,0.14,0.14), vec3(0.08,0.06,0.11), tY), cb * 0.75);
    sGold  = mix(sGold,  mix(vec3(0.22,0.14,0.14), vec3(0.08,0.05,0.10), tY), cb * 0.75);
    sSunst = mix(sSunst, mix(vec3(0.14,0.08,0.10), vec3(0.05,0.03,0.08), tY), cb * 0.75);
  }

  vec3 col = sDay;
  col = mix(col, sPreGo, smoothstep(0.55, 0.85, p));
  col = mix(col, sGold,  smoothstep(0.85, 1.00, p));
  col = mix(col, sSunst, smoothstep(1.00, 1.18, p));
  col = mix(col, sCivil, smoothstep(1.18, 1.45, p));
  col = mix(col, sNaut,  smoothstep(1.45, 1.80, p));
  col = mix(col, sAstro, smoothstep(1.80, 1.92, p));
  col = mix(col, sNight, smoothstep(1.92, 2.00, p));
  return col;
}

// Cloud highlight colour — sunlit faces. Phase-aware for every cloud genus,
// then desaturated/darkened by gloom (thick storm decks never show warm whites).
vec3 cloudLight() {
  float p = clamp(u_phase, 0.0, 2.0);
  vec3 col = vec3(1.00, 0.98, 0.92);                                 // midday warm white
  col = mix(col, vec3(1.00, 0.88, 0.58), smoothstep(0.55, 0.85, p)); // pre-golden
  col = mix(col, vec3(1.00, 0.76, 0.32), smoothstep(0.85, 1.00, p)); // golden amber
  col = mix(col, vec3(1.00, 0.48, 0.22), smoothstep(1.00, 1.18, p)); // fiery sunset
  col = mix(col, vec3(0.52, 0.64, 0.96), smoothstep(1.18, 1.38, p)); // blue hour
  col = mix(col, vec3(0.36, 0.44, 0.70), smoothstep(1.38, 1.65, p)); // nautical steel
  col = mix(col, vec3(0.28, 0.32, 0.50), smoothstep(1.65, 2.00, p)); // moonlit night
  float g = gloom();
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(col, vec3(lum), g * 0.7);
  col *= mix(1.0, 0.42, g);
  if (u_style > 5.5) col *= vec3(0.82, 1.0, 0.84); // supercell green cast
  return col;
}

// Cloud shadow colour — undersides. Density deepens the bases.
vec3 cloudShadow() {
  float p = clamp(u_phase, 0.0, 2.0);
  vec3 col = vec3(0.44, 0.56, 0.74);                                 // midday blue-gray
  col = mix(col, vec3(0.52, 0.30, 0.36), smoothstep(0.55, 0.85, p));
  col = mix(col, vec3(0.50, 0.20, 0.32), smoothstep(0.85, 1.00, p));
  col = mix(col, vec3(0.36, 0.10, 0.22), smoothstep(1.00, 1.18, p));
  col = mix(col, vec3(0.08, 0.12, 0.40), smoothstep(1.18, 1.38, p));
  col = mix(col, vec3(0.04, 0.06, 0.20), smoothstep(1.38, 1.65, p));
  col = mix(col, vec3(0.02, 0.04, 0.12), smoothstep(1.65, 2.00, p));
  float g = gloom();
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(col, vec3(lum), g * 0.6);
  col *= mix(1.0, 0.22, g);
  if (u_style > 5.5) col *= vec3(0.80, 1.0, 0.82);
  return col;
}

// ---- celestial positions ----
vec2 sunUV() {
  float t = clamp((u_hour - 5.5) / 13.0, 0.0, 1.0);
  float x = mix(0.04, 0.96, t);
  float elev = sin(3.14159265 * t);
  float y = mix(0.08, 0.76, elev) * clamp(1.6 - u_phase, 0.0, 1.0) + 0.08 * clamp(u_phase, 0.0, 1.0);
  return vec2(x, y);
}
vec2 moonUV() {
  float t = clamp((u_phase - 1.2) / 0.8, 0.0, 1.0);
  float x = mix(0.80, 0.20, t);
  float y = 0.13 + sin(3.14159265 * t) * 0.52;
  return vec2(x, y);
}

// Hue of the dominant light source: warm sun by day, silver moon at night.
vec3 lightHue() {
  vec3 sun = mix(vec3(1.0, 0.97, 0.86), vec3(1.0, 0.55, 0.20), smoothstep(0.0, 1.1, clamp(u_phase, 0.0, 2.0)));
  return mix(sun, vec3(0.72, 0.78, 0.95), smoothstep(1.25, 1.6, u_phase));
}

// Aspect-correct a uv-space offset so distances from it stay circular
// regardless of the container's width/height ratio.
vec2 aspectCorrect(vec2 v) {
  v.x *= u_resolution.x / max(u_resolution.y, 1.0);
  return v;
}

// ---- sun rendering ----
vec3 drawSun(vec2 uv, vec3 col) {
  float vis = clamp(1.6 - u_phase, 0.0, 1.0);
  if (vis < 0.01 || u_style > 5.5) return col;
  vec2 sp = sunUV();
  float d  = length(aspectCorrect(uv - sp));
  vec3 hue = mix(vec3(1.0,0.97,0.86), vec3(1.0,0.58,0.22), smoothstep(0.0,1.0,u_phase));
  // Cloud alpha occludes the disc when composited over; only diffuse light needs
  // a coverage attenuation (scattered out before reaching the viewer).
  float block = clamp(u_coverage * (0.35 + u_density * 0.65), 0.0, 1.0);

  float coR = mix(0.26, 0.44, smoothstep(0.0,1.0,u_phase));
  float corona = pow(max(0.0, 1.0 - d / coR), 2.4) * vis * (1.0 - block * 0.75);
  col += hue * corona * 0.52;

  float glow = pow(max(0.0, 1.0 - d / 0.09), 3.8) * vis * (1.0 - block * 0.8);
  col += hue * glow * 0.58;

  float disc = smoothstep(0.030, 0.020, d) * vis * (1.0 - block * 0.55);
  col = mix(col, hue * 1.5, disc);

  float nearHorizon = smoothstep(0.28, 1.0, u_phase);
  if (nearHorizon > 0.01) {
    float hg = exp(-abs(uv.y - 0.13) * 6.5) * exp(-abs(uv.x - sp.x) * 1.6);
    hg *= nearHorizon * (1.0 - block * 0.65) * 0.55;
    vec3 hCol = mix(vec3(1.0,0.72,0.28), vec3(0.88,0.30,0.48), smoothstep(0.28,1.0,u_phase));
    col += hCol * hg;
  }

  // Crepuscular rays fanning through cloud gaps — only with partial cover
  float gapRays = u_coverage * (1.0 - u_coverage) * 4.0; // peaks at 50% cover
  if (gapRays > 0.05 && u_phase < 1.3) {
    float rayDir = atan(uv.y - sp.y, uv.x - sp.x);
    float rayDist = length(aspectCorrect(uv - sp));
    float rays = noise(vec3(rayDir * 3.2, u_time * 0.045, 0.5));
    rays *= exp(-rayDist * 3.8) * gapRays * (1.3 - u_phase) * 0.13;
    col += hue * max(0.0, rays);
  }
  return col;
}

// ---- moon rendering ----
vec3 drawMoon(vec2 uv, vec3 col) {
  float vis = smoothstep(1.35, 2.0, u_phase);
  if (vis < 0.01) return col;
  vec2 mp = moonUV();
  float d = length(aspectCorrect(uv - mp));
  float clr = 1.0 - clamp(u_coverage * (0.4 + u_density * 0.6), 0.0, 1.0) * 0.85;

  float glow = pow(max(0.0, 1.0 - d / 0.14), 2.6) * vis * clr;
  col += vec3(0.52,0.60,0.78) * glow * 0.30;

  float halo = smoothstep(0.060, 0.050, d) * (1.0 - smoothstep(0.052, 0.065, d));
  col += vec3(0.56,0.64,0.80) * halo * vis * clr * 0.24;

  float disc = smoothstep(0.026, 0.017, d) * vis * clr;
  col = mix(col, vec3(0.88,0.92,0.97) * 1.12, disc);
  return col;
}


// ---- volumetric clouds ----
uniform sampler2D u_noise; // 256x256: R = lattice value, G = R offset by (37, 239)

const int CLOUD_STEPS = 44;
const int LIGHT_STEPS = 4;
// The camera sits at cloud level looking straight ahead (+z), so clouds
// fill the frame side-on and drift across it, nearer ones faster. Clouds
// occupy depths DEPTH_NEAR..DEPTH_FAR in front of it (units ~1 km).
const float DEPTH_NEAR = 2.0;
const float DEPTH_FAR = 12.0;
const float MAX_DISTANCE_KM = 12.0;
const float HAZE_KM = 7.0;
const float TAN_HALF_FOV = 0.5; // vertical, ~53° field of view

struct CloudLayer {
  float base;       // km below (-) or above (+) the camera
  float top;        // km
  float scale;      // noise frequency per km
  float threshold;  // density offset at full coverage
  float stretch;    // vertical squash of the noise (flat decks < 1 < towers)
  float extinction; // per km at full density
  float billow;     // 0 = soft deck, 1 = cauliflower cumulus
};

CloudLayer cloudLayer() {
  // 1 stratocumulus, 2 cumulus, 3 stratus, 4 nimbostratus, 5 cumulonimbus, 6 supercell
  // base/top are the full vertical extent relative to the camera's height;
  // cloudBands() places the layers within it. Looking along the layers the
  // eye passes through kilometres of cloud, so broken clouds need higher
  // thresholds than from below to keep gaps.
  if (u_style < 1.5) return CloudLayer(-2.4, 2.1, 1.20, 0.40, 1.3, 22.0, 0.35);
  if (u_style < 2.5) return CloudLayer(-2.2, 3.3, 1.00, 0.42, 1.0, 26.0, 1.0);
  if (u_style < 3.5) return CloudLayer(-4.0, 4.0, 0.95, 0.28, 1.6, 16.0, 0.0);
  if (u_style < 4.5) return CloudLayer(-4.5, 4.5, 0.85, 0.27, 1.3, 30.0, 0.2);
  if (u_style < 5.5) return CloudLayer(-4.0, 7.0, 0.70, 0.30, 0.8, 34.0, 0.8);
  return CloudLayer(-4.5, 8.0, 0.65, 0.28, 0.7, 38.0, 0.7);
}

// View direction for a screen position: a pinhole camera at cloud level
// looking straight ahead along +z.
vec3 viewRay(vec2 screen) {
  float aspect = u_resolution.x / max(u_resolution.y, 1.0);
  vec2 ndc = screen * 2.0 - 1.0;
  return normalize(vec3(ndc.x * aspect * TAN_HALF_FOV, ndc.y * TAN_HALF_FOV, 1.0));
}

// Value noise from a 2D texture read as 3D: slice z is the texture offset by
// (37, 239) * z, and G holds the next slice, so one fetch gives both.
float tnoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  vec2 uv = i.xy + vec2(37.0, 239.0) * i.z + f.xy;
  vec2 rg = texture2D(u_noise, (uv + 0.5) / 256.0).rg;
  return mix(rg.x, rg.y, f.z);
}

const mat3 OCTAVE = mat3(0.00, 0.80, 0.60, -0.80, 0.36, -0.48, -0.60, -0.48, 0.64);

float fbm4(vec3 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * tnoise(p); p = OCTAVE * p * 2.02; a *= 0.5; }
  return v / 0.9375;
}

float fbm2(vec3 p) {
  float v = 0.5 * tnoise(p);
  p = OCTAVE * p * 2.02;
  v += 0.25 * tnoise(p);
  return v / 0.75;
}

// One layer between heights lo and hi: fades at both ends so clouds round
// off instead of being cut flat; cumulus keeps a flatter base and a taller
// dome.
float band(float y, float lo, float hi, float billow) {
  float h = (y - lo) / (hi - lo);
  if (h < 0.0 || h > 1.0) return 0.0;
  return smoothstep(0.0, mix(0.35, 0.2, billow), h) * (1.0 - smoothstep(mix(0.45, 0.3, billow), 1.0, h));
}

// How much cloud a height can hold. Broken skies have layers at different
// altitudes (low, middle, and thin wisps high up), so clouds fill the frame
// at several heights; overcast and storm decks are one deep layer that
// fills it top to bottom.
float cloudBands(float y, CloudLayer layer) {
  if (u_style < 1.5) {
    return max(max(band(y, -2.4, -0.9, 0.35), band(y, -1.2, 0.7, 0.35)), 0.65 * band(y, 1.0, 2.1, 0.1));
  }
  if (u_style < 2.5) {
    return max(max(band(y, -2.2, -0.1, 1.0), band(y, -0.4, 1.9, 1.0)), 0.55 * band(y, 2.2, 3.3, 0.1));
  }
  float h = (y - layer.base) / (layer.top - layer.base);
  if (h < 0.0 || h > 1.0) return 0.0;
  return smoothstep(0.0, 0.1, h) * (1.0 - smoothstep(0.9, 1.0, h));
}

vec3 cloudCoords(vec3 pos, CloudLayer layer, float wt) {
  vec3 q = pos * layer.scale;
  q.y *= layer.stretch;
  // Wind carries the clouds sideways across the view; they churn slowly.
  return q + vec3(wt * 0.16, 0.0, u_time * 0.006);
}

float coverageThreshold(CloudLayer layer, float coverage) {
  return mix(0.70, layer.threshold, pow(coverage, 0.75));
}

// Layer heights undulate: small rolls and lumps on bases and tops, and a
// broad swell over kilometres, so no layer edge runs straight across the
// frame (in perspective, flat layers converge into a seam at eye level).
float undulate(vec3 q, float h) {
  return h + (tnoise(q * 0.35 + vec3(5.2, 0.0, 1.3)) - 0.5) * 0.45
           + (tnoise(q * 0.11 + vec3(3.1, 7.7, 1.9)) - 0.5) * 1.6;
}

float cloudDensity(vec3 pos, CloudLayer layer, float coverage, float wt, float h) {
  if (h < 0.0 || h > 1.0) return 0.0;
  vec3 q = cloudCoords(pos, layer, wt);
  // The undulation shifts layer boundaries, so bases and tops aren't flat.
  float y = pos.y + undulate(q, 0.0) * 1.3;
  float shape = fbm4(q);
  // Cauliflower billows: ridged noise mixed into cumulus.
  shape = mix(shape, 1.0 - abs(shape * 2.0 - 1.0), layer.billow * 0.2);
  return clamp((shape * cloudBands(y, layer) - coverageThreshold(layer, coverage)) * 3.0, 0.0, 1.0);
}

float cloudDensityCheap(vec3 pos, CloudLayer layer, float coverage, float wt, float h) {
  if (h < 0.0 || h > 1.0) return 0.0;
  vec3 q = cloudCoords(pos, layer, wt);
  float y = pos.y + undulate(q, 0.0) * 1.3;
  return clamp((fbm2(q) * cloudBands(y, layer) - coverageThreshold(layer, coverage)) * 3.0, 0.0, 1.0);
}

float henyeyGreenstein(float mu, float g) {
  float gg = g * g;
  return (1.0 - gg) / (12.566 * pow(max(1.0 + gg - 2.0 * g * mu, 1e-4), 1.5));
}

// A small random offset for each ray's start, enough to break up banding
// between steps. Interleaved gradient noise was tried first, but its
// regular pattern showed as hatching on the clouds at this resolution.
float rayJitter(vec2 px) {
  return fract(sin(dot(px, vec2(12.9898, 78.233))) * 43758.5453) * 0.35;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  vec2 p  = uv * 2.0 - 1.0;
  p.x *= u_resolution.x / max(u_resolution.y, 1.0);

  float coverage = clamp(u_coverage, 0.0, 1.0);
  float density  = clamp(u_density, 0.0, 1.0);
  float wt = u_time * u_wind; // wind-scaled drift time

  vec3 color = skyColor(uv.y);

  // Lightning: diffuse sky flash behind/through the deck
  color += vec3(0.50, 0.56, 0.80) * u_flash * 0.4;

  color = drawSun(uv, color);
  color = drawMoon(uv, color);

  // ---- directional light setup ----
  // Light position in uv space; direction toward it in aspect-corrected p space.
  vec2 lp = u_phase < 1.4 ? sunUV() : moonUV();
  vec2 lpP = lp * 2.0 - 1.0;
  lpP.x *= u_resolution.x / max(u_resolution.y, 1.0);
  vec2 lDir = normalize(lpP - p + vec2(1e-4, 1e-4));
  float lightProx = exp(-length(uv - lp) * 2.1);
  // Direct light strength: full sun by day, weak moonlight at night, diffused by density
  float dirStrength = max(clamp(1.6 - u_phase, 0.0, 1.0), smoothstep(1.35, 2.0, u_phase) * 0.30);
  dirStrength *= mix(1.0, 0.28, density);
  vec3 hueL = lightHue();

  // ---- clouds: volumetric raymarching ----
  // After Maxime Heckel's "Real-time dreamy Cloudscapes with Volumetric
  // Raymarching": rays from a camera at cloud level march through a 3D cloud
  // layer in front of it; density is fbm noise (sampled from a noise texture) shaped by
  // coverage and a height profile; each sample marches toward the light for
  // self-shadowing (Beer's law) and is lit with a two-lobe Henyey-Greenstein
  // phase, so edges toward the sun glow; a small jitter on the ray start
  // hides banding between steps.
  CloudLayer layer = cloudLayer();
  vec3 rd = viewRay(uv);
  vec3 lightDir = viewRay(lp);

  float alpha  = 0.0;
  vec3  clouds = vec3(0.0);
  float transmittance = 1.0;

  // The stretch of the ray inside the cloud volume: between the near and far
  // depths, and within the layer's height band.
  float tEnter = DEPTH_NEAR / rd.z;
  float tExit = DEPTH_FAR / rd.z;
  if (abs(rd.y) > 1e-4) {
    float tA = layer.base / rd.y;
    float tB = layer.top / rd.y;
    tEnter = max(tEnter, min(tA, tB));
    tExit = min(tExit, max(tA, tB));
  } else if (layer.base > 0.0 || layer.top < 0.0) {
    tExit = -1.0;
  }

  if (coverage > 0.01) {
    if (tEnter < tExit) {
      float dt = (tExit - tEnter) / float(CLOUD_STEPS);
      float t = tEnter + dt * rayJitter(gl_FragCoord.xy);

      float mu = dot(rd, lightDir);
      vec3 sunColor = cloudLight() * (1.0 * dirStrength) * hueL;
      // At night clouds catch a little moonlight and city glow, so they
      // read as slightly lighter than the sky instead of vanishing into it.
      float night = smoothstep(1.3, 1.9, u_phase);
      vec3 nightGlow = vec3(0.075, 0.085, 0.12) * night;
      vec3 ambientLow = cloudShadow() + nightGlow * 0.7;
      vec3 ambientHigh = mix(cloudShadow(), skyColor(0.9), 0.55) + nightGlow;
      float extinction = layer.extinction * mix(0.75, 1.4, density);

      for (int i = 0; i < CLOUD_STEPS; i++) {
        vec3 pos = rd * t;
        float heightFrac = (pos.y - layer.base) / (layer.top - layer.base);
        // Far away, one pixel spans kilometres of noise; fade it out rather
        // than let it alias.
        // Far away, and where a ray grazes along a deck, one pixel spans
        // kilometres of noise; fade it out rather than let it alias.
        float grazing = smoothstep(0.02, 0.12, abs(rd.y)) + step(layer.base, 0.0) * step(0.0, layer.top);
        float d = cloudDensity(pos, layer, coverage, wt, heightFrac)
                * (1.0 - smoothstep(MAX_DISTANCE_KM * 0.45, MAX_DISTANCE_KM, t)) * min(grazing, 1.0);
        if (d > 0.001) {
          float lightDepth = 0.0;
          float lightStep = 0.12;
          vec3 lp3 = pos;
          for (int j = 0; j < LIGHT_STEPS; j++) {
            lp3 += lightDir * lightStep;
            float hf = (lp3.y - layer.base) / (layer.top - layer.base);
            lightDepth += cloudDensityCheap(lp3, layer, coverage, wt, hf) * lightStep;
            lightStep *= 1.8;
          }
          // Multiple scattering, after Wrenninge (2013): each octave is
          // dimmer, less absorbed and less directional, so light soaks
          // through thin parts of a deck instead of Beer's law cutting it
          // to zero everywhere, and the deck shows its texture.
          float tau = lightDepth * extinction * 0.55;
          float sunlight = 0.0;
          float a = 1.0, b = 1.0, c = 1.0;
          for (int k = 0; k < 3; k++) {
            // Forward lobe kept moderate: a strong one blows out clouds in
            // front of the sun.
            float phase = min(mix(henyeyGreenstein(mu, -0.25 * c), henyeyGreenstein(mu, 0.5 * c), 0.7) * 12.566, 3.0);
            sunlight += a * exp(-tau * b) * phase;
            a *= 0.5; b *= 0.35; c *= 0.5;
          }
          // Beer-powder: darker edges on the side facing the viewer, the
          // "fluffy" look (Schneider, Horizon Zero Dawn).
          float powder = 1.0 - exp(-d * 6.0);
          // Sky light reaches thin, high parts more than deep bases.
          float skyLight = exp(-tau * 0.12);
          vec3 luminance = mix(ambientLow * 0.75, ambientHigh, clamp(heightFrac * 0.6 + skyLight * 0.4, 0.0, 1.0))
                         + sunColor * sunlight * mix(1.0, powder, 0.5)
                         + vec3(0.72, 0.80, 1.0) * u_flash * 0.9;
          // Overcast and storm decks are opaque within a step or two, so what
          // shows is the surface where rays enter. Shade it by noise sampled
          // where the ray hits, at two scales (broad rolls and the lumps
          // within them), so it has texture in perspective.
          vec3 q = cloudCoords(pos, layer, wt);
          // Sampled in 3D: a plane would stay constant along depth and smear
          // into streaks toward the vanishing point on a receding ceiling.
          float rolls = fbm4(q * 2.6 + vec3(0.0, 3.7, 0.0)) * 0.6
                      + fbm2(q * 7.0 + vec3(0.0, 9.1, 0.0)) * 0.4;
          float deckShade = mix(0.32, 1.5, smoothstep(0.28, 0.72, rolls) * 0.85 + skyLight * 0.15);
          luminance *= mix(1.0, deckShade, smoothstep(2.5, 3.5, u_style));
          // Roll off highlights instead of clipping them to white.
          luminance /= 1.0 + max(max(luminance.r, luminance.g), luminance.b) * 0.3;
          float sampleT = exp(-d * extinction * dt);
          // Energy-conserving integration over the step.
          clouds += transmittance * (1.0 - sampleT) * luminance;
          transmittance *= sampleT;
          if (transmittance < 0.02) break;
        }
        t += dt;
      }

      // Aerial perspective: distant clouds fade into the sky near the horizon.
      float haze = exp(-tEnter / HAZE_KM);
      clouds = mix(skyColor(uv.y) * (1.0 - transmittance), clouds, haze);
      alpha = (1.0 - transmittance) * mix(0.55, 1.0, haze);
    }
  }

  // Bright smudge where the sun sits behind a translucent deck
  float deckGlow = lightProx * (1.0 - smoothstep(0.55, 0.95, density))
                 * alpha * clamp(1.6 - u_phase, 0.0, 1.0);
  clouds += hueL * deckGlow * 0.12;

  // ---- fog ground bands ----
  if (u_fog > 0.01) {
    vec3 fogCol = mix(
      mix(vec3(0.82, 0.85, 0.90), vec3(0.26, 0.30, 0.40), smoothstep(0.0, 2.0, u_phase)),
      vec3(0.90, 0.93, 0.96), uv.y * 0.6
    );
    float b1 = smoothstep(0.42, 0.00, uv.y)
             * (0.5 + 0.5 * noise(vec3(uv.x * 2.2 + wt * 0.020, uv.y * 3.5, u_time * 0.012)));
    float b2 = smoothstep(0.24, 0.00, uv.y)
             * (0.4 + 0.6 * noise(vec3(uv.x * 3.6 - wt * 0.016, uv.y * 5.5, u_time * 0.010 + 4.0)));
    float b3 = smoothstep(0.13, 0.00, uv.y)
             * (0.6 + 0.4 * noise(vec3(uv.x * 5.0 + wt * 0.025, uv.y * 8.0, u_time * 0.018 + 8.0)));
    float upper = smoothstep(0.82, 0.50, uv.y) * u_fog * 0.38
                * (0.5 + 0.5 * noise(vec3(uv.x * 1.6 - wt * 0.010, uv.y * 1.8, u_time * 0.007)));
    float fd = clamp(b1 * 0.42 + b2 * 0.52 + b3 * 0.72, 0.0, 1.0) * u_fog;
    color = mix(color, fogCol, fd + upper);
    color = color * (1.0 - alpha * 0.55) + clouds * 0.55;
  } else {
    float haze = 0.018 + smoothstep(0.55, 1.0, uv.y) * 0.012;
    color = mix(color, cloudLight(), haze * coverage);
    color = color * (1.0 - alpha) + clouds;
  }

  // top-sky darkening + overall tints
  float dayish = 1.0 - smoothstep(1.6, 2.0, u_phase);
  float topEq = smoothstep(0.76, 1.0, uv.y) * dayish;
  color = mix(color, color * 0.80, topEq);
  color += vec3(0.045, 0.042, 0.040) * coverage * (1.0 - density * 0.7) * dayish;
  if (u_style > 4.5) color = mix(color, vec3(0.06,0.075,0.07), 0.22);
  color = mix(color, vec3(0.02,0.025,0.035), smoothstep(0.0, 0.22, 1.0 - uv.y) * 0.22);

  // Knockout text: invert the final composited pixel wherever the overlay
  // text mask is opaque, so labels read against whatever sky/cloud/sun/moon
  // color is actually behind them instead of a fixed color.
  float textA = texture2D(u_textTex, uv).a;
  color = mix(color, vec3(1.0) - color, textA);

  gl_FragColor = vec4(color, 1.0);
}
`;

const NOISE_SIZE = 256;

// 256x256 noise for tnoise(): a fixed random lattice in R, and in G the
// lattice value 37 texels right and 239 down, which is the next slice of
// the 3D noise. Seeded so the clouds look the same on every load.
function createNoiseTexels() {
  const values = new Uint8Array(NOISE_SIZE * NOISE_SIZE);
  let seed = 0x2f6b9a1d;
  for (let i = 0; i < values.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    values[i] = seed >>> 24;
  }
  const texels = new Uint8Array(NOISE_SIZE * NOISE_SIZE * 4);
  for (let y = 0; y < NOISE_SIZE; y++) {
    for (let x = 0; x < NOISE_SIZE; x++) {
      const i = (y * NOISE_SIZE + x) * 4;
      texels[i] = values[y * NOISE_SIZE + x];
      texels[i + 1] = values[((y + 239) % NOISE_SIZE) * NOISE_SIZE + ((x + 37) % NOISE_SIZE)];
      texels[i + 3] = 255;
    }
  }
  return texels;
}

// Compile and link without blocking status checks. getShaderParameter/getProgramParameter
// force a GPU pipeline stall (1–3 s on complex shaders). Status is checked lazily in the
// first requestAnimationFrame callback, so React finishes painting before any GPU stall.
function createProgram(gl: WebGLRenderingContext) {
  const vs = gl.createShader(gl.VERTEX_SHADER);
  const fs = gl.createShader(gl.FRAGMENT_SHADER);
  const program = gl.createProgram();
  // All three are null only when the WebGL context has been lost.
  if (!vs || !fs || !program) return null;
  gl.shaderSource(vs, VERTEX_SHADER);
  gl.compileShader(vs);
  gl.shaderSource(fs, FRAGMENT_SHADER);
  gl.compileShader(fs);
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  return program;
}

function getPhaseValue(phase: VolumetricCloudscapeProps["phase"]) {
  if (typeof phase === "number") return Math.min(phase, 2);
  if (phase === "storm") return 0.4; // legacy alias — dark handled via style/density now
  if (phase === "night") return 2;
  if (phase === "sunset") return 1;
  return 0;
}

function getCoverageValue(coverage: VolumetricCloudscapeProps["coverage"]): number {
  if (typeof coverage === "number") return Math.max(0, Math.min(coverage, 1));
  if (coverage === "storm") return 0.95;
  if (coverage === "full")  return 0.85;
  if (coverage === "partly") return 0.35;
  return 0;
}

function getStyleValue(cloudStyle: VolumetricCloudscapeProps["cloudStyle"]) {
  if (cloudStyle === "cumulus")       return 2;
  if (cloudStyle === "stratus")       return 3;
  if (cloudStyle === "nimbostratus")  return 4;
  if (cloudStyle === "cumulonimbus")  return 5;
  if (cloudStyle === "supercell")     return 6;
  return 1;
}

interface VolumetricCloudscapeProps {
  /** Cloud-sky fraction: continuous 0-1, or a legacy bucket name */
  coverage?: "none" | "partly" | "full" | "storm" | number;
  phase?: number | "storm" | "day" | "sunset" | "night";
  cloudStyle?: string;
  fogIntensity?: number;
  /** Optical thickness 0-1 — darkens/thickens the deck */
  density?: number;
  /** Normalized wind 0-1 — scales drift speed */
  windSpeed?: number;
  /** 0-1: drives synchronized in-cloud lightning illumination */
  lightningIntensity?: number;
  /** Wall-clock hour 0-24 override (preview); defaults to the real clock */
  hour?: number;
  /** Text knocked out (color-inverted) directly against the shader: location, temperature, condition */
  locationLabel?: string;
  temperatureLabel?: string;
  conditionLabel?: string;
}

// Clamp a css-px value between a min and max, mirroring CSS clamp(min, preferred, max).
function clampPx(min: number, preferred: number, max: number) {
  return Math.min(max, Math.max(min, preferred));
}

export default function VolumetricCloudscape({
  coverage    = "full",
  phase       = "day" as any,
  cloudStyle  = "stratocumulus",
  fogIntensity = 0,
  density,
  windSpeed = 0.2,
  lightningIntensity = 0,
  hour,
  locationLabel = "",
  temperatureLabel = "",
  conditionLabel = "",
}: VolumetricCloudscapeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [supported, setSupported] = useState(true);
  const propsRef = useRef({ coverage, phase, cloudStyle, fogIntensity, density, windSpeed, lightningIntensity, hour, locationLabel, temperatureLabel, conditionLabel });
  propsRef.current = { coverage, phase, cloudStyle, fogIntensity, density, windSpeed, lightningIntensity, hour, locationLabel, temperatureLabel, conditionLabel };

  useEffect(() => {
    const canvasEl = canvasRef.current;
    const glContext = canvasEl?.getContext("webgl", {
      // Readable after drawing, so joined cards can sample the sky's edge colour.
      preserveDrawingBuffer: true, antialias: false, alpha: false, powerPreference: "low-power" });
    if (!canvasEl || !glContext) { setSupported(false); return undefined; }
    // Re-bound as non-null consts so the nested render functions keep the narrowing.
    const canvas: HTMLCanvasElement = canvasEl;
    const gl: WebGLRenderingContext = glContext;

    let animationFrame = 0;
    const linkedProgram = createProgram(gl);
    if (!linkedProgram) { setSupported(false); return undefined; }
    const program: WebGLProgram = linkedProgram;
    // KHR_parallel_shader_compile lets us poll completion without stalling the GPU pipeline.
    const khrParallel = gl.getExtension("KHR_parallel_shader_compile") as { COMPLETION_STATUS_KHR: number } | null;

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);

    // Offscreen 2D canvas used purely to rasterize overlay text (e.g. the
    // location label) into an alpha mask, uploaded as a texture and inverted
    // per-pixel in the shader — see the u_textTex knockout at the end of main().
    const textCanvas = document.createElement("canvas");
    const textCtx = textCanvas.getContext("2d");
    const textTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, textTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
    let lastTextKey = "";

    // Noise for the cloud volume, read as 3D in the shader (see tnoise()):
    // R is a random lattice value and G is R at (+37, +239), the next z slice.
    const noiseTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, noiseTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, NOISE_SIZE, NOISE_SIZE, 0, gl.RGBA, gl.UNSIGNED_BYTE, createNoiseTexels());

    // Mirrors the .weather-current / .weather-location clamp() rules in
    // index.css — .weather-widget sets container-type: size, so cqh/cqw there
    // are fractions of this same canvas box, which is what cssW/cssH are here.
    // Binary-search the longest prefix (+ ellipsis) of `text` that fits maxWidth,
    // mirroring CSS `truncate`. ctx.font must already be set for this text run.
    function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
      if (ctx.measureText(text).width <= maxWidth) return text;
      let lo = 0, hi = text.length;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        const candidate = text.slice(0, mid) + "…";
        if (ctx.measureText(candidate).width <= maxWidth) lo = mid; else hi = mid - 1;
      }
      return text.slice(0, lo) + "…";
    }

    // The main framebuffer renders at an adaptive resolution (see resize())
    // that drops toward 1x when the cloud shader can't keep up — which would
    // leave text soft on Retina screens. Rasterize the text mask at real device
    // resolution regardless, independent of the main canvas's backing-store
    // size: it's just a texture sample in the shader, so oversampling it
    // costs nothing per-frame, only a slightly bigger one-off upload whenever
    // the text changes. Capped at 3x so huge external monitors don't blow up
    // texture size.
    const superSample = Math.max(1, Math.min(window.devicePixelRatio || 1, 3));

    function syncTextTexture() {
      if (!textCtx) return;
      const p = propsRef.current;
      const location    = (p.locationLabel || "").toUpperCase().trim();
      const temperature = (p.temperatureLabel || "").trim();
      const conditionText = (p.conditionLabel || "").trim();
      const cssW = canvas.clientWidth, cssH = canvas.clientHeight;
      if (!cssW || !cssH) return;
      const key = `${location}|${temperature}|${conditionText}|${cssW}|${cssH}`;
      if (key === lastTextKey) return;
      lastTextKey = key;

      const tw = Math.max(1, Math.round(cssW * superSample));
      const th = Math.max(1, Math.round(cssH * superSample));
      textCanvas.width = tw;
      textCanvas.height = th;
      textCtx.clearRect(0, 0, tw, th);

      const fontFamily = getComputedStyle(canvas).fontFamily || "sans-serif";
      const paddingInline = clampPx(0.75 * 16, cssW * 0.07, 1.25 * 16) * superSample;
      const paddingBlock  = clampPx(0.5  * 16, cssH * 0.06, 1    * 16) * superSample;

      textCtx.textBaseline = "top";
      textCtx.fillStyle = "#fff";

      // Location — top-left, uppercase, letter-spaced. Mirrors .weather-location.
      let locationBottom = paddingBlock;
      if (location) {
        const fontSize = clampPx(1.1 * 16, cssH * 0.098, 1.5 * 16) * superSample;
        textCtx.textAlign = "left";
        textCtx.font = `600 ${fontSize}px ${fontFamily}`;
        if ("letterSpacing" in textCtx) (textCtx as any).letterSpacing = `${fontSize * 0.12}px`;
        textCtx.fillText(location, paddingInline, paddingBlock);
        locationBottom = paddingBlock + fontSize * 1.1;
      }

      // Temperature — below location, left-aligned, bold. Mirrors .weather-temp.
      if (temperature) {
        const fontSize  = clampPx(1.45 * 16, cssH * 0.18, 2.25 * 16) * superSample;
        const marginTop = clampPx(0.0625 * 16, cssH * 0.01, 0.25 * 16) * superSample;
        textCtx.textAlign = "left";
        textCtx.font = `700 ${fontSize}px ${fontFamily}`;
        if ("letterSpacing" in textCtx) (textCtx as any).letterSpacing = `${fontSize * -0.025}px`;
        textCtx.fillText(temperature, paddingInline, locationBottom + marginTop);
      }

      // Condition — top-right, medium weight, truncated to the same max-width
      // as .weather-desc so it never collides with the location/temp column.
      if (conditionText) {
        const fontSize = clampPx(1.1 * 16, cssH * 0.098, 1.5 * 16) * superSample;
        const maxWidth = Math.min(cssW * 0.46, 9.5 * 16) * superSample;
        textCtx.textAlign = "right";
        textCtx.font = `500 ${fontSize}px ${fontFamily}`;
        if ("letterSpacing" in textCtx) (textCtx as any).letterSpacing = "0px";
        textCtx.fillText(fitText(textCtx, conditionText, maxWidth), tw - paddingInline, paddingBlock);
      }

      gl.bindTexture(gl.TEXTURE_2D, textTexture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, textCanvas);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    }


    // Uniform/attrib locations populated lazily on the first frame after link completes.
    let glReady = false;
    let position = -1;
    let uRes: WebGLUniformLocation | null = null;
    let uTime: WebGLUniformLocation | null = null;
    let uPhase: WebGLUniformLocation | null = null;
    let uCoverage: WebGLUniformLocation | null = null;
    let uDensity: WebGLUniformLocation | null = null;
    let uStyle: WebGLUniformLocation | null = null;
    let uHour: WebGLUniformLocation | null = null;
    let uFog: WebGLUniformLocation | null = null;
    let uWind: WebGLUniformLocation | null = null;
    let uFlash: WebGLUniformLocation | null = null;
    let uTextTex: WebGLUniformLocation | null = null;
    let uNoise: WebGLUniformLocation | null = null;

    // One canvas pixel per CSS pixel, scaled up on high-density screens.
    // Clouds are soft (the text over them is HTML), so this looks the same,
    // and the raymarcher is costly per pixel: at 2x density it held the
    // dashboard near 13 fps on an M1, and supersampled at 4x near 4 fps.
    const resolution = createAdaptiveResolution({ max: 1 });

    function resize() {
      const dpr   = resolution.scale;
      const width  = Math.max(1, Math.floor(canvas.clientWidth  * dpr));
      const height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width  = width;
        canvas.height = height;
      }
      gl.viewport(0, 0, width, height);
    }

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);

    const CLOUD_FRAME_MS = 1000 / 20;
    let lastFrameTime = 0;

    function render(now: number) {
      animationFrame = requestAnimationFrame(render);
      if (resolution.sample(now)) resize();
      if (!canvas.clientWidth) return; // hidden (ancestor display:none) — skip GPU work

      if (!glReady) {
        // Non-blocking poll with KHR extension; one-time stall without it (but deferred from mount).
        if (khrParallel && !gl.getProgramParameter(program, khrParallel.COMPLETION_STATUS_KHR)) return;
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
          setSupported(false);
          cancelAnimationFrame(animationFrame);
          return;
        }
        position  = gl.getAttribLocation(program, "a_position");
        uRes      = gl.getUniformLocation(program, "u_resolution");
        uTime     = gl.getUniformLocation(program, "u_time");
        uPhase    = gl.getUniformLocation(program, "u_phase");
        uCoverage = gl.getUniformLocation(program, "u_coverage");
        uDensity  = gl.getUniformLocation(program, "u_density");
        uStyle    = gl.getUniformLocation(program, "u_style");
        uHour     = gl.getUniformLocation(program, "u_hour");
        uFog      = gl.getUniformLocation(program, "u_fog");
        uWind     = gl.getUniformLocation(program, "u_wind");
        uFlash    = gl.getUniformLocation(program, "u_flash");
        uTextTex  = gl.getUniformLocation(program, "u_textTex");
        uNoise    = gl.getUniformLocation(program, "u_noise");
        glReady = true;
      }

      // During an active lightning strike render every frame so the flash flickers
      // crisply; otherwise stay at the power-saving cadence.
      const p = propsRef.current;
      const flash = p.lightningIntensity > 0 ? getFlashEnvelope(Date.now(), p.lightningIntensity) : 0;
      if (flash < 0.01 && now - lastFrameTime < ambientFrameMs(CLOUD_FRAME_MS)) return;
      lastFrameTime = now;

      // During the day replay the sky follows the replayed hour.
      const d = wallClock(replayNow() ?? debugNow(), debugTimeZone());
      const hourNow = p.hour ?? d.hours + d.minutes / 60 + d.seconds / 3600;
      const coverageValue = getCoverageValue(p.coverage);
      // Default density follows coverage when not supplied (legacy callers)
      const densityValue = p.density ?? Math.min(1, 0.25 + coverageValue * 0.5);

      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(uRes,      canvas.width, canvas.height);
      gl.uniform1f(uTime,     motionTime());
      gl.uniform1f(uPhase,    getPhaseValue(p.phase));
      gl.uniform1f(uCoverage, coverageValue);
      gl.uniform1f(uDensity,  Math.max(0, Math.min(densityValue, 1)));
      gl.uniform1f(uStyle,    getStyleValue(p.cloudStyle));
      gl.uniform1f(uHour,     hourNow);
      gl.uniform1f(uFog,      p.fogIntensity);
      gl.uniform1f(uWind,     0.5 + Math.max(0, Math.min(p.windSpeed ?? 0.2, 1)) * 2.1);
      gl.uniform1f(uFlash,    flash);

      syncTextTexture();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, textTexture);
      gl.uniform1i(uTextTex, 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, noiseTexture);
      gl.uniform1i(uNoise, 1);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    animationFrame = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      gl.deleteBuffer(buffer);
      gl.deleteTexture(textTexture);
      gl.deleteTexture(noiseTexture);
      gl.deleteProgram(program);
    };
  }, []);

  if (!supported) {
    const phaseValue = getPhaseValue(phase);
    const coverageValue = getCoverageValue(coverage);
    const coverageClass = coverageValue > 0.8 ? "full" : coverageValue > 0.15 ? "partly" : "none";
    const skyPhase = phaseValue >= 1.5 ? "night" : phaseValue >= 0.5 ? "sunset" : "day";
    return (
      <div className={`weather-sky weather-sky-${skyPhase} weather-cloud-coverage-${coverageClass} absolute inset-0 overflow-hidden pointer-events-none`}>
        <div className="weather-cloud-field weather-cloud-field-1" />
        <div className="weather-cloud-field weather-cloud-field-2" />
        <div className="weather-cloud-field weather-cloud-field-3" />
        <div className="weather-cloud-field weather-cloud-field-4" />
        <div className="weather-cloud-vignette" />
      </div>
    );
  }

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full pointer-events-none" aria-hidden="true" />;
}
