# Cloud sync

How settings move between devices, and why it's built this way. The code is
`src/lib/cloudSync.ts` (client engine), `src/lib/sync/merge.ts` (merge),
`api/settings.ts` (server) and `shared/settingsDomains.ts` (shared shape).

## Model

Settings are split into **domains**: bookmarks, widgets & layout, vault,
reading list, custom themes and preferences. Each domain is one database row
per user (`user_bookmarks`, `user_widgets`, …) holding the domain's JSON and a
**version** that the server increments on every write.

Each device keeps a **snapshot** in IndexedDB: for every domain, the data and
version it last agreed with the server. That snapshot is the base for
three-way merges.

API keys (Unsplash, OpenWeather) are not settings. They stay in the browser
that entered them (`src/lib/credentials.ts`) and are never synced or exported.

## A sync

1. `GET /api/settings` returns every domain's data and version.
2. For each domain whose server version differs from the snapshot, the
   client merges *snapshot ← local → server* (see Merging) and adopts the
   server version as its new base.
3. Domains whose result differs from the server copy are sent with
   `PUT /api/settings`, each with the version it was based on.
4. The server writes a domain only if that version is still current
   (`INSERT … ON CONFLICT DO UPDATE … WHERE version = base`). Otherwise it
   returns the newer copy as a conflict; the client merges it and pushes
   again, up to four times.
5. The result is saved locally. If the user edited settings while the sync
   was running, that edit is merged on top and another sync is queued.

Syncs run after an edit (2 s debounce), at sign-in, when the tab regains
focus or comes back online (at most every 30 s), and every 5 minutes while
visible. An edit still waiting on the debounce when the page closes is sent
with `keepalive`; if that push conflicts, the edit is still saved locally and
the next sync merges it.

Tabs on the same device share IndexedDB/localStorage. A tab reloads settings
when another tab saves (the `storage` event), so it never edits a stale copy.
The settings dialog saves only what was changed in the dialog, merged onto
the current settings, so anything synced while it was open isn't reverted.

## Merging

`merge3(base, local, remote)`:

- A change on only one side wins.
- Objects merge key by key, recursively.
- Lists whose entries all have a string `id` (bookmarks and their links,
  vault and reading-list items, widgets, themes) merge entry by entry:
  additions, edits and deletes of different entries all survive, and edits
  to different fields of one entry both survive.
- An entry deleted on one side but edited on the other is kept.
- Both sides changing the same value differently is a conflict: the entry
  with the newer `updatedAt` wins, otherwise this device's value. Conflicts
  are reported in the account menu.

## Why not timestamps

The previous design pushed the whole settings object with the device's
clock time and the server kept the newest timestamp. That lost data in
four ways, each now covered by `src/lib/settings/sync.test.ts`:

- a tab left open overwrote newer edits from other devices;
- two devices editing different items in one list lost one edit;
- a device with a slow clock had every push rejected;
- a rejected push showed an error and never retried.

Server versions make ordering independent of clocks, and per-entry merging
means concurrent edits combine instead of replacing each other.

## Upgrading

Migration `0004_domain_versions` gives existing rows version 1. A device
upgrading from the old client still has its old whole-settings snapshot; it
becomes the merge base with version 0, so the first push conflicts and
merges rather than overwriting. The server answers whole-settings pushes from
not-yet-reloaded old clients with `426`, so they can't overwrite anything.
