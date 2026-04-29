import React from "react";
import { readSettings } from "@/lib/settings";

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
        const res = await fetch(
          `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}&count=12`
        );
        const data = await res.json();
        if (cancelled) return;
        if (data.status !== "ok") throw new Error(data.message || "Feed error");
        setFeed(data.feed);
        setItems(data.items || []);
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
      <div className="flex h-full w-full items-center justify-center rounded-[inherit] bg-card p-6 text-center">
        <div>
          <p className="text-sm font-semibold text-foreground">RSS Feed</p>
          <p className="mt-1 text-xs text-muted-foreground">Set an RSS feed URL in Settings → Content → Feature Panel.</p>
        </div>
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-[inherit] bg-card">
        <span className="text-xs text-muted-foreground">Loading feed…</span>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-[inherit] bg-card p-4 text-center">
        <span className="text-xs text-muted-foreground">Could not load feed. Check the URL in Settings.</span>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col rounded-[inherit] bg-card">
      <div className="flex items-center gap-2 border-b border-border/50 px-4 py-2.5">
        {feed?.image && (
          <img src={feed.image} alt="" className="size-4 shrink-0 rounded object-cover" />
        )}
        <p className="truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
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
              className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-accent/30"
            >
              {item.thumbnail && (
                <img src={item.thumbnail} alt="" className="mt-0.5 size-10 shrink-0 rounded-md object-cover" />
              )}
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-xs font-medium leading-snug text-foreground">{item.title}</p>
                <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
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
