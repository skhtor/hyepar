#!/usr/bin/env node
// Merge pasted Telegram bot replies into the dance YAML (source of truth).
// Reads a text file of one or more bot replies separated by a line of --- or --,
// parses each with the tested parser, matches to a dance by Armenian name, and
// merges the STRUCTURED fields (region, genre, difficulty, energy, gender, hold,
// aliases). Preserves everything else already in the YAML (notes, lyrics, videos,
// recordings). Only fills/updates the fields the bot provides.
//
// Usage:
//   node scripts/merge-telegram.mjs --in pasted.txt [--dry-run]
//   (or pipe: cat pasted.txt | node scripts/merge-telegram.mjs --dry-run)

import { readFile, writeFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import YAML from "yaml";
import { parseBotReply } from "./lib/telegram-parse.mjs";
import { GENDERS, HOLD_TYPES } from "./lib/parse.mjs";

const DANCES_DIR = "data/dances";

function parseArgs(argv) {
  const a = { in: null, dryRun: false, target: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--in") a.in = argv[++i];
    else if (argv[i] === "--dry-run") a.dryRun = true;
    else if (argv[i] === "--target") a.target = argv[++i]; // force single block → this slug
  }
  return a;
}

async function readStdin() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return Buffer.concat(chunks).toString("utf8");
}

/** Build a lookup from Armenian name → { file, doc } for all dances. */
async function loadDances() {
  const files = (await readdir(DANCES_DIR)).filter((f) => f.endsWith(".yml") && !f.startsWith("_"));
  const byName = new Map();
  const all = [];
  for (const f of files) {
    const doc = YAML.parse(await readFile(join(DANCES_DIR, f), "utf8"));
    const entry = { file: join(DANCES_DIR, f), doc };
    all.push(entry);
    if (doc?.name?.hy) byName.set(doc.name.hy.trim(), entry);
  }
  return { byName, all };
}

/** Loose match: exact hy name, else contains, else first-word match. */
function matchDance(name, byName, all) {
  const n = (name || "").trim();
  if (byName.has(n)) return byName.get(n);
  // try contains either direction
  for (const e of all) {
    const dn = e.doc?.name?.hy?.trim();
    if (!dn) continue;
    if (dn.includes(n) || n.includes(dn)) return e;
  }
  // try first word
  const first = n.split(/\s+/)[0];
  for (const e of all) {
    const dn = e.doc?.name?.hy?.trim() || "";
    if (dn.split(/\s+/)[0] === first) return e;
  }
  return null;
}

function mergeInto(doc, parsed) {
  const changes = [];
  const set = (field, val) => {
    if (val == null) return;
    if (Array.isArray(val) && val.length === 0) return;
    const before = JSON.stringify(doc[field] ?? null);
    doc[field] = val;
    if (JSON.stringify(val) !== before) changes.push(field);
  };

  if (parsed.region) set("regions", parsed.region.split(",").map((s) => s.trim()).filter(Boolean));
  if (parsed.genre) set("genre", parsed.genre);
  if (parsed.difficulty != null) set("difficulty", parsed.difficulty);
  if (parsed.energy != null) set("energy", parsed.energy);
  if (parsed.gender && GENDERS.includes(parsed.gender)) set("gender", parsed.gender);
  if (parsed.hold_type && HOLD_TYPES.includes(parsed.hold_type)) set("hold_type", parsed.hold_type);

  // Merge aliases into name.aliases (union, no dupes).
  if (parsed.aliases && parsed.aliases.length) {
    const existing = new Set(doc.name?.aliases || []);
    for (const a of parsed.aliases) existing.add(a);
    const merged = [...existing];
    if (JSON.stringify(merged) !== JSON.stringify(doc.name?.aliases || [])) {
      doc.name = doc.name || {};
      doc.name.aliases = merged;
      changes.push("aliases");
    }
  }
  return changes;
}

async function main() {
  const { in: inPath, dryRun, target } = parseArgs(process.argv.slice(2));
  const raw = inPath ? await readFile(inPath, "utf8") : await readStdin();

  // Split on a line that is only dashes (--- or --), tolerant of whitespace.
  const blocks = raw.split(/\n\s*-{2,}\s*\n/).map((b) => b.trim()).filter(Boolean);
  const { byName, all } = await loadDances();
  const bySlug = new Map(all.map((e) => [e.doc.slug, e]));

  let merged = 0, unmatched = 0, unchanged = 0;
  const report = [];

  for (const block of blocks) {
    const parsed = parseBotReply(block);
    if (!parsed.name_hy) { report.push(`(skipped: no name in block)`); continue; }
    // --target forces a single-block paste onto a specific slug (for spelling variants),
    // and records the bot's spelling as an alias so search finds both.
    let entry = target ? bySlug.get(target) : matchDance(parsed.name_hy, byName, all);
    if (target && entry && parsed.name_hy && parsed.name_hy !== entry.doc.name?.hy) {
      parsed.aliases = [...(parsed.aliases || []), parsed.name_hy];
    }
    if (!entry) {
      unmatched++;
      report.push(`✗ NO MATCH for "${parsed.name_hy}"${target ? ` (target ${target} not found)` : ""}`);
      continue;
    }
    const changes = mergeInto(entry.doc, parsed);
    if (changes.length === 0) { unchanged++; report.push(`= ${parsed.name_hy} (no change)`); continue; }
    if (!dryRun) await writeFile(entry.file, YAML.stringify(entry.doc), "utf8");
    merged++;
    report.push(`✓ ${parsed.name_hy} → ${entry.file.split("/").pop()}  [${changes.join(", ")}]`);
  }

  console.log(report.join("\n"));
  console.log(`\n${dryRun ? "[DRY RUN] " : ""}merged=${merged} unchanged=${unchanged} unmatched=${unmatched} blocks=${blocks.length}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
