// Small form controls shared by the settings sections.
import React from "react";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

type Swatches = Record<string, string>;

export interface CustomTheme {
  id: string;
  name: string;
  light: Record<string, string>;
  dark: Record<string, string>;
}

export function PaletteSwatchPreview({ swatches, mode }: { swatches: { light: Swatches; dark: Swatches }; mode: string }) {
  const modeSwatches = mode === "dark" ? swatches.dark : swatches.light;
  const keys = ["background", "card", "primary", "accent", "muted"];
  return (
    <div className="mb-2 flex h-12 items-center justify-center gap-1.5 rounded-md border border-border/40 bg-muted/30">
      {keys.map((key) => (
        <div
          key={key}
          className="size-5 rounded-full border border-border/60 shadow-sm"
          style={{ backgroundColor: modeSwatches[key] }}
          title={key}
        />
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

export function ChoiceButton({ selected, title, description, onClick }: { selected: boolean; title: string; description: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md border p-2.5 text-left text-xs transition",
        selected
          ? "border-primary bg-accent text-accent-foreground shadow-sm"
          : "border-border bg-card hover:bg-accent/50"
      )}
    >
      <div className="font-medium leading-tight">{title}</div>
      <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{description}</div>
    </button>
  );
}
