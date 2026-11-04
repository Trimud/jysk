import { notFound } from "next/navigation";
import { drawing, pageCard } from "@/lib/og/card";
import { nodeAt } from "@/lib/categories";

/**
 * A category's share card, /share/bedroom/beds for /bedroom/beds. A route of its own because Next has no
 * opengraph-image under a catch-all segment; the page names it in its metadata.
 */
export async function GET(_: Request, { params }: { params: Promise<{ cat: string[] }> }) {
  const n = nodeAt("/" + (await params).cat.join("/"));
  if (!n) notFound();
  // only the category's own guides: a generic drawing would promise a guide we don't have. The card shows four.
  const art = (await Promise.all(n.guides.slice(0, 12).map((e) => drawing(e.slug)))).filter((d): d is string => !!d);
  const k = n.guides.length;
  return pageCard({ kicker: "JYSK assembly guides", title: n.label, line: `${k} ${k === 1 ? "guide" : "guides"}, every step in 3D`, cta: k === 1 ? "Open the guide" : "See the guides", art });
}
