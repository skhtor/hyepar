# HyePar

**A living archive of Armenian traditional dance — and a teacher's practice tool.**

> This is ours, and it's more alive than ever.

HyePar documents Armenian traditional dances (region, hold type, difficulty, energy,
music, video, lyrics, history) as an open, honest archive — and doubles as a fast,
phone-first tool a dance teacher can use on the practice floor: search a dance, cue the
music, hit play in seconds.

## Status

Early development. Planning and design are complete; implementation is starting.

- **Design system:** see [`DESIGN.md`](./DESIGN.md) — read it before any UI work.
- **Data:** ~115 dances seeded from a maintained source, sparse-by-design (gaps are shown,
  not hidden, and invite contribution).

## Architecture (planned)

- **Front end:** Astro static site, deployed on Cloudflare Pages.
- **Data:** versioned YAML per dance (`data/dances/*.yml`) is the single source of truth;
  a build step generates a static read bundle the browser searches/filters client-side (Fuse.js).
- **Audio:** owned recordings served directly from a public Cloudflare R2 bucket on a custom
  domain (native HTTP range requests → seeking + progressive playback; free egress). Never
  proxied through a Worker.
- **Submissions:** GitHub issue template at launch; a review queue promotes approved entries
  into the YAML as commits.

Two distinct views over the same data:
- **Dance detail** — reading-first (name → media → story → family).
- **Teacher practice** — doing-first, phone-first (search → cue → play, pinned player).

## Repository layout

```
data/dances/     per-dance YAML (source of truth)
scripts/         importer (Sheet → YAML), YAML→bundle build, R2 audio ingest
src/             Astro site (layouts, components, pages, styles)
public/          static assets
DESIGN.md        design system (fonts, palette, spacing, motion, a11y)
CLAUDE.md        project conventions + skill routing
```

## License

Code and content licensing to be finalized (see planning notes). Intent: open source —
CC-BY-style for content, a permissive/copyleft license for code. Audio recording rights
to be clarified per track.

## Bilingual

Armenian-first, English secondary. Dance names are searchable by romanized spelling
(type "qochari", find "Քոչարի").
