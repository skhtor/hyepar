// Tests for the Telegram bot reply parser (untrusted, loosely-formatted input).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseStars,
  parseSpeed,
  parseGender,
  parseHold,
  parseGenres,
  parseNameLine,
  parseBotReply,
} from "./telegram-parse.mjs";

const SAMPLE = `Վերվերի Սալմաստի / Հեշտայի

🌍 Տարածաշրջան - Սալմաստ
🎭 Ժանր - Պաշտամունքային, Տոնական

Բարդություն - ★★★★☆
Արագություն - ⚡️⚡️⚡️
Սեռ - 🧔🏻👧🏻
Ձեռք - 🤙🏻 - ճկույթ`;

test("parseStars", () => {
  assert.equal(parseStars("★★★★☆"), 4);
  assert.equal(parseStars("★☆☆☆☆"), 1);
  assert.equal(parseStars("☆☆☆☆☆"), null);
  assert.equal(parseStars(null), null);
});

test("parseSpeed: bolt count → energy", () => {
  assert.equal(parseSpeed("⚡️⚡️⚡️"), 3);
  assert.equal(parseSpeed("⚡️"), 1);
  assert.equal(parseSpeed(""), null);
  assert.equal(parseSpeed(null), null);
});

test("parseSpeed: ranges (➡️) take the upper bound", () => {
  assert.equal(parseSpeed("⚡️➡️⚡️⚡️"), 2);       // 1 → 2
  assert.equal(parseSpeed("⚡️⚡️➡️⚡️⚡️⚡️"), 3);  // 2 → 3
});

test("parseHold: crossed", () => {
  assert.equal(parseHold("✊🏻 - խաչված"), "crossed");
});

test("parseGenres: wedding + pilgrimage", () => {
  assert.deepEqual(parseGenres("Հարսանեկան"), ["wedding"]);
  assert.deepEqual(parseGenres("Ուխտագնացության"), ["pilgrimage"]);
  assert.deepEqual(parseGenres("Ռազմական"), ["martial"]);
});

test("parseGender from person emoji", () => {
  assert.equal(parseGender("🧔🏻👧🏻"), "mixed");
  assert.equal(parseGender("🧔🏻"), "men");
  assert.equal(parseGender("👧🏻"), "women");
  assert.equal(parseGender(""), null);
});

test("parseHold from Armenian word", () => {
  assert.equal(parseHold("🤙🏻 - ճկույթ"), "pinkies");
  assert.equal(parseHold("ուս ուսի"), "shoulders");
  assert.equal(parseHold("ափերով"), "palms");
  assert.equal(parseHold("անհայտ բան"), null);
  assert.equal(parseHold(null), null);
});

test("parseGenres: mapped + unmapped kept", () => {
  assert.deepEqual(parseGenres("Պաշտամունքային, Տոնական"), ["ritual", "festive"]);
  assert.deepEqual(parseGenres("Մարտական"), ["martial"]);
  assert.deepEqual(parseGenres(""), []);
});

test("parseNameLine: alt name after slash", () => {
  assert.deepEqual(parseNameLine("Վերվերի Սալմաստի / Հեշտայի"), {
    name: "Վերվերի Սալմաստի",
    aliases: ["Հեշտայի"],
  });
  assert.deepEqual(parseNameLine("Ֆնջան"), { name: "Ֆնջան", aliases: [] });
});

test("parseBotReply: full sample → all fields", () => {
  const r = parseBotReply(SAMPLE);
  assert.equal(r.name_hy, "Վերվերի Սալմաստի");
  assert.deepEqual(r.aliases, ["Հեշտայի"]);
  assert.equal(r.region, "Սալմաստ");
  assert.deepEqual(r.genre, ["ritual", "festive"]);
  assert.equal(r.difficulty, 4);
  assert.equal(r.energy, 3);
  assert.equal(r.gender, "mixed");
  assert.equal(r.hold_type, "pinkies");
});

test("parseBotReply: missing fields → absent, not guessed", () => {
  const r = parseBotReply("Ֆնջան\n\n🌍 Տարածաշրջան - Վան");
  assert.equal(r.name_hy, "Ֆնջան");
  assert.equal(r.region, "Վան");
  assert.equal(r.difficulty, undefined); // not present → not set
  assert.equal(r.gender, undefined);
});
