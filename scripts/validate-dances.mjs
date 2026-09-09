#!/usr/bin/env node
// Build-time guardrail: validate every data/dances/*.yml against the schema.
// Fails the build (exit 1) on any error, so a typo never reaches the deployed bundle.
// This is the CRITICAL guard the eng review required.
//
// Usage: node scripts/validate-dances.mjs   (run in `npm run build` before bundling)

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import YAML from "yaml";
import { HOLD_TYPES, GENDERS, VIDEO_KINDS, FIELD_STATUSES } from "./lib/parse.mjs";

const DANCES_DIR = "data/dances";

export function validateDance(d, file) {
  const errors = [];
  const err = (m) => errors.push(`${file}: ${m}`);

  if (!d || typeof d !== "object") { err("not an object"); return errors; }
  if (!d.slug || typeof d.slug !== "string") err("missing/invalid slug");
  if (!d.name || !d.name.hy) err("missing name.hy (Armenian name is required)");

  if (d.hold_type != null && !HOLD_TYPES.includes(d.hold_type))
    err(`hold_type "${d.hold_type}" not in [${HOLD_TYPES.join(", ")}]`);
  if (d.gender != null && !GENDERS.includes(d.gender))
    err(`gender "${d.gender}" not in [${GENDERS.join(", ")}]`);

  for (const f of ["difficulty", "energy"]) {
    if (d[f] != null && (!Number.isInteger(d[f]) || d[f] < 0 || d[f] > 5))
      err(`${f} must be an integer 0-5 or null (got ${d[f]})`);
  }

  for (const f of ["notes", "background", "lyrics"]) {
    if (d[f] && d[f].status != null && !FIELD_STATUSES.includes(d[f].status))
      err(`${f}.status "${d[f].status}" not in [${FIELD_STATUSES.join(", ")}]`);
  }

  for (const v of d.videos || []) {
    if (v.kind != null && !VIDEO_KINDS.includes(v.kind))
      err(`video kind "${v.kind}" not in [${VIDEO_KINDS.join(", ")}]`);
  }

  const recs = d.recordings || [];
  const defaults = recs.filter((r) => r.is_default === true).length;
  if (recs.length > 0 && defaults === 0)
    err("has recordings but none marked is_default (exactly one required)");
  if (defaults > 1)
    err(`${defaults} recordings marked is_default (exactly one allowed)`);

  return errors;
}

async function main() {
  let files;
  try {
    files = (await readdir(DANCES_DIR)).filter((f) => f.endsWith(".yml") && !f.startsWith("_"));
  } catch {
    console.error(`No ${DANCES_DIR}/ directory yet — nothing to validate.`);
    process.exit(0);
  }

  const allErrors = [];
  for (const f of files) {
    let doc;
    try {
      doc = YAML.parse(await readFile(join(DANCES_DIR, f), "utf8"));
    } catch (e) {
      allErrors.push(`${f}: YAML parse error — ${e.message}`);
      continue;
    }
    allErrors.push(...validateDance(doc, f));
  }

  if (allErrors.length) {
    console.error(`Validation FAILED — ${allErrors.length} error(s):`);
    for (const e of allErrors) console.error("  ✗ " + e);
    process.exit(1);
  }
  console.log(`Validation passed: ${files.length} dance file(s), no errors.`);
}

// Only run when executed directly (not when imported by tests).
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
