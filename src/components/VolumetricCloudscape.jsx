import React, { useEffect, useRef, useState } from "react";

const VERTEX_SHADER = `
attribute vec2 a_position;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_phase;
uniform float u_coverage;

float hash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);

  return mix(
    mix(
      mix(hash(i + vec3(0.0, 0.0, 0.0)), hash(i + vec3(1.0, 0.0, 0.0)), f.x),
      mix(hash(i + vec3(0.0, 1.0, 0.0)), hash(i + vec3(1.0, 1.0, 0.0)), f.x),
      f.y
    ),
    mix(
      mix(hash(i + vec3(0.0, 0.0, 1.0)), hash(i + vec3(1.0, 0.0, 1.0)), f.x),
      mix(hash(i + vec3(0.0, 1.0, 1.0)), hash(i + vec3(1.0, 1.0, 1.0)), f.x),
      f.y
    ),
    f.z
  );
}

float fbm(vec3 p) {
  float value = 0.0;
  float amp = 0.55;
  mat3 m = mat3(
    1.6, 0.2, 0.0,
    -0.2, 1.5, 0.1,
    0.1, -0.1, 1.7
  );

  for (int i = 0; i < 5; i++) {
    value += amp * noise(p);
    p = m * p + vec3(11.7, 3.4, 7.1);
    amp *= 0.52;
  }

  return value;
}

float ridge(float x) {
  return 1.0 - abs(x * 2.0 - 1.0);
}

vec3 skyColor(float y) {
  float toneY = mix(0.34, 0.68, y);
  if (u_phase > 2.5) return mix(vec3(0.02, 0.025, 0.04), vec3(0.15, 0.16, 0.22), toneY);

  vec3 day = mix(vec3(0.29, 0.62, 0.93), vec3(0.67, 0.86, 1.0), toneY);
  vec3 sunset = mix(vec3(0.77, 0.35, 0.38), vec3(0.32, 0.27, 0.55), toneY);
  vec3 night = mix(vec3(0.02, 0.04, 0.08), vec3(0.08, 0.11, 0.18), toneY);
  float toSunset = smoothstep(0.0, 1.0, clamp(u_phase, 0.0, 1.0));
  float toNight = smoothstep(1.0, 2.0, clamp(u_phase, 1.0, 2.0));
  return mix(mix(day, sunset, toSunset), night, toNight);
}

vec3 cloudLightColor() {
  if (u_phase > 2.5) return vec3(0.30, 0.32, 0.38);
  vec3 day = vec3(1.0, 0.98, 0.92);
  vec3 sunset = vec3(1.0, 0.68, 0.72);
  vec3 night = vec3(0.72, 0.78, 0.9);
  float toSunset = smoothstep(0.0, 1.0, clamp(u_phase, 0.0, 1.0));
  float toNight = smoothstep(1.0, 2.0, clamp(u_phase, 1.0, 2.0));
  return mix(mix(day, sunset, toSunset), night, toNight);
}

vec3 cloudShadowColor() {
  if (u_phase > 2.5) return vec3(0.035, 0.045, 0.07);
  vec3 day = vec3(0.48, 0.58, 0.72);
  vec3 sunset = vec3(0.43, 0.26, 0.42);
  vec3 night = vec3(0.16, 0.2, 0.32);
  float toSunset = smoothstep(0.0, 1.0, clamp(u_phase, 0.0, 1.0));
  float toNight = smoothstep(1.0, 2.0, clamp(u_phase, 1.0, 2.0));
  return mix(mix(day, sunset, toSunset), night, toNight);
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  vec2 p = uv * 2.0 - 1.0;
  p.x *= u_resolution.x / max(u_resolution.y, 1.0);

  vec3 color = skyColor(uv.y);
  float alpha = 0.0;
  vec3 clouds = vec3(0.0);
  vec2 wind = vec2(u_time * 0.035, u_time * 0.012);
  float coverage = clamp(u_coverage, 0.0, 1.0);
  float threshold = mix(0.86, 0.48, coverage);
  if (u_phase > 1.5 && u_phase < 2.5) {
    threshold -= 0.08;
  }

  for (int i = 0; i < 32; i++) {
    float t = float(i) / 31.0;
    vec3 samplePoint = vec3(
      p.x * 1.15 + wind.x + t * 0.46,
      p.y * 0.92 + wind.y - t * 0.12,
      t * 3.0 + u_time * 0.018
    );

    float shelf = smoothstep(-0.78, -0.28, p.y + t * 0.64) * (1.0 - smoothstep(0.86, 1.08, p.y + t * 0.28));
    float broad = fbm(samplePoint * 1.45);
    float detail = fbm(samplePoint * 5.8 + 6.0);
    float curl = ridge(fbm(samplePoint * 9.2 + 19.0));
    float cloudShape = broad * 0.74 + detail * 0.32 + curl * 0.14;
    float density = smoothstep(threshold, threshold + 0.075, cloudShape) * shelf;
    density = pow(density, 0.7) * mix(0.78, 1.42, coverage);
    if (coverage < 0.01) {
      density = 0.0;
    }

    float shade = smoothstep(0.28, 0.78, broad + detail * 0.5 + curl * 0.18);
    vec3 lit = mix(cloudShadowColor(), cloudLightColor(), shade);
    lit += vec3(0.045, 0.04, 0.035) * (1.0 - step(2.5, u_phase));

    float stepAlpha = density * 0.095 * (1.0 - alpha);
    clouds += lit * stepAlpha;
    alpha += stepAlpha;
  }

  float haze = 0.018 + smoothstep(0.55, 1.0, uv.y) * 0.012;
  color = mix(color, cloudLightColor(), haze * coverage);
  color = color * (1.0 - alpha) + clouds;
  float topEqualizer = smoothstep(0.76, 1.0, uv.y) * (1.0 - step(2.5, u_phase));
  color = mix(color, color * 0.80, topEqualizer);
  color += vec3(0.055, 0.052, 0.048) * coverage * (1.0 - step(2.5, u_phase));
  color = mix(color, vec3(0.02, 0.025, 0.035), smoothstep(0.0, 0.22, 1.0 - uv.y) * 0.22);

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
  const vertex = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragment = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  const program = gl.createProgram();
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
  if (coverage === "full") return 0.62;
  if (coverage === "partly") return 0.24;
  return 0;
}

export default function VolumetricCloudscape({ coverage = "full", phase = "day" }) {
  const canvasRef = useRef(null);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    const gl = canvas?.getContext("webgl", { antialias: false, alpha: false, powerPreference: "low-power" });

    if (!canvas || !gl) {
      setSupported(false);
      return undefined;
    }

    let animationFrame = 0;
    let program;

    try {
      program = createProgram(gl);
    } catch {
      setSupported(false);
      return undefined;
    }

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);

    const position = gl.getAttribLocation(program, "a_position");
    const resolution = gl.getUniformLocation(program, "u_resolution");
    const time = gl.getUniformLocation(program, "u_time");
    const phaseUniform = gl.getUniformLocation(program, "u_phase");
    const coverageUniform = gl.getUniformLocation(program, "u_coverage");
    const startedAt = performance.now();

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      const width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      const height = Math.max(1, Math.floor(canvas.clientHeight * dpr));

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      gl.viewport(0, 0, width, height);
    }

    function render(now) {
      resize();
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(resolution, canvas.width, canvas.height);
      gl.uniform1f(time, (now - startedAt) / 1000);
      gl.uniform1f(phaseUniform, getPhaseValue(coverage === "storm" ? "storm" : phase));
      gl.uniform1f(coverageUniform, getCoverageValue(coverage));
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      animationFrame = requestAnimationFrame(render);
    }

    animationFrame = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrame);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    };
  }, [coverage, phase]);

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
