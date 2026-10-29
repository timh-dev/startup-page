// Physically based atmosphere for the solar chart: single scattering
// (Rayleigh + Mie + ozone) raymarched per pixel in WebGL, after Maxime
// Heckel's "On Rendering the Sky, Sunsets, and Planets" and Sébastien
// Hillaire's model. Earth constants are the standard ones from Hillaire
// (2020) and Bruneton (2017).
//
// The view is from orbit: the chart's horizon line is the planet's limb,
// space is black above it, and the atmosphere is the thin glowing band
// along the limb. By day the band is blue; at sunrise and sunset it burns
// orange and red into violet; at night it fades out, the lit upper
// atmosphere lingering through twilight. Seen from orbit the atmosphere is
// only a couple of degrees thick, so the vertical scale is stretched to
// make the band readable.
//
// The atmosphere only changes when the sun moves, so it is rendered on
// demand (when the time, hover position or size changes), not every frame.

const VERTEX = `
attribute vec2 a_position;
void main() { gl_Position = vec4(a_position, 0.0, 1.0); }
`;

const FRAGMENT = `
precision highp float;

uniform vec2 u_resolution;    // canvas pixels
uniform float u_horizon;      // the limb, canvas pixels from the top
uniform vec2 u_sunPx;         // where the sun is drawn, canvas pixels
uniform float u_radPerPxX;    // view angle per canvas pixel, across
uniform float u_radPerPxY;    // view angle per canvas pixel, up (stretched)
uniform float u_sunElevation; // the sun's real elevation, radians
uniform float u_exposure;
uniform float u_aerosol;      // Mie density scale: hazier evenings, clearer mornings
uniform float u_ozone;        // ozone scale: deeper purples at dusk

const float PI = 3.14159265;
const float R_GROUND = 6360.0;     // km
const float R_TOP = 6460.0;        // km (Karman line)
const float CAMERA_HEIGHT = 400.0; // km, about the ISS

const vec3 RAYLEIGH_BETA = vec3(5.802, 13.558, 33.1) * 1e-3; // per km
const float RAYLEIGH_H = 8.0;
const vec3 MIE_SCATTER = vec3(3.996e-3);
const vec3 MIE_EXTINCT = vec3(4.40e-3);
const float MIE_H = 1.2;
const float MIE_G = 0.8;
const vec3 OZONE_ABSORB = vec3(0.650, 1.881, 0.085) * 1e-3;
const float OZONE_CENTER = 25.0;
const float OZONE_HALF_WIDTH = 15.0;
const float SUN_INTENSITY = 20.0;

const int VIEW_STEPS = 40;
const int LIGHT_STEPS = 6;

// Where the ray enters and leaves a sphere (x < y); y < 0 when it misses.
vec2 sphereHits(vec3 origin, vec3 dir, float radius) {
  float b = dot(origin, dir);
  float c = dot(origin, origin) - radius * radius;
  float d = b * b - c;
  if (d < 0.0) return vec2(0.0, -1.0);
  float q = sqrt(d);
  return vec2(-b - q, -b + q);
}

vec3 densities(float height) {
  float rayleigh = exp(-height / RAYLEIGH_H);
  float mie = exp(-height / MIE_H) * u_aerosol;
  float ozone = max(0.0, 1.0 - abs(height - OZONE_CENTER) / OZONE_HALF_WIDTH) * u_ozone;
  return vec3(rayleigh, mie, ozone);
}

vec3 extinction(vec3 density) {
  return RAYLEIGH_BETA * density.x + MIE_EXTINCT * density.y + OZONE_ABSORB * density.z;
}

float rayleighPhase(float mu) {
  return 3.0 / (16.0 * PI) * (1.0 + mu * mu);
}

// Cornette-Shanks, as in the article.
float miePhase(float mu) {
  float gg = MIE_G * MIE_G;
  float num = 3.0 * (1.0 - gg) * (1.0 + mu * mu);
  float den = 8.0 * PI * (2.0 + gg) * pow(max(1.0 + gg - 2.0 * MIE_G * mu, 1e-4), 1.5);
  return num / den;
}

// Transmittance from a point toward the sun; zero in the planet's shadow.
vec3 sunTransmittance(vec3 point, vec3 sunDir) {
  vec2 ground = sphereHits(point, sunDir, R_GROUND);
  if (ground.y > 0.0 && ground.x > 0.0) return vec3(0.0);
  float rayLength = sphereHits(point, sunDir, R_TOP).y;
  vec3 depth = vec3(0.0);
  float previous = 0.0;
  for (int i = 1; i <= LIGHT_STEPS; i++) {
    // Quadratic spacing: short steps low in the atmosphere where it's dense.
    float u = float(i) / float(LIGHT_STEPS);
    float t = rayLength * u * u;
    float dt = t - previous;
    vec3 pos = point + sunDir * (t - dt * 0.5);
    depth += extinction(densities(max(0.0, sqrt(dot(pos, pos)) - R_GROUND))) * dt;
    previous = t;
  }
  return exp(-depth);
}

// Light scattered toward the camera along a ray through the atmosphere.
// Lighting uses the sun's real direction; the phase functions use where
// the sun is drawn, so the glow centres on the disc.
vec3 atmosphere(vec3 origin, vec3 dir, vec3 sunDir, vec3 sunView) {
  vec2 hits = sphereHits(origin, dir, R_TOP);
  if (hits.y < 0.0) return vec3(0.0);
  float start = max(hits.x, 0.0);
  float end = hits.y;
  vec2 ground = sphereHits(origin, dir, R_GROUND);
  if (ground.y > 0.0) end = min(end, ground.x);

  float mu = dot(dir, sunView);
  float phaseR = rayleighPhase(mu);
  float phaseM = miePhase(mu);
  float dt = (end - start) / float(VIEW_STEPS);

  vec3 radiance = vec3(0.0);
  vec3 transmittance = vec3(1.0);
  for (int i = 0; i < VIEW_STEPS; i++) {
    vec3 pos = origin + dir * (start + (float(i) + 0.5) * dt);
    vec3 density = densities(max(0.0, sqrt(dot(pos, pos)) - R_GROUND));
    vec3 ext = max(extinction(density), vec3(1e-7));
    vec3 stepTransmittance = exp(-ext * dt);
    vec3 scattering = RAYLEIGH_BETA * density.x * phaseR + MIE_SCATTER * density.y * phaseM;
    // Energy-conserving integration over the step (Hillaire 2015).
    vec3 inScatter = scattering * sunTransmittance(pos, sunDir);
    radiance += transmittance * (inScatter - inScatter * stepTransmittance) / ext;
    transmittance *= stepTransmittance;
  }
  return radiance * SUN_INTENSITY;
}

vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

// View direction for a canvas pixel: the limb on the horizon line, and the
// chart's x centred on the sun's azimuth.
vec3 viewDir(vec2 px, float dip) {
  float elevation = (u_horizon - px.y) * u_radPerPxY - dip;
  float azimuth = (px.x - u_sunPx.x) * u_radPerPxX;
  return vec3(cos(elevation) * sin(azimuth), sin(elevation), cos(elevation) * cos(azimuth));
}

void main() {
  // Canvas coordinates with y down, matching the 2D chart.
  vec2 px = vec2(gl_FragCoord.x, u_resolution.y - gl_FragCoord.y);
  vec3 origin = vec3(0.0, R_GROUND + CAMERA_HEIGHT, 0.0);
  // The limb sits this far below the camera's horizontal.
  float dip = acos(R_GROUND / (R_GROUND + CAMERA_HEIGHT));

  // The sun's real elevation, measured at the point on the limb toward the
  // sun, so a noon sun lights the band like noon.
  vec3 limb = vec3(0.0, -sin(dip), cos(dip));
  vec3 up = normalize(origin + limb * sqrt(dot(origin, origin) - R_GROUND * R_GROUND));
  vec3 sunDir = normalize(cos(u_sunElevation) * limb + sin(u_sunElevation) * up);
  vec3 sunView = viewDir(u_sunPx, dip);

  // Space above, the planet's night side below: both near black.
  vec3 color = vec3(0.0004, 0.0005, 0.0012);
  if (px.y <= u_horizon) {
    color += aces(atmosphere(origin, viewDir(px, dip), sunDir, sunView) * u_exposure);
  }

  color = pow(color, vec3(1.0 / 2.2));
  // Dither by half a step to break up banding in the smooth gradients.
  float noise = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  color += (noise - 0.5) / 255.0;
  gl_FragColor = vec4(color, 1.0);
}
`;

export interface SkyView {
  /** Canvas size in CSS pixels. */
  width: number;
  height: number;
  /** Canvas pixels per CSS pixel. */
  scale: number;
  horizonY: number;
  sunX: number;
  sunY: number;
  /** Degrees of view per CSS pixel across the chart. */
  degPerPx: number;
  /** Sun elevation in degrees (negative below the horizon). */
  sunElevation: number;
  /** After solar noon. */
  evening: boolean;
}

export interface PhysicalSky {
  render(view: SkyView): void;
  dispose(): void;
}

// Vertical stretch: the atmosphere is ~2.5° thick seen from orbit, so one
// degree up spans this many CSS pixels, putting the band's glow across the
// lower part of the chart.
const PX_PER_DEGREE_UP = 34;

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Sky shader failed to compile: ${log}`);
  }
  return shader;
}

/**
 * Exposure rises as the sun sets, like an eye adjusting to twilight. Single
 * scattering also underestimates twilight (it leaves out light scattered
 * more than once), which the extra exposure makes up for. By day it stays
 * low: from orbit the limb is seen through a long path of sunlit air, and
 * more exposure washes the band out to white.
 */
function exposureFor(elevation: number) {
  const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
  const day = clamp01((elevation - 3) / 12); // 0 at +3°, 1 at +15°
  const twilight = clamp01((3 - elevation) / 13); // 0 at +3°, 1 at -10°
  return 0.85 - day * 0.6 + twilight * twilight * 40;
}

/** Returns null when WebGL isn't available; the 2D sky is used instead. */
export function createPhysicalSky(canvas: HTMLCanvasElement): PhysicalSky | null {
  const gl = canvas.getContext("webgl", { alpha: false, antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: true });
  if (!gl) return null;

  let program: WebGLProgram;
  try {
    program = gl.createProgram()!;
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  } catch (error) {
    console.warn("[solar chart] physical sky unavailable", error);
    return null;
  }

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, "a_position");
  const uniform = (name: string) => gl.getUniformLocation(program, name);
  const u = {
    resolution: uniform("u_resolution"),
    horizon: uniform("u_horizon"),
    sunPx: uniform("u_sunPx"),
    radPerPxX: uniform("u_radPerPxX"),
    radPerPxY: uniform("u_radPerPxY"),
    sunElevation: uniform("u_sunElevation"),
    exposure: uniform("u_exposure"),
    aerosol: uniform("u_aerosol"),
    ozone: uniform("u_ozone"),
  };

  return {
    render(view) {
      const width = Math.max(1, Math.round(view.width * view.scale));
      const height = Math.max(1, Math.round(view.height * view.scale));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      const toRad = Math.PI / 180;
      gl.viewport(0, 0, width, height);
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(u.resolution, width, height);
      gl.uniform1f(u.horizon, view.horizonY * view.scale);
      gl.uniform2f(u.sunPx, view.sunX * view.scale, view.sunY * view.scale);
      gl.uniform1f(u.radPerPxX, (view.degPerPx * toRad) / view.scale);
      gl.uniform1f(u.radPerPxY, toRad / PX_PER_DEGREE_UP / view.scale);
      gl.uniform1f(u.sunElevation, view.sunElevation * toRad);
      gl.uniform1f(u.exposure, exposureFor(view.sunElevation));
      // Evenings carry more dust and haze than mornings, which is why
      // sunsets run redder and more vivid; mornings stay clean and golden.
      gl.uniform1f(u.aerosol, view.evening ? 2.6 : 0.9);
      gl.uniform1f(u.ozone, view.evening ? 1.6 : 1.0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    },
    dispose() {
      // The context itself is kept: React's StrictMode remounts on the same
      // canvas, and a lost context can't be recreated there.
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    },
  };
}
