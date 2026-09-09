#!/usr/bin/env node
// Importer: Google Sheet (exported CSV) → per-dance YAML files (the source of truth).
//
// One-time seed. After this runs, the YAML in data/dances/ is authoritative and the
// sheet is not read again. Re-running is safe: existing YAML is NOT overwritten unless
// --force is passed, so hand edits and contributions are preserved.
//
// Input: a CSV export of the sheet (File → Download → CSV in Google Sheets), because
// this repo has no Google API credentials and the source of truth is meant to be the
// repo, not a live API. Columns (from the design doc), 0-indexed after the header rows:
//   A ՊԱՐԵՐ (name)  B Գիտեմ  C Գիտեն  D Դժվարություն(difficulty ★)
//   E Էներգիա(energy ★)  F Տեսանյութ(video)  G Ձեռնարկ(tutorial video)
//   H Երաժշտություն(music)  I Ձեռքեր(hold)  J Notes  K Background  L Lyrics
//
// Optionally merges the audio manifest (from ingest-audio.mjs) so recordings attach
// to the right dance by matching the Armenian folder name to the sheet name.
//
// Usage:
//   node scripts/import-sheet.mjs --csv parer.csv [--manifest audio-manifest.json] [--force]

import { readFile, writeFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import YAML from "yaml";
import {
  parseStarRating,
  splitVideoColumns,
  extractRegion,
  slugify,
  HOLD_TYPES,
} from "./lib/parse.mjs";

const DANCES_DIR = "data/dances";

function parseArgs(argv) {
  const a = { csv: null, manifest: null, force: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--csv") a.csv = argv[++i];
    else if (argv[i] === "--manifest") a.manifest = argv[++i];
    else if (argv[i] === "--force") a.force = true;
  }
  return a;
}

// Minimal, correct CSV parser (handles quoted fields, embedded commas/newlines).
export function parseCsv(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c === "\r") { /* skip */ }
    else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/** Map an Armenian hold-type label from the sheet to our controlled vocab. */
export function normalizeHold(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  const map = {
    "Ուսերով": "shoulders",
    "Ափերով": "palms",
    "Ճկույթներ": "pinkies",
    "Ճկույթներով": "pinkies",
    "Holding sticks": "sticks",
    "Փայտերով": "sticks",
    "Գոտիով": "belt",
  };
  if (map[s]) return map[s];
  // Fall back to a direct match if the sheet already uses an English term.
  const lower = s.toLowerCase();
  return HOLD_TYPES.includes(lower) ? lower : null;
}

function textField(raw) {
  const s = (raw ?? "").trim();
  if (s === "") return { hy: null, en: null, status: "unknown" };
  return { hy: s, en: null, status: "known" };
}

async function main() {
  const { csv, manifest, force } = parseArgs(process.argv.slice(2));
  if (!csv) {
    console.error("ERROR: --csv <export.csv> is required.");
    console.error("Export the sheet: Google Sheets → File → Download → Comma-separated values.");
    process.exit(1);
  }

  const rows = parseCsv(await readFile(csv, "utf8"));

  // Load audio manifest (optional) and index recordings by Armenian dance name.
  let recordingsByName = new Map();
  if (manifest && existsSync(manifest)) {
    const m = JSON.parse(await readFile(manifest, "utf8"));
    for (const d of m.dances) {
      recordingsByName.set(d.name_hy.trim(), d.recordings);
      for (const also of d.alsoContains || []) {
        // multi-dance folders: also index the secondary names so they can claim
        // the same recordings (human refines later).
        if (!recordingsByName.has(also.trim())) recordingsByName.set(also.trim(), d.recordings);
      }
    }
  }

  // Find the header row (the one containing "ՊԱՐԵՐ").
  const headerIdx = rows.findIndex((r) => r.some((c) => (c || "").includes("ՊԱՐԵՐ")));
  const dataRows = headerIdx >= 0 ? rows.slice(headerIdx + 1) : rows;

  let written = 0, skipped = 0, matchedAudio = 0;
  const unmatchedAudio = new Set(recordingsByName.keys());

  for (const r of dataRows) {
    const name_hy = (r[0] || "").trim();
    if (!name_hy) continue; // skip blank / summary rows

    const videos = splitVideoColumns(r[5], r[6]);
    const region = videos.map((v) => extractRegion(v.title)).find(Boolean) || null;
    const recordings = recordingsByName.get(name_hy) || [];
    if (recordings.length) { matchedAudio++; unmatchedAudio.delete(name_hy); }

    const slug = slugify(name_hy) || `dance-${written + skipped + 1}`;
    const filePath = join(DANCES_DIR, `${slug}.yml`);

    if (existsSync(filePath) && !force) { skipped++; continue; }

    const dance = {
      slug,
      name: { hy: name_hy, en: null, romanized: null, aliases: [] },
      region,
      hold_type: normalizeHold(r[8]),
      difficulty: parseStarRating(r[3]),
      energy: parseStarRating(r[4]),
      gender: null,
      family_tags: [],
      notes: textField(r[9]),
      background: textField(r[10]),
      lyrics: textField(r[11]),
      videos,
      recordings: recordings.map((rec, i) => ({
        file: rec.r2Key,
        performer: rec.performer,
        tempo_bpm: rec.tempo_bpm ?? null,
        is_default: rec.is_default ?? i === 0,
      })),
    };

    await writeFile(filePath, YAML.stringify(dance), "utf8");
    written++;
  }

  console.log(`Import complete.`);
  console.log(`  YAML written:   ${written}`);
  console.log(`  skipped (exist):${skipped}  ${force ? "" : "(use --force to overwrite)"}`);
  console.log(`  dances w/ audio:${matchedAudio}`);
  if (recordingsByName.size) {
    console.log(`  audio folders NOT matched to a sheet row: ${unmatchedAudio.size}`);
    for (const n of [...unmatchedAudio].slice(0, 15)) console.log(`     - ${n}`);
    if (unmatchedAudio.size > 15) console.log(`     ... and ${unmatchedAudio.size - 15} more`);
    console.log(`  (these are the comma-folder / naming mismatches to reconcile by hand)`);
  }
}

// Only run when executed directly (not when imported by tests).
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
