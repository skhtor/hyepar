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
  const globalKeys = new Map(); // de-dupe R2 keys across ALL dances/folders

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
      const danceSlug = slugify(primary);
      // Key derived from the REAL filename (transliterated + slugified), so the
      // public URL is readable AND ASCII-safe: e.g.
      //   qochari-sgherdi/shavali-khosh-bilazig-oazis-ansambl.mp3
      let base = slugify(basename(file, ext(file)));
      if (!base) base = `rec-${idx + 1}`; // fallback if a name slugifies to empty
      // Global de-dupe that is itself collision-proof: a synthetic "-2" suffix
      // could clash with a real filename that already ends in "-2", so probe
      // until the candidate key is genuinely unused, then reserve it.
      let key = `${danceSlug}/${base}${ext(file)}`;
      if (globalKeys.has(key)) {
        let n = 2;
        let candidate;
        do {
          candidate = `${danceSlug}/${base}-${n}${ext(file)}`;
          n++;
        } while (globalKeys.has(candidate));
        key = candidate;
      }
      globalKeys.set(key, true);

      recordings.push({
        r2Key: key,
        sourceFile: join(folder.name, file),
        performer: recordingLabelFromFile(file), // verbatim original name for display
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

// Only run when executed directly (not when imported by tests).
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
