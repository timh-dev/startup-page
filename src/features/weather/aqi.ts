// The US Air Quality Index from particle concentrations (µg/m³), by the EPA's
// breakpoints (PM2.5 as revised in 2024). The index is the worse of the two.
// For sources that give concentrations but no index (OpenWeather).

type Breakpoint = [concLow: number, concHigh: number, aqiLow: number, aqiHigh: number];

const PM25: Breakpoint[] = [
  [0, 9.0, 0, 50],
  [9.1, 35.4, 51, 100],
  [35.5, 55.4, 101, 150],
  [55.5, 125.4, 151, 200],
  [125.5, 225.4, 201, 300],
  [225.5, 325.4, 301, 500],
];

const PM10: Breakpoint[] = [
  [0, 54, 0, 50],
  [55, 154, 51, 100],
  [155, 254, 101, 150],
  [255, 354, 151, 200],
  [355, 424, 201, 300],
  [425, 604, 301, 500],
];

function subIndex(concentration: number, table: Breakpoint[], decimals: number): number {
  const c = Math.floor(Math.max(0, concentration) * 10 ** decimals) / 10 ** decimals;
  const row = table.find(([, high]) => c <= high) ?? table[table.length - 1];
  const [cLow, cHigh, iLow, iHigh] = row;
  return Math.round(((iHigh - iLow) / (cHigh - cLow)) * (Math.min(c, cHigh) - cLow) + iLow);
}

export function usAqi(pm25: number | null, pm10: number | null): number {
  return Math.max(pm25 != null ? subIndex(pm25, PM25, 1) : 0, pm10 != null ? subIndex(pm10, PM10, 0) : 0);
}
