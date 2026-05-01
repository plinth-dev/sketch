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
const FONT_MONO = "'JetBrains Mono', 'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, monospace";

function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function render(parsed, lay, options = {}) {
  const { embedFonts = true, signature = true } = options;
  const { width: W, height: H } = lay;

  const styles = `
.plinth-topo { font-family: ${FONT_SANS}; }
.plinth-topo .layer-rect { fill: ${PALETTE.bgSoft}; stroke: ${PALETTE.ruleFirm}; stroke-width: 1; stroke-dasharray: 4 3; }
.plinth-topo .comp-rect { fill: ${PALETTE.bg}; stroke: ${PALETTE.accent}; stroke-width: 1; }
.plinth-topo .conn { stroke: ${PALETTE.accent}; stroke-width: 1; fill: none; }
.plinth-topo .conn-mute { stroke: ${PALETTE.accentMute}; stroke-width: 1; fill: none; }
.plinth-topo text { fill: ${PALETTE.ink}; }
.plinth-topo .lbl { font-family: ${FONT_SANS}; font-weight: 500; font-size: 14px; fill: ${PALETTE.ink}; }
.plinth-topo .lbl-sub { font-family: ${FONT_MONO}; font-size: 11px; fill: ${PALETTE.inkMute}; letter-spacing: 0.02em; }
.plinth-topo .layer-label { font-family: ${FONT_SANS}; font-size: 12px; font-weight: 600; fill: ${PALETTE.inkMute}; letter-spacing: 0.04em; }
.plinth-topo .conn-label { font-family: ${FONT_MONO}; font-size: 10.5px; fill: ${PALETTE.inkSoft}; letter-spacing: 0.04em; }
.plinth-topo .made-with { font-family: ${FONT_SANS}; font-size: 11px; fill: ${PALETTE.inkSoft}; }
`;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" class="plinth-topo" role="img" aria-label="Plinth Sketch architecture diagram">`;
  svg += `<style>${styles.replace(/\s+/g, " ").trim()}</style>`;
  svg += `<defs>`;
  svg += `<marker id="plinth-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="${PALETTE.accent}"/></marker>`;
  svg += `<marker id="plinth-arr-mute" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="${PALETTE.accentMute}"/></marker>`;
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

  // Edges — orthogonal L-paths
  for (const e of parsed.edges) {
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

    let path;
    let labelX, labelY;
    let cls = "conn";
    // True if the label sits in clear space (above/below boxes) and doesn't
    // need a background pill to clear overlapping text.
    let labelInClearSpace = false;

    if (Math.abs(fromCy - toCy) < 4 && fromCx < toCx) {
      // Horizontal, same row, left → right.
      // Float the label ABOVE the boxes — the gap between boxes is often
      // narrower than the label, so a pill in the gap would clip adjacent
      // box text.
      path = `M ${fromRight} ${fromCy} L ${toLeft} ${toCy}`;
      labelX = (fromRight + toLeft) / 2;
      labelY = from._y - 6;
      cls = "conn-mute";
      labelInClearSpace = true;
    } else if (Math.abs(fromCy - toCy) < 4 && fromCx > toCx) {
      path = `M ${from._x} ${fromCy} L ${toLeft + to._w} ${toCy}`;
      labelX = (from._x + toLeft + to._w) / 2;
      labelY = from._y - 6;
      cls = "conn-mute";
      labelInClearSpace = true;
    } else if (fromBottom < toTop) {
      const midY = (fromBottom + toTop) / 2;
      if (Math.abs(fromCx - toCx) < 4) {
        path = `M ${fromCx} ${fromBottom} L ${fromCx} ${toTop}`;
        labelX = fromCx + 6;
        labelY = midY;
      } else {
        path = `M ${fromCx} ${fromBottom} L ${fromCx} ${midY} L ${toCx} ${midY} L ${toCx} ${toTop}`;
        labelX = (fromCx + toCx) / 2;
        labelY = midY - 4;
      }
    } else if (toTop < fromBottom && from._y > to._y) {
      const midY = (from._y + (to._y + to._h)) / 2;
      path = `M ${fromCx} ${from._y} L ${fromCx} ${midY} L ${toCx} ${midY} L ${toCx} ${to._y + to._h}`;
      labelX = (fromCx + toCx) / 2;
      labelY = midY - 4;
    } else {
      path = `M ${fromCx} ${fromCy} L ${toCx} ${toCy}`;
      labelX = (fromCx + toCx) / 2;
      labelY = (fromCy + toCy) / 2;
    }

    const markerId = cls === "conn" ? "plinth-arr" : "plinth-arr-mute";
    svg += `<path d="${path}" class="${cls}" marker-end="url(#${markerId})" fill="none"/>`;

    if (e.label) {
      const labelW = e.label.length * 6.4 + 8;
      if (!labelInClearSpace) {
        svg += `<rect x="${labelX - labelW / 2}" y="${labelY - 10}" width="${labelW}" height="14" fill="${PALETTE.bg}" stroke="none"/>`;
      }
      svg += `<text x="${labelX}" y="${labelY}" class="conn-label" text-anchor="middle">${escapeXml(e.label)}</text>`;
    }
  }

  // Cite (bottom-right)
  if (parsed.cite) {
    svg += `<text x="${W - 16}" y="${H - 16}" text-anchor="end" class="made-with">${escapeXml(parsed.cite)}</text>`;
  } else if (signature) {
    svg += `<text x="${W - 16}" y="${H - 16}" text-anchor="end" class="made-with">Made with Plinth Sketch</text>`;
  }

  svg += "</svg>";
  return svg;
}
