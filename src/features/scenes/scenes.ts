// Themes: a whole starting look for the dashboard. Each one sets a colour
// palette and mode, the painting behind the Vault and Bookmarks, the videos
// and photo topics for its media cards, and a full first page of cards in its
// own arrangement. New installs start with the default theme; anyone can
// switch later, either restyling what they have ("look") or also taking the
// theme's cards and arrangement ("layout"). Bookmarks, links and the vault
// are never touched.
//
// Videos are Mixkit stock clips (free licence, no attribution; served with
// CORS so joined cards can read their colours). Paintings are public domain,
// bundled under src/assets/media/themes.
import type { TileSize, WidgetInstance, WidgetType } from "@/lib/dashboard-dimensions";
import type { Join } from "@/features/dashboard/layout/joins";
import { MAIN_DASHBOARD, readDashboard, writeDashboard } from "@/features/dashboard/dashboards";
import arcticWallpaper from "@/assets/media/themes/arctic.jpg";
import oceanWallpaper from "@/assets/media/themes/ocean.jpg";
import spaceWallpaper from "@/assets/media/themes/space.jpg";
import desertWallpaper from "@/assets/media/vault-preview-bg.jpg";

export type SceneId = "desert" | "space" | "ocean" | "arctic";

/** One card in a theme's layout. Media cards take the theme's next video or photo topics. */
interface SceneCard {
  type: WidgetType;
  size: TileSize;
  x: number;
  y: number;
  /** The card's settings. For a video or photo card, its own clip or topics instead of the theme's. */
  config?: Record<string, unknown>;
  /** For a bookmark card: which of the user's top-level folders (in order) it shows. */
  folder?: number;
}

export interface Scene {
  id: SceneId;
  name: string;
  tagline: string;
  palette: string;
  mode: "light" | "dark" | "system";
  wallpaper: string;
  /** Who made the painting, for the theme picker. */
  wallpaperCredit: string;
  /** Used in order by the layout's video cards, and by existing ones when restyling. */
  videos: string[];
  /** Search topics, used in order by photo cards (each card rotates through its list). */
  photos: string[][];
  cards: SceneCard[];
  /** The page the cards are laid out on; 7 x 4 unless given. */
  grid?: { columns: number; rows: number };
  /** Cards joined into one shape (or one shared video/photo, "window"), by their index in `cards`. */
  joins?: Array<[number, number] | [number, number, "window"]>;
}

const mixkit = (id: number) => `https://assets.mixkit.co/videos/${id}/${id}-720.mp4`;

const card = (type: WidgetType, size: TileSize, x: number, y: number, extra: Partial<SceneCard> = {}): SceneCard => ({ type, size, x, y, ...extra });

export const SCENES: Scene[] = [
  {
    id: "desert",
    name: "Desert",
    tagline: "Sandstone, slow clouds and a big sky.",
    palette: "desert",
    mode: "system",
    wallpaper: desertWallpaper,
    wallpaperCredit: "Landscape painting (public domain)",
    videos: [mixkit(47724), mixkit(46061)],
    photos: [
      ["sand dunes", "sahara", "wadi rum", "namib desert"],
      ["grand canyon", "arches national park", "monument valley", "antelope canyon"],
      ["joshua tree", "saguaro cactus", "desert bloom"],
      ["desert night sky", "camel caravan", "atacama desert"],
    ],
    // The default layout for new installs.
    grid: { columns: 8, rows: 5 },
    cards: [
      card("video", "tall", 0, 0, { config: { url: mixkit(51678), zoom: 1, offsetX: 0, offsetY: 0 } }),
      card("video", "small", 1, 0, { config: { url: "", zoom: 1.6, offsetX: 0, offsetY: 0 } }),
      card("bookmark", "tall", 2, 0, { folder: 0 }),
      card("search", "wide", 3, 0),
      card("photo", "small", 5, 0, { config: { searchTerms: ["mountain"] } }),
      card("weather", "wide", 6, 0),
      card("bookmark", "small", 1, 1, { folder: 1 }),
      card("photo", "wide", 3, 1, { config: { searchTerms: ["patagonia"] } }),
      card("weatherV2", "wide", 5, 1),
      card("photo", "small", 7, 1, { config: { searchTerms: ["glacier"] } }),
      card("globe", "large", 0, 2, { config: { view: "limb" } }),
      card("photo", "small", 2, 2, { config: { searchTerms: ["aurora"] } }),
      card("photo", "small", 3, 2, { config: { searchTerms: ["patagonia"] } }),
      card("iframe", "feature", 4, 2, { config: { preset: "windy", url: "" } }),
      card("bookmark", "small", 7, 2, { folder: 2 }),
      card("solarGraph", "large", 2, 3),
      card("photo", "small", 7, 3, { config: { searchTerms: ["whitecap"] } }),
      card("bookmark", "small", 0, 4, { folder: 3 }),
      card("photo", "small", 1, 4, { config: { searchTerms: ["Parque Nacional Huascarán"] } }),
      card("photo", "small", 4, 4, { config: { searchTerms: ["volcano"] } }),
      card("vault", "small", 5, 4),
      card("photo", "small", 6, 4, { config: { searchTerms: ["nepal"] } }),
      card("clock", "small", 7, 4),
    ],
    // The tall video shares its clip with the card beside it; the two
    // Patagonia photos join into one L-shaped photo.
    joins: [
      [0, 1, "window"],
      [7, 12],
    ],
  },
  {
    id: "space",
    name: "Space",
    tagline: "The night side: orbits, nebulae and the sun's path.",
    palette: "space",
    mode: "dark",
    wallpaper: spaceWallpaper,
    wallpaperCredit: "Étienne Léopold Trouvelot, The Great Nebula in Orion, 1875 (public domain)",
    videos: [mixkit(14185), mixkit(46148)],
    photos: [
      ["nebula", "galaxy", "milky way", "star cluster"],
      ["earth from space", "international space station", "astronaut"],
      ["moon surface", "mars", "jupiter", "saturn"],
      ["aurora borealis", "night sky", "comet"],
    ],
    cards: [
      card("globe", "large", 0, 0, { config: { view: "globe" } }),
      card("search", "wide", 2, 0),
      card("clock", "small", 4, 0),
      card("video", "tall", 5, 0),
      card("photo", "small", 6, 0),
      card("bookmark", "small", 2, 1, { folder: 0 }),
      card("bookmark", "small", 3, 1, { folder: 1 }),
      card("vault", "small", 4, 1),
      card("photo", "small", 6, 1),
      card("solarGraph", "large", 0, 2),
      card("weather", "wide", 2, 2),
      card("video", "large", 4, 2),
      card("photo", "small", 6, 2),
      card("bookmark", "small", 2, 3, { folder: 2 }),
      card("bookmark", "small", 3, 3, { folder: 3 }),
      card("photo", "small", 6, 3),
    ],
  },
  {
    id: "ocean",
    name: "Ocean",
    tagline: "Reefs, swell and salt air.",
    palette: "ocean",
    mode: "system",
    wallpaper: oceanWallpaper,
    wallpaperCredit: "Ivan Aivazovsky, The Ninth Wave, 1850 (public domain)",
    videos: [mixkit(44974), mixkit(7194)],
    photos: [
      ["coral reef", "sea turtle", "kelp forest", "manta ray"],
      ["lighthouse", "harbour", "sailboat"],
      ["ocean waves", "surfing", "sea cliffs"],
      ["tropical beach", "lagoon", "atoll"],
    ],
    cards: [
      card("video", "large", 0, 0),
      card("search", "wide", 2, 0),
      card("clock", "small", 4, 0),
      card("weather", "wide", 5, 0),
      card("bookmark", "small", 2, 1, { folder: 0 }),
      card("bookmark", "small", 3, 1, { folder: 1 }),
      card("vault", "small", 4, 1),
      card("photo", "small", 5, 1),
      card("photo", "small", 6, 1),
      card("video", "wide", 0, 2),
      card("solarGraph", "large", 2, 2),
      card("photo", "tall", 4, 2),
      card("bookmark", "small", 5, 2, { folder: 2 }),
      card("bookmark", "small", 6, 2, { folder: 3 }),
      card("photo", "wide", 0, 3),
      card("timer", "small", 5, 3),
      card("airQuality", "small", 6, 3),
    ],
  },
  {
    id: "arctic",
    name: "Arctic",
    tagline: "Ice light, long shadows and the northern lights.",
    palette: "arctic",
    mode: "light",
    wallpaper: arcticWallpaper,
    wallpaperCredit: "Frederic Edwin Church, The Icebergs, 1861 (public domain)",
    videos: [mixkit(14901), mixkit(48402)],
    photos: [
      ["glacier", "iceberg", "svalbard", "greenland"],
      ["polar bear", "arctic fox", "snowy owl"],
      ["snowy mountains", "ice cave", "frozen lake"],
    ],
    cards: [
      card("video", "tall", 0, 0),
      card("globe", "large", 1, 0, { config: { view: "limb" } }),
      card("search", "wide", 3, 0),
      card("clock", "small", 5, 0),
      card("photo", "tall", 6, 0),
      card("bookmark", "small", 3, 1, { folder: 0 }),
      card("bookmark", "small", 4, 1, { folder: 1 }),
      card("vault", "small", 5, 1),
      card("weather", "wide", 0, 2),
      card("solarGraph", "large", 2, 2),
      card("video", "large", 4, 2),
      card("photo", "small", 6, 2),
      card("bookmark", "wide", 0, 3, { folder: 2 }),
      card("photo", "small", 6, 3),
    ],
  },
];

export const DEFAULT_SCENE: SceneId = "desert";

export function getScene(id: unknown): Scene | undefined {
  return SCENES.find((scene) => scene.id === id);
}

/** The painting for the Vault and Bookmarks; settings without a theme keep the original one. */
export function sceneWallpaper(id: unknown): string {
  return (getScene(id) ?? getScene(DEFAULT_SCENE)!).wallpaper;
}

const videoConfig = (url: string) => ({ url, zoom: 1, offsetX: 0, offsetY: 0 });

/** A theme's card ids: stable, so its joins can name them. */
const sceneCardId = (scene: Scene, index: number) => `${scene.id}-${index + 1}`;

/** The theme's first page of cards, with bookmark cards pointed at `folderIds` (in order). */
export function sceneWidgets(scene: Scene, folderIds: string[]): WidgetInstance[] {
  let video = 0;
  let photo = 0;
  const widgets: WidgetInstance[] = [];
  scene.cards.forEach((spec, index) => {
    const base = { id: sceneCardId(scene, index), type: spec.type, size: spec.size, pos: { x: spec.x, y: spec.y } };
    if (spec.type === "video") {
      widgets.push({ ...base, config: spec.config ? { ...spec.config } : videoConfig(scene.videos[video++ % scene.videos.length]) });
    } else if (spec.type === "photo") {
      widgets.push({ ...base, config: spec.config ? { ...spec.config } : { searchTerms: scene.photos[photo++ % scene.photos.length] } });
    } else if (spec.type === "bookmark") {
      // No folder for this slot: leave the spot empty rather than repeat one.
      const groupId = folderIds[spec.folder ?? 0];
      if (groupId) widgets.push({ ...base, config: { groupId } });
    } else {
      widgets.push({ ...base, config: { ...(spec.config ?? {}) } });
    }
  });
  return widgets;
}

/** Gives existing video and photo cards (stacks included) the theme's media, in order. */
function restyleMedia(widgets: WidgetInstance[], scene: Scene): WidgetInstance[] {
  let video = 0;
  let photo = 0;
  const visit = (list: WidgetInstance[]): WidgetInstance[] =>
    list.map((widget) => {
      if (widget.type === "video") return { ...widget, config: { ...widget.config, ...videoConfig(scene.videos[video++ % scene.videos.length]) } };
      if (widget.type === "photo") return { ...widget, config: { ...widget.config, searchTerms: scene.photos[photo++ % scene.photos.length] } };
      if (widget.type === "stack" && Array.isArray(widget.items)) return { ...widget, items: visit(widget.items) };
      return widget;
    });
  return visit(widgets);
}

export type SceneApplyMode = "look" | "layout";

type SettingsLike = Record<string, any>;

/** The theme's page size and joins, for the cards `sceneWidgets` made (joins to a skipped card are dropped). */
export function sceneLayout(scene: Scene, widgets: WidgetInstance[]): { columns: number; rows: number; joins: Join[] } {
  const ids = new Set(widgets.map((widget) => widget.id));
  const joins = (scene.joins ?? [])
    .map(([a, b, mode]): Join => (mode ? [sceneCardId(scene, a), sceneCardId(scene, b), mode] : [sceneCardId(scene, a), sceneCardId(scene, b)]))
    .filter(([a, b]) => ids.has(a) && ids.has(b));
  return { columns: scene.grid?.columns ?? 7, rows: scene.grid?.rows ?? 4, joins };
}

/**
 * Settings with a theme applied. "look": palette, mode, painting, and the
 * theme's videos and photo topics on the cards already there. "layout": all
 * of that plus the theme's own cards, page size and joins. Either way it's
 * the given dashboard's cards (main's unless said); nothing else changes.
 */
export function applyScene<T extends SettingsLike>(settings: T, id: SceneId, mode: SceneApplyMode, dashboardId: string = MAIN_DASHBOARD): T {
  const scene = getScene(id);
  if (!scene) return settings;
  const ui = { ...(settings.ui || {}), scene: scene.id, themePalette: scene.palette, themeMode: scene.mode };
  const themed = { ...settings, ui };
  if (mode === "look") {
    const current = readDashboard(settings, dashboardId).widgets;
    return writeDashboard(themed, dashboardId, { widgets: restyleMedia(current, scene) });
  }
  const folderIds = (Array.isArray(settings.bookmark) ? settings.bookmark : []).map((group: { id?: string }) => group?.id).filter(Boolean) as string[];
  const widgets = sceneWidgets(scene, folderIds);
  return writeDashboard(themed, dashboardId, { widgets, ...sceneLayout(scene, widgets) });
}
