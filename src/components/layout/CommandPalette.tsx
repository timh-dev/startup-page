import React from "react";
import {
  KBarPortal,
  KBarPositioner,
  KBarAnimator,
  KBarSearch,
  KBarResults,
  useMatches,
} from "kbar";

function RenderResults() {
  const { results } = useMatches();

  return (
    <KBarResults
      items={results}
      onRender={({ item, active }) =>
        typeof item === "string" ? (
          <div className="px-3 pt-3 pb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground select-none">
            {item}
          </div>
        ) : (
          <div
            className={`flex items-baseline justify-between gap-3 px-3 py-2.5 mx-1.5 rounded-lg cursor-pointer text-sm transition-colors ${
              active
                ? "bg-primary/10 text-foreground"
                : "text-foreground/80"
            }`}
          >
            <span className="truncate">{item.name}</span>
            {item.subtitle && (
              <span className="max-w-[45%] truncate text-xs text-muted-foreground">{item.subtitle}</span>
            )}
          </div>
        )
      }
    />
  );
}

export default function CommandPalette() {
  return (
    <KBarPortal>
      <KBarPositioner className="fixed inset-0 z-[9999] flex items-start justify-center bg-black/50 backdrop-blur-sm pt-[20vh]">
        <KBarAnimator className="w-full max-w-lg overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-2xl">
          <KBarSearch className="w-full border-b border-border bg-transparent px-4 py-3 text-base text-foreground placeholder:text-muted-foreground outline-none" />
          <div className="max-h-80 overflow-y-auto pb-2">
            <RenderResults />
          </div>
        </KBarAnimator>
      </KBarPositioner>
    </KBarPortal>
  );
}
