import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { StartupSettings } from "@/features/settings/stores";
import { IMAGE_FILTER_DEFAULTS, IMAGE_FILTER_DEFINITIONS, type ImageFilterPreset } from "@/lib/image-filters";
import { RangeControl } from "../controls";
import type { SettingsSectionProps } from "./types";

// Per-filter toggles, presets and controls for photo tile shader effects.
export default function ImageEffectsSettings({ settings, updateSettings }: SettingsSectionProps) {
  const imageEffects = settings.ui?.imageEffects || IMAGE_FILTER_DEFAULTS;

  const handleImageFilterToggle = (filterKey: string, checked: boolean) => {
    updateSettings((prevSettings: StartupSettings) => ({
      ...prevSettings,
      ui: {
        ...prevSettings.ui,
        imageEffects: {
          enabledFilters: {
            ...IMAGE_FILTER_DEFAULTS.enabledFilters,
            ...prevSettings.ui?.imageEffects?.enabledFilters,
            [filterKey]: checked,
          },
          filterSettings: {
            ...IMAGE_FILTER_DEFAULTS.filterSettings,
            ...prevSettings.ui?.imageEffects?.filterSettings,
          },
        },
      },
    }));
  };

  const handleImageFilterSettingChange = (filterKey: string, settingKey: string, value: number | boolean) => {
    updateSettings((prevSettings: StartupSettings) => ({
      ...prevSettings,
      ui: {
        ...prevSettings.ui,
        imageEffects: {
          enabledFilters: {
            ...IMAGE_FILTER_DEFAULTS.enabledFilters,
            ...prevSettings.ui?.imageEffects?.enabledFilters,
          },
          filterSettings: {
            ...IMAGE_FILTER_DEFAULTS.filterSettings,
            ...prevSettings.ui?.imageEffects?.filterSettings,
            [filterKey]: {
              ...IMAGE_FILTER_DEFAULTS.filterSettings[filterKey],
              ...prevSettings.ui?.imageEffects?.filterSettings?.[filterKey],
              [settingKey]: value,
            },
          },
        },
      },
    }));
  };

  const handleImageFilterPreset = (filterKey: string, preset: ImageFilterPreset) => {
    updateSettings((prevSettings: StartupSettings) => ({
      ...prevSettings,
      ui: {
        ...prevSettings.ui,
        imageEffects: {
          enabledFilters: {
            ...IMAGE_FILTER_DEFAULTS.enabledFilters,
            ...prevSettings.ui?.imageEffects?.enabledFilters,
          },
          filterSettings: {
            ...IMAGE_FILTER_DEFAULTS.filterSettings,
            ...prevSettings.ui?.imageEffects?.filterSettings,
            [filterKey]: { ...preset.params },
          },
        },
      },
    }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Image effects</CardTitle>
        <CardDescription>
          Enable one or more filters for photo tiles. When multiple filters are enabled, each image tile picks one at random.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {IMAGE_FILTER_DEFINITIONS.map((filter) => {
          const enabled = imageEffects.enabledFilters?.[filter.key] || false;
          const filterSettings = imageEffects.filterSettings?.[filter.key] || IMAGE_FILTER_DEFAULTS.filterSettings[filter.key];

          return (
            <div key={filter.key} className="rounded-xl border border-border p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium">{filter.label}</p>
                  <p className="text-sm text-muted-foreground">
                    {enabled ? "Active and eligible for random image selection." : "Disabled."}
                  </p>
                </div>
                <Switch
                  checked={enabled}
                  onCheckedChange={(checked) => handleImageFilterToggle(filter.key, checked)}
                />
              </div>

              {enabled ? (
                <div className="mt-4 space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {filter.presets.map((preset) => (
                      <Button
                        key={preset.name}
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleImageFilterPreset(filter.key, preset)}
                      >
                        {preset.name}
                      </Button>
                    ))}
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    {filter.controls.map((control) => {
                      const controlValue = filterSettings[control.key];
                      if (control.type === "boolean") {
                        return (
                          <div key={control.key} className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
                            <Label className="text-sm text-foreground">{control.label}</Label>
                            <Switch
                              checked={Boolean(controlValue)}
                              onCheckedChange={(checked) =>
                                handleImageFilterSettingChange(filter.key, control.key, checked)
                              }
                            />
                          </div>
                        );
                      }

                      return (
                        <RangeControl
                          key={control.key}
                          label={control.label}
                          value={Number(controlValue)}
                          min={control.min}
                          max={control.max}
                          step={control.step}
                          onChange={(value: number) =>
                            handleImageFilterSettingChange(filter.key, control.key, value)
                          }
                        />
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
