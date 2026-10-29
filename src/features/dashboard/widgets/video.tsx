import React from "react";
import { HiOutlineVideoCamera } from "react-icons/hi2";
import desert from "@/assets/media/desert.mp4";
import { useSettingsStore } from "@/features/settings/stores";
import { TextField } from "./TextField";
import { defineWidget, type WidgetRenderProps } from "./types";

interface VideoConfig {
  url?: string;
  zoom?: number;
  offsetX?: number;
  offsetY?: number;
}

function VideoRender({ instance, cardClass }: WidgetRenderProps) {
  const config = instance.config as VideoConfig;
  const globalUrls = useSettingsStore((state) => state.settings.decorativeVideo?.urls) as string[] | undefined;
  const [fallbackUrl] = React.useState(() => {
    const pool = Array.isArray(globalUrls) ? globalUrls.filter(Boolean) : [];
    return pool.length ? pool[Math.floor(Math.random() * pool.length)] : desert;
  });
  const src = (config.url || "").trim() || fallbackUrl;
  const zoom = config.zoom ?? 1.6;
  const offsetX = config.offsetX ?? 0;
  const offsetY = config.offsetY ?? 0;
  // Ask for CORS so joined cards can read the video's edge colour; a server
  // that refuses gets a plain load instead.
  const [cors, setCors] = React.useState(true);

  return (
    <div className={`${cardClass || ""} relative overflow-hidden`}>
      <video
        className="absolute max-w-none object-cover"
        style={{
          width: `${100 * zoom}%`,
          height: `${100 * zoom}%`,
          left: `${offsetX}px`,
          top: `${offsetY}px`,
          // The built-in clip is pixel art: scale it with hard pixel edges
          // instead of the default smoothing, which blurs it on large or
          // high-density tiles. Custom URLs are usually footage, so smooth.
          imageRendering: src === desert ? "pixelated" : undefined,
        }}
        src={src}
        key={cors ? "cors" : "plain"}
        crossOrigin={cors ? "anonymous" : undefined}
        onError={() => cors && setCors(false)}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
      />
    </div>
  );
}

function VideoConfigFields({ config, onChange }: { config: VideoConfig; onChange: (next: VideoConfig) => void }) {
  return (
    <div className="grid gap-3">
      <TextField
        id="video-url"
        label="Video URL (.mp4)"
        value={config.url || ""}
        placeholder="Leave blank for a random background video"
        onChange={(value) => onChange({ ...config, url: value })}
      />
      <div className="grid grid-cols-3 gap-3">
        <TextField id="video-zoom" label="Zoom" value={String(config.zoom ?? 1.6)} onChange={(value) => onChange({ ...config, zoom: Number(value) || 1 })} />
        <TextField id="video-offx" label="Offset X" value={String(config.offsetX ?? 0)} onChange={(value) => onChange({ ...config, offsetX: Number(value) || 0 })} />
        <TextField id="video-offy" label="Offset Y" value={String(config.offsetY ?? 0)} onChange={(value) => onChange({ ...config, offsetY: Number(value) || 0 })} />
      </div>
    </div>
  );
}

export const videoWidget = defineWidget<VideoConfig>({
  type: "video",
  label: "Video",
  icon: HiOutlineVideoCamera,
  defaultSize: "small",
  makeDefaultConfig: () => ({ url: "", zoom: 1.6, offsetX: 0, offsetY: 0 }),
  Render: VideoRender,
  ConfigFields: VideoConfigFields,
});
