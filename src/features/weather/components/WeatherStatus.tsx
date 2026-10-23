import React from "react";
import { HiOutlineCloud, HiOutlineExclamationTriangle } from "react-icons/hi2";
import { MISSING_API_KEY_MESSAGE } from "@/features/weather/hooks/useWeatherData";
import { useWidgetConfigDialogStore } from "@/features/dashboard/stores/widgetConfigDialogStore";
import { useSettingsStore } from "@/features/settings/stores";

function isTopLevelWidget(id: string) {
  const widgets = useSettingsStore.getState().settings.widgets;
  return Array.isArray(widgets) && widgets.some((widget: { id: string }) => widget.id === id);
}

/**
 * What a weather tile shows before it has data: a setup prompt when no API
 * key is set, the reason when loading failed, or a quiet skeleton while
 * loading. Drawn on a calm sky so the tile still reads as weather.
 */
export function WeatherStatus({ error, instanceId }: { error: string | null; instanceId?: string }): React.ReactElement {
  const openEdit = useWidgetConfigDialogStore((state) => state.openEdit);

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
  // Widgets inside a stack aren't individually editable from the dialog.
  const canConfigure = needsKey && instanceId && isTopLevelWidget(instanceId);

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
        <button type="button" className="weather-status-action" onClick={() => openEdit(instanceId)}>
          Add API key
        </button>
      )}
    </div>
  );
}
