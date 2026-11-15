"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Plan, ProductSpec } from "@/lib/types";
import { buildPlan, repick } from "@/lib/plan";
import { stepContents, totals } from "@/lib/plan/contents";
import { cachedSpec, getPref, loadProgress, setPref } from "@/lib/store";
import { useMounted } from "@/lib/useMounted";
import Thumb from "../Thumb";
import StageView, { type StageHandle } from "../StageView";
import type { StageMode } from "@/engine/stage";
import { LogoMark } from "../Logo";
import { HwArt } from "../art/Hardware";
import { TOOL_INFO, ToolArt } from "../art/Tools";
import { IArrowLeft, IPeople, IPrint } from "../art/Icons";
import { fmtMin } from "./CoverPanel";
import { LayoutPick } from "./StepPanel";
import { SITE_URL } from "@/lib/site";

const PER_PAGE = 6;
/** How long the cover stays opened after a layout is picked, before it closes again. */
const SWING_MS = 3000;
const HERO: StageMode = { kind: "assembled" };

/** The whole guide on A4: what's in the box first, then six steps to a page, like the paper manual. `spec`: the catalog guide as the server read it, its recipe included. */
export default function PrintGuide({ slug, spec: served }: Readonly<{ slug: string; spec: ProductSpec | null }>) {
  const mounted = useMounted();
  // the manual's layouts picked for this product, shared with the guide (GuideApp keeps them under the same key)
  const [picked, setPicked] = useState<string | null>(null);
  const layout = picked ?? (mounted ? getPref<string | null>(`layout:${slug}`, null) : null);
  const plan = useMemo(() => {
    const spec = served ?? (mounted ? (cachedSpec(slug) ?? loadProgress(slug)?.spec ?? null) : null);
    if (!spec) return null;
    try {
      return buildPlan(layout ? { ...spec, slug, layout } : { ...spec, slug });
    } catch {
      return null;
    }
  }, [served, slug, mounted, layout]);
  const pick = (id: string) => {
    const next = repick(plan!, id);
    setPref(`layout:${slug}`, next);
    setPicked(next);
  };

  if (!plan)
    return (
      <div className="print-doc">
        <div className="print-bar">
          <Link href={`/build/${slug}`} className="btn ghost">
            <IArrowLeft size={18} /> Open the guide first
          </Link>
        </div>
      </div>
    );
  // keyed by the picks: a new pick redraws every step, counts them again and swings the cover once more
  return <Doc key={plan.spec.layout ?? ""} plan={plan} slug={slug} swing={picked !== null} onLayout={pick} />;
}

function Doc({ plan, slug, swing, onLayout }: Readonly<{ plan: Plan; slug: string; swing: boolean; onLayout: (id: string) => void }>) {
  const s = plan.spec;
  const [live, setLive] = useState<StageHandle | null>(null);
  const [swung, setSwung] = useState(false);
  const t = totals(plan);
  const root = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(0);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const count = () => setReady(el.querySelectorAll(".print-step .thumb.ready").length);
    const mo = new MutationObserver(count);
    mo.observe(el, { subtree: true, attributes: true, attributeFilter: ["class"] });
    count();
    return () => mo.disconnect();
  }, []);
  const pages: number[][] = [];
  for (let i = 0; i < plan.steps.length; i += PER_PAGE) pages.push(plan.steps.slice(i, i + PER_PAGE).map((_, j) => i + j));
  const total = plan.steps.length;
  const done = ready >= total;
  // the live cover comes in once the step drawings are done (they share its thread and would starve it), swings open,
  // closes after SWING_MS and goes, leaving the still drawing under it
  useEffect(() => {
    if (!live) return;
    live.openAll(true);
    const close = setTimeout(() => live.openAll(false), SWING_MS);
    const gone = setTimeout(() => setSwung(true), SWING_MS + 600);
    return () => {
      clearTimeout(close);
      clearTimeout(gone);
    };
  }, [live]);
  const tools = plan.tools.filter((x) => !x.included);
  const url = `${SITE_URL.replace(/^https?:\/\//, "")}/build/${slug}`;
  const id = "print:" + s.name + s.variant + (s.layout ?? "");

  return (
    <div className="print-doc" ref={root}>
      <div className="print-bar">
        <Link href={`/build/${slug}`} className="btn round small" aria-label="Back to the guide">
          <IArrowLeft size={18} />
        </Link>
        <span className="print-status">{done ? `${pages.length + 1} pages, ready to print` : `Drawing step ${Math.min(total, ready + 1)} of ${total}`}</span>
        <button className="btn primary" onClick={() => window.print()} disabled={!done}>
          <IPrint size={18} /> Print
        </button>
      </div>
      {plan.layouts?.map((c) => (
        <div key={c.step} className="print-layouts">
          <span className="print-status">The manual offers a choice at step {c.step + 1}. Print it for:</span>
          <LayoutPick choice={c} onPick={onLayout} label={`Layout at step ${c.step + 1}`} />
        </div>
      ))}

      <section className="print-page cover-page">
        <header className="pp-head">
          <LogoMark size={28} />
          <span>Assembly guide</span>
        </header>
        <h1>{s.name}</h1>
        <p className="pp-variant">{s.variant}</p>
        {plan.approximate === "unchecked" && <p className="pp-approx">Approximate guide: drawn from JYSK&apos;s manual but not yet checked against it, so a part or step may still differ. Follow the paper manual where they do.</p>}
        {plan.approximate === "typical" && <p className="pp-approx">Approximate guide: not yet drawn from JYSK&apos;s manual, so your parts and steps may differ. Follow the paper manual where they do.</p>}
        <p className="pp-facts">
          {fmtMin(s.minutes)} &middot; {s.people === 2 ? "two people" : "one person"} &middot; {total} steps &middot; {t.panels} panels &middot; {t.fittings} fittings
        </p>
        <div className="pp-hero">
          <Thumb id={id} plan={plan} mode={HERO} w={640} h={420} />
          {/* a layout just picked here: the piece swings open to show what changed inside, then closes (on screen only) */}
          {swing && done && !swung && (
            <StageView
              plan={plan}
              mode={HERO}
              options={{ interactive: false, labels: false }}
              className="pp-live"
              onReady={setLive}
            />
          )}
        </div>
        {tools.length > 0 && (
          <>
            <h2>Tools</h2>
            <ul className="pp-tools">
              {tools.map((x) => (
                <li key={x.id}>
                  <ToolArt id={x.id} size={44} />
                  <span>
                    {TOOL_INFO[x.id].name}
                    {x.optional ? " (nice to have)" : ""}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
        <div className="pp-cols">
          <div>
            <h2>Panels</h2>
            <ul className="pp-parts">
              {plan.parts
                .filter((p) => !p.extra)
                .map((p) => (
                  <li key={p.id}>
                    <b className="pp-label">{p.label}</b>
                    <span>{p.name}</span>
                    <em>{p.qty}&times;</em>
                  </li>
                ))}
            </ul>
          </div>
          <div>
            <h2>Fittings</h2>
            <ul className="pp-hw">
              {plan.hardware.map((h) => (
                <li key={h.id}>
                  <span className="pp-hw-art">
                    <HwArt kind={h.kind} len={h.len} dia={h.dia} form={h.form} drive={h.drive} fit={36} />
                  </span>
                  <span>
                    {h.name} <small>{h.spec}</small>
                    {h.notIncluded ? <small> (not in the box)</small> : null}
                  </span>
                  <em>{h.qty}&times;</em>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <footer className="pp-foot">
          <span>Follow it in 3D, read out loud: {url}</span>
          <span>Not affiliated with JYSK. Check each step against the paper manual.</span>
        </footer>
      </section>

      {pages.map((idx, p) => (
        <section key={p} className="print-page steps-page">
          <div className="pp-grid">
            {idx.map((i) => {
              const st = plan.steps[i];
              const c = stepContents(plan, i);
              const choice = plan.layouts?.find((l) => l.step === i);
              const chosen = choice?.options.find((o) => o.id === choice.pick);
              return (
                <article key={i} className="print-step">
                  <div className="ps-top">
                    <b className="ps-n">{i + 1}</b>
                    {c.hardware.length > 0 && (
                      <span className="ps-hw">
                        {c.hardware.slice(0, 4).map(({ type, count }) => (
                          <span key={type.id}>
                            <HwArt kind={type.kind} len={type.len} dia={type.dia} form={type.form} drive={type.drive} fit={26} />
                            <b>{count}&times;</b>
                          </span>
                        ))}
                      </span>
                    )}
                    {st.people === 2 && (
                      <span className="ps-two" title="Two people">
                        <IPeople size={18} />
                      </span>
                    )}
                  </div>
                  <Thumb id={id} plan={plan} mode={{ kind: "step", index: i }} w={520} h={360} className="ps-art" />
                  <p className="ps-title">
                    {st.title}
                    {st.repeat && st.repeat > 1 ? ` (do this ${st.repeat} times)` : ""}
                  </p>
                  {chosen && (
                    <p className="ps-layout">
                      Printed for {chosen.id}: {chosen.label}. Also possible:{" "}
                      {choice!.options
                        .filter((o) => o !== chosen)
                        .map((o) => `${o.id}: ${o.label}`)
                        .join("; ")}
                      .
                    </p>
                  )}
                </article>
              );
            })}
          </div>
          <footer className="pp-foot">
            <span>
              {s.name}, {s.variant}
            </span>
            <span>
              {p + 2} / {pages.length + 1}
            </span>
          </footer>
        </section>
      ))}
    </div>
  );
}
