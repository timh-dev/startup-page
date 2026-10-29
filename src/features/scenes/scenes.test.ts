import { describe, expect, it } from "vitest";
import { SIZE_CELLS } from "@/features/dashboard/layout/grid";
import { SCENES, applyScene, getScene, sceneWidgets } from "./scenes";

const folders = ["f1", "f2", "f3", "f4", "f5"];

describe("theme layouts", () => {
  it.each(SCENES.map((scene) => [scene.id, scene] as const))("%s fits one 7x4 page with no overlaps", (_id, scene) => {
    const taken = new Set<string>();
    for (const widget of sceneWidgets(scene, folders)) {
      const { w, h } = SIZE_CELLS[widget.size];
      for (let x = widget.pos!.x; x < widget.pos!.x + w; x++) {
        for (let y = widget.pos!.y; y < widget.pos!.y + h; y++) {
          expect(x).toBeLessThan(7);
          expect(y).toBeLessThan(4);
          expect(taken.has(`${x},${y}`), `${scene.id}: ${widget.id} overlaps at ${x},${y}`).toBe(false);
          taken.add(`${x},${y}`);
        }
      }
    }
  });

  it("gives media cards the theme's videos and photo topics, and bookmark cards the user's folders", () => {
    const space = getScene("space")!;
    const widgets = sceneWidgets(space, ["a", "b"]);
    expect(widgets.filter((w) => w.type === "video").map((w) => w.config.url)).toEqual(space.videos);
    expect(widgets.find((w) => w.type === "photo")?.config.searchTerms).toEqual(space.photos[0]);
    // Only two folders: the other bookmark slots stay empty.
    expect(widgets.filter((w) => w.type === "bookmark").map((w) => w.config.groupId)).toEqual(["a", "b"]);
  });
});

describe("applyScene", () => {
  const settings = {
    ui: { themePalette: "zen", themeMode: "system", cardStyle: "soft" },
    widgets: [
      { id: "v", type: "video", size: "small", config: { url: "old.mp4", zoom: 2 } },
      { id: "s", type: "stack", size: "feature", config: {}, items: [{ id: "p", type: "photo", size: "small", config: { searchTerms: ["cats"] } }] },
      { id: "c", type: "clock", size: "small", config: {} },
    ],
    layout: { columns: 9, joins: [["v", "c"]] },
    bookmark: [{ id: "g1" }],
    readItems: [{ id: "r" }],
  };

  it("restyles only (look): palette, mode, theme, and media on the existing cards", () => {
    const next = applyScene(settings, "ocean", "look");
    expect(next.ui).toEqual({ themePalette: "ocean", themeMode: "system", cardStyle: "soft", scene: "ocean" });
    expect(next.widgets.map((w) => w.id)).toEqual(["v", "s", "c"]);
    expect(next.widgets[0].config).toMatchObject({ url: getScene("ocean")!.videos[0], zoom: 1 });
    expect(next.widgets[1].items![0].config.searchTerms).toEqual(getScene("ocean")!.photos[0]);
    expect(next.layout).toBe(settings.layout);
    expect(next.readItems).toBe(settings.readItems);
  });

  it("replaces the cards and clears joins (layout), keeping everything else", () => {
    const next = applyScene(settings, "arctic", "layout");
    expect(next.widgets.every((w) => w.id.startsWith("arctic-"))).toBe(true);
    expect(next.layout).toEqual({ columns: 7, joins: [] });
    expect(next.bookmark).toBe(settings.bookmark);
    expect(next.readItems).toBe(settings.readItems);
  });
});
