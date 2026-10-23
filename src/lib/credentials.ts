// API keys for third-party services (Unsplash, OpenWeather). Stored in this
// browser only: never part of the settings object, so never synced to the
// cloud or written into a settings export.
import { create } from "zustand";
import { LEGACY_CREDENTIAL_KEYS, LEGACY_WIDGET_CREDENTIAL_KEY, forEachWidgetConfig } from "../../shared/credentials";

const CREDENTIALS_STORAGE_KEY = "startup-page.credentials";

export type CredentialName = "unsplash" | "openWeather";

type Credentials = Record<CredentialName, string | null>;

interface CredentialsStore extends Credentials {
  setCredential: (name: CredentialName, value: string | null) => void;
}

function load(): Credentials {
  const empty: Credentials = { unsplash: null, openWeather: null };
  try {
    const stored = JSON.parse(window.localStorage.getItem(CREDENTIALS_STORAGE_KEY) || "{}");
    return {
      unsplash: typeof stored.unsplash === "string" ? stored.unsplash : null,
      openWeather: typeof stored.openWeather === "string" ? stored.openWeather : null,
    };
  } catch {
    return empty;
  }
}

function save(credentials: Credentials) {
  try {
    window.localStorage.setItem(CREDENTIALS_STORAGE_KEY, JSON.stringify(credentials));
  } catch {
    // Storage blocked: the key works for this session only.
  }
}

export const useCredentialsStore = create<CredentialsStore>((set, get) => ({
  ...load(),
  setCredential: (name, value) => {
    const trimmed = value?.trim() || null;
    set({ [name]: trimmed } as Partial<Credentials>);
    const { unsplash, openWeather } = get();
    save({ unsplash, openWeather });
  },
}));

const LEGACY_KEY_TO_NAME: Record<(typeof LEGACY_CREDENTIAL_KEYS)[number], CredentialName> = {
  unsplashCredential: "unsplash",
  openWeatherCredential: "openWeather",
};

/**
 * Moves API keys found in a settings object (where older versions kept them)
 * into this device's credential store. Never overwrites a key already set.
 * A per-widget OpenWeather key becomes the device-wide one.
 */
export function adoptLegacyCredentials(settings: Record<string, any> | null | undefined) {
  if (!settings || typeof settings !== "object") return;
  const store = useCredentialsStore.getState();

  for (const legacyKey of LEGACY_CREDENTIAL_KEYS) {
    const value = settings[legacyKey];
    const name = LEGACY_KEY_TO_NAME[legacyKey];
    if (typeof value === "string" && value.trim() && !useCredentialsStore.getState()[name]) {
      store.setCredential(name, value);
    }
  }

  forEachWidgetConfig(settings.widgets, (config) => {
    const value = config[LEGACY_WIDGET_CREDENTIAL_KEY];
    if (typeof value === "string" && value.trim() && !useCredentialsStore.getState().openWeather) {
      store.setCredential("openWeather", value);
    }
  });
}
