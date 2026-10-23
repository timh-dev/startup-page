import React from "react";
import { HiCheck, HiChevronUpDown, HiMagnifyingGlass, HiPlus, HiXMark } from "react-icons/hi2";
import { PLACE_TAGS, PLACE_TAG_COLORS } from "@/features/places/constants";
import { searchPlaces } from "@/features/places/api";
import type { Place, PlaceCandidate, PlaceTag } from "@/features/places/types";

const SEARCH_DEBOUNCE_MS = 400;

interface Draft {
  name: string;
  tag: PlaceTag;
  notes: string;
  address: string;
  lat: string;
  lng: string;
  source: "search" | "manual";
  osmId: string | null;
}

function blankDraft(): Draft {
  return { name: "", tag: "Other", notes: "", address: "", lat: "", lng: "", source: "manual", osmId: null };
}

function draftFromPlace(place: Place): Draft {
  return {
    name: place.name,
    tag: place.tag,
    notes: place.notes,
    address: place.address,
    lat: String(place.lat),
    lng: String(place.lng),
    source: place.source,
    osmId: place.osmId,
  };
}

interface PlaceSearchComposerProps {
  editingPlace: Place | null;
  onSubmit: (place: Partial<Place>) => void;
  onCancel: () => void;
  autoFocus?: boolean;
}

export default function PlaceSearchComposer({ editingPlace, onSubmit, onCancel, autoFocus }: PlaceSearchComposerProps) {
  const [draft, setDraft] = React.useState<Draft>(() => (editingPlace ? draftFromPlace(editingPlace) : blankDraft()));
  const [manualMode, setManualMode] = React.useState(Boolean(editingPlace));
  const [query, setQuery] = React.useState("");
  const [candidates, setCandidates] = React.useState<PlaceCandidate[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [candidatesOpen, setCandidatesOpen] = React.useState(false);
  const [tagMenuOpen, setTagMenuOpen] = React.useState(false);
  const tagMenuRef = React.useRef<HTMLDivElement>(null);
  const searchWrapRef = React.useRef<HTMLDivElement>(null);
  const nameInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (manualMode || !query.trim()) {
      setCandidates([]);
      setCandidatesOpen(false);
      return undefined;
    }

    let ignore = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      const results = await searchPlaces(query);
      if (!ignore) {
        setCandidates(results);
        setCandidatesOpen(true);
        setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [query, manualMode]);

  React.useEffect(() => {
    if (!tagMenuOpen && !candidatesOpen) {
      return undefined;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (tagMenuOpen && tagMenuRef.current && !tagMenuRef.current.contains(event.target as Node)) {
        setTagMenuOpen(false);
      }
      if (candidatesOpen && searchWrapRef.current && !searchWrapRef.current.contains(event.target as Node)) {
        setCandidatesOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setTagMenuOpen(false);
        setCandidatesOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [tagMenuOpen, candidatesOpen]);

  const pickCandidate = (candidate: PlaceCandidate) => {
    setDraft({
      name: candidate.name,
      tag: PLACE_TAGS.includes(candidate.tag as PlaceTag) ? (candidate.tag as PlaceTag) : "Other",
      notes: "",
      address: candidate.address,
      lat: String(candidate.lat),
      lng: String(candidate.lng),
      source: "search",
      osmId: candidate.osmId,
    });
    setQuery(candidate.name);
    setCandidatesOpen(false);
    setManualMode(true); // reveal the confirm/edit fields once something is picked
  };

  const pickTag = (tag: PlaceTag) => {
    setDraft((current) => ({ ...current, tag }));
    setTagMenuOpen(false);
  };

  const startManualEntry = () => {
    setDraft((current) => ({ ...current, name: query || current.name, source: "manual", osmId: null }));
    setManualMode(true);
    setCandidatesOpen(false);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const name = draft.name.trim();
    const lat = Number(draft.lat);
    const lng = Number(draft.lng);

    if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return;
    }

    onSubmit({
      name,
      tag: draft.tag,
      notes: draft.notes.trim(),
      address: draft.address.trim(),
      lat,
      lng,
      source: draft.source,
      osmId: draft.osmId,
    });
  };

  return (
    <form className="vg-composer" onSubmit={submit}>
      {!manualMode ? (
        <div className="vg-search-composer-wrap" ref={searchWrapRef}>
          <label className="vg-search vg-composer-search">
            <HiMagnifyingGlass className="size-4" />
            <input
              autoFocus={autoFocus}
              ref={nameInputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onFocus={() => candidates.length > 0 && setCandidatesOpen(true)}
              placeholder="Search a place, e.g. Onibus Coffee Nakameguro"
            />
            {searching && <span className="vg-composer-url-spinner" aria-hidden="true" />}
          </label>
          {candidatesOpen && (
            <div className="vg-popover vg-place-candidates" role="listbox" aria-label="Search results">
              {candidates.length === 0 ? (
                <p className="vg-place-no-results">No matches yet — keep typing, or enter it manually.</p>
              ) : (
                candidates.map((candidate) => (
                  <button
                    type="button"
                    key={`${candidate.osmId}-${candidate.name}`}
                    role="option"
                    className="vg-popover-option vg-place-candidate"
                    onClick={() => pickCandidate(candidate)}
                  >
                    <span className={`read-tag-dot ${PLACE_TAG_COLORS[candidate.tag] || "bg-primary"}`} />
                    <span className="vg-place-candidate-text">
                      <span className="vg-place-candidate-name">{candidate.name}</span>
                      <span className="vg-place-candidate-address">{candidate.address}</span>
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
          <button type="button" className="vg-ghost-btn vg-place-manual-toggle" onClick={startManualEntry}>
            Can't find it? Enter it manually
          </button>
        </div>
      ) : (
        <>
          <div className="vg-composer-row">
            <input
              autoFocus={autoFocus && manualMode}
              value={draft.name}
              onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
              placeholder="Name"
              className="vg-composer-title"
            />
            <div className="vg-tag-menu" ref={tagMenuRef}>
              <button
                type="button"
                className="vg-tag-trigger"
                aria-expanded={tagMenuOpen}
                aria-haspopup="listbox"
                onClick={() => setTagMenuOpen((current) => !current)}
              >
                <span className={`read-tag-dot read-tag-dot-lg ${PLACE_TAG_COLORS[draft.tag] || "bg-primary"}`} />
                <span className="vg-tag-trigger-label">{draft.tag}</span>
                <HiChevronUpDown className="size-4" />
              </button>
              {tagMenuOpen && (
                <div className="vg-popover vg-tag-popover" role="listbox" aria-label="Choose tag">
                  {PLACE_TAGS.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      role="option"
                      aria-selected={draft.tag === tag}
                      className={`vg-popover-option ${draft.tag === tag ? "vg-popover-option-active" : ""}`}
                      onClick={() => pickTag(tag)}
                    >
                      <span className={`read-tag-dot read-tag-dot-lg ${PLACE_TAG_COLORS[tag] || "bg-primary"}`} />
                      <span>{tag}</span>
                      {draft.tag === tag && <HiCheck className="size-4" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <input
            value={draft.address}
            onChange={(event) => setDraft((current) => ({ ...current, address: event.target.value }))}
            placeholder="Address (optional)"
            className="vg-composer-desc"
          />
          <div className="vg-composer-row vg-place-coords-row">
            <input
              value={draft.lat}
              onChange={(event) => setDraft((current) => ({ ...current, lat: event.target.value }))}
              placeholder="Latitude"
              inputMode="decimal"
              className="vg-composer-title"
            />
            <input
              value={draft.lng}
              onChange={(event) => setDraft((current) => ({ ...current, lng: event.target.value }))}
              placeholder="Longitude"
              inputMode="decimal"
              className="vg-composer-title"
            />
          </div>
          <input
            value={draft.notes}
            onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
            placeholder="Add a short note (optional)"
            className="vg-composer-desc"
          />
        </>
      )}

      <div className="vg-composer-actions">
        {manualMode && (
          <button type="submit" className="vg-primary-btn">
            <HiPlus className="size-4" />
            {editingPlace ? "Save changes" : "Add place"}
          </button>
        )}
        <button type="button" className="vg-ghost-btn" onClick={onCancel}>
          <HiXMark className="size-4" />
          Cancel
        </button>
      </div>
    </form>
  );
}
