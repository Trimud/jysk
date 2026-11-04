import { OG_SIZE } from "@/lib/og/card";
import { guideImage } from "@/lib/og/guide";
import { catalogSpec } from "@/lib/catalog";

export const size = OG_SIZE;
export const contentType = "image/png";

// one image, its alt naming the product (a static alt would read the same on every guide)
export function generateImageMetadata({ params }: { params: { slug: string } }) {
  const s = catalogSpec(decodeURIComponent(params.slug));
  const what = s ? `the JYSK ${s.name} ${s.variant.toLowerCase()}` : "a JYSK product";
  return [{ id: "card", size: OG_SIZE, contentType, alt: `Assembly guide for ${what} on assemble.help, drawn in 3D, step by step` }];
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  return guideImage(decodeURIComponent((await params).slug));
}
