import { ImageResponse } from "next/og";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { spellOut } from "../shorthand";
import { TogetherStamp } from "./factory";
import { AI_ENABLED } from "../site";
import { RING, SOCKET, STEM } from "@/components/Logo";

/**
 * The share cards, in the site's own look: warm paper, ink type in the
 * display face, one yellow highlight, and the app's real line art.
 *
 * - The site card stacks the KALLAX booklet page behind the same step on
 *   Bygga (both captured from the home page's comparison, public/og/hero-*.png).
 * - A guide card lays the product on a white sheet that runs off the edge,
 *   drawn by the real engine (public/og/{slug}.png, scripts/og/render.mjs).
 */

export const OG_SIZE = { width: 1200, height: 630 };

const PAGE = "#edf1f6";
const INK = "#0f1c2e";
const INK_2 = "#2f3d52";
const ACCENT = "#bcd3f1";
const BRAND = "#1d4f91";
const ON_BRAND = "#dce6f3";
const PAD = 72;

// read once when the module loads, not per request: that keeps the site card static, so it is drawn at build time
const here = join(process.cwd(), "src/lib/og");
const FONTS = await Promise.all([
  readFile(join(here, "display-800.woff")).then((data) => ({ name: "Display", data, weight: 800 as const, style: "normal" as const })),
  readFile(join(here, "sans-500.woff")).then((data) => ({ name: "Sans", data, weight: 500 as const, style: "normal" as const })),
  readFile(join(here, "sans-700.woff")).then((data) => ({ name: "Sans", data, weight: 700 as const, style: "normal" as const })),
]);

/** A drawing from public/og as a data URI, or null. */
export async function drawing(name: string) {
  const file = join(process.cwd(), "public/og", `${name}.png`);
  if (!existsSync(file)) return null;
  return `data:image/png;base64,${(await readFile(file)).toString("base64")}`;
}

/** The logo: "assemble.help" in white on the blue block, its a the bolt (paths shared with the site's Logo). */
function Logo() {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", alignSelf: "flex-start", padding: "8px 15px 11px", borderRadius: 4, background: BRAND, color: "#fff", fontFamily: "Display", fontSize: 40, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1 }}>
      <svg viewBox="0 0 33 32" width={23} height={22.4} style={{ marginBottom: 4, marginRight: 1 }}>
        <path fillRule="evenodd" d={RING} fill="#fff" />
        <path d={STEM} fill="#fff" />
        <path d={SOCKET} fill="#fff" />
      </svg>
      <span>ssemble</span>
      <span style={{ color: ON_BRAND }}>.help</span>
    </div>
  );
}

/** The stamp, and the line that travels with every card: these guides are not JYSK's. */
function Powered() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 20 }}>
      {AI_ENABLED && (
      <div style={{ display: "flex", alignItems: "center", gap: 11, fontSize: 20, color: INK_2 }}>
        <span>Powered by</span>
        <TogetherStamp height={25} color={INK} />
      </div>
      )}
      <span style={{ fontSize: 15, color: INK_2 }}>Unofficial guide. Not affiliated with JYSK.</span>
    </div>
  );
}

/** Words with a yellow highlighter stroke behind their lower half, as in the footer credit. */
function Marked({ children, size }: { children: string; size: number }) {
  return (
    <div style={{ display: "flex", position: "relative", fontSize: size }}>
      <div style={{ position: "absolute", left: -size * 0.06, right: -size * 0.08, bottom: size * 0.1, height: size * 0.36, background: ACCENT, borderRadius: size * 0.06 }} />
      <span>{children}</span>
    </div>
  );
}

function render(node: React.ReactElement) {
  return new ImageResponse(node, { ...OG_SIZE, fonts: FONTS });
}

const HERO = await Promise.all([drawing("hero-bygga"), drawing("hero-paper")]);

export function siteCard() {
  const [front, back] = HERO;
  const H = 84;
  return render(
    <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: PAGE, fontFamily: "Sans", color: INK, overflow: "hidden" }}>
      {/* the booklet page, tilted back, and the same step on Bygga in front of it */}
      {back && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={back}
          alt=""
          width={480}
          height={419}
          style={{ position: "absolute", left: 706, top: 28, transform: "rotate(-6deg)", borderRadius: 22, boxShadow: "0 18px 40px rgba(40,34,20,0.10)" }}
        />
      )}
      {front && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={front}
          alt=""
          width={560}
          height={413}
          style={{ position: "absolute", left: 604, top: 176, transform: "rotate(3deg)", borderRadius: 24, boxShadow: "0 30px 70px rgba(30,26,16,0.20), 0 4px 14px rgba(30,26,16,0.08)" }}
        />
      )}
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 600, height: "100%", padding: `${PAD - 8}px 0 ${PAD - 12}px ${PAD}px` }}>
        <Logo />
        <div style={{ display: "flex", flexDirection: "column", fontFamily: "Display", fontWeight: 800, fontSize: H, lineHeight: 1, letterSpacing: "-0.045em" }}>
          <span>JYSK assembly,</span>
          <span style={{ marginTop: 4 }}>step by step.</span>
        </div>
        <Powered />
      </div>
    </div>,
  );
}

// rough advance widths of the display face's capitals, in em
const WIDE: Record<string, number> = { I: 0.3, J: 0.42, L: 0.52, F: 0.54, E: 0.56, M: 0.86, W: 0.95, N: 0.72, O: 0.7, Ö: 0.7, Q: 0.7, " ": 0.24, "/": 0.4 };
const NAME_W = 428;

/** The name as big as its longest line fits the column: KALLAX huge, LINNMON / ADILS on two lines. */
function nameSize(name: string) {
  const lines = name.includes(" / ") ? name.split(" / ").map((l, i, a) => (i < a.length - 1 ? l + " /" : l)) : name.split(/\s+/);
  const em = Math.max(...lines.map((l) => [...l.toUpperCase()].reduce((a, c) => a + (WIDE[c] ?? 0.64), 0)));
  // two lines of name leave room for the rest of the column
  return Math.max(56, Math.min(lines.length > 1 ? 80 : 118, Math.floor(NAME_W / em)));
}

/** The white sheet that runs off the card's right and bottom edges, as on a guide card. */
function Sheet({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        flex: 1,
        alignItems: "center",
        alignContent: "center",
        justifyContent: "center",
        margin: "28px -60px -60px 0",
        padding: "0 60px 60px 0",
        background: "#ffffff",
        borderRadius: "36px 0 0 0",
        boxShadow: "0 24px 60px rgba(30,26,16,0.12), 0 2px 8px rgba(30,26,16,0.05)",
      }}
    >
      {children}
    </div>
  );
}

/**
 * The card for a page that isn't one guide: a kicker, the page's words in the display face, and the
 * pictures it is about on the sheet (one large, or up to four in a grid). With no pictures the words take the width.
 */
export function pageCard(o: { kicker: string; title: string; line?: string; art?: string[] }) {
  const art = (o.art ?? []).slice(0, 4);
  const wide = art.length === 0;
  return render(
    <div style={{ width: "100%", height: "100%", display: "flex", background: PAGE, fontFamily: "Sans", color: INK, overflow: "hidden" }}>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: wide ? "100%" : 540, height: "100%", flex: "none", padding: `${PAD - 8}px ${wide ? PAD : 40}px ${PAD - 12}px ${PAD}px` }}>
        <Logo />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: 24, fontWeight: 700, color: INK_2 }}>{o.kicker}</span>
          <span style={{ display: "flex", flexWrap: "wrap", fontFamily: "Display", fontWeight: 800, fontSize: wide ? 96 : 72, lineHeight: 1.02, letterSpacing: "-0.045em", marginTop: 10 }}>{o.title}</span>
          {o.line && (
            <div style={{ display: "flex", marginTop: 22 }}>
              <span style={{ display: "flex", fontSize: 26, fontWeight: 700 }}>
                <Marked size={26}>{o.line}</Marked>
              </span>
            </div>
          )}
        </div>
        <Powered />
      </div>
      {!wide && (
        <Sheet>
          {art.map((src, i) => {
            // one fills the sheet, two stack, three or four share a grid
            const [w, h] = art.length === 1 ? [660, 578] : art.length === 2 ? [600, 280] : [300, 263];
            // eslint-disable-next-line @next/next/no-img-element
            return <img key={i} src={src} alt="" width={w} height={h} style={{ objectFit: "contain" }} />;
          })}
        </Sheet>
      )}
    </div>,
  );
}

export function guideCard(o: { name: string; variant: string; steps: number | null; art: string | null }) {
  const size = nameSize(o.name);
  const variant = spellOut(o.variant);
  return render(
    <div style={{ width: "100%", height: "100%", display: "flex", background: PAGE, fontFamily: "Sans", color: INK, overflow: "hidden" }}>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 540, height: "100%", flex: "none", padding: `${PAD - 8}px 40px ${PAD - 12}px ${PAD}px` }}>
        <Logo />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: 24, fontWeight: 700, color: INK_2 }}>Assembly guide</span>
          <span style={{ display: "flex", flexWrap: "wrap", fontFamily: "Display", fontWeight: 800, fontSize: size, lineHeight: 1.04, letterSpacing: "-0.045em", marginTop: 10 }}>{o.name}</span>
          <span style={{ fontSize: 30, fontWeight: 500, color: INK_2, marginTop: 16, lineHeight: 1.25, maxWidth: 420 }}>{variant}</span>
          <div style={{ display: "flex", marginTop: 26 }}>
            <span style={{ display: "flex", fontSize: 26, fontWeight: 700 }}>
              <Marked size={26}>{o.steps ? `${o.steps} steps, in 3D` : "Every step, in 3D"}</Marked>
            </span>
          </div>
        </div>
        <Powered />
      </div>
      {/* the product on a sheet of white that runs off the card */}
      <Sheet>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {o.art && <img src={o.art} alt="" width={660} height={578} style={{ objectFit: "contain" }} />}
      </Sheet>
    </div>,
  );
}
