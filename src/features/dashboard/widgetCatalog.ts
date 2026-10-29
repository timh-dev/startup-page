import type { WidgetType } from "@/lib/dashboard-dimensions";

// How the widget gallery groups and describes each widget type.
export const WIDGET_CATEGORIES = ["Time & sky", "Weather", "Links", "Reading", "Media", "Tools"] as const;
export type WidgetCategory = (typeof WIDGET_CATEGORIES)[number];

export const WIDGET_CATALOG: Record<WidgetType, { category: WidgetCategory; description: string }> = {
  clock: { category: "Time & sky", description: "Time and date, with analog and year views." },
  solarGraph: { category: "Time & sky", description: "The sun's path today, sunrise to sunset and twilight." },
  globe: { category: "Time & sky", description: "Day and night on a dotted Earth, with you pulsing on it." },
  timer: { category: "Time & sky", description: "A focus timer on a scrolling tape." },
  weather: { category: "Weather", description: "Conditions and a 5-day forecast over a live sky." },
  weatherV2: { category: "Weather", description: "Now, today's high and low, and the next hours as a line with the chance of rain." },
  airQuality: { category: "Weather", description: "Air quality index and particulates where you are." },
  search: { category: "Links", description: "Search with your choice of engines." },
  bookmark: { category: "Links", description: "One of your bookmark folders." },
  vault: { category: "Links", description: "Jump into your vault: links, code and templates." },
  headlines: { category: "Reading", description: "Top news headlines." },
  rss: { category: "Reading", description: "The latest from any RSS feed." },
  wikipedia: { category: "Reading", description: "Wikipedia's article of the day." },
  github: { category: "Reading", description: "Recent activity for a GitHub user." },
  photo: { category: "Media", description: "Scenic photos on a theme of your choosing." },
  video: { category: "Media", description: "A looping background video." },
  spotify: { category: "Media", description: "What's playing on Spotify." },
  iframe: { category: "Tools", description: "Embed any web page or a preset like Windy." },
  stack: { category: "Tools", description: "Several widgets in one tile; swipe between them." },
};
