import { HiOutlineRss } from "react-icons/hi2";
import RSSFeed from "@/features/dashboard/components/RSSFeed";
import { TextField } from "./TextField";
import { defineWidget } from "./types";

interface RSSConfig {
  feedUrl?: string | null;
}

export const rssWidget = defineWidget<RSSConfig>({
  type: "rss",
  label: "RSS feed",
  icon: HiOutlineRss,
  defaultSize: "small",
  makeDefaultConfig: () => ({ feedUrl: null }),
  Render: ({ instance, cardClass }) => (
    <div className={cardClass}><RSSFeed feedUrl={(instance.config as RSSConfig).feedUrl} /></div>
  ),
  ConfigFields: ({ config, onChange }) => (
    <TextField
      id="rss-url"
      label="RSS/Atom feed URL"
      value={config.feedUrl || ""}
      placeholder="https://example.com/feed.xml"
      onChange={(value) => onChange({ ...config, feedUrl: value || null })}
    />
  ),
});
