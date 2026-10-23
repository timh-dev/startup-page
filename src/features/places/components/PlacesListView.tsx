import React from "react";
import {
  HiArrowDownTray,
  HiArrowUpTray,
  HiArrowsUpDown,
  HiChevronDown,
  HiMagnifyingGlass,
  HiOutlineMapPin,
  HiOutlineMagnifyingGlassCircle,
  HiPencil,
  HiTrash,
  HiXMark,
} from "react-icons/hi2";
import { PLACE_TAGS, PLACE_TAG_COLORS, PLACE_TAG_ICONS } from "@/features/places/constants";
import { formatItemDate, groupItemsByDate } from "@/features/resourceVault/utils";
import type { Place } from "@/features/places/types";

const UNDO_DELETE_DELAY_MS = 5000;

interface PlaceRowProps {
  place: Place;
  onEdit: (place: Place) => void;
  onDelete: (place: Place) => void;
}

function PlaceRow({ place, onEdit, onDelete }: PlaceRowProps) {
  const Icon = PLACE_TAG_ICONS[place.tag] || HiOutlineMapPin;

  return (
    <li className={`vg-item ${PLACE_TAG_COLORS[place.tag] || ""} group/vg-item`}>
      <span className="vg-place-item-icon" aria-hidden="true">
        <Icon className="size-3.5" />
      </span>
      <span className="vg-item-main">
        <span className="vg-item-title">{place.name}</span>
      </span>
      {place.address && <span className="vg-item-description vg-place-item-address">{place.address}</span>}
      <span className="vg-item-rule" aria-hidden="true" />
      <span className="vg-item-tag">{place.tag}</span>
      <span className="vg-item-date">{formatItemDate(place.createdAt)}</span>
      <span className="vg-item-actions">
        <button type="button" className="vg-item-action" onClick={() => onEdit(place)} title="Edit place">
          <HiPencil className="size-3.5" />
        </button>
        <button type="button" className="vg-item-action" onClick={() => onDelete(place)} title="Delete place">
          <HiTrash className="size-3.5" />
        </button>
      </span>
    </li>
  );
}

interface PlacesListViewProps {
  places: Place[];
  onEditPlace: (place: Place) => void;
  onDeletePlace: (id: string) => void;
  onExportPlaces: () => void;
  onImportPlaces: (items: unknown) => Promise<void> | void;
  autoFocusSearch?: boolean;
}

export default function PlacesListView({
  places,
  onEditPlace,
  onDeletePlace,
  onExportPlaces,
  onImportPlaces,
  autoFocusSearch,
}: PlacesListViewProps) {
  const importInputRef = React.useRef<HTMLInputElement>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const filterMenuRef = React.useRef<HTMLDivElement>(null);
  const [query, setQuery] = React.useState("");
  const [activeTag, setActiveTag] = React.useState("All");
  const [sortDirection, setSortDirection] = React.useState("desc");
  const [filterMenuOpen, setFilterMenuOpen] = React.useState(false);
  const [pendingDeleteIds, setPendingDeleteIds] = React.useState<Set<string>>(new Set());
  const [deleteToasts, setDeleteToasts] = React.useState<Array<{ id: string; name: string }>>([]);
  const deleteTimersRef = React.useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [importMessage, setImportMessage] = React.useState("");

  React.useEffect(() => {
    return () => {
      Object.values(deleteTimersRef.current).forEach(clearTimeout);
    };
  }, []);

  React.useEffect(() => {
    if (autoFocusSearch) {
      searchInputRef.current?.focus();
    }
  }, [autoFocusSearch]);

  const normalizedPlaces = React.useMemo(
    () => places.filter((place) => !pendingDeleteIds.has(place.id)),
    [places, pendingDeleteIds],
  );

  const tagCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    for (const place of normalizedPlaces) {
      counts[place.tag] = (counts[place.tag] || 0) + 1;
    }
    return counts;
  }, [normalizedPlaces]);

  const visiblePlaces = React.useMemo(() => {
    const lowerQuery = query.trim().toLowerCase();

    return normalizedPlaces
      .filter((place) => {
        const matchesQuery = !lowerQuery || [place.name, place.address, place.notes, place.tag].some((value) =>
          String(value || "").toLowerCase().includes(lowerQuery),
        );
        const matchesTag = activeTag === "All" || place.tag === activeTag;
        return matchesQuery && matchesTag;
      })
      .sort((a, b) => {
        const aTime = new Date(a.createdAt || 0).getTime();
        const bTime = new Date(b.createdAt || 0).getTime();
        return sortDirection === "desc" ? bTime - aTime : aTime - bTime;
      });
  }, [activeTag, normalizedPlaces, query, sortDirection]);

  const groups = React.useMemo(
    () => groupItemsByDate(visiblePlaces, (place: Place) => place.createdAt),
    [visiblePlaces],
  );

  const pickFilterTag = (tag: string) => {
    setActiveTag(tag);
    setFilterMenuOpen(false);
  };

  React.useEffect(() => {
    if (!filterMenuOpen) {
      return undefined;
    }
    const handlePointerDown = (event: PointerEvent) => {
      if (filterMenuRef.current && !filterMenuRef.current.contains(event.target as Node)) {
        setFilterMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [filterMenuOpen]);

  const deletePlaceWithUndo = (place: Place) => {
    setPendingDeleteIds((current) => new Set(current).add(place.id));
    setDeleteToasts((current) => [...current, { id: place.id, name: place.name }]);

    deleteTimersRef.current[place.id] = setTimeout(() => {
      delete deleteTimersRef.current[place.id];
      setDeleteToasts((current) => current.filter((toast) => toast.id !== place.id));
      setPendingDeleteIds((current) => {
        const next = new Set(current);
        next.delete(place.id);
        return next;
      });
      onDeletePlace(place.id);
    }, UNDO_DELETE_DELAY_MS);
  };

  const undoDelete = (placeId: string) => {
    const timer = deleteTimersRef.current[placeId];
    if (timer) {
      clearTimeout(timer);
      delete deleteTimersRef.current[placeId];
    }
    setDeleteToasts((current) => current.filter((toast) => toast.id !== placeId));
    setPendingDeleteIds((current) => {
      const next = new Set(current);
      next.delete(placeId);
      return next;
    });
  };

  const importFile = async (file: File) => {
    if (!file) {
      return;
    }
    try {
      await onImportPlaces(JSON.parse(await file.text()));
      setImportMessage("Import complete.");
    } catch (_error) {
      setImportMessage("Could not import that JSON file.");
    }
  };

  return (
    <div className="vg-view">
      <input
        ref={importInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={async (event) => {
          const [file] = Array.from(event.target.files || []);
          event.target.value = "";
          await importFile(file);
        }}
      />

      <div className="vg-toolbar">
        <label className="vg-search">
          <HiMagnifyingGlass className="size-4" />
          <input
            ref={searchInputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search places..."
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} title="Clear search">
              <HiXMark className="size-3.5" />
            </button>
          )}
        </label>

        <div className="vg-tag-filter" ref={filterMenuRef}>
          <button
            type="button"
            className="vg-tool-btn"
            aria-expanded={filterMenuOpen}
            aria-haspopup="listbox"
            onClick={() => setFilterMenuOpen((current) => !current)}
          >
            {activeTag !== "All" && <span className={`read-tag-dot ${PLACE_TAG_COLORS[activeTag] || "bg-primary"}`} />}
            <span>{activeTag}</span>
            <HiChevronDown className="size-3.5" />
          </button>
          {filterMenuOpen && (
            <div className="vg-popover" role="listbox" aria-label="Filter by tag">
              <button
                type="button"
                role="option"
                aria-selected={activeTag === "All"}
                className={`vg-popover-option ${activeTag === "All" ? "vg-popover-option-active" : ""}`}
                onClick={() => pickFilterTag("All")}
              >
                <span>All</span>
                <span className="vg-count">{normalizedPlaces.length}</span>
              </button>
              {PLACE_TAGS.filter((tag) => tagCounts[tag]).map((tag) => (
                <button
                  type="button"
                  key={tag}
                  role="option"
                  aria-selected={activeTag === tag}
                  className={`vg-popover-option ${activeTag === tag ? "vg-popover-option-active" : ""}`}
                  onClick={() => pickFilterTag(tag)}
                >
                  <span className={`read-tag-dot ${PLACE_TAG_COLORS[tag] || "bg-primary"}`} />
                  <span>{tag}</span>
                  <span className="vg-count">{tagCounts[tag]}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          className="vg-tool-btn"
          onClick={() => setSortDirection((current) => (current === "desc" ? "asc" : "desc"))}
          title={sortDirection === "desc" ? "Newest first" : "Oldest first"}
        >
          <HiArrowsUpDown className="size-4" />
        </button>

        <div className="vg-tool-group">
          <button type="button" className="vg-tool-btn" onClick={() => importInputRef.current?.click()} title="Import JSON">
            <HiArrowUpTray className="size-4" />
          </button>
          <button type="button" className="vg-tool-btn" onClick={onExportPlaces} title="Export JSON">
            <HiArrowDownTray className="size-4" />
          </button>
        </div>
      </div>

      {importMessage && <p className="vg-import-message">{importMessage}</p>}

      <div className="vg-groups" role="tabpanel">
        {groups.length ? (
          groups.map((group) => (
            <section key={group.label} className="vg-group">
              <h2 className="vg-group-label">
                {group.label}
                <span>{group.items.length}</span>
              </h2>
              <ul className="vg-list">
                {group.items.map((place: Place) => (
                  <PlaceRow key={place.id} place={place} onEdit={onEditPlace} onDelete={deletePlaceWithUndo} />
                ))}
              </ul>
            </section>
          ))
        ) : (
          <div className="vg-empty">
            {query.trim() || activeTag !== "All" ? (
              <>
                <HiOutlineMagnifyingGlassCircle className="vg-empty-icon" />
                <p className="vg-empty-title">No matches</p>
                <p className="vg-empty-hint">Try a different search term or tag.</p>
              </>
            ) : (
              <>
                <HiOutlineMapPin className="vg-empty-icon" />
                <p className="vg-empty-title">No places saved yet</p>
                <p className="vg-empty-hint">Search for a city, cafe, park, or trail above to start your map.</p>
              </>
            )}
          </div>
        )}
      </div>

      {deleteToasts.length > 0 && (
        <div className="vg-toast-stack">
          {deleteToasts.map((toast) => (
            <div key={toast.id} className="vg-toast">
              <span className="vg-toast-text">Deleted "{toast.name}"</span>
              <button type="button" className="vg-toast-undo" onClick={() => undoDelete(toast.id)}>
                Undo
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
