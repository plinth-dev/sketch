import { test } from "node:test";
import assert from "node:assert/strict";
import { parse } from "../src/parser.js";

test("parses a node with sublabel", () => {
  const r = parse(`@layer Test\napi : API tier / Go · chi`);
  assert.equal(r.nodeOrder.length, 1);
  assert.deepEqual(r.nodes.api, { id: "api", label: "API tier", sub: "Go · chi", layer: "Test" });
});

test("parses a node without sublabel", () => {
  const r = parse(`@layer Test\nbox : Just a label`);
  assert.equal(r.nodes.box.label, "Just a label");
  assert.equal(r.nodes.box.sub, null);
});

test("parses a labelled edge", () => {
  const r = parse(`@layer Test\na : A\nb : B\na -> b : http`);
  assert.equal(r.edges.length, 1);
  assert.equal(r.edges[0].from, "a");
  assert.equal(r.edges[0].to, "b");
  assert.equal(r.edges[0].label, "http");
});

test("parses an unlabelled edge", () => {
  const r = parse(`@layer Test\na : A\nb : B\na -> b`);
  assert.equal(r.edges[0].label, null);
});

test("edges to undefined nodes surface as warnings", () => {
  const r = parse(`@layer T\na : A\na -> ghost`);
  assert.equal(r.errors.length, 0);
  assert.ok(r.warnings.length > 0);
  const w = r.warnings.find((w) => w.kind === "undefined-nodes");
  assert.ok(w, "expected an undefined-nodes warning");
  assert.deepEqual(w.ids, ["ghost"]);
});

test("self-loop edges surface as warnings", () => {
  const r = parse(`@layer T\na : A\na -> a`);
  const w = r.warnings.find((w) => w.kind === "self-loop");
  assert.ok(w, "expected a self-loop warning");
});

test("ignores comments and blank lines", () => {
  const r = parse(`# top comment\n\n@layer Test\n# inside\na : A\n`);
  assert.equal(r.nodeOrder.length, 1);
  assert.equal(r.errors.length, 0);
});

test("attaches @cite", () => {
  const r = parse(`@cite Source: ACME 2026`);
  assert.equal(r.cite, "Source: ACME 2026");
});

test("first definition wins on duplicate id", () => {
  const r = parse(`@layer A\nx : First\n@layer B\nx : Second`);
  assert.equal(r.nodes.x.label, "First");
  assert.equal(r.nodes.x.layer, "A");
});

test("nodes outside any layer are kept but unbound to a layer", () => {
  const r = parse(`floater : Floats / no layer`);
  assert.equal(r.nodes.floater.layer, null);
  assert.equal(r.layers.length, 0);
});

test("layers preserve declaration order even when revisited", () => {
  const r = parse(`@layer A\na : A1\n@layer B\nb : B1\n@layer A\na2 : A2`);
  const aLayer = r.layers.find((l) => l.name === "A");
  assert.deepEqual(aLayer.ids, ["a", "a2"]);
  assert.equal(r.layers.length, 2);
});

test("ids may include ., -, /, _", () => {
  const r = parse(`@layer T\nmy.svc : Service\napi/v2 : V2\nfoo-bar : FB\nx_y : XY`);
  assert.equal(r.nodeOrder.length, 4);
  assert.equal(r.errors.length, 0);
});

test("CRLF line endings are tolerated", () => {
  const r = parse(`@layer T\r\na : A\r\nb : B\r\na -> b\r\n`);
  assert.equal(r.nodeOrder.length, 2);
  assert.equal(r.edges.length, 1);
});

test("unparseable lines surface as errors but do not abort", () => {
  const r = parse(`@layer T\na : A\n!!! garbage line !!!\nb : B`);
  assert.equal(r.errors.length, 1);
  assert.equal(r.errors[0].line, 3);
  assert.equal(r.nodeOrder.length, 2);
});
