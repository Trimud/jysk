/**
 * Checks guides against the facts a reader took from their manuals: npm run qa:parity -- --only <slug>[,<slug>...] [--facts <file>]
 * Reads .qa/manuals/<slug>/facts.json (--facts names another file in that folder, or a path), builds the guide and lists
 * every way it differs (parity-core.ts): parts, fittings, steps (the copies each brings in, where its fittings go, how
 * the piece lies), either/or choices. Exits 1 on any, or on a missing facts file.
 */
import { existsSync, readFileSync } from "node:fs";
import { catalogSpec } from "@/lib/catalog";
import { withRecipe } from "@/lib/recipes";
import { buildPlan } from "@/lib/plan";
import { arg } from "../og/browser.mjs";
import type { ManualFacts } from "../manuals/types";
import { parity, stepsProblem } from "./parity-core";

const only: string | undefined = arg("--only");
if (!only) throw new Error("usage: npm run qa:parity -- --only <slug>[,<slug>...] [--facts <file>]");
const file: string | undefined = arg("--facts");
let bad = 0;
for (const slug of only.split(",").filter(Boolean)) {
  console.log(`\n${slug}`);
  const path = file?.includes("/") ? file : `.qa/manuals/${slug}/${file ?? "facts.json"}`;
  const spec = withRecipe(catalogSpec(slug));
  if (!spec) {
    bad++;
    console.log("fail not in the catalog");
    continue;
  }
  if (!existsSync(path)) {
    bad++;
    console.log(`fail no facts: run a manual reader first (${path})`);
    continue;
  }
  // written by a reader: its shape is checked before it's trusted
  let facts: ManualFacts;
  try {
    facts = JSON.parse(readFileSync(path, "utf8")) as ManualFacts;
  } catch (e) {
    bad++;
    console.log(`fail ${path} is not JSON: ${(e as Error).message}`);
    continue;
  }
  if (![facts?.parts, facts?.fittings, facts?.steps, facts?.choices].every(Array.isArray)) {
    bad++;
    console.log(`fail ${path} is not a facts file (parts, fittings, steps and choices lists)`);
    continue;
  }
  const problem = stepsProblem(facts);
  if (problem) {
    bad++;
    console.log(`fail ${path}: ${problem}`);
    continue;
  }
  const plan = buildPlan(spec);
  if (plan.approximate === "typical") console.log("note the guide is approximate (no family or recipe draws it from its manual yet)");
  if (plan.approximate === "unchecked") console.log("note the guide is approximate (drawn from its recipe, not yet verified)");
  if (facts.slug !== slug.split("@")[0]) console.log(`note the facts are for ${facts.slug}, not ${slug}`);
  const { failures, unread } = parity(plan, facts);
  for (const u of unread) console.log(`note unread: ${u}`);
  for (const f of failures) console.log(`FAIL ${f.kind}: ${f.detail}`);
  console.log(failures.length ? `${failures.length} difference${failures.length > 1 ? "s" : ""} from ${path}` : `ok   matches ${path}`);
  if (failures.length) bad++;
}
if (bad) process.exit(1);
