import React from "react";
import { HiChevronLeft, HiChevronRight } from "react-icons/hi2";

import { readSettings } from "@/lib/settings";

const FALLBACK_IMAGE =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/Google.png/640px-Google.png";

function getValidImage(post) {
  const previewSource = post.preview?.images?.[0]?.source?.url;
  if (previewSource) {
    return previewSource.replaceAll("&amp;", "&");
  }

  if (typeof post.thumbnail === "string" && post.thumbnail.startsWith("http")) {
    return post.thumbnail;
  }

  return FALLBACK_IMAGE;
}

function normalizeArticle(post) {
  return {
    id: post.id,
    title: post.title,
    url: post.url_overridden_by_dest || post.url || `https://www.reddit.com${post.permalink}`,
    image: getValidImage(post),
    source: post.domain || "reddit.com",
    publishedLabel: new Date((post.created_utc || Date.now() / 1000) * 1000).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    }),
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
        const response = await fetch(`https://www.reddit.com/r/${subreddit}.json?raw_json=1&limit=25`);
        const data = await response.json();
        const nextArticles = (data?.data?.children || [])
          .map((entry) => entry.data)
          .filter((post) => !post.stickied)
          .filter((post) => post.title)
          .map(normalizeArticle);

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
