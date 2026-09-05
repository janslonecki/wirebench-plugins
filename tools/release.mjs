#!/usr/bin/env node
/**
 * Pack every plugin for a release, write `releases.json`, and sign it — the
 * file a wirebench build pins its first-party plugins against, and now also
 * the file a wirebench build will *update itself from*.
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
 *                 the app. Mirrored in wirebench `electron/toolManifests.cjs`
 *                 `contentHash`.
 *
 * ...and one signature over the index as a whole.
 *
 * **The index also carries what a person would read** (2026-08-29): each
 * entry's `name`, `summary`, `kind`, `author` and `homepage`, copied
 * from the manifest. Preferences ▸ Plugins lists and searches what we publish
 * from this file alone — no bundle is downloaded to find out what it is —
 * and because the index is signed, that text is ours. The app bounds every
 * one of these fields (`electron/releaseKey.cjs` validateIndex); `build`
 * refuses the same bounds here so a release never fails at the far end.
 *
 * **Why the index is signed.** A wirebench build carries pointers compiled
 * into it, which cannot be forged. `releases.json` is a SECOND source of
 * pointers, fetched at runtime and cached in the user's profile — where a
 * plugin running on the desktop CPython sidecar could write it. Without a
 * signature, such a plugin could name its own content hash and promote itself
 * to first-party, reserved keys and all. The signature is what lets the app
 * believe a file it did not ship.
 *
 * **The key never comes here.** `keygen` writes the private half outside every
 * repository (`~/.config/wirebench/release.key`, mode 0600) and prints the
 * public half, which is committed — here as `release-key.pub`, and in the app
 * as `electron/releaseKey.cjs`. CI only ever runs `--check`, which *verifies*.
 * A compromise of this repository or of its Actions must not be able to
 * publish something wirebench will install by itself.
 *
 * Packing is done here, in Node, rather than through the SDK's `pack`, so
 * the bytes a release carries come from one packer whatever machine cut the
 * release. The shape is the same document (`{bundle: 1, files: {path:
 * base64}}`); the app's readers do not care about whitespace. No timestamp
 * goes into anything, so the same tree packs to the same bytes.
 *
 *   node tools/release.mjs             # writes dist/*.wbplugin + releases.json
 *   node tools/release.mjs sign        # signs releases.json → releases.json.sig
 *   node tools/release.mjs keygen      # once, ever: makes the maintainer's key
 *   node tools/release.mjs --check     # exit 1 if stale, unsigned or mis-signed
 */
import { createHash, generateKeyPairSync, sign as edSign, verify as edVerify, createPrivateKey, createPublicKey } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";
import { homedir } from "node:os";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PLUGINS = join(ROOT, "plugins");
const DIST = join(ROOT, "dist");
/** Tracked, beside the plugins it describes: the app fetches it from the
 *  release, and CI has to be able to verify the committed copy. */
const INDEX = join(ROOT, "releases.json");
const SIG = `${INDEX}.sig`;
const PUBKEY = join(ROOT, "release-key.pub");
const MANIFEST = "wirebench-plugin.json";
const MAX_FILES = 200;
const MAX_BYTES = 10 * 1024 * 1024;

/** Outside every repository, on purpose. */
const KEY_DIR = join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), "wirebench");
const KEY_FILE = join(KEY_DIR, "release.key");

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

const MAX_NAME = 80;
const MAX_SUMMARY = 300;
const MAX_URL = 200;

/** The badge a row wears — wirebench's own rule (`pluginKind` in
 *  src/app/plugins/manifest.ts): a tool if it declares one, a script if it
 *  has actions, content otherwise. */
function kindOf(manifest) {
  if (Array.isArray(manifest.tools) && manifest.tools.length) return "tool";
  if (manifest.llm) return "script";
  if (Array.isArray(manifest.actions) && manifest.actions.length) return "script";
  return "content";
}

/** What the pane shows for an entry, checked against the app's bounds. */
function displayOf(name, manifest) {
  const fail = (why) => new Error(`plugins/${name}: ${why}`);
  if (typeof manifest.name !== "string" || !manifest.name.trim() || manifest.name.length > MAX_NAME) throw fail(`name must be 1–${MAX_NAME} characters`);
  const summary = manifest.summary;
  if (typeof summary !== "object" || summary === null || typeof summary.en !== "string" || !summary.en.trim()) throw fail("summary.en is required");
  for (const [k, v] of Object.entries(summary)) {
    if (typeof v !== "string" || v.length > MAX_SUMMARY) throw fail(`summary.${k} must be at most ${MAX_SUMMARY} characters`);
  }
  if (manifest.author !== undefined && (typeof manifest.author !== "string" || manifest.author.length > MAX_NAME)) throw fail("author is too long");
  if (manifest.homepage !== undefined && (typeof manifest.homepage !== "string" || !/^https:\/\//.test(manifest.homepage) || manifest.homepage.length > MAX_URL)) throw fail("homepage must be an https URL");
  return { name: manifest.name, summary, kind: kindOf(manifest), author: manifest.author, homepage: manifest.homepage };
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
      // What Preferences ▸ Plugins shows and searches, from the index alone.
      ...displayOf(name, manifest),
      supersedes: manifest.supersedes,
      // Which wirebench this copy is for. The app refuses to stage — or to
      // treat as first-party — an entry it does not satisfy, so a plugin that
      // starts needing a newer app simply stops being offered to older ones
      // instead of breaking on them.
      requires: manifest.requires,
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

/** The index as bytes — what is written, and what is signed. One function, so
 *  the signature can never be over a differently-formatted copy. */
export function indexBytes(releases) {
  return JSON.stringify(releases, null, 2) + "\n";
}

function keygen(force) {
  if (existsSync(KEY_FILE) && !force) {
    console.error(`refusing to overwrite ${KEY_FILE} — pass --force if you really mean to replace the release key`);
    process.exit(1);
  }
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  mkdirSync(KEY_DIR, { recursive: true, mode: 0o700 });
  writeFileSync(KEY_FILE, privateKey.export({ type: "pkcs8", format: "pem" }), { mode: 0o600 });
  chmodSync(KEY_FILE, 0o600);
  const pub = publicKey.export({ type: "spki", format: "pem" });
  writeFileSync(PUBKEY, pub);
  console.log(`private key: ${KEY_FILE}  (mode 0600, outside every repository — back it up somewhere safe)`);
  console.log(`public key:  ${PUBKEY}  (committed)\n`);
  console.log(pub);
  console.log("Paste the public key into wirebench's electron/releaseKey.cjs as PUBLIC_KEY_PEM.");
}

function signIndex(keyPath) {
  const { releases } = build();
  const bytes = Buffer.from(indexBytes(releases), "utf8");
  const pem = readFileSync(keyPath, "utf8");
  const sig = edSign(null, bytes, createPrivateKey(pem)).toString("base64");
  writeFileSync(INDEX, bytes);
  writeFileSync(SIG, sig + "\n");
  console.log(`signed ${relative(ROOT, INDEX)} → ${relative(ROOT, SIG)}`);
}

/** Is the committed index current, present and correctly signed? */
export function checkIndex() {
  const { releases } = build();
  const want = indexBytes(releases);
  let have = "";
  try {
    have = readFileSync(INDEX, "utf8");
  } catch {
    return "releases.json is missing — run: node tools/release.mjs";
  }
  if (have !== want) return "releases.json is out of date — run: node tools/release.mjs";
  let sig;
  try {
    sig = readFileSync(SIG, "utf8").trim();
  } catch {
    return "releases.json.sig is missing — run: node tools/release.mjs sign --key <path>";
  }
  let pub;
  try {
    pub = readFileSync(PUBKEY, "utf8");
  } catch {
    return "release-key.pub is missing — run: node tools/release.mjs keygen";
  }
  const ok = edVerify(null, Buffer.from(have, "utf8"), createPublicKey(pub), Buffer.from(sig, "base64"));
  return ok ? null : "releases.json.sig does not verify — re-sign after editing any plugin";
}

const here = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (here) {
  const argv = process.argv.slice(2);
  const verb = argv.find((a) => !a.startsWith("--"));

  if (verb === "keygen") {
    keygen(argv.includes("--force"));
  } else if (verb === "sign") {
    const at = argv.indexOf("--key");
    const keyPath = at >= 0 ? argv[at + 1] : process.env.WIREBENCH_RELEASE_KEY || KEY_FILE;
    if (!existsSync(keyPath)) {
      console.error(`no release key at ${keyPath} — run: node tools/release.mjs keygen`);
      process.exit(1);
    }
    signIndex(keyPath);
  } else if (argv.includes("--check")) {
    const why = checkIndex();
    if (why) {
      console.error(why);
      process.exit(1);
    }
    console.log("releases.json is current and correctly signed");
  } else {
    const { plugins, releases } = build();
    mkdirSync(DIST, { recursive: true });
    for (const p of plugins) writeFileSync(join(DIST, p.file), p.text);
    writeFileSync(INDEX, indexBytes(releases));
    for (const p of releases.plugins) console.log(`${p.file}  sha256 ${p.sha256.slice(0, 12)}…  content ${p.contentHash.slice(0, 12)}…`);
    console.log(`wrote ${plugins.length} plugin(s) to dist/ and releases.json`);
    console.log("now sign it:  node tools/release.mjs sign");
  }
}
