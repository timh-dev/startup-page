import React from "react";
import { HiArrowUturnLeft, HiCheck, HiPencil, HiTrash } from "react-icons/hi2";

import { faviconFallbackLabel, faviconSrcSet, faviconUrl, getHostname } from "@/features/bookmarks/components/Bookmark";
import { READ_TAG_COLORS } from "@/features/resourceVault/constants";
import { relativeAge } from "@/features/resourceVault/utils";

export interface LinkItem {
  id: string;
  title: string;
  description?: string;
  url?: string;
  tag: string;
  image?: string | null;
  status: "todo" | "done";
  createdAt: string;
  completedAt?: string | null;
}

interface LinkRowProps {
  item: LinkItem;
  /** Its preview (title, note, image) is still loading. */
  fetching?: boolean;
  onToggle: (id: string) => void;
  onEdit: (item: LinkItem) => void;
  onDelete: (item: LinkItem) => void;
  /** Picks the row's tag as the filter. */
  onTag?: (tag: string) => void;
}

// One saved link: a check to mark it done, the site's icon, title, site, tag
// and age, its note, and the page's share image when it has one.
export default function LinkRow({ item, fetching, onToggle, onEdit, onDelete, onTag }: LinkRowProps) {
  const done = item.status === "done";
  const host = item.url ? getHostname(item.url) : "";
  const icon = item.url ? faviconUrl(item.url) : null;
  const [iconFailed, setIconFailed] = React.useState(false);
  const [imageFailed, setImageFailed] = React.useState(false);
  const when = done ? item.completedAt || item.createdAt : item.createdAt;

  return (
    <li className={`link-row ${READ_TAG_COLORS[item.tag] || ""}`} data-done={done || undefined} data-fetching={fetching || undefined} aria-busy={fetching || undefined}>
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        className="link-row-check"
        onClick={() => onToggle(item.id)}
        title={done ? "Move back to explore" : "Mark done"}
        aria-label={done ? `Move "${item.title}" back to explore` : `Mark "${item.title}" done`}
      >
        <HiCheck className="size-3" />
      </button>

      <span className="link-row-icon" aria-hidden="true">
        {icon && !iconFailed ? (
          <img src={icon} srcSet={item.url ? faviconSrcSet(item.url) : undefined} alt="" loading="lazy" onError={() => setIconFailed(true)} />
        ) : (
          <span>{faviconFallbackLabel(item.title, item.url || "")}</span>
        )}
      </span>

      <div className="link-row-text">
        {item.url ? (
          <a className="link-row-title" href={item.url} target="_blank" rel="noreferrer">
            {item.title}
          </a>
        ) : (
          <span className="link-row-title">{item.title}</span>
        )}
        <span className="link-row-meta">
          {host && <span className="link-row-host">{host}</span>}
          <button type="button" className="link-row-tag" onClick={() => onTag?.(item.tag)} title={`Show only ${item.tag}`}>
            <span className="read-tag-dot" aria-hidden="true" />
            {item.tag}
          </button>
          <time dateTime={when}>{relativeAge(when)}</time>
        </span>
        {item.description && <p className="link-row-note">{item.description}</p>}
      </div>

      {item.image && !imageFailed && (
        <img className="link-row-thumb" src={item.image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setImageFailed(true)} />
      )}

      <span className="link-row-actions">
        <button type="button" onClick={() => onEdit(item)} title="Edit item" aria-label={`Edit "${item.title}"`}>
          <HiPencil className="size-3.5" />
        </button>
        {done && (
          <button type="button" onClick={() => onToggle(item.id)} title="Move back to explore" aria-label={`Move "${item.title}" back`}>
            <HiArrowUturnLeft className="size-3.5" />
          </button>
        )}
        <button type="button" onClick={() => onDelete(item)} title="Delete item" aria-label={`Delete "${item.title}"`}>
          <HiTrash className="size-3.5" />
        </button>
      </span>
    </li>
  );
}
