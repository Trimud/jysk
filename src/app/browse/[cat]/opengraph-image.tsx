import { OG_SIZE, drawing, pageCard } from "@/lib/og/card";
import { PRODUCTS } from "@/lib/catalog";
import { TABS, catNoun, inCat } from "@/lib/categories";

export const size = OG_SIZE;
export const contentType = "image/png";

export function generateImageMetadata({ params }: { params: { cat: string } }) {
  const c = TABS.find((x) => x.id === params.cat);
  return [{ id: "card", size: OG_SIZE, contentType, alt: `JYSK ${c ? catNoun(c) : "furniture"} assembly guides on assemble.help, drawn in 3D` }];
}

export default async function Image({ params }: { params: Promise<{ cat: string }> }) {
  const { cat } = await params;
  const c = TABS.find((x) => x.id === cat) ?? TABS[0];
  const guides = PRODUCTS.filter((e) => inCat(e, c));
  // only the tab's own guides: a generic drawing would promise a guide we don't have
  const art = (await Promise.all(guides.map((e) => drawing(e.slug)))).filter((d): d is string => !!d);
  return pageCard({
    kicker: "JYSK assembly guides",
    title: c.label + (c.tag ? " furniture" : ""),
    line: `${guides.length} ${guides.length === 1 ? "guide" : "guides"}, every step in 3D`,
    art,
  });
}
