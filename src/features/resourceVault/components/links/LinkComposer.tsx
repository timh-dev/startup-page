import React from "react";
import { HiCheck, HiChevronUpDown, HiPlus } from "react-icons/hi2";
import { DEFAULT_READ_TAGS, READ_TAG_COLORS } from "@/features/resourceVault/constants";
import { usePopoverDismiss } from "@/features/resourceVault/hooks/usePopoverDismiss";
import { getAuthToken } from "@/lib/authToken";

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

export interface LinkDraft {
  title: string;
  description: string;
  url: string;
  tag: string;
}

interface LinkComposerProps {
  /** The link being edited, or null to add one. Remount (via key) to switch items. */
  editingItem: LinkDraft | null;
  /** Tag for a new link: the last one used, so a run of similar links keeps it. */
  defaultTag: string;
  onSubmit: (item: LinkDraft) => void;
  /** Called with the tag that was selected, so it carries over to the next new link. */
  onCancel: (tag: string) => void;
}

export default function LinkComposer({ editingItem, defaultTag, onSubmit, onCancel }: LinkComposerProps) {
  const [draft, setDraft] = React.useState<LinkDraft>(() => ({
    title: editingItem?.title || "",
    description: editingItem?.description || "",
    url: editingItem?.url || "",
    tag: editingItem?.tag || defaultTag,
  }));
  const [composerTagMenuOpen, setComposerTagMenuOpen] = React.useState(false);
  const composerTagMenuRef = React.useRef<HTMLDivElement>(null);
  const [fetchingPreview, setFetchingPreview] = React.useState(false);
  // Whether the tag was chosen by the user (an explicit pick, or loaded from
  // the item being edited) so the link-preview suggestion never clobbers a
  // deliberate choice — same rule as title/description.
  const tagManuallySetRef = React.useRef(Boolean(editingItem));

  const closeTagMenu = React.useCallback(() => setComposerTagMenuOpen(false), []);
  usePopoverDismiss(composerTagMenuOpen, composerTagMenuRef, closeTagMenu);

  const pickDraftTag = React.useCallback((tag: string) => {
    tagManuallySetRef.current = true;
    setDraft((current) => ({ ...current, tag }));
    setComposerTagMenuOpen(false);
  }, []);

  // Number keys pick a tag while the tag menu is open.
  React.useEffect(() => {
    if (!composerTagMenuOpen) {
      return undefined;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      const tagIndex = Number(event.key) - 1;
      if (tagIndex >= 0 && tagIndex < DEFAULT_READ_TAGS.length) {
        event.preventDefault();
        pickDraftTag(DEFAULT_READ_TAGS[tagIndex]);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [composerTagMenuOpen, pickDraftTag]);

  const submitDraft = (event: React.FormEvent) => {
    event.preventDefault();
    const title = draft.title.trim();

    if (!title) {
      return;
    }

    onSubmit({
      title,
      description: draft.description.trim(),
      url: draft.url.trim(),
      tag: draft.tag,
    });
  };

  // Fetches the target page's <title>/description through the
  // /api/link-preview endpoint. Silently no-ops on any failure (network
  // error, 404 because this deployment has no /api at all, timeout, etc.) —
  // auto-fill is a convenience, never a requirement, so the user can always
  // just type the title themselves.
  const maybeFetchLinkPreview = React.useCallback(async (rawUrl: string) => {
    const trimmed = rawUrl.trim();
    if (!/^https?:\/\//i.test(trimmed)) {
      return;
    }

    // Previews need a signed-in user (the endpoint isn't an open proxy);
    // signed out, the user just types the title themselves.
    const token = await getAuthToken();
    if (!token) {
      return;
    }

    setFetchingPreview(true);
    try {
      const response = await fetch(`${API_URL}/api/link-preview?url=${encodeURIComponent(trimmed)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        return;
      }
      const data = await response.json();
      const suggestedTag = DEFAULT_READ_TAGS.includes(data.tag) ? data.tag : null;
      setDraft((current) => (
        current.url.trim() === trimmed
          ? {
              ...current,
              title: current.title.trim() ? current.title : (data.title || current.title),
              description: current.description.trim() ? current.description : (data.description || current.description),
              tag: !tagManuallySetRef.current && suggestedTag ? suggestedTag : current.tag,
            }
          : current
      ));
    } catch (_error) {
      // No /api available (static/self-hosted deployment) or the fetch
      // failed — leave the composer exactly as the user left it.
    } finally {
      setFetchingPreview(false);
    }
  }, []);

  const handleUrlPaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData("text");
    if (pasted) {
      void maybeFetchLinkPreview(pasted);
    }
  };

  return (
    <form className="vg-composer" onSubmit={submitDraft}>
      <div className="vg-composer-row">
        <input
          autoFocus
          value={draft.title}
          onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
          placeholder="Title"
          className="vg-composer-title"
        />
        <div className="vg-tag-menu" ref={composerTagMenuRef}>
          <button
            type="button"
            className="vg-tag-trigger"
            aria-expanded={composerTagMenuOpen}
            aria-haspopup="listbox"
            onClick={() => setComposerTagMenuOpen((current) => !current)}
          >
            <span className={`read-tag-dot read-tag-dot-lg ${READ_TAG_COLORS[draft.tag] || "bg-primary"}`} />
            <HiChevronUpDown className="size-4" />
          </button>
          {composerTagMenuOpen && (
            <div className="vg-popover vg-tag-popover" role="listbox" aria-label="Choose tag">
              {DEFAULT_READ_TAGS.map((tag, index) => (
                <button
                  key={tag}
                  type="button"
                  role="option"
                  aria-selected={draft.tag === tag}
                  className={`vg-popover-option ${draft.tag === tag ? "vg-popover-option-active" : ""}`}
                  onClick={() => pickDraftTag(tag)}
                >
                  <span className={`read-tag-dot read-tag-dot-lg ${READ_TAG_COLORS[tag] || "bg-primary"}`} />
                  <span>{tag}</span>
                  {draft.tag === tag && <HiCheck className="size-4" />}
                  <span className="vg-tag-shortcut">{index + 1}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="vg-composer-url-row">
        <input
          value={draft.url}
          onChange={(event) => setDraft((current) => ({ ...current, url: event.target.value }))}
          onPaste={handleUrlPaste}
          placeholder="https://... (paste a link to auto-fill the title)"
          className="vg-composer-url"
        />
        {fetchingPreview && <span className="vg-composer-url-spinner" aria-hidden="true" />}
      </div>
      <input
        value={draft.description}
        onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
        placeholder="Add a short note (optional)"
        className="vg-composer-desc"
      />
      <div className="vg-composer-actions">
        <button type="submit" className="vg-primary-btn">
          <HiPlus className="size-4" />
          {editingItem ? "Save changes" : "Add resource"}
        </button>
        <button type="button" className="vg-ghost-btn" onClick={() => onCancel(draft.tag)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
