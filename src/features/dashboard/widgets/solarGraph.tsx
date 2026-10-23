import React from "react";
import { HiOutlineChartBar } from "react-icons/hi2";
import { defineWidget } from "./types";

const SolarGraph = React.lazy(() => import("@/features/media/solarGraph"));

export const solarGraphWidget = defineWidget({
  type: "solarGraph",
  label: "Solar graph",
  icon: HiOutlineChartBar,
  defaultSize: "large",
  makeDefaultConfig: () => ({}),
  Render: ({ cardClass }) => (
    <div className={cardClass}>
      <React.Suspense fallback={null}>
        <SolarGraph />
      </React.Suspense>
    </div>
  ),
});
