import { test } from "node:test";
import assert from "node:assert/strict";
import { parse } from "../src/parser.js";
import { layout } from "../src/layout.js";

test("places one node in one layer", () => {
  const p = parse(`@layer L\nx : X`);
  const l = layout(p);
  assert.equal(l.placedLayers.length, 1);
  assert.ok(p.nodes.x._x !== undefined);
  assert.ok(p.nodes.x._w >= 140);
});

test("expands canvas to honour NODE_MIN_W with many nodes", () => {
  const ids = Array.from({ length: 8 }, (_, i) => `n${i}`);
  const dsl = `@layer Big\n${ids.map((id) => `${id} : Node${id}`).join("\n")}`;
  const p = parse(dsl);
  const l = layout(p);
  // 8 nodes * 140 min + 7 gaps + paddings ≈ should exceed default 960
  assert.ok(l.width > 960, `canvas should expand; got ${l.width}`);
  for (const id of ids) {
    assert.ok(p.nodes[id]._w >= 140, `node ${id} width ${p.nodes[id]._w} below minimum`);
  }
});

test("never produces negative or zero node widths", () => {
  const ids = Array.from({ length: 30 }, (_, i) => `n${i}`);
  const dsl = `@layer Massive\n${ids.map((id) => `${id} : ${id}`).join("\n")}`;
  const p = parse(dsl);
  const l = layout(p);
  for (const id of ids) {
    assert.ok(p.nodes[id]._w > 0, `node ${id} width must be positive: ${p.nodes[id]._w}`);
  }
});

test("layers stack top to bottom in declaration order", () => {
  const p = parse(`@layer A\na : A\n@layer B\nb : B\n@layer C\nc : C`);
  const l = layout(p);
  assert.equal(l.placedLayers[0].name, "A");
  assert.equal(l.placedLayers[1].name, "B");
  assert.equal(l.placedLayers[2].name, "C");
  assert.ok(l.placedLayers[1].y > l.placedLayers[0].y);
  assert.ok(l.placedLayers[2].y > l.placedLayers[1].y);
});

test("empty layers are skipped", () => {
  const p = parse(`@layer A\na : A\n@layer Empty\n@layer C\nc : C`);
  const l = layout(p);
  assert.equal(l.placedLayers.length, 2);
  assert.deepEqual(l.placedLayers.map((x) => x.name), ["A", "C"]);
});
