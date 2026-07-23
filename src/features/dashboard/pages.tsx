/*eslint-disable*/
import React from "react";
import { useNavigate } from "react-router-dom";
import { HiOutlineArrowsPointingOut, HiOutlineEyeSlash } from "react-icons/hi2";

import { useSettingsStore } from "@/features/settings/stores";
import { useLayoutEditStore } from "@/features/dashboard/stores/layoutEditStore";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_TILE_ORDER,
  DEFAULT_TILE_SIZES,
  TILE_SIZE_OPTIONS,
  TILE_SIZE_SPANS,
} from "@/lib/dashboard-dimensions";

import Clock from "@/features/dashboard/components/Clock";
import FeaturePanel from "@/features/dashboard/components/FeaturePanel";
import Unsplash from "@/features/media/components/Unsplash";
import SearchBox from "@/features/dashboard/components/Search";
import Bookmark from "@/features/bookmarks/components/Bookmark";
import { useBookmarkDialogStore } from "@/features/bookmarks/stores/bookmarkDialogStore";
import ResourceVaultPreview from "@/features/resourceVault/components/ResourceVaultPreview";

import desert from "@/assets/media/desert.mp4";

// The WebGL-heavy tiles (large inline GLSL shaders) are split into their own
// chunks so the dashboard grid paints and becomes interactive immediately while
// these stream in and compile their shaders off the first-paint critical path.
const SolarGraph = React.lazy(() => import("@/features/media/solarGraph"));
const WeatherBox = React.lazy(() =>
  import("@/features/weather/components/WeatherBox").then((m) => ({ default: m.WeatherBox })),
);

const BOOKMARK_CATEGORY_KEY = "startup-page.active-bookmark-category";

function DecorativeVideoTile({
  className,
  src,
  fallbackSrc,
  width,
  height,
  left,
  top,
}: {
  className?: string;
  src?: string;
  fallbackSrc?: string;
  width?: string;
  height?: string;
  left?: string;
  top?: string;
}) {
  const [activeSrc, setActiveSrc] = React.useState(src || fallbackSrc);

  React.useEffect(() => {
    setActiveSrc(src || fallbackSrc);
  }, [src, fallbackSrc]);

  return (
    <div className={`${className} relative overflow-hidden`}>
      <video
        key={activeSrc}
        className="absolute max-w-none object-cover"
        style={{ width, height, left, top }}
        src={activeSrc}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        referrerPolicy="no-referrer"
        onError={() => {
          if (activeSrc !== fallbackSrc) setActiveSrc(fallbackSrc);
        }}
      />
    </div>
  );
}

export default function Index() {
  const navigate = useNavigate();
  const settings = useSettingsStore((state) => state.settings);
  const persistSettings = useSettingsStore((state) => state.persistSettings);
  const editing = useLayoutEditStore((state) => state.editing);
  const setEditing = useLayoutEditStore((state) => state.setEditing);
  // Ref drives the reorder logic (immune to render timing across the multi-tick
  // drag sequence); state is only for the "being dragged" visual treatment.
  const dragIdRef = React.useRef<string | null>(null);
  const [dragId, setDragId] = React.useState<string | null>(null);

  const hiddenBoxes = settings.layout?.hiddenBoxes || {};
  const showBox = (id: string) => !hiddenBoxes[id];
  const ui = settings.ui || {};
  const decorativeVideo = settings.decorativeVideo || {};
  const bookmarkGroups = Array.isArray(settings.bookmark) ? settings.bookmark : [];
  const bookmarkBoxCategories = settings.layout?.bookmarkBoxCategories || [];
  const openAddBookmarkDialog = useBookmarkDialogStore((state) => state.openAddBookmark);
  const getBookmarkGroupForBox = (boxIndex: number) =>
    bookmarkGroups.find((group: any) => group.id === bookmarkBoxCategories[boxIndex]) ||
    bookmarkGroups[boxIndex] ||
    { id: null, title: "", content: [] };
  const gapClass = ui.gridDensity === "compact" ? "gap-y-4 gap-x-4" : "gap-y-6 gap-x-6";
  const decorativeGap = ui.gridDensity === "compact" ? 16 : 24;
  const tilePx = (ui.tileSize || 9) * 16;
  const tallTilePx = tilePx * 2 + decorativeGap;
  const minWidthFor = (n: number) => n * tilePx + (n - 1) * decorativeGap + 32;
  const gridCss = `
    .dashboard-grid,
    .bookmark-page-grid {
      --dashboard-tile-max: ${tilePx}px;
      --dashboard-gap: ${decorativeGap}px;
      --dashboard-inline-padding: 2rem;
      --dashboard-tile: clamp(88px, calc((100vw - var(--dashboard-inline-padding) - var(--dashboard-gap)) / 2), var(--dashboard-tile-max));
      grid-template-columns: repeat(2, minmax(0, var(--dashboard-tile)));
      grid-auto-rows: var(--dashboard-tile);
    }
    .dashboard-grid .grid-feature-responsive {
      grid-column: span 2 / span 2;
    }
    @media (min-width: ${minWidthFor(3)}px) {
      .dashboard-grid,
      .bookmark-page-grid {
        --dashboard-tile: clamp(88px, calc((100vw - var(--dashboard-inline-padding) - ${decorativeGap * 2}px) / 3), var(--dashboard-tile-max));
        grid-template-columns: repeat(3, minmax(0, var(--dashboard-tile)));
      }
      .dashboard-grid .grid-feature-responsive {
        grid-column: span 3 / span 3;
      }
    }
    @media (min-width: ${minWidthFor(5)}px) {
      .dashboard-grid,
      .bookmark-page-grid {
        --dashboard-tile: clamp(88px, calc((100vw - var(--dashboard-inline-padding) - ${decorativeGap * 4}px) / 5), var(--dashboard-tile-max));
        grid-template-columns: repeat(5, minmax(0, var(--dashboard-tile)));
      }
    }
    @media (min-width: ${minWidthFor(7)}px) {
      .dashboard-grid,
      .bookmark-page-grid {
        --dashboard-tile: clamp(88px, calc((100vw - var(--dashboard-inline-padding) - ${decorativeGap * 6}px) / 7), var(--dashboard-tile-max));
        grid-template-columns: repeat(7, minmax(0, var(--dashboard-tile)));
      }
    }
  `;
  const radiusClass =
    ui.cardStyle === "soft"
      ? "rounded-[2rem]"
      : ui.cardStyle === "sharp"
        ? "rounded-md"
        : "rounded-xl";
  const showDecorativeMedia = ui.showDecorativeMedia !== false;
  const decorativeVideoUrls = Array.isArray(decorativeVideo.urls)
    ? decorativeVideo.urls.filter(
        (value: any) => typeof value === "string" && value.trim() !== "",
      )
    : [];
  const [decorativeVideoUrl] = React.useState(() => {
    if (!decorativeVideoUrls.length) return desert;
    const randomIndex = Math.floor(Math.random() * decorativeVideoUrls.length);
    return decorativeVideoUrls[randomIndex] || desert;
  });

  const openBookmarkView = (categoryId: string | null) => {
    if (categoryId) {
      window.localStorage?.setItem(BOOKMARK_CATEGORY_KEY, categoryId);
    } else {
      window.localStorage?.removeItem(BOOKMARK_CATEGORY_KEY);
    }
    navigate("/bookmarks");
  };

  const panel = (extra = "") => `${radiusClass} ${extra}`;
  const surface = "bg-card text-card-foreground border border-border/60 shadow-lg";
  const mutedSurface = "bg-muted/50 text-foreground border border-border/60 shadow-lg";
  const strongSurface = "bg-primary text-primary-foreground border border-border/40 shadow-lg";

  const renderDecorativeVideo = (variant: "tall" | "small", className: string) => {
    const sceneWidth = tilePx + decorativeGap + tilePx;
    const sceneHeight = tallTilePx;
    const viewports = {
      tall: { x: 0, y: 0, width: tilePx, height: tallTilePx },
      small: { x: tilePx + decorativeGap, y: 0, width: tilePx, height: tilePx },
    };
    const viewport = viewports[variant];
    const zoom = Number(decorativeVideo.zoom ?? decorativeVideo.tall?.zoom ?? 1.6);
    const offsetX = Number(decorativeVideo.offsetX ?? decorativeVideo.tall?.offsetX ?? 0);
    const offsetY = Number(decorativeVideo.offsetY ?? decorativeVideo.tall?.offsetY ?? 0);
    const scaledSceneWidth = sceneWidth * zoom;
    const scaledSceneHeight = sceneHeight * zoom;
    const left = offsetX - viewport.x * zoom;
    const top = offsetY - viewport.y * zoom;

    return (
      <DecorativeVideoTile
        className={className}
        src={decorativeVideoUrl}
        fallbackSrc={desert}
        width={`${scaledSceneWidth}px`}
        height={`${scaledSceneHeight}px`}
        left={`${left}px`}
        top={`${top}px`}
      />
    );
  };

  // Each tile renders its own surface + content and fills its grid cell. The
  // wrapper in the render loop owns positioning (span, drag/drop, edit chrome).
  const renderTileBody = (id: string): React.ReactNode => {
    switch (id) {
      case "videoTall":
        return (
          <div className={panel(`h-full w-full overflow-hidden ${surface}`)}>
            {renderDecorativeVideo("tall", "sticky h-full w-full rounded-xl overflow-hidden")}
          </div>
        );
      case "videoSmall":
        return (
          <div className={panel(`h-full w-full overflow-hidden ${surface}`)}>
            {renderDecorativeVideo("small", "sticky h-full w-full rounded-xl overflow-hidden")}
          </div>
        );
      case "search":
        return (
          <div className={panel(`h-full w-full ${strongSurface}`)}>
            <SearchBox />
          </div>
        );
      case "weather":
        return (
          <div className={panel("h-full w-full overflow-hidden")}>
            <React.Suspense fallback={null}>
              <WeatherBox />
            </React.Suspense>
          </div>
        );
      case "featurePanel":
        return (
          <div className={panel(`h-full w-full overflow-visible ${surface}`)}>
            <FeaturePanel />
          </div>
        );
      case "solarGraph":
        return (
          <div className={panel("h-full w-full bg-black border border-border/60 shadow-lg")}>
            <React.Suspense fallback={null}>
              <SolarGraph />
            </React.Suspense>
          </div>
        );
      case "vaultPreview":
        return (
          <div className={panel(`h-full w-full overflow-hidden ${strongSurface}`)}>
            <ResourceVaultPreview items={settings.readItems} onOpen={() => navigate("/resources")} />
          </div>
        );
      case "clock":
        return (
          <div className={panel(`h-full w-full ${mutedSurface}`)}>
            <Clock />
          </div>
        );
      case "bookmark1":
      case "bookmark2":
      case "bookmark3":
      case "bookmark4":
      case "bookmark5": {
        const boxIndex = Number(id.replace("bookmark", "")) - 1;
        const group = getBookmarkGroupForBox(boxIndex);
        return (
          <Bookmark
            title={group.title}
            content={group.content}
            onTitleClick={() => openBookmarkView(group.id)}
            onQuickAdd={group.id ? () => openAddBookmarkDialog(group.id) : undefined}
            cardClass={panel(`h-full w-full overflow-y-auto ${strongSurface}`)}
          />
        );
      }
      case "unsplash2":
      case "unsplash3":
      case "unsplash4":
      case "unsplash5": {
        const topicKey = `unsplashBox${id.replace("unsplash", "")}`;
        return (
          <div className={panel(`h-full w-full ${surface}`)}>
            <Unsplash
              search={settings.unsplash?.[topicKey]}
              cardClass={panel("relative overflow-hidden h-full w-full bg-center bg-no-repeat")}
            />
          </div>
        );
      }
      default:
        return null;
    }
  };

  const isTileVisible = (id: string) => {
    if (!showBox(id)) return false;
    if ((id === "videoTall" || id === "videoSmall") && !showDecorativeMedia) return false;
    return true;
  };

  // Saved order, filtered to known tiles, with any newly-added tiles appended so
  // nothing silently disappears when the tile set changes across versions.
  const orderedTileIds = React.useMemo(() => {
    const saved = Array.isArray(settings.layout?.order) ? settings.layout.order : [];
    const known = saved.filter((id: string) => DEFAULT_TILE_ORDER.includes(id));
    const missing = DEFAULT_TILE_ORDER.filter((id) => !known.includes(id));
    return known.length ? [...known, ...missing] : DEFAULT_TILE_ORDER;
  }, [settings.layout?.order]);

  const tileSizes = { ...DEFAULT_TILE_SIZES, ...(settings.layout?.sizes || {}) };

  const persistLayout = (
    updater: (state: { order: string[]; sizes: Record<string, string> }) => {
      order: string[];
      sizes: Record<string, string>;
    },
  ) => {
    void persistSettings((prev: any) => {
      const prevLayout = prev.layout || {};
      const savedOrder = Array.isArray(prevLayout.order) ? prevLayout.order : [];
      const known = savedOrder.filter((id: string) => DEFAULT_TILE_ORDER.includes(id));
      const missing = DEFAULT_TILE_ORDER.filter((id) => !known.includes(id));
      const baseOrder = known.length ? [...known, ...missing] : [...DEFAULT_TILE_ORDER];
      const baseSizes = { ...DEFAULT_TILE_SIZES, ...(prevLayout.sizes || {}) };
      const next = updater({ order: baseOrder, sizes: baseSizes });
      return { ...prev, layout: { ...prevLayout, order: next.order, sizes: next.sizes } };
    });
  };

  const moveTile = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    persistLayout(({ order, sizes }) => {
      const next = order.filter((id) => id !== fromId);
      const targetIndex = next.indexOf(toId);
      next.splice(targetIndex < 0 ? next.length : targetIndex, 0, fromId);
      return { order: next, sizes };
    });
  };

  const setTileSize = (id: string, size: string) => {
    persistLayout(({ order, sizes }) => ({ order, sizes: { ...sizes, [id]: size } }));
  };

  const hideTile = (id: string) => {
    void persistSettings((prev: any) => ({
      ...prev,
      layout: {
        ...prev.layout,
        hiddenBoxes: { ...(prev.layout?.hiddenBoxes || {}), [id]: true },
      },
    }));
  };

  const resetLayout = () => {
    persistLayout(() => ({
      order: [...DEFAULT_TILE_ORDER],
      sizes: { ...DEFAULT_TILE_SIZES },
    }));
  };

  const handleDragStart = (event: React.DragEvent, id: string) => {
    dragIdRef.current = id;
    setDragId(id);
    event.dataTransfer.effectAllowed = "move";
    try {
      event.dataTransfer.setData("text/plain", id);
    } catch (_error) {
      /* some browsers restrict setData during dragstart */
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    if (!dragIdRef.current) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (event: React.DragEvent, id: string) => {
    event.preventDefault();
    const fromId = dragIdRef.current;
    if (fromId) moveTile(fromId, id);
    dragIdRef.current = null;
    setDragId(null);
  };

  const handleDragEnd = () => {
    dragIdRef.current = null;
    setDragId(null);
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 pb-10 pt-28">
      <style>{gridCss}</style>

      {editing && (
        <div className="fixed inset-x-0 top-16 z-40 flex justify-center px-4">
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 rounded-2xl border border-border/60 bg-background/95 px-4 py-2 text-xs shadow-lg backdrop-blur">
            <span className="font-medium text-foreground">Editing layout</span>
            <span className="hidden text-muted-foreground sm:inline">
              Drag the handle to move · use the size menu to resize · eye icon hides a tile
            </span>
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" variant="outline" onClick={resetLayout}>
                Reset layout
              </Button>
              <Button type="button" size="sm" onClick={() => setEditing(false)}>
                Done
              </Button>
            </div>
          </div>
        </div>
      )}

      <div
        className={`dashboard-grid grid w-fit ${gapClass} grid-flow-row-dense content-center justify-center`}
      >
        {orderedTileIds.map((id) => {
          if (!isTileVisible(id)) return null;
          const size = tileSizes[id] || DEFAULT_TILE_SIZES[id] || "small";
          const spanClass = TILE_SIZE_SPANS[size] || TILE_SIZE_SPANS.small;
          const isDragging = dragId === id;

          return (
            <div
              key={id}
              data-tile-id={id}
              className={`${spanClass} min-h-0 min-w-0 relative ${
                editing
                  ? `${radiusClass} ring-2 ${isDragging ? "ring-primary opacity-60" : "ring-primary/40"}`
                  : ""
              }`}
              onDragOver={editing ? handleDragOver : undefined}
              onDrop={editing ? (event) => handleDrop(event, id) : undefined}
            >
              <div className={editing ? "pointer-events-none h-full w-full select-none" : "h-full w-full"}>
                {renderTileBody(id)}
              </div>

              {editing && (
                <div className="pointer-events-auto absolute left-1 top-1 z-30 flex items-center gap-1 rounded-lg border border-border/60 bg-background/95 px-1 py-1 shadow-lg backdrop-blur-sm">
                  <button
                    type="button"
                    draggable
                    onDragStart={(event) => handleDragStart(event, id)}
                    onDragEnd={handleDragEnd}
                    className="flex size-6 cursor-grab items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-accent-foreground active:cursor-grabbing"
                    aria-label="Drag to move tile"
                    title="Drag to move"
                  >
                    <HiOutlineArrowsPointingOut className="size-3.5" />
                  </button>
                  <select
                    value={size}
                    onChange={(event) => setTileSize(id, event.target.value)}
                    className="h-6 rounded-md border border-input bg-card px-1 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    aria-label="Tile size"
                    title="Resize tile"
                  >
                    {TILE_SIZE_OPTIONS.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => hideTile(id)}
                    className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition hover:bg-destructive/15 hover:text-destructive"
                    aria-label="Hide tile"
                    title="Hide tile"
                  >
                    <HiOutlineEyeSlash className="size-3.5" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
