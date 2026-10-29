// Small form controls shared by the settings sections.
import React from "react";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

type Swatches = Record<string, string>;

export interface CustomTheme {
  id: string;
  name: string;
  light: Record<string, string>;
  dark: Record<string, string>;
}

// A miniature dashboard in the palette's own colours: page, tiles, the
// primary accent and muted text, so palettes compare at a glance.
export function PaletteSwatchPreview({ swatches, mode }: { swatches: { light: Swatches; dark: Swatches }; mode: string }) {
  const c = mode === "dark" ? swatches.dark : swatches.light;
  const tile = { backgroundColor: c.card, boxShadow: `0 0 0 0.5px ${c.muted}` };
  return (
    <div className="palette-preview" style={{ backgroundColor: c.background }} aria-hidden="true">
      <div className="palette-preview-tile palette-preview-wide" style={tile}>
        <span style={{ backgroundColor: c.primary }} className="palette-preview-bar" />
        <span style={{ backgroundColor: c.muted }} className="palette-preview-line" />
      </div>
      <div className="palette-preview-tile" style={tile}>
        <span style={{ backgroundColor: c.accent }} className="palette-preview-dot" />
      </div>
      <div className="palette-preview-tile" style={{ ...tile, backgroundColor: c.primary }} />
      <div className="palette-preview-tile palette-preview-wide" style={tile}>
        <span style={{ backgroundColor: c.muted }} className="palette-preview-line" />
      </div>
    </div>
  );
}

// Segmented control: a row of options in one pill, the selected one raised.
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: Array<{ value: T; label: string; icon?: React.ComponentType<{ className?: string }> }>;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div className="segmented-control" role="radiogroup" aria-label={label}>
      {options.map(({ value: optionValue, label: optionLabel, icon: Icon }) => (
        <button
          key={optionValue}
          type="button"
          role="radio"
          aria-checked={value === optionValue}
          className="segmented-control-option"
          onClick={() => onChange(optionValue)}
        >
          {Icon ? <Icon className="size-3.5" /> : null}
          {optionLabel}
        </button>
      ))}
    </div>
  );
}

export function SettingField({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-foreground">{label}</Label>
      {children}
      {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
    </div>
  );
}

export function RangeControl({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <Label className="text-xs text-foreground">{label}</Label>
        <span className="text-xs font-medium text-muted-foreground">{Number(value).toFixed(step >= 1 ? 0 : 2)}</span>
      </div>
      <Slider
        value={[Number(value)]}
        min={min}
        max={max}
        step={step}
        onValueChange={(nextValue) => onChange(nextValue[0])}
      />
    </div>
  );
}
