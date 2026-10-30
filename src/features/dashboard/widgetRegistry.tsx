// Every widget type the dashboard can show, in the order the "add widget"
// picker lists them. Each type's definition, render and config fields live in
// its own file under ./widgets.
import type { WidgetType } from "@/lib/dashboard-dimensions";
import type { WidgetTypeDef } from "./widgets/types";
import { airQualityWidget } from "./widgets/airQuality";
import { bookmarkWidget } from "./widgets/bookmark";
import { clockWidget } from "./widgets/clock";
import { githubWidget } from "./widgets/github";
import { globeWidget } from "./widgets/globe";
import { headlinesWidget } from "./widgets/headlines";
import { iframeWidget } from "./widgets/iframe";
import { photoWidget } from "./widgets/photo";
import { rssWidget } from "./widgets/rss";
import { searchWidget } from "./widgets/search";
import { solarGraphWidget } from "./widgets/solarGraph";
import { spotifyWidget } from "./widgets/spotify";
import { stackWidget } from "./widgets/stack";
import { timerWidget } from "./widgets/timer";
import { vaultWidget } from "./widgets/vault";
import { videoWidget } from "./widgets/video";
import { weatherV2Widget, weatherWidget } from "./widgets/weather";
import { wikipediaWidget } from "./widgets/wikipedia";

export type { WidgetTypeDef } from "./widgets/types";

export const WIDGET_TYPES: WidgetTypeDef[] = [
  clockWidget,
  searchWidget,
  weatherWidget,
  weatherV2Widget,
  bookmarkWidget,
  photoWidget,
  vaultWidget,
  solarGraphWidget,
  globeWidget,
  videoWidget,
  iframeWidget,
  stackWidget,
  headlinesWidget,
  timerWidget,
  wikipediaWidget,
  rssWidget,
  githubWidget,
  spotifyWidget,
  airQualityWidget,
];

const WIDGET_TYPES_BY_KEY: Record<string, WidgetTypeDef> = Object.fromEntries(
  WIDGET_TYPES.map((def) => [def.type, def]),
);

export function getWidgetType(type: WidgetType): WidgetTypeDef {
  return WIDGET_TYPES_BY_KEY[type] || WIDGET_TYPES[0];
}
