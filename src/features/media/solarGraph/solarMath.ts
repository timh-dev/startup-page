import { debugNow, debugTimeZone, wallClock } from "@/lib/debug";
// Solar position math — NOAA Solar Calculator equations
// Based on Meeus, "Astronomical Algorithms" (2nd ed.)
// Reference: https://gml.noaa.gov/grad/solcalc/solareqns.PDF

export interface TwilightEvent {
  label: string;
  hour: number;
  elevation: number;
  type: string;
}

export interface SolarContext {
  lat: number;
  lng: number;
  doy: number;
  sunrise: number;
  sunset: number;
  currentTime: number;
  maxElevation: number;
  minElevation: number;
  curveHours: number[];
  curveElevations: number[];
  events: TwilightEvent[];
}

const TO_RAD = Math.PI / 180.0;
const TO_DEG = 180.0 / Math.PI;

export function linspace(start: number, stop: number, n: number) {
  const arr: number[] = [];
  const step = (stop - start) / (n - 1);
  for (let i = 0; i < n; i++) arr.push(start + step * i);
  return arr;
}

// "Now" and the time zone come from the debugger when it's set (another
// time or place), else the real clock and the browser's zone.
export function getDayOfYear() {
  const { year, month, day } = wallClock(debugNow(), debugTimeZone());
  return Math.round((Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 0)) / 86_400_000);
}

function tzOffsetHours() {
  return wallClock(debugNow(), debugTimeZone()).offsetHours;
}

// Equation of time in minutes (Spencer 1971 / NOAA simplified form)
function equationOfTime(doy: number) {
  const B = TO_RAD * (360 / 365 * (doy - 81));
  return 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
}

// Solar declination in degrees
function solarDeclination(doy: number) {
  return 23.45 * Math.sin(TO_RAD * (360 / 365 * (doy - 81)));
}

// Sunrise and sunset as local decimal hours
// lat/lng in degrees. Zenith 90.833° accounts for atmospheric refraction.
export function solarTimes(lat: number, lng: number, doy: number): [number, number] {
  const decl = solarDeclination(doy);
  const latR = TO_RAD * lat;
  const decR = TO_RAD * decl;
  let cosHa =
    (Math.cos(TO_RAD * 90.833) - Math.sin(latR) * Math.sin(decR)) /
    (Math.cos(latR) * Math.cos(decR));
  cosHa = Math.max(-1.0, Math.min(1.0, cosHa));
  const ha = TO_DEG * Math.acos(cosHa);
  const eot = equationOfTime(doy);
  const noonUtc = 12 - lng / 15 - eot / 60;
  const tz = tzOffsetHours();
  return [noonUtc - ha / 15 + tz, noonUtc + ha / 15 + tz];
}

// Sun elevation angle in degrees at a given local decimal hour
// lat/lng in degrees
export function sunElevation(lat: number, lng: number, localHour: number, doy: number) {
  const decl = solarDeclination(doy);
  const eot = equationOfTime(doy);
  const noonUtc = 12 - lng / 15 - eot / 60;
  const tz = tzOffsetHours();
  const ha = 15 * (localHour - tz - noonUtc);
  const latR = TO_RAD * lat;
  const decR = TO_RAD * decl;
  const haR = TO_RAD * ha;
  const sinE =
    Math.sin(latR) * Math.sin(decR) +
    Math.cos(latR) * Math.cos(decR) * Math.cos(haR);
  return TO_DEG * Math.asin(Math.max(-1.0, Math.min(1.0, sinE)));
}

export function getCurrentLst() {
  const { hours, minutes, seconds } = wallClock(debugNow(), debugTimeZone());
  return hours + minutes / 60 + seconds / 3600;
}

// ── Fixed-curve day mapping (Apple Watch Solar Graph style) ─────────────────
// The rendered curve is identical for every location, timezone, and date:
// a cosine with its trough at both edges (solar midnight) and its peak at
// center (solar noon). The x-axis is LINEAR time centered on solar noon.
// What varies by location/season is the HORIZON LINE: it sits at the height
// where the fixed curve crosses it exactly at today's real sunrise and
// sunset times — low in summer (mostly daylight above it), high in winter
// (a thin daylight sliver).

function wrap24(h: number) {
  return ((h % 24) + 24) % 24;
}

// Signed offset in hours, wrapped into [-12, 12)
function wrapSigned12(d: number) {
  return ((((d + 12) % 24) + 24) % 24) - 12;
}

// Mapping anchors: solar noon (wrapped into the local day) and half the
// day length. Wrapping makes remote lat/lng configurations — where
// sunrise/sunset land outside 0–24h local time — behave correctly, and the
// half-day clamp guards polar day/night where the sun never crosses the
// horizon.
export function solarDayAnchors(solar: SolarContext) {
  const halfDay = Math.max(0.25, Math.min(11.75, (solar.sunset - solar.sunrise) / 2));
  const solarNoon = wrap24((solar.sunrise + solar.sunset) / 2);
  return { solarNoon, halfDay };
}

// Local hour → normalized day position u ∈ [0, 1]: linear time from solar
// midnight (u = 0) through solar noon (u = 0.5) back to solar midnight.
export function hourToDayFraction(hour: number, solar: SolarContext) {
  const { solarNoon } = solarDayAnchors(solar);
  return (wrapSigned12(hour - solarNoon) + 12) / 24;
}

// Normalized day position u ∈ [0, 1] → local hour (inverse of the above)
export function dayFractionToHour(u: number, solar: SolarContext) {
  const { solarNoon } = solarDayAnchors(solar);
  const f = Math.max(0, Math.min(1, u));
  return wrap24(solarNoon + (f * 24 - 12));
}

// The fixed curve: -1 at u = 0 and 1 (midnight troughs), 0 at 0.25 / 0.75
// (horizon crossings), +1 at 0.5 (noon peak).
export function normalizedElevation(u: number) {
  return -Math.cos(2 * Math.PI * u);
}

// Format decimal hour (e.g. 5.683) to "5:41 AM"
export function formatHour(decimalHour: number) {
  const h = ((decimalHour % 24) + 24) % 24; // wrap to 0–24
  const hours12 = Math.floor(h) % 12 || 12;
  const minutes = Math.round((h - Math.floor(h)) * 60);
  const suffix = Math.floor(h) < 12 || Math.floor(h) === 24 ? 'AM' : 'PM';
  return `${hours12}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

// Scan the pre-computed curve for elevation crossings at specific thresholds
// Returns sorted array of { label, hour, elevation, type }
export function computeTwilightEvents(solar: SolarContext) {
  const { curveHours, curveElevations } = solar;
  const thresholds = [
    { elevation: 0, rising: 'Sunrise', setting: 'Sunset', type: 'horizon' },
    { elevation: -6, rising: 'Civil dawn', setting: 'Civil dusk', type: 'civil' },
    { elevation: -12, rising: 'Nautical dawn', setting: 'Nautical dusk', type: 'nautical' },
    { elevation: -18, rising: 'Astro dawn', setting: 'Astro dusk', type: 'astronomical' },
  ];

  const events: TwilightEvent[] = [];

  for (const { elevation: thresh, rising, setting, type } of thresholds) {
    for (let i = 0; i < curveHours.length - 1; i++) {
      const e0 = curveElevations[i] - thresh;
      const e1 = curveElevations[i + 1] - thresh;

      // Detect zero crossing
      if (e0 * e1 < 0) {
        // Linear interpolation for precise crossing time
        const t = e0 / (e0 - e1);
        const hour = curveHours[i] + t * (curveHours[i + 1] - curveHours[i]);
        const isRising = e1 > e0;
        events.push({
          label: isRising ? rising : setting,
          hour,
          elevation: thresh,
          type,
        });
      }
    }
  }

  events.sort((a, b) => a.hour - b.hour);
  return events;
}

// Compute full solar context for today (called once on mount)
// lat/lng in degrees
export function calculateSolarContext(lat: number, lng: number) {
  const doy = getDayOfYear();
  const [sunrise, sunset] = solarTimes(lat, lng, doy);
  const currentTime = getCurrentLst();

  // Annual range for consistent vertical scaling across seasons
  const summerPeak = sunElevation(lat, lng, 12, 172);
  const winterTrough = sunElevation(lat, lng, 0, 355);

  // Today's range
  let todayMax = -90;
  let todayMin = 90;
  for (let h = 0; h <= 24; h += 0.25) {
    const el = sunElevation(lat, lng, h, doy);
    if (el > todayMax) todayMax = el;
    if (el < todayMin) todayMin = el;
  }

  const maxElevation = Math.max(summerPeak, todayMax, 5);
  const minElevation = Math.min(winterTrough, todayMin, -5);

  // Pre-compute curve elevations (doesn't change during the day)
  const curveHours = linspace(0, 24, 1440);
  const curveElevations = curveHours.map((h) => sunElevation(lat, lng, h, doy));

  const context: SolarContext = {
    lat,
    lng,
    doy,
    sunrise,
    sunset,
    currentTime,
    maxElevation,
    minElevation,
    curveHours,
    curveElevations,
    events: [],
  };

  context.events = computeTwilightEvents(context);
  return context;
}
