// API keys are kept on the device that entered them and never synced or
// exported. Older versions stored them inside the settings object; these
// helpers find and remove them there. Shared so the API can strip any that
// an out-of-date client still sends.

/** Top-level settings keys that used to hold API keys. */
export const LEGACY_CREDENTIAL_KEYS = ["unsplashCredential", "openWeatherCredential"] as const;

/** Per-widget config key that used to hold an OpenWeather API key override. */
export const LEGACY_WIDGET_CREDENTIAL_KEY = "openWeatherKey";

type Widget = { config?: Record<string, unknown>; items?: unknown } & Record<string, unknown>;

function isWidget(value: unknown): value is Widget {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** Calls `visit` with every widget config, including those inside stacks. */
export function forEachWidgetConfig(widgets: unknown, visit: (config: Record<string, unknown>) => void) {
  if (!Array.isArray(widgets)) return;
  for (const widget of widgets) {
    if (!isWidget(widget)) continue;
    if (widget.config && typeof widget.config === "object") visit(widget.config);
    forEachWidgetConfig(widget.items, visit);
  }
}

/** A copy of `widgets` without per-widget API keys; returns the same array when there were none. */
export function stripWidgetCredentials<T>(widgets: T): T {
  if (!Array.isArray(widgets)) return widgets;
  let changed = false;
  const next = widgets.map((widget) => {
    if (!isWidget(widget)) return widget;
    let nextWidget = widget;
    if (widget.config && LEGACY_WIDGET_CREDENTIAL_KEY in widget.config) {
      const { [LEGACY_WIDGET_CREDENTIAL_KEY]: _removed, ...config } = widget.config;
      nextWidget = { ...nextWidget, config };
    }
    const items = stripWidgetCredentials(widget.items);
    if (items !== widget.items) nextWidget = { ...nextWidget, items };
    if (nextWidget !== widget) changed = true;
    return nextWidget;
  });
  return (changed ? next : widgets) as T;
}
