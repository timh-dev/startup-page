import React from "react";
import { HiChevronRight, HiOutlineListBullet, HiOutlineMapPin, HiPlus } from "react-icons/hi2";
import PlaceSearchComposer from "@/features/places/components/PlaceSearchComposer";
import PlacesListView from "@/features/places/components/PlacesListView";
import PlacesMapView from "@/features/places/components/PlacesMapView";
import { normalizePlaces } from "@/features/places/utils";
import type { Place } from "@/features/places/types";

type PlacesViewMode = "list" | "map";

interface PlacesSectionProps {
  places: unknown;
  onBack: () => void;
  onAddPlace: (place: Partial<Place>) => void;
  onUpdatePlace: (id: string, place: Partial<Place>) => void;
  onDeletePlace: (id: string) => void;
  onExportPlaces: () => void;
  onImportPlaces: (items: unknown) => Promise<void> | void;
  quickAddPending?: boolean;
  onQuickAddConsumed?: () => void;
  autoFocusSearch?: boolean;
}

export default function PlacesSection({
  places,
  onBack,
  onAddPlace,
  onUpdatePlace,
  onDeletePlace,
  onExportPlaces,
  onImportPlaces,
  quickAddPending,
  onQuickAddConsumed,
  autoFocusSearch,
}: PlacesSectionProps) {
  const [viewMode, setViewMode] = React.useState<PlacesViewMode>("list");
  const [composerOpen, setComposerOpen] = React.useState(false);
  const [editingPlace, setEditingPlace] = React.useState<Place | null>(null);

  const normalizedPlaces = React.useMemo(() => normalizePlaces(places), [places]);

  React.useEffect(() => {
    if (!quickAddPending) {
      return;
    }
    setEditingPlace(null);
    setComposerOpen(true);
    onQuickAddConsumed?.();
  }, [quickAddPending, onQuickAddConsumed]);

  const openComposer = () => {
    setEditingPlace(null);
    setComposerOpen(true);
  };

  const editPlace = (place: Place) => {
    setEditingPlace(place);
    setComposerOpen(true);
  };

  const closeComposer = () => {
    setComposerOpen(false);
    setEditingPlace(null);
  };

  const submitComposer = (draft: Partial<Place>) => {
    if (editingPlace) {
      onUpdatePlace(editingPlace.id, draft);
    } else {
      onAddPlace(draft);
    }
    closeComposer();
  };

  return (
    <div className="vg-view">
      <header className="vg-header">
        <div>
          <p className="vg-eyebrow">Resource Vault</p>
          <h1 className="vg-title">
            {normalizedPlaces.length} {normalizedPlaces.length === 1 ? "place" : "places"} saved
          </h1>
        </div>
        <button type="button" className="vg-back" onClick={onBack} title="Back to dashboard">
          <HiChevronRight className="size-4" />
        </button>
      </header>

      {!composerOpen && (
        <button type="button" className="vg-add-trigger" onClick={openComposer}>
          <HiPlus className="size-4" />
          Add a place
        </button>
      )}

      {composerOpen && (
        <PlaceSearchComposer
          key={editingPlace?.id ?? "new"}
          editingPlace={editingPlace}
          onSubmit={submitComposer}
          onCancel={closeComposer}
          autoFocus
        />
      )}

      <div className="vg-tabs" role="tablist" aria-label="Places view">
        <button
          type="button"
          role="tab"
          aria-selected={viewMode === "list"}
          className={`vg-tab ${viewMode === "list" ? "vg-tab-active" : ""}`}
          onClick={() => setViewMode("list")}
        >
          <HiOutlineListBullet className="size-4" /> List
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={viewMode === "map"}
          className={`vg-tab ${viewMode === "map" ? "vg-tab-active" : ""}`}
          onClick={() => setViewMode("map")}
        >
          <HiOutlineMapPin className="size-4" /> Map
        </button>
      </div>

      {viewMode === "list" ? (
        <PlacesListView
          places={normalizedPlaces}
          onEditPlace={editPlace}
          onDeletePlace={onDeletePlace}
          onExportPlaces={onExportPlaces}
          onImportPlaces={onImportPlaces}
          autoFocusSearch={autoFocusSearch}
        />
      ) : (
        <PlacesMapView places={normalizedPlaces} />
      )}
    </div>
  );
}
