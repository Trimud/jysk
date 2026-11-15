/** Claude models a manual reader can run on. */
export type ModelId = "claude-haiku-5-5" | "claude-sonnet-5-5" | "claude-opus-5-5";

/** How the piece lies while you work: on_back is front up, face_down is back up; left and right as seen from the front. */
export type FactsPose = "upright" | "upside_down" | "on_back" | "face_down" | "on_left_side" | "on_right_side";

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
  /**
   * parts: the copies of each part the step brings in (a second side frame in step 3 is { label: "2", count: 1 } there).
   * fittings: into, the part labels they go into when the drawing shows it (one letter split across entries when it goes
   * into different parts). pose: how the piece lies while you work, as drawn (FACTS_POSE in scripts/qa/parity-core.ts).
   */
  steps: {
    n: number;
    parts: { label: string; count: number }[];
    fittings: { letter: string; count: number; into?: string[] }[];
    people: 1 | 2;
    pose?: FactsPose;
    repeat?: number;
  }[];
  choices: { atStep: number; options: string[] }[];
  unread?: string[];
};
