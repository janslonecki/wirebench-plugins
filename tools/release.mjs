#!/usr/bin/env node
/**
 * Pack every plugin for a release and write `dist/releases.json` — the file
 * a wirebench build pins its first-party plugins against.
 *
 * Two hashes per plugin, and they answer different questions:
 *
 *   sha256      — of the `.wbplugin` file, so the download can be verified
 *                 before it is parsed (wirebench's managed-download rule).
 *   contentHash — of the plugin's *files*, in a canonical form wirebench can
 *                 recompute from an installed record: SHA-256 over every
 *                 path in sorted order, each as `utf8(path) 0x00
 *                 utf8(contents) 0x01`. This is what makes an installed copy
 *                 first-party: wirebench compares it with the hash its
 *                 catalog pins, and only a match keeps the reserved keys
 *                 (`supersedes`, `post`, `pref`, …) that name code paths in
 *                 the app. Mirrored in wirebench `electron/plugins.cjs`
 *                 `contentHash`.
 *
 * Packing is done here, in Node, rather than through the SDK's `pack`, so
 * the bytes a release carries come from one packer whatever machine cut the
 * release. The shape is the same document (`{bundle: 1, files: {path:
 * base64}}`); the app's readers do not care about whitespace. No timestamp
 * goes into anything, so the same tree packs to the same bytes.
 *
 *   node tools/release.mjs            # writes dist/*.wbplugin + dist/releases.json
 *   node tools/release.mjs --check    # exit 1 if dist/releases.json is out of date
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PLUGINS = join(ROOT, "plugins");
const DIST = join(ROOT, "dist");
const MANIFEST = "wirebench-plugin.json";
const MAX_FILES = 200;
const MAX_BYTES = 10 * 1024 * 1024;

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

/** Every file of a plugin folder, as `{ rel: text }`, sorted, dotfiles and
 *  caches skipped — the SDK's `pack` rule. */
function filesOf(dir) {
  const out = {};
  const walk = (d) => {
    for (const name of readdirSync(d).sort()) {
      const p = join(d, name);
      const rel = relative(dir, p).split("\\").join("/");
      if (name.startsWith(".") || rel.includes("__pycache__/")) continue;
      if (statSync(p).isDirectory()) walk(p);
      else out[rel] = readFileSync(p, "utf8");
    }
  };
  walk(dir);
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

/** The canonical content hash — see the header, and wirebench's copy. */
export function contentHash(files) {
  const h = createHash("sha256");
  for (const p of Object.keys(files).sort()) {
    h.update(Buffer.from(p, "utf8"));
    h.update(Buffer.from([0]));
    h.update(Buffer.from(files[p], "utf8"));
    h.update(Buffer.from([1]));
  }
  return h.digest("hex");
}

function pack(files) {
  const encoded = {};
  for (const [p, text] of Object.entries(files)) encoded[p] = Buffer.from(text, "utf8").toString("base64");
  return JSON.stringify({ bundle: 1, files: encoded }) + "\n";
}

export function build() {
  const plugins = [];
  const dirs = readdirSync(PLUGINS).filter((n) => !n.startsWith(".") && statSync(join(PLUGINS, n)).isDirectory());
  for (const name of dirs) {
    const dir = join(PLUGINS, name);
    if (!existsSync(join(dir, MANIFEST))) throw new Error(`plugins/${name} has no ${MANIFEST}`);
    const manifest = JSON.parse(readFileSync(join(dir, MANIFEST), "utf8"));
    if (typeof manifest.id !== "string" || typeof manifest.version !== "string") throw new Error(`plugins/${name}: id and version are required`);
    const files = filesOf(dir);
    if (Object.keys(files).length > MAX_FILES) throw new Error(`plugins/${name}: more than ${MAX_FILES} files`);
    const total = Object.values(files).reduce((n, t) => n + Buffer.byteLength(t), 0);
    if (total > MAX_BYTES) throw new Error(`plugins/${name}: over the 10 MB limit`);
    const text = pack(files);
    const file = `${manifest.id}-${manifest.version}.wbplugin`;
    plugins.push({
      id: manifest.id,
      version: manifest.version,
      licence: manifest.licence,
      supersedes: manifest.supersedes,
      file,
      bytes: Buffer.byteLength(text),
      sha256: sha256(Buffer.from(text, "utf8")),
      contentHash: contentHash(files),
      text,
    });
  }
  plugins.sort((a, b) => (a.id < b.id ? -1 : 1));
  const releases = { releases: 1, plugins: plugins.map(({ text: _t, ...p }) => p) };
  return { plugins, releases };
}

const here = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (here) {
  const { plugins, releases } = build();
  const json = JSON.stringify(releases, null, 2) + "\n";
  if (process.argv.includes("--check")) {
    let have = "";
    try {
      have = readFileSync(join(DIST, "releases.json"), "utf8");
    } catch {
      /* absent counts as out of date */
    }
    if (have !== json) {
      console.error("dist/releases.json is out of date — run: node tools/release.mjs");
      process.exit(1);
    }
    console.log("dist/releases.json is current");
  } else {
    mkdirSync(DIST, { recursive: true });
    for (const p of plugins) writeFileSync(join(DIST, p.file), p.text);
    writeFileSync(join(DIST, "releases.json"), json);
    for (const p of releases.plugins) console.log(`${p.file}  sha256 ${p.sha256.slice(0, 12)}…  content ${p.contentHash.slice(0, 12)}…`);
    console.log(`wrote ${plugins.length} plugin(s) + releases.json to dist/`);
  }
}
