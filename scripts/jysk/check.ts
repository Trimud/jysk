// Every JYSK row must turn into a guide that draws: npm run jysk:check (exits 1 on any failure), then npm run qa:overlaps checks their models
import { JYSK_ROWS } from "@/data/jysk-rows";
import { decodeRows } from "@/lib/ikea";
import { baseSlug, catalogSpec } from "@/lib/catalog";
import { buildPlan } from "@/lib/plan";
import { NODES } from "@/lib/categories";
import { readFileSync } from "node:fs";

let bad = 0;
for (const r of decodeRows(JYSK_ROWS)) {
  const slug = r.slug ?? baseSlug(r.name, r.variant);
  try {
    const spec = catalogSpec(slug);
    if (!spec) throw new Error("not in the catalog");
    const plan = buildPlan(spec);
    if (!plan.steps.length) throw new Error("no steps");
    console.log(`ok   ${slug}: ${plan.steps.length} steps, ${plan.spec.archetype}`);
  } catch (e) {
    bad++;
    console.log(`FAIL ${slug}: ${(e as Error).message}`);
  }
}
// every category sits at JYSK's own address for it: one JYSK product page lives under it
const range = readFileSync(new URL("range.txt", import.meta.url), "utf8");
for (const n of NODES) {
  if (range.includes("jysk.co.uk" + n.href + "/")) continue;
  bad++;
  console.log(`FAIL category ${n.label}: jysk.co.uk${n.href} is not a JYSK address (add its slug to SLUG in src/lib/categories.ts)`);
}
if (bad) process.exit(1);
