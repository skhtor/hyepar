#!/usr/bin/env node
// Re-upload ONLY the recording keys that are missing from R2 (the audit gap list).
// Reads a newline-delimited list of r2 keys (--keys), resolves each to its source
// file via audio-manifest.json, and uploads to R2 with --remote. Idempotent: safe
// to re-run; already-present keys just get overwritten harmlessly.
//
// Usage: node scripts/upload-gaps.mjs --bucket hyepar-audio --keys /tmp/missing-keys.txt

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { execFile } from "node:child_process";

function arg(name, argv, def) {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : def;
}
const CT = { ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".wav": "audio/wav", ".flac": "audio/flac", ".aac": "audio/aac" };
const ct = (k) => CT[k.slice(k.lastIndexOf(".")).toLowerCase()] || "application/octet-stream";

// Upload one object as a promise (async execFile), so we can run N concurrently.
function putObject(bucket, key, file) {
  return new Promise((resolve) => {
    execFile("npx",
      ["wrangler", "r2", "object", "put", `${bucket}/${key}`, "--file", file, "--content-type", ct(key), "--remote"],
      { maxBuffer: 1 << 24 },
      (err) => resolve(err ? { key, ok: false, err: String(err.message).split("\n")[0] } : { key, ok: true })
    );
  });
}

// Simple concurrency pool.
async function runPool(items, worker, concurrency) {
  let i = 0, done = 0, failed = 0;
  const failures = [];
  async function next() {
    while (i < items.length) {
      const idx = i++;
      const res = await worker(items[idx]);
      if (res.ok) { done++; if (done % 25 === 0) console.log(`  ...${done}/${items.length} uploaded`); }
      else { failed++; failures.push(res); console.error(`  FAILED ${res.key}: ${res.err}`); }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, next));
  return { done, failed, failures };
}

async function main() {
  const argv = process.argv.slice(2);
  const bucket = arg("--bucket", argv, "hyepar-audio");
  const keysFile = arg("--keys", argv);
  const concurrency = parseInt(arg("--concurrency", argv, "8"), 10);
  const m = JSON.parse(await readFile("audio-manifest.json", "utf8"));
  const root = m.root;
  const srcByKey = new Map();
  for (const d of m.dances) for (const r of d.recordings) srcByKey.set(r.r2Key, r.sourceFile);

  const keys = (await readFile(keysFile, "utf8")).trim().split("\n").map((s) => s.trim()).filter(Boolean);
  const jobs = [];
  let missing = 0;
  for (const key of keys) {
    const src = srcByKey.get(key);
    if (!src) { console.warn(`  no manifest source for ${key}`); missing++; continue; }
    const full = join(root, src);
    if (!existsSync(full)) { console.warn(`  source file missing on disk: ${src}`); missing++; continue; }
    jobs.push({ key, full });
  }

  console.log(`Re-uploading ${jobs.length} keys to ${bucket} (${concurrency} concurrent)...`);
  const { done, failed } = await runPool(jobs, (j) => putObject(bucket, j.key, j.full), concurrency);
  console.log(`\nDone. uploaded=${done} missing=${missing} failed=${failed}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
