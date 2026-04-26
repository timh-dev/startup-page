import React from "react";
import {
  FlutedGlass,
  HalftoneCmyk,
  HalftoneDots,
  ImageDithering,
  PaperTexture,
  Water,
} from "@paper-design/shaders-react";

const FILTER_COMPONENTS = {
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
}) {
  const ShaderComponent = FILTER_COMPONENTS[filterKey];

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
