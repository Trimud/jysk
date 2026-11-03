import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import HeroStage from "@/components/home/HeroStage";
import { HeroSearch } from "@/components/home/HomeClient";
import Resume from "@/components/home/Resume";
import { Catalog } from "@/components/home/Sections";
import Compare from "@/components/home/Compare";
import { Figure } from "@/components/art/Figure";
import { ToolArt } from "@/components/art/Tools";
import { HwArt } from "@/components/art/Hardware";
import { IArrowOut, IArrowRight, IScan } from "@/components/art/Icons";
import { TogetherMark } from "@/components/art/Together";
import { PRODUCT_COUNT } from "@/lib/search";
import { AI_ENABLED, SCAN_ENABLED, SITE_URL } from "@/lib/site";

export const metadata: Metadata = { alternates: { canonical: "/" } };

// say plainly what this site is, and that it isn't JYSK
const SITE_LD = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "assemble.help",
  alternateName: "assemble.help: JYSK assembly guides",
  url: SITE_URL,
  description: "Free step-by-step 3D assembly guides for JYSK furniture. An independent project, not affiliated with JYSK.",
};

const QUICK: { slug: string; label: string }[] = [
  { slug: "4-drawer-chest-limfjorden-beige", label: "LIMFJORDEN chest" },
  { slug: "bed-frame-limfjorden-double-3-drawers-white", label: "LIMFJORDEN bed" },
  { slug: "desk-abbetved-48x120-light-oak-colour-white", label: "ABBETVED desk" },
];

export default function Home() {
  return (
    <div className="site">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(SITE_LD) }} />
      <SiteHeader />

      <section className="hero">
        <div className="hero-copy">
          {AI_ENABLED && (
          <a className="tg-pill" href="https://togetherai.link/" target="_blank" rel="noreferrer">
            <span className="tg-badge">
              <TogetherMark size={16} />
            </span>
            <span className="tg-text">
              Powered by <b>Together AI</b>
            </span>
            <IArrowOut size={14} className="tg-go" />
          </a>
          )}
          <h1>
            JYSK assembly,
            <br />
            step by step.
          </h1>
          <p className="lead">Type the name or article number from the box. Each step plays in 3D{AI_ENABLED ? " and is read out loud" : ""}, with the parts, screws and tools it needs.</p>
          <HeroSearch />
          {QUICK.length > 0 && (
          <div className="quick">
            <span>Try</span>
            {QUICK.map((q) => (
              <Link key={q.slug} href={`/build/${q.slug}`} className="chip">
                {q.label}
              </Link>
            ))}
          </div>
          )}
          <Resume />
          {SCAN_ENABLED && (
            <Link href="/scan" className="scan-link">
              <IScan size={17} />
              <span>
                Not from JYSK? <u>Scan its paper manual</u>
              </span>
            </Link>
          )}
        </div>
        <HeroStage />
      </section>

      <section className="how" id="how">
        <h2 className="sec-title">How it works</h2>
        <ol className="how-steps">
          <li>
            <div className="how-art">
              <svg viewBox="0 0 220 150" width="220" height="150" aria-hidden="true">
                <path d="M30 60 L110 84 L190 60 L190 128 L110 150 L30 128 Z" fill="#fff" stroke="var(--ink)" strokeWidth="2.4" strokeLinejoin="round" />
                <path d="M110 84 V150" stroke="var(--ink)" strokeWidth="2.2" />
                <path d="M30 60 L110 38 L190 60" fill="#f2f0eb" stroke="var(--ink)" strokeWidth="2.2" strokeLinejoin="round" />
                <g transform="translate(122 98) skewY(-15)">
                  <rect x="0" y="0" width="56" height="26" rx="3" fill="var(--accent)" stroke="var(--ink)" strokeWidth="2" />
                  <text x="28" y="18" textAnchor="middle" fontSize="12" fontWeight="800" fill="var(--ink)" fontFamily="var(--font)">
                    JENSLEV
                  </text>
                </g>
              </svg>
              <span className="how-fig">
                <Figure pose="point" size={84} />
              </span>
            </div>
            <h3>Type the name</h3>
            <p>It&apos;s the big word on the box label, like LIMFJORDEN, or the 7-digit article number, like 3670661.{SCAN_ENABLED ? " Or snap a photo of it." : ""}</p>
          </li>
          <li>
            <div className="how-art tools">
              <span style={{ transform: "rotate(-10deg)" }}>
                <ToolArt id="screwdriver" size={82} />
              </span>
              <span style={{ transform: "translateY(-10px)" }}>
                <ToolArt id="hammer" size={88} />
              </span>
              <span style={{ transform: "rotate(8deg)" }}>
                <ToolArt id="allen" size={72} />
              </span>
              <span className="how-hw">
                <HwArt kind="dowel" len={30} dia={8} fit={44} />
                <b>8&times;</b>
              </span>
            </div>
            <h3>Check tools and parts</h3>
            <p>One tap if everything&apos;s there. Missing a piece? We&apos;ll tell you what to do.</p>
          </li>
          <li>
            <div className="how-art step">
              <svg viewBox="0 0 200 140" width="200" height="140" aria-hidden="true">
                <path d="M30 96 L120 120 L176 96 L86 72 Z" fill="#fff" stroke="var(--ink)" strokeWidth="2.2" strokeLinejoin="round" />
                <path d="M30 96 V104 L120 128 V120 M120 128 L176 104 V96" fill="none" stroke="var(--ink)" strokeWidth="2.2" strokeLinejoin="round" />
                <g className="how-drop">
                  <path d="M92 18 L104 22 L104 82 L92 78 Z" fill="var(--accent-soft)" stroke="var(--ink)" strokeWidth="2.2" strokeLinejoin="round" />
                  <path d="M104 22 L150 8 L150 68 L104 82" fill="#fff" stroke="var(--ink)" strokeWidth="2.2" strokeLinejoin="round" />
                  <path d="M92 18 L138 4 L150 8" fill="none" stroke="var(--ink)" strokeWidth="2.2" strokeLinejoin="round" />
                </g>
                <path d="M70 26 v26 h-7 l11 13 l11 -13 h-7 v-26 z" fill="var(--ink)" stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
              </svg>
            </div>
            <h3>Follow each step</h3>
            <p>Every step plays in 3D, with each screw shown up close. Drag to see any side.</p>
          </li>
        </ol>
      </section>

      <section className="popular" id="popular">
        <div className="sec-head">
          <h2 className="sec-title">Popular builds</h2>
          <Link href="/browse" className="sec-link">
            All {PRODUCT_COUNT.toLocaleString("en-US")} products <IArrowRight size={15} />
          </Link>
        </div>
        <Catalog limit={9} />
      </section>

      <Compare />

      <SiteFooter />
    </div>
  );
}
