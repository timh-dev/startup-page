import React from "react";
import { HiChevronRight, HiMagnifyingGlass, HiOutlineMapPin, HiPlus } from "react-icons/hi2";

import { useQuickAddStore } from "@/features/resourceVault/stores/quickAddStore";
import { CONTINENTS } from "../constants";
import type { LocationItem } from "../types";
import LocationCard from "./LocationCard";
import LocationComposer, { type LocationDraft } from "./LocationComposer";

interface LocationsSectionProps {
  locations: LocationItem[];
  googleMapsCredential: string | null;
  onBack: () => void;
  onAddItem: (draft: LocationDraft) => void;
  onUpdateItem: (id: string, draft: LocationDraft) => void;
  onDeleteItem: (id: string) => void;
}

export default function LocationsSection({
  locations,
  googleMapsCredential,
  onBack,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
}: LocationsSectionProps) {
  const [query, setQuery] = React.useState("");
  const [continentFilter, setContinentFilter] = React.useState("All");
  const [composerOpen, setComposerOpen] = React.useState(false);
  const [editingLocation, setEditingLocation] = React.useState<LocationItem | null>(null);

  const quickAddPending = useQuickAddStore((state) => state.pending && state.section === "locations");
  const consumeQuickAdd = useQuickAddStore((state) => state.consumeQuickAdd);

  React.useEffect(() => {
    if (!quickAddPending) {
      return;
    }
    setEditingLocation(null);
    setComposerOpen(true);
    consumeQuickAdd();
  }, [quickAddPending, consumeQuickAdd]);

  const openComposerForAdd = () => {
    setEditingLocation(null);
    setComposerOpen(true);
  };

  const openComposerForEdit = (location: LocationItem) => {
    setEditingLocation(location);
    setComposerOpen(true);
  };

  const handleSubmit = (draft: LocationDraft) => {
    if (editingLocation) {
      onUpdateItem(editingLocation.id, draft);
    } else {
      onAddItem(draft);
    }
    setComposerOpen(false);
    setEditingLocation(null);
  };

  const filteredLocations = locations.filter((location) => {
    if (continentFilter !== "All" && location.continent !== continentFilter) {
      return false;
    }
    const trimmedQuery = query.trim().toLowerCase();
    if (!trimmedQuery) {
      return true;
    }
    const haystack = [location.name, location.park, location.country, location.continent, ...location.tags]
      .join(" ")
      .toLowerCase();
    return haystack.includes(trimmedQuery);
  });

  return (
    <div className="vg-view">
      <header className="vg-header">
        <div>
          <p className="vg-eyebrow">Vault</p>
          <h1 className="vg-title">
            {filteredLocations.length} of {locations.length} places
          </h1>
        </div>
        <button type="button" className="vg-back" onClick={onBack} title="Back to dashboard">
          <HiChevronRight className="size-4" />
        </button>
      </header>

      <div className="vg-toolbar">
        <label className="vg-search">
          <HiMagnifyingGlass className="size-4" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name, park, country, tag..."
          />
        </label>
        <div className="vg-tool-group">
          <select
            value={continentFilter}
            onChange={(event) => setContinentFilter(event.target.value)}
            className="vg-tool-btn"
          >
            <option value="All">All continents</option>
            {CONTINENTS.map((continent) => (
              <option key={continent} value={continent}>
                {continent}
              </option>
            ))}
          </select>
          <button type="button" className="vg-tool-btn" onClick={openComposerForAdd}>
            <HiPlus className="size-4" />
            Add location
          </button>
        </div>
      </div>

      {filteredLocations.length > 0 ? (
        <div className="loc-grid">
          {filteredLocations.map((location) => (
            <LocationCard
              key={location.id}
              location={location}
              googleMapsCredential={googleMapsCredential}
              onEdit={openComposerForEdit}
              onDelete={(item) => onDeleteItem(item.id)}
            />
          ))}
        </div>
      ) : (
        <div className="vg-empty">
          <HiOutlineMapPin className="vg-empty-icon size-8" />
          <p className="vg-empty-title">{locations.length === 0 ? "No locations yet" : "No matches"}</p>
          <p className="vg-empty-hint">
            {locations.length === 0
              ? "Add a place by name — we'll find its coordinates and Wikipedia article automatically."
              : "Try a different search or continent filter."}
          </p>
        </div>
      )}

      <LocationComposer
        open={composerOpen}
        onOpenChange={(nextOpen) => {
          setComposerOpen(nextOpen);
          if (!nextOpen) {
            setEditingLocation(null);
          }
        }}
        editingLocation={editingLocation}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
