import React from "react";
import {
  FlutedGlass,
  HalftoneCmyk,
  HalftoneDots,
  ImageDithering,
  PaperTexture,
  Water,
} from "@paper-design/shaders-react";

const FILTER_COMPONENTS: Record<string, React.ComponentType<any>> = {
  paperTexture: PaperTexture,
  flutedGlass: FlutedGlass,
  water: Water,
  imageDithering: ImageDithering,
  halftoneDots: HalftoneDots,
  halftoneCmyk: HalftoneCmyk,
};

export default function FilteredImageShader({
  image,
  filterKey,
  filterSettings,
  className,
}: {
  image: string | null;
  filterKey: string | null;
  filterSettings: Record<string, unknown> | null;
  className?: string;
}) {
  const ShaderComponent = filterKey ? FILTER_COMPONENTS[filterKey] : undefined;

  if (!ShaderComponent || !image || !filterSettings) {
    return null;
  }

  return (
    <ShaderComponent
      {...filterSettings}
      image={image}
      className={className}
      width="100%"
      height="100%"
    />
  );
}
