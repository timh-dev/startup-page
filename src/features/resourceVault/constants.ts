import {
  HiOutlineCodeBracketSquare,
  HiOutlineDocumentText,
} from "react-icons/hi2";
import type { TemplateSubtype, VaultItemKind } from "./types";

export const DEFAULT_READ_TAGS = [
  "Read",
  "Watch",
  "Listen",
  "Browse",
  "Use",
  "Build",
  "Learn",
  "Join",
  "Follow",
  "Travel",
  "Work",
  "Reference",
] as const;

export const READ_TAG_COLORS: Record<string, string> = {
  Read: "read-tag-read",
  Watch: "read-tag-watch",
  Listen: "read-tag-listen",
  Browse: "read-tag-browse",
  Use: "read-tag-use",
  Build: "read-tag-build",
  Learn: "read-tag-learn",
  Join: "read-tag-join",
  Follow: "read-tag-follow",
  Travel: "read-tag-travel",
  Work: "read-tag-work",
  Reference: "read-tag-reference",
};

export interface VaultKindDef {
  kind: VaultItemKind;
  label: string;
  icon: typeof HiOutlineCodeBracketSquare;
  colorClass: string;
  bodyLabel: string;
  bodyPlaceholder: string;
  showLanguage: boolean;
  languagePlaceholder?: string;
  markdown: boolean;
  emptyTitle: string;
  emptyHint: string;
}

export const VAULT_KIND_ORDER: VaultItemKind[] = ["code", "template"];

export const VAULT_KIND_DEFS: Record<VaultItemKind, VaultKindDef> = {
  code: {
    kind: "code",
    label: "Code",
    icon: HiOutlineCodeBracketSquare,
    colorClass: "vault-kind-code",
    bodyLabel: "Code",
    bodyPlaceholder: "Paste a snippet, query, or shell command...",
    showLanguage: true,
    languagePlaceholder: "ts, py, sql, bash...",
    markdown: false,
    emptyTitle: "No code yet",
    emptyHint: "Save a snippet, query, or command you reach for often.",
  },
  template: {
    kind: "template",
    label: "Templates",
    icon: HiOutlineDocumentText,
    colorClass: "vault-kind-template",
    bodyLabel: "Body",
    bodyPlaceholder: "Write the prompt, email, reply, or doc (Markdown supported)...",
    showLanguage: false,
    markdown: true,
    emptyTitle: "No templates yet",
    emptyHint: "Save a prompt, email, canned reply, or doc skeleton.",
  },
};

export interface TemplateSubtypeDef {
  value: TemplateSubtype;
  label: string;
  showSubject: boolean;
  showTrigger: boolean;
}

export const TEMPLATE_SUBTYPES: TemplateSubtypeDef[] = [
  { value: "prompt", label: "Prompt", showSubject: false, showTrigger: false },
  { value: "email", label: "Email", showSubject: true, showTrigger: false },
  { value: "expansion", label: "Expansion", showSubject: false, showTrigger: true },
  { value: "doc", label: "Doc", showSubject: false, showTrigger: false },
];

export const TEMPLATE_SUBTYPE_LABELS: Record<TemplateSubtype, string> = {
  prompt: "Prompt",
  email: "Email",
  expansion: "Expansion",
  doc: "Doc",
};
