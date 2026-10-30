#!/usr/bin/env node
// Generates src/assets/world/land-mask.png: an equirectangular land mask
// (white = land, black = sea) for the dot globe widget.
//
// Source: Natural Earth 1:50m land (public domain), via the world-atlas
// package's TopoJSON on jsDelivr. Node built-ins only: TopoJSON decoding, a
// scanline polygon fill and a minimal PNG encoder.
//
//   node scripts/generate-land-mask.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const SOURCE = "https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/land-50m.json";
const WIDTH = 1024;
const HEIGHT = 512;
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "../src/assets/world/land-mask.png");

const topology = await (await fetch(SOURCE)).json();

// TopoJSON arcs are quantized and delta-encoded; decode them to [lon, lat].
const { scale, translate } = topology.transform;
const arcs = topology.arcs.map((arc) => {
  let x = 0;
  let y = 0;
  return arc.map(([dx, dy]) => {
    x += dx;
    y += dy;
    return [x * scale[0] + translate[0], y * scale[1] + translate[1]];
  });
});

// A ring is a list of arc indexes; a negative index ~i is arc i reversed.
const ring = (indexes) =>
  indexes.flatMap((index, n) => {
    const points = index < 0 ? [...arcs[~index]].reverse() : arcs[index];
    return n === 0 ? points : points.slice(1);
  });

const polygons = [];
const collect = (geometry) => {
  if (geometry.type === "GeometryCollection") geometry.geometries.forEach(collect);
  else if (geometry.type === "Polygon") polygons.push(geometry.arcs.map(ring));
  else if (geometry.type === "MultiPolygon") geometry.arcs.forEach((polygon) => polygons.push(polygon.map(ring)));
};
collect(topology.objects.land);

// Scanline fill with the even-odd rule at each pixel row's centre, so holes
// (lakes) stay sea. Rings that cross the antimeridian are unwrapped so they
// stay continuous (an edge from 179° to -179° would otherwise span the whole
// map), and fills wrap around the map's edges. Polygons are OR-ed in, so
// overlapping ones don't cancel.
const mask = new Uint8Array(WIDTH * HEIGHT);
const toX = (lon) => ((lon + 180) / 360) * WIDTH;
const toY = (lat) => ((90 - lat) / 180) * HEIGHT;
for (const polygon of polygons) {
  const edges = [];
  for (const raw of polygon) {
    // Unwrap: keep each step under 180° of longitude.
    const points = [];
    let offset = 0;
    for (let i = 0; i < raw.length; i++) {
      if (i > 0) {
        const step = raw[i][0] - raw[i - 1][0];
        if (step > 180) offset -= 360;
        else if (step < -180) offset += 360;
      }
      points.push([raw[i][0] + offset, raw[i][1]]);
    }
    for (let i = 0; i < points.length - 1; i++) {
      const [x0, y0] = [toX(points[i][0]), toY(points[i][1])];
      const [x1, y1] = [toX(points[i + 1][0]), toY(points[i + 1][1])];
      if (y0 !== y1) edges.push([x0, y0, x1, y1]);
    }
  }
  for (let row = 0; row < HEIGHT; row++) {
    const y = row + 0.5;
    const crossings = [];
    for (const [x0, y0, x1, y1] of edges) {
      if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) crossings.push(x0 + ((y - y0) / (y1 - y0)) * (x1 - x0));
    }
    crossings.sort((a, b) => a - b);
    for (let i = 0; i + 1 < crossings.length; i += 2) {
      const from = Math.round(crossings[i]);
      const to = Math.round(crossings[i + 1]);
      for (let x = from; x < to; x++) mask[row * WIDTH + (((x % WIDTH) + WIDTH) % WIDTH)] = 255;
    }
  }
}

// Minimal 8-bit greyscale PNG.
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (bytes) => {
  let c = 0xffffffff;
  for (const byte of bytes) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), body.length + 4);
  return out;
};
const header = Buffer.alloc(13);
header.writeUInt32BE(WIDTH, 0);
header.writeUInt32BE(HEIGHT, 4);
header[8] = 8; // bit depth
header[9] = 0; // greyscale
const rows = Buffer.alloc((WIDTH + 1) * HEIGHT);
for (let row = 0; row < HEIGHT; row++) {
  rows[row * (WIDTH + 1)] = 0; // filter: none
  Buffer.from(mask.buffer, row * WIDTH, WIDTH).copy(rows, row * (WIDTH + 1) + 1);
}
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", header),
  chunk("IDAT", deflateSync(rows, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, png);
const land = mask.reduce((sum, v) => sum + (v ? 1 : 0), 0) / mask.length;
console.log(`Wrote ${OUT} (${WIDTH}×${HEIGHT}, ${(png.length / 1024).toFixed(1)} KB, ${(land * 100).toFixed(1)}% land)`);
