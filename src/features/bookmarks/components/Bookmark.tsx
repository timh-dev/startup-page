import React from "react";

function getParsableUrl(url) {
  if (typeof url !== "string") {
    return "";
  }

  const trimmed = url.trim();
  if (!trimmed) {
    return "";
  }

  return /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
}

export function getHostname(url) {
  try {
    return new URL(getParsableUrl(url)).hostname.replace(/^www\./, "");
  } catch (_error) {
    return "";
  }
}

export function faviconUrl(url, size = 64) {
  const host = getHostname(url);
  return host ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=${size}` : null;
}

export function faviconSrcSet(url) {
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

export function faviconFallbackLabel(name, url) {
  const source = String(name || getHostname(url) || "?").trim();
  return (source.match(/[a-z0-9]/i)?.[0] || "?").toUpperCase();
}

function isIPv4(host) {

  return /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/.test(

    host

  );

}

function isIPv6(host) {

  return /^[0-9a-f:]+$/i.test(host) && host.includes(":");

}

export function isSelfHostedUrl(url) {

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

export function LocalServiceStatus({ url, className = "size-3.5" }) {
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

const Bookmark = ({ title, content, cardClass, onTitleClick }) => {
  const titleContent = (
    <div className="bookmark-title truncate text-center font-semibold leading-none text-primary-foreground">
      {title}
    </div>
  );

  return (
    <div
      className={
        cardClass ||
        "bg-primary text-primary-foreground rounded-xl col-span-1 h-36 w-36 overflow-hidden border border-border/50 shadow-lg"
      }
    >
      <div className="bookmark-widget flex h-full flex-col">
        <div className="bookmark-header border-b border-primary-foreground/15">
          {onTitleClick ? (
            <button
              type="button"
              onClick={onTitleClick}
              className="block w-full min-w-0 text-center transition hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-primary-foreground/45"
              title="Open bookmark view"
            >
              {titleContent}
            </button>
          ) : (
            titleContent
          )}
        </div>

        <div className="bookmark-list min-h-0 flex-1 overflow-y-auto">
          <ul className="bookmark-items">
            {content.map(({ name, url }, key) => (
              <li key={key}>
                <a
                  href={url}
                  className="bookmark-link flex items-center rounded-lg transition hover:bg-primary-foreground/10"
                  title={url}
                >
                  {isSelfHostedUrl(url) ? (
                    <LocalServiceStatus url={url} className="bookmark-favicon inline-block shrink-0 rounded-full" />
                  ) : faviconUrl(url) ? (
                    <img
                      src={faviconUrl(url)}
                      srcSet={faviconSrcSet(url)}
                      alt=""
                      className="bookmark-favicon shrink-0 rounded-sm object-contain opacity-90"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                        e.currentTarget.nextElementSibling?.removeAttribute("hidden");
                      }}
                    />
                  ) : null}
                  {!isSelfHostedUrl(url) && (
                    <span hidden className="bookmark-favicon-fallback bookmark-favicon shrink-0">
                      {faviconFallbackLabel(name, url)}
                    </span>
                  )}
                  <div className="min-w-0">
                    <div className="bookmark-name truncate font-medium leading-tight text-primary-foreground">
                      {name}
                    </div>
                    <div className="bookmark-host truncate leading-none text-primary-foreground/65">
                      {getHostname(url)}
                    </div>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Bookmark;
