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
- [Features](#features)
- [API keys](#api-keys)
- [Cloud sync](#cloud-sync)
- [Tech stack](#tech-stack)
- [Development](#development)
- [Deploying](#deploying)

---

## About

Modular Grid Page is a browser start page: a responsive grid of widgets you
add, size and arrange yourself, plus a bookmarks page and a resource vault.
Everything is configured in the app; there is no config file to edit.

It works fully offline in local-only mode, storing everything in the browser.
Signing in adds cloud sync between devices.

---

## Installation

```sh
git clone https://github.com/timothypholmes/startup-page.git
cd startup-page
make setup   # install dependencies and build
make dev     # start the dev server and open the browser
```

`make help` lists every target.

---

## Features

### Dashboard

- **Widget grid**: add, remove, resize (small, wide, tall, large, feature) and drag to reorder. Column count follows the window width; tile size is adjustable.
- **Command palette**: `⌘K` / `Ctrl+K` searches bookmarks, saved links and themes, runs settings actions, and handles search bangs (`!yt lofi`), quick maths and adding a link to the vault.
- **Installable and offline-capable** (PWA).

### Widgets

| Widget | What it shows |
|---|---|
| Clock | Time and date, with plain, analog and year-progress faces |
| Search | Multi-engine search box with your own engines |
| Weather / Weather (Frosted) | Current conditions and forecast from OpenWeather, with animated sky effects |
| Air quality | US AQI, PM2.5 and PM10 from Open-Meteo |
| Solar graph | Today's sun path, twilight bands and a hover scrubber |
| Photo | Unsplash photos for your topics (Wikimedia when there's no key), with optional shader effects |
| Video | A looping background video |
| Bookmark folder | One folder from your bookmarks |
| Vault | Shortcuts into the resource vault |
| Headlines | Rotating top posts from a subreddit |
| RSS feed | Any RSS or Atom feed |
| Wikipedia | Today's featured article |
| GitHub activity | A user's recent public activity |
| Spotify now playing | Playback controls for your Spotify account |
| Timer | A focus timer |
| Embedded page | Any page in an iframe (Windy by default) |
| Stack | Several widgets in one tile, swiped between |

### Pages

- **Bookmarks** (`#/bookmarks`): nested folders, drag and drop, and import from or export to browser bookmark files.
- **Resource vault** (`#/resources`): a reading list of links (titles fill in from the URL when signed in), code snippets with highlighting, and text templates.

### Settings

- **Appearance**: light/dark/system mode, built-in palettes and custom themes pasted as shadcn-style CSS variables, grid density, card shape, clock format, which pages are enabled, photo effects and tile size.
- **Data**: export everything or one area (bookmarks, widgets, vault…) to JSON, import all or part of a backup, restore one of the last 10 automatic local backups, or reset.

---

## API keys

Weather needs an [OpenWeather](https://openweathermap.org/api) key; photos use
an [Unsplash](https://unsplash.com/developers) access key if you have one and
fall back to Wikimedia otherwise. Enter them in a weather or photo widget's
settings.

Keys are stored in this browser only. They are never synced to other devices
or included in exports, so enter them once on each device.

---

## Cloud sync

Signed-in users with sync access get their settings, bookmarks, widgets, vault
and themes on every device. Edits merge item by item, so changes made on two
devices at once both survive. See [docs/sync.md](./docs/sync.md) for how it
works.

The hosted version uses Clerk for sign-in, Stripe for the sync subscription
and Neon Postgres for storage. Without those configured, the app runs in
local-only mode. [docs/environments.md](./docs/environments.md) covers setup,
environments and self-hosting (including running your own backend with the
paywall off).

---

## Tech stack

| Library | Role |
|---|---|
| [React](https://react.dev) 19 + [Vite](https://vitejs.dev) | UI and build |
| [Tailwind CSS v4](https://tailwindcss.com), [Radix UI](https://radix-ui.com), shadcn-style components | Styling and accessible primitives |
| [Zustand](https://zustand.docs.pmnd.rs) | State |
| [dnd kit](https://dndkit.com) | Drag and drop |
| [kbar](https://kbar.vercel.app) | Command palette |
| [Paper Design Shaders](https://shaders.paper.design) | Photo effects |
| [Prism](https://prismjs.com) | Code highlighting in the vault |
| [vite-plugin-pwa](https://vite-pwa-org.netlify.app) | Offline support |
| Vercel Functions (`/api`), [Drizzle](https://orm.drizzle.team) + [Neon](https://neon.tech), [zod](https://zod.dev) | Sync API and storage |
| [Clerk](https://clerk.com), [Stripe](https://stripe.com) | Accounts and the sync subscription |

---

## Development

```sh
make dev          # Vite dev server (local-only unless Clerk keys are set)
make dev-cloud    # full stack on :3000 via `vercel dev`
pnpm test         # Vitest
pnpm typecheck    # TypeScript (strict)
```

CI runs the tests, the typecheck and a build on every push and pull request.

---

## Deploying

**Vercel** (full app with sync): pushing a branch creates a Preview
deployment; merging to `main` deploys Production. Database migrations run as
part of the build. See [docs/environments.md](./docs/environments.md).

**GitHub Pages** (local-only demo, no accounts or sync):

```sh
make deploy
```

The `base` in `vite.config.js` must match the Pages URL.
