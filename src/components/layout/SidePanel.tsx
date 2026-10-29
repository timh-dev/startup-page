import React from "react";
import { HiXMark } from "react-icons/hi2";

import { useSidePanelStore } from "./sidePanelStore";

const SettingsPanel = React.lazy(() => import("@/features/settings/components/SettingsPanel"));
const WidgetGallery = React.lazy(() => import("@/features/dashboard/components/WidgetGallery"));
const WidgetInspector = React.lazy(() => import("@/features/dashboard/components/WidgetInspector"));

/** The frame shared by everything shown in the side panel. */
export function PanelFrame({ title, subtitle, icon, children, footer }: { title: React.ReactNode; subtitle?: React.ReactNode; icon?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode }) {
  const close = useSidePanelStore((state) => state.close);
  return (
    <>
      <header className="side-panel-header">
        {icon && <span className="side-panel-icon">{icon}</span>}
        <div className="min-w-0 flex-1">
          <h2 className="side-panel-title">{title}</h2>
          {subtitle && <p className="side-panel-subtitle">{subtitle}</p>}
        </div>
        <button type="button" className="side-panel-close" onClick={close} aria-label="Close panel" title="Close (Esc)">
          <HiXMark className="size-4" />
        </button>
      </header>
      <div className="side-panel-body">{children}</div>
      {footer && <footer className="side-panel-footer">{footer}</footer>}
    </>
  );
}

/**
 * The panel on the right of the dashboard: settings, the widget gallery, or
 * a card's inspector. Non-modal, so changes show live beside it and the
 * dashboard stays usable (the grid makes room for it).
 */
export default function SidePanel() {
  const panel = useSidePanelStore((state) => state.panel);
  const close = useSidePanelStore((state) => state.close);

  // Esc closes the panel (the dashboard handles Esc itself in edit mode).
  React.useEffect(() => {
    if (!panel) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (panel.kind === "settings") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel, close]);

  if (!panel) return null;
  return (
    <aside className="side-panel surface-glass" aria-label="Side panel" key={panel.kind}>
      <React.Suspense fallback={null}>
        {panel.kind === "settings" && <SettingsPanel section={panel.section} />}
        {panel.kind === "gallery" && <WidgetGallery />}
        {panel.kind === "widget" && <WidgetInspector id={panel.id} />}
      </React.Suspense>
    </aside>
  );
}
