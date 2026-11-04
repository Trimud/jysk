import { Suspense } from "react";
import type { Metadata } from "next";
import { pageMeta } from "@/lib/site";
import { catalogSpec } from "@/lib/catalog";
import PrintGuide from "@/components/guide/PrintGuide";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const s = catalogSpec(decodeURIComponent((await params).slug));
  const slug = decodeURIComponent((await params).slug);
  const name = s ? `${s.name} ${s.variant.toLowerCase()}` : "assembly guide";
  const m = pageMeta(`Print: ${name}`, `The ${name} assembly guide, every step on paper.`, `/build/${slug}`, { robots: { index: false } });
  // file images don't reach a child route that sets its own openGraph: borrow the guide's card
  return { ...m, openGraph: { ...m.openGraph, images: `/build/${slug}/opengraph-image` } };
}

export default function Page({ params }: Props) {
  return (
    <Suspense fallback={<div className="print-doc" />}>
      <Inner params={params} />
    </Suspense>
  );
}

async function Inner({ params }: Props) {
  const { slug } = await params;
  return <PrintGuide slug={decodeURIComponent(slug)} />;
}
