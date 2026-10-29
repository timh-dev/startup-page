import React from "react";
import { HiOutlineCloud, HiOutlineExclamationTriangle } from "react-icons/hi2";
import { MISSING_API_KEY_MESSAGE } from "@/features/weather/hooks/useWeatherData";
import { useSidePanelStore } from "@/components/layout/sidePanelStore";
import { useSettingsStore } from "@/features/settings/stores";

const WEATHER_TYPES = new Set(["weather", "weatherV2"]);

type WidgetLike = { id: string; type?: string };

function isTopLevelWidget(widgets: WidgetLike[], id: string) {
  return widgets.some((widget) => widget.id === id);
}

/**
 * What a weather tile shows before it has data: a setup prompt when no API
 * key is set, the reason when loading failed, or a quiet skeleton while
 * loading. Drawn on a calm sky so the tile still reads as weather.
 */
export function WeatherStatus({ error, instanceId }: { error: string | null; instanceId?: string }): React.ReactElement {
  const openSettings = useSidePanelStore((state) => state.openSettings);
  const rawWidgets = useSettingsStore((state) => state.settings.widgets);

  if (!error) {
    return (
      <div className="weather-status" aria-busy="true" aria-label="Loading weather">
        <div className="weather-status-skeleton">
          <span className="skeleton h-3 w-20 rounded-full" />
          <span className="skeleton h-9 w-16 rounded-lg" />
          <span className="skeleton h-3 w-28 rounded-full" />
        </div>
      </div>
    );
  }

  const needsKey = error === MISSING_API_KEY_MESSAGE;
  const widgets: WidgetLike[] = Array.isArray(rawWidgets) ? rawWidgets : [];
  const topLevel = !!instanceId && isTopLevelWidget(widgets, instanceId);
  // Widgets inside a stack aren't individually editable from the dialog.
  const canConfigure = needsKey && topLevel;

  // One setup prompt per dashboard: a weather widget inside a stack stays
  // quiet when a top-level weather widget is already asking for the key.
  if (needsKey && !topLevel && widgets.some((widget) => widget.type && WEATHER_TYPES.has(widget.type))) {
    return (
      <div className="weather-status" aria-label="Weather needs an API key">
        <span className="weather-status-icon" aria-hidden="true">
          <HiOutlineCloud />
        </span>
        <p className="weather-status-body">Hourly forecast appears once weather is connected.</p>
      </div>
    );
  }

  return (
    <div className="weather-status">
      <span className="weather-status-icon" aria-hidden="true">
        {needsKey ? <HiOutlineCloud /> : <HiOutlineExclamationTriangle />}
      </span>
      <p className="weather-status-title">{needsKey ? "Connect weather" : "Weather unavailable"}</p>
      <p className="weather-status-body">
        {needsKey ? "Add a free OpenWeather API key to see your forecast here." : error}
      </p>
      {canConfigure && (
        <button type="button" className="weather-status-action" onClick={() => openSettings("connections")}>
          Add API key
        </button>
      )}
    </div>
  );
}
