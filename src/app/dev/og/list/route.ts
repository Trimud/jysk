import { PRODUCTS, catalogSpec } from "@/lib/catalog";
import { buildPlan } from "@/lib/plan";
import { familyOf } from "@/lib/plan/families/family";
import { KIND_ARCH } from "@/lib/products";

/** Dev only: what scripts/og/render.mjs should draw: every kind, then every catalog product with its family (for scripts/qa/snapshots.mjs). */
export async function GET() {
  if (process.env.NODE_ENV === "production") return new Response(null, { status: 404 });
  // each product, then its manual's other layouts as "slug@B" (Plan.layouts), so the QA scripts draw and check them too
  const picks = PRODUCTS.flatMap((p) => {
    const spec = catalogSpec(p.slug)!;
    const family = familyOf(spec);
    // ponytail: one choice changed at a time ("slug@B", "slug@R"), not every combination
    const more = family ? (buildPlan(spec).layouts?.flatMap((c) => c.options.filter((o) => o.id !== c.pick)) ?? []) : [];
    return [{ slug: p.slug, family }, ...more.map((o) => ({ slug: `${p.slug}@${o.id}`, family }))];
  });
  return Response.json([...Object.keys(KIND_ARCH).map((kind) => ({ kind })), ...picks]);
}
