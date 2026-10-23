import { sql } from "drizzle-orm";
import {
  jsonb,
  pgTable,
  timestamp,
  uuid,
  varchar,
  text,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  clerkUserId: varchar("clerk_user_id", { length: 128 }).notNull().unique(),
  email: text("email"),
  stripeCustomerId: varchar("stripe_customer_id", { length: 128 }).unique(),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 128 }).unique(),
  subscriptionStatus: varchar("subscription_status", { length: 32 })
    .notNull()
    .default("none"),
  subscriptionPeriodEnd: timestamp("subscription_period_end", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;

// One table per settings domain, replacing the old single-blob
// `user_settings` table. Each still stores its slice of the settings object
// as JSONB (rather than a fully relational shape) — the domains involved
// (widget configs, vault items, image-effect settings, ...) have shapes that
// evolve often, and per-domain JSONB gets the "everything in one table"
// problem solved without a rigid column schema per field. See
// api/_lib/settingsDomains.ts for the mapping between these tables and the
// settings object's top-level keys.
function domainTable(name: string, dataDefault: "[]" | "{}") {
  return pgTable(name, {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" })
      .unique(),
    data: jsonb("data").notNull().default(sql.raw(`'${dataDefault}'::jsonb`)),
    clientUpdatedAt: timestamp("client_updated_at", { withTimezone: true }),
    serverUpdatedAt: timestamp("server_updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  });
}

export const userBookmarks = domainTable("user_bookmarks", "[]");
export const userWidgets = domainTable("user_widgets", "{}");
export const userVaultItems = domainTable("user_vault_items", "[]");
export const userReadItems = domainTable("user_read_items", "[]");
export const userThemes = domainTable("user_themes", "[]");
export const userPreferences = domainTable("user_preferences", "{}");

export type UserBookmarksRow = typeof userBookmarks.$inferSelect;
export type UserWidgetsRow = typeof userWidgets.$inferSelect;
export type UserVaultItemsRow = typeof userVaultItems.$inferSelect;
export type UserReadItemsRow = typeof userReadItems.$inferSelect;
export type UserThemesRow = typeof userThemes.$inferSelect;
export type UserPreferencesRow = typeof userPreferences.$inferSelect;
