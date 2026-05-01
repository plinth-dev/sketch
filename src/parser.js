// Plinth Sketch · DSL parser
//
// Line-based syntax:
//   # comments
//   @layer Layer name             — sets current layer
//   id : Label / sublabel         — node definition (sublabel optional)
//   a -> b : edge label           — directed edge (label optional)
//   @cite text                    — bottom-right cite text (optional)
//
// The parser is intentionally permissive: unknown lines surface as errors[]
// but don't abort the parse. Whitespace tolerant. CRLF tolerant.

const NODE_RE = /^([\w\-./]+)\s*:\s*(.+?)(?:\s+\/\s+(.+))?$/;
const EDGE_RE = /^([\w\-./]+)\s*->\s*([\w\-./]+)\s*(?::\s*(.+))?$/;

export function parse(text) {
  const lines = String(text).split(/\r?\n/);
  const nodes = {};
  const nodeOrder = [];
  const layers = [];
  const edges = [];
  const errors = [];
  let cite = null;
  let currentLayerName = null;

  function ensureLayer(name) {
    let layer = layers.find((l) => l.name === name);
    if (!layer) {
      layer = { name, ids: [] };
      layers.push(layer);
    }
    return layer;
  }

  function addNode(id, label, sub) {
    if (nodes[id]) return; // first wins
    nodes[id] = { id, label, sub: sub || null, layer: currentLayerName };
    nodeOrder.push(id);
    if (currentLayerName !== null) {
      const layer = ensureLayer(currentLayerName);
      if (!layer.ids.includes(id)) layer.ids.push(id);
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;

    if (line.startsWith("@layer ")) {
      currentLayerName = line.slice("@layer ".length).trim();
      ensureLayer(currentLayerName);
      continue;
    }
    if (line.startsWith("@cite ")) {
      cite = line.slice("@cite ".length).trim();
      continue;
    }

    const e = line.match(EDGE_RE);
    if (e) {
      edges.push({ from: e[1], to: e[2], label: e[3] || null });
      continue;
    }

    const n = line.match(NODE_RE);
    if (n) {
      addNode(n[1], n[2].trim(), n[3] && n[3].trim());
      continue;
    }

    errors.push({ line: i + 1, text: raw });
  }

  return { nodes, nodeOrder, layers, edges, cite, errors };
}
