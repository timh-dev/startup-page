import React from "react";
import { useNavigate } from "react-router-dom";
import { HiChevronRight, HiMagnifyingGlass, HiOutlineBookOpen, HiPlus } from "react-icons/hi2";
import { VAULT_KIND_DEFS, VAULT_KIND_ORDER } from "@/features/resourceVault/constants";
import { useQuickAddStore, type VaultSection } from "@/features/resourceVault/stores/quickAddStore";

const LAUNCHER_TILES: Array<{ section: VaultSection; label: string; icon: typeof HiOutlineBookOpen; colorClass: string }> = [
  { section: "links", label: "Links", icon: HiOutlineBookOpen, colorClass: "read-tag-reference" },
  ...VAULT_KIND_ORDER.map((kind) => ({
    section: kind as VaultSection,
    label: VAULT_KIND_DEFS[kind].label,
    icon: VAULT_KIND_DEFS[kind].icon,
    colorClass: VAULT_KIND_DEFS[kind].colorClass,
  })),
];

export default function VaultLauncher() {
  const navigate = useNavigate();
  const [addMenuOpen, setAddMenuOpen] = React.useState(false);
  const addMenuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!addMenuOpen) {
      return undefined;
    }
    const handlePointerDown = (event: PointerEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(event.target as Node)) {
        setAddMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [addMenuOpen]);

  const openSection = (section: VaultSection) => {
    navigate("/resources", { state: { section } });
  };

  const quickAdd = (section: VaultSection) => {
    setAddMenuOpen(false);
    useQuickAddStore.getState().requestQuickAdd(section);
    navigate("/resources", { state: { section } });
  };

  return (
    <div className="vault-launcher">
      <div className="vault-launcher-header">
        <span className="eyebrow">Vault</span>
        <div className="vault-launcher-actions">
          <button
            type="button"
            className="vault-launcher-action"
            onClick={() => navigate("/resources", { state: { focusSearch: true } })}
            title="Search the vault"
            aria-label="Search the vault"
          >
            <HiMagnifyingGlass className="size-3.5" />
          </button>
          <div className="vault-launcher-add" ref={addMenuRef}>
            <button
              type="button"
              className="vault-launcher-action"
              onClick={() => setAddMenuOpen((current) => !current)}
              aria-expanded={addMenuOpen}
              aria-haspopup="listbox"
              title="Add to the vault"
              aria-label="Add to the vault"
            >
              <HiPlus className="size-3.5" />
            </button>
            {addMenuOpen && (
              <div className="vault-launcher-popover surface-glass" role="listbox" aria-label="Add to vault">
                {LAUNCHER_TILES.map(({ section, label, icon: Icon }) => (
                  <button
                    type="button"
                    key={section}
                    role="option"
                    className="vg-popover-option"
                    onClick={() => quickAdd(section)}
                  >
                    <Icon className="size-3.5" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <ul className="vault-launcher-list">
        {LAUNCHER_TILES.map(({ section, label, icon: Icon, colorClass }) => (
          <li key={section}>
            <button type="button" className="vault-launcher-row" onClick={() => openSection(section)} title={`Open ${label}`}>
              <span className={`vault-launcher-row-icon ${colorClass}`}>
                <Icon className="size-3.5" />
              </span>
              <span className="vault-launcher-row-label">{label}</span>
              <HiChevronRight className="vault-launcher-row-chevron size-3.5" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
