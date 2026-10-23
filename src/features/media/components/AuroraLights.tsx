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
uniform float u_intensity;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);

  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));

  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float value = 0.0;
  float amp = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);

  for (int i = 0; i < 5; i++) {
    value += amp * noise(p);
    p = m * p + vec2(8.3, 3.1);
    amp *= 0.52;
  }

  return value;
}

// One aurora curtain: a folded ribbon with vertical field-aligned rays.
// h is altitude above the curtain's lower border (the sharp "hem").
// Returns vec4(color * brightness, brightness).
vec4 curtain(vec2 p, float t, float seedOff, float scale) {
  // Large slow folds — the curtain's serpentine path across the sky.
  float fold1 = fbm(vec2(p.x * 1.3 * scale + t * 0.026 + seedOff, t * 0.018)) - 0.5;
  float fold2 = fbm(vec2(p.x * 3.1 * scale - t * 0.020 + seedOff, 7.0 + t * 0.025)) - 0.5;

  // Lower border ("hem") height undulates along the fold
  float hem = 0.16 + fold1 * 0.17 + fold2 * 0.07;
  float h = (p.y - hem) / 0.78;
  if (h < -0.05) return vec4(0.0);

  // Ray coordinate: rays shear with the folds and diverge slightly upward,
  // like field lines converging to the magnetic zenith.
  float rx = p.x * scale + fold1 * (0.25 + h * 0.40) + fold2 * 0.10 * h + seedOff;

  // Multi-scale vertical ray structure (broad bands → hair-thin striations)
  float rBroad = fbm(vec2(rx * 2.7 + t * 0.045, t * 0.013));
  float rMed   = fbm(vec2(rx * 7.6 - t * 0.032, 3.7));
  float rFine  = fbm(vec2(rx * 19.0 + t * 0.020, 9.1));
  float rHair  = noise(vec2(rx * 46.0, t * 0.25));

  float rays = smoothstep(0.30, 0.86, rBroad) * 0.60
             + smoothstep(0.40, 0.92, rMed) * 0.42
             + pow(smoothstep(0.50, 0.95, rFine), 2.0) * 0.38
             + pow(rHair, 5.0) * 0.22;

  // Brightness waves racing along the curtain — the aurora "dancing"
  float wave  = 0.55 + 0.45 * fbm(vec2(rx * 2.1 - t * 0.55, t * 0.10));
  float surge = 0.75 + 0.25 * sin(t * 0.23 + fold1 * 5.0);

  // Vertical profile: sharp bottom edge, brightest just above the hem,
  // long diffuse fade upward; strong rays extend further up.
  float hPos = max(h, 0.0);
  float base = smoothstep(-0.02, 0.05, h) * exp(-hPos * 2.3);
  float tall = smoothstep(0.0, 0.05, h) * exp(-hPos * 1.05) * smoothstep(0.45, 0.95, rays);
  float profile = base + tall * 0.55;

  float bright = clamp(rays * wave * surge * profile, 0.0, 1.4);

  // Altitude emission colors: pink-purple N2 fringe at the very bottom,
  // the classic 557nm oxygen green body, and dim 630nm oxygen red on top.
  vec3 cPink  = vec3(0.93, 0.38, 0.80);
  vec3 cGreen = vec3(0.22, 0.96, 0.46);
  vec3 cTeal  = vec3(0.14, 0.78, 0.62);
  vec3 cRed   = vec3(0.82, 0.16, 0.38);
  vec3 col = cGreen;
  col = mix(cPink, col, smoothstep(0.015, 0.15, hPos));
  col = mix(col, cTeal, smoothstep(0.22, 0.50, hPos) * 0.35);
  col = mix(col, cRed,  smoothstep(0.42, 0.95, hPos) * 0.80);

  return vec4(col * bright, bright);
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  float aspect = u_resolution.x / max(u_resolution.y, 1.0);
  vec2 p = vec2((uv.x - 0.5) * aspect + 0.5, uv.y);

  float t = u_time * 0.5;
  float lowerFade = smoothstep(0.16, 0.3, uv.y);
  float upperFade = 1.0 - smoothstep(0.95, 1.0, uv.y);
  float sideFade = smoothstep(0.0, 0.05, uv.x) * (1.0 - smoothstep(0.95, 1.0, uv.x));

  // Foreground curtain + a dimmer, slower one behind it for depth
  vec4 front = curtain(p, t, 0.0, 1.0);
  vec4 back  = curtain(vec2(p.x * 0.8 + 0.13, p.y * 0.92 + 0.06), t * 0.7, 17.0, 1.3);

  // Faint diffuse airglow veil drifting high above
  float veil = smoothstep(0.3, 0.9, fbm(vec2(p.x * 1.9 + t * 0.02, p.y * 2.2 + 31.0)))
             * smoothstep(0.3, 0.75, uv.y) * 0.18;

  vec3 color = front.rgb + back.rgb * 0.45 + vec3(0.20, 0.80, 0.50) * veil;
  float bright = front.a + back.a * 0.45 + veil;

  // Subtle cool ambient so the glow reads as light in a dark sky
  color += vec3(0.07, 0.12, 0.22) * bright * 0.3;

  float alpha = clamp(bright * 0.62, 0.0, 0.8) * lowerFade * upperFade * sideFade * u_intensity;
  gl_FragColor = vec4(color, alpha);
}
`;

// Compile and link without blocking status checks — status verified lazily in rAF.
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

interface AuroraLightsProps {
  intensity?: number;
}

export default function AuroraLights({ intensity = 1 }: AuroraLightsProps): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [supported, setSupported] = useState(true);
  const intensityRef = useRef(intensity);
  intensityRef.current = intensity;

  useEffect(() => {
    const canvasEl = canvasRef.current;
    const glContext = canvasEl?.getContext("webgl", {
      antialias: false,
      alpha: true,
      premultipliedAlpha: false,
      powerPreference: "low-power",
    });

    if (!canvasEl || !glContext) {
      setSupported(false);
      return undefined;
    }
    // Re-bound as non-null consts so the nested render functions keep the narrowing.
    const canvas: HTMLCanvasElement = canvasEl;
    const gl: WebGLRenderingContext = glContext;

    let animationFrame = 0;
    const linkedProgram = createProgram(gl);
    if (!linkedProgram) { setSupported(false); return undefined; }
    const program: WebGLProgram = linkedProgram;
    const khrParallel = gl.getExtension("KHR_parallel_shader_compile") as { COMPLETION_STATUS_KHR: number } | null;

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);

    const startedAt = performance.now();

    let glReady = false;
    let position = -1;
    let resolution: WebGLUniformLocation | null = null;
    let time: WebGLUniformLocation | null = null;
    let intensityUniform: WebGLUniformLocation | null = null;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 1);
      const width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      const height = Math.max(1, Math.floor(canvas.clientHeight * dpr));

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      gl.viewport(0, 0, width, height);
    }

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);

    const AURORA_FRAME_MS = 1000 / 24;
    let lastFrameTime = 0;

    function render(now: number) {
      animationFrame = requestAnimationFrame(render);
      if (!canvas.clientWidth) return; // hidden (ancestor display:none) — skip GPU work

      if (!glReady) {
        if (khrParallel && !gl.getProgramParameter(program, khrParallel.COMPLETION_STATUS_KHR)) return;
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
          setSupported(false);
          cancelAnimationFrame(animationFrame);
          return;
        }
        position        = gl.getAttribLocation(program, "a_position");
        resolution      = gl.getUniformLocation(program, "u_resolution");
        time            = gl.getUniformLocation(program, "u_time");
        intensityUniform = gl.getUniformLocation(program, "u_intensity");
        glReady = true;
      }

      if (now - lastFrameTime < AURORA_FRAME_MS) return;
      lastFrameTime = now;

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(resolution, canvas.width, canvas.height);
      gl.uniform1f(time, (now - startedAt) / 1000);
      gl.uniform1f(intensityUniform, Math.max(0, Math.min(intensityRef.current, 1)));
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    animationFrame = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    };
  }, []);

  if (!supported) {
    return <div className="weather-aurora-fallback absolute inset-0 pointer-events-none" aria-hidden="true" />;
  }

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full pointer-events-none mix-blend-screen" aria-hidden="true" />;
}
