import React from "react";
import { HiOutlineMusicalNote } from "react-icons/hi2";
import { TextField } from "./TextField";
import { defineWidget } from "./types";

const SpotifyPlayer = React.lazy(() => import("@/features/dashboard/components/SpotifyPlayer"));

interface SpotifyConfig {
  clientId?: string | null;
}

export const spotifyWidget = defineWidget<SpotifyConfig>({
  type: "spotify",
  label: "Spotify now playing",
  icon: HiOutlineMusicalNote,
  defaultSize: "small",
  makeDefaultConfig: () => ({ clientId: null }),
  Render: ({ instance, cardClass }) => (
    <div className={cardClass}>
      <React.Suspense fallback={null}>
        <SpotifyPlayer clientId={(instance.config as SpotifyConfig).clientId} />
      </React.Suspense>
    </div>
  ),
  ConfigFields: ({ config, onChange }) => (
    <TextField
      id="spotify-client"
      label="Spotify app client ID"
      value={config.clientId || ""}
      placeholder="Create an app at developer.spotify.com"
      onChange={(value) => onChange({ ...config, clientId: value || null })}
    />
  ),
});
