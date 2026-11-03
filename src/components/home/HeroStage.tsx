"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import StageView from "../StageView";
import { catalogSpec } from "@/lib/catalog";
import { buildPlan } from "@/lib/plan";
import type { StageMode } from "@/engine/stage";
import { IArrowRight } from "../art/Icons";

// ponytail: emptied in Phase 0; the Phase 2 pilot picks JYSK products to show here
const SHOW: string[] = [];
const HOLD = 3200;

/** A manual page that keeps building furniture by itself. Tabs pick what it builds. */
export default function HeroStage() {
  const [i, setI] = useState(0);
  const plans = useMemo(() => SHOW.flatMap((s) => {
    const spec = catalogSpec(s);
    return spec ? [buildPlan(spec)] : [];
  }), []);
  const plan = plans[i];
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mode: StageMode = useMemo(() => ({ kind: "intro", dims: true }), []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const pick = (k: number) => {
    if (timer.current) clearTimeout(timer.current);
    setI(k);
  };

  if (!plan) return null;

  return (
    <div className="hero-visual">
      <div className="hero-sheet">
        <StageView
          key={i}
          plan={plan}
          mode={mode}
          options={{ interactive: false, labels: false, margins: { t: 20, r: 20, b: 90, l: 20 } }}
          onIntroDone={() => {
            timer.current = setTimeout(() => pick((i + 1) % plans.length), HOLD);
          }}
          className="hero-stage"
        />
        <div className="hero-cap">
          <AnimatePresence mode="wait">
            <motion.div key={i} className="hero-cap-text" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.35 }}>
              <b>{plan.spec.name}</b>
              <span>
                {plan.spec.variant}, {plan.steps.length} steps
              </span>
            </motion.div>
          </AnimatePresence>
          <Link href={`/build/${SHOW[i]}`} className="hero-go">
            Build this <IArrowRight size={16} />
          </Link>
        </div>
      </div>
      <div className="hero-tabs" role="tablist" aria-label="Pick a product to watch">
        {plans.map((p, k) => (
          <button key={SHOW[k]} role="tab" aria-selected={k === i} className={"hero-tab" + (k === i ? " on" : "")} onClick={() => pick(k)}>
            {p.spec.name}
            {k === i && <motion.i layoutId="hero-tab" className="hero-tab-bg" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
          </button>
        ))}
      </div>
    </div>
  );
}
