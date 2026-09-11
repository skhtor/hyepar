#!/usr/bin/env node
// Create a NEW dance YAML from a single Telegram bot block, for cases where the bot
// has finer granularity than the sheet (e.g. "Գորանի Ալաշկերտի" and "Գորանի Սասնո"
// are distinct variants the sheet lumped as one "Գորանի").
//
// Creates data/dances/<slug>.yml with the bot's metadata, an optional family tag,
// and NO recordings (audio stays on the parent until a human distributes it).
// Refuses to overwrite an existing file unless --force.
//
// Usage:
//   node scripts/new-dance-from-bot.mjs --in block.txt --slug gorani-sasno --family Gorani

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import YAML from "yaml";
import { parseBotReply } from "./lib/telegram-parse.mjs";
import { GENDERS, HOLD_TYPES } from "./lib/parse.mjs";

const DANCES_DIR = "data/dances";

function arg(name, argv) {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : null;
}

// Pull recordings for a folder from the audio manifest, if --audio-folder is given.
async function recordingsForFolder(folderName) {
  try {
    const m = JSON.parse(await readFile("audio-manifest.json", "utf8"));
    const d = m.dances.find((x) => x.folder === folderName);
    if (!d) return [];
    return d.recordings.map((r, i) => ({
      file: r.r2Key,
      performer: r.performer,
      tempo_bpm: r.tempo_bpm ?? null,
      is_default: r.is_default ?? i === 0,
    }));
  } catch {
    return [];
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const inPath = arg("--in", argv);
  const slug = arg("--slug", argv);
  const family = arg("--family", argv);
  const audioFolder = arg("--audio-folder", argv);
  const force = argv.includes("--force");
  if (!inPath || !slug) {
    console.error("Usage: --in block.txt --slug <slug> [--family <Tag>] [--audio-folder <FolderName>] [--force]");
    process.exit(1);
  }

  const p = parseBotReply(await readFile(inPath, "utf8"));
  const path = join(DANCES_DIR, `${slug}.yml`);
  if (existsSync(path) && !force) {
    console.error(`Refusing to overwrite existing ${path} (use --force).`);
    process.exit(1);
  }

  const recordings = audioFolder ? await recordingsForFolder(audioFolder) : [];

  const dance = {
    slug,
    name: {
      hy: p.name_hy || slug,
      en: null,
      romanized: null,
      aliases: p.aliases || [],
    },
    regions: p.region ? p.region.split(",").map((s) => s.trim()).filter(Boolean) : null,
    hold_type: p.hold_type && HOLD_TYPES.includes(p.hold_type) ? p.hold_type : null,
    difficulty: p.difficulty ?? null,
    energy: p.energy ?? null,
    gender: p.gender && GENDERS.includes(p.gender) ? p.gender : null,
    family_tags: family ? [family] : [],
    genre: p.genre || [],
    notes: { hy: null, en: null, status: "unknown" },
    background: { hy: null, en: null, status: "unknown" },
    lyrics: { hy: null, en: null, status: "unknown" },
    videos: [],
    recordings, // from --audio-folder if given, else []
  };

  await writeFile(path, YAML.stringify(dance), "utf8");
  console.log(`Created ${path}  (family=${family || "none"}, regions=${JSON.stringify(dance.regions)}, recordings=${recordings.length})`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
