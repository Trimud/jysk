import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { pageMeta } from "@/lib/site";
import { NODES, catNoun, nodeAt } from "@/lib/categories";
import Browse from "../browse/Browse";

/** A JYSK category at JYSK's own address (/bedroom/beds/childrens-beds), src/lib/categories.ts. */
type Props = { params: Promise<{ cat: string[] }> };

const at = (cat: string[]) => nodeAt("/" + cat.join("/"));

export function generateStaticParams() {
  return NODES.map((n) => ({ cat: n.href.slice(1).split("/") }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const n = at((await params).cat);
  if (!n) return {};
  const what = catNoun(n);
  const m = pageMeta(`JYSK ${what}: assembly guides`, `Step-by-step 3D assembly guides for JYSK ${what}: every panel, screw and tool, one step at a time.`, n.href);
  // the share card is its own route (src/app/share), as a catch-all segment can't hold an opengraph-image
  const images = [{ url: `/share${n.href}`, width: 1200, height: 630, alt: `JYSK ${what} assembly guides on assemble.help, drawn in 3D` }];
  return { ...m, openGraph: { ...m.openGraph, images }, twitter: { ...m.twitter, images } };
}

// every category is prerendered (generateStaticParams), so navigating between them is instant. params is read only to
// 404 an unknown one: a <Suspense> around that would show the browse page under a 404, so skip the dev check here
export const instant = false;

// any other address has no page (cacheComponents has no dynamicParams = false)
export default async function Page({ params }: Props) {
  const n = at((await params).cat);
  if (!n) notFound();
  return <Browse at={n.href} />;
}
