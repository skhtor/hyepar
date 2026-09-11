// Parse a Telegram bot dance reply into HyePar fields.
// The bot returns Armenian-labelled, emoji-decorated structured text, e.g.:
//
//   Վերվերի Սալմաստի / Հեշտայի
//
//   🌍 Տարածաշրջան - Սալմաստ
//   🎭 Ժանր - Պաշտամունքային, Տոնական
//   Բարդություն - ★★★★☆
//   Արագություն - ⚡️⚡️⚡️
//   Սեռ - 🧔🏻👧🏻
//   Ձեռք - 🤙🏻 - ճկույթ
//
// All parsers are PURE and defensive: bot text is untrusted and fields are often
// missing or formatted loosely. Anything unrecognized → null (an honest gap), never a guess.

import { HOLD_TYPES, GENDERS } from "./parse.mjs";

/** ★★★★☆ → 4 ; empty/absent → null. Tolerates variation-selector chars. */
export function parseStars(s) {
  if (s == null) return null;
  const filled = (String(s).match(/★/g) || []).length;
  return filled > 0 ? Math.min(5, filled) : null;
}

/**
 * Speed → energy (0-5). Handles a plain run (⚡️⚡️⚡️ → 3) and a RANGE written with
 * an arrow (⚡️➡️⚡️⚡️ = "1 to 2" → take the upper bound 2; ⚡️⚡️➡️⚡️⚡️⚡️ → 3).
 * The range means the dance varies in tempo; we store the upper bound so a
 * "high energy" filter still catches it. Absent → null.
 */
export function parseSpeed(s) {
  if (s == null) return null;
  const t = String(s);
  if (/\u27A1/.test(t)) {
    // range: count bolts on each side of the ➡️, take the max (upper bound)
    const [left, right] = t.split(/\u27A1\uFE0F?/);
    const lb = (left.match(/\u26A1/g) || []).length;
    const rb = (right.match(/\u26A1/g) || []).length;
    const upper = Math.max(lb, rb);
    return upper > 0 ? Math.min(5, upper) : null;
  }
  const bolts = (t.match(/\u26A1/g) || []).length;
  return bolts > 0 ? Math.min(5, bolts) : null;
}

/** Gender from the person emojis: 🧔(man) + 👧/👩(woman) → mixed; one → men/women. */
export function parseGender(s) {
  if (s == null) return null;
  const t = String(s);
  const hasMan = /\u{1F9D4}|\u{1F468}|\u{1F473}/u.test(t);   // bearded/man
  const hasWoman = /\u{1F467}|\u{1F469}|\u{1F471}/u.test(t); // girl/woman
  if (hasMan && hasWoman) return "mixed";
  if (hasMan) return "men";
  if (hasWoman) return "women";
  return null;
}

/** Hold from the Armenian word after the emoji (ճկույթ → pinkies, etc.). */
export function parseHold(s) {
  if (s == null) return null;
  const t = String(s);
  const map = [
    [/ճկույթ/, "pinkies"],
    [/ուս/, "shoulders"],
    [/մեջք/, "back"],
    [/ափ/, "palms"],
    [/գոտի/, "belt"],
    [/փայտ|մտրակ/, "sticks"],
    [/դաշույն|սուր|խանչ/, "dagger"],
    [/խաչ/, "crossed"],
    [/ազատ/, "free"],
    [/ձեռք(?!.*(ճկույթ|ուս|մեջք|ափ|գոտի|փայտ|խաչ))/, "interlocked"], // generic "hands"
  ];
  for (const [re, val] of map) if (re.test(t)) return HOLD_TYPES.includes(val) ? val : null;
  return null;
}

/** Split a genre/occasion cell "Պաշտամունքային, Տոնական" → ["ritual","festive"] (mapped) + keep hy. */
export function parseGenres(s) {
  if (s == null) return [];
  const map = {
    "Պաշտամունքային": "ritual",
    "Տոնական": "festive",
    "Մարտական": "martial",
    "Ռազմական": "martial",
    "Աշխատանքային": "work",
    "Սիրային": "love",
    "Ծիսական": "ceremonial",
    "Հարսանեկան": "wedding",
    "Ուխտագնացության": "pilgrimage",
    "Համայնքային": "communal",
    "Սգո": "mourning",
    "Չարխափան": "charkhapan",
    "Ոգեկոչման": "commemoration",
    "Թարս": "reverse",
  };
  return String(s)
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .map((hy) => map[hy] || hy); // keep the Armenian term if unmapped
}

/** The name line may carry an alternate after "/": "A / B" → { name, aliases:[B] }. */
export function parseNameLine(line) {
  const parts = String(line || "").split("/").map((s) => s.trim()).filter(Boolean);
  return { name: parts[0] || "", aliases: parts.slice(1) };
}

/**
 * Parse a full bot reply into a partial dance record. Missing lines → the field is
 * simply absent from the result (caller merges, preserving existing YAML values).
 * @param {string} text
 */
export function parseBotReply(text) {
  if (!text) return {};
  const lines = String(text).split(/\r?\n/).map((l) => l.trim());
  const out = {};

  // First non-empty line is the name.
  const nameLine = lines.find((l) => l.length > 0);
  if (nameLine) {
    const { name, aliases } = parseNameLine(nameLine);
    out.name_hy = name;
    if (aliases.length) out.aliases = aliases;
  }

  // Value after the first "-" (or ":") on a labelled line.
  const valOf = (line) => {
    const i = line.search(/[-:]/);
    return i >= 0 ? line.slice(i + 1).trim() : "";
  };
  const find = (labelRe) => {
    const l = lines.find((x) => labelRe.test(x));
    return l ? valOf(l) : null;
  };

  const region = find(/Տարածաշրջան/);
  if (region) out.region = region;

  const genre = find(/Ժանր/);
  if (genre) out.genre = parseGenres(genre);

  const diff = find(/Բարդություն/);
  const d = parseStars(diff);
  if (d != null) out.difficulty = d;

  const speed = find(/Արագություն/);
  const e = parseSpeed(speed);
  if (e != null) out.energy = e;

  const gender = find(/Սեռ/);
  const g = parseGender(gender);
  if (g && GENDERS.includes(g)) out.gender = g;

  const hold = find(/Ձեռք/);
  const h = parseHold(hold);
  if (h) out.hold_type = h;

  return out;
}
