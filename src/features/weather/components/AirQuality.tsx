import React from "react";
import { useDebugStore } from "@/lib/debug";
import { getOrRequestLocation } from "@/lib/geolocation";
import { openMeteoUrl } from "@/lib/openMeteo";
import { useCredentialsStore } from "@/lib/credentials";
import { usAqi } from "@/features/weather/aqi";

const AQI_LEVELS = [
  { max: 50,       label: "Good",                              color: "#22c55e", textClass: "text-green-400",  bgClass: "bg-green-500/15"  },
  { max: 100,      label: "Moderate",                          color: "#eab308", textClass: "text-yellow-400", bgClass: "bg-yellow-500/15" },
  { max: 150,      label: "Unhealthy for Sensitive Groups",    color: "#f97316", textClass: "text-orange-400", bgClass: "bg-orange-500/15" },
  { max: 200,      label: "Unhealthy",                         color: "#ef4444", textClass: "text-red-400",    bgClass: "bg-red-500/15"    },
  { max: 300,      label: "Very Unhealthy",                    color: "#a855f7", textClass: "text-purple-400", bgClass: "bg-purple-500/15" },
  { max: Infinity, label: "Hazardous",                         color: "#7f1d1d", textClass: "text-red-300",    bgClass: "bg-red-900/30"    },
];

function getLevel(aqi: number) {
  return AQI_LEVELS.find((l) => aqi <= l.max) ?? AQI_LEVELS[AQI_LEVELS.length - 1];
}

export default function AirQuality() {
  const [data, setData] = React.useState<{ aqi: number; pm25: string; pm10: string } | null>(null);
  const [status, setStatus] = React.useState("loading");
  // The debugger's place, when set, instead of the browser's location.
  const debugPlace = useDebugStore((state) => state.location);
  // Where Open-Meteo can't be used (the hosted site without a key), OpenWeather's air data instead.
  const openWeatherKey = useCredentialsStore((state) => state.openWeather);

  React.useEffect(() => {
    let cancelled = false;

    async function load(lat: number, lon: number) {
      try {
        const openMeteo = openMeteoUrl("air-quality", { latitude: lat, longitude: lon, current: "us_aqi,pm2_5,pm10,european_aqi", timezone: "auto" });
        if (openMeteo) {
          const json = await (await fetch(openMeteo)).json();
          if (cancelled) return;
          setData({
            aqi: json.current?.us_aqi ?? json.current?.european_aqi ?? 0,
            pm25: json.current?.pm2_5?.toFixed(1) ?? "—",
            pm10: json.current?.pm10?.toFixed(1) ?? "—",
          });
          setStatus("ready");
          return;
        }
        const key = (openWeatherKey || "").trim();
        if (!key) {
          setStatus("no-key");
          return;
        }
        const res = await fetch(`https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${key}`);
        if (!res.ok) throw new Error(`Air quality request failed (${res.status})`);
        const json = await res.json();
        if (cancelled) return;
        const components = json.list?.[0]?.components ?? {};
        const pm25 = typeof components.pm2_5 === "number" ? components.pm2_5 : null;
        const pm10 = typeof components.pm10 === "number" ? components.pm10 : null;
        setData({ aqi: usAqi(pm25, pm10), pm25: pm25?.toFixed(1) ?? "—", pm10: pm10?.toFixed(1) ?? "—" });
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    }

    if (debugPlace) {
      load(debugPlace.latitude, debugPlace.longitude);
      return () => { cancelled = true; };
    }

    void getOrRequestLocation().then((coords) => {
      if (cancelled) return;
      if (coords) {
        load(coords.lat, coords.lon);
      } else {
        setStatus("location-error");
      }
    });

    return () => { cancelled = true; };
  }, [debugPlace, openWeatherKey]);

  if (status !== "ready" || !data) {
    const msg = status === "loading" ? "Loading air quality…"
      : status === "location-error" ? "Set coordinates in Settings."
      : status === "no-key" ? "Add an OpenWeather key in Settings › Connections to see air quality."
      : "Air quality unavailable.";
    return (
      <div className="flex h-full w-full items-center justify-center rounded-[inherit] bg-card">
        <span className="text-xs text-muted-foreground">{msg}</span>
      </div>
    );
  }

  const level = getLevel(data.aqi);
  const pct = Math.min(100, (data.aqi / 300) * 100);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 rounded-[inherit] bg-[linear-gradient(160deg,color-mix(in_oklab,var(--color-card)_88%,black_12%),color-mix(in_oklab,var(--color-accent)_20%,var(--color-card)))] p-6">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Air Quality · US AQI</p>

      <div className={`flex flex-col items-center gap-1 rounded-2xl ${level.bgClass} px-10 py-5`}>
        <span className={`text-6xl font-bold tabular-nums ${level.textClass}`}>{data.aqi}</span>
        <span className={`text-center text-xs font-semibold ${level.textClass}`}>{level.label}</span>
      </div>

      <div className="w-full max-w-xs">
        <div className="h-2 w-full overflow-hidden rounded-full bg-border/40">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, backgroundColor: level.color }}
          />
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
          <span>0 Good</span>
          <span>300 Hazardous</span>
        </div>
      </div>

      <div className="flex gap-8 text-center">
        <div>
          <div className="text-[10px] text-muted-foreground">PM2.5</div>
          <div className="text-sm font-semibold text-foreground">{data.pm25} µg/m³</div>
        </div>
        <div>
          <div className="text-[10px] text-muted-foreground">PM10</div>
          <div className="text-sm font-semibold text-foreground">{data.pm10} µg/m³</div>
        </div>
      </div>
    </div>
  );
}
