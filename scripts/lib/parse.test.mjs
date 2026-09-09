// Unit tests for the pure importer parsers.
// Run with: npm test   (uses node --test)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseStarRating,
  splitVideoColumns,
  extractUrl,
  extractRegion,
  slugify,
} from "./parse.mjs";

test("parseStarRating: full/partial/empty/malformed", () => {
  assert.equal(parseStarRating("★★★★☆"), 4);
  assert.equal(parseStarRating("★☆☆☆☆"), 1);
  assert.equal(parseStarRating("★★★★★"), 5);
  assert.equal(parseStarRating("☆☆☆☆☆"), null); // deliberate "not rated"
  assert.equal(parseStarRating(""), null);
  assert.equal(parseStarRating(null), null);
  assert.equal(parseStarRating(undefined), null);
  assert.equal(parseStarRating("Y"), null); // non-star cell
  assert.equal(parseStarRating("  ★★  "), 2); // whitespace tolerant
  assert.equal(parseStarRating("★★★★★★★"), 5); // clamp above 5
});

test("splitVideoColumns: one / two / none", () => {
  assert.deepEqual(splitVideoColumns(null, null), []);
  assert.deepEqual(
    splitVideoColumns("Perf title https://youtu.be/abc", null),
    [{ url: "https://youtu.be/abc", title: "Perf title https://youtu.be/abc", kind: "performance" }]
  );
  const two = splitVideoColumns("Perf https://y.tube/1", "Ուս ուսի tutorial https://y.tube/2");
  assert.equal(two.length, 2);
  assert.equal(two[0].kind, "performance");
  assert.equal(two[1].kind, "tutorial");
  assert.equal(two[1].url, "https://y.tube/2");
  // blank cell skipped
  assert.equal(splitVideoColumns("   ", "https://y.tube/3").length, 1);
});

test("extractUrl", () => {
  assert.equal(extractUrl("watch here https://x.com/v?a=1 now"), "https://x.com/v?a=1");
  assert.equal(extractUrl("no url here"), null);
  assert.equal(extractUrl(null), null);
});

test("extractRegion: confident prefix, whole-word, else null", () => {
  assert.equal(extractRegion("Karin - Goevnd / Կարին - Գյովընդ"), "Karin");
  assert.equal(extractRegion("Sasun - Ասմար յաման"), "Sasun");
  assert.equal(extractRegion("Կարին - Աստվածածնա պար"), "Karin"); // Armenian prefix
  assert.equal(extractRegion("Some random performance title"), null); // no guess
  assert.equal(extractRegion(""), null);
  assert.equal(extractRegion(null), null);
  // must be a whole word — "Vandalism" should NOT match region "Van"
  assert.equal(extractRegion("Vandalism troupe showcase"), null);
});

test("slugify: latin + armenian transliteration + trims", () => {
  assert.equal(slugify("Sgherdi Qochari"), "sgherdi-qochari");
  assert.equal(slugify("  Fnjan!  "), "fnjan");
  assert.equal(slugify("Karno / Qochari"), "karno-qochari");
  // Armenian transliterates to a readable Latin slug (no Armenian left in slugs)
  assert.equal(slugify("Ֆնջան"), "fnjan");
  assert.equal(slugify("Սղերդի Քոչարի"), "sgherdi-qochari");
  assert.match(slugify("Բիճո"), /^[a-z0-9-]+$/); // ASCII-only guarantee
});
