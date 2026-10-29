import { useSidePanelStore } from "@/components/layout/sidePanelStore";
import { useLayoutEditStore } from "@/features/dashboard/stores/layoutEditStore";

/** "API key: set" or a link to Settings › Connections, for cards that need one. */
export function ConnectionsLink({ name, isSet }: { name: string; isSet: boolean }) {
  const openSettings = useSidePanelStore((state) => state.openSettings);
  return (
    <p className="text-xs text-muted-foreground">
      {name} API key: {isSet ? "set" : "not set"} ·{" "}
      <button
        type="button"
        className="settings-link"
        onClick={() => {
          useLayoutEditStore.getState().select(null);
          openSettings("connections");
        }}
      >
        {isSet ? "Change in Settings" : "Add in Settings"}
      </button>
    </p>
  );
}
