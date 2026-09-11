#!/usr/bin/env node
// Build step: data/dances/*.yml → src/data/bundle.json (the static read artifact
// the Astro site loads and searches client-side with Fuse.js). Pure build artifact,
// regenerated every deploy, never hand-edited, git-ignored.
//
// Usage: node scripts/build-bundle.mjs   (runs in `npm run build` via data:build)

import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import YAML from "yaml";
import { listPrefix, credsFromEnv } from "./lib/r2-list.mjs";

const DANCES_DIR = "data/dances";
const OUT_DIR = "src/data";
const OUT_FILE = join(OUT_DIR, "bundle.json");
const AUDIO_BASE = process.env.PUBLIC_AUDIO_BASE || "https://pub-58ea1cfbd2a349eaa5724cdf6ad0f1bb.r2.dev";

// Human-readable label from an R2 key's filename: strip dir + ext, underscores→spaces.
function labelFromKey(key) {
  const base = key.split("/").pop().replace(/\.[^.]+$/, "");
  return base.replace(/[_]+/g, " ").trim();
}

async function main() {
  let files;
  try {
    files = (await readdir(DANCES_DIR)).filter((f) => f.endsWith(".yml") && !f.startsWith("_"));
  } catch {
    console.error(`No ${DANCES_DIR}/ — run the importer first.`);
    process.exit(1);
  }

  const dances = [];
  for (const f of files.sort()) {
    dances.push(YAML.parse(await readFile(join(DANCES_DIR, f), "utf8")));
  }

  // Resolve recordings for each dance by listing its audio_prefix in R2.
  // If R2 creds are absent (local dev / tests), skip listing and keep any cached
  // recordings already on the dance (so the site still builds offline).
  const { creds, missing } = credsFromEnv();
  const canList = missing.length === 0;
  if (!canList) {
    console.warn(`R2 creds missing (${missing.join(", ")}) — skipping live audio listing; using cached recordings if present.`);
  }
  let listed = 0;
  for (const d of dances) {
    if (!d.audio_prefix) { d.recordings = d.recordings || []; continue; }
    if (!canList) { d.recordings = d.recordings || []; continue; }
    const objs = await listPrefix(creds, d.audio_prefix);
    const audioObjs = objs
      .filter((o) => /\.(mp3|m4a|wav|flac|aac)$/i.test(o.key))
      .sort((a, b) => a.key.localeCompare(b.key));
    d.recordings = audioObjs.map((o, i) => ({
      file: o.key,
      url: `${AUDIO_BASE}/${o.key}`,
      performer: labelFromKey(o.key),
      is_default: d.default_recording ? o.key === d.default_recording : i === 0,
    }));
    // guarantee exactly one default
    if (d.recordings.length && !d.recordings.some((r) => r.is_default)) d.recordings[0].is_default = true;
    listed += d.recordings.length;
  }
  if (canList) {
    console.log(`Listed ${listed} recordings from R2 across ${dances.filter((d) => d.audio_prefix).length} prefixes.`);
    // Safety guard: if creds are present but listing produced ZERO recordings, the
    // credentials/signing likely failed. Fail loudly rather than deploy an
    // audio-less site (protects the nightly cron from silently wiping audio).
    const prefixCount = dances.filter((d) => d.audio_prefix).length;
    if (prefixCount > 0 && listed === 0) {
      console.error(`ERROR: ${prefixCount} dances have audio_prefix but R2 listing returned 0 recordings — aborting to avoid deploying without audio. Check R2 credentials.`);
      process.exit(1);
    }
  }

  // Derive lightweight facet lists + a coverage summary for the UI.
  const regions = [...new Set(dances.flatMap((d) => d.regions || []))].sort();
  const families = [...new Set(dances.flatMap((d) => d.family_tags || []))].sort();
  const holds = [...new Set(dances.map((d) => d.hold_type).filter(Boolean))].sort();
  const genres = [...new Set(dances.flatMap((d) => d.genre || []))].sort();
  const documented = dances.filter((d) =>
    d.notes?.status === "known" || d.background?.status === "known" || (d.recordings || []).length
  ).length;

  const bundle = {
    generatedAt: new Date().toISOString(),
    total: dances.length,
    documented,
    facets: { regions, families, holds, genres },
    dances,
  };

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(bundle) + "\n", "utf8");
  console.log(`Wrote ${OUT_FILE}: ${dances.length} dances, ${documented} documented, ` +
    `${regions.length} regions, ${families.length} families.`);
}

// Only run when executed directly (not when imported).
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
