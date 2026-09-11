#!/usr/bin/env node
// One-time migration: recordings[] → audio_prefix.
// Derives each dance's R2 prefix from its existing recording keys (they share a
// "<prefix>/..." folder). Sets audio_prefix, preserves a non-first default via
// default_recording (the R2 key), and removes the per-file recordings[] array.
// Dances with no recordings get no audio_prefix (nothing to list).
//
// Usage: node scripts/migrate-to-prefix.mjs [--dry-run]

import { readFile, writeFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import YAML from "yaml";

const DANCES_DIR = "data/dances";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const files = (await readdir(DANCES_DIR)).filter((f) => f.endsWith(".yml") && !f.startsWith("_"));
  let withAudio = 0, noAudio = 0, multiPrefix = 0;

  for (const f of files) {
    const p = join(DANCES_DIR, f);
    const d = YAML.parse(await readFile(p, "utf8"));
    const recs = d.recordings || [];

    if (recs.length === 0) {
      delete d.recordings;
      // no audio_prefix — nothing under a folder for this dance
      noAudio++;
    } else {
      const prefixes = [...new Set(recs.map((r) => r.file.split("/")[0]))];
      if (prefixes.length > 1) {
        // rare: recordings span >1 folder. Keep the first as prefix, warn.
        multiPrefix++;
        console.warn(`  ${f}: recordings span ${prefixes.length} prefixes ${JSON.stringify(prefixes)} — using "${prefixes[0]}/"`);
      }
      d.audio_prefix = prefixes[0] + "/";
      // preserve a non-first default if one was explicitly set and isn't the first file
      const def = recs.find((r) => r.is_default);
      if (def && def.file !== recs[0].file) d.default_recording = def.file;
      delete d.recordings;
      withAudio++;
    }

    if (!dryRun) await writeFile(p, YAML.stringify(d), "utf8");
  }

  console.log(`${dryRun ? "[DRY RUN] " : ""}migrated: ${withAudio} with audio_prefix, ${noAudio} without, ${multiPrefix} multi-prefix warnings`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
