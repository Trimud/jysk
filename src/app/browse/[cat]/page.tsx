import type { Metadata } from "next";
import { pageMeta } from "@/lib/site";
import { notFound } from "next/navigation";
import { TABS, catNoun } from "@/lib/categories";
import Browse from "../Browse";

type Props = { params: Promise<{ cat: string }> };

export function generateStaticParams() {
  return TABS.map((c) => ({ cat: c.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { cat } = await params;
  const c = TABS.find((x) => x.id === cat);
  if (!c) return {};
  const what = catNoun(c);
  return pageMeta(
    `JYSK ${what}: assembly guides`,
    `Step-by-step 3D assembly guides for JYSK ${what}: every panel, screw and tool, one step at a time.`,
    `/browse/${c.id}`,
  );
}

// every tab is prerendered (generateStaticParams), so navigating between them is instant. params is read only to
// 404 an unknown one: a <Suspense> around that would show the browse page under a 404, so skip the dev check here
export const instant = false;

// a category that isn't a tab has no page (cacheComponents has no dynamicParams = false)
export default async function Page({ params }: Props) {
  const { cat } = await params;
  if (!TABS.some((c) => c.id === cat)) notFound();
  return <Browse />;
}
