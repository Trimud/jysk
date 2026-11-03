import { Suspense } from "react";
import type { Metadata } from "next";
import GuideApp from "@/components/guide/GuideApp";
import { catalogSpec } from "@/lib/catalog";
import { buildPlan } from "@/lib/plan";
import { TOOL_INFO } from "@/components/art/Tools";
import { SITE_URL } from "@/lib/site";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (slug.startsWith("scan-")) return { title: "Scanned guide", robots: { index: false } };
  const s = catalogSpec(decodeURIComponent(slug));
  const name = s ? `${s.name} ${s.variant.toLowerCase()}` : decodeURIComponent(slug).replace(/-/g, " ").toUpperCase();
  // the article number is on the box and on JYSK's page: people search by it
  const skus = s?.colours?.map((c) => c.sku) ?? [];
  const title = `${name} assembly guide${skus[0] ? `, JYSK ${skus[0]}` : ""}`;
  const description = s
    ? `How to assemble the JYSK ${s.name} ${s.variant.toLowerCase()}, one step at a time in 3D: every panel, screw and tool, about ${s.minutes} minutes${s.people === 2 ? " with two people" : ""}.${skus.length ? ` Article ${skus.join(", ")}.` : ""}`
    : `Assemble ${name} step by step in 3D, with the parts, screws and tools for each step.`;
  // a guide that is the same product as another one goes by that one's address
  const url = `/build/${s?.slug ?? slug}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: "article", siteName: "Monta", title, description, url },
    twitter: { card: "summary_large_image", title, description },
    // drafts for names we don't know shouldn't fill search results
    robots: s ? undefined : { index: false },
  };
}

export default function Page(props: Props) {
  return (
    <Suspense fallback={<div className="guide shell" />}>
      <Inner {...props} />
    </Suspense>
  );
}

async function Inner({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 80) : undefined;
  const step = typeof sp.step === "string" ? Number(sp.step) : undefined;
  const kind = typeof sp.kind === "string" ? sp.kind : undefined;
  const s = catalogSpec(decodeURIComponent(slug));
  return (
    <>
      {s && <HowTo slug={s.slug ?? slug} spec={s} />}
      <GuideApp slug={decodeURIComponent(slug)} query={q} kind={kind} step={step && step > 0 ? Math.floor(step) : undefined} />
    </>
  );
}

/** The guide as schema.org HowTo, so search engines and answer engines can quote its steps and tools. */
function HowTo({ slug, spec }: Readonly<{ slug: string; spec: NonNullable<ReturnType<typeof catalogSpec>> }>) {
  const plan = buildPlan(spec);
  const url = `${SITE_URL}/build/${slug}`;
  const ld = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: `How to assemble the JYSK ${spec.name} ${spec.variant.toLowerCase()}`,
    url,
    totalTime: `PT${spec.minutes}M`,
    tool: plan.tools.filter((t) => !t.optional).map((t) => ({ "@type": "HowToTool", name: TOOL_INFO[t.id].name })),
    // ?step= counts from 1, like the guide's own step numbers
    step: plan.steps.map((st, i) => ({ "@type": "HowToStep", position: i + 1, name: st.title, ...(st.detail ? { text: st.detail } : {}), url: `${url}?step=${i + 1}` })),
    ...(spec.colours?.length ? { about: { "@type": "Product", name: `JYSK ${spec.name} ${spec.variant}`, brand: { "@type": "Brand", name: "JYSK" }, sku: spec.colours.map((c) => c.sku) } } : {}),
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />;
}
