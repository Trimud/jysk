import { PRODUCTS, catalogSpec } from "@/lib/catalog";
import { familyOf } from "@/lib/plan/families/family";
import { KIND_ARCH } from "@/lib/products";

/** Dev only: what scripts/og/render.mjs should draw: every kind, then every catalog product with its family (for scripts/qa/snapshots.mjs). */
export async function GET() {
  if (process.env.NODE_ENV === "production") return new Response(null, { status: 404 });
  const picks = PRODUCTS.map((p) => ({ slug: p.slug, family: familyOf(catalogSpec(p.slug)!) }));
  return Response.json([...Object.keys(KIND_ARCH).map((kind) => ({ kind })), ...picks]);
}
