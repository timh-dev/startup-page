// Solar position math — NOAA Solar Calculator equations
// Based on Meeus, "Astronomical Algorithms" (2nd ed.)
// Reference: https://gml.noaa.gov/grad/solcalc/solareqns.PDF

const TO_RAD = Math.PI / 180.0;
const TO_DEG = 180.0 / Math.PI;

export function linspace(start, stop, n) {
  const arr = [];
  const step = (stop - start) / (n - 1);
  for (let i = 0; i < n; i++) arr.push(start + step * i);
  return arr;
}

export function getDayOfYear() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  return Math.floor((now - start) / (1000 * 60 * 60 * 24));
}

function tzOffsetHours() {
  return -new Date().getTimezoneOffset() / 60;
}

// Equation of time in minutes (Spencer 1971 / NOAA simplified form)
function equationOfTime(doy) {
  const B = TO_RAD * (360 / 365 * (doy - 81));
  return 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
}

// Solar declination in degrees
function solarDeclination(doy) {
  return 23.45 * Math.sin(TO_RAD * (360 / 365 * (doy - 81)));
}

// Sunrise and sunset as local decimal hours
// lat/lng in degrees. Zenith 90.833° accounts for atmospheric refraction.
export function solarTimes(lat, lng, doy) {
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
export function sunElevation(lat, lng, localHour, doy) {
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
  const now = new Date();
  return now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
}

// Compute full solar context for today (called once on mount)
// lat/lng in degrees
export function calculateSolarContext(lat, lng) {
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
  const curveHours = linspace(0, 24, 500);
  const curveElevations = curveHours.map((h) => sunElevation(lat, lng, h, doy));

  return {
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
  };
}
