#!/usr/bin/env node
// Upload owned audio to the R2 bucket, keyed exactly as the dance YAML expects.
// Reads audio-manifest.json: each recording has { r2Key, sourceFile } where
// sourceFile is relative to manifest.root (the local music library). Uploads via
// `wrangler r2 object put`. Idempotent-ish: use --skip-existing to avoid re-uploading.
//
// The r2Key here is the SAME key the importer wrote into data/dances/*.yml (file:),
// so what the site's <audio src> requests is exactly what we upload. Verified.
//
// Usage:
//   node scripts/upload-r2.mjs --bucket hyepar-audio [--limit N] [--dry-run] [--skip-existing]

import { readFile } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

function parseArgs(argv) {
  const a = { bucket: "hyepar-audio", manifest: "audio-manifest.json", limit: Infinity, dryRun: false, skipExisting: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--bucket") a.bucket = argv[++i];
    else if (argv[i] === "--manifest") a.manifest = argv[++i];
    else if (argv[i] === "--limit") a.limit = parseInt(argv[++i], 10);
    else if (argv[i] === "--dry-run") a.dryRun = true;
    else if (argv[i] === "--skip-existing") a.skipExisting = true;
  }
  return a;
}

const CT = { ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".wav": "audio/wav", ".flac": "audio/flac", ".aac": "audio/aac" };
function contentType(key) {
  const i = key.lastIndexOf(".");
  return CT[key.slice(i).toLowerCase()] || "application/octet-stream";
}

function objectExists(bucket, key) {
  try {
    execFileSync("npx", ["wrangler", "r2", "object", "get", `${bucket}/${key}`, "--remote", "--pipe"], {
      stdio: ["ignore", "ignore", "ignore"],
    });
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const { bucket, manifest, limit, dryRun, skipExisting } = parseArgs(process.argv.slice(2));
  const m = JSON.parse(await readFile(manifest, "utf8"));
  const root = m.root;

  const jobs = [];
  for (const d of m.dances) {
    for (const rec of d.recordings) {
      jobs.push({ key: rec.r2Key, src: join(root, rec.sourceFile) });
    }
  }

  let done = 0, skipped = 0, missing = 0, failed = 0;
  const total = Math.min(jobs.length, limit);
  console.log(`Uploading up to ${total} of ${jobs.length} recordings to bucket "${bucket}"${dryRun ? " (DRY RUN)" : ""}...`);

  for (const job of jobs.slice(0, limit)) {
    if (!existsSync(job.src)) {
      console.warn(`  MISSING source: ${job.src}`);
      missing++;
      continue;
    }
    if (skipExisting && !dryRun && objectExists(bucket, job.key)) {
      skipped++;
      continue;
    }
    const sizeMB = (statSync(job.src).size / 1e6).toFixed(1);
    if (dryRun) {
      console.log(`  [dry] ${job.key}  <-  (${sizeMB}MB) ${job.src}`);
      done++;
      continue;
    }
    try {
      execFileSync(
        "npx",
        ["wrangler", "r2", "object", "put", `${bucket}/${job.key}`,
         "--file", job.src, "--content-type", contentType(job.key), "--remote"],
        { stdio: ["ignore", "ignore", "pipe"] }
      );
      done++;
      if (done % 25 === 0) console.log(`  ...${done} uploaded`);
    } catch (e) {
      console.error(`  FAILED ${job.key}: ${e.message?.split("\n")[0]}`);
      failed++;
    }
  }

  console.log(`\nDone. uploaded=${done} skipped=${skipped} missing=${missing} failed=${failed}`);
  if (missing) console.log("  (missing files are usually the comma-folder edge cases — reconcile later)");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
