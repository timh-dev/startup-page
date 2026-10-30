import { beforeEach, describe, expect, it } from "vitest";
import { useCredentialsStore } from "./credentials";
import { exportSettingsBlob, normalizeSettingsShape } from "./settings";

const legacySettings = {
  units: "metric",
  unsplashCredential: "unsplash-key",
  openWeatherCredential: "weather-key",
  widgets: [
    { id: "w1", type: "weather", size: "wide", config: { variant: "compact", openWeatherKey: "widget-key" } },
    {
      id: "s1",
      type: "stack",
      size: "feature",
      config: {},
      items: [{ id: "i1", type: "weather", size: "small", config: { openWeatherKey: "stacked-key", lat: 1 } }],
    },
  ],
};

beforeEach(() => {
  window.localStorage.clear();
  useCredentialsStore.setState({ unsplash: null, openWeather: null });
});

describe("API keys stay out of settings", () => {
  it("moves keys from older settings into the device credential store", () => {
    normalizeSettingsShape(legacySettings);
    expect(useCredentialsStore.getState().unsplash).toBe("unsplash-key");
    expect(useCredentialsStore.getState().openWeather).toBe("weather-key");
    expect(JSON.parse(window.localStorage.getItem("startup-page.credentials")!)).toEqual({
      unsplash: "unsplash-key",
      openWeather: "weather-key",
    });
  });

  it("uses a per-widget OpenWeather key when there's no device-wide one", () => {
    normalizeSettingsShape({ widgets: legacySettings.widgets });
    expect(useCredentialsStore.getState().openWeather).toBe("widget-key");
  });

  it("never overwrites a key already set on this device", () => {
    useCredentialsStore.getState().setCredential("unsplash", "mine");
    normalizeSettingsShape(legacySettings);
    expect(useCredentialsStore.getState().unsplash).toBe("mine");
  });

  it("removes every key from the normalized settings, including inside stacks", () => {
    const settings = normalizeSettingsShape(legacySettings);
    expect(JSON.stringify(settings)).not.toMatch(/Credential|openWeatherKey|unsplash-key|weather-key|widget-key|stacked-key/);
    expect(settings.widgets[1].items[0].config).toEqual({ lat: 1 });
  });

  it("leaves keys out of settings exports", async () => {
    const blob = exportSettingsBlob(legacySettings);
    // jsdom's Blob has no .text().
    const text = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsText(blob);
    });
    expect(text).toContain('"units": "metric"');
    expect(text).not.toMatch(/unsplash-key|weather-key|widget-key|stacked-key/);
  });
});
