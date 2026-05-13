import React from "react";

export default function WikipediaToD() {
  const [article, setArticle] = React.useState(null);
  const [status, setStatus] = React.useState("loading");

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, "0");
        const dd = String(now.getDate()).padStart(2, "0");
        const res = await fetch(
          `https://en.wikipedia.org/api/rest_v1/feed/featured/${yyyy}/${mm}/${dd}`,
          { headers: { Accept: "application/json" } }
        );
        const data = await res.json();
        if (cancelled) return;
        const tfa = data.tfa;
        if (!tfa) { setStatus("empty"); return; }
        setArticle({
          title: tfa.normalizedtitle || tfa.title,
          extract: tfa.extract,
          thumbnail: tfa.thumbnail?.source,
          url: tfa.content_urls?.desktop?.page,
        });
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  if (status !== "ready" || !article) {
    const msg = status === "loading" ? "Loading…" : "Featured article unavailable.";
    return (
      <div className="flex h-full w-full items-center justify-center rounded-[inherit] bg-card">
        <span className="text-xs text-muted-foreground">{msg}</span>
      </div>
    );
  }

  return (
    <a
      href={article.url}
      target="_blank"
      rel="noreferrer"
      className="group flex h-full w-full overflow-hidden rounded-[inherit] bg-card text-foreground"
    >
      {article.thumbnail && (
        <div className="w-2/5 shrink-0 overflow-hidden">
          <img
            src={article.thumbnail}
            alt={article.title}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        </div>
      )}
      <div className="flex flex-1 flex-col justify-between overflow-hidden p-5">
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Wikipedia · Featured Article
          </p>
          <h2 className="line-clamp-2 text-base font-bold leading-snug text-foreground transition-colors group-hover:text-primary">
            {article.title}
          </h2>
          <p className="mt-2 line-clamp-5 text-xs leading-relaxed text-muted-foreground">
            {article.extract}
          </p>
        </div>
        <span className="text-xs font-medium text-primary group-hover:underline">Read full article →</span>
      </div>
    </a>
  );
}
