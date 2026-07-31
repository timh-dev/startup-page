// Minimal, dependency-free Markdown renderer for the vault's template
// preview. Deliberately covers only the constructs personal notes/prompts
// actually use (headers, bold/italic, inline+fenced code, links, lists) —
// not a spec-complete parser. Input is escaped before any tag is emitted, so
// raw HTML in a saved item can't inject markup.
function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderInline(text: string) {
  let html = escapeHtml(text);
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  html = html.replace(/(?<!\w)_([^_]+)_(?!\w)/g, "<em>$1</em>");
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
  return html;
}

export function renderMarkdownToHtml(source: string): string {
  const lines = (source || "").replace(/\r\n/g, "\n").split("\n");
  const blocks: string[] = [];
  let paragraph: string[] = [];
  let list: { type: "ul" | "ol"; items: string[] } | null = null;
  let codeFence: { lang: string; lines: string[] } | null = null;

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push(`<p>${paragraph.map(renderInline).join("<br />")}</p>`);
      paragraph = [];
    }
  };

  const flushList = () => {
    if (list) {
      const items = list.items.map((item) => `<li>${renderInline(item)}</li>`).join("");
      blocks.push(`<${list.type}>${items}</${list.type}>`);
      list = null;
    }
  };

  for (const rawLine of lines) {
    if (codeFence) {
      if (/^```/.test(rawLine)) {
        blocks.push(`<pre><code>${escapeHtml(codeFence.lines.join("\n"))}</code></pre>`);
        codeFence = null;
      } else {
        codeFence.lines.push(rawLine);
      }
      continue;
    }

    const fenceMatch = rawLine.match(/^```(\w*)/);
    if (fenceMatch) {
      flushParagraph();
      flushList();
      codeFence = { lang: fenceMatch[1] || "", lines: [] };
      continue;
    }

    const headerMatch = rawLine.match(/^(#{1,3})\s+(.*)$/);
    if (headerMatch) {
      flushParagraph();
      flushList();
      const level = headerMatch[1].length;
      blocks.push(`<h${level}>${renderInline(headerMatch[2])}</h${level}>`);
      continue;
    }

    const ulMatch = rawLine.match(/^[-*]\s+(.*)$/);
    const olMatch = rawLine.match(/^\d+\.\s+(.*)$/);
    if (ulMatch || olMatch) {
      flushParagraph();
      const type = ulMatch ? "ul" : "ol";
      const content = (ulMatch || olMatch)![1];
      if (!list || list.type !== type) {
        flushList();
        list = { type, items: [] };
      }
      list.items.push(content);
      continue;
    }

    if (!rawLine.trim()) {
      flushParagraph();
      flushList();
      continue;
    }

    flushList();
    paragraph.push(rawLine);
  }

  if (codeFence) {
    blocks.push(`<pre><code>${escapeHtml(codeFence.lines.join("\n"))}</code></pre>`);
  }
  flushParagraph();
  flushList();

  return blocks.join("\n");
}
