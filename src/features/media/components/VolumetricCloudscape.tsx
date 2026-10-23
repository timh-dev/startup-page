import React, { useEffect, useRef, useState } from "react";
import { getFlashEnvelope } from "@/features/weather/lightning";

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

  // ---- clouds ----
  float alpha  = 0.0;
  vec3  clouds = vec3(0.0);

  // Interior density threshold: the macro masks own the covered-sky fraction,
  // so this stays moderate — low coverage still yields solid, fluffy blobs.
  float threshold = mix(0.74, 0.42, pow(coverage, 0.9));
  if (u_style > 2.5 && u_style < 4.5) threshold -= 0.06;
  if (u_style > 4.5) threshold -= 0.14;
  if (u_phase > 1.5) threshold -= 0.06;

  // Broken-cloud mode: stratocumulus(1) or cumulus(2) with visible coverage.
  // Three independent depth layers with strong parallax: small slow puffs far
  // back near the horizon, big fluffy clouds sweeping past in the foreground.
  float brokenMode = step(u_style, 2.49) * step(0.05, coverage);
  float isCumulus  = step(1.51, u_style) * step(u_style, 2.49);

  // Macro coverage masks — one low-frequency field per depth layer, shared by
  // every raymarch step of that layer. Without this, the union of 30+ shifted
  // noise samples covers the whole sky and "scattered" renders as overcast.
  // The masked-on fraction tracks u_coverage, and each mask drifts with its
  // own layer so gaps travel with the clouds.
  // Calibrated so the masked-on sky fraction roughly tracks u_coverage given
  // fbm's value distribution (mean ~0.55): 40% cover → thr 0.59, 70% → 0.44.
  float maskThr = mix(0.78, 0.30, coverage);
  float mFar  = smoothstep(maskThr, maskThr + 0.15, fbm(vec3(p.x * 1.05 + wt * 0.006, p.y * 1.15, 3.0)));
  float mMid  = smoothstep(maskThr, maskThr + 0.16, fbm(vec3(p.x * 0.85 + wt * 0.024, p.y * 0.95, 17.0)));
  float mNear = smoothstep(maskThr, maskThr + 0.18, fbm(vec3(p.x * 0.48 + wt * 0.075, p.y * 0.62, 31.0)));

  if (brokenMode > 0.5) {
    float a1 = 0.0, a2 = 0.0, a3 = 0.0;
    vec3  c1 = vec3(0.0), c2 = vec3(0.0), c3 = vec3(0.0);

    // ---- FAR layer (10 steps) ----
    // Small flattened puffs compressed toward the horizon, barely drifting,
    // washed out by atmospheric perspective.
    for (int i = 0; i < 10; i++) {
      float t  = float(i) / 9.0;
      float xf = 2.35, yf = mix(2.1, 2.5, isCumulus);
      vec3 sp = vec3(
        p.x * xf + wt * 0.006 + t * 0.34,
        p.y * yf + wt * 0.002 - t * 0.07,
        t * 2.4 + u_time * 0.008
      );
      // Band: distant clouds stack low-mid frame (toward the horizon line)
      float shelf = smoothstep(-0.55, -0.18, p.y + t * 0.30)
                  * (1.0 - smoothstep(0.28, 0.55, p.y + t * 0.12));
      float broad    = fbm(sp * 1.0);
      float detail   = fbm(sp * 3.6 + 6.0);
      float cellular = ridge(fbm(sp * 1.9 + 24.0));
      float shape = mix(broad * 0.74 + detail * 0.26,
                        broad * 0.48 + detail * 0.22 + cellular * 0.38,
                        isCumulus);
      float thr = threshold + 0.06;
      float d   = smoothstep(thr, thr + 0.06, shape) * shelf * mFar;
      d = pow(d, 0.8) * mix(0.5, 1.0, coverage);

      vec3 lOff = vec3(lDir * 0.4 * vec2(xf, yf), 0.0);
      float direct = clamp(0.5 + (fbm3(sp) - fbm3(sp + lOff)) * 3.0, 0.0, 1.0) * dirStrength;
      float hShade = smoothstep(0.60, 1.05, broad + detail * 0.44);
      vec3 lit = mix(cloudShadow() * 0.9, cloudLight() * 0.85, clamp(hShade * 0.4 + direct * 0.6, 0.0, 1.0));
      // Aerial perspective: distant clouds fade toward the sky colour
      lit = mix(lit, skyColor(uv.y) * 1.06, 0.40);
      lit += vec3(0.70,0.78,1.0) * u_flash * smoothstep(0.2, 0.7, shape) * 0.5;
      float sA = d * 0.080 * (1.0 - a1);
      c1 += lit * sA; a1 += sA;
    }

    // ---- MID layer (10 steps) ----
    for (int i = 0; i < 10; i++) {
      float t  = float(i) / 9.0;
      float xf = 1.30, yf = mix(0.95, 1.40, isCumulus);
      float sL = mix(-0.68, -0.46, isCumulus);
      float sH = mix(-0.16,  0.08, isCumulus);
      float tF = mix( 0.82,  1.08, isCumulus);
      vec3 sp = vec3(
        p.x * xf + wt * 0.024 + t * 0.44,
        p.y * yf + wt * 0.007 - t * 0.11,
        t * 3.0 + u_time * 0.018 + 14.0
      );
      float shelf = smoothstep(sL, sH, p.y + t * 0.62)
                  * (1.0 - smoothstep(tF, tF + 0.22, p.y + t * 0.26));
      float broad    = fbm(sp * 1.12);
      float detail   = fbm(sp * 4.5 + 6.0);
      float curl     = ridge(fbm(sp * 7.0 + 19.0));
      float cellular = ridge(fbm(sp * 2.9 + 24.0));
      float shape = mix(broad * 0.74 + detail * 0.32 + curl * 0.14,
                        broad * 0.44 + detail * 0.28 + cellular * 0.44,
                        isCumulus);
      float d = smoothstep(threshold, threshold + 0.072, shape) * shelf * mMid;
      d = pow(d, 0.72) * mix(0.68, 1.28, coverage);

      vec3 lOff = vec3(lDir * 0.38 * vec2(xf, yf), 0.0);
      float direct = clamp(0.5 + (fbm3(sp * 1.12) - fbm3(sp * 1.12 + lOff)) * 3.2, 0.0, 1.0) * dirStrength;
      float hShade = smoothstep(0.68, 1.16, broad + detail * 0.5 + curl * 0.18);
      vec3 lit = mix(cloudShadow(), cloudLight(), clamp(hShade * 0.4 + direct * 0.72, 0.0, 1.05));
      // Silver lining on edges facing the light
      float rim = smoothstep(threshold, threshold + 0.09, shape)
                * (1.0 - smoothstep(threshold + 0.09, threshold + 0.26, shape));
      lit += hueL * rim * lightProx * dirStrength * 0.55;
      lit += vec3(0.70,0.78,1.0) * u_flash * smoothstep(0.2, 0.7, shape) * 0.7;
      float sA = d * 0.090 * (1.0 - a2);
      c2 += lit * sA; a2 += sA;
    }

    // ---- NEAR layer (12 steps) ----
    // Huge fluffy clouds sweeping fast across the foreground: lowest noise
    // frequency (large apparent size), ~12x the far layer's drift speed,
    // brightest sunlit tops and deepest shaded bases.
    for (int i = 0; i < 12; i++) {
      float t  = float(i) / 11.0;
      float xf = 0.55, yf = mix(0.72, 1.05, isCumulus);
      float sL = mix(-0.95, -0.72, isCumulus);
      float sH = mix(-0.30,  0.02, isCumulus);
      float tF = mix( 1.05,  1.30, isCumulus);
      vec3 sp = vec3(
        p.x * xf + wt * 0.075 + t * 0.50,
        p.y * yf + wt * 0.018 - t * 0.15,
        t * 3.6 + u_time * 0.030 + 28.0
      );
      float shelf = smoothstep(sL, sH, p.y + t * 0.68)
                  * (1.0 - smoothstep(tF, tF + 0.26, p.y + t * 0.30));
      float broad    = fbm(sp * 0.78);
      float detail   = fbm(sp * 3.4 + 6.0);
      float curl     = ridge(fbm(sp * 6.4 + 19.0));
      float cellular = ridge(fbm(sp * 2.4 + 24.0));
      float shape = mix(broad * 0.66 + detail * 0.26 + curl * 0.20 + cellular * 0.18,
                        broad * 0.36 + detail * 0.22 + cellular * 0.54 + curl * 0.22,
                        isCumulus);
      float thr = threshold - 0.06;
      float d   = smoothstep(thr, thr + 0.078, shape) * shelf * mNear;
      d = pow(d, 0.66) * mix(0.82, 1.52, coverage);

      vec3 lOff = vec3(lDir * 0.34 * vec2(xf, yf), 0.0);
      float direct = clamp(0.5 + (fbm3(sp * 0.78) - fbm3(sp * 0.78 + lOff)) * 3.6, 0.0, 1.1) * dirStrength;
      float hShade = smoothstep(0.66, 1.14, broad + detail * 0.48 + curl * 0.20);
      vec3 lit = mix(cloudShadow() * 1.05, cloudLight() * 1.18, clamp(hShade * 0.38 + direct * 0.8, 0.0, 1.1));
      float rim = smoothstep(thr, thr + 0.10, shape)
                * (1.0 - smoothstep(thr + 0.10, thr + 0.30, shape));
      lit += hueL * rim * lightProx * dirStrength * 0.72;
      lit += hueL * vec3(0.06, 0.04, 0.01) * dirStrength * (1.0 - smoothstep(0.8, 1.2, u_phase));
      lit += vec3(0.72,0.80,1.0) * u_flash * smoothstep(0.18, 0.65, shape) * 0.9;
      float sA = d * 0.098 * (1.0 - a3);
      c3 += lit * sA; a3 += sA;
    }

    // Composite far → mid → near (premultiplied "over")
    vec3  comp  = c1;
    float compA = a1;
    comp  = c2 + comp  * (1.0 - a2);
    compA = a2 + compA * (1.0 - a2);
    comp  = c3 + comp  * (1.0 - a3);
    compA = a3 + compA * (1.0 - a3);

    clouds = comp;
    alpha  = clamp(compA, 0.0, 1.0);

  } else {
    // ---- LAYERED-DECK MODE (stratus / nimbostratus / cumulonimbus / supercell) ----
    for (int i = 0; i < 28; i++) {
      float t = float(i) / 27.0;
      float verticalScale = 0.92;
      float shelfLow = -0.78, shelfHigh = -0.28, topFade = 0.86;
      if (u_style > 2.5 && u_style < 4.5) { verticalScale = 0.52; shelfLow = -0.96; shelfHigh = -0.56; topFade = 1.25; }
      if (u_style > 4.5)                   { verticalScale = 1.55; shelfLow = -0.88; shelfHigh = -0.12; topFade = 1.12; }

      vec3 sp = vec3(
        p.x * 1.15 + wt * 0.030 + t * 0.46,
        p.y * verticalScale + wt * 0.010 - t * 0.12,
        t * 3.0 + u_time * 0.015
      );
      float shelf = smoothstep(shelfLow, shelfHigh, p.y + t * 0.64)
                  * (1.0 - smoothstep(topFade, topFade + 0.22, p.y + t * 0.28));

      float broad    = fbm(sp * 1.45);
      float detail   = fbm(sp * 5.8 + 6.0);
      float curl     = ridge(fbm(sp * 9.2 + 19.0));
      float cellular = ridge(fbm(sp * 3.8 + 24.0));

      float shape = broad * 0.74 + detail * 0.32 + curl * 0.14;
      if (u_style > 2.5 && u_style < 3.5) shape = broad * 0.90 + detail * 0.14;
      if (u_style > 3.5) shape = broad * 0.72 + detail * 0.28 + curl * 0.34 + cellular * 0.18;

      float d = smoothstep(threshold, threshold + 0.075, shape) * shelf;
      // Below ~95% cover the deck opens real thin spots / gaps along the mask
      float gapsAllowed = smoothstep(1.0, 0.82, coverage);
      d *= mix(1.0, mix(0.18, 1.0, mMid), gapsAllowed);
      d = pow(d, 0.7) * mix(0.78, 1.45, coverage);

      vec3 lOff = vec3(lDir * 0.36 * vec2(1.15, verticalScale), 0.0);
      float direct = clamp(0.5 + (fbm3(sp * 1.45) - fbm3(sp * 1.45 + lOff)) * 3.0, 0.0, 1.0) * dirStrength;
      float hShade = smoothstep(0.68, 1.16, broad + detail * 0.5 + curl * 0.18);
      // Thin spots in a partial deck (coverage < 1) read brighter — light leaks through.
      float thin = (1.0 - smoothstep(threshold + 0.05, threshold + 0.35, shape))
                 * smoothstep(0.99, 0.85, coverage);
      vec3 lit = mix(cloudShadow(), cloudLight(), clamp(hShade * 0.42 + direct * 0.6 + thin * 0.35, 0.0, 1.0));
      // Storm decks churn: strong tonal variation so the base reads turbulent,
      // with ragged bright tears between the darkest cells. Rain decks get a
      // gentler version so nimbostratus isn't a featureless slab.
      if (u_style > 4.5)      lit *= 0.62 + 0.72 * hShade + 0.34 * curl;
      else if (u_style > 3.5) lit *= 0.78 + 0.38 * hShade + 0.18 * curl;
      lit += vec3(0.72,0.80,1.0) * u_flash * smoothstep(0.18, 0.62, shape) * (u_style > 4.5 ? 1.0 : 0.55);

      // Thick decks accumulate to near-full opacity; thin ones stay translucent.
      float sA = d * (0.082 + 0.045 * density) * (1.0 - alpha);
      clouds += lit * sA; alpha += sA;
    }

    // Bright smudge where the sun sits behind a translucent deck
    float deckGlow = lightProx * (1.0 - smoothstep(0.55, 0.95, density))
                   * alpha * clamp(1.6 - u_phase, 0.0, 1.0);
    clouds += hueL * deckGlow * 0.16;
  }

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
    const glContext = canvasEl?.getContext("webgl", { antialias: false, alpha: false, powerPreference: "low-power" });
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

    // The main framebuffer is deliberately capped at 1x device-pixel-ratio
    // (see resize()) to keep the cloud shader cheap — but that leaves text
    // soft on Retina screens. Rasterize the text mask at real device
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

    const startedAt = performance.now();

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

    function resize() {
      const dpr   = Math.min(window.devicePixelRatio || 1, 1.0);
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
        glReady = true;
      }

      // During an active lightning strike render every frame so the flash flickers
      // crisply; otherwise stay at the power-saving cadence.
      const p = propsRef.current;
      const flash = p.lightningIntensity > 0 ? getFlashEnvelope(Date.now(), p.lightningIntensity) : 0;
      if (flash < 0.01 && now - lastFrameTime < CLOUD_FRAME_MS) return;
      lastFrameTime = now;

      const d = new Date();
      const hourNow = p.hour ?? d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
      const coverageValue = getCoverageValue(p.coverage);
      // Default density follows coverage when not supplied (legacy callers)
      const densityValue = p.density ?? Math.min(1, 0.25 + coverageValue * 0.5);

      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(uRes,      canvas.width, canvas.height);
      gl.uniform1f(uTime,     (now - startedAt) / 1000);
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

      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    animationFrame = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      gl.deleteBuffer(buffer);
      gl.deleteTexture(textTexture);
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
