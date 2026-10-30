// WebGL2 renderer for the dot globe: the scene pass (atmosphere, ocean and
// land dots) into an HDR target with a mip chain for halation, then the
// composite pass (the viewer's pulse, print finish) to the canvas.
import { apply, cameraDistance, earthToView, shotFor, targetFor, type GlobeView } from "./framing";
import { COMPOSITE_FS, FULLSCREEN_VS, SCENE_FS } from "./shaders";
import { subsolarPoint, toVector } from "./sun";

// Earth, per km (Hillaire 2020, as in Maxime Heckel's article).
const EARTH = {
  radius: 6360,
  top: 100,
  heights: [8, 1.2, 25, 15],
  rayleigh: [5.802e-3, 13.558e-3, 33.1e-3],
  mieScatter: [3.996e-3, 3.996e-3, 3.996e-3],
  mieExtinct: [4.44e-3, 4.44e-3, 4.44e-3],
  ozone: [0.65e-3, 1.881e-3, 0.085e-3],
  mieG: 0.8,
  sun: 20,
};

// The look: the posters' paper black, a deep ocean, cream dots like ink on
// a 60s print.
const LOOK = {
  ocean: srgbToLinear([0x0c, 0x3b, 0x7a]),
  dots: srgbToLinear([0xef, 0xe6, 0xd2]),
  paper: [0x1d / 255, 0x1d / 255, 0x1d / 255],
  // On screen, not in scene light: divided by the exposure, so the night
  // side reads the same whether the planet is lit or backlit.
  nightGlow: 0.2,
  stars: 0.12,
  grain: 1,
  dust: 0.35,
  glow: 0.45,
  aberration: 0.002,
  // Degrees between dots: the limb view is zoomed in about 6x, so its dots
  // are finer to keep the same size on screen.
  dotSpacingDeg: { globe: 2.1, limb: 0.42 },
};

export interface GlobeState {
  view: GlobeView;
  latitude: number;
  longitude: number;
  now: Date;
}

type Program = { program: WebGLProgram; set: (name: string, value: number | number[]) => void; mat3: (name: string, m: number[]) => void; texture: (name: string, tex: WebGLTexture, unit: number) => void };

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(`Globe shader failed to compile: ${gl.getShaderInfoLog(shader)}`);
  return shader;
}

function createProgram(gl: WebGL2RenderingContext, fragment: string): Program {
  const program = gl.createProgram()!;
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, FULLSCREEN_VS));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragment));
  gl.bindAttribLocation(program, 0, "aPos");
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(`Globe program failed to link: ${gl.getProgramInfoLog(program)}`);
  const cache = new Map<string, WebGLUniformLocation | null>();
  const loc = (name: string) => {
    if (!cache.has(name)) cache.set(name, gl.getUniformLocation(program, name));
    return cache.get(name)!;
  };
  return {
    program,
    set(name, value) {
      const l = loc(name);
      if (!l) return;
      if (typeof value === "number") gl.uniform1f(l, value);
      else if (value.length === 2) gl.uniform2f(l, value[0], value[1]);
      else if (value.length === 3) gl.uniform3f(l, value[0], value[1], value[2]);
      else if (value.length === 4) gl.uniform4f(l, value[0], value[1], value[2], value[3]);
    },
    // GLSL mat3 is column-major; ours are row-major, so transpose on upload.
    mat3(name, m) {
      const l = loc(name);
      if (l) gl.uniformMatrix3fv(l, true, m);
    },
    texture(name, tex, unit) {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      const l = loc(name);
      if (l) gl.uniform1i(l, unit);
    },
  };
}

function srgbToLinear(rgb: number[]) {
  return rgb.map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export interface GlobeRenderer {
  /** Re-render the planet (when the sun, location, view or size changes). */
  renderScene(state: GlobeState): void;
  /** Draw a frame: the pulse and the print finish over the last scene. */
  renderFrame(time: number, pulse: boolean): void;
  setLandMask(image: HTMLImageElement): void;
  dispose(): void;
}

export function createGlobeRenderer(canvas: HTMLCanvasElement): GlobeRenderer {
  const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, premultipliedAlpha: false });
  if (!gl) throw new Error("WebGL2 is not available");
  const hdr = !!gl.getExtension("EXT_color_buffer_float");

  const scene = createProgram(gl, SCENE_FS);
  const composite = createProgram(gl, COMPOSITE_FS);

  const vao = gl.createVertexArray()!;
  gl.bindVertexArray(vao);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const draw = () => {
    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  // HDR scene target with mipmaps (wide blurs for the halation, for free).
  const target = gl.createTexture()!;
  const framebuffer = gl.createFramebuffer()!;
  let targetSize = [0, 0];
  const resizeTarget = (w: number, h: number) => {
    if (targetSize[0] === w && targetSize[1] === h) return;
    targetSize = [w, h];
    gl.bindTexture(gl.TEXTURE_2D, target);
    if (hdr) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, target, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  };

  // Until the land mask loads: all sea.
  const land = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, land);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, 1, 1, 0, gl.RED, gl.UNSIGNED_BYTE, new Uint8Array([0]));
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  // Shared camera uniforms, kept so the composite pass matches the scene.
  let shared: { aspect: number; tanHalf: number; planetUv: number[]; camera: number[]; viewToEarth: number[]; here: number[]; exposure: number; dotSpacing: number } | null = null;

  const setShared = (p: Program, height: number) => {
    if (!shared) return;
    p.set("uAspect", shared.aspect);
    p.set("uTanHalfFov", shared.tanHalf);
    p.set("uPlanetUv", shared.planetUv);
    p.set("uCamera", shared.camera);
    p.set("uRadius", EARTH.radius);
    p.mat3("uViewToEarth", shared.viewToEarth);
    p.texture("uLand", land, 1);
    p.set("uDotSpacing", (shared.dotSpacing * Math.PI) / 180);
    p.set("uDotRadius", (shared.dotSpacing * 0.34 * Math.PI) / 180);
    p.set("uTileH", height);
  };

  return {
    setLandMask(image) {
      gl.bindTexture(gl.TEXTURE_2D, land);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, gl.RED, gl.UNSIGNED_BYTE, image);
    },

    renderScene({ view, latitude, longitude, now }) {
      const width = canvas.width;
      const height = canvas.height;
      const aspect = width / height;
      const shot = shotFor(view, aspect);
      const tanHalf = Math.tan((shot.fov * Math.PI) / 360);
      const toView = earthToView(latitude, longitude, targetFor(shot, aspect));
      const viewToEarth = [toView[0], toView[3], toView[6], toView[1], toView[4], toView[7], toView[2], toView[5], toView[8]];
      const sun = subsolarPoint(now);
      const sunDir = apply(toView, toVector(sun.latitude, sun.longitude));
      // Phase: 0 = the camera sees the lit face, 180 = backlit. Backlit
      // limbs are far dimmer, so exposure follows it, as in the posters.
      const phase = (Math.acos(Math.max(-1, Math.min(1, sunDir[2]))) * 180) / Math.PI;
      const exposure = view === "globe" ? 0.6 + smoothstep(95, 170, phase) * 1.8 : 0.42 + smoothstep(80, 160, phase) * 2.8;
      const inflate = view === "globe" ? 2.2 : 1.5;
      shared = {
        aspect,
        tanHalf,
        planetUv: [shot.planetX, 1 - shot.planetY],
        camera: [0, 0, EARTH.radius * cameraDistance(shot)],
        viewToEarth,
        here: toVector(latitude, longitude),
        exposure,
        dotSpacing: LOOK.dotSpacingDeg[view],
      };

      resizeTarget(width, height);
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.viewport(0, 0, width, height);
      gl.useProgram(scene.program);
      setShared(scene, height);
      // Inflating the atmosphere scales heights up and coefficients down by
      // the same factor: the band gets wider, its colours stay physical.
      const coeff = (c: number[]) => c.map((v) => v / inflate);
      scene.set("uTop", EARTH.top * inflate);
      scene.set("uHeights", EARTH.heights.map((h) => h * inflate));
      scene.set("uRayleigh", coeff(EARTH.rayleigh));
      scene.set("uMieScatter", coeff(EARTH.mieScatter));
      scene.set("uMieExtinct", coeff(EARTH.mieExtinct));
      scene.set("uOzone", coeff(EARTH.ozone));
      scene.set("uMieG", EARTH.mieG);
      scene.set("uSun", EARTH.sun);
      scene.set("uSunDir", sunDir);
      scene.set("uOcean", LOOK.ocean);
      scene.set("uDotColor", LOOK.dots);
      scene.set("uNightGlow", LOOK.nightGlow / exposure);
      scene.set("uStars", LOOK.stars);
      draw();

      gl.bindTexture(gl.TEXTURE_2D, target);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    },

    renderFrame(time, pulse) {
      if (!shared) return;
      const width = canvas.width;
      const height = canvas.height;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, width, height);
      gl.useProgram(composite.program);
      setShared(composite, height);
      composite.texture("uScene", target, 0);
      composite.set("uExposure", shared.exposure);
      composite.set("uPaper", LOOK.paper);
      composite.set("uGrain", LOOK.grain);
      composite.set("uDust", LOOK.dust);
      composite.set("uGlow", LOOK.glow);
      composite.set("uAberration", LOOK.aberration);
      composite.set("uHere", shared.here);
      composite.set("uTime", time);
      composite.set("uPulse", pulse ? 1 : 0);
      draw();
    },

    dispose() {
      // The context is kept: React's StrictMode remounts on the same canvas,
      // and a lost context can't be recreated there.
      gl.deleteTexture(target);
      gl.deleteTexture(land);
      gl.deleteFramebuffer(framebuffer);
      gl.deleteBuffer(buffer);
      gl.deleteVertexArray(vao);
      gl.deleteProgram(scene.program);
      gl.deleteProgram(composite.program);
    },
  };
}
