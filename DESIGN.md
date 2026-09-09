# Design System — HyePar (Armenian Traditional Dance Archive)

> **This is ours, and it's more alive than ever.**
> Every decision below serves that: *ours* (rooted in real Armenian visual heritage,
> not the flag) and *alive* (authored, warm, contemporary — not a dusty museum catalog).

## Product Context
- **What this is:** An open-source living archive of Armenian traditional dance, doubling
  as a teacher's practice tool (search → cue → play, phone-first, on the gym floor).
- **Who it's for:** Armenian dancers and the diaspora (reading/heritage side); dance
  teachers and event organizers (practice/tool side). AGD is the first real user.
- **Space/industry:** Cultural heritage archive / folk-dance preservation.
- **Project type:** App UI (data-dense archive + tool), light marketing only on the home hero.

## Aesthetic Direction
- **Direction:** Editorial heritage — illuminated-manuscript roots, modern craft. Reads
  like a beautifully typeset contemporary book about a living tradition, not a SaaS app
  and not a museum catalog.
- **Decoration level:** Intentional. Warm vellum ground, a hairline vermilion rule under
  headings, generous margins. No blobs, gradients, decorative icons, or emoji. Restraint
  is what makes it dignified rather than kitsch.
- **Mood:** Rooted, warm, alive, dignified. Serious preservation, not a hobby blog.
- **Grounding insight:** The palette derives from **Armenian illuminated-manuscript
  pigments** (vermilion, lapis lazuli, orpiment gold, cream vellum) — the visual tradition
  that began with the Armenian alphabet (405 AD) and shares the dance tradition's era and
  lineage. Deliberately NOT the modern flag (red/blue/orange), which is a 20th-century
  political symbol. This makes the archive look like it belongs to the tradition it
  preserves. The site does not need to wave flag colors anywhere.

## Typography
- **Display / dance names:** Noto Serif Armenian (700) — set large, like a chapter title.
- **Body:** Noto Sans Armenian (400) — reads cleanly in Armenian and Latin in one family,
  so romanization stays in the same voice.
- **UI / labels / data:** Geist (with `tabular-nums` for durations, BPM, counts).
- **Requirement (locked):** Armenian text is ALWAYS set in a real, designed Armenian face
  (Noto Serif/Sans Armenian) — NEVER a system-ui fallback. Armenian script is the archive's
  core visual identity.
- **Aspirational upgrade (when budget exists):** Arek Armenian + Arek Latin (Rosetta Type,
  by Khajag Apelian) — an authored Armenian-first bilingual family. Not required to ship;
  Noto is the free, well-designed default that keeps the project fully open-source.
- **Loading:** Google Fonts (Noto Serif Armenian, Noto Sans Armenian, Geist). Self-host if
  performance requires it.
- **Every text node carries `lang="hy"` / `lang="en"`** so screen readers pronounce each
  script correctly and the right font applies per script.

## Color
- **Approach:** Restrained — color used the way a manuscript illuminator used precious
  pigment: sparingly, meaningfully. Neutrals do most of the work; accents are rare.
- **Ground / Vellum:** `#F5EFE0` (light) — warm cream, the page.
- **Ink:** `#1A1714` — primary text (a warm near-black, not pure black).
- **Primary — Vermilion:** `#C0362C` — the illuminator's red. Heading rule, active dance,
  primary actions, play control.
- **Secondary — Lapis:** `#1E4B8F` — links, region tags.
- **Rare accent — Orpiment gold:** `#C99A2E` — the "default recording" star and moments of
  delight. Used almost never, so it means something.
- **Malachite green:** `#3E7A5E` — reserved for the future region map's accents.
- **Neutrals:** warm grays derived from the vellum (hairline `#D8CCB4`), never cold slate.
- **Dark mode:** manuscript "deep ink" ground `#1A1714`, surfaces `#241F1A`, text `#F0E8D8`,
  accents brightened ~15% for contrast (vermilion `#E0574C`, lapis `#6D97D6`, gold `#E0B94E`).
  Redesign surfaces, do not just invert.
- **Contrast:** body text ≥ 4.5:1 (WCAG AA), always.

## Spacing
- **Base unit:** 8px.
- **Density:** Comfortable on the reading/archive side (heritage needs room to breathe);
  compact on the teacher practice view (speed wins).
- **Scale:** xs(4) sm(8) md(16) lg(24) xl(40) 2xl(64).

## Layout
- **Approach:** Hybrid. Editorial + asymmetric + generous for reading/archive pages (dance
  name set large like a chapter title). Disciplined + dense + thumb-first for the practice view.
- **Two distinct views over the same data** (from the design review):
  - **Dance detail (reading-first):** name → media → story/lyrics → family footer.
  - **Teacher practice (doing-first, phone-first):** autofocus search → large tap rows →
    pinned player (survives scroll) → collapsible filter row.
- **Max content width:** ~1080px for reading pages.
- **Border radius:** sm 6px, md 10px, lg 12px, pill 999px (badges, play control). Not
  uniform-bubbly on everything.
- **Dance list reads as a catalog/index**, not a generic card grid.

## Motion
- **Approach:** Intentional, minimal. No scroll choreography.
- **The one alive moment:** when a recording starts, the play control fills with vermilion +
  a subtle warm glow. Confident, not busy.
- **Easing:** enter ease-out, exit ease-in, move ease-in-out.
- **Duration:** micro 50–100ms, short 150–250ms, medium 250–400ms.

## Accessibility (locked)
- Touch targets ≥ 44px; play/pause thumb-reachable (bottom-anchored on phone).
- Pinned player survives scrolling on the practice view.
- Keyboard nav for the archive (tab list/filters, enter to open, escape to close).
- `lang` attributes on all bilingual text; semantic landmarks; accessible media labels.
- WCAG-AA contrast on body text.

## Empty / Incomplete States
- Every missing recording / video / field is an ACTIVE contribution prompt
  ("No recording yet — know one? Contribute"), never a passive "unavailable".
- Coverage shown honestly as a feature ("71 of 115 documented — help fill the gaps").

## Future-fit
- The manuscript palette (lapis, vermilion, gold, malachite) gives distinct,
  historically-Armenian region accents for the planned **regional origin map** feature.

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-09-09 | Manuscript-pigment palette, not the flag | Older, richer, uniquely Armenian; the dance and manuscript traditions share era + lineage. User: site shouldn't wave flag colors. |
| 2026-09-09 | Noto Serif/Sans Armenian as default (Arek aspirational) | Free, well-designed, bilingual in one family; keeps project fully open-source. User chose Noto. |
| 2026-09-09 | Editorial-heritage aesthetic, restrained color | Serves the memorable thing: "ours + alive". Dignified, not a museum catalog, not a SaaS app. |
| 2026-09-09 | Created by /design-consultation | Grounded in illuminated-manuscript research + the eng/design plan reviews. |
