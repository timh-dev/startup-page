import { HiOutlineCog6Tooth } from "react-icons/hi2";

import { useSidePanelStore } from "@/components/layout/sidePanelStore";

/** Toolbar button: opens Settings in the side panel (or closes it). */
export default function SettingsButton() {
  const open = useSidePanelStore((state) => state.panel?.kind === "settings");
  const openSettings = useSidePanelStore((state) => state.openSettings);
  const close = useSidePanelStore((state) => state.close);
  return (
    <button
      type="button"
      className="toolbar-button"
      onClick={() => (open ? close() : openSettings())}
      aria-label="Settings"
      aria-pressed={open}
      title="Settings"
    >
      <HiOutlineCog6Tooth />
    </button>
  );
}
