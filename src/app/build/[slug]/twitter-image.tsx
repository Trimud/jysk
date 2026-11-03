import { OG_SIZE } from "@/lib/og/card";
import { guideImage } from "@/lib/og/guide";

export const alt = "A JYSK assembly guide on assemble.help: the product drawn in 3D, step by step";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  return guideImage(decodeURIComponent((await params).slug));
}
