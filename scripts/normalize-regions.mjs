#!/usr/bin/env node
// Normalize the `region` field across all dance YAML to Armenian, and convert it
// from a single string to a `regions` LIST (so a dance can belong to more than one,
// e.g. "Կարին, Ջավախք" → ["Կարին","Ջավախք"]). Armenian-first, matching the bot's
// authoritative region data.
//
// English values left over from video-title extraction are mapped to Armenian for
// form consistency. As bot enrichment covers more dances, those get overwritten
// with real region data.
//
// Idempotent: safe to re-run. Usage: node scripts/normalize-regions.mjs [--dry-run]

import { readFile, writeFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import YAML from "yaml";

const DANCES_DIR = "data/dances";

// English (from video-title extraction) → Armenian.
const EN_TO_HY = {
  Karin: "Կարին",
  Sasun: "Սասուն",
  Shatakh: "Շատախ",
  Alashkert: "Ալաշկերտ",
  Vaspurakan: "Վասպուրական",
  Mush: "Մուշ",
  Van: "Վան",
};

function toRegionList(region) {
  if (region == null) return null;
  if (Array.isArray(region)) var parts = region;
  else var parts = String(region).split(",");
  const out = [];
  for (let p of parts) {
    p = p.trim();
    if (!p) continue;
    p = EN_TO_HY[p] || p; // map English → Armenian
    if (!out.includes(p)) out.push(p);
  }
  return out.length ? out : null;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const files = (await readdir(DANCES_DIR)).filter((f) => f.endsWith(".yml") && !f.startsWith("_"));
  let changed = 0;

  for (const f of files) {
    const path = join(DANCES_DIR, f);
    const doc = YAML.parse(await readFile(path, "utf8"));
    const before = JSON.stringify({ region: doc.region ?? null, regions: doc.regions ?? null });

    const list = toRegionList(doc.regions ?? doc.region);
    doc.regions = list; // new canonical field (list, Armenian)
    delete doc.region; // retire the old single-string field

    const after = JSON.stringify({ region: null, regions: doc.regions ?? null });
    if (before !== after) {
      changed++;
      if (!dryRun) await writeFile(path, YAML.stringify(doc), "utf8");
    }
  }
  console.log(`${dryRun ? "[DRY RUN] " : ""}region → regions[] (Armenian): ${changed} file(s) changed of ${files.length}.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
