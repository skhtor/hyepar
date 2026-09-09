// Typed access to the built data bundle (src/data/bundle.json), produced by
// scripts/build-bundle.mjs from data/dances/*.yml. The site reads this at build
// time; nothing here runs in the browser.
import bundle from "../data/bundle.json";

export type FieldStatus = "known" | "unknown" | "unverified";

export interface LangField {
  hy: string | null;
  en: string | null;
  status?: FieldStatus;
  source?: string | null;
}

export interface Recording {
  file: string; // R2 key, e.g. "qochari-sgherdi/rec-01.mp3"
  performer: string | null;
  tempo_bpm: number | null;
  is_default: boolean;
}

export interface Video {
  url: string | null;
  title: string;
  kind: "performance" | "tutorial";
}

export interface Dance {
  slug: string;
  name: { hy: string; en: string | null; romanized: string | null; aliases: string[] };
  region: string | null;
  hold_type: string | null;
  difficulty: number | null;
  energy: number | null;
  gender: "men" | "women" | "mixed" | null;
  family_tags: string[];
  notes: LangField;
  background: LangField;
  lyrics: LangField;
  videos: Video[];
  recordings: Recording[];
}

export interface Bundle {
  generatedAt: string;
  total: number;
  documented: number;
  facets: { regions: string[]; families: string[]; holds: string[] };
  dances: Dance[];
}

const data = bundle as unknown as Bundle;

export const allDances: Dance[] = [...data.dances].sort((a, b) =>
  (a.name.romanized || a.slug).localeCompare(b.name.romanized || b.slug)
);
export const facets = data.facets;
export const coverage = { total: data.total, documented: data.documented };

export function getDance(slug: string): Dance | undefined {
  return data.dances.find((d) => d.slug === slug);
}

export function defaultRecording(d: Dance): Recording | undefined {
  return d.recordings.find((r) => r.is_default) ?? d.recordings[0];
}

/** A compact search/display label: romanized if present, else Armenian. */
export function displayName(d: Dance): string {
  return d.name.romanized || d.name.en || d.name.hy;
}

/** R2 public base for audio (custom domain). Configurable via env at build time. */
export const AUDIO_BASE =
  (import.meta.env.PUBLIC_AUDIO_BASE as string | undefined) ?? "https://audio.hyepar.sass.sh";

export function audioUrl(rec: Recording): string {
  return `${AUDIO_BASE}/${rec.file}`;
}
