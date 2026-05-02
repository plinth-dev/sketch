import { test } from "node:test";
import assert from "node:assert/strict";
import { sketch } from "../src/index.js";

test("end-to-end produces an SVG document", () => {
  const svg = sketch(`@layer A\na : A\nb : B\na -> b : edge`);
  assert.match(svg, /^<svg /);
  assert.match(svg, /<\/svg>$/);
  // Class is per-render-namespaced (ps-<hash>) so multiple SVGs on one page
  // don't collide on <marker id> or scoped CSS.
  assert.match(svg, /class="ps-[a-z0-9]+"/);
});

test("two renders of the same DSL produce byte-identical output", () => {
  const a = sketch(`@layer T\nx : X\ny : Y\nx -> y`);
  const b = sketch(`@layer T\nx : X\ny : Y\nx -> y`);
  assert.equal(a, b);
});

test("two renders of different DSLs use different class namespaces", () => {
  const a = sketch(`@layer T\nx : X`);
  const b = sketch(`@layer T\ny : Y`);
  const nsA = (a.match(/class="(ps-[a-z0-9]+)"/) || [])[1];
  const nsB = (b.match(/class="(ps-[a-z0-9]+)"/) || [])[1];
  assert.ok(nsA && nsB && nsA !== nsB);
});

test("self-loop edges are skipped (warned-but-not-rendered)", () => {
  const svg = sketch(`@layer T\na : A\na -> a : self`);
  // No path element should be emitted for the self-loop.
  const pathCount = (svg.match(/<path /g) || []).length;
  // Markers contain <path d="..."/> too; just check connection paths via
  // the conn class.
  const connCount = (svg.match(/class="conn"/g) || []).length
    + (svg.match(/class="conn-mute"/g) || []).length;
  assert.equal(connCount, 0);
});

test("cite is suppressed when no nodes render", () => {
  const svg = sketch(`# only comments\n# no nodes`);
  assert.ok(!svg.includes("Made with Plinth Sketch"));
});

test("escapes HTML-significant characters in labels", () => {
  const svg = sketch(`@layer T\nx : <bad> & "quoted"`);
  assert.ok(!svg.includes("<bad>"), "raw < should not appear in output");
  assert.ok(svg.includes("&lt;bad&gt;"));
  assert.ok(svg.includes("&quot;quoted&quot;"));
});

test("includes default Made with Plinth Sketch cite", () => {
  const svg = sketch(`@layer T\nx : X`);
  assert.ok(svg.includes("Made with Plinth Sketch"));
});

test("respects @cite override", () => {
  const svg = sketch(`@cite Custom Caption\n@layer T\nx : X`);
  assert.ok(svg.includes("Custom Caption"));
  assert.ok(!svg.includes("Made with Plinth Sketch"));
});

test("respects signature: false option", () => {
  const svg = sketch(`@layer T\nx : X`, { signature: false });
  assert.ok(!svg.includes("Made with Plinth Sketch"));
});

test("emits viewBox + width + height attributes", () => {
  const svg = sketch(`@layer T\nx : X\ny : Y`);
  assert.match(svg, /viewBox="0 0 \d+ \d+"/);
  assert.match(svg, /width="\d+"/);
  assert.match(svg, /height="\d+"/);
});
