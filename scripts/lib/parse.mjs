// Pure parsing helpers for the Sheet → YAML importer.
// These are the functions the eng review flagged for unit tests: a bug here
// silently corrupts the seed across ~115 dances, so they are covered thoroughly.
// No file I/O, no side effects — pure in / pure out.

/**
 * Parse a star-rating cell like "★★★☆☆" into an integer 0-5.
 * Returns null for empty / all-empty / unparseable input (a deliberate "not rated").
 * @param {string|null|undefined} cell
 * @returns {number|null}
 */
export function parseStarRating(cell) {
  if (cell == null) return null;
  const s = String(cell).trim();
  if (s === "") return null;
  const filled = (s.match(/★/g) || []).length;
  const empty = (s.match(/☆/g) || []).length;
  // If there are no star glyphs at all, it's not a rating cell.
  if (filled === 0 && empty === 0) return null;
  // All-empty stars (☆☆☆☆☆) is a deliberate "not yet rated".
  if (filled === 0) return null;
  return Math.min(5, filled);
}

/**
 * The sheet has two video columns: F (performance, "Տեսանյութ") and
 * G (tutorial / "Ձեռնարկ", often an "Ուս ուսի" shoulder-hold walk-through).
 * Returns a normalized array of { url?, title, kind } entries, skipping blanks.
 * Cells may contain a title, a URL, or both — we keep the raw text as title and
 * pull a URL if one is present.
 * @param {string|null} performanceCell
 * @param {string|null} tutorialCell
 * @returns {Array<{url: string|null, title: string, kind: "performance"|"tutorial"}>}
 */
export function splitVideoColumns(performanceCell, tutorialCell) {
  const out = [];
  for (const [cell, kind] of [
    [performanceCell, "performance"],
    [tutorialCell, "tutorial"],
  ]) {
    if (cell == null) continue;
    const text = String(cell).trim();
    if (text === "") continue;
    out.push({ url: extractUrl(text), title: text, kind });
  }
  return out;
}

/** Pull the first http(s) URL out of a string, or null. */
export function extractUrl(text) {
  if (text == null) return null;
  const m = String(text).match(/https?:\/\/\S+/);
  return m ? m[0] : null;
}

/**
 * Region is not a dedicated column in the source sheet — it is often embedded
 * in a video title, e.g. "Karin - ...", "Sasun - ...", "Կարին - ...".
 * We only extract when confident (a known region name at the start before a dash);
 * otherwise return null so the UI shows a fillable gap rather than a wrong guess.
 * @param {string|null} title
 * @param {string[]} [knownRegions]
 * @returns {string|null}
 */
export function extractRegion(title, knownRegions = KNOWN_REGIONS) {
  if (title == null) return null;
  const text = String(title).trim();
  if (text === "") return null;
  // Prefer an explicit "Region - ..." prefix.
  const prefix = text.split(/[-–—|:]/)[0].trim();
  for (const region of knownRegions) {
    if (equalsFold(prefix, region.en) || equalsFold(prefix, region.hy)) {
      return region.en;
    }
  }
  // Otherwise scan for a known region token anywhere, but only accept a
  // whole-word match to avoid false positives.
  for (const region of knownRegions) {
    if (containsWord(text, region.en) || containsWord(text, region.hy)) {
      return region.en;
    }
  }
  return null;
}

/** Case-insensitive full-string equality (Latin + Armenian safe). */
function equalsFold(a, b) {
  return a.toLocaleLowerCase() === b.toLocaleLowerCase();
}

/** Whole-word (token) containment check. */
function containsWord(haystack, needle) {
  const tokens = haystack.split(/[\s,./|:–—-]+/).map((t) => t.toLocaleLowerCase());
  return tokens.includes(needle.toLocaleLowerCase());
}

/**
 * A slug from a dance name. Transliterates Armenian → Latin so slugs, URLs, and
 * R2 keys are ASCII (a diaspora user's URL reads /dance/sgherdi-qochari, not
 * percent-encoded Armenian). Latin input passes through. Empty → "".
 */
export function slugify(name) {
  if (name == null) return "";
  const latin = transliterateArmenian(String(name));
  return latin
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Mesropian-ish Armenian → Latin transliteration for slugs. Not a scholarly
// standard — it's tuned to produce readable, searchable diaspora spellings
// (e.g. Քոչարի → qochari, Ֆնջան → fnjan). Longer digraphs first.
const ARMENIAN_TRANSLIT = [
  ["ու", "u"], ["ՈՒ", "U"], ["Ու", "U"],
  ["և", "ev"],
  ["ա", "a"], ["բ", "b"], ["գ", "g"], ["դ", "d"], ["ե", "e"], ["զ", "z"],
  ["է", "e"], ["ը", "e"], ["թ", "t"], ["ժ", "zh"], ["ի", "i"], ["լ", "l"],
  ["խ", "kh"], ["ծ", "ts"], ["կ", "k"], ["հ", "h"], ["ձ", "dz"], ["ղ", "gh"],
  ["ճ", "ch"], ["մ", "m"], ["յ", "y"], ["ն", "n"], ["շ", "sh"], ["ո", "o"],
  ["չ", "ch"], ["պ", "p"], ["ջ", "j"], ["ռ", "r"], ["ս", "s"], ["վ", "v"],
  ["տ", "t"], ["ր", "r"], ["ց", "ts"], ["փ", "p"], ["ք", "q"], ["օ", "o"],
  ["ֆ", "f"],
];

export function transliterateArmenian(text) {
  let out = text;
  for (const [hy, lat] of ARMENIAN_TRANSLIT) {
    out = out.split(hy).join(lat);
    // also handle uppercase Armenian by lowercasing input first is simpler:
  }
  // Uppercase Armenian letters: lowercase then re-map any leftover.
  out = out.replace(/[\u0531-\u0556]/g, (ch) => {
    const lower = ch.toLowerCase();
    const hit = ARMENIAN_TRANSLIT.find(([hy]) => hy === lower);
    return hit ? hit[1] : ch;
  });
  return out;
}

// Known Armenian regions seen in the source data. Extend as needed — this list
// drives confident region extraction; unknown → null (fillable gap), never a guess.
export const KNOWN_REGIONS = [
  { en: "Karin", hy: "Կարին" },
  { en: "Sasun", hy: "Սասուն" },
  { en: "Sgherd", hy: "Սղերդ" },
  { en: "Alashkert", hy: "Ալաշկերտ" },
  { en: "Vaspurakan", hy: "Վասպուրական" },
  { en: "Mush", hy: "Մուշ" },
  { en: "Shatakh", hy: "Շատախ" },
  { en: "Van", hy: "Վան" },
];

// Controlled vocabularies — the validator enforces these at build time so a
// typo becomes a build error, not a silent filter miss.
export const HOLD_TYPES = ["shoulders", "palms", "pinkies", "interlocked", "sticks", "belt", "free"];
export const GENDERS = ["men", "women", "mixed"];
export const VIDEO_KINDS = ["performance", "tutorial"];
export const FIELD_STATUSES = ["known", "unknown", "unverified"];
