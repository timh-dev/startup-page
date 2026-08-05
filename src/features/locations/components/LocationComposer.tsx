import React from "react";
import { HiOutlineArrowPath, HiOutlineMapPin, HiXMark } from "react-icons/hi2";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CONTINENTS } from "../constants";
import { guessContinent } from "../geo";
import type { LocationItem } from "../types";
import { fetchWikipediaSummary } from "../wikipedia";
import { buildGoogleEarthUrl, parseGoogleEarthUrl, parseTagsInput } from "../utils";

export interface LocationDraft {
  name: string;
  description: string;
  latitude: number | null;
  longitude: number | null;
  googleEarthUrl: string;
  park: string;
  country: string;
  continent: string;
  tags: string[];
  wikiTitle: string;
  wikiUrl: string;
  wikiExtract: string;
  wikiImageUrl: string;
  imageUrl: string;
}

function emptyDraft(): LocationDraft {
  return {
    name: "",
    description: "",
    latitude: null,
    longitude: null,
    googleEarthUrl: "",
    park: "",
    country: "",
    continent: "",
    tags: [],
    wikiTitle: "",
    wikiUrl: "",
    wikiExtract: "",
    wikiImageUrl: "",
    imageUrl: "",
  };
}

function draftFromLocation(location: LocationItem): LocationDraft {
  return {
    name: location.name,
    description: location.description,
    latitude: location.latitude,
    longitude: location.longitude,
    googleEarthUrl: location.googleEarthUrl,
    park: location.park,
    country: location.country,
    continent: location.continent,
    tags: location.tags,
    wikiTitle: location.wikiTitle,
    wikiUrl: location.wikiUrl,
    wikiExtract: location.wikiExtract,
    wikiImageUrl: location.wikiImageUrl,
    imageUrl: location.imageUrl,
  };
}

interface LocationComposerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingLocation: LocationItem | null;
  onSubmit: (draft: LocationDraft) => void;
}

function applyWikiSummary(
  current: LocationDraft,
  matchedName: string,
  summary: NonNullable<Awaited<ReturnType<typeof fetchWikipediaSummary>>>,
): LocationDraft {
  if (current.name.trim() !== matchedName) {
    return current;
  }

  const shouldFillCoords = current.latitude === null && current.longitude === null
    && summary.latitude !== null && summary.longitude !== null;
  const nextCountry = current.country.trim() || summary.countryHint || current.country;
  const nextContinent = current.continent || (nextCountry ? guessContinent(nextCountry) : "");

  return {
    ...current,
    wikiTitle: summary.title,
    wikiUrl: summary.url,
    wikiExtract: summary.extract,
    wikiImageUrl: summary.imageUrl || "",
    latitude: shouldFillCoords ? summary.latitude : current.latitude,
    longitude: shouldFillCoords ? summary.longitude : current.longitude,
    googleEarthUrl: shouldFillCoords && !current.googleEarthUrl
      ? buildGoogleEarthUrl(summary.latitude as number, summary.longitude as number)
      : current.googleEarthUrl,
    country: nextCountry,
    continent: nextContinent,
  };
}

// Debounce delay between the last keystroke and firing the lookup — long
// enough that typing "Khumbu Icefall" doesn't fire a request per letter,
// short enough that it reads as "instant" once you pause, the same way the
// link composer's paste-to-autofill feels instant.
const NAME_LOOKUP_DEBOUNCE_MS = 500;

export default function LocationComposer({ open, onOpenChange, editingLocation, onSubmit }: LocationComposerProps) {
  const [draft, setDraft] = React.useState<LocationDraft>(emptyDraft);
  const [tagsInput, setTagsInput] = React.useState("");
  const [wikiLoading, setWikiLoading] = React.useState(false);
  const lastWikiLookupRef = React.useRef("");
  // Tracks a request in flight so a fast Enter-to-submit (which may fire
  // before the debounce timer, and doesn't reliably blur the field first)
  // can await the very same promise instead of racing ahead of the data or
  // firing a redundant duplicate request.
  const pendingLookupRef = React.useRef<{ name: string; promise: Promise<LocationDraft | null> } | null>(null);
  const debounceTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  // Mirrors the latest draft for use inside async callbacks (below) — setDraft's
  // functional-updater form is NOT guaranteed to run synchronously right after
  // it's called (React can defer it to the next render), so reading a `let`
  // variable assigned inside that updater immediately afterward can still see
  // its pre-update value. This ref is always current as of the last render.
  const draftRef = React.useRef(draft);
  draftRef.current = draft;

  React.useEffect(() => {
    if (!open) {
      return;
    }
    const next = editingLocation ? draftFromLocation(editingLocation) : emptyDraft();
    setDraft(next);
    setTagsInput(next.tags.join(", "));
    lastWikiLookupRef.current = next.wikiTitle ? next.name : "";
    pendingLookupRef.current = null;
  }, [open, editingLocation]);

  const handleEarthUrlChange = (value: string) => {
    const coords = parseGoogleEarthUrl(value);
    setDraft((current) => ({
      ...current,
      googleEarthUrl: value,
      latitude: coords ? coords.latitude : current.latitude,
      longitude: coords ? coords.longitude : current.longitude,
    }));
  };

  // Returns the merged draft (if a match was found) so a caller that needs
  // the result right away — handleSubmit — can use it directly instead of
  // reading back post-await component state, which may not have re-rendered
  // yet and would otherwise read as stale.
  const runWikiLookup = React.useCallback((name: string): Promise<LocationDraft | null> => {
    const trimmed = name.trim();
    if (!trimmed || lastWikiLookupRef.current === trimmed) {
      return Promise.resolve(null);
    }
    if (pendingLookupRef.current?.name === trimmed) {
      return pendingLookupRef.current.promise;
    }

    lastWikiLookupRef.current = trimmed;
    setWikiLoading(true);
    const promise = fetchWikipediaSummary(trimmed)
      .then((summary) => {
        if (!summary) {
          return null;
        }
        const merged = applyWikiSummary(draftRef.current, trimmed, summary);
        setDraft(merged);
        return merged;
      })
      .finally(() => {
        setWikiLoading(false);
        if (pendingLookupRef.current?.name === trimmed) {
          pendingLookupRef.current = null;
        }
      });

    pendingLookupRef.current = { name: trimmed, promise };
    return promise;
  }, []);

  // Fires automatically once typing pauses — no blur, no button, matching
  // the link composer's paste-to-autofill: the user does nothing but enter
  // the name and the rest shows up on its own.
  React.useEffect(() => {
    if (!open || !draft.name.trim()) {
      return undefined;
    }
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      void runWikiLookup(draft.name);
    }, NAME_LOOKUP_DEBOUNCE_MS);
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [open, draft.name, runWikiLookup]);

  const handleClearWiki = () => {
    lastWikiLookupRef.current = draft.name.trim();
    setDraft((current) => ({ ...current, wikiTitle: "", wikiUrl: "", wikiExtract: "", wikiImageUrl: "" }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = draft.name.trim();
    if (!name) {
      return;
    }
    // Guarantees the lookup has actually resolved before the entry is saved
    // even if the user hits Enter right after typing, before the debounce
    // timer would otherwise have fired. Uses the merged draft returned
    // directly from the lookup rather than re-reading component state right
    // after an await, which may not have re-rendered yet.
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    const merged = await runWikiLookup(name);
    onSubmit({ ...(merged ?? draft), name, tags: parseTagsInput(tagsInput) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 p-0">
        <form onSubmit={handleSubmit} className="flex max-h-[86vh] flex-col">
          <DialogHeader className="p-5 pb-3">
            <DialogTitle className="font-serif text-lg">
              {editingLocation ? "Edit location" : "Add a location"}
            </DialogTitle>
            <DialogDescription>
              Type a name — add a country if it's a generic name, like "Khumbu Icefall Nepal" — and we'll find its
              Wikipedia article and fill in coordinates, country, and continent automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 space-y-4 overflow-y-auto px-5 pb-2">
            <div className="grid gap-1.5">
              <Label htmlFor="loc-name">Name</Label>
              <Input
                id="loc-name"
                autoFocus
                required
                value={draft.name}
                onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                onBlur={(event) => void runWikiLookup(event.target.value)}
                placeholder="Scimitar Canyon"
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="loc-earth-url">Google Earth link (optional)</Label>
              <Input
                id="loc-earth-url"
                value={draft.googleEarthUrl}
                onChange={(event) => handleEarthUrlChange(event.target.value)}
                onPaste={(event) => handleEarthUrlChange(event.clipboardData.getData("text"))}
                placeholder="Filled in automatically once coordinates are found"
              />
              {draft.latitude !== null && draft.longitude !== null ? (
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <HiOutlineMapPin className="size-3.5" />
                  {draft.latitude.toFixed(4)}, {draft.longitude.toFixed(4)}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Coordinates are found automatically from the name, or paste your own Earth link for exact framing.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="loc-park">Park / region</Label>
                <Input
                  id="loc-park"
                  value={draft.park}
                  onChange={(event) => setDraft((current) => ({ ...current, park: event.target.value }))}
                  placeholder="Nahanni National Park Reserve"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="loc-country">Country</Label>
                <Input
                  id="loc-country"
                  value={draft.country}
                  onChange={(event) => setDraft((current) => ({ ...current, country: event.target.value }))}
                  placeholder="Canada"
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="loc-continent">Continent</Label>
              <select
                id="loc-continent"
                value={draft.continent}
                onChange={(event) => setDraft((current) => ({ ...current, continent: event.target.value }))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <option value="">Select a continent</option>
                {CONTINENTS.map((continent) => (
                  <option key={continent} value={continent}>
                    {continent}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="loc-tags">Tags</Label>
              <Input
                id="loc-tags"
                value={tagsInput}
                onChange={(event) => setTagsInput(event.target.value)}
                placeholder="glacial, hiking, remote"
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="loc-image">Image URL (optional)</Label>
              <Input
                id="loc-image"
                value={draft.imageUrl}
                onChange={(event) => setDraft((current) => ({ ...current, imageUrl: event.target.value }))}
                placeholder="Leave blank to use the Wikipedia thumbnail, if found"
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="loc-description">Notes (optional)</Label>
              <textarea
                id="loc-description"
                value={draft.description}
                onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                placeholder="Anything you want to remember about this place..."
                rows={2}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
              />
            </div>

            <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-foreground">Wikipedia article</p>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    disabled={wikiLoading || !draft.name.trim()}
                    onClick={() => {
                      lastWikiLookupRef.current = "";
                      void runWikiLookup(draft.name);
                    }}
                  >
                    <HiOutlineArrowPath className={`size-3.5 ${wikiLoading ? "animate-spin" : ""}`} />
                    {wikiLoading ? "Looking up..." : "Look up"}
                  </Button>
                  {draft.wikiTitle ? (
                    <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={handleClearWiki}>
                      <HiXMark className="size-3.5" />
                    </Button>
                  ) : null}
                </div>
              </div>
              {draft.wikiTitle ? (
                <div className="mt-1.5 flex gap-2.5">
                  {draft.wikiImageUrl ? (
                    <img src={draft.wikiImageUrl} alt="" className="size-12 flex-none rounded-md object-cover" />
                  ) : null}
                  <div className="min-w-0">
                    <a href={draft.wikiUrl} target="_blank" rel="noreferrer" className="text-sm font-medium underline-offset-2 hover:underline">
                      {draft.wikiTitle}
                    </a>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{draft.wikiExtract}</p>
                  </div>
                </div>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">
                  No article matched yet — it's looked up automatically a moment after you stop typing the name.
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="border-t border-border p-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">{editingLocation ? "Save changes" : "Add location"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
