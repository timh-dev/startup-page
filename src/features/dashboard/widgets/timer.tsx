import { HiOutlineBell } from "react-icons/hi2";
import TimerBox from "@/features/dashboard/components/TimerBox";
import { useSettingsStore } from "@/features/settings/stores";
import { updateWidgetConfig } from "@/lib/dashboard-dimensions";
import { persistDashboard, useActiveDashboardId } from "@/features/dashboard/useDashboard";
import { readSettings } from "@/lib/settings";
import { defineWidget, type WidgetRenderProps } from "./types";

function TimerRender({ instance, cardClass }: WidgetRenderProps) {
  const dashboardId = useActiveDashboardId();
  // Falls back to the pre-widget global default for instances migrated before
  // per-widget timer config existed.
  const legacyDefault = useSettingsStore((state) => state.settings.timer?.focusMinutes);
  const focusMinutes = (instance.config as { focusMinutes?: number }).focusMinutes ?? legacyDefault;

  const handleFocusMinutesChange = (minutes: number) => {
    void persistDashboard(dashboardId, ({ widgets }) => ({ widgets: updateWidgetConfig(widgets, instance.id, { focusMinutes: minutes }) }));
  };

  return (
    <div className={cardClass}>
      <TimerBox focusMinutes={focusMinutes} onFocusMinutesChange={handleFocusMinutesChange} />
    </div>
  );
}

export const timerWidget = defineWidget({
  type: "timer",
  label: "Timer",
  icon: HiOutlineBell,
  defaultSize: "small",
  makeDefaultConfig: () => ({ focusMinutes: readSettings().timer?.focusMinutes ?? 25 }),
  Render: TimerRender,
});
