"use client";

import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import type { Plan, WarnId } from "@/lib/types";
import { stepContents, tipFor } from "@/lib/plan/contents";
import { HwArt } from "../art/Hardware";
import { ToolArt, TOOL_INFO } from "../art/Tools";
import { IArrowLeft, IArrowRight, ICheck, IClock, IClose, IMic, ISparkle, WarnIcon, WARN_TEXT } from "../art/Icons";
import { TwoPeople } from "../art/Figure";
import Thumb from "../Thumb";
import { dims } from "./PartsPanel";
import { getPref, setPref } from "@/lib/store";

/** One of the manual's either/or choices (Plan.layouts) as buttons, the picked one on. */
export function LayoutPick({ choice, onPick, label = "Layout" }: Readonly<{ choice: NonNullable<Plan["layouts"]>[number]; onPick: (id: string) => void; label?: string }>) {
  return (
    <div className="layout-pick" role="radiogroup" aria-label={label}>
      {choice.options.map((o) => {
        const on = choice.pick === o.id;
        return (
          <button key={o.id} role="radio" aria-checked={on} className={"layout-opt" + (on ? " on" : "")} onClick={() => onPick(o.id)}>
            <b>{o.id}</b>
            <span>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function minutesLeft(plan: Plan, index: number) {
  return plan.steps.slice(index).reduce((s, x) => s + x.minutes, 0);
}

export default function StepPanel({
  plan,
  index,
  dir,
  onNext,
  onBack,
  onHover,
  onLayout,
  offer,
}: {
  plan: Plan;
  index: number;
  dir: number;
  onNext: () => void;
  onBack: () => void;
  onHover: (ids: string[] | null) => void;
  /** Picks one of the manual's layouts (Plan.layouts), on the step that offers them. */
  onLayout?: (id: string) => void;
  /** Invite to turn voice on, while it is off. */
  offer?: { again: boolean; listen: boolean; onStart: () => void; onDismiss: () => void } | null;
}) {
  const s = plan.steps[index];
  const c = stepContents(plan, index);
  const last = index === plan.steps.length - 1;
  const tip = tipFor(plan, index);
  const isBig = (w: WarnId) => w === "two" || w === "tip" || w === "wall";
  const big = s.warnings.filter((w) => isBig(w) && !(w === "wall" && s.warnings.includes("tip")));
  const small = s.warnings.filter((w) => !isBig(w));
  const next = plan.steps[index + 1];
  const twoAhead = s.people === 1 ? plan.steps.slice(index + 1, index + 3).findIndex((x) => x.people === 2) : -1;
  const id = plan.spec.name + plan.spec.variant + (plan.spec.layout ?? "");
  const choice = plan.layouts?.find((c) => c.step === index);
  const hasNeeds = c.parts.length + c.hardware.length + s.tools.length > 0;
  const left = minutesLeft(plan, index);
  // a bigger drawing of a "You need" row: on hover with a mouse, on tap on a touch screen (tap again or elsewhere to close)
  const [zoom, setZoom] = useState<Zoom | null>(null);
  const closeZoom = () => {
    if (zoom?.ids) onHover(null);
    setZoom(null);
  };
  const openZoom = (el: HTMLElement, ids: string[] | null, name: string, art: ReactNode) => {
    if (ids) onHover(ids);
    const r = el.getBoundingClientRect();
    // beside the whole panel, not just the row
    const pane = el.closest(".pane")?.getBoundingClientRect() ?? r;
    setZoom({ index, ids, rowTop: r.top, rowBottom: r.bottom, left: pane.left, right: pane.right, art, name });
  };
  const mouse = () => matchMedia("(hover: hover)").matches;
  const zoomRow = (ids: string[] | null, name: string, art: ReactNode) => ({
    onMouseEnter: (e: MouseEvent<HTMLLIElement>) => (mouse() ? openZoom(e.currentTarget, ids, name, art) : ids && onHover(ids)),
    onMouseLeave: () => (mouse() ? closeZoom() : !zoom && ids && onHover(null)),
    onClick: (e: MouseEvent<HTMLLIElement>) => {
      if (mouse()) return;
      if (zoom?.index === index && zoom.name === name) closeZoom();
      else openZoom(e.currentTarget, ids, name, art);
    },
  });
  useEffect(() => {
    if (!zoom) return;
    const away = (e: PointerEvent) => !(e.target as Element)?.closest?.(".needs li") && closeZoom();
    document.addEventListener("pointerdown", away, true);
    return () => document.removeEventListener("pointerdown", away, true);
  });

  return (
    <div className="pane step-pane">
      <div className="pane-scroll" onScroll={() => zoom && closeZoom()}>
        {offer && (
          <div className="voice-offer">
            <div className="voice-offer-text">
              <b>
                {offer.again ? (
                  "Turn voice back on?"
                ) : (
                  <>
                    Hands full?<span className="vo-more"> Turn on voice</span>
                  </>
                )}
              </b>
              <span>{offer.listen ? "Each step is read out loud. Say “next” to move on." : "Each step is read out loud. Tap done to move on."}</span>
            </div>
            <button className="btn voice-offer-go" onClick={offer.onStart}>
              <IMic size={17} />
              Turn on
            </button>
            <button className="voice-offer-x" onClick={offer.onDismiss} aria-label="Not now">
              <IClose size={16} />
            </button>
          </div>
        )}
        <motion.div key={index} initial={{ opacity: 0, x: 22 * dir }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
          <header className="pane-head">
            <div className="step-meta">
              <span className="eyebrow">
                Step {index + 1} of {plan.steps.length}
              </span>
              <span className="time-pill" title="Time left for the whole build">
                <IClock size={14} /> {left < 60 ? `${left} min left` : `${Math.round(left / 6) / 10} h left`}
              </span>
            </div>
            <h2 className="step-title">{s.title}</h2>
            {s.detail && <p className="sub">{s.detail}</p>}
            {choice && onLayout && <LayoutPick choice={choice} onPick={onLayout} />}
          </header>

          {s.repeat && s.repeat > 1 && (
            <div className="callout repeat">
              <span className="repeat-badge">{s.repeat}&times;</span>
              <span>
                Do this for all {s.repeat} {plan.spec.archetype === "drawers" ? "drawers" : "of them"}. Counts below are for one.
              </span>
            </div>
          )}

          {big.map((w) => (
            <div key={w} className={"callout warn " + w}>
              {w === "two" ? <TwoPeople size={36} /> : <WarnIcon id={w} size={36} />}
              <div>
                <b>{w === "two" ? "Grab a second person" : w === "tip" ? "This stops it tipping over" : "You'll need to drill"}</b>
                <span>{w === "two" ? "It's heavy or awkward for one." : w === "tip" ? "Kids climb. Always fix it to the wall." : "The screws and plugs for your wall aren't in the box."}</span>
              </div>
            </div>
          ))}

          {hasNeeds && (
            <>
              <h3 className="section-title">You need</h3>
              <ul className="needs">
                {c.parts.map(({ type, count }) => (
                  <li key={type.id} {...zoomRow([type.id], `${type.label} ${type.name}`, <Thumb id={id} plan={plan} mode={{ kind: "part", ref: type.id }} w={240} h={170} />)}>
                    <Thumb id={id} plan={plan} mode={{ kind: "part", ref: type.id }} w={96} h={68} className="need-thumb" />
                    <span className="letter sm">{type.label}</span>
                    <span className="need-name">
                      {type.name}
                      <small>{dims(type.size, true)}</small>
                    </span>
                    <span className="need-qty">{count}&times;</span>
                  </li>
                ))}
                {c.hardware.map(({ type, count }) => {
                  // the pack's total helps tell near-identical sizes apart (a bag of 8 against one of 24)
                  const inBox = !type.notIncluded && `${type.qty} in the box`;
                  const note = type.spec && inBox ? `${type.spec} (${inBox})` : type.spec || inBox;
                  const art = <HwArt kind={type.kind} len={type.len} dia={type.dia} form={type.form} drive={type.drive} fit={150} />;
                  return (
                    <li key={type.id} {...zoomRow([type.id], type.name, art)}>
                      <span className="need-art">
                        <HwArt kind={type.kind} len={type.len} dia={type.dia} form={type.form} drive={type.drive} fit={40} />
                      </span>
                      <span className="need-name">
                        {type.notIncluded ? (type.kind === "plug" ? "Wall plug" : "Wall screw") : type.name}
                        {note && <small>{note}</small>}
                      </span>
                      <span className="need-qty">{count}&times;</span>
                    </li>
                  );
                })}
                {s.tools.map((t) => (
                  <li key={t} className="tool" {...zoomRow(null, TOOL_INFO[t].name, <ToolArt id={t} size={150} />)}>
                    <span className="need-art">
                      <ToolArt id={t} size={40} />
                    </span>
                    <span className="need-name">{TOOL_INFO[t].name}</span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {small.length > 0 && (
            <div className="warn-row">
              {small.map((w) => (
                <span key={w} className="warn-chip">
                  <WarnIcon id={w} size={24} />
                  {WARN_TEXT[w]}
                </span>
              ))}
            </div>
          )}

          {tip && (
            <div className="callout tip">
              <ISparkle size={18} />
              <span>{tip}</span>
            </div>
          )}

          {twoAhead >= 0 && (
            <p className="heads-up">
              <TwoPeople size={22} /> Heads up: step {index + 2 + twoAhead} needs a second pair of hands.
            </p>
          )}

          {next ? (
            <button className="upnext" onClick={onNext}>
              <span className="upnext-label">Up next</span>
              <span className="upnext-body">
                <span className="upnext-text">
                  <b>{index + 2}</b>
                  <span>{next.title}</span>
                </span>
                <IArrowRight size={18} />
              </span>
            </button>
          ) : (
            <div className="upnext final">
              <span className="upnext-label">Last step</span>
              <span className="upnext-body">
                <span className="upnext-text">
                  <span>After this one, it&apos;s built.</span>
                </span>
              </span>
            </div>
          )}
        </motion.div>
      </div>
      <div className="pane-foot">
        <KeysTip />
        <button className="btn round" onClick={onBack} aria-label="Previous step" title="Previous (left arrow)">
          <IArrowLeft />
        </button>
        <button className="btn primary big done-btn" onClick={onNext} title="Next (right arrow)">
          <span className="done-ico">
            <ICheck size={18} strokeWidth={2.8} />
          </span>
          <span className="done-label">{last ? "Done, finish up" : "Done, next step"}</span>
          <IArrowRight />
        </button>
      </div>
      {zoom?.index === index && createPortal(<NeedZoom {...zoom} />, document.body)}
    </div>
  );
}

type Zoom = { index: number; ids: string[] | null; rowTop: number; rowBottom: number; left: number; right: number; art: ReactNode; name: string };
const ZW = 264;
const ZH = 220;

/**
 * The zoom card: beside the panel on whichever side has room, level with the row. With no room either side (a phone,
 * where the panel is the full width) it sits centred above the row, or below it near the top of the screen.
 */
function NeedZoom({ rowTop, rowBottom, left: x0, right: x1, art, name }: Readonly<Zoom>) {
  const beside = x0 >= ZW + 20 || innerWidth - x1 >= ZW + 20;
  const left = !beside ? (innerWidth - ZW) / 2 : x0 >= ZW + 20 ? x0 - ZW - 12 : x1 + 12;
  const y = beside ? (rowTop + rowBottom) / 2 - ZH / 2 : rowTop - ZH - 8 >= 8 ? rowTop - ZH - 8 : rowBottom + 8;
  const top = Math.max(8, Math.min(y, innerHeight - ZH - 8));
  return (
    <div className="need-zoom" style={{ left, top, width: ZW, height: ZH }} aria-hidden>
      <div className="need-zoom-art">{art}</div>
      <span>{name}</span>
    </div>
  );
}

/**
 * The keyboard shortcuts, once: a tip over the Done button on a first visit
 * with a keyboard and mouse. Closing it, or using the keys, puts it away for good.
 */
function KeysTip() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (getPref("keysTip", false) || !matchMedia("(hover: hover) and (pointer: fine) and (min-width: 901px)").matches) return;
    const t = setTimeout(() => setShow(true), 1200);
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || !(e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === " " || e.key.toLowerCase() === "r")) return;
      const t = e.target as HTMLElement;
      if (t?.tagName === "INPUT" || t?.tagName === "TEXTAREA") return;
      setPref("keysTip", true);
      setShow(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, []);
  return (
    <AnimatePresence>
      {show && (
        <motion.div className="keys-tip" role="note" initial={{ opacity: 0, y: 8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 4 }} transition={{ type: "spring", stiffness: 460, damping: 32 }}>
          <span>
            <kbd aria-label="Left arrow">&larr;</kbd>
            <kbd aria-label="Right arrow">&rarr;</kbd> to move
          </span>
          <span>
            <kbd>Space</kbd> to pause
          </span>
          <span>
            <kbd>R</kbd> to replay
          </span>
          <button
            className="keys-tip-x"
            onClick={() => {
              setPref("keysTip", true);
              setShow(false);
            }}
            aria-label="Got it, hide this tip"
          >
            <IClose size={14} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
