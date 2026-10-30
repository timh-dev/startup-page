import type React from "react";
import type { WidgetInstance, WidgetType } from "@/lib/dashboard-dimensions";

export type WidgetSize = "small" | "wide" | "tall" | "large" | "feature";

export interface WidgetRenderProps {
  instance: WidgetInstance;
  cardClass?: string;
}

export interface WidgetTypeDef {
  type: WidgetType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  defaultSize: WidgetSize;
  /** Sizes this widget can be set to. Omit to allow all 5. */
  allowedSizes?: WidgetSize[];
  makeDefaultConfig: () => Record<string, unknown>;
  Render: React.ComponentType<WidgetRenderProps>;
  ConfigFields?: React.ComponentType<{ config: Record<string, unknown>; onChange: (next: Record<string, unknown>) => void }>;
}

/**
 * Declares a widget type with its config fields typed against the widget's
 * own config shape. Instance configs are stored untyped, so this is the one
 * place that shape is asserted.
 */
export function defineWidget<Config extends object>(
  def: Omit<WidgetTypeDef, "ConfigFields"> & {
    ConfigFields?: React.ComponentType<{ config: Config; onChange: (next: Config) => void }>;
  },
): WidgetTypeDef {
  return def as WidgetTypeDef;
}
