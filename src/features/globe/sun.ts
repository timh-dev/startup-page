// Where the sun is overhead right now (the subsolar point), from NOAA's
// solar position approximations. Its latitude is the solar declination,
// which carries Earth's 23.44° tilt through the year: polar day and polar
// night follow from it without special cases.

const DEG = Math.PI / 180;

/** Fractional year in radians, as NOAA defines it. */
function fractionalYear(date: Date) {
  const start = Date.UTC(date.getUTCFullYear(), 0, 1);
  const dayOfYear = Math.floor((date.getTime() - start) / 86_400_000) + 1;
  const hours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  const year = date.getUTCFullYear();
  const days = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 366 : 365;
  return ((2 * Math.PI) / days) * (dayOfYear - 1 + (hours - 12) / 24);
}

/** Solar declination and the equation of time (minutes) for a moment. */
export function solarAngles(date: Date) {
  const g = fractionalYear(date);
  const declination =
    0.006918 -
    0.399912 * Math.cos(g) +
    0.070257 * Math.sin(g) -
    0.006758 * Math.cos(2 * g) +
    0.000907 * Math.sin(2 * g) -
    0.002697 * Math.cos(3 * g) +
    0.00148 * Math.sin(3 * g);
  const equationOfTime =
    229.18 *
    (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  return { declination, equationOfTime };
}

/** The subsolar point in degrees: where the sun is straight overhead. */
export function subsolarPoint(date: Date) {
  const { declination, equationOfTime } = solarAngles(date);
  const utcMinutes = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
  // At 12:00 UTC the sun is over 0° longitude, less the equation of time; it
  // moves west 0.25° a minute.
  let longitude = -((utcMinutes + equationOfTime - 720) / 4);
  longitude = ((((longitude + 180) % 360) + 360) % 360) - 180;
  return { latitude: declination / DEG, longitude };
}

/** Unit vector in Earth-fixed coordinates (x: 0°N 0°E, y: 0°N 90°E, z: north pole). */
export function toVector(latitude: number, longitude: number): [number, number, number] {
  const lat = latitude * DEG;
  const lon = longitude * DEG;
  return [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)];
}

/** The sun's elevation in degrees at a place and moment. */
export function sunElevation(latitude: number, longitude: number, date: Date) {
  const sun = subsolarPoint(date);
  const [ax, ay, az] = toVector(latitude, longitude);
  const [bx, by, bz] = toVector(sun.latitude, sun.longitude);
  return Math.asin(Math.max(-1, Math.min(1, ax * bx + ay * by + az * bz))) / DEG;
}
