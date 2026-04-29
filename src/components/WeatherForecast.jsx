import React from "react";
import { readSettings } from "@/lib/settings";

function weatherEmoji(code) {
  if (code === 0) return "☀️";
  if (code <= 2) return "⛅";
  if (code <= 3) return "☁️";
  if (code <= 48) return "🌫️";
  if (code <= 57) return "🌦️";
  if (code <= 67) return "🌧️";
  if (code <= 77) return "❄️";
  if (code <= 82) return "🌧️";
  if (code <= 86) return "🌨️";
  return "⛈️";
}

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function WeatherForecast() {
  const settings = React.useMemo(() => readSettings(), []);
  const [days, setDays] = React.useState([]);
  const [status, setStatus] = React.useState("loading");

  React.useEffect(() => {
    let cancelled = false;

    async function load(lat, lon) {
      const isMetric = settings.units === "metric";
      const tempUnit = isMetric ? "celsius" : "fahrenheit";
      const label = isMetric ? "°C" : "°F";
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
          `&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max` +
          `&temperature_unit=${tempUnit}&timezone=auto&forecast_days=5`
        );
        const data = await res.json();
        if (cancelled) return;
        const { time, temperature_2m_max, temperature_2m_min, weather_code, precipitation_probability_max } = data.daily;
        setDays(time.map((d, i) => ({
          day: DAY[new Date(d + "T12:00:00").getDay()],
          high: Math.round(temperature_2m_max[i]),
          low: Math.round(temperature_2m_min[i]),
          code: weather_code[i],
          precip: precipitation_probability_max[i] ?? 0,
          label,
        })));
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

  if (status !== "ready") {
    const msg = status === "loading" ? "Loading forecast…"
      : status === "location-error" ? "Set coordinates in Settings to see the forecast."
      : "Forecast unavailable.";
    return (
      <div className="flex h-full w-full items-center justify-center rounded-[inherit] bg-card p-4 text-center">
        <span className="text-xs text-muted-foreground">{msg}</span>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col rounded-[inherit] bg-[linear-gradient(160deg,color-mix(in_oklab,var(--color-card)_88%,black_12%),color-mix(in_oklab,var(--color-accent)_20%,var(--color-card)))] p-4">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">5-Day Forecast</p>
      <div className="grid flex-1 grid-cols-5 gap-2">
        {days.map((day, i) => (
          <div key={i} className="flex flex-col items-center justify-between rounded-xl border border-border/40 bg-card/40 p-2 backdrop-blur-sm">
            <span className="text-[10px] font-medium text-muted-foreground">{i === 0 ? "Today" : day.day}</span>
            <span className="text-2xl leading-none">{weatherEmoji(day.code)}</span>
            <div className="text-center">
              <div className="text-sm font-semibold text-foreground">{day.high}{day.label}</div>
              <div className="text-xs text-muted-foreground">{day.low}{day.label}</div>
            </div>
            <span className={`text-[10px] ${day.precip > 0 ? "text-blue-400" : "text-transparent"}`}>
              {day.precip}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
