/**
 * A reviewer signs off recipes: npm run manuals:approve -- --only <slug>[,<slug>...] --reviewer <name> [--visual <0..1>]
 * The only way `verified` is set by hand. Each recipe must still match its manual's facts (.qa/manuals/<slug>/facts.json,
 * qa:parity), or it is left as it is and the run exits 1. A recipe the run already verified gets the reviewer added; one
 * with no `verified` (written or fixed by hand) gets it, its `visual` the judge score given, else 1 (the reviewer's look).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { catalogSpec } from "@/lib/catalog";
import { withRecipe, type RecipeFile } from "@/lib/recipes";
import { buildPlan } from "@/lib/plan";
import { arg } from "../og/browser.mjs";
import type { ManualFacts } from "./types";
import { factsProblem, parity } from "../qa/parity-core";

const only: string | undefined = arg("--only");
const reviewer: string | undefined = arg("--reviewer")?.trim();
const visualArg: string | undefined = arg("--visual");
const visual = visualArg === undefined ? undefined : Number(visualArg);
if (!only || !reviewer || (visual !== undefined && !(visual >= 0 && visual <= 1)))
  throw new Error("usage: npm run manuals:approve -- --only <slug>[,<slug>...] --reviewer <name> [--visual <0..1>]");

let bad = 0;
for (const slug of only.split(",").filter(Boolean)) {
  const file = `src/data/recipes/${slug}.json`;
  const fail = (why: string) => (bad++, console.log(`fail ${slug}: ${why}`));
  if (!/^[\w-]+$/.test(slug)) {
    fail("not a plain slug");
    continue;
  }
  let recipe: RecipeFile, facts: ManualFacts;
  try {
    recipe = JSON.parse(readFileSync(file, "utf8")) as RecipeFile;
    facts = JSON.parse(readFileSync(`.qa/manuals/${slug}/facts.json`, "utf8")) as ManualFacts;
  } catch (e) {
    fail((e as Error).message);
    continue;
  }
  const problem = ![facts?.parts, facts?.fittings, facts?.steps, facts?.choices].every(Array.isArray) ? "facts.json is not a facts file" : factsProblem(facts);
  if (problem) {
    fail(problem);
    continue;
  }
  const spec = withRecipe(catalogSpec(slug));
  if (!spec) {
    fail("not in the catalog");
    continue;
  }
  const { failures } = parity(buildPlan(spec), facts);
  if (failures.length) {
    fail(`${failures.length} difference${failures.length > 1 ? "s" : ""} from its manual (npm run qa:parity -- --only ${slug})`);
    continue;
  }
  const at = new Date().toISOString().slice(0, 10);
  recipe.verified = { ...(recipe.verified ?? { at, model: recipe.model, parity: true, visual: visual ?? 1 }), ...(visual !== undefined ? { visual } : {}), reviewer };
  // only the verified line changes: a writer's compact layout is kept (it has no nested braces)
  const line = `"verified": ${JSON.stringify(recipe.verified)}`;
  const text = readFileSync(file, "utf8");
  const out = /"verified"\s*:\s*\{[^}]*\}/.test(text) ? text.replace(/"verified"\s*:\s*\{[^}]*\}/, line) : text.replace(/\s*\}\s*$/, `,\n  ${line}\n}\n`);
  if (JSON.stringify(JSON.parse(out)) !== JSON.stringify(recipe)) {
    fail("could not write verified in place");
    continue;
  }
  writeFileSync(file, out);
  console.log(`ok   ${slug} verified by ${reviewer}`);
}
if (bad) process.exit(1);
