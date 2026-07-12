import React from "react";
import { readSettings } from "@/lib/settings";
import { fetchRssFeed } from "@/lib/rss";

function timeAgo(dateStr) {
  const s = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function RSSFeed() {
  const settings = React.useMemo(() => readSettings(), []);
  const feedUrl = settings.featurePanel?.rssFeedUrl;
  const [feed, setFeed] = React.useState(null);
  const [items, setItems] = React.useState([]);
  const [status, setStatus] = React.useState("loading");

  React.useEffect(() => {
    if (!feedUrl) { setStatus("no-feed"); return; }
    let cancelled = false;

    async function load() {
      try {
        const { feed: parsedFeed, items: parsedItems } = await fetchRssFeed(feedUrl, { limit: 12 });
        if (cancelled) return;
        setFeed(parsedFeed);
        setItems(parsedItems);
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    }

    load();
    return () => { cancelled = true; };
  }, [feedUrl]);

  if (status === "no-feed") {
    return (
      <div className="rss-feed flex h-full w-full items-center justify-center rounded-[inherit] bg-card text-center">
        <div>
          <p className="rss-title font-semibold text-foreground">RSS Feed</p>
          <p className="rss-subtitle text-muted-foreground">Set an RSS feed URL in Settings, Content, Feature Panel.</p>
        </div>
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div className="rss-feed flex h-full w-full items-center justify-center rounded-[inherit] bg-card">
        <span className="rss-subtitle text-muted-foreground">Loading feed...</span>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="rss-feed flex h-full w-full items-center justify-center rounded-[inherit] bg-card text-center">
        <span className="rss-subtitle text-muted-foreground">Could not load feed. Check the URL in Settings.</span>
      </div>
    );
  }

  return (
    <div className="rss-feed flex h-full w-full flex-col rounded-[inherit] bg-card">
      <div className="rss-header flex items-center border-b border-border/50">
        {feed?.image && (
          <img src={feed.image} alt="" className="rss-feed-icon shrink-0 rounded object-cover" />
        )}
        <p className="rss-feed-title truncate font-semibold uppercase text-muted-foreground">
          {feed?.title || "RSS Feed"}
        </p>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="divide-y divide-border/30">
          {items.map((item, i) => (
            <a
              key={i}
              href={item.link}
              target="_blank"
              rel="noreferrer"
              className="rss-item flex items-start transition-colors hover:bg-accent/30"
            >
              {item.thumbnail && (
                <img src={item.thumbnail} alt="" className="rss-thumbnail shrink-0 rounded-md object-cover" />
              )}
              <div className="min-w-0 flex-1">
                <p className="rss-item-title line-clamp-2 font-medium leading-snug text-foreground">{item.title}</p>
                <div className="rss-item-meta flex items-center text-muted-foreground">
                  {item.author && <span className="truncate">{item.author}</span>}
                  {item.pubDate && <span className="shrink-0">{timeAgo(item.pubDate)}</span>}
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
