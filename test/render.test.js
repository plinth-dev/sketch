import { test } from "node:test";
import assert from "node:assert/strict";
import { sketch } from "../src/index.js";

test("end-to-end produces an SVG document", () => {
  const svg = sketch(`@layer A\na : A\nb : B\na -> b : edge`);
  assert.match(svg, /^<svg /);
  assert.match(svg, /<\/svg>$/);
  assert.match(svg, /class="plinth-topo"/);
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
