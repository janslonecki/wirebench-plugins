#!/usr/bin/env node
/**
 * The release notes for a tag, on stdout — one row per plugin, naming the two
 * hashes a wirebench build acts on.
 *
 *   node tools/release-notes.mjs > notes.md
 *
 * A FILE rather than a `node -e` inside the workflow, and that is the whole
 * point of it: the inline version was wrapped in single quotes by the shell,
 * so the first apostrophe in the prose ("the file's") ended the string, the
 * rest of the script was parsed as shell commands, and the step died with
 * `releases.json: command not found` and an exit code the log alone could
 * explain. Prose belongs where prose can contain punctuation.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

export function releaseNotes(index) {
  const rows = index.plugins.map(
    (p) => `- **${p.id}** ${p.version} — sha256 \`${p.sha256}\` · content \`${p.contentHash}\``,
  );
  return [
    "Packed by `tools/release.mjs`. A wirebench build pins a plugin by its **content hash**; the sha256 is the file's, checked before the file is parsed.",
    "",
    "`releases.json` is signed with the maintainer's release key. A wirebench build verifies it before treating any entry as first-party, and Preferences ▸ Plugins lists what it names under *Available from wirebench*.",
    "",
    ...rows,
    "",
  ].join("\n");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const index = JSON.parse(readFileSync(join(ROOT, "releases.json"), "utf8"));
  process.stdout.write(releaseNotes(index));
}
