/** Claude models a manual reader can run on. */
export type ModelId = "claude-haiku-5-5" | "claude-sonnet-5-5" | "claude-opus-5-5";

/**
 * What a reader (an agent looking at the manual's pages, or its text layer) found in a product's assembly manual, kept in
 * .qa/manuals/<slug>/facts.json. The rules readers follow: .superpowers/sdd/2026-11-15-manual-parity/facts-schema.md.
 * A fitting drawn as not included has a name ending in "(not included)" and may have no letter ("-" or none) and no count.
 */
export type ManualFacts = {
  slug: string;
  source: "text" | "vision";
  model?: ModelId;
  parts: { label: string; name: string; count: number; sizeMm?: [number, number, number] }[];
  fittings: { letter?: string; name: string; count?: number; lenMm?: number }[];
  steps: { n: number; parts: string[]; fittings: { letter: string; count: number }[]; people: 1 | 2; repeat?: number }[];
  choices: { atStep: number; options: string[] }[];
  unread?: string[];
};
