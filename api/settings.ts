import { eq, sql } from "drizzle-orm";
import { getDb } from "./_lib/db.js";
import { getCurrentUser, requireSyncAccess } from "./_lib/auth.js";
import { json, errorResponse } from "./_lib/http.js";
import { DOMAIN_TABLE_ENTRIES, type DomainKey } from "./_lib/settingsDomains.js";
import { MAX_SETTINGS_BYTES, settingsPutSchema } from "./_lib/settingsSchema.js";
import { stripWidgetCredentials } from "../shared/credentials.js";

// Cloud sync, one record per settings domain. Each record has a version the
// server bumps on every write. GET returns every domain's data and version.
// PUT sends only changed domains, each with the version it was based on; a
// domain is written only if that is still the stored version, otherwise its
// current data and version come back as a conflict for the client to merge
// and resend. Ordering never depends on a device's clock.

interface StoredDomain {
  data: unknown;
  version: number;
}

type DomainResult = { status: "ok"; version: number } | ({ status: "conflict" } & StoredDomain);

async function readDomains(userId: string, keys?: DomainKey[]): Promise<Partial<Record<DomainKey, StoredDomain>>> {
  const entries = DOMAIN_TABLE_ENTRIES.filter(({ key }) => !keys || keys.includes(key));
  const rows = await Promise.all(
    entries.map(({ table }) =>
      getDb()
        .select({ data: table.data, version: table.version })
        .from(table)
        .where(eq(table.userId, userId))
        .limit(1)
        .then((result) => result[0]),
    ),
  );

  const domains: Partial<Record<DomainKey, StoredDomain>> = {};
  entries.forEach(({ key }, i) => {
    if (rows[i]) domains[key] = rows[i];
  });
  return domains;
}

export async function GET(request: Request): Promise<Response> {
  try {
    // Reads only require sign-in: a lapsed subscriber can always retrieve their data.
    const user = await getCurrentUser(request);
    return json({ domains: await readDomains(user.id) });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PUT(request: Request): Promise<Response> {
  try {
    const user = await getCurrentUser(request);
    requireSyncAccess(user);

    const body = await request.text();
    if (body.length > MAX_SETTINGS_BYTES) {
      return json({ detail: "Settings are too large to sync" }, 413);
    }
    let raw: unknown = null;
    try {
      raw = JSON.parse(body);
    } catch {
      // Falls through to the schema error below.
    }
    // Clients from before versioned sync push the whole settings object with
    // a timestamp. Accepting that would let a stale copy overwrite newer
    // data, so refuse it; a reload picks up the current client.
    if (raw && typeof raw === "object" && "settings" in raw && !("domains" in raw)) {
      return json({ detail: "This copy of the app is out of date. Reload the page to update it." }, 426);
    }
    const parsed = settingsPutSchema.safeParse(raw);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const where = issue?.path.length ? ` at ${issue.path.join(".")}` : "";
      return json({ detail: `Invalid settings${where}: ${issue?.message ?? "malformed body"}` }, 422);
    }

    const changes = DOMAIN_TABLE_ENTRIES.flatMap(({ key, table }) => {
      const change = parsed.data.domains[key];
      if (!change) return [];
      // API keys stay on the device; drop any an out-of-date client still sends.
      const data =
        key === "widgets" ? { ...change.data, widgets: stripWidgetCredentials((change.data as { widgets?: unknown[] }).widgets) } : change.data;
      return [{ key, table, data, baseVersion: change.base_version }];
    });
    if (!changes.length) {
      return json({ domains: {} });
    }

    // One round trip, all-or-nothing. Each statement inserts the domain's
    // first record (version 1) or, if one exists, updates it only when its
    // version still matches; otherwise it changes nothing and returns no row.
    const serverUpdatedAt = new Date();
    const queries = changes.map(({ table, data, baseVersion }) =>
      getDb()
        .insert(table)
        .values({ userId: user.id, data, version: 1, serverUpdatedAt })
        .onConflictDoUpdate({
          target: table.userId,
          set: { data, version: sql`${table.version} + 1`, serverUpdatedAt },
          setWhere: eq(table.version, baseVersion),
        })
        .returning({ version: table.version }),
    );
    const written = await getDb().batch(queries as unknown as [(typeof queries)[number], ...(typeof queries)[number][]]);

    const results: Partial<Record<DomainKey, DomainResult>> = {};
    const conflicted: DomainKey[] = [];
    changes.forEach(({ key }, i) => {
      const row = (written[i] as Array<{ version: number }>)[0];
      if (row) results[key] = { status: "ok", version: row.version };
      else conflicted.push(key);
    });

    if (conflicted.length) {
      const current = await readDomains(user.id, conflicted);
      for (const key of conflicted) {
        const stored = current[key] ?? { data: null, version: 0 };
        results[key] = { status: "conflict", data: stored.data, version: stored.version };
      }
    }

    return json({ domains: results });
  } catch (err) {
    return errorResponse(err);
  }
}
