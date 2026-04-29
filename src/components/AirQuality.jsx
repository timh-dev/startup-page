import React from "react";
import { readSettings } from "@/lib/settings";

const AQI_LEVELS = [
  { max: 50,       label: "Good",                              color: "#22c55e", textClass: "text-green-400",  bgClass: "bg-green-500/15"  },
  { max: 100,      label: "Moderate",                          color: "#eab308", textClass: "text-yellow-400", bgClass: "bg-yellow-500/15" },
  { max: 150,      label: "Unhealthy for Sensitive Groups",    color: "#f97316", textClass: "text-orange-400", bgClass: "bg-orange-500/15" },
  { max: 200,      label: "Unhealthy",                         color: "#ef4444", textClass: "text-red-400",    bgClass: "bg-red-500/15"    },
  { max: 300,      label: "Very Unhealthy",                    color: "#a855f7", textClass: "text-purple-400", bgClass: "bg-purple-500/15" },
  { max: Infinity, label: "Hazardous",                         color: "#7f1d1d", textClass: "text-red-300",    bgClass: "bg-red-900/30"    },
];

function getLevel(aqi) {
  return AQI_LEVELS.find((l) => aqi <= l.max) ?? AQI_LEVELS[AQI_LEVELS.length - 1];
}

export default function AirQuality() {
  const settings = React.useMemo(() => readSettings(), []);
  const [data, setData] = React.useState(null);
  const [status, setStatus] = React.useState("loading");

  React.useEffect(() => {
    let cancelled = false;

    async function load(lat, lon) {
      try {
        const res = await fetch(
          `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}` +
          `&current=us_aqi,pm2_5,pm10,european_aqi&timezone=auto`
        );
        const json = await res.json();
        if (cancelled) return;
        const aqi = json.current?.us_aqi ?? json.current?.european_aqi ?? 0;
        setData({
          aqi,
          pm25: json.current?.pm2_5?.toFixed(1) ?? "—",
          pm10: json.current?.pm10?.toFixed(1) ?? "—",
        });
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    }

    if (settings.latitude) {
      load(settings.latitude, settings.longitude);
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (p) => load(p.coords.latitude, p.coords.longitude),
        () => setStatus("location-error")
      );
    } else {
      setStatus("location-error");
    }

    return () => { cancelled = true; };
  }, []);

  if (status !== "ready" || !data) {
    const msg = status === "loading" ? "Loading air quality…"
      : status === "location-error" ? "Set coordinates in Settings."
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
