import { eq } from "drizzle-orm";
import { getDb } from "./_lib/db.js";
import {
  userBookmarks,
  userWidgets,
  userVaultItems,
  userReadItems,
  userThemes,
  userPreferences,
} from "./_lib/schema.js";
import { getCurrentUser, requireSyncAccess } from "./_lib/auth.js";
import { json, errorResponse } from "./_lib/http.js";
import {
  DOMAIN_TABLE_ENTRIES,
  assembleSettings,
  maxTimestamp,
  sliceSettingsIntoDomains,
  type DomainKey,
  type DomainRows,
} from "./_lib/settingsDomains.js";

async function fetchDomainRows(userId: string): Promise<DomainRows> {
  const results = await Promise.all(
    DOMAIN_TABLE_ENTRIES.map(({ table }) =>
      getDb().select().from(table).where(eq(table.userId, userId)).limit(1).then((rows) => rows[0])
    )
  );

  const rows: DomainRows = {};
  DOMAIN_TABLE_ENTRIES.forEach(({ key }, i) => {
    if (results[i]) rows[key] = results[i];
  });
  return rows;
}

function toResponse(rows: DomainRows) {
  const rowList = DOMAIN_TABLE_ENTRIES.map(({ key }) => rows[key]);
  return {
    settings: assembleSettings(rows),
    schema_version: 2,
    server_updated_at: (maxTimestamp(rowList, "serverUpdatedAt") ?? new Date()).toISOString(),
    client_updated_at: maxTimestamp(rowList, "clientUpdatedAt")?.toISOString() ?? null,
  };
}

export async function GET(request: Request): Promise<Response> {
  try {
    // Reads only require sign-in: a lapsed subscriber can always retrieve their data.
    const user = await getCurrentUser(request);
    const rows = await fetchDomainRows(user.id);
    if (DOMAIN_TABLE_ENTRIES.every(({ key }) => !rows[key])) {
      return json({ detail: "No settings saved yet" }, 404);
    }
    return json(toResponse(rows));
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PUT(request: Request): Promise<Response> {
  try {
    const user = await getCurrentUser(request);
    requireSyncAccess(user);

    const payload = await request.json().catch(() => null);
    if (!payload || typeof payload !== "object" || typeof payload.settings !== "object" || payload.settings === null) {
      return json({ detail: "Body must include a settings object" }, 422);
    }

    const incomingClientUpdatedAt = payload.client_updated_at ? new Date(payload.client_updated_at) : null;

    const existingRows = await fetchDomainRows(user.id);

    // Last line of defense: never let a push silently replace existing data
    // with something older (or something carrying no timestamp at all, e.g.
    // a client bug pushing freshly-seeded default state). Reject instead of
    // overwriting so the caller can reconcile.
    const existingTime = maxTimestamp(
      DOMAIN_TABLE_ENTRIES.map(({ key }) => existingRows[key]),
      "clientUpdatedAt"
    )?.getTime() ?? 0;
    const incomingTime = incomingClientUpdatedAt?.getTime() ?? 0;
    if (existingTime > 0 && incomingTime < existingTime) {
      return json({ detail: "Conflict: server has newer data", ...toResponse(existingRows) }, 409);
    }

    const sliced = sliceSettingsIntoDomains(payload.settings);
    const serverUpdatedAt = new Date();

    function upsertDomain(table: (typeof DOMAIN_TABLE_ENTRIES)[number]["table"], key: DomainKey) {
      const values = {
        userId: user.id,
        data: sliced[key],
        clientUpdatedAt: incomingClientUpdatedAt,
        serverUpdatedAt,
      };
      return getDb()
        .insert(table)
        .values(values)
        .onConflictDoUpdate({
          target: table.userId,
          set: {
            data: values.data,
            clientUpdatedAt: values.clientUpdatedAt,
            serverUpdatedAt: values.serverUpdatedAt,
          },
        })
        .returning();
    }

    // A batch, not a loop of independent requests: neon-http doesn't support
    // interactive transactions, but .batch() sends all six upserts as one
    // all-or-nothing round trip, so this stays as atomic as the old single-row
    // upsert was.
    const [bookmarksRows, widgetsRows, vaultItemsRows, readItemsRows, themesRows, preferencesRows] = await getDb().batch([
      upsertDomain(userBookmarks, "bookmarks"),
      upsertDomain(userWidgets, "widgets"),
      upsertDomain(userVaultItems, "vaultItems"),
      upsertDomain(userReadItems, "readItems"),
      upsertDomain(userThemes, "themes"),
      upsertDomain(userPreferences, "preferences"),
    ]);

    const rows: DomainRows = {
      bookmarks: bookmarksRows[0],
      widgets: widgetsRows[0],
      vaultItems: vaultItemsRows[0],
      readItems: readItemsRows[0],
      themes: themesRows[0],
      preferences: preferencesRows[0],
    };

    return json(toResponse(rows));
  } catch (err) {
    return errorResponse(err);
  }
}
