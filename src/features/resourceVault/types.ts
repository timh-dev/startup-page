export type VaultItemKind = "code" | "template";

export type TemplateSubtype = "prompt" | "email" | "expansion" | "doc";

export interface VaultItem {
  id: string;
  kind: VaultItemKind;
  title: string;
  description: string;
  body: string;
  language: string;
  templateType: TemplateSubtype;
  subject: string;
  trigger: string;
  createdAt: string;
  updatedAt: string;
}
