import ImageEffectsSettings from "./ImageEffectsSettings";
import LayoutSettings from "./LayoutSettings";
import ThemeSettings from "./ThemeSettings";
import type { SettingsSectionProps } from "./types";

export default function AppearanceTab(props: SettingsSectionProps) {
  return (
    <>
      <ThemeSettings {...props} />
      <LayoutSettings {...props} />
      <ImageEffectsSettings {...props} />
    </>
  );
}
