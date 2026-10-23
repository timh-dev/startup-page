import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { ChoiceButton, RangeControl } from "../controls";
import { setUiValue, type SettingsSectionProps } from "./types";

// Grid density, card shape, clock format, decorative media, feature pages
// and tile sizing.
export default function LayoutSettings({ settings, updateSettings }: SettingsSectionProps) {
  const selectedGridDensity = settings.ui?.gridDensity || "comfortable";
  const selectedCardStyle = settings.ui?.cardStyle || "rounded";
  const selectedClockFormat = settings.ui?.clockFormat || "12h";

  return (
    <>
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Grid Density</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {["comfortable", "compact"].map((value) => (
              <ChoiceButton
                key={value}
                selected={selectedGridDensity === value}
                title={value.charAt(0).toUpperCase() + value.slice(1)}
                description={value === "comfortable" ? "More air between modules." : "Tighter dashboard packing."}
                onClick={() => setUiValue(updateSettings, "gridDensity", value)}
              />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Card Shape</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {["soft", "rounded", "sharp"].map((value) => (
              <ChoiceButton
                key={value}
                selected={selectedCardStyle === value}
                title={value.charAt(0).toUpperCase() + value.slice(1)}
                description={value === "soft" ? "Large rounded corners." : value === "sharp" ? "Crisper corners." : "Balanced default radius."}
                onClick={() => setUiValue(updateSettings, "cardStyle", value)}
              />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Clock Format</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {["12h", "24h"].map((value) => (
              <ChoiceButton
                key={value}
                selected={selectedClockFormat === value}
                title={value === "12h" ? "12-hour" : "24-hour"}
                description={value === "12h" ? "Hours 1–12 (e.g. 9:45)." : "Hours 0–23 (e.g. 21:45)."}
                onClick={() => setUiValue(updateSettings, "clockFormat", value)}
              />
            ))}
          </CardContent>
        </Card>
      </div>

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
          <CardTitle>Tile Size</CardTitle>
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
