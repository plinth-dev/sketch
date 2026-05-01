#!/usr/bin/env node
// plinth-sketch · render Plinth Sketch DSL files to SVG.
//
// Usage:
//   plinth-sketch input.sketch                   → writes input.svg next to it
//   plinth-sketch input.sketch -o diagram.svg    → writes specific path
//   plinth-sketch input.sketch -                 → writes to stdout
//   echo "..." | plinth-sketch -                 → reads stdin, writes stdout
//   plinth-sketch input.sketch -w                → watch mode, re-render on change
//   plinth-sketch --check input.sketch           → exit 1 if parse/render fails
//   plinth-sketch --version | --help

import { readFileSync, writeFileSync, watch as watchFile } from "node:fs";
import { resolve, dirname, basename, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { parse } from "../src/parser.js";
import { layout } from "../src/layout.js";
import { render } from "../src/renderer.js";

const PKG = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "..", "package.json"),
    "utf8",
  ),
);

const HELP = `plinth-sketch ${PKG.version}
Render Plinth Sketch DSL files to typeset SVG diagrams.

Usage:
  plinth-sketch <input.sketch> [options]
  plinth-sketch -                          # read from stdin
  echo "..." | plinth-sketch -

Options:
  -o, --out <path>     Output file. Defaults to <input>.svg. Use '-' for stdout.
  -w, --watch          Re-render whenever the input file changes.
      --check          Parse + render only; exit 1 on errors. No file written.
      --no-signature   Suppress the "Made with Plinth Sketch" cite.
  -v, --version        Print version.
  -h, --help           Show this message.

Examples:
  plinth-sketch architecture.sketch
  plinth-sketch architecture.sketch -o docs/arch.svg
  cat in.sketch | plinth-sketch - > out.svg
  plinth-sketch arch.sketch -w
`;

function parseArgs(argv) {
  const args = { input: null, out: null, watch: false, check: false, signature: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-h" || a === "--help") { args.help = true; continue; }
    if (a === "-v" || a === "--version") { args.version = true; continue; }
    if (a === "-w" || a === "--watch") { args.watch = true; continue; }
    if (a === "--check") { args.check = true; continue; }
    if (a === "--no-signature") { args.signature = false; continue; }
    if (a === "-o" || a === "--out") { args.out = argv[++i]; continue; }
    if (a.startsWith("-") && a.length > 1 && a !== "-") {
      console.error(`plinth-sketch: unknown option: ${a}`);
      process.exit(2);
    }
    if (args.input === null) { args.input = a; continue; }
    console.error(`plinth-sketch: unexpected extra argument: ${a}`);
    process.exit(2);
  }
  return args;
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

function readSource(input) {
  if (input === "-") return readStdin();
  if (!input) throw new Error("no input file (use - for stdin)");
  return readFileSync(resolve(input), "utf8");
}

function defaultOutPath(inputPath) {
  if (inputPath === "-") return "-";
  const ext = extname(inputPath);
  const base = ext ? inputPath.slice(0, -ext.length) : inputPath;
  return base + ".svg";
}

function emitSvg(dsl, args) {
  const parsed = parse(dsl);
  const lay = layout(parsed);
  const svg = render(parsed, lay, { signature: args.signature });

  // Surface parse warnings on stderr (don't fail unless --check).
  if (parsed.errors.length) {
    for (const err of parsed.errors) {
      console.error(`plinth-sketch: warning: line ${err.line}: cannot parse: ${err.text}`);
    }
  }
  const missing = new Set();
  for (const e of parsed.edges) {
    if (!parsed.nodes[e.from]) missing.add(e.from);
    if (!parsed.nodes[e.to]) missing.add(e.to);
  }
  if (missing.size) {
    console.error(`plinth-sketch: warning: edge references undefined nodes: ${[...missing].join(", ")}`);
  }

  const hasErrors = parsed.errors.length > 0 || missing.size > 0;
  return { svg, hasErrors };
}

function writeOut(svg, outPath) {
  if (outPath === "-") {
    process.stdout.write(svg + "\n");
    return;
  }
  writeFileSync(resolve(outPath), svg);
  console.error(`plinth-sketch: wrote ${outPath}`);
}

async function runOnce(args) {
  const dsl = await readSource(args.input);
  const { svg, hasErrors } = emitSvg(dsl, args);
  if (args.check) {
    if (hasErrors) {
      console.error("plinth-sketch: --check found errors");
      process.exit(1);
    }
    console.error(`plinth-sketch: ok (${svg.length} bytes)`);
    return;
  }
  const outPath = args.out ?? defaultOutPath(args.input);
  writeOut(svg, outPath);
}

async function runWatch(args) {
  if (args.input === "-") {
    console.error("plinth-sketch: --watch requires a file path, not stdin");
    process.exit(2);
  }
  await runOnce(args);
  console.error(`plinth-sketch: watching ${args.input} (Ctrl-C to stop)`);
  let pending = false;
  watchFile(resolve(args.input), { persistent: true }, async () => {
    if (pending) return;
    pending = true;
    setTimeout(async () => {
      pending = false;
      try { await runOnce(args); }
      catch (err) { console.error(`plinth-sketch: ${err.message}`); }
    }, 50);
  });
  await new Promise(() => {}); // keep process alive
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { console.log(HELP); return; }
  if (args.version) { console.log(PKG.version); return; }

  if (args.input === null && process.stdin.isTTY) {
    console.error(HELP);
    process.exit(2);
  }
  if (args.input === null) args.input = "-";

  try {
    if (args.watch) await runWatch(args);
    else await runOnce(args);
  } catch (err) {
    console.error(`plinth-sketch: ${err.message}`);
    process.exit(1);
  }
}

main();
