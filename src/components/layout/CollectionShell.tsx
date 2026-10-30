import React from "react";
import { HiEllipsisHorizontal, HiMagnifyingGlass, HiXMark } from "react-icons/hi2";

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { sceneWallpaper } from "@/features/scenes/scenes";
import { useSettingsStore } from "@/features/settings/stores";

// The shell the Vault and Bookmarks pages share: the theme's painting behind, a
// frosted sidebar (search, sections, folders or tags) and a content pane
// that scrolls on its own. On narrow screens the sidebar becomes a strip of
// chips above the content.

interface CollectionShellProps {
  /** Names the page's landmark ("Vault", "Bookmarks"). */
  label: string;
  rail: React.ReactNode;
  children: React.ReactNode;
  /** Scrolls the content pane (e.g. to jump to a folder). */
  scrollRef?: React.Ref<HTMLDivElement>;
}

export default function CollectionShell({ label, rail, children, scrollRef }: CollectionShellProps) {
  // The painting comes from the theme.
  const scene = useSettingsStore((state) => state.settings.ui?.scene);
  return (
    <div className="vault-preview-scene" style={{ backgroundImage: `url(${sceneWallpaper(scene)})` }}>
      <div className="vault-preview-scrim" />
      <div className="collection" aria-label={label}>
        <nav className="collection-rail" aria-label={`${label} sections`}>
          {rail}
        </nav>
        <main className="collection-main">
          <div ref={scrollRef} className="collection-main-scroll">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export function RailSearch({
  value,
  onChange,
  placeholder,
  inputRef,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  return (
    <label className="rail-search">
      <HiMagnifyingGlass className="size-4" aria-hidden="true" />
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && value) {
            event.stopPropagation();
            onChange("");
          }
        }}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      {value && (
        <button type="button" onClick={() => onChange("")} aria-label="Clear search" title="Clear search">
          <HiXMark className="size-3.5" />
        </button>
      )}
    </label>
  );
}

export function RailGroup({ title, action, children }: { title?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rail-group" role="group" aria-label={title}>
      {(title || action) && (
        <div className="rail-group-head">
          {title && <span>{title}</span>}
          {action}
        </div>
      )}
      <ul>{children}</ul>
    </div>
  );
}

interface RailItemProps {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  /** A colour dot instead of an icon (tags); the class sets --read-tag-color. */
  dotClass?: string;
  count?: number;
  active?: boolean;
  depth?: number;
  onClick: () => void;
}

export function RailItem({ label, icon: Icon, dotClass, count, active, depth = 0, onClick }: RailItemProps) {
  return (
    <li>
      <button
        type="button"
        className="rail-item"
        data-active={active || undefined}
        aria-current={active ? "page" : undefined}
        style={depth ? { paddingLeft: `${0.65 + depth * 0.85}rem` } : undefined}
        onClick={onClick}
      >
        {Icon ? <Icon className="rail-item-icon" /> : dotClass ? <span className={`rail-item-dot ${dotClass}`} aria-hidden="true" /> : null}
        <span className="rail-item-label">{label}</span>
        {count !== undefined && <span className="rail-item-count numeric">{count}</span>}
      </button>
    </li>
  );
}

export function CollectionHeader({
  eyebrow,
  title,
  count,
  children,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  count?: number;
  /** Actions on the right. */
  children?: React.ReactNode;
}) {
  return (
    <header className="collection-header">
      <div className="collection-heading">
        {eyebrow && <p className="collection-eyebrow">{eyebrow}</p>}
        <h1 className="collection-title">
          {title}
          {count !== undefined && <span className="collection-count numeric">{count}</span>}
        </h1>
      </div>
      {children && <div className="collection-actions">{children}</div>}
    </header>
  );
}

export interface MoreMenuItem {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  onSelect: () => void;
  destructive?: boolean;
  /** Draw a divider above this item. */
  separated?: boolean;
}

/** A "⋯" button with a menu of less common actions (import, export, rename…). */
export function MoreMenu({ label, items, className = "collection-icon-btn" }: { label: string; items: MoreMenuItem[]; className?: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={className} aria-label={label} title={label}>
          <HiEllipsisHorizontal className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {items.map(({ label: itemLabel, icon: Icon, onSelect, destructive, separated }) => (
          <React.Fragment key={itemLabel}>
            {separated && <DropdownMenuSeparator />}
            <DropdownMenuItem destructive={destructive} onSelect={onSelect}>
              {Icon && <Icon className="size-3.5" />} {itemLabel}
            </DropdownMenuItem>
          </React.Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
