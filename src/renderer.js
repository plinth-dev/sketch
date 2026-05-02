// Plinth Sketch · SVG renderer
//
// Pure function: parsed-and-laid-out structure → SVG string.
// Output is self-contained (inline styles + CSS so the SVG renders anywhere)
// and matches the design language of plinth.run / wide-platform-v2.

const PALETTE = {
  bg:        "#FBFBF9",
  bgSoft:    "#F4F3EE",
  ink:       "#0F1012",
  inkMute:   "#5C5C60",
  inkSoft:   "#8C8C90",
  accent:    "#1B3A5C",
  accentMute:"#3F6390",
  rule:      "#E5E3DD",
  ruleFirm:  "#C8C4BB",
};

const FONT_SANS = "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif";
const FONT_MONO = "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace";

function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Deterministic short hash of a string. Used for per-render marker / class
// suffixes so the same DSL renders byte-stable across runs while two SVGs
// embedded on one page don't collide on `<marker id>` or scoped CSS.
function shortHash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36).slice(0, 8);
}

export function render(parsed, lay, options = {}) {
  const { signature = true } = options;
  const { width: W, height: H } = lay;

  // Per-render namespace for SVG ids/classes — lets multiple Plinth Sketch
  // SVGs coexist on the same HTML page without `<marker id>` collisions
  // or CSS class bleed.
  const ns = "ps-" + shortHash(JSON.stringify({
    nodes: parsed.nodeOrder,
    edges: parsed.edges,
    layers: parsed.layers.map((l) => l.name),
    cite: parsed.cite,
  }));
  const arr = `${ns}-arr`;
  const arrMute = `${ns}-arr-mute`;
  const klass = ns;

  const styles = `
.${klass} { font-family: ${FONT_SANS}; }
.${klass} .layer-rect { fill: ${PALETTE.bgSoft}; stroke: ${PALETTE.ruleFirm}; stroke-width: 1; stroke-dasharray: 4 3; }
.${klass} .comp-rect { fill: ${PALETTE.bg}; stroke: ${PALETTE.accent}; stroke-width: 1; }
.${klass} .conn { stroke: ${PALETTE.accent}; stroke-width: 1; fill: none; }
.${klass} .conn-mute { stroke: ${PALETTE.accentMute}; stroke-width: 1; fill: none; }
.${klass} text { fill: ${PALETTE.ink}; }
.${klass} .lbl { font-family: ${FONT_SANS}; font-weight: 500; font-size: 14px; fill: ${PALETTE.ink}; }
.${klass} .lbl-sub { font-family: ${FONT_MONO}; font-size: 11px; fill: ${PALETTE.inkMute}; letter-spacing: 0.02em; }
.${klass} .layer-label { font-family: ${FONT_SANS}; font-size: 12px; font-weight: 600; fill: ${PALETTE.inkMute}; letter-spacing: 0.04em; }
.${klass} .conn-label { font-family: ${FONT_MONO}; font-size: 10.5px; fill: ${PALETTE.inkSoft}; letter-spacing: 0.04em; }
.${klass} .made-with { font-family: ${FONT_SANS}; font-size: 11px; fill: ${PALETTE.inkSoft}; }
`;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" class="${klass}" role="img" aria-label="Plinth Sketch architecture diagram">`;
  svg += `<style>${styles.replace(/\s+/g, " ").trim()}</style>`;
  svg += `<defs>`;
  svg += `<marker id="${arr}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="${PALETTE.accent}"/></marker>`;
  svg += `<marker id="${arrMute}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="${PALETTE.accentMute}"/></marker>`;
  svg += `</defs>`;

  // Background
  svg += `<rect width="${W}" height="${H}" fill="${PALETTE.bg}"/>`;

  // Layer containers
  for (const L of lay.placedLayers) {
    svg += `<rect x="${L.x}" y="${L.y}" width="${L.w}" height="${L.h}" class="layer-rect"/>`;
    svg += `<text x="${L.x + 16}" y="${L.y + 22}" class="layer-label">${escapeXml(L.name)}</text>`;
  }

  // Nodes
  for (const id of parsed.nodeOrder) {
    const n = parsed.nodes[id];
    if (n._x === undefined) continue;
    svg += `<rect x="${n._x}" y="${n._y}" width="${n._w}" height="${n._h}" class="comp-rect"/>`;
    if (n.sub) {
      svg += `<text x="${n._x + 16}" y="${n._y + 26}" class="lbl">${escapeXml(n.label)}</text>`;
      svg += `<text x="${n._x + 16}" y="${n._y + 48}" class="lbl-sub">${escapeXml(n.sub)}</text>`;
    } else {
      svg += `<text x="${n._x + 16}" y="${n._y + 38}" class="lbl">${escapeXml(n.label)}</text>`;
    }
  }

  // For multi-edge / cyclic-edge offset: count occurrences of each
  // unordered node-pair encountered so far and bump per-edge offset
  // perpendicular to the natural path direction.
  const pairSeen = new Map();
  function pairOffset(a, b) {
    const key = [a, b].sort().join("\x00");
    const n = (pairSeen.get(key) || 0) + 1;
    pairSeen.set(key, n);
    return n - 1; // 0 for the first edge in the pair, 1 for the second, etc.
  }

  // Edges — orthogonal L-paths. Self-loops are skipped (surfaced as warnings
  // in parser). Same-row edges that would skip over an intervening node
  // route up-and-over.
  for (const e of parsed.edges) {
    if (e.from === e.to) continue;
    const from = parsed.nodes[e.from];
    const to = parsed.nodes[e.to];
    if (!from || !to || from._x === undefined || to._x === undefined) continue;

    const fromCx = from._x + from._w / 2;
    const fromCy = from._y + from._h / 2;
    const toCx = to._x + to._w / 2;
    const toCy = to._y + to._h / 2;

    const fromBottom = from._y + from._h;
    const toTop = to._y;
    const fromRight = from._x + from._w;
    const toLeft = to._x;

    const sameRow = Math.abs(fromCy - toCy) < 4;

    // Detect intervening same-row node between from and to (sorted by x).
    let hasIntervening = false;
    if (sameRow && from.layer && from.layer === to.layer) {
      const lo = Math.min(fromCx, toCx);
      const hi = Math.max(fromCx, toCx);
      for (const id of parsed.nodeOrder) {
        if (id === e.from || id === e.to) continue;
        const m = parsed.nodes[id];
        if (m._x === undefined) continue;
        const mCx = m._x + m._w / 2;
        const mCy = m._y + m._h / 2;
        if (Math.abs(mCy - fromCy) < 4 && mCx > lo && mCx < hi) {
          hasIntervening = true;
          break;
        }
      }
    }

    // Per-pair offset for multi/cyclic edges. We perpendicular-shift the
    // path's mid-section to keep duplicates and reverse-direction edges
    // visually distinct.
    const offIdx = pairOffset(e.from, e.to);
    const offStep = 14;
    const offDir = e.from < e.to ? 1 : -1; // stable direction so a→b and b→a stack on opposite sides
    const off = offIdx * offStep * offDir;

    let path;
    let labelX, labelY;
    let cls = "conn";
    let labelInClearSpace = false;

    if (sameRow && hasIntervening) {
      // Up-and-over: route above the row, clear of intervening nodes.
      const clearY = from._y - 28 - Math.abs(off);
      const lx = fromCx < toCx ? fromRight : from._x;
      const rx = fromCx < toCx ? toLeft : toLeft + to._w;
      path = `M ${lx} ${fromCy} L ${lx} ${clearY} L ${rx} ${clearY} L ${rx} ${toCy}`;
      labelX = (lx + rx) / 2;
      labelY = clearY - 6;
      cls = "conn-mute";
      labelInClearSpace = true;
    } else if (sameRow && fromCx < toCx) {
      // Horizontal, same row, left → right (no intervening node).
      // Float the label ABOVE the boxes — the gap between boxes is often
      // narrower than the label, so a pill in the gap would clip adjacent
      // box text. `off` lifts duplicates further above.
      path = `M ${fromRight} ${fromCy} L ${toLeft} ${toCy}`;
      labelX = (fromRight + toLeft) / 2;
      labelY = from._y - 6 - Math.abs(off);
      cls = "conn-mute";
      labelInClearSpace = true;
    } else if (sameRow && fromCx > toCx) {
      path = `M ${from._x} ${fromCy} L ${toLeft + to._w} ${toCy}`;
      labelX = (from._x + toLeft + to._w) / 2;
      labelY = from._y - 6 - Math.abs(off);
      cls = "conn-mute";
      labelInClearSpace = true;
    } else if (fromBottom < toTop) {
      const midY = (fromBottom + toTop) / 2 + off;
      if (Math.abs(fromCx - toCx) < 4) {
        path = `M ${fromCx} ${fromBottom} L ${fromCx} ${toTop}`;
        labelX = fromCx + 6;
        labelY = (fromBottom + toTop) / 2;
      } else {
        path = `M ${fromCx} ${fromBottom} L ${fromCx} ${midY} L ${toCx} ${midY} L ${toCx} ${toTop}`;
        labelX = (fromCx + toCx) / 2;
        labelY = midY - 4;
      }
    } else if (toTop < fromBottom && from._y > to._y) {
      const midY = (from._y + (to._y + to._h)) / 2 + off;
      path = `M ${fromCx} ${from._y} L ${fromCx} ${midY} L ${toCx} ${midY} L ${toCx} ${to._y + to._h}`;
      labelX = (fromCx + toCx) / 2;
      labelY = midY - 4;
    } else {
      path = `M ${fromCx} ${fromCy} L ${toCx} ${toCy}`;
      labelX = (fromCx + toCx) / 2;
      labelY = (fromCy + toCy) / 2;
    }

    const markerRef = cls === "conn" ? arr : arrMute;
    svg += `<path d="${path}" class="${cls}" marker-end="url(#${markerRef})" fill="none"/>`;

    if (e.label) {
      const labelW = e.label.length * 6.4 + 8;
      if (!labelInClearSpace) {
        svg += `<rect x="${labelX - labelW / 2}" y="${labelY - 10}" width="${labelW}" height="14" fill="${PALETTE.bg}" stroke="none"/>`;
      }
      svg += `<text x="${labelX}" y="${labelY}" class="conn-label" text-anchor="middle">${escapeXml(e.label)}</text>`;
    }
  }

  // Cite (bottom-right) — suppress when there are no nodes drawn, otherwise
  // the SVG looks like an empty signed canvas.
  const hasContent = parsed.nodeOrder.some((id) => parsed.nodes[id]._x !== undefined);
  if (hasContent) {
    if (parsed.cite) {
      svg += `<text x="${W - 16}" y="${H - 16}" text-anchor="end" class="made-with">${escapeXml(parsed.cite)}</text>`;
    } else if (signature) {
      svg += `<text x="${W - 16}" y="${H - 16}" text-anchor="end" class="made-with">Made with Plinth Sketch</text>`;
    }
  }

  svg += "</svg>";
  return svg;
}
