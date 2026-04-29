function getHostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch (_error) {
    return "";
  }
}

function faviconUrl(url) {
  const host = getHostname(url);
  return host ? `https://www.google.com/s2/favicons?domain=${host}&sz=16` : null;
}

const Bookmark = ({ title, content, cardClass }) => {
  return (
    <div
      className={
        cardClass ||
        "bg-primary text-primary-foreground rounded-xl col-span-1 h-36 w-36 overflow-hidden border border-border/50 shadow-lg"
      }
    >
      <div className="flex h-full flex-col">
        <div className="border-b border-primary-foreground/15 px-3 pt-2 pb-2">
          <div className="mt-1 truncate text-sm font-semibold leading-none text-primary-foreground">
            {title}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          <ul className="space-y-1">
            {content.map(({ name, url }, key) => (
              <li key={key}>
                <a
                  href={url}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-primary-foreground/10"
                  title={url}
                >
                  {faviconUrl(url) && (
                    <img
                      src={faviconUrl(url)}
                      alt=""
                      className="size-3.5 shrink-0 rounded-sm object-contain opacity-90"
                      onError={(e) => { e.currentTarget.style.display = "none"; }}
                    />
                  )}
                  <div className="min-w-0">
                    <div className="truncate text-xs font-medium leading-tight text-primary-foreground">
                      {name}
                    </div>
                    <div className="mt-0.5 truncate text-[10px] leading-none text-primary-foreground/65">
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
