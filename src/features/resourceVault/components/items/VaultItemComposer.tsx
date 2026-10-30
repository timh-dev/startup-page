import React from "react";
import {
  HiCheck,
  HiChevronUpDown,
  HiEye,
  HiOutlinePencilSquare,
  HiOutlineSparkles,
  HiPlus,
} from "react-icons/hi2";
import {
  CODE_LANGUAGES,
  CODE_LANGUAGE_COLORS,
  CODE_LANGUAGE_LABELS,
  TEMPLATE_SUBTYPES,
  VAULT_KIND_DEFS,
} from "@/features/resourceVault/constants";
import { usePopoverDismiss } from "@/features/resourceVault/hooks/usePopoverDismiss";
import { renderMarkdownToHtml } from "@/features/resourceVault/markdown";
import type { TemplateSubtype, VaultItem, VaultItemKind } from "@/features/resourceVault/types";
import { tidyCode } from "@/features/resourceVault/utils";

const EMPTY_DRAFT = { title: "", description: "", body: "", language: "", templateType: "prompt" as TemplateSubtype, subject: "", trigger: "" };

function draftFrom(item: VaultItem | null) {
  if (!item) {
    return EMPTY_DRAFT;
  }
  return {
    title: item.title || "",
    description: item.description || "",
    body: item.body || "",
    language: item.language || "",
    templateType: item.templateType || "prompt",
    subject: item.subject || "",
    trigger: item.trigger || "",
  };
}

interface VaultItemComposerProps {
  kind: VaultItemKind;
  /** The item being edited, or null to add a new one. Remount (via key) to switch items. */
  editingItem: VaultItem | null;
  onSubmit: (item: Partial<VaultItem>) => void;
  onCancel: () => void;
}

export default function VaultItemComposer({ kind, editingItem, onSubmit, onCancel }: VaultItemComposerProps) {
  const kindDef = VAULT_KIND_DEFS[kind];
  const [draft, setDraft] = React.useState(() => draftFrom(editingItem));
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [composerLangMenuOpen, setComposerLangMenuOpen] = React.useState(false);
  const composerLangMenuRef = React.useRef<HTMLDivElement>(null);
  // True once the language picker is in "type your own" mode — either the
  // user picked "Other..." this session, or the item being edited already
  // has a language outside the fixed dropdown list, so editing it doesn't
  // silently clobber that value with the closest preset.
  const [customLangMode, setCustomLangMode] = React.useState(
    () => Boolean(editingItem?.language) && !(CODE_LANGUAGES as readonly string[]).includes(editingItem!.language),
  );

  const closeLangMenu = React.useCallback(() => setComposerLangMenuOpen(false), []);
  usePopoverDismiss(composerLangMenuOpen, composerLangMenuRef, closeLangMenu);

  const activeSubtypeDef = TEMPLATE_SUBTYPES.find((def) => def.value === draft.templateType) ?? TEMPLATE_SUBTYPES[0];

  const pickDraftLanguage = (language: string) => {
    setDraft((current) => ({ ...current, language }));
    setCustomLangMode(false);
    setComposerLangMenuOpen(false);
  };

  const submitDraft = (event: React.FormEvent) => {
    event.preventDefault();
    const title = draft.title.trim();
    const body = draft.body.trim();

    if (!title && !body) {
      return;
    }

    onSubmit({
      kind,
      title,
      description: draft.description.trim(),
      body,
      language: draft.language.trim(),
      templateType: draft.templateType,
      subject: activeSubtypeDef.showSubject ? draft.subject.trim() : "",
      trigger: activeSubtypeDef.showTrigger ? draft.trigger.trim() : "",
    });
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
        {kindDef.showLanguage && (
          <div className="vg-tag-menu" ref={composerLangMenuRef}>
            <button
              type="button"
              className="vg-tag-trigger"
              aria-expanded={composerLangMenuOpen}
              aria-haspopup="listbox"
              onClick={() => setComposerLangMenuOpen((current) => !current)}
            >
              <span className={`read-tag-dot read-tag-dot-lg ${CODE_LANGUAGE_COLORS[draft.language] || "code-lang-other"}`} />
              <span className="vg-tag-trigger-label">{draft.language || "Language"}</span>
              <HiChevronUpDown className="size-4" />
            </button>
            {composerLangMenuOpen && (
              <div className="vg-popover vg-tag-popover" role="listbox" aria-label="Choose language">
                {CODE_LANGUAGES.map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    role="option"
                    aria-selected={draft.language === lang}
                    className={`vg-popover-option ${draft.language === lang ? "vg-popover-option-active" : ""}`}
                    onClick={() => pickDraftLanguage(lang)}
                  >
                    <span className={`read-tag-dot read-tag-dot-lg ${CODE_LANGUAGE_COLORS[lang]}`} />
                    <span>{CODE_LANGUAGE_LABELS[lang]}</span>
                    {draft.language === lang && <HiCheck className="size-4" />}
                  </button>
                ))}
                <button
                  type="button"
                  role="option"
                  aria-selected={customLangMode}
                  className={`vg-popover-option ${customLangMode ? "vg-popover-option-active" : ""}`}
                  onClick={() => {
                    setCustomLangMode(true);
                    setComposerLangMenuOpen(false);
                  }}
                >
                  <span className="read-tag-dot read-tag-dot-lg code-lang-other" />
                  <span>Other...</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {kindDef.showLanguage && customLangMode && (
        <input
          autoFocus
          value={draft.language}
          onChange={(event) => setDraft((current) => ({ ...current, language: event.target.value }))}
          placeholder="Custom language (e.g. kotlin, dockerfile)"
        />
      )}

      {kind === "template" && (
        <div className="vg-subtype-picker" role="radiogroup" aria-label="Template type">
          {TEMPLATE_SUBTYPES.map((def) => (
            <button
              type="button"
              key={def.value}
              role="radio"
              aria-checked={draft.templateType === def.value}
              className={`vg-subtype-option ${draft.templateType === def.value ? "vg-subtype-option-active" : ""}`}
              onClick={() => setDraft((current) => ({ ...current, templateType: def.value }))}
            >
              {def.label}
            </button>
          ))}
        </div>
      )}

      {activeSubtypeDef.showSubject && kind === "template" && (
        <input
          value={draft.subject}
          onChange={(event) => setDraft((current) => ({ ...current, subject: event.target.value }))}
          placeholder="Subject"
        />
      )}
      {activeSubtypeDef.showTrigger && kind === "template" && (
        <input
          value={draft.trigger}
          onChange={(event) => setDraft((current) => ({ ...current, trigger: event.target.value }))}
          placeholder="Shorthand trigger (optional)"
        />
      )}

      {(kindDef.markdown || kind === "code") && (
        <div className="vg-composer-body-toolbar">
          {kindDef.markdown && (
            <button
              type="button"
              className="vg-ghost-btn vg-ghost-btn-sm"
              onClick={() => setPreviewOpen((current) => !current)}
            >
              {previewOpen ? <HiOutlinePencilSquare className="size-3.5" /> : <HiEye className="size-3.5" />}
              {previewOpen ? "Edit" : "Preview"}
            </button>
          )}
          {kind === "code" && (
            <button
              type="button"
              className="vg-ghost-btn vg-ghost-btn-sm"
              onClick={() => setDraft((current) => ({ ...current, body: tidyCode(current.body) }))}
              title="Trim trailing whitespace and tidy up blank lines (not a full syntax-aware formatter)"
            >
              <HiOutlineSparkles className="size-3.5" />
              Format
            </button>
          )}
        </div>
      )}

      {kindDef.markdown && previewOpen ? (
        <div
          className="vg-markdown-preview"
          dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(draft.body) || "<p><em>Nothing to preview yet.</em></p>" }}
        />
      ) : (
        <textarea
          value={draft.body}
          onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))}
          placeholder={kindDef.bodyPlaceholder}
          className={`vg-composer-textarea ${kind === "code" ? "vg-composer-textarea-mono" : ""}`}
        />
      )}

      <input
        value={draft.description}
        onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
        placeholder="Add a short note (optional)"
        className="vg-composer-desc"
      />
      <div className="vg-composer-actions">
        <button type="submit" className="vg-primary-btn">
          <HiPlus className="size-4" />
          {editingItem ? "Save changes" : "Add item"}
        </button>
        <button type="button" className="vg-ghost-btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
