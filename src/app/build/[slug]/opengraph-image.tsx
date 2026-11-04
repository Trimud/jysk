import { OG_SIZE } from "@/lib/og/card";
import { guideImage } from "@/lib/og/guide";

// ponytail: one alt for every guide. generateImageMetadata would name the product, but it makes the route
// prerendered, and the drawing's file read then fails under Cache Components in production
export const alt = "A JYSK assembly guide on assemble.help: the product drawn in 3D, step by step";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  return guideImage(decodeURIComponent((await params).slug));
}
