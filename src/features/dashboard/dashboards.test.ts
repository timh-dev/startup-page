import { describe, expect, it } from "vitest";
import { merge3 } from "@/lib/sync/merge";
import {
  MAIN_DASHBOARD,
  addDashboard,
  copyDashboard,
  listDashboards,
  readDashboard,
  removeDashboard,
  renameDashboard,
  resolveActiveId,
  writeDashboard,
} from "./dashboards";

const card = (id: string) => ({ id, type: "clock" as const, size: "small" as const, config: {}, pos: { x: 0, y: 0 } });

const base = {
  widgets: [card("a"), card("b")],
  layout: { columns: 8, rows: 5, joins: [["a", "b"]], bookmarkBoxCategories: [] },
  bookmark: [{ id: "g1" }],
};

describe("dashboards", () => {
  it("treats the settings' own widgets and layout as main", () => {
    expect(listDashboards(base)).toEqual([{ id: MAIN_DASHBOARD, name: "Home" }]);
    const main = readDashboard(base, MAIN_DASHBOARD);
    expect(main.widgets).toBe(base.widgets);
    expect(main).toMatchObject({ columns: 8, rows: 5, joins: [["a", "b"]] });
  });

  it("adds, writes, renames and removes another, leaving main alone", () => {
    const { settings: added, id } = addDashboard(base, " Work ", { widgets: [card("w")], columns: 6, rows: 3, joins: [] });
    expect(listDashboards(added).map((d) => d.name)).toEqual(["Home", "Work"]);
    expect(readDashboard(added, id).widgets.map((w) => w.id)).toEqual(["w"]);
    expect(added.widgets).toBe(base.widgets);

    const written = writeDashboard(added, id, { widgets: [card("w"), card("x")], rows: 4 });
    expect(readDashboard(written, id)).toMatchObject({ rows: 4, columns: 6 });
    expect(readDashboard(written, MAIN_DASHBOARD).widgets).toBe(base.widgets);

    const renamed = renameDashboard(renameDashboard(written, id, "Office"), MAIN_DASHBOARD, "Personal");
    expect(listDashboards(renamed).map((d) => d.name)).toEqual(["Personal", "Office"]);
    expect(renameDashboard(renamed, id, "  ")).toBe(renamed);

    const removed = removeDashboard(renamed, id);
    expect(listDashboards(removed).map((d) => d.id)).toEqual([MAIN_DASHBOARD]);
    expect(removeDashboard(removed, MAIN_DASHBOARD)).toBe(removed);
  });

  it("writes main's cards without touching its layout object", () => {
    const next = writeDashboard(base, MAIN_DASHBOARD, { widgets: [card("c")] });
    expect(next.layout).toBe(base.layout);
    expect(writeDashboard(base, MAIN_DASHBOARD, { rows: 6 }).layout).toMatchObject({ rows: 6, columns: 8, bookmarkBoxCategories: [] });
  });

  it("falls back to main for a dashboard that's gone", () => {
    expect(resolveActiveId(base, "deleted-elsewhere")).toBe(MAIN_DASHBOARD);
    expect(readDashboard(base, "deleted-elsewhere").widgets).toBe(base.widgets);
  });

  it("copies with fresh ids, keeping joins and stacks pointed at the copies", () => {
    const stack = { ...card("s"), type: "stack" as const, items: [card("inner")] };
    const copy = copyDashboard({ widgets: [card("a"), card("b"), stack], joins: [["a", "b", "window"], ["a", "gone"]], columns: 8, rows: 5 });
    const ids = copy.widgets.map((w) => w.id);
    expect(ids).not.toContain("a");
    expect(copy.joins).toEqual([[ids[0], ids[1], "window"]]);
    expect(copy.widgets[2].items?.[0].id).not.toBe("inner");
  });

  it("merges edits made to different dashboards on two devices", () => {
    const { settings: start, id } = addDashboard(base, "Work", { widgets: [card("w")], joins: [] });
    const deviceA = writeDashboard(start, id, { widgets: [card("w"), card("w2")] });
    const deviceB = writeDashboard(start, MAIN_DASHBOARD, { widgets: [...base.widgets, card("c")] });
    const merged = merge3(start, deviceA, deviceB).value;
    expect(readDashboard(merged, id).widgets.map((w) => w.id)).toEqual(["w", "w2"]);
    expect(readDashboard(merged, MAIN_DASHBOARD).widgets.map((w) => w.id)).toEqual(["a", "b", "c"]);
  });
});
