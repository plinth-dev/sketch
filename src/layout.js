// Plinth Sketch · auto-layout
//
// Lays nodes left-to-right within each layer, layers stacked top-to-bottom.
// Auto-grows the canvas width when a layer would force nodes below NODE_MIN_W.
// Mutates `parsed.nodes[id]._x/_y/_w/_h` and returns canvas dims + placedLayers.

const PADDING_X = 60;
const PADDING_Y = 40;
const LAYER_PAD_TOP = 44;
const LAYER_PAD_BOTTOM = 16;
const LAYER_GAP = 56;
const LAYER_INTERNAL_PAD_X = 28;
const NODE_H = 64;
const NODE_GAP_X = 32;
const NODE_MIN_W = 140;
const TOTAL_W_DEFAULT = 960;
const TOTAL_W_MAX = 1600;

export function layout(parsed) {
  // First pass: figure out the canvas width we need to honour NODE_MIN_W.
  let canvasW = TOTAL_W_DEFAULT;
  for (const layer of parsed.layers) {
    if (!layer.ids.length) continue;
    const n = layer.ids.length;
    const totalGap = NODE_GAP_X * (n - 1);
    const neededInner = LAYER_INTERNAL_PAD_X * 2 + totalGap + NODE_MIN_W * n;
    const neededTotal = neededInner + PADDING_X * 2;
    if (neededTotal > canvasW) canvasW = Math.min(neededTotal, TOTAL_W_MAX);
  }

  const innerW = canvasW - PADDING_X * 2;
  let y = PADDING_Y;
  const placedLayers = [];

  for (const layer of parsed.layers) {
    if (!layer.ids.length) continue;
    const n = layer.ids.length;
    const totalGap = NODE_GAP_X * (n - 1);
    const nodesAvailableW = innerW - LAYER_INTERNAL_PAD_X * 2;
    let nodeW = Math.floor((nodesAvailableW - totalGap) / n);
    if (nodeW < NODE_MIN_W) nodeW = NODE_MIN_W;

    const layerY = y;
    const layerH = LAYER_PAD_TOP + NODE_H + LAYER_PAD_BOTTOM;

    placedLayers.push({
      name: layer.name,
      x: PADDING_X,
      y: layerY,
      w: innerW,
      h: layerH,
    });

    let nx = PADDING_X + LAYER_INTERNAL_PAD_X;
    const ny = layerY + LAYER_PAD_TOP;
    for (const id of layer.ids) {
      const node = parsed.nodes[id];
      if (!node) continue;
      node._x = nx;
      node._y = ny;
      node._w = nodeW;
      node._h = NODE_H;
      nx += nodeW + NODE_GAP_X;
    }

    y = layerY + layerH + LAYER_GAP;
  }

  const totalH = y - LAYER_GAP + PADDING_Y;
  return {
    width: canvasW,
    height: Math.max(totalH, 200),
    placedLayers,
  };
}
