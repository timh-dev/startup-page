/*eslint-disable*/
import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { HiMapPin, HiOutlineBookOpen } from "react-icons/hi2";
import { useSettingsStore } from "@/features/settings/stores";
import VaultGlassView from "@/features/resourceVault/components/VaultGlassView";
import VaultItemsSection from "@/features/resourceVault/components/VaultItemsSection";
import { normalizeResourceVaultItems, normalizeVaultItems } from "@/features/resourceVault/utils";
import { VAULT_KIND_DEFS, VAULT_KIND_ORDER } from "@/features/resourceVault/constants";
import { useQuickAddStore, type VaultSection } from "@/features/resourceVault/stores/quickAddStore";
import type { VaultItem } from "@/features/resourceVault/types";
import LocationsSection from "@/features/locations/components/LocationsSection";
import { generateLocationId, normalizeLocations } from "@/features/locations/utils";
import type { LocationDraft } from "@/features/locations/components/LocationComposer";
import vaultPreviewBg from "@/assets/media/vault-preview-bg.jpg";

const VALID_SECTIONS: VaultSection[] = ["links", "locations", ...VAULT_KIND_ORDER];

function isValidSection(value: unknown): value is VaultSection {
  return VALID_SECTIONS.includes(value as VaultSection);
}

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
  const location = useLocation();
  const settings = useSettingsStore((state) => state.settings);
  const persistSettingsToStore = useSettingsStore((state) => state.persistSettings);

  const routedSection = (location.state as { section?: unknown } | null)?.section;
  const routedFocusSearch = Boolean((location.state as { focusSearch?: unknown } | null)?.focusSearch);
  const [activeSection, setActiveSection] = React.useState<VaultSection>(
    isValidSection(routedSection) ? routedSection : "links",
  );

  const persistSettings = async (nextSettings: any) => {
    await persistSettingsToStore(nextSettings);
  };

  // --- Links (readItems) ---------------------------------------------------

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

  // --- Vault items (snippets/commands/templates/expansions/prompts/docs) ---

  const handleAddVaultItem = async (item: Partial<VaultItem>) => {
    const current = useSettingsStore.getState().settings;
    const items = Array.isArray(current.vaultItems) ? current.vaultItems : [];
    const now = new Date().toISOString();
    const nextItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ...item,
      createdAt: now,
      updatedAt: now,
    };
    await persistSettings({ ...current, vaultItems: [nextItem, ...items] });
  };

  const handleUpdateVaultItem = async (itemId: string, nextItem: Partial<VaultItem>) => {
    const current = useSettingsStore.getState().settings;
    const items = Array.isArray(current.vaultItems) ? current.vaultItems : [];
    await persistSettings({
      ...current,
      vaultItems: items.map((item: any) =>
        item.id === itemId
          ? { ...item, ...nextItem, updatedAt: new Date().toISOString() }
          : item,
      ),
    });
  };

  const handleDeleteVaultItem = async (itemId: string) => {
    const current = useSettingsStore.getState().settings;
    const items = Array.isArray(current.vaultItems) ? current.vaultItems : [];
    await persistSettings({
      ...current,
      vaultItems: items.filter((item: any) => item.id !== itemId),
    });
  };

  const handleImportVaultItems = async (items: any) => {
    const current = useSettingsStore.getState().settings;
    const existing = Array.isArray(current.vaultItems) ? current.vaultItems : [];
    const incoming = normalizeVaultItems(items);
    const existingIds = new Set(existing.map((item: any) => item.id));
    const deduped = incoming.filter((item) => !existingIds.has(item.id));
    await persistSettings({ ...current, vaultItems: [...deduped, ...existing] });
  };

  const handleExportVaultItems = (kind: VaultItem["kind"]) => {
    const current = useSettingsStore.getState().settings;
    const items = normalizeVaultItems(current.vaultItems, kind);
    const payload = {
      version: 1,
      kind,
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
    anchor.download = `startup-page-vault-${kind}-${date}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  // --- Locations -------------------------------------------------------

  const handleAddLocation = async (draft: LocationDraft) => {
    const current = useSettingsStore.getState().settings;
    const existing = normalizeLocations(current.locations);
    const now = new Date().toISOString();
    const newLocation = { id: generateLocationId(), ...draft, createdAt: now, updatedAt: now };
    await persistSettings({ ...current, locations: [newLocation, ...existing] });
  };

  const handleUpdateLocation = async (locationId: string, draft: LocationDraft) => {
    const current = useSettingsStore.getState().settings;
    const existing = normalizeLocations(current.locations);
    await persistSettings({
      ...current,
      locations: existing.map((item) =>
        item.id === locationId ? { ...item, ...draft, updatedAt: new Date().toISOString() } : item,
      ),
    });
  };

  const handleDeleteLocation = async (locationId: string) => {
    const current = useSettingsStore.getState().settings;
    const existing = normalizeLocations(current.locations);
    await persistSettings({ ...current, locations: existing.filter((item) => item.id !== locationId) });
  };

  const quickAddPending = useQuickAddStore((state) => state.pending && state.section === activeSection);
  const consumeQuickAdd = useQuickAddStore((state) => state.consumeQuickAdd);

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
            <div className="vg-section-tabs" role="tablist" aria-label="Vault section">
              <button
                type="button"
                role="tab"
                aria-selected={activeSection === "links"}
                className={`vg-section-tab ${activeSection === "links" ? "vg-section-tab-active" : ""}`}
                onClick={() => setActiveSection("links")}
              >
                <HiOutlineBookOpen className="size-4" />
                Links
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeSection === "locations"}
                className={`vg-section-tab ${activeSection === "locations" ? "vg-section-tab-active" : ""}`}
                onClick={() => setActiveSection("locations")}
              >
                <HiMapPin className="size-4" />
                Locations
              </button>
              {VAULT_KIND_ORDER.map((kind) => {
                const def = VAULT_KIND_DEFS[kind];
                const Icon = def.icon;
                return (
                  <button
                    type="button"
                    key={kind}
                    role="tab"
                    aria-selected={activeSection === kind}
                    className={`vg-section-tab ${activeSection === kind ? "vg-section-tab-active" : ""}`}
                    onClick={() => setActiveSection(kind)}
                  >
                    <Icon className="size-4" />
                    {def.label}
                  </button>
                );
              })}
            </div>

            {activeSection === "links" ? (
              <VaultGlassView
                items={settings.readItems}
                onBack={() => navigate("/")}
                onAddItem={handleAddReadItem}
                onExportItems={handleExportReadItems}
                onImportItems={handleImportReadItems}
                onToggleItem={handleToggleReadItem}
                onUpdateItem={handleUpdateReadItem}
                onDeleteItem={handleDeleteReadItem}
                autoFocusSearch={routedFocusSearch}
              />
            ) : activeSection === "locations" ? (
              <LocationsSection
                locations={normalizeLocations(settings.locations)}
                googleMapsCredential={settings.googleMapsCredential || null}
                onBack={() => navigate("/")}
                onAddItem={handleAddLocation}
                onUpdateItem={handleUpdateLocation}
                onDeleteItem={handleDeleteLocation}
              />
            ) : (
              <VaultItemsSection
                kind={activeSection}
                items={settings.vaultItems}
                onBack={() => navigate("/")}
                onAddItem={handleAddVaultItem}
                onUpdateItem={handleUpdateVaultItem}
                onDeleteItem={handleDeleteVaultItem}
                onExportItems={() => handleExportVaultItems(activeSection)}
                onImportItems={handleImportVaultItems}
                quickAddPending={quickAddPending}
                onQuickAddConsumed={consumeQuickAdd}
                autoFocusSearch={routedFocusSearch}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
