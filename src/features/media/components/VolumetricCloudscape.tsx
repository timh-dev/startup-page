import React, { useEffect, useRef, useState } from "react";

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
uniform float u_phase;      // 0=day, 1=sunset, 2=night, 3=storm
uniform float u_coverage;   // 0-1
uniform float u_style;      // 1=stratocumulus,2=cumulus,3=stratus,4=nimbostratus,5=cumulonimbus,6=supercell
uniform float u_hour;       // 0-24 wall-clock hour
uniform float u_fog;        // 0-1 fog intensity

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
float ridge(float x) { return 1.0 - abs(x * 2.0 - 1.0); }

// ---- sky & cloud colours ----
// Eight-stop piecewise sky aligned to real twilight bands.
// Phase bands (mirror of getTimePhase() civil/nautical/astronomical encoding):
//   0.00       midday
//   0.00→0.55  day
//   0.55→0.85  day → pre-golden (sky warms, colour saturation rises)
//   0.85→1.00  pre-golden → golden hour (amber horizon, indigo zenith)
//   1.00→1.18  golden → civil twilight peak / sunset (deep orange–purple)
//   1.18→1.45  sunset → civil (blue hour: Belt of Venus at horizon, cobalt above)
//   1.45→1.80  civil → nautical (deep navy, no orange, planets visible)
//   1.80→1.92  nautical → astronomical (near-black, faintest horizon glow)
//   1.92→2.00  astronomical → full night
// mix(horizon, zenith, tY): horizon at tY≈0.34, zenith at tY≈0.68
vec3 skyColor(float y) {
  float tY = mix(0.34, 0.68, y);

  // Supercell: sickly dark green-gray — override everything
  if (u_style > 5.5) return mix(vec3(0.025,0.030,0.022), vec3(0.06,0.08,0.06), tY);

  float p = clamp(u_phase, 0.0, 2.0);

  // Clear-sky colour stops (horizon_col, zenith_col)
  vec3 sDay   = mix(vec3(0.56,0.82,1.00), vec3(0.10,0.30,0.84), tY); // crisp azure
  vec3 sPreGo = mix(vec3(0.88,0.66,0.26), vec3(0.16,0.24,0.70), tY); // warming pre-golden
  vec3 sGold  = mix(vec3(1.00,0.60,0.08), vec3(0.18,0.12,0.52), tY); // amber horizon, indigo zenith
  vec3 sSunst = mix(vec3(0.98,0.32,0.06), vec3(0.28,0.06,0.42), tY); // deep orange, dark purple
  // Civil / blue hour — Belt of Venus (pink-mauve) at horizon, rich cobalt above
  vec3 sCivil = mix(vec3(0.51,0.51,0.98), vec3(0.04,0.04,0.22), tY); // periwinkle-mauve → deep indigo
  // Nautical — deep navy, no colour left at horizon
  vec3 sNaut  = mix(vec3(0.07,0.11,0.32), vec3(0.02,0.02,0.12), tY); // dark navy
  // Astronomical — near-black, only the faintest blue trace
  vec3 sAstro = mix(vec3(0.03,0.05,0.16), vec3(0.01,0.01,0.07), tY);
  vec3 sNight = mix(vec3(0.02,0.04,0.12), vec3(0.01,0.015,0.05), tY); // full dark

  // Overcast grey-shift (stratus=3, nimbostratus=4 → oc 0→1)
  float oc = clamp((u_style - 2.5) / 2.0, 0.0, 1.0);
  if (oc > 0.01) {
    sDay    = mix(sDay,    mix(vec3(0.42,0.50,0.64), vec3(0.20,0.26,0.42), tY), oc * 0.70);
    sPreGo  = mix(sPreGo,  mix(vec3(0.36,0.30,0.30), vec3(0.14,0.12,0.18), tY), oc * 0.68);
    sGold   = mix(sGold,   mix(vec3(0.36,0.28,0.24), vec3(0.14,0.10,0.16), tY), oc * 0.68);
    sSunst  = mix(sSunst,  mix(vec3(0.26,0.16,0.16), vec3(0.10,0.06,0.14), tY), oc * 0.68);
    sCivil  = mix(sCivil,  mix(vec3(0.14,0.16,0.32), vec3(0.04,0.04,0.14), tY), oc * 0.65);
    sNaut   = mix(sNaut,   mix(vec3(0.06,0.07,0.14), vec3(0.02,0.02,0.07), tY), oc * 0.55);
  }
  // Cumulonimbus bruised shift
  float cb = clamp((u_style - 4.5) / 1.0, 0.0, 1.0);
  if (cb > 0.01) {
    sDay   = mix(sDay,   mix(vec3(0.18,0.20,0.26), vec3(0.08,0.09,0.16), tY), cb * 0.72);
    sGold  = mix(sGold,  mix(vec3(0.22,0.14,0.14), vec3(0.08,0.05,0.10), tY), cb * 0.72);
    sSunst = mix(sSunst, mix(vec3(0.14,0.08,0.10), vec3(0.05,0.03,0.08), tY), cb * 0.72);
  }

  vec3 col = sDay;
  col = mix(col, sPreGo, smoothstep(0.55, 0.85, p)); // golden approach
  col = mix(col, sGold,  smoothstep(0.85, 1.00, p)); // golden hour
  col = mix(col, sSunst, smoothstep(1.00, 1.18, p)); // peak sunset
  col = mix(col, sCivil, smoothstep(1.18, 1.45, p)); // civil twilight / blue hour
  col = mix(col, sNaut,  smoothstep(1.45, 1.80, p)); // nautical twilight
  col = mix(col, sAstro, smoothstep(1.80, 1.92, p)); // astronomical twilight
  col = mix(col, sNight, smoothstep(1.92, 2.00, p)); // full night
  return col;
}

// Cloud highlight colour — top/sunlit faces
vec3 cloudLight() {
  if (u_style > 5.5) return vec3(0.34,0.38,0.34);
  if (u_style > 4.5) return vec3(0.44,0.46,0.50);
  if (u_style > 3.5) return vec3(0.54,0.58,0.66);
  float p = clamp(u_phase, 0.0, 2.0);
  vec3 col = vec3(1.00, 0.98, 0.92);                          // midday: warm white
  col = mix(col, vec3(1.00, 0.88, 0.58), smoothstep(0.55, 0.85, p)); // pre-golden: soft gold
  col = mix(col, vec3(1.00, 0.76, 0.32), smoothstep(0.85, 1.00, p)); // golden: deep amber tops
  col = mix(col, vec3(1.00, 0.48, 0.22), smoothstep(1.00, 1.18, p)); // sunset: fiery orange
  col = mix(col, vec3(0.52, 0.64, 0.96), smoothstep(1.18, 1.38, p)); // blue hour: cool lavender-blue
  col = mix(col, vec3(0.36, 0.44, 0.70), smoothstep(1.38, 1.65, p)); // nautical: steel blue
  col = mix(col, vec3(0.28, 0.32, 0.50), smoothstep(1.65, 2.00, p)); // night: muted
  return col;
}

// Cloud shadow colour — undersides / shaded faces
vec3 cloudShadow() {
  if (u_style > 5.5) return vec3(0.015,0.022,0.018);
  if (u_style > 4.5) return vec3(0.025,0.028,0.036);
  if (u_style > 3.5) return vec3(0.046,0.056,0.078);
  float p = clamp(u_phase, 0.0, 2.0);
  vec3 col = vec3(0.44, 0.56, 0.74);                          // midday: soft blue-gray
  col = mix(col, vec3(0.52, 0.30, 0.36), smoothstep(0.55, 0.85, p)); // pre-golden: rose shadow
  col = mix(col, vec3(0.50, 0.20, 0.32), smoothstep(0.85, 1.00, p)); // golden: deep rose-purple
  col = mix(col, vec3(0.36, 0.10, 0.22), smoothstep(1.00, 1.18, p)); // sunset: dark crimson
  col = mix(col, vec3(0.08, 0.12, 0.40), smoothstep(1.18, 1.38, p)); // blue hour: deep indigo
  col = mix(col, vec3(0.04, 0.06, 0.20), smoothstep(1.38, 1.65, p)); // nautical: dark navy
  col = mix(col, vec3(0.02, 0.04, 0.12), smoothstep(1.65, 2.00, p)); // night: near black
  return col;
}

// ---- celestial positions ----
// Sun tracks east->west based on clock hour; elevation follows sine arc
vec2 sunUV() {
  float t = clamp((u_hour - 5.5) / 13.0, 0.0, 1.0);
  float x = mix(0.04, 0.96, t);
  float elev = sin(3.14159265 * t);
  // Phase additionally pulls it down toward horizon
  float y = mix(0.08, 0.76, elev) * clamp(1.6 - u_phase, 0.0, 1.0) + 0.08 * clamp(u_phase - 0.0, 0.0, 1.0);
  return vec2(x, y);
}
// Moon drifts right->left during the night half of u_phase
vec2 moonUV() {
  float t = clamp((u_phase - 1.2) / 0.8, 0.0, 1.0);
  float x = mix(0.80, 0.20, t);
  float y = 0.13 + sin(3.14159265 * t) * 0.52;
  return vec2(x, y);
}

// ---- sun rendering ----
vec3 drawSun(vec2 uv, vec3 col, float coverage) {
  float vis = clamp(1.6 - u_phase, 0.0, 1.0);
  if (vis < 0.01 || u_style > 5.5) return col;
  vec2 sp = sunUV();
  float d  = length(uv - sp);
  vec3 hue = mix(vec3(1.0,0.97,0.86), vec3(1.0,0.58,0.22), smoothstep(0.0,1.0,u_phase));

  // Wide atmospheric corona
  float coR = mix(0.26, 0.44, smoothstep(0.0,1.0,u_phase));
  float corona = pow(max(0.0, 1.0 - d / coR), 2.4) * vis * (1.0 - coverage * 0.68);
  col += hue * corona * 0.52;

  // Inner glow
  float glow = pow(max(0.0, 1.0 - d / 0.09), 3.8) * vis * (1.0 - coverage * 0.82);
  col += hue * glow * 0.58;

  // Disc
  float disc = smoothstep(0.030, 0.020, d) * vis * (1.0 - coverage * 0.88);
  col = mix(col, hue * 1.5, disc);

  // Horizon scatter band near sunset/rise
  float nearHorizon = smoothstep(0.28, 1.0, u_phase);
  if (nearHorizon > 0.01) {
    float hg = exp(-abs(uv.y - 0.13) * 6.5) * exp(-abs(uv.x - sp.x) * 1.6);
    hg *= nearHorizon * (1.0 - coverage * 0.6) * 0.55;
    vec3 hCol = mix(vec3(1.0,0.72,0.28), vec3(0.88,0.30,0.48), smoothstep(0.28,1.0,u_phase));
    col += hCol * hg;
  }

  // Crepuscular / god rays fanning out through cloud gaps
  if (coverage > 0.08 && u_phase < 1.3) {
    float rayDir = atan(uv.y - sp.y, uv.x - sp.x);
    float rayDist = length(uv - sp);
    float rays = noise(vec3(rayDir * 3.2, u_time * 0.045, 0.5));
    rays *= exp(-rayDist * 3.8) * coverage * (1.3 - u_phase) * 0.16;
    col += hue * max(0.0, rays);
  }
  return col;
}

// ---- moon rendering ----
vec3 drawMoon(vec2 uv, vec3 col, float coverage) {
  float vis = smoothstep(1.35, 2.0, u_phase);
  if (vis < 0.01) return col;
  vec2 mp = moonUV();
  float d = length(uv - mp);
  float clr = 1.0 - coverage * 0.90;

  // Soft glow
  float glow = pow(max(0.0, 1.0 - d / 0.14), 2.6) * vis * clr;
  col += vec3(0.52,0.60,0.78) * glow * 0.30;

  // Lunar halo ring (thin, subtle)
  float halo = smoothstep(0.060, 0.050, d) * (1.0 - smoothstep(0.052, 0.065, d));
  col += vec3(0.56,0.64,0.80) * halo * vis * clr * 0.24;

  // Disc
  float disc = smoothstep(0.026, 0.017, d) * vis * clr;
  col = mix(col, vec3(0.88,0.92,0.97) * 1.12, disc);
  return col;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  vec2 p  = uv * 2.0 - 1.0;
  p.x *= u_resolution.x / max(u_resolution.y, 1.0);

  vec3 color = skyColor(uv.y);
  float coverage = clamp(u_coverage, 0.0, 1.0);

  color = drawSun(uv, color, coverage);
  color = drawMoon(uv, color, coverage);

  // ---- clouds ----
  float alpha  = 0.0;
  vec3  clouds = vec3(0.0);

  float threshold = mix(0.86, 0.48, coverage);
  if (u_style > 2.5 && u_style < 4.5) threshold -= 0.08;
  if (u_style > 4.5) threshold -= 0.16;
  if (u_phase > 1.5 && u_phase < 2.5) threshold -= 0.08;

  // Broken-cloud mode: stratocumulus(1) or cumulus(2) with visible coverage
  // Three fully independent depth layers — far, mid, near — composited in order.
  float brokenMode = step(u_style, 2.49) * step(0.05, coverage);
  float isCumulus  = step(1.51, u_style) * step(u_style, 2.49);

  if (brokenMode > 0.5) {
    float a1 = 0.0, a2 = 0.0, a3 = 0.0;
    vec3  c1 = vec3(0.0), c2 = vec3(0.0), c3 = vec3(0.0);

    // ---- FAR layer (12 steps) ----
    // Small-ish cloud blobs high in sky, slow left drift, cool atmospheric tint
    for (int i = 0; i < 12; i++) {
      float t  = float(i) / 11.0;
      // Cumulus: taller shelf so towers poke up; stratocumulus: flatter band
      float sL = mix(-0.52, -0.36, isCumulus);
      float sH = mix(-0.04,  0.16, isCumulus);
      float tF = mix( 0.70,  0.96, isCumulus);
      float vS = mix( 0.86,  1.28, isCumulus);
      vec3 sp = vec3(
        p.x * 1.72 + u_time * 0.009 + t * 0.34,
        p.y * vS   + u_time * 0.003 - t * 0.07,
        t * 2.4 + u_time * 0.011 + 0.0
      );
      float shelf = smoothstep(sL, sH, p.y + t * 0.54)
                  * (1.0 - smoothstep(tF, tF + 0.18, p.y + t * 0.22));
      float broad    = fbm(sp * 1.90);
      float detail   = fbm(sp * 7.2 + 6.0);
      float cellular = ridge(fbm(sp * 3.6 + 24.0));
      // Stratocumulus: smooth sheets; cumulus: more cellular (puffy tops)
      float shape = mix(broad * 0.74 + detail * 0.26,
                        broad * 0.44 + detail * 0.24 + cellular * 0.42,
                        isCumulus);
      float thr = threshold + 0.05;
      float d   = smoothstep(thr, thr + 0.062, shape) * shelf;
      d = pow(d, 0.78) * mix(0.55, 1.05, coverage);
      if (coverage < 0.01) d = 0.0;
      float shade = smoothstep(0.30, 0.78, broad + detail * 0.44);
      // Cool blue-gray tint: atmospheric perspective makes distant clouds desaturate
      vec3 lit = mix(cloudShadow() * 0.86, cloudLight() * 0.88, shade);
      lit += vec3(0.002, 0.006, 0.020) * (1.0 - step(2.5, u_phase));
      lit += vec3(0.030, 0.026, 0.022) * (1.0 - step(2.5, u_phase));
      float sA = d * 0.084 * (1.0 - a1);
      c1 += lit * sA; a1 += sA;
    }

    // ---- MID layer (10 steps) ----
    // Medium blobs in mid-sky, moderate speed, standard neutral lighting
    for (int i = 0; i < 10; i++) {
      float t  = float(i) / 9.0;
      float sL = mix(-0.68, -0.46, isCumulus);
      float sH = mix(-0.16,  0.08, isCumulus);
      float tF = mix( 0.82,  1.08, isCumulus);
      float vS = mix( 0.92,  1.38, isCumulus);
      vec3 sp = vec3(
        p.x * 1.26 + u_time * 0.026 + t * 0.44,
        p.y * vS   + u_time * 0.008 - t * 0.11,
        t * 3.0 + u_time * 0.022 + 14.0
      );
      float shelf = smoothstep(sL, sH, p.y + t * 0.62)
                  * (1.0 - smoothstep(tF, tF + 0.22, p.y + t * 0.26));
      float broad    = fbm(sp * 1.45);
      float detail   = fbm(sp * 5.8 + 6.0);
      float curl     = ridge(fbm(sp * 9.2 + 19.0));
      float cellular = ridge(fbm(sp * 3.8 + 24.0));
      float shape = mix(broad * 0.74 + detail * 0.32 + curl * 0.14,
                        broad * 0.42 + detail * 0.30 + cellular * 0.46,
                        isCumulus);
      float thr = threshold;
      float d   = smoothstep(thr, thr + 0.074, shape) * shelf;
      d = pow(d, 0.70) * mix(0.72, 1.32, coverage);
      if (coverage < 0.01) d = 0.0;
      float shade = smoothstep(0.28, 0.78, broad + detail * 0.5 + curl * 0.18);
      vec3 lit = mix(cloudShadow(), cloudLight(), shade);
      lit += vec3(0.044, 0.040, 0.034) * (1.0 - step(2.5, u_phase));
      float sA = d * 0.092 * (1.0 - a2);
      c2 += lit * sA; a2 += sA;
    }

    // ---- NEAR layer (10 steps) ----
    // Large blobby clouds low-mid sky, fast drift, warm bright tops, deep shadows
    for (int i = 0; i < 10; i++) {
      float t  = float(i) / 9.0;
      float sL = mix(-0.90, -0.66, isCumulus);
      float sH = mix(-0.38, -0.04, isCumulus);
      float tF = mix( 0.90,  1.22, isCumulus);
      float vS = mix( 0.98,  1.50, isCumulus);
      vec3 sp = vec3(
        p.x * 0.80 + u_time * 0.056 + t * 0.52,
        p.y * vS   + u_time * 0.016 - t * 0.15,
        t * 3.6 + u_time * 0.038 + 28.0
      );
      float shelf = smoothstep(sL, sH, p.y + t * 0.68)
                  * (1.0 - smoothstep(tF, tF + 0.24, p.y + t * 0.30));
      float broad    = fbm(sp * 0.88);   // low frequency = large blobs
      float detail   = fbm(sp * 4.0 + 6.0);
      float curl     = ridge(fbm(sp * 7.6 + 19.0));
      float cellular = ridge(fbm(sp * 3.2 + 24.0));
      // Lumpy/puffier silhouette on the near layer
      float shape = mix(broad * 0.68 + detail * 0.26 + curl * 0.20 + cellular * 0.16,
                        broad * 0.34 + detail * 0.22 + cellular * 0.56 + curl * 0.22,
                        isCumulus);
      float thr = threshold - 0.07;
      float d   = smoothstep(thr, thr + 0.080, shape) * shelf;
      d = pow(d, 0.64) * mix(0.88, 1.56, coverage);
      if (coverage < 0.01) d = 0.0;
      float shade = smoothstep(0.26, 0.76, broad + detail * 0.48 + curl * 0.20);
      // Bright warm tops, deeper undershadow — closest layer catches most direct light
      vec3 lit = mix(cloudShadow() * 1.08, cloudLight() * 1.20, shade);
      lit += vec3(0.058, 0.050, 0.040) * (1.0 - step(2.5, u_phase));
      lit += vec3(0.030, 0.018, 0.004) * (1.0 - step(1.0, u_phase)); // warm sun tint
      float sA = d * 0.100 * (1.0 - a3);
      c3 += lit * sA; a3 += sA;
    }

    // Composite far → mid → near (premultiplied "over" operator)
    // Near is topmost; its alpha occludes mid+far beneath it.
    vec3  comp  = c1;
    float compA = a1;
    comp  = c2 + comp  * (1.0 - a2);
    compA = a2 + compA * (1.0 - a2);
    comp  = c3 + comp  * (1.0 - a3);
    compA = a3 + compA * (1.0 - a3);

    clouds = comp;
    alpha  = clamp(compA, 0.0, 1.0);

  } else {
    // ---- STANDARD CLOUD MODE (stratus / nimbostratus / cumulonimbus / supercell) ----
    for (int i = 0; i < 32; i++) {
      float t = float(i) / 31.0;
      float verticalScale = 0.92;
      float shelfLow = -0.78, shelfHigh = -0.28, topFade = 0.86;
      if (u_style > 2.5 && u_style < 4.5) { verticalScale = 0.52; shelfLow = -0.96; shelfHigh = -0.56; topFade = 0.58; }
      if (u_style > 4.5)                   { verticalScale = 1.55; shelfLow = -0.88; shelfHigh = -0.12; topFade = 1.12; }

      vec3 sp = vec3(
        p.x * 1.15 + u_time * 0.035 + t * 0.46,
        p.y * verticalScale + u_time * 0.012 - t * 0.12,
        t * 3.0 + u_time * 0.018
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
      d = pow(d, 0.7) * mix(0.78, 1.42, coverage);
      if (coverage < 0.01) d = 0.0;

      float shade = smoothstep(0.28, 0.78, broad + detail * 0.5 + curl * 0.18);
      vec3 lit = mix(cloudShadow(), cloudLight(), shade);
      lit += vec3(0.045, 0.040, 0.035) * (1.0 - step(2.5, u_phase));

      float sA = d * 0.095 * (1.0 - alpha);
      clouds += lit * sA; alpha += sA;
    }
  }

  // ---- fog ground bands ----
  if (u_fog > 0.01) {
    vec3 fogCol = mix(
      mix(vec3(0.82, 0.85, 0.90), vec3(0.26, 0.30, 0.40), smoothstep(0.0, 2.0, u_phase)),
      vec3(0.90, 0.93, 0.96), uv.y * 0.6
    );
    float b1 = smoothstep(0.42, 0.00, uv.y)
             * (0.5 + 0.5 * noise(vec3(uv.x * 2.2 + u_time * 0.020, uv.y * 3.5, u_time * 0.012)));
    float b2 = smoothstep(0.24, 0.00, uv.y)
             * (0.4 + 0.6 * noise(vec3(uv.x * 3.6 - u_time * 0.016, uv.y * 5.5, u_time * 0.010 + 4.0)));
    float b3 = smoothstep(0.13, 0.00, uv.y)
             * (0.6 + 0.4 * noise(vec3(uv.x * 5.0 + u_time * 0.025, uv.y * 8.0, u_time * 0.018 + 8.0)));
    float upper = smoothstep(0.82, 0.50, uv.y) * u_fog * 0.38
                * (0.5 + 0.5 * noise(vec3(uv.x * 1.6 - u_time * 0.010, uv.y * 1.8, u_time * 0.007)));
    float fd = clamp(b1 * 0.42 + b2 * 0.52 + b3 * 0.72, 0.0, 1.0) * u_fog;
    color = mix(color, fogCol, fd + upper);
    // let cloud layer show faintly through fog
    color = color * (1.0 - alpha * 0.55) + clouds * 0.55;
  } else {
    float haze = 0.018 + smoothstep(0.55, 1.0, uv.y) * 0.012;
    color = mix(color, cloudLight(), haze * coverage);
    color = color * (1.0 - alpha) + clouds;
  }

  // top-sky darkening + overall tints
  float topEq = smoothstep(0.76, 1.0, uv.y) * (1.0 - step(2.5, u_phase));
  color = mix(color, color * 0.80, topEq);
  color += vec3(0.055, 0.052, 0.048) * coverage * (1.0 - step(2.5, u_phase));
  if (u_style > 4.5) color = mix(color, vec3(0.06,0.075,0.07), 0.26);
  color = mix(color, vec3(0.02,0.025,0.035), smoothstep(0.0, 0.22, 1.0 - uv.y) * 0.22);

  gl_FragColor = vec4(color, 1.0);
}
`;

function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(message || "Shader compile failed");
  }
  return shader;
}

function createProgram(gl) {
  const vertex   = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragment = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  const program  = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(message || "Shader link failed");
  }
  return program;
}

function getPhaseValue(phase) {
  if (typeof phase === "number") return phase;
  if (phase === "storm") return 3;
  if (phase === "night") return 2;
  if (phase === "sunset") return 1;
  return 0;
}

function getCoverageValue(coverage) {
  if (coverage === "storm") return 0.72;
  if (coverage === "full")  return 0.62;
  if (coverage === "partly") return 0.24;
  return 0;
}

function getStyleValue(cloudStyle) {
  if (cloudStyle === "cumulus")       return 2;
  if (cloudStyle === "stratus")       return 3;
  if (cloudStyle === "nimbostratus")  return 4;
  if (cloudStyle === "cumulonimbus")  return 5;
  if (cloudStyle === "supercell")     return 6;
  return 1;
}

interface VolumetricCloudscapeProps {
  coverage?: "none" | "partly" | "full" | "storm";
  phase?: number | "storm";
  cloudStyle?: string;
  fogIntensity?: number;
}

export default function VolumetricCloudscape({
  coverage    = "full",
  phase       = "day" as any,
  cloudStyle  = "stratocumulus",
  fogIntensity = 0,
}: VolumetricCloudscapeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    const gl = canvas?.getContext("webgl", { antialias: false, alpha: false, powerPreference: "low-power" });
    if (!canvas || !gl) { setSupported(false); return undefined; }

    let animationFrame = 0;
    let program: WebGLProgram;
    try { program = createProgram(gl); }
    catch { setSupported(false); return undefined; }

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);

    const position  = gl.getAttribLocation(program, "a_position");
    const uRes      = gl.getUniformLocation(program, "u_resolution");
    const uTime     = gl.getUniformLocation(program, "u_time");
    const uPhase    = gl.getUniformLocation(program, "u_phase");
    const uCoverage = gl.getUniformLocation(program, "u_coverage");
    const uStyle    = gl.getUniformLocation(program, "u_style");
    const uHour     = gl.getUniformLocation(program, "u_hour");
    const uFog      = gl.getUniformLocation(program, "u_fog");
    const startedAt = performance.now();

    function resize() {
      const dpr   = Math.min(window.devicePixelRatio || 1, 2.5);
      const width  = Math.max(1, Math.floor(canvas.clientWidth  * dpr));
      const height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width  = width;
        canvas.height = height;
      }
      gl.viewport(0, 0, width, height);
    }

    function render(now: number) {
      resize();
      const d = new Date();
      const hour = d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;

      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(uRes,      canvas.width, canvas.height);
      gl.uniform1f(uTime,     (now - startedAt) / 1000);
      gl.uniform1f(uPhase,    getPhaseValue(coverage === "storm" ? "storm" : phase));
      gl.uniform1f(uCoverage, getCoverageValue(coverage));
      gl.uniform1f(uStyle,    getStyleValue(cloudStyle));
      gl.uniform1f(uHour,     hour);
      gl.uniform1f(uFog,      fogIntensity);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      animationFrame = requestAnimationFrame(render);
    }

    animationFrame = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(animationFrame);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    };
  }, [coverage, phase, cloudStyle, fogIntensity]);

  if (!supported) {
    const phaseValue = getPhaseValue(phase);
    const skyPhase = coverage === "storm" ? "storm" : phaseValue >= 1.5 ? "night" : phaseValue >= 0.5 ? "sunset" : "day";
    return (
      <div className={`weather-sky weather-sky-${skyPhase} weather-cloud-coverage-${coverage} absolute inset-0 overflow-hidden pointer-events-none`}>
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
