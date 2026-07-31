/*eslint-disable*/
import { useNavigate } from "react-router-dom";
import { useSettingsStore } from "@/features/settings/stores";
import VaultGlassView from "@/features/resourceVault/components/VaultGlassView";
import { normalizeResourceVaultItems } from "@/features/resourceVault/utils";
import vaultPreviewBg from "@/assets/media/vault-preview-bg.jpg";

// Fiber-grain texture for the paper card (see .vault-preview-paper::before /
// ::after) — feTurbulence gives the irregular fiber noise, feDiffuseLighting
// turns that into subtle raised/recessed shading instead of flat static, so
// it reads as paper grain rather than a screen-door noise overlay.
function PaperFiberFilters() {
  return (
    <svg aria-hidden="true" className="absolute h-0 w-0 overflow-hidden">
      <filter id="vault-paper-fibers" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={4} seed={11} result="n" />
        <feDiffuseLighting in="n" lightingColor="#ffffff" surfaceScale={1.5} result="l">
          <feDistantLight azimuth={238} elevation={58} />
        </feDiffuseLighting>
      </filter>
      <filter id="vault-paper-fibers-fine" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="1.9" numOctaves={3} seed={4} result="n" />
        <feDiffuseLighting in="n" lightingColor="#ffffff" surfaceScale={1.1}>
          <feDistantLight azimuth={225} elevation={62} />
        </feDiffuseLighting>
      </filter>
    </svg>
  );
}

// Renders inside AppLayout, which already mounts ThemeProvider and the
// persistent nav/theme-toggle/settings chrome — this page only needs to
// supply the scenic background + paper card + vault UI, not its own theme
// wiring or back/theme controls.
export default function ResourceVaultPage() {
  const navigate = useNavigate();
  const settings = useSettingsStore((state) => state.settings);
  const persistSettingsToStore = useSettingsStore((state) => state.persistSettings);

  const persistSettings = async (nextSettings: any) => {
    await persistSettingsToStore(nextSettings);
  };

  const handleAddReadItem = async (item: any) => {
    const current = useSettingsStore.getState().settings;
    const items = Array.isArray(current.readItems) ? current.readItems : [];
    const nextItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: item.title,
      description: item.description,
      url: item.url,
      tag: item.tag,
      status: "todo",
      createdAt: new Date().toISOString(),
    };
    await persistSettings({ ...current, readItems: [nextItem, ...items] });
  };

  const handleToggleReadItem = async (itemId: string) => {
    const current = useSettingsStore.getState().settings;
    const items = Array.isArray(current.readItems) ? current.readItems : [];
    await persistSettings({
      ...current,
      readItems: items.map((item: any) =>
        item.id === itemId
          ? {
              ...item,
              status: item.status === "done" ? "todo" : "done",
              completedAt: item.status === "done" ? null : new Date().toISOString(),
            }
          : item,
      ),
    });
  };

  const handleUpdateReadItem = async (itemId: string, nextItem: any) => {
    const current = useSettingsStore.getState().settings;
    const items = Array.isArray(current.readItems) ? current.readItems : [];
    await persistSettings({
      ...current,
      readItems: items.map((item: any) =>
        item.id === itemId
          ? {
              ...item,
              title: nextItem.title,
              description: nextItem.description,
              url: nextItem.url,
              tag: nextItem.tag,
            }
          : item,
      ),
    });
  };

  const handleDeleteReadItem = async (itemId: string) => {
    const current = useSettingsStore.getState().settings;
    const items = Array.isArray(current.readItems) ? current.readItems : [];
    await persistSettings({
      ...current,
      readItems: items.filter((item: any) => item.id !== itemId),
    });
  };

  const handleImportReadItems = async (items: any) => {
    const current = useSettingsStore.getState().settings;
    await persistSettings({ ...current, readItems: normalizeResourceVaultItems(items) });
  };

  const handleExportReadItems = () => {
    const current = useSettingsStore.getState().settings;
    const items = normalizeResourceVaultItems(current.readItems);
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      items,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    anchor.href = url;
    anchor.download = `startup-page-resource-vault-${date}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="vault-preview-scene"
      style={{ backgroundImage: `url(${vaultPreviewBg})` }}
    >
      <div className="vault-preview-scrim" />
      <PaperFiberFilters />

      <div className="vault-preview-stage">
        <div className="vault-preview-paper">
          <div className="vault-preview-paper-scroll">
            <VaultGlassView
              items={settings.readItems}
              onBack={() => navigate("/")}
              onAddItem={handleAddReadItem}
              onExportItems={handleExportReadItems}
              onImportItems={handleImportReadItems}
              onToggleItem={handleToggleReadItem}
              onUpdateItem={handleUpdateReadItem}
              onDeleteItem={handleDeleteReadItem}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
