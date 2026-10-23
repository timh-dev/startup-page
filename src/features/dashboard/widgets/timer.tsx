import { HiOutlineBell } from "react-icons/hi2";
import TimerBox from "@/features/dashboard/components/TimerBox";
import { useSettingsStore } from "@/features/settings/stores";
import { updateWidgetConfig, type WidgetInstance } from "@/lib/dashboard-dimensions";
import { readSettings } from "@/lib/settings";
import { defineWidget, type WidgetRenderProps } from "./types";

function TimerRender({ instance, cardClass }: WidgetRenderProps) {
  const persistSettings = useSettingsStore((state) => state.persistSettings);
  // Falls back to the pre-widget global default for instances migrated before
  // per-widget timer config existed.
  const legacyDefault = useSettingsStore((state) => state.settings.timer?.focusMinutes);
  const focusMinutes = (instance.config as { focusMinutes?: number }).focusMinutes ?? legacyDefault;

  const handleFocusMinutesChange = (minutes: number) => {
    void persistSettings((prev) => {
      const widgets: WidgetInstance[] = Array.isArray(prev.widgets) ? prev.widgets : [];
      return { ...prev, widgets: updateWidgetConfig(widgets, instance.id, { focusMinutes: minutes }) };
    });
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
