import { useContext, useState } from "react";
import { HiCheck } from "react-icons/hi2";

import { ThemeContext, type ThemeMode } from "@/components/layout/ThemeContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { StartupSettings } from "@/features/settings/stores";
import { SCENES, applyScene, getScene, type SceneApplyMode, type SceneId } from "@/features/scenes/scenes";
import { BUILT_IN_PALETTES } from "@/lib/theme-palettes";
import type { SettingsSectionProps } from "./types";

// Picking a theme: a large preview of each (its painting and colours), then
// a choice between restyling the dashboard you have and also taking the
// theme's cards. Undo puts back exactly what was there.
export default function SceneSettings({ settings, updateSettings }: SettingsSectionProps) {
  const { setThemeMode, setThemePalette, setCustomThemeVars } = useContext(ThemeContext);
  const current = (settings.ui?.scene as SceneId | undefined) ?? null;
  const [picked, setPicked] = useState<SceneId | null>(null);
  const [applied, setApplied] = useState<{ name: string; previous: StartupSettings } | null>(null);

  const showTheme = (next: StartupSettings) => {
    setThemePalette(next.ui?.themePalette || "zen");
    setThemeMode((next.ui?.themeMode as ThemeMode) || "system");
    setCustomThemeVars(null);
  };

  const apply = (id: SceneId, mode: SceneApplyMode) => {
    const previous = settings;
    const next = applyScene(settings, id, mode);
    updateSettings(() => next);
    showTheme(next);
    setApplied({ name: getScene(id)!.name, previous });
    setPicked(null);
  };

  const undo = () => {
    if (!applied) return;
    updateSettings(() => applied.previous);
    showTheme(applied.previous);
    setApplied(null);
  };

  const pickedScene = picked ? getScene(picked) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Themes</CardTitle>
        <CardDescription>A whole look: colours, wallpaper, videos, photos and a starting layout. Your bookmarks, links and vault stay as they are.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="scene-grid" role="list">
          {SCENES.map((scene) => {
            const swatches = BUILT_IN_PALETTES.find((palette) => palette.value === scene.palette)?.swatches;
            const colours = swatches ? [swatches.light.background, swatches.light.primary, swatches.dark.background, swatches.dark.primary] : [];
            const isCurrent = current === scene.id;
            return (
              <div key={scene.id} role="listitem">
                <button
                  type="button"
                  className="scene-tile"
                  data-picked={picked === scene.id || undefined}
                  aria-pressed={picked === scene.id}
                  onClick={() => setPicked(picked === scene.id ? null : scene.id)}
                  style={{ backgroundImage: `url(${scene.wallpaper})` }}
                  title={scene.wallpaperCredit}
                >
                  <span className="scene-tile-shade" aria-hidden="true" />
                  {isCurrent && (
                    <span className="scene-tile-current">
                      <HiCheck className="size-3" /> Current
                    </span>
                  )}
                  <span className="scene-tile-text">
                    <span className="scene-tile-name">{scene.name}</span>
                    <span className="scene-tile-tagline">{scene.tagline}</span>
                  </span>
                  <span className="scene-tile-swatches" aria-hidden="true">
                    {colours.map((colour, index) => (
                      <span key={index} style={{ background: colour }} />
                    ))}
                  </span>
                </button>
              </div>
            );
          })}
        </div>

        {pickedScene && (
          <div className="scene-apply" role="group" aria-label={`Apply ${pickedScene.name}`}>
            <p>
              <strong>{pickedScene.name}</strong>: restyle the cards you have, or start from its layout too?
            </p>
            <div className="scene-apply-actions">
              <button type="button" className="collection-ghost-btn" onClick={() => apply(pickedScene.id, "look")}>
                Restyle my dashboard
              </button>
              <button type="button" className="collection-primary-btn" onClick={() => apply(pickedScene.id, "layout")}>
                Use its layout too
              </button>
            </div>
            <p className="scene-apply-note">Restyling changes colours, wallpaper, videos and photo topics. The layout replaces your home cards with the theme's.</p>
          </div>
        )}

        {applied && (
          <p className="scene-applied" role="status">
            Applied {applied.name}.
            <button type="button" onClick={undo}>
              Undo
            </button>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
