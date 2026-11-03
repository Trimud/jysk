// Every JYSK row must turn into a guide that draws: npm run jysk:check (exits 1 on any failure)
import { JYSK_ROWS } from "@/data/jysk-rows";
import { decodeRows } from "@/lib/ikea";
import { baseSlug, catalogSpec } from "@/lib/catalog";
import { buildPlan } from "@/lib/plan";

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
if (bad) process.exit(1);
