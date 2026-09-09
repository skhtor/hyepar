#!/usr/bin/env node
// Audio ingest: scan the source music library (per-dance folders, Armenian names,
// multiple recordings each) and emit a manifest that maps folders → dances → recordings.
//
// It does NOT copy, move, or upload anything. It reads in place and writes a JSON
// manifest. A later step (R2 upload) consumes the manifest; the per-dance YAML
// references recordings by their R2 key.
//
// Real source structure (confirmed against the Azad Gharibian Dance library):
//   <root>/<Armenian dance name>/<recording>.mp3   (one level deep, no loose files)
//   7 folders are comma-joined multi-dance (e.g. "Շավալի, Խոշ բիլազիկ").
//
// Usage:
//   node scripts/ingest-audio.mjs --root "/path/to/Azgayin Parer" [--out audio-manifest.json]
//
// Then review audio-manifest.json before any upload.

import { readdir, stat, writeFile } from "node:fs/promises";
import { join, basename } from "node:path";
import { slugify } from "./lib/parse.mjs";

const AUDIO_EXT = new Set([".mp3", ".m4a", ".wav", ".flac", ".aac"]);

function parseArgs(argv) {
  const args = { root: null, out: "audio-manifest.json" };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--root") args.root = argv[++i];
    else if (argv[i] === "--out") args.out = argv[++i];
  }
  return args;
}

function ext(name) {
  const i = name.lastIndexOf(".");
  return i < 0 ? "" : name.slice(i).toLowerCase();
}

/**
 * A folder name may encode more than one dance, comma-separated
 * (e.g. "Շավալի, Խոշ բիլազիկ"). Return the list of dance names.
 */
export function splitFolderDances(folderName) {
  return folderName
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Guess a romanized/ensemble hint from a recording filename for the `performer`
 * field. Best-effort only — humans refine later. Returns the filename stem.
 */
export function recordingLabelFromFile(fileName) {
  return basename(fileName, ext(fileName)).replace(/[_]+/g, " ").trim();
}

async function main() {
  const { root, out } = parseArgs(process.argv.slice(2));
  if (!root) {
    console.error("ERROR: --root is required (path to the music library folder).");
    process.exit(1);
  }

  const entries = await readdir(root, { withFileTypes: true });
  const folders = entries.filter((e) => e.isDirectory());

  const manifest = { root, generatedAt: new Date().toISOString(), dances: [] };
  const warnings = [];

  for (const folder of folders.sort((a, b) => a.name.localeCompare(b.name))) {
    const folderPath = join(root, folder.name);
    const files = (await readdir(folderPath)).filter((f) => AUDIO_EXT.has(ext(f)));
    if (files.length === 0) {
      warnings.push(`No audio files in folder: ${folder.name}`);
      continue;
    }

    const danceNames = splitFolderDances(folder.name);
    if (danceNames.length > 1) {
      warnings.push(
        `Multi-dance folder "${folder.name}" → ${danceNames.length} dances; ` +
          `recordings will be attached to the FIRST (${danceNames[0]}). Split manually if needed.`
      );
    }
    const primary = danceNames[0];

    const recordings = [];
    for (const [idx, file] of files.sort().entries()) {
      recordings.push({
        // R2 key: keep it stable and ASCII-safe. Slug of the dance + index + original ext.
        r2Key: `${slugify(romanizeHint(primary) || primary)}/rec-${String(idx + 1).padStart(2, "0")}${ext(file)}`,
        sourceFile: join(folder.name, file),
        performer: recordingLabelFromFile(file),
        tempo_bpm: null,
        is_default: idx === 0, // first alphabetically as provisional default; human confirms
      });
    }

    manifest.dances.push({
      name_hy: primary,
      folder: folder.name,
      alsoContains: danceNames.slice(1), // other dances sharing this folder, if any
      recordingCount: recordings.length,
      recordings,
    });
  }

  await writeFile(out, JSON.stringify(manifest, null, 2) + "\n", "utf8");

  const totalRecordings = manifest.dances.reduce((n, d) => n + d.recordingCount, 0);
  console.log(`Wrote ${out}`);
  console.log(`  dances (folders): ${manifest.dances.length}`);
  console.log(`  recordings total: ${totalRecordings}`);
  if (warnings.length) {
    console.log(`\n  ${warnings.length} warning(s):`);
    for (const w of warnings) console.log(`   - ${w}`);
  }
  console.log(`\nNothing was copied or uploaded. Review ${out}, then run the R2 upload step.`);
}

// Placeholder: real romanization comes from the dance YAML's name.romanized once
// the importer has run. Here we just return null so the slug falls back to the
// Armenian name (the R2 key gets finalized during the upload step against YAML).
function romanizeHint(_armenianName) {
  return null;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
