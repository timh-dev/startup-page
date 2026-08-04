import { describe, expect, it } from "vitest";
import {
  formatItemDate,
  groupItemsByDate,
  groupLabelFor,
  normalizeResourceVaultItems,
  normalizeVaultItems,
  startOfDay,
} from "./utils";

// Noon UTC keeps the calendar day stable regardless of the running machine's
// timezone offset (up to +/-14h), so these tests aren't locale/TZ-flaky.
const NOON_UTC = "T12:00:00.000Z";

describe("formatItemDate", () => {
  it("formats as uppercase 3-letter month + zero-padded day", () => {
    expect(formatItemDate(`2024-06-05${NOON_UTC}`)).toBe("JUN 05");
    expect(formatItemDate(`2024-12-25${NOON_UTC}`)).toBe("DEC 25");
  });

  it("falls back to the current date when no value is given", () => {
    const now = new Date();
    const expected = `${now.toLocaleString(undefined, { month: "short" }).toUpperCase()} ${String(now.getDate()).padStart(2, "0")}`;
    expect(formatItemDate(null)).toBe(expected);
    expect(formatItemDate(undefined)).toBe(expected);
  });
});

describe("startOfDay", () => {
  it("zeroes out the time-of-day component", () => {
    const date = new Date(2024, 5, 15, 14, 30, 45);
    const midnight = new Date(2024, 5, 15, 0, 0, 0);
    expect(startOfDay(date)).toBe(midnight.getTime());
  });
});

describe("groupLabelFor", () => {
  const now = new Date(2024, 5, 15, 10, 0, 0); // Sat Jun 15 2024, local time

  it("labels today and yesterday", () => {
    expect(groupLabelFor(new Date(2024, 5, 15, 2, 0, 0).toISOString(), now)).toBe("Today");
    expect(groupLabelFor(new Date(2024, 5, 14, 23, 0, 0).toISOString(), now)).toBe("Yesterday");
  });

  it("labels the rest of the last 7 days by weekday name", () => {
    const threeDaysAgo = new Date(2024, 5, 12, 12, 0, 0);
    expect(groupLabelFor(threeDaysAgo.toISOString(), now)).toBe(
      threeDaysAgo.toLocaleDateString(undefined, { weekday: "long" }),
    );
  });

  it("falls back to a month/day (with year once it's not this year) beyond a week", () => {
    const overAWeekAgo = new Date(2024, 4, 1, 12, 0, 0); // May 1 2024
    expect(groupLabelFor(overAWeekAgo.toISOString(), now)).toBe(
      overAWeekAgo.toLocaleDateString(undefined, { month: "short", day: "numeric", year: undefined }),
    );

    const lastYear = new Date(2023, 4, 1, 12, 0, 0);
    expect(groupLabelFor(lastYear.toISOString(), now)).toBe(
      lastYear.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }),
    );
  });

  it("treats a missing date as today (uses `now` as the fallback target)", () => {
    expect(groupLabelFor(null, now)).toBe("Today");
  });
});

describe("groupItemsByDate", () => {
  it("buckets items by calendar day, merging same-day items into one group regardless of label text", () => {
    // These fixture dates are in the past relative to whenever this test
    // runs, so the exact label text (e.g. "Today" vs "Jun 15, 2024") depends
    // on real wall-clock time — what must hold regardless is that same-day
    // items land in one group and a different day gets its own.
    const items = [
      { id: "1", createdAt: "2024-06-15T10:00:00.000Z" },
      { id: "2", createdAt: "2024-06-14T10:00:00.000Z" },
      { id: "3", createdAt: "2024-06-15T11:00:00.000Z" },
    ];
    const groups = groupItemsByDate(items, (item) => item.createdAt);

    expect(groups).toHaveLength(2);
    const groupOfItem1 = groups.find((g) => g.items.some((i: any) => i.id === "1"));
    const groupOfItem2 = groups.find((g) => g.items.some((i: any) => i.id === "2"));
    expect(groupOfItem1?.items.map((i: any) => i.id)).toEqual(["1", "3"]);
    expect(groupOfItem2?.items.map((i: any) => i.id)).toEqual(["2"]);
  });

  it("returns an empty array for an empty item list", () => {
    expect(groupItemsByDate([], () => null)).toEqual([]);
  });
});

describe("normalizeVaultItems", () => {
  it("drops items with neither a title nor a body", () => {
    const result = normalizeVaultItems([{ title: "", body: "" }, { title: "Kept", body: "" }]);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Kept");
  });

  it("defaults kind to the explicit override kind, or 'code' otherwise", () => {
    const [asTemplate] = normalizeVaultItems([{ title: "x" }], "template");
    expect(asTemplate.kind).toBe("template");

    const [asDefault] = normalizeVaultItems([{ title: "x" }]);
    expect(asDefault.kind).toBe("code");
  });

  it("preserves a valid explicit kind even when a different override kind is passed for filtering", () => {
    const result = normalizeVaultItems([{ title: "x", kind: "template" }], "template");
    expect(result[0].kind).toBe("template");
  });

  it("filters out items that don't match the requested kind after normalization", () => {
    const result = normalizeVaultItems([{ title: "code snippet", kind: "code" }], "template");
    expect(result).toEqual([]);
  });

  it("falls back to 'prompt' for an invalid templateType", () => {
    const [item] = normalizeVaultItems([{ title: "x", templateType: "not-a-real-type" }]);
    expect(item.templateType).toBe("prompt");
  });

  it("generates an id and timestamps when missing, and reuses a valid createdAt for updatedAt", () => {
    const [item] = normalizeVaultItems([{ title: "x", createdAt: "2024-01-01T00:00:00.000Z" }]);
    expect(item.id).toBeTruthy();
    expect(item.createdAt).toBe("2024-01-01T00:00:00.000Z");
    expect(item.updatedAt).toBe("2024-01-01T00:00:00.000Z");
  });

  it("accepts a { vaultItems: [...] } or { items: [...] } wrapper as well as a bare array", () => {
    const fromVaultItems = normalizeVaultItems({ vaultItems: [{ title: "x" }] });
    const fromItems = normalizeVaultItems({ items: [{ title: "x" }] });
    expect(fromVaultItems).toHaveLength(1);
    expect(fromItems).toHaveLength(1);
  });

  it("returns an empty array for unrecognized input shapes", () => {
    expect(normalizeVaultItems(null)).toEqual([]);
    expect(normalizeVaultItems("nope")).toEqual([]);
  });
});

describe("normalizeResourceVaultItems", () => {
  it("drops items without a title", () => {
    const result = normalizeResourceVaultItems([{ title: "" }, { title: "Kept", url: "https://x" }]);
    expect(result).toHaveLength(1);
  });

  it("defaults tag to 'Read' when the given tag isn't one of the known tags", () => {
    const [item] = normalizeResourceVaultItems([{ title: "x", tag: "NotARealTag" }]);
    expect(item.tag).toBe("Read");
  });

  it("normalizes status to 'todo' unless explicitly 'done'", () => {
    const [todo] = normalizeResourceVaultItems([{ title: "x", status: "whatever" }]);
    const [done] = normalizeResourceVaultItems([{ title: "y", status: "done" }]);
    expect(todo.status).toBe("todo");
    expect(done.status).toBe("done");
  });

  it("only keeps completedAt for done items with a valid date, defaulting to createdAt", () => {
    const [doneNoDate] = normalizeResourceVaultItems([{ title: "x", status: "done", createdAt: "2024-01-01T00:00:00.000Z" }]);
    expect(doneNoDate.completedAt).toBe("2024-01-01T00:00:00.000Z");

    const [notDone] = normalizeResourceVaultItems([{ title: "x", status: "todo" }]);
    expect(notDone.completedAt).toBeNull();
  });

  it("accepts a { readItems: [...] } wrapper as well as a bare array", () => {
    expect(normalizeResourceVaultItems({ readItems: [{ title: "x" }] })).toHaveLength(1);
  });
});
