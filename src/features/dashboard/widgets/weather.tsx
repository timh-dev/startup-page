import React from "react";
import { HiOutlineCloud, HiOutlineSparkles } from "react-icons/hi2";
import { Label } from "@/components/ui/label";
import type { WeatherOverrides } from "@/features/weather/hooks/useWeatherData";
import { useCredentialsStore } from "@/lib/credentials";
import { TextField } from "./TextField";
import { defineWidget, type WidgetRenderProps } from "./types";

const WeatherBox = React.lazy(() =>
  import("@/features/weather/components/WeatherBox").then((m) => ({ default: m.WeatherBox })),
);
const WeatherDayDetail = React.lazy(() => import("@/features/weather/components/WeatherDayDetail"));
const WeatherFrostedCard = React.lazy(() => import("@/features/weather/components/WeatherFrostedCard"));

// Per-widget overrides of the app-wide location and units.
interface WeatherSourceConfig {
  lat?: number | null;
  lon?: number | null;
  units?: "imperial" | "metric" | null;
}

interface WeatherConfig extends WeatherSourceConfig {
  variant?: "compact" | "detail";
}

function weatherOverridesFrom(config: WeatherSourceConfig): WeatherOverrides {
  return {
    lat: config.lat ?? undefined,
    lon: config.lon ?? undefined,
    units: config.units ?? undefined,
  };
}

function WeatherSourceFields<C extends WeatherSourceConfig>({
  idPrefix,
  config,
  onChange,
}: {
  idPrefix: string;
  config: C;
  onChange: (next: C) => void;
}) {
  const openWeatherKey = useCredentialsStore((state) => state.openWeather);
  const setCredential = useCredentialsStore((state) => state.setCredential);

  return (
    <>
      <p className="text-xs text-muted-foreground">
        Leave the location blank to use your current location.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <TextField
          id={`${idPrefix}-lat`}
          label="Latitude"
          value={config.lat != null ? String(config.lat) : ""}
          onChange={(value) => onChange({ ...config, lat: value === "" ? null : Number(value) })}
        />
        <TextField
          id={`${idPrefix}-lon`}
          label="Longitude"
          value={config.lon != null ? String(config.lon) : ""}
          onChange={(value) => onChange({ ...config, lon: value === "" ? null : Number(value) })}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${idPrefix}-units`}>Units</Label>
        <select
          id={`${idPrefix}-units`}
          value={config.units || ""}
          onChange={(event) => onChange({ ...config, units: (event.target.value || null) as WeatherSourceConfig["units"] })}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <option value="">App default</option>
          <option value="imperial">Imperial (°F, mph)</option>
          <option value="metric">Metric (°C, km/h)</option>
        </select>
      </div>
      <TextField
        id={`${idPrefix}-key`}
        label="OpenWeather API key (all weather widgets, this device only)"
        value={openWeatherKey || ""}
        onChange={(value) => setCredential("openWeather", value)}
      />
    </>
  );
}

function WeatherRender({ instance, cardClass }: WidgetRenderProps) {
  const config = instance.config as WeatherConfig;
  const overrides = weatherOverridesFrom(config);
  return (
    <div className={cardClass}>
      <React.Suspense fallback={null}>
        {config.variant === "detail" ? (
          <WeatherDayDetail instanceId={instance.id} overrides={overrides} />
        ) : (
          <WeatherBox instanceId={instance.id} overrides={overrides} />
        )}
      </React.Suspense>
    </div>
  );
}

function WeatherConfigFields({ config, onChange }: { config: WeatherConfig; onChange: (next: WeatherConfig) => void }) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="weather-variant">Display</Label>
        <select
          id="weather-variant"
          value={config.variant || "compact"}
          onChange={(event) => onChange({ ...config, variant: event.target.value as WeatherConfig["variant"] })}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <option value="compact">Compact (current + 5-day)</option>
          <option value="detail">Detail (hourly breakdown)</option>
        </select>
      </div>
      <WeatherSourceFields idPrefix="weather" config={config} onChange={onChange} />
    </div>
  );
}

// Frosted-glass hourly card.
function WeatherV2Render({ instance, cardClass }: WidgetRenderProps) {
  const overrides = weatherOverridesFrom(instance.config as WeatherSourceConfig);
  return (
    <div className={cardClass}>
      <React.Suspense fallback={null}>
        <WeatherFrostedCard instanceId={instance.id} overrides={overrides} />
      </React.Suspense>
    </div>
  );
}

function WeatherV2ConfigFields({ config, onChange }: { config: WeatherSourceConfig; onChange: (next: WeatherSourceConfig) => void }) {
  return (
    <div className="grid gap-3">
      <WeatherSourceFields idPrefix="weather-v2" config={config} onChange={onChange} />
    </div>
  );
}

export const weatherWidget = defineWidget<WeatherConfig>({
  type: "weather",
  label: "Weather",
  icon: HiOutlineCloud,
  defaultSize: "wide",
  makeDefaultConfig: () => ({ variant: "compact" }),
  Render: WeatherRender,
  ConfigFields: WeatherConfigFields,
});

export const weatherV2Widget = defineWidget<WeatherSourceConfig>({
  type: "weatherV2",
  label: "Weather (Frosted)",
  icon: HiOutlineSparkles,
  defaultSize: "feature",
  allowedSizes: ["feature"],
  makeDefaultConfig: () => ({}),
  Render: WeatherV2Render,
  ConfigFields: WeatherV2ConfigFields,
});
