import {
  flutedGlassPresets,
  halftoneCmykPresets,
  halftoneDotsPresets,
  imageDitheringPresets,
  paperTexturePresets,
  waterPresets,
} from "@paper-design/shaders-react";

export const IMAGE_FILTER_DEFINITIONS = [
  {
    key: "paperTexture",
    label: "Paper texture",
    presets: paperTexturePresets,
    controls: [
      { key: "contrast", label: "Contrast", min: 0, max: 1, step: 0.01 },
      { key: "roughness", label: "Roughness", min: 0, max: 1, step: 0.01 },
      { key: "fiber", label: "Fiber", min: 0, max: 1, step: 0.01 },
      { key: "folds", label: "Folds", min: 0, max: 1, step: 0.01 },
      { key: "foldCount", label: "Fold count", min: 1, max: 10, step: 1 },
      { key: "drops", label: "Drops", min: 0, max: 1, step: 0.01 },
    ],
  },
  {
    key: "flutedGlass",
    label: "Fluted glass",
    presets: flutedGlassPresets,
    controls: [
      { key: "size", label: "Size", min: 0, max: 1, step: 0.01 },
      { key: "distortion", label: "Distortion", min: 0, max: 1, step: 0.01 },
      { key: "blur", label: "Blur", min: 0, max: 1, step: 0.01 },
      { key: "edges", label: "Edges", min: 0, max: 1, step: 0.01 },
      { key: "angle", label: "Angle", min: 0, max: 180, step: 1 },
      { key: "shadows", label: "Shadows", min: 0, max: 1, step: 0.01 },
    ],
  },
  {
    key: "water",
    label: "Water",
    presets: waterPresets,
    controls: [
      { key: "speed", label: "Speed", min: 0, max: 2, step: 0.01 },
      { key: "highlights", label: "Highlights", min: 0, max: 1, step: 0.01 },
      { key: "layering", label: "Layering", min: 0, max: 1, step: 0.01 },
      { key: "waves", label: "Waves", min: 0, max: 1, step: 0.01 },
      { key: "caustic", label: "Caustic", min: 0, max: 1, step: 0.01 },
      { key: "size", label: "Scale", min: 0.2, max: 2, step: 0.01 },
    ],
  },
  {
    key: "imageDithering",
    label: "Image dithering",
    presets: imageDitheringPresets,
    controls: [
      { key: "size", label: "Pixel size", min: 0.5, max: 6, step: 0.1 },
      { key: "colorSteps", label: "Color steps", min: 1, max: 8, step: 1 },
      { key: "originalColors", label: "Keep original colors", type: "boolean" },
      { key: "inverted", label: "Invert", type: "boolean" },
    ],
  },
  {
    key: "halftoneDots",
    label: "Halftone dots",
    presets: halftoneDotsPresets,
    controls: [
      { key: "size", label: "Grid size", min: 0.1, max: 1, step: 0.01 },
      { key: "radius", label: "Dot radius", min: 0.1, max: 2, step: 0.01 },
      { key: "contrast", label: "Contrast", min: 0, max: 1.5, step: 0.01 },
      { key: "grainMixer", label: "Grain mix", min: 0, max: 1, step: 0.01 },
      { key: "grainOverlay", label: "Grain overlay", min: 0, max: 1, step: 0.01 },
      { key: "originalColors", label: "Keep original colors", type: "boolean" },
    ],
  },
  {
    key: "halftoneCmyk",
    label: "Halftone CMYK",
    presets: halftoneCmykPresets,
    controls: [
      { key: "size", label: "Dot size", min: 0.1, max: 1, step: 0.01 },
      { key: "contrast", label: "Contrast", min: 0, max: 2, step: 0.01 },
      { key: "softness", label: "Softness", min: 0, max: 1, step: 0.01 },
      { key: "gridNoise", label: "Grid noise", min: 0, max: 1, step: 0.01 },
      { key: "gainC", label: "Cyan gain", min: -1, max: 1, step: 0.01 },
      { key: "gainM", label: "Magenta gain", min: -1, max: 1, step: 0.01 },
      { key: "gainY", label: "Yellow gain", min: -1, max: 1, step: 0.01 },
    ],
  },
];

export const IMAGE_FILTER_DEFAULTS = {
  enabledFilters: Object.fromEntries(
    IMAGE_FILTER_DEFINITIONS.map((filter) => [filter.key, false])
  ),
  filterSettings: Object.fromEntries(
    IMAGE_FILTER_DEFINITIONS.map((filter) => [
      filter.key,
      { ...filter.presets[0].params },
    ])
  ),
};

export function getEnabledImageFilterKeys(imageEffects) {
  const enabledFilters = imageEffects?.enabledFilters || {};
  return IMAGE_FILTER_DEFINITIONS.filter((filter) => enabledFilters[filter.key]).map(
    (filter) => filter.key
  );
}

export function getImageFilterDefinition(filterKey) {
  return IMAGE_FILTER_DEFINITIONS.find((filter) => filter.key === filterKey) || null;
}
