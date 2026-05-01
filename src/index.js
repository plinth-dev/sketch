// plinth-sketch · public API
//
// One function for the common case (string in, string out) and three for
// callers who want to inspect the parse / layout intermediates.

import { parse } from "./parser.js";
import { layout } from "./layout.js";
import { render } from "./renderer.js";

export { parse, layout, render };

export function sketch(dsl, options = {}) {
  const parsed = parse(dsl);
  const lay = layout(parsed);
  return render(parsed, lay, options);
}
