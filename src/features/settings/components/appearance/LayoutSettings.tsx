import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { RangeControl, SegmentedControl } from "../controls";
import { setUiValue, type SettingsSectionProps } from "./types";

// Grid density, card shape, clock format, decorative media, feature pages
// and tile sizing.
export default function LayoutSettings({ settings, updateSettings }: SettingsSectionProps) {
  const selectedGridDensity = settings.ui?.gridDensity || "comfortable";
  const selectedCardStyle = settings.ui?.cardStyle || "rounded";
  const selectedClockFormat = settings.ui?.clockFormat || "12h";

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Layout</CardTitle>
          <CardDescription>How tightly tiles pack, how round their corners are, and how the clock reads.</CardDescription>
        </CardHeader>
        <CardContent className="settings-rows">
          <div className="settings-row">
            <span className="settings-row-label">Density</span>
            <SegmentedControl
              label="Grid density"
              value={selectedGridDensity}
              onChange={(value) => setUiValue(updateSettings, "gridDensity", value)}
              options={[
                { value: "comfortable", label: "Comfortable" },
                { value: "compact", label: "Compact" },
              ]}
            />
          </div>
          <div className="settings-row">
            <span className="settings-row-label">Corners</span>
            <SegmentedControl
              label="Card shape"
              value={selectedCardStyle}
              onChange={(value) => setUiValue(updateSettings, "cardStyle", value)}
              options={[
                { value: "soft", label: "Soft" },
                { value: "rounded", label: "Rounded" },
                { value: "sharp", label: "Sharp" },
              ]}
            />
          </div>
          <div className="settings-row">
            <span className="settings-row-label">Clock</span>
            <SegmentedControl
              label="Clock format"
              value={selectedClockFormat}
              onChange={(value) => setUiValue(updateSettings, "clockFormat", value)}
              options={[
                { value: "12h", label: "12-hour" },
                { value: "24h", label: "24-hour" },
              ]}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Atmosphere</CardTitle>
          <CardDescription>Decorative tiles can be disabled without affecting the data modules.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <div>
            <p className="font-medium">Decorative media tiles</p>
            <p className="text-sm text-muted-foreground">Show or hide the looping desert video modules.</p>
          </div>
          <Switch
            checked={settings.ui?.showDecorativeMedia ?? true}
            onCheckedChange={(checked) => setUiValue(updateSettings, "showDecorativeMedia", checked)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Features</CardTitle>
          <CardDescription>Turn off a dedicated page and its nav icon/shortcut — dashboard widgets keep working either way.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium">Resource Vault</p>
              <p className="text-sm text-muted-foreground">The Resource Vault page and its nav icon/shortcut.</p>
            </div>
            <Switch
              checked={settings.ui?.vaultEnabled ?? true}
              onCheckedChange={(checked) => setUiValue(updateSettings, "vaultEnabled", checked)}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium">Bookmarks</p>
              <p className="text-sm text-muted-foreground">The Bookmarks page and its nav icon/shortcut.</p>
            </div>
            <Switch
              checked={settings.ui?.bookmarksEnabled ?? true}
              onCheckedChange={(checked) => setUiValue(updateSettings, "bookmarksEnabled", checked)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tile size</CardTitle>
          <CardDescription>Scale how large each dashboard tile appears. Takes effect after saving.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <RangeControl
            label="Size (rem)"
            value={settings.ui?.tileSize ?? 9}
            min={7}
            max={14}
            step={1}
            onChange={(value: number) => setUiValue(updateSettings, "tileSize", value)}
          />
          <RangeControl
            label="Bookmark pill size (rem)"
            value={settings.ui?.bookmarkPillSize ?? 3.25}
            min={2.5}
            max={5}
            step={0.25}
            onChange={(value: number) => setUiValue(updateSettings, "bookmarkPillSize", value)}
          />
        </CardContent>
      </Card>
    </>
  );
}
