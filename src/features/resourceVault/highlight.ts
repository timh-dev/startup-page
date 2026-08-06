import Prism from "prismjs";
import "prismjs/components/prism-clike";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-python";
import "prismjs/components/prism-sql";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-go";
import "prismjs/components/prism-rust";
import "prismjs/components/prism-java";
import "prismjs/components/prism-c";
import "prismjs/components/prism-cpp";
import "prismjs/components/prism-css";
import "prismjs/components/prism-markup";
import "prismjs/components/prism-json";
import "prismjs/components/prism-yaml";
import "prismjs/components/prism-ruby";
// php embeds into markup (e.g. <?php ... ?> inside HTML) via the
// markup-templating language, which it requires to already be registered —
// without this import, evaluating prism-php throws at module-load time.
import "prismjs/components/prism-markup-templating";
import "prismjs/components/prism-php";

// Maps our CODE_LANGUAGES codes (constants.ts) to Prism's grammar names —
// they mostly match, but a few don't (our "html" is Prism's "markup", our
// "rs"/"rb" are Prism's "rust"/"ruby").
const PRISM_LANGUAGE_BY_CODE: Record<string, string> = {
  ts: "typescript",
  js: "javascript",
  py: "python",
  sql: "sql",
  bash: "bash",
  go: "go",
  rs: "rust",
  java: "java",
  c: "c",
  cpp: "cpp",
  css: "css",
  html: "markup",
  json: "json",
  yaml: "yaml",
  rb: "ruby",
  php: "php",
};

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Highlights a snippet for read-only display (list preview, preview
// dialog) — never the live composer textarea, which stays a plain
// <textarea> since overlaying highlighted markup on an editable field needs
// its own scroll/metrics-synced overlay, a bigger feature than "highlight
// what's already saved". Falls back to escaped plain text for a custom
// ("Other...") language or no language at all, so an unrecognized snippet
// never breaks the preview.
export function highlightCode(code: string, language: string | null | undefined): string {
  const grammarName = language ? PRISM_LANGUAGE_BY_CODE[language] : undefined;
  const grammar = grammarName ? Prism.languages[grammarName] : undefined;

  if (!grammar || !grammarName) {
    return escapeHtml(code);
  }

  return Prism.highlight(code, grammar, grammarName);
}
