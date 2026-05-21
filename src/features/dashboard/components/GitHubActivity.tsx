import React from "react";
import { readSettings } from "@/lib/settings";

function timeAgo(dateStr) {
  const s = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function describeEvent(event) {
  const p = event.payload || {};
  switch (event.type) {
    case "PushEvent": {
      const n = p.commits?.length ?? 0;
      const msg = p.commits?.[0]?.message?.split("\n")[0];
      return { icon: "📦", text: `${n} commit${n !== 1 ? "s" : ""}${msg ? ` · ${msg}` : ""}` };
    }
    case "CreateEvent":
      return { icon: "✨", text: `Created ${p.ref_type || "branch"}${p.ref ? ` ${p.ref}` : ""}` };
    case "PullRequestEvent":
      return { icon: "🔀", text: `${p.action} PR: ${p.pull_request?.title || ""}` };
    case "IssuesEvent":
      return { icon: "🐛", text: `${p.action} issue: ${p.issue?.title || ""}` };
    case "IssueCommentEvent":
      return { icon: "💬", text: `Commented: ${p.issue?.title || ""}` };
    case "WatchEvent":
      return { icon: "⭐", text: "Starred" };
    case "ForkEvent":
      return { icon: "🍴", text: `Forked → ${p.forkee?.full_name || ""}` };
    case "ReleaseEvent":
      return { icon: "🚀", text: `Released ${p.release?.tag_name || ""}` };
    default:
      return { icon: "🔧", text: event.type.replace("Event", "") };
  }
}

export default function GitHubActivity() {
  const settings = React.useMemo(() => readSettings(), []);
  const username = settings.featurePanel?.githubUsername;
  const [events, setEvents] = React.useState([]);
  const [status, setStatus] = React.useState("loading");

  React.useEffect(() => {
    if (!username) { setStatus("no-user"); return; }
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`https://api.github.com/users/${username}/events?per_page=20`);
        if (!res.ok) throw new Error("GitHub API error");
        const data = await res.json();
        if (cancelled) return;
        // Deduplicate: same repo + type + same hour
        const seen = new Set();
        const filtered = data.filter((e) => {
          const key = `${e.repo?.name}:${e.type}:${e.created_at?.slice(0, 13)}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        }).slice(0, 10);
        setEvents(filtered);
        setStatus(filtered.length ? "ready" : "empty");
      } catch {
        if (!cancelled) setStatus("error");
      }
    }

    load();
    return () => { cancelled = true; };
  }, [username]);

  if (status === "no-user") {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-[inherit] bg-card p-6 text-center">
        <div>
          <p className="text-sm font-semibold text-foreground">GitHub Activity</p>
          <p className="mt-1 text-xs text-muted-foreground">Set a GitHub username in Settings → Content → Feature Panel.</p>
        </div>
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-[inherit] bg-card">
        <span className="text-xs text-muted-foreground">Loading GitHub activity…</span>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col rounded-[inherit] bg-card">
      <div className="flex items-center gap-2 border-b border-border/50 px-4 py-2.5">
        <span>🐙</span>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          GitHub ·{" "}
          <a href={`https://github.com/${username}`} target="_blank" rel="noreferrer" className="text-foreground transition-colors hover:text-primary">
            {username}
          </a>
        </p>
      </div>
      <div className="flex-1 overflow-y-auto">
        {events.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <span className="text-xs text-muted-foreground">No recent public activity.</span>
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {events.map((event) => {
              const { icon, text } = describeEvent(event);
              const repoShort = event.repo?.name?.split("/")?.[1] || event.repo?.name;
              return (
                <a
                  key={event.id}
                  href={`https://github.com/${event.repo?.name}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-start gap-3 px-4 py-2.5 transition-colors hover:bg-accent/30"
                >
                  <span className="mt-0.5 shrink-0">{icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-xs font-medium text-foreground">{repoShort}</span>
                      <span className="shrink-0 text-[10px] text-muted-foreground">{timeAgo(event.created_at)}</span>
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{text}</p>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
