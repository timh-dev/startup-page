import React from "react";
import { HiArrowUpRight, HiPlus } from "react-icons/hi2";
import { useFitCount } from "@/lib/use-fit-count";

function getParsableUrl(url: string | null | undefined) {
  if (typeof url !== "string") {
    return "";
  }

  const trimmed = url.trim();
  if (!trimmed) {
    return "";
  }

  return /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
}

export function getHostname(url: string | null | undefined) {
  try {
    return new URL(getParsableUrl(url)).hostname.replace(/^www\./, "");
  } catch (_error) {
    return "";
  }
}

export function faviconUrl(url: string, size = 64) {
  const host = getHostname(url);
  return host ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=${size}` : null;
}

export function faviconSrcSet(url: string) {
  const host = getHostname(url);

  if (!host) {
    return undefined;
  }

  return [
    `${faviconUrl(url, 32)} 1x`,
    `${faviconUrl(url, 64)} 2x`,
    `${faviconUrl(url, 128)} 3x`,
  ].join(", ");
}

export function faviconFallbackLabel(name: string, url: string) {
  const source = String(name || getHostname(url) || "?").trim();
  return (source.match(/[a-z0-9]/i)?.[0] || "?").toUpperCase();
}

function isIPv4(host: string) {

  return /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/.test(

    host

  );

}

function isIPv6(host: string) {

  // URL.hostname keeps the brackets around an IPv6 literal (e.g. "[::1]"),
  // which the bare address regex below doesn't account for.
  const stripped = host.replace(/^\[|\]$/g, "");

  return /^[0-9a-f:]+$/i.test(stripped) && stripped.includes(":");

}

export function isSelfHostedUrl(url: string) {

  try {

    const parsed = new URL(getParsableUrl(url));

    const host = parsed.hostname.toLowerCase();

    return (

      isIPv4(host) ||

      isIPv6(host) ||

      host === "localhost" ||

      host.endsWith(".local")

    );

  } catch (_error) {

    return false;

  }

}

export function LocalServiceStatus({ url, className = "size-3.5" }: { url: string; className?: string }) {
  const [online, setOnline] = React.useState(false);

  React.useEffect(() => {
    const requestUrl = getParsableUrl(url);

    if (!requestUrl) {
      setOnline(false);
      return undefined;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      controller.abort();
      setOnline(false);
    }, 2500);

    setOnline(false);

    fetch(requestUrl, {
      method: "HEAD",
      mode: "no-cors",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(() => {
        window.clearTimeout(timeout);
        setOnline(true);
      })
      .catch(() => {
        window.clearTimeout(timeout);
        setOnline(false);
      });

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [url]);

  const dotColor = online ? "#22c55e" : "#ef4444";

  return (
    <span
      className={`${className} inline-block shrink-0 rounded-full`}
      style={{ backgroundColor: dotColor }}
      title={`Local service ${online ? "online" : "offline"}`}
      aria-label={`Local service ${online ? "online" : "offline"}`}
    />
  );
}

interface BookmarkProps {
  title: string;
  content: Array<{ name: string; url: string }>;
  cardClass?: string;
  onTitleClick?: () => void;
  onQuickAdd?: () => void;
}

// Google's favicon service answers unknown or icon-less sites with a generic
// 16px globe, and many sites only publish 16px icons. Either looks blurry at
// this size, so those get a lettered tile instead.
const MIN_SHARP_FAVICON_PX = 32;

function BookmarkFavicon({ name, url }: { name: string; url: string }) {
  const [state, setState] = React.useState<"loading" | "ok" | "fallback">("loading");
  const src = faviconUrl(url);

  if (isSelfHostedUrl(url)) {
    return (
      <span className="bookmark-favicon-chip">
        <LocalServiceStatus url={url} className="size-2 rounded-full" />
      </span>
    );
  }

  if (!src || state === "fallback") {
    return (
      <span className="bookmark-favicon-chip bookmark-favicon-letter" style={{ "--letter-hue": hueFor(getHostname(url) || name) }}>
        {faviconFallbackLabel(name, url)}
      </span>
    );
  }

  return (
    <span className="bookmark-favicon-chip">
      <img
        src={src}
        srcSet={faviconSrcSet(url)}
        alt=""
        className="fade-in-image size-full object-contain"
        data-loaded={state === "ok"}
        onLoad={(event) => setState(event.currentTarget.naturalWidth < MIN_SHARP_FAVICON_PX ? "fallback" : "ok")}
        onError={() => setState("fallback")}
      />
    </span>
  );
}

/** A stable hue per site, so lettered tiles are distinguishable but calm. */
function hueFor(text: string) {
  let hash = 0;
  for (const char of text) hash = (hash * 31 + char.charCodeAt(0)) % 360;
  return hash;
}

const Bookmark = ({ title, content, cardClass, onTitleClick, onQuickAdd }: BookmarkProps) => {
  const titleContent = (
    <span className="bookmark-title eyebrow inline-flex max-w-full items-center gap-1">
      <span className="truncate">{title}</span>
      {onTitleClick && <HiArrowUpRight className="bookmark-title-arrow size-3 shrink-0" aria-hidden="true" />}
    </span>
  );

  // Show only the rows that fit; when some don't, the last row becomes a
  // "+N more" link to the folder instead of a half-visible bookmark.
  const listRef = React.useRef<HTMLDivElement>(null);
  const itemsRef = React.useRef<HTMLUListElement>(null);
  const fit = useFitCount(listRef, itemsRef, content.length);
  const shown = fit < content.length ? Math.max(0, fit - 1) : content.length;
  const visible = content.slice(0, shown);
  const hiddenCount = content.length - shown;

  return (
    <div className={cardClass || "surface-tile col-span-1 h-36 w-36 overflow-hidden rounded-[1.125rem]"}>
      <div className="bookmark-widget group/tile relative flex h-full flex-col">
        {onQuickAdd ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onQuickAdd();
            }}
            className="bookmark-quick-add"
            title="Add a bookmark to this folder"
            aria-label="Add a bookmark to this folder"
          >
            <HiPlus className="size-3.5" />
          </button>
        ) : null}
        <div className="bookmark-header">
          {onTitleClick ? (
            <button type="button" onClick={onTitleClick} className="bookmark-title-button" title="Open in Bookmarks">
              {titleContent}
            </button>
          ) : (
            titleContent
          )}
        </div>

        <div ref={listRef} className="bookmark-list min-h-0 flex-1 overflow-hidden">
          <ul ref={itemsRef} className="bookmark-items">
            {visible.map(({ name, url }, key) => (
              <li key={key}>
                <a href={url} className="bookmark-link" title={url}>
                  <BookmarkFavicon name={name} url={url} />
                  <span className="min-w-0">
                    <span className="bookmark-name block truncate">{name}</span>
                    <span className="bookmark-host block truncate">{getHostname(url)}</span>
                  </span>
                </a>
              </li>
            ))}
            {hiddenCount > 0 && (
              <li>
                {onTitleClick ? (
                  <button type="button" onClick={onTitleClick} className="bookmark-more">
                    +{hiddenCount} more
                  </button>
                ) : (
                  <span className="bookmark-more">+{hiddenCount} more</span>
                )}
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Bookmark;
