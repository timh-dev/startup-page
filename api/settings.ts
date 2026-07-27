import { eq } from "drizzle-orm";
import { getDb } from "./_lib/db.js";
import { userSettings, type UserSettingsRow } from "./_lib/schema.js";
import { getCurrentUser, requireSyncAccess } from "./_lib/auth.js";
import { json, errorResponse } from "./_lib/http.js";

function toResponse(row: UserSettingsRow) {
  return {
    settings: row.settings,
    schema_version: row.schemaVersion,
    server_updated_at: row.serverUpdatedAt,
    client_updated_at: row.clientUpdatedAt,
  };
}

export async function GET(request: Request): Promise<Response> {
  try {
    // Reads only require sign-in: a lapsed subscriber can always retrieve their data.
    const user = await getCurrentUser(request);
    const row = await getDb().query.userSettings.findFirst({
      where: eq(userSettings.userId, user.id),
    });
    if (!row) return json({ detail: "No settings saved yet" }, 404);
    return json(toResponse(row));
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

    const existing = await getDb().query.userSettings.findFirst({
      where: eq(userSettings.userId, user.id),
    });

    // Last line of defense: never let a push silently replace existing data
    // with something older (or something carrying no timestamp at all, e.g.
    // a client bug pushing freshly-seeded default state). Reject instead of
    // overwriting so the caller can reconcile.
    if (existing) {
      const existingTime = existing.clientUpdatedAt?.getTime() ?? 0;
      const incomingTime = incomingClientUpdatedAt?.getTime() ?? 0;
      if (incomingTime < existingTime) {
        return json({ detail: "Conflict: server has newer data", ...toResponse(existing) }, 409);
      }
    }

    const values = {
      userId: user.id,
      schemaVersion: Number(payload.schema_version) || 2,
      settings: payload.settings,
      clientUpdatedAt: incomingClientUpdatedAt,
      serverUpdatedAt: new Date(),
    };

    const [row] = await getDb()
      .insert(userSettings)
      .values(values)
      .onConflictDoUpdate({
        target: userSettings.userId,
        set: {
          schemaVersion: values.schemaVersion,
          settings: values.settings,
          clientUpdatedAt: values.clientUpdatedAt,
          serverUpdatedAt: values.serverUpdatedAt,
        },
      })
      .returning();

    return json(toResponse(row));
  } catch (err) {
    return errorResponse(err);
  }
}
