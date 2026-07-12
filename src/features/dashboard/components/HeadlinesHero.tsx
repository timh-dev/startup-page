import React from "react";
import { HiChevronLeft, HiChevronRight } from "react-icons/hi2";

import { readSettings } from "@/lib/settings";

// Reddit blocks anonymous browser requests to its *.json endpoints (HTTP 403 with
// no CORS headers), so the headlines are loaded from the subreddit RSS feed through
// the same rss2json proxy the RSS feature panel uses.
function decodeEntities(value) {
  return typeof value === "string" ? value.replaceAll("&amp;", "&") : value;
}

function matchFromContent(content, pattern) {
  if (typeof content !== "string") {
    return null;
  }
  const match = content.match(pattern);
  return match ? match[1] : null;
}

function getArticleUrl(item) {
  // Reddit's RSS embeds the destination article as the "[link]" anchor; fall back
  // to the discussion permalink when a post links to Reddit itself.
  const external = matchFromContent(item.content, /<a[^>]+href="([^"]+)"[^>]*>\s*\[link\]/i);
  return external || item.link;
}

function getArticleImage(item) {
  const thumbnail = item.thumbnail || item.enclosure?.thumbnail;
  if (typeof thumbnail === "string" && thumbnail.startsWith("http")) {
    return decodeEntities(thumbnail);
  }

  const embedded = matchFromContent(item.content, /<img[^>]+src="([^"]+)"/i);
  if (embedded && embedded.startsWith("http")) {
    return decodeEntities(embedded);
  }

  return null;
}

function getSourceLabel(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch (_error) {
    return "reddit.com";
  }
}

function formatPublishedLabel(pubDate) {
  if (!pubDate) {
    return "";
  }

  // rss2json returns UTC timestamps formatted as "YYYY-MM-DD HH:MM:SS".
  const parsed = new Date(`${pubDate.replace(" ", "T")}Z`);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return parsed.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function normalizeArticle(item) {
  const url = getArticleUrl(item);
  return {
    id: item.guid || url,
    title: item.title,
    url,
    image: getArticleImage(item),
    source: getSourceLabel(url),
    publishedLabel: formatPublishedLabel(item.pubDate),
  };
}

export default function HeadlinesHero() {
  const settings = React.useMemo(() => readSettings(), []);
  const subreddit = settings.news?.subreddit || "worldnews";
  const rotationSeconds = Math.max(Number(settings.news?.rotationSeconds || 8), 4);
  const [articles, setArticles] = React.useState([]);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [status, setStatus] = React.useState("loading");
  const [progressKey, setProgressKey] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;

    async function loadHeadlines() {
      setStatus("loading");

      try {
        const feedUrl = `https://www.reddit.com/r/${subreddit}/.rss`;
        const response = await fetch(
          `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}`
        );
        const data = await response.json();
        if (data.status !== "ok") {
          throw new Error(data.message || "Feed error");
        }

        const nextArticles = (data.items || [])
          .map(normalizeArticle)
          .filter((article) => article.title && article.image);

        if (!cancelled) {
          setArticles(nextArticles);
          setActiveIndex(0);
          setProgressKey((value) => value + 1);
          setStatus(nextArticles.length ? "ready" : "empty");
        }
      } catch (_error) {
        if (!cancelled) {
          setArticles([]);
          setStatus("error");
        }
      }
    }

    loadHeadlines();
    return () => {
      cancelled = true;
    };
  }, [subreddit]);

  React.useEffect(() => {
    if (articles.length <= 1) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % articles.length);
      setProgressKey((value) => value + 1);
    }, rotationSeconds * 1000);

    return () => window.clearInterval(intervalId);
  }, [articles, rotationSeconds]);

  const changeArticle = React.useCallback(
    (direction) => {
      if (!articles.length) {
        return;
      }

      setActiveIndex((current) => (current + direction + articles.length) % articles.length);
      setProgressKey((value) => value + 1);
    },
    [articles]
  );

  if (status === "loading") {
    return (
      <div className="headlines-hero flex h-full w-full items-end overflow-hidden rounded-[inherit] bg-[radial-gradient(circle_at_top,_color-mix(in_oklab,var(--color-primary)_30%,transparent),transparent_40%),linear-gradient(160deg,color-mix(in_oklab,var(--color-card)_88%,black_12%),color-mix(in_oklab,var(--color-accent)_35%,var(--color-card)))]">
        <div className="w-full space-y-3">
          <div className="h-3 w-24 rounded-full bg-white/20" />
          <div className="h-8 w-4/5 rounded-full bg-white/25" />
          <div className="h-8 w-3/5 rounded-full bg-white/15" />
        </div>
      </div>
    );
  }

  if (!articles.length) {
    return (
      <div className="headlines-hero flex h-full w-full items-end overflow-hidden rounded-[inherit] bg-[linear-gradient(160deg,color-mix(in_oklab,var(--color-secondary)_55%,var(--color-card)),color-mix(in_oklab,var(--color-accent)_35%,var(--color-card)))]">
        <div className="headlines-card rounded-2xl border border-white/10 bg-black/25 text-white backdrop-blur-sm">
          <p className="headlines-kicker font-semibold uppercase text-white/70">Headlines</p>
          <p className="headlines-empty font-semibold">No image-led headlines available right now.</p>
        </div>
      </div>
    );
  }

  const article = articles[activeIndex];

  return (
    <a
      className="group relative block h-full w-full overflow-hidden rounded-[inherit] !text-white"
      href={article.url}
      target="_blank"
      rel="noreferrer"
      style={{ color: "#ffffff" }}
    >
      <img
        src={article.image}
        alt={article.title}
        className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]"
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.22),rgba(15,23,42,0.38)_34%,rgba(2,6,23,0.9)_100%)]" />

      <div className="headlines-topbar absolute flex items-center justify-between">
        <div className="headlines-pill rounded-full border border-white/25 bg-white/8 font-semibold uppercase !text-white backdrop-blur-md" style={{ color: "#ffffff" }}>
          {subreddit}
        </div>
        <div className="headlines-controls flex items-center">
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              changeArticle(-1);
            }}
            className="headlines-nav rounded-full border border-white/25 bg-white/8 !text-white backdrop-blur-md transition hover:bg-white/14"
            aria-label="Previous headline"
          >
            <HiChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              changeArticle(1);
            }}
            className="headlines-nav rounded-full border border-white/25 bg-white/8 !text-white backdrop-blur-md transition hover:bg-white/14"
            aria-label="Next headline"
          >
            <HiChevronRight className="size-4" />
          </button>
        </div>
      </div>

      <div className="headlines-bottom absolute inset-x-0 bottom-0">
        <div className="headlines-card overflow-hidden rounded-[1.4rem] border border-white/20 bg-white/8 !text-white shadow-xl backdrop-blur-xl" style={{ color: "#ffffff" }}>
          <div className="headlines-meta flex items-center justify-between gap-3 uppercase !text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.65)]" style={{ color: "#ffffff" }}>
            <span style={{ color: "#ffffff" }}>{article.source}</span>
            <span style={{ color: "#ffffff" }}>{article.publishedLabel}</span>
          </div>
          <h2 className="headlines-title max-w-3xl font-semibold leading-tight !text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.82)]" style={{ color: "#ffffff" }}>
            {article.title}
          </h2>
          <div className="headlines-progress overflow-hidden rounded-full bg-white/20">
            <div
              key={progressKey}
              className="h-full rounded-full bg-white/85 animate-[headline-progress_var(--headline-duration)_linear_forwards]"
              style={{ "--headline-duration": `${rotationSeconds}s` }}
            />
          </div>
        </div>
      </div>
    </a>
  );
}
