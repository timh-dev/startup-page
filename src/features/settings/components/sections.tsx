import React from "react";
import { HiOutlineBugAnt, HiOutlineEye, HiOutlineEyeSlash, HiOutlineMapPin } from "react-icons/hi2";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useSidePanelStore } from "@/components/layout/sidePanelStore";
import { useCredentialsStore, type CredentialName } from "@/lib/credentials";
import { useDebugStore } from "@/lib/debug";
import { DEFAULT_COLUMNS, MAX_COLUMNS, MIN_COLUMNS } from "@/features/dashboard/layout/grid";
import { RangeControl, SegmentedControl } from "./controls";
import { setUiValue, type SettingsSectionProps } from "./appearance/types";

function Row({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="settings-row">
      <div className="min-w-0">
        <span className="settings-row-label">{label}</span>
        {description && <p className="settings-row-description">{description}</p>}
      </div>
      {children}
    </div>
  );
}

/** Location (used by weather, the solar chart, air quality and the globe), units and time. */
export function GeneralSettings({ settings, updateSettings }: SettingsSectionProps) {
  const latitude = typeof settings.latitude === "number" ? settings.latitude : Number(settings.latitude) || null;
  const longitude = typeof settings.longitude === "number" ? settings.longitude : Number(settings.longitude) || null;
  const [lat, setLat] = React.useState(latitude?.toString() ?? "");
  const [lon, setLon] = React.useState(longitude?.toString() ?? "");
  const [locating, setLocating] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    setLat(latitude?.toString() ?? "");
    setLon(longitude?.toString() ?? "");
  }, [latitude, longitude]);

  const setLocation = (nextLat: number | null, nextLon: number | null) => updateSettings((prev) => ({ ...prev, latitude: nextLat, longitude: nextLon }));

  const locate = () => {
    if (!navigator.geolocation) {
      setError("This browser can't share its location.");
      return;
    }
    setLocating(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        setLocation(Math.round(position.coords.latitude * 1e4) / 1e4, Math.round(position.coords.longitude * 1e4) / 1e4);
      },
      () => {
        setLocating(false);
        setError("Location permission was denied.");
      },
    );
  };

  const saveTyped = () => {
    const a = Number(lat);
    const b = Number(lon);
    if (!lat || !lon || !Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a) > 90 || Math.abs(b) > 180) {
      setError("Latitude runs −90 to 90, longitude −180 to 180.");
      return;
    }
    setError("");
    setLocation(a, b);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Location</CardTitle>
          <CardDescription>Used by weather, the solar chart, air quality and the globe. Cards can override it.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          <div className="settings-location-now">
            <HiOutlineMapPin className="size-4" aria-hidden="true" />
            <span className="numeric">{latitude != null && longitude != null ? `${latitude.toFixed(3)}, ${longitude.toFixed(3)}` : "Not set: cards will ask the browser"}</span>
          </div>
          <form
            className="debug-row"
            onSubmit={(event) => {
              event.preventDefault();
              saveTyped();
            }}
          >
            <input className="debug-input" inputMode="decimal" placeholder="Latitude" value={lat} onChange={(event) => setLat(event.target.value)} aria-label="Latitude" />
            <input className="debug-input" inputMode="decimal" placeholder="Longitude" value={lon} onChange={(event) => setLon(event.target.value)} aria-label="Longitude" />
            <button type="submit" className="debug-button">
              Set
            </button>
          </form>
          <div className="debug-row">
            <button type="button" className="debug-button" onClick={locate} disabled={locating}>
              {locating ? "Locating…" : "Use my current location"}
            </button>
            {latitude != null && (
              <button type="button" className="debug-button" onClick={() => setLocation(null, null)}>
                Clear
              </button>
            )}
          </div>
          {error && <p className="settings-error">{error}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Units and time</CardTitle>
        </CardHeader>
        <CardContent className="settings-rows">
          <Row label="Units">
            <SegmentedControl
              label="Units"
              value={settings.units === "metric" ? "metric" : "imperial"}
              onChange={(value) => updateSettings((prev) => ({ ...prev, units: value }))}
              options={[
                { value: "imperial", label: "°F, mph" },
                { value: "metric", label: "°C, km/h" },
              ]}
            />
          </Row>
          <Row label="Clock">
            <SegmentedControl
              label="Clock format"
              value={settings.ui?.clockFormat === "24h" ? "24h" : "12h"}
              onChange={(value) => setUiValue(updateSettings, "clockFormat", value)}
              options={[
                { value: "12h", label: "12-hour" },
                { value: "24h", label: "24-hour" },
              ]}
            />
          </Row>
        </CardContent>
      </Card>
    </>
  );
}

/** How the dashboard is laid out and which pages show. */
export function DashboardSettings({ settings, updateSettings }: SettingsSectionProps) {
  const ui = settings.ui || {};
  const columns = Number(settings.layout?.columns) || DEFAULT_COLUMNS;
  const setColumns = (next: number) =>
    updateSettings((prev) => ({ ...prev, layout: { ...(prev.layout || {}), columns: Math.max(MIN_COLUMNS, Math.min(MAX_COLUMNS, next)) } }));

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Grid</CardTitle>
          <CardDescription>Cards scale with the window; this sets how many fit across.</CardDescription>
        </CardHeader>
        <CardContent className="settings-rows">
          <Row label="Columns" description="Cards past the edge move to the first free spot.">
            <div className="settings-stepper">
              <button type="button" className="debug-button" onClick={() => setColumns(columns - 1)} disabled={columns <= MIN_COLUMNS} aria-label="Fewer columns">
                −
              </button>
              <span className="numeric">{columns}</span>
              <button type="button" className="debug-button" onClick={() => setColumns(columns + 1)} disabled={columns >= MAX_COLUMNS} aria-label="More columns">
                +
              </button>
            </div>
          </Row>
          <Row label="Spacing">
            <SegmentedControl
              label="Grid density"
              value={ui.gridDensity === "compact" ? "compact" : "comfortable"}
              onChange={(value) => setUiValue(updateSettings, "gridDensity", value)}
              options={[
                { value: "comfortable", label: "Comfortable" },
                { value: "compact", label: "Compact" },
              ]}
            />
          </Row>
          <Row label="Corners">
            <SegmentedControl
              label="Card shape"
              value={ui.cardStyle === "soft" || ui.cardStyle === "sharp" ? ui.cardStyle : "rounded"}
              onChange={(value) => setUiValue(updateSettings, "cardStyle", value)}
              options={[
                { value: "soft", label: "Soft" },
                { value: "rounded", label: "Rounded" },
                { value: "sharp", label: "Sharp" },
              ]}
            />
          </Row>
          <RangeControl label="Largest card size (rem)" value={ui.tileSize ?? 9} min={7} max={14} step={1} onChange={(value: number) => setUiValue(updateSettings, "tileSize", value)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pages</CardTitle>
          <CardDescription>Turning a page off hides it and its shortcut; its dashboard cards keep working.</CardDescription>
        </CardHeader>
        <CardContent className="settings-rows">
          <Row label="Vault">
            <Switch checked={ui.vaultEnabled ?? true} onCheckedChange={(checked) => setUiValue(updateSettings, "vaultEnabled", checked)} aria-label="Vault page" />
          </Row>
          <Row label="Bookmarks">
            <Switch checked={ui.bookmarksEnabled ?? true} onCheckedChange={(checked) => setUiValue(updateSettings, "bookmarksEnabled", checked)} aria-label="Bookmarks page" />
          </Row>
          <RangeControl label="Bookmark folder size (rem)" value={ui.bookmarkPillSize ?? 3.25} min={2.5} max={5} step={0.25} onChange={(value: number) => setUiValue(updateSettings, "bookmarkPillSize", value)} />
        </CardContent>
      </Card>
    </>
  );
}

function SecretField({ name, label, description, href }: { name: CredentialName; label: string; description: string; href: string }) {
  const value = useCredentialsStore((state) => state[name]) || "";
  const setCredential = useCredentialsStore((state) => state.setCredential);
  const [shown, setShown] = React.useState(false);
  return (
    <div className="grid gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="settings-row-label">{label}</span>
        <a className="settings-link" href={href} target="_blank" rel="noreferrer">
          Get a key
        </a>
      </div>
      <div className="debug-row">
        <input
          className="debug-input"
          type={shown ? "text" : "password"}
          value={value}
          placeholder="Not set"
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => setCredential(name, event.target.value.trim() || null)}
          aria-label={label}
        />
        <button type="button" className="debug-button" onClick={() => setShown((s) => !s)} aria-label={shown ? "Hide key" : "Show key"}>
          {shown ? <HiOutlineEyeSlash className="size-3.5" /> : <HiOutlineEye className="size-3.5" />}
        </button>
      </div>
      <p className="settings-row-description">{description}</p>
    </div>
  );
}

/** API keys. Kept on this device only: never synced or exported. */
export function ConnectionsSettings() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>API keys</CardTitle>
        <CardDescription>Stored on this device only. They're never synced or included in exports.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <SecretField name="openWeather" label="OpenWeather" description="Weather and forecasts for every weather card." href="https://home.openweathermap.org/api_keys" />
        <SecretField name="unsplash" label="Unsplash" description="Photo cards. Without a key they use Wikimedia's featured pictures." href="https://unsplash.com/oauth/applications" />
      </CardContent>
    </Card>
  );
}

const SHORTCUTS: Array<[string, string]> = [
  ["E", "Edit the dashboard"],
  ["Arrows", "Move the selected card (editing)"],
  ["Delete", "Remove the selected card (editing)"],
  ["⌘Z", "Undo (editing)"],
  ["⌘K", "Command palette"],
  ["1 · 2 · 3", "Vault · Home · Bookmarks"],
  ["Alt+Shift+D", "Debugger"],
  ["Esc", "Close the panel / stop editing"],
];

/** The debugger and keyboard shortcuts. */
export function AdvancedSettings() {
  const openDebugger = useDebugStore((state) => state.setPanelOpen);
  const close = useSidePanelStore((state) => state.close);
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Debugger</CardTitle>
          <CardDescription>Pretend it's another time or place; the clock, solar chart, weather, air quality and globe all follow.</CardDescription>
        </CardHeader>
        <CardContent>
          <button
            type="button"
            className="debug-button"
            onClick={() => {
              close();
              openDebugger(true);
            }}
          >
            <HiOutlineBugAnt className="mr-1.5 size-3.5" /> Open the debugger
          </button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Keyboard shortcuts</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="settings-shortcuts">
            {SHORTCUTS.map(([keys, action]) => (
              <React.Fragment key={keys}>
                <dt>
                  <kbd>{keys}</kbd>
                </dt>
                <dd>{action}</dd>
              </React.Fragment>
            ))}
          </dl>
        </CardContent>
      </Card>
    </>
  );
}
