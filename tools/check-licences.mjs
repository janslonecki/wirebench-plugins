#!/usr/bin/env node
/**
 * Every plugin in this repository declares the repository's licence.
 *
 * wirebench itself deliberately does **not** check this: its manifest
 * validator requires a licence to be *named*, never a particular one, because
 * the app shows the licence and lets the user decide rather than refusing a
 * plugin on licence grounds. That posture is right for the app and wrong for
 * this repo, where the point is that everything we publish here is GPL. So
 * the rule lives here, as policy, and nothing about the app changes.
 *
 * Modelled on wirebench's `.claude/skills/license-audit/license-audit.mjs`,
 * including its most useful habit: a run that scanned nothing FAILS. A green
 * check that examined no plugins proves nothing, and is worse than a red one
 * because it is believed.
 *
 *   node tools/check-licences.mjs
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PLUGINS = join(ROOT, "plugins");

/** The one licence a plugin here may declare. */
const REQUIRED = "GPL-3.0-or-later";

/** Files that must exist for the licence to mean anything. */
const REQUIRED_FILES = ["LICENSE", "EXCEPTION.md"];

/** The §7 permission has to be *in the source*, not only in a repo file —
 *  that is where a licence notice attaches when somebody copies one file. */
const EXCEPTION_MARK = "Additional permission under GNU GPL version 3 section 7";

let failures = 0;
let warnings = 0;
const fail = (m) => {
  console.error(`FAIL  ${m}`);
  failures++;
};
const warn = (m) => {
  console.error(`WARN  ${m}`);
  warnings++;
};
const pass = (m) => console.log(`PASS  ${m}`);

for (const f of REQUIRED_FILES) {
  if (existsSync(join(ROOT, f))) pass(`${f} is present`);
  else fail(`${f} is missing — the licence has nowhere to point`);
}

if (!existsSync(PLUGINS)) {
  fail("no plugins/ directory");
  process.exit(1);
}

const dirs = readdirSync(PLUGINS).filter((n) => {
  if (n.startsWith(".")) return false;
  try {
    return statSync(join(PLUGINS, n)).isDirectory();
  } catch {
    return false;
  }
});

for (const name of dirs) {
  const manifestPath = join(PLUGINS, name, "wirebench-plugin.json");
  if (!existsSync(manifestPath)) {
    fail(`plugins/${name} has no wirebench-plugin.json`);
    continue;
  }

  let m;
  try {
    m = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (e) {
    fail(`plugins/${name}: manifest is not valid JSON (${String(e).slice(0, 80)})`);
    continue;
  }

  if (m.licence !== REQUIRED) {
    fail(`plugins/${name}: declares "${m.licence ?? "nothing"}", must be "${REQUIRED}"`);
  } else {
    pass(`plugins/${name}: ${REQUIRED}`);
  }

  // Ids here are namespaced. Bare ids are reserved for the plugins that ship
  // inside the app, and wirebench's own `plugin-catalog.test.ts` asserts it —
  // a bare id published from here would collide with that reservation.
  if (typeof m.id !== "string" || !m.id.includes(".")) {
    fail(`plugins/${name}: id "${m.id}" must be namespaced (bare ids are the app's)`);
  }

  // Every Python file the plugin ships carries the notice, because a file
  // that travels on its own has to say what it is.
  for (const action of m.actions ?? []) {
    const script = action?.run?.script;
    if (typeof script !== "string") continue;
    const scriptPath = join(PLUGINS, name, script);
    if (!existsSync(scriptPath)) {
      fail(`plugins/${name}: ${script} is named by an action but not present`);
      continue;
    }
    const src = readFileSync(scriptPath, "utf8");
    if (!src.includes(EXCEPTION_MARK)) {
      fail(`plugins/${name}/${script}: no §7 additional-permission notice in the header`);
    }
  }

  if (!existsSync(join(PLUGINS, name, "README.md"))) {
    warn(`plugins/${name}: no README.md — how does somebody know what it is for?`);
  }
}

// A check that examined nothing is not a passing check.
if (dirs.length === 0) {
  fail("plugins/ contains no plugins — a run that scans nothing proves nothing");
}

console.log(
  `\nlicence check: ${dirs.length} plugin(s) — ${failures} failure(s), ${warnings} warning(s)`,
);
process.exit(failures ? 1 : 0);
