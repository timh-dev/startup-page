import React from "react";
import { HiCheck, HiChevronLeft, HiPencil, HiTrash } from "react-icons/hi2";
import { READ_TAG_COLORS } from "@/features/resourceVault/constants";
import { formatItemDate } from "@/features/resourceVault/utils";

interface LinkItemRowProps {
  item: any;
  onToggle: (id: string) => void;
  onEdit: (item: any) => void;
  onDelete: (item: any) => void;
}

// Its own component (not an inline render function) so the description's
// expanded/collapsed state is scoped per-row — toggling one item's
// description doesn't re-render the rest of the list.
export default function LinkItemRow({ item, onToggle, onEdit, onDelete }: LinkItemRowProps) {
  const [descriptionExpanded, setDescriptionExpanded] = React.useState(false);
  const manuallySetRef = React.useRef(false);
  const titleRef = React.useRef<HTMLSpanElement>(null);
  const descriptionRef = React.useRef<HTMLButtonElement>(null);

  // Auto-expand the description onto its own line when the collapsed single
  // line would truncate either the title or the description — but never
  // auto-collapse it back (that would fight a user's manual toggle and can
  // oscillate, since measuring while already expanded reads as "fits").
  React.useLayoutEffect(() => {
    if (descriptionExpanded || manuallySetRef.current || !item.description) {
      return undefined;
    }

    const checkOverflow = () => {
      const titleOverflows = titleRef.current ? titleRef.current.scrollWidth > titleRef.current.clientWidth + 1 : false;
      const descriptionOverflows = descriptionRef.current
        ? descriptionRef.current.scrollWidth > descriptionRef.current.clientWidth + 1
        : false;
      if (titleOverflows || descriptionOverflows) {
        setDescriptionExpanded(true);
      }
    };

    checkOverflow();
    window.addEventListener("resize", checkOverflow);
    return () => window.removeEventListener("resize", checkOverflow);
  }, [descriptionExpanded, item.title, item.description]);

  const toggleDescription = () => {
    manuallySetRef.current = true;
    setDescriptionExpanded((current) => !current);
  };

  return (
    <li
      className={`vg-item ${READ_TAG_COLORS[item.tag] || ""} group/vg-item ${descriptionExpanded ? "vg-item-expanded" : ""}`}
    >
      <button
        type="button"
        className={`vg-item-check ${item.status === "done" ? "vg-item-check-done" : ""}`}
        onClick={() => onToggle(item.id)}
        title={item.status === "done" ? "Move to todo" : "Mark done"}
      >
        {item.status === "done" && <HiCheck className="size-2.5" />}
      </button>
      <a
        href={item.url || undefined}
        target={item.url ? "_blank" : undefined}
        rel={item.url ? "noreferrer" : undefined}
        className={`vg-item-main ${!item.url ? "pointer-events-none" : ""}`}
      >
        <span ref={titleRef} className={`vg-item-title ${item.status === "done" ? "line-through opacity-55" : ""}`}>
          {item.title}
        </span>
      </a>
      {item.description && (
        <button
          ref={descriptionRef}
          type="button"
          className={`vg-item-description ${descriptionExpanded ? "vg-item-description-expanded" : ""}`}
          onClick={toggleDescription}
          title={descriptionExpanded ? "Click to collapse" : "Click to show the full description"}
        >
          {item.description}
        </button>
      )}
      <span className="vg-item-rule" aria-hidden="true" />
      <span className="vg-item-tag">{item.tag}</span>
      <span className="vg-item-date">
        {formatItemDate(item.status === "done" ? (item.completedAt || item.createdAt) : item.createdAt)}
      </span>
      <span className="vg-item-actions">
        <button type="button" className="vg-item-action" onClick={() => onEdit(item)} title="Edit item">
          <HiPencil className="size-3.5" />
        </button>
        <button
          type="button"
          className="vg-item-action"
          onClick={() => onToggle(item.id)}
          title={item.status === "done" ? "Move back to todo" : "Archive to done"}
        >
          {item.status === "done" ? <HiChevronLeft className="size-3.5" /> : <HiCheck className="size-3.5" />}
        </button>
        <button type="button" className="vg-item-action" onClick={() => onDelete(item)} title="Delete item">
          <HiTrash className="size-3.5" />
        </button>
      </span>
    </li>
  );
}
