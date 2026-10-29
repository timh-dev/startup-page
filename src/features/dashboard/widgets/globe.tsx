import React from "react";
import { HiOutlineGlobeAmericas } from "react-icons/hi2";

import { Label } from "@/components/ui/label";
import type { GlobeView } from "@/features/globe/framing";
import { defineWidget } from "./types";

const GlobeWidget = React.lazy(() => import("@/features/globe/GlobeWidget"));

interface GlobeConfig {
  view?: GlobeView;
}

export const globeWidget = defineWidget<GlobeConfig>({
  type: "globe",
  label: "Globe",
  icon: HiOutlineGlobeAmericas,
  defaultSize: "large",
  makeDefaultConfig: () => ({ view: "globe" }),
  Render: ({ instance, cardClass }) => {
    const config = instance.config as GlobeConfig;
    return (
      <div className={cardClass}>
        <React.Suspense fallback={null}>
          <GlobeWidget view={config.view === "limb" ? "limb" : "globe"} />
        </React.Suspense>
      </div>
    );
  },
  ConfigFields: ({ config, onChange }) => (
    <div className="grid gap-1.5">
      <Label htmlFor="globe-view">View</Label>
      <select
        id="globe-view"
        value={config.view || "globe"}
        onChange={(event) => onChange({ ...config, view: event.target.value as GlobeView })}
        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <option value="globe">Whole globe: your part of the world, facing you</option>
        <option value="limb">Planet edge: the glowing limb, with you on it</option>
      </select>
    </div>
  ),
});
