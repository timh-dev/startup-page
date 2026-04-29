import React from "react";
import { HiBackward, HiForward, HiPause, HiPlay } from "react-icons/hi2";
import { readSettings } from "@/lib/settings";

const SCOPES = "user-read-currently-playing user-read-playback-state user-modify-playback-state";
const TOKEN_KEY = "sp_access_token";
const REFRESH_KEY = "sp_refresh_token";
const EXPIRY_KEY = "sp_token_expiry";
const VERIFIER_KEY = "sp_code_verifier";

function redirectUri() {
  const origin = window.location.origin.replace(/^(https?:\/\/)localhost\b/, "$1127.0.0.1");
  return `${origin}${window.location.pathname}`;
}

function makeVerifier() {
  const arr = new Uint8Array(64);
  crypto.getRandomValues(arr);
  return btoa(String.fromCharCode(...arr)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function makeChallenge(verifier) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function startOAuth(clientId) {
  const verifier = makeVerifier();
  localStorage.setItem(VERIFIER_KEY, verifier);
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri(),
    scope: SCOPES,
    code_challenge_method: "S256",
    code_challenge: await makeChallenge(verifier),
  });
  window.location.href = `https://accounts.spotify.com/authorize?${params}`;
}

async function exchangeCode(clientId, code) {
  const verifier = localStorage.getItem(VERIFIER_KEY);
  if (!verifier) throw new Error("No verifier");
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, grant_type: "authorization_code", code, redirect_uri: redirectUri(), code_verifier: verifier }),
  });
  if (!res.ok) throw new Error("Exchange failed");
  return res.json();
}

async function doRefresh(clientId) {
  const refresh = localStorage.getItem(REFRESH_KEY);
  if (!refresh) throw new Error("No refresh token");
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, grant_type: "refresh_token", refresh_token: refresh }),
  });
  if (!res.ok) throw new Error("Refresh failed");
  return res.json();
}

function storeTokens(data) {
  localStorage.setItem(TOKEN_KEY, data.access_token);
  if (data.refresh_token) localStorage.setItem(REFRESH_KEY, data.refresh_token);
  localStorage.setItem(EXPIRY_KEY, String(Date.now() + data.expires_in * 1000));
  localStorage.removeItem(VERIFIER_KEY);
}

function getStoredToken() {
  const t = localStorage.getItem(TOKEN_KEY);
  const exp = Number(localStorage.getItem(EXPIRY_KEY) || 0);
  return t && Date.now() < exp - 60000 ? t : null;
}

function disconnect() {
  [TOKEN_KEY, REFRESH_KEY, EXPIRY_KEY, VERIFIER_KEY].forEach((k) => localStorage.removeItem(k));
}

async function getToken(clientId) {
  const stored = getStoredToken();
  if (stored) return stored;
  const data = await doRefresh(clientId);
  storeTokens(data);
  return data.access_token;
}

async function spotifyApi(clientId, path, options = {}) {
  const token = await getToken(clientId);
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...options.headers },
  });
  if (res.status === 401) { disconnect(); throw new Error("Unauthorized"); }
  return res;
}

function fmtMs(ms) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default function SpotifyPlayer() {
  const settings = React.useMemo(() => readSettings(), []);
  const clientId = settings.featurePanel?.spotifyClientId;

  const [track, setTrack] = React.useState(null);
  const [status, setStatus] = React.useState("init");
  const [progress, setProgress] = React.useState(0);
  const tickRef = React.useRef(null);

  // Handle OAuth redirect + check stored tokens
  React.useEffect(() => {
    if (!clientId) { setStatus("no-client"); return; }

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const error = params.get("error");

    if (error) {
      window.history.replaceState({}, "", window.location.pathname);
      setStatus("no-auth");
      return;
    }

    if (code) {
      window.history.replaceState({}, "", window.location.pathname);
      exchangeCode(clientId, code)
        .then((data) => { storeTokens(data); setStatus("poll"); })
        .catch(() => setStatus("no-auth"));
      return;
    }

    const hasTokens = getStoredToken() || localStorage.getItem(REFRESH_KEY);
    setStatus(hasTokens ? "poll" : "no-auth");
  }, [clientId]);

  // Poll now playing every 5 s when connected
  React.useEffect(() => {
    if (!clientId || !["poll", "playing", "paused", "idle"].includes(status)) return;
    let cancelled = false;

    async function poll() {
      try {
        const res = await spotifyApi(clientId, "/me/player/currently-playing");
        if (cancelled) return;
        if (res.status === 204) { setTrack(null); setStatus("idle"); return; }
        if (!res.ok) throw new Error("Player error");
        const data = await res.json();
        if (!data?.item) { setTrack(null); setStatus("idle"); return; }
        setTrack(data);
        setProgress(data.progress_ms);
        setStatus(data.is_playing ? "playing" : "paused");
      } catch (err) {
        if (!cancelled) setStatus(err.message === "Unauthorized" ? "no-auth" : "error");
      }
    }

    poll();
    const id = setInterval(poll, 5000);
    return () => { cancelled = true; clearInterval(id); };
  }, [clientId, status]);

  // Smooth progress tick while playing
  React.useEffect(() => {
    clearInterval(tickRef.current);
    if (status !== "playing" || !track) return;
    tickRef.current = setInterval(() => {
      setProgress((p) => Math.min(p + 1000, track.item.duration_ms));
    }, 1000);
    return () => clearInterval(tickRef.current);
  }, [status, track?.item?.id]);

  const control = React.useCallback(async (action) => {
    if (!clientId) return;
    try {
      if (action === "play") await spotifyApi(clientId, "/me/player/play", { method: "PUT" });
      else if (action === "pause") await spotifyApi(clientId, "/me/player/pause", { method: "PUT" });
      else if (action === "next") await spotifyApi(clientId, "/me/player/next", { method: "POST" });
      else if (action === "prev") await spotifyApi(clientId, "/me/player/previous", { method: "POST" });
      // Re-poll after 600 ms to reflect the change
      setTimeout(async () => {
        try {
          const res = await spotifyApi(clientId, "/me/player/currently-playing");
          if (res.ok && res.status !== 204) {
            const data = await res.json();
            if (data?.item) { setTrack(data); setProgress(data.progress_ms); setStatus(data.is_playing ? "playing" : "paused"); }
          }
        } catch {}
      }, 600);
    } catch {}
  }, [clientId]);

  // ── Render states ──────────────────────────────────────────────
  if (status === "no-client") {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-[inherit] bg-card p-6 text-center">
        <div>
          <div className="text-4xl">🎵</div>
          <p className="mt-2 text-sm font-semibold text-foreground">Spotify Now Playing</p>
          <p className="mt-1 text-xs text-muted-foreground">Add your Spotify App Client ID in Settings → Content → Feature Panel.</p>
        </div>
      </div>
    );
  }

  if (status === "no-auth" || status === "init") {
    const uri = redirectUri();
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-5 rounded-[inherit] bg-[linear-gradient(135deg,color-mix(in_oklab,#1DB954_8%,var(--color-card)),var(--color-card))] p-6 text-center">
        <div className="text-5xl">🎵</div>
        <div>
          <p className="text-base font-semibold text-foreground">Spotify Now Playing</p>
          <p className="mt-1 text-xs text-muted-foreground">Connect your Spotify account to see what's playing.</p>
        </div>
        <button
          type="button"
          onClick={() => startOAuth(clientId)}
          className="rounded-full bg-[#1DB954] px-6 py-2.5 text-sm font-semibold text-black transition hover:bg-[#1ed760] hover:scale-105"
        >
          Connect Spotify
        </button>
        <div className="w-full rounded-lg border border-border/40 bg-black/20 px-3 py-2 text-left">
          <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-white/40">Add this exact URI to your Spotify app</p>
          <p className="break-all font-mono text-[10px] text-white/70">{uri}</p>
        </div>
      </div>
    );
  }

  if (status === "idle" || !track) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 rounded-[inherit] bg-card p-4 text-center">
        <div className="text-4xl">🎵</div>
        <p className="text-sm font-medium text-foreground">Nothing playing</p>
        <p className="text-xs text-muted-foreground">Open Spotify and start playing something.</p>
        <button
          type="button"
          onClick={() => { disconnect(); setStatus("no-auth"); }}
          className="mt-1 text-[10px] text-muted-foreground transition-colors hover:text-foreground"
        >
          Disconnect
        </button>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-[inherit] bg-card p-4 text-center">
        <p className="text-sm font-semibold text-foreground">Connection error</p>
        <button
          type="button"
          onClick={() => { disconnect(); setStatus("no-auth"); }}
          className="text-xs text-primary hover:underline"
        >
          Reconnect
        </button>
      </div>
    );
  }

  const item = track.item;
  const albumArt = item.album?.images?.[0]?.url;
  const artists = item.artists?.map((a) => a.name).join(", ");
  const duration = item.duration_ms;
  const pct = duration ? (progress / duration) * 100 : 0;
  const isPlaying = status === "playing";

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden rounded-[inherit]">
      {albumArt && (
        <img src={albumArt} alt="Album art" className="absolute inset-0 h-full w-full object-cover" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/92 via-black/55 to-black/20" />

      <div className="relative flex flex-1 flex-col justify-end gap-3 p-5">
        <div className="min-w-0">
          <p className="truncate text-base font-bold text-white drop-shadow">{item.name}</p>
          <p className="truncate text-sm text-white/75">{artists}</p>
          <p className="truncate text-xs text-white/50">{item.album?.name}</p>
        </div>

        <div>
          <div className="mb-1 h-1 w-full overflow-hidden rounded-full bg-white/20">
            <div className="h-full rounded-full bg-[#1DB954]" style={{ width: `${pct}%` }} />
          </div>
          <div className="flex justify-between text-[10px] text-white/50">
            <span>{fmtMs(progress)}</span>
            <span>{fmtMs(duration)}</span>
          </div>
        </div>

        <div className="flex items-center justify-center gap-7">
          <button type="button" onClick={() => control("prev")} aria-label="Previous" className="text-white/75 transition hover:text-white hover:scale-110">
            <HiBackward className="size-6" />
          </button>
          <button type="button" onClick={() => control(isPlaying ? "pause" : "play")} aria-label={isPlaying ? "Pause" : "Play"} className="text-white transition hover:scale-110">
            {isPlaying ? <HiPause className="size-9" /> : <HiPlay className="size-9" />}
          </button>
          <button type="button" onClick={() => control("next")} aria-label="Next" className="text-white/75 transition hover:text-white hover:scale-110">
            <HiForward className="size-6" />
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={() => { disconnect(); setStatus("no-auth"); }}
        className="absolute right-2 top-2 rounded-full bg-black/30 px-2 py-0.5 text-[9px] text-white/40 backdrop-blur-sm transition hover:text-white/80"
      >
        disconnect
      </button>
    </div>
  );
}
