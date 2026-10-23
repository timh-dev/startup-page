import { HiOutlineCodeBracketSquare } from "react-icons/hi2";
import GitHubActivity from "@/features/dashboard/components/GitHubActivity";
import { TextField } from "./TextField";
import { defineWidget } from "./types";

interface GitHubConfig {
  username?: string | null;
}

export const githubWidget = defineWidget<GitHubConfig>({
  type: "github",
  label: "GitHub activity",
  icon: HiOutlineCodeBracketSquare,
  defaultSize: "small",
  makeDefaultConfig: () => ({ username: null }),
  Render: ({ instance, cardClass }) => (
    <div className={cardClass}><GitHubActivity username={(instance.config as GitHubConfig).username} /></div>
  ),
  ConfigFields: ({ config, onChange }) => (
    <TextField
      id="github-username"
      label="GitHub username"
      value={config.username || ""}
      placeholder="torvalds"
      onChange={(value) => onChange({ ...config, username: value || null })}
    />
  ),
});
