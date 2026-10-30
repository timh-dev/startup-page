import { HiOutlineNewspaper } from "react-icons/hi2";
import HeadlinesHero from "@/features/dashboard/components/HeadlinesHero";
import { TextField } from "./TextField";
import { defineWidget } from "./types";

interface HeadlinesConfig {
  subreddit?: string | null;
  rotationSeconds?: number | null;
}

function HeadlinesConfigFields({ config, onChange }: { config: HeadlinesConfig; onChange: (next: HeadlinesConfig) => void }) {
  return (
    <div className="grid gap-3">
      <TextField
        id="headlines-subreddit"
        label="Subreddit"
        value={config.subreddit || ""}
        placeholder="worldnews"
        onChange={(value) => onChange({ ...config, subreddit: value || null })}
      />
      <TextField
        id="headlines-rotation"
        label="Rotation seconds"
        value={config.rotationSeconds != null ? String(config.rotationSeconds) : ""}
        placeholder="8"
        onChange={(value) => onChange({ ...config, rotationSeconds: value === "" ? null : Number(value) })}
      />
    </div>
  );
}

export const headlinesWidget = defineWidget<HeadlinesConfig>({
  type: "headlines",
  label: "Headlines",
  icon: HiOutlineNewspaper,
  defaultSize: "small",
  makeDefaultConfig: () => ({}),
  Render: ({ instance, cardClass }) => {
    const config = instance.config as HeadlinesConfig;
    return (
      <div className={cardClass}>
        <HeadlinesHero subreddit={config.subreddit} rotationSeconds={config.rotationSeconds} />
      </div>
    );
  },
  ConfigFields: HeadlinesConfigFields,
});
