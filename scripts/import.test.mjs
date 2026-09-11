// Tests for importer + validator logic (the parts where a bug is silent-and-wide).
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCsv, normalizeHold } from "./import-sheet.mjs";
import { splitFolderDances, recordingLabelFromFile } from "./ingest-audio.mjs";
import { validateDance } from "./validate-dances.mjs";
import { inferFamilyTags } from "./lib/parse.mjs";

test("inferFamilyTags: Qochari family from name or slug", () => {
  assert.deepEqual(inferFamilyTags("Քոչարի Սղերդի", "qochari-sgherdi"), ["Qochari"]);
  assert.deepEqual(inferFamilyTags("Կարնո Քոչարի", "karno-qochari"), ["Qochari"]);
  assert.deepEqual(inferFamilyTags("Ֆնջան", "fnjan"), []); // standalone, no family
  assert.deepEqual(inferFamilyTags("Շորոր Վանա", "shoror-vana"), ["Shoror"]);
  // romanized-only spelling still matches
  assert.deepEqual(inferFamilyTags("", "kochari-karno"), ["Qochari"]);
});

test("parseCsv: quoted fields, embedded commas, newlines", () => {
  const rows = parseCsv('a,b,c\n"has, comma","line\nbreak",plain\n');
  assert.deepEqual(rows[0], ["a", "b", "c"]);
  assert.deepEqual(rows[1], ["has, comma", "line\nbreak", "plain"]);
});

test("normalizeHold: Armenian labels → controlled vocab", () => {
  assert.equal(normalizeHold("Ուսերով"), "shoulders");
  assert.equal(normalizeHold("Ափերով"), "palms");
  assert.equal(normalizeHold("Ճկույթներ"), "pinkies");
  assert.equal(normalizeHold("Holding sticks"), "sticks");
  assert.equal(normalizeHold(""), null);
  assert.equal(normalizeHold("gibberish"), null);
});

test("splitFolderDances: comma-joined multi-dance folders", () => {
  assert.deepEqual(splitFolderDances("Գյովնդ, Քոչարի"), ["Գյովնդ", "Քոչարի"]);
  assert.deepEqual(splitFolderDances("Ֆնջան"), ["Ֆնջան"]);
});

test("recordingLabelFromFile: strips ext + underscores", () => {
  assert.equal(recordingLabelFromFile("Շավալի_Կարին_համույթ.mp3"), "Շավալի Կարին համույթ");
});

test("validateDance: catches bad vocab, authored recordings[], and audio_prefix rules", () => {
  const bad = {
    slug: "x", name: { hy: "Տեստ" }, hold_type: "elbows",
    recordings: [{ file: "x/a.mp3" }], // recordings must NOT be authored in YAML now
  };
  const errs = validateDance(bad, "x.yml");
  assert.ok(errs.some((e) => e.includes("hold_type")));
  assert.ok(errs.some((e) => e.includes("recordings")));

  // valid: audio via prefix, no authored recordings
  const good = {
    slug: "fnjan", name: { hy: "Ֆնջան" }, hold_type: "palms", difficulty: 2, energy: null,
    audio_prefix: "fnjan/",
  };
  assert.equal(validateDance(good, "fnjan.yml").length, 0);

  // audio_prefix must end in "/"
  const badPrefix = { slug: "y", name: { hy: "Յ" }, audio_prefix: "yy" };
  assert.ok(validateDance(badPrefix, "y.yml").some((e) => e.includes("audio_prefix")));

  // default_recording must live under the prefix
  const badDefault = { slug: "z", name: { hy: "Զ" }, audio_prefix: "z/", default_recording: "other/x.mp3" };
  assert.ok(validateDance(badDefault, "z.yml").some((e) => e.includes("default_recording")));
});
