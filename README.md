<p align="center">
  <img width="100px" src="./src/assets/preview/icon.ico">
</p>

<div align="center">
  <h1>Modular Grid Page</h1>
  <b>A modular, themeable browser start page built with React and Vite</b>
</div>

[![Demo Website](https://img.shields.io/website-up-down-green-red/http/shields.io.svg)](https://timothypholmes.github.io/startup-page/)

#### Multitheme
![preview-1](https://i.imgur.com/bHyEMMj.png)
![preview-2](https://i.imgur.com/NfIDoao.png)
![preview-3](https://i.imgur.com/dVUrZUj.png)

- [About](#about)
- [Installation](#installation)
- [Configuration](#configuration)
- [Features](#features)
- [API Keys](#api-keys)
- [Tech Stack](#tech-stack)
- [Deploying](#deploying)

---

## About

Modular Grid Page is a fast, customizable browser homepage built as a React app. The layout is a responsive auto-sizing tile grid. Every tile, theme, and data source is configurable through the built-in settings panel — no config files to edit by hand.

---

## Installation

```sh
git clone https://github.com/timothypholmes/startup-page.git
cd startup-page
make setup
```

`make setup` installs dependencies and produces a production build. Then start the dev server:

```sh
make dev
```

### All make commands

| Command | Description |
|---------|-------------|
| `make setup` | Install dependencies and build — run this first |
| `make dev` | Start the Vite development server (opens browser) |
| `make build` | Production build → `dist/` |
| `make build-local` | Build with base path `/` for local serving |
| `make build-vercel` | Build for Vercel deployment |
| `make serve` | Build and serve `dist/` locally on port 8000 |
| `make preview` | Preview the last production build |
| `make deploy` | Deploy to GitHub Pages |
| `make clean` | Remove `dist/` and Vite cache |
| `make install` | Install frontend dependencies only |
| `make help` | Print all available targets |

---

## Configuration

All settings are managed through the in-app **Settings panel** (gear icon on the dashboard). Settings are persisted in IndexedDB with a localStorage mirror, and can be exported/imported as a JSON backup file.

There is no config file to edit manually.

---

## Features

### Dashboard
- **Responsive tile grid** — column count adjusts to viewport width; tile size is adjustable via a slider in Settings → Layout (7–14 rem)
- **Tile visibility** — show or hide any tile from Settings → Layout without losing its position
- **Command palette** — press `⌘K` / `Ctrl+K` to navigate the dashboard by keyboard (powered by kbar)

### Tiles

| Tile | Description |
|------|-------------|
| **Photo tiles** (×6) | Unsplash or Wikimedia photos, one per configurable topic list. Images are cached locally (Cache API + localStorage) for instant display on return visits. |
| **Bookmarks** (×5) | Editable link groups with title, name, and URL per entry |
| **Weather** | Current conditions and temperature via OpenWeather API |
| **Solar graph** | Canvas-drawn arc showing today's sun position, twilight events, and a hover scrubber |
| **Clock** | Live local time |
| **Feature panel** | Cycles between Headlines (Reddit), Windy map, Pomodoro timer, and a photo tile. Arrow buttons or dots switch modes. |
| **Decorative video** (×2) | Looping background video; tall and small viewport into the same shared scene |
| **Search** | Multi-engine search box |

### Appearance
- **Theme palettes** — several built-in palettes plus a custom theme editor (paste shadcn-compatible CSS variables)
- **Light / Dark / System** mode
- **Card shape** — soft, rounded, or sharp corners
- **Image effects** — per-photo-tile GPU filters: Paper Texture, Fluted Glass, Water, Image Dithering, Halftone Dots, Halftone CMYK (via Paper Design shaders)

### Settings panel tabs
- **Appearance** — theme mode, palette, custom themes, grid density, card shape, decorative media toggle, image effects
- **Layout** — tile visibility toggles, tile size slider
- **Content** — location (lat/lng), units (imperial/metric), API keys, video URLs, video zoom/offset, headline source (subreddit + rotation speed), Unsplash topic tags per tile, bookmarks, timer duration

Settings can be exported to a timestamped JSON file and re-imported at any time.

---

## API Keys

Both keys are optional — the page works without them using fallback data sources.

| Key | Where to get it | Used for |
|-----|----------------|----------|
| **OpenWeather API key** | [openweathermap.org](https://openweathermap.org/api) | Current weather conditions |
| **Unsplash Access Key** | [unsplash.com/developers](https://unsplash.com/developers) | High-quality photo tiles (falls back to Wikimedia without it) |

Enter keys in **Settings → Content → Location and API Settings**.

---

## Tech Stack

| Library | Role |
|---------|------|
| [React](https://react.dev) | UI framework |
| [Vite](https://vitejs.dev) | Build tool and dev server |
| [Tailwind CSS v4](https://tailwindcss.com) | Utility styling |
| [Radix UI](https://radix-ui.com) | Accessible dialog, tabs, slider, switch primitives |
| [shadcn-style components](https://ui.shadcn.com) | Composed UI components (Button, Card, Input, etc.) |
| [kbar](https://kbar.vercel.app) | Command palette |
| [Paper Design Shaders](https://shaders.paper.design) | WebGL image filter effects |
| [axios](https://axios-http.com) | Unsplash API requests |

---

## Deploying

**GitHub Pages:**
```sh
npm run deploy
```
Update the `base` field in `vite.config.js` to match your repository name before deploying.

**Vercel / Netlify:**
```sh
npm run build:vercel
```
Point your host's publish directory to `dist/`.
