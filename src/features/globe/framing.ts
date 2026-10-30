// Shot set-up for the globe widget, after the design-lab atmosphere posters:
// the planet is placed by where it sits on the tile (centre and radius), the
// camera looks straight at it and the image plane is shifted (lens shift),
// so the outline is an exact circle wherever it sits.
//
// View space: planet at the origin, camera on +z, x right, y up.
import { toVector } from "./sun";

export type GlobeView = "globe" | "limb";

export interface Shot {
  /** Planet centre on the tile: x from the left, y from the top (0..1, may lie outside). */
  planetX: number;
  planetY: number;
  /** Planet radius in tile heights. */
  planetRadius: number;
  /** Vertical field of view, degrees. */
  fov: number;
  /**
   * How far inside the planet's edge the viewer's location sits, as a
   * fraction of the radius, on the line from the planet's centre to the
   * middle of the tile; null places it by `offset` instead.
   */
  inset: number | null;
  /**
   * With no inset: where the viewer's location sits on the disc, from its
   * centre in radii (x right, y down). Off centre, the edge of the planet
   * (and its atmosphere's glow) is always near the location.
   */
  offset?: [number, number];
}

type Vec3 = [number, number, number];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const normalize = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/**
 * The two framings. "globe" is poster III: the whole planet, the viewer's
 * location facing the camera. "limb" is poster II: a huge planet off the
 * top-right so only its edge crosses the tile, with the viewer's location on
 * that sliver, just inside the edge.
 */
export function shotFor(view: GlobeView, aspect: number): Shot {
  if (view === "globe") {
    // The location sits about halfway out toward the lower left, and the
    // planet moves up and right so that spot stays near the tile's middle.
    return { planetX: 0.58, planetY: 0.5, planetRadius: 0.34, fov: 20, inset: null, offset: [-0.4, 0.38] };
  }
  // Wider tiles push the planet further right so the arc still runs corner
  // to corner.
  return { planetX: 0.5 + 1.25 * aspect, planetY: -0.95, planetRadius: 1.95, fov: 9, inset: 0.035 };
}

/** View-space point where the viewer's location goes for a shot. */
export function targetFor(shot: Shot, aspect: number): Vec3 {
  if (shot.inset === null) {
    if (!shot.offset) return [0, 0, 1];
    const x = shot.planetX + (shot.offset[0] * shot.planetRadius) / aspect;
    const y = shot.planetY + shot.offset[1] * shot.planetRadius;
    return pointOnPlanet(shot, aspect, x, y) ?? [0, 0, 1];
  }
  // In tile-height units, from the planet's centre toward the tile's middle.
  const dx = (0.5 - shot.planetX) * aspect;
  const dy = 0.5 - shot.planetY;
  const length = Math.hypot(dx, dy) || 1;
  const reach = shot.planetRadius * (1 - shot.inset);
  const x = shot.planetX + ((dx / length) * reach) / aspect;
  const y = shot.planetY + (dy / length) * reach;
  return pointOnPlanet(shot, aspect, x, y) ?? [0, 0, 1];
}

/** Distance from the planet's centre to the camera, in planet radii. */
export function cameraDistance(shot: Shot) {
  const tanHalf = Math.tan((shot.fov * Math.PI) / 360);
  return 1 / Math.sin(Math.atan(shot.planetRadius * 2 * tanHalf));
}

/** The unit-sphere point (view space) seen at a tile position, or null if the ray misses. */
export function pointOnPlanet(shot: Shot, aspect: number, x: number, y: number): Vec3 | null {
  const tanHalf = Math.tan((shot.fov * Math.PI) / 360);
  const s: [number, number] = [(x - shot.planetX) * aspect, (1 - y) - (1 - shot.planetY)];
  const rd = normalize([s[0] * 2 * tanHalf, s[1] * 2 * tanHalf, -1]);
  const ro: Vec3 = [0, 0, cameraDistance(shot)];
  const b = dot(ro, rd);
  const miss: Vec3 = [ro[0] - b * rd[0], ro[1] - b * rd[1], ro[2] - b * rd[2]];
  const d = 1 - dot(miss, miss);
  if (d < 0) return null;
  const t = -b - Math.sqrt(d);
  return normalize([ro[0] + rd[0] * t, ro[1] + rd[1] * t, ro[2] + rd[2] * t]);
}

/** Local frame at a point on the sphere: east, north and up (the point itself). */
function localFrame(up: Vec3, north: Vec3): [Vec3, Vec3, Vec3] {
  let n = [north[0] - dot(north, up) * up[0], north[1] - dot(north, up) * up[1], north[2] - dot(north, up) * up[2]] as Vec3;
  if (Math.hypot(n[0], n[1], n[2]) < 1e-6) n = Math.abs(up[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]; // at a pole
  n = normalize(n);
  return [cross(n, up), n, up];
}

/**
 * Rotation from Earth-fixed coordinates to view space (row-major 3x3), turning
 * the globe so the viewer's location lands on `toward` (a view-space unit
 * vector) with its local north pointing up the screen.
 */
export function earthToView(latitude: number, longitude: number, toward: Vec3): number[] {
  const [eastE, northE, upE] = localFrame(toVector(latitude, longitude), [0, 0, 1]);
  const [eastV, northV, upV] = localFrame(toward, [0, 1, 0]);
  // R = [eastV northV upV] · [eastE northE upE]ᵀ
  const m: number[] = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) m.push(eastV[r] * eastE[c] + northV[r] * northE[c] + upV[r] * upE[c]);
  }
  return m;
}

/** Applies a row-major 3x3 to a vector. */
export function apply(m: number[], v: Vec3): Vec3 {
  return [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
}
