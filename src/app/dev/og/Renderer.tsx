"use client";

import { useEffect } from "react";
import { catalogSpec } from "@/lib/catalog";
import { buildPlan } from "@/lib/plan";
import { specForKind } from "@/lib/search";
import type { Kind } from "@/lib/products";
import type { StageMode } from "@/engine/stage";
import { shot, type Look } from "@/engine/thumbs";
import type { Plan } from "@/lib/types";
import { familyOf } from "@/lib/plan/families/family";

declare global {
  interface Window {
    __draw?: (o: { slug?: string; kind?: Kind; mode?: StageMode; look?: Look; w: number; h: number }) => Promise<string | null>;
    __steps?: (slug: string) => string[] | null;
    __info?: (slug: string) => { family: string; steps: number; opens: number } | null;
  }
}

export default function Renderer() {
  useEffect(() => {
    // one guide's views come one after another: keep its plan, so the stage doesn't rebuild the scene for each
    let last: { slug: string; plan: Plan } | null = null;
    const planOf = (slug: string) => {
      if (last?.slug !== slug) {
        const spec = catalogSpec(slug);
        if (!spec) return null;
        last = { slug, plan: buildPlan(spec) };
      }
      return last.plan;
    };
    window.__draw = async ({ slug, kind, mode, look, w, h }) => {
      const plan = slug ? planOf(slug) : kind ? buildPlan({ ...specForKind(kind, "X"), slug: "kind-" + kind }) : null;
      if (!plan) return null;
      // drawn once for the script, which saves it: not kept in the thumbnails' cache
      const s = await shot(`og:${slug ?? kind}:${JSON.stringify(mode)}:${JSON.stringify(look ?? {})}:${w}x${h}`, plan, mode ?? { kind: "assembled" }, w, h, undefined, { ...look, once: true });
      return s.url;
    };
    // the step titles, for drawing a guide step by step
    window.__steps = (slug) => {
      const spec = catalogSpec(slug);
      return spec ? buildPlan(spec).steps.map((st) => st.title) : null;
    };
    // what scripts/qa/snapshots.mjs needs to know to draw a guide
    window.__info = (slug) => {
      const plan = planOf(slug);
      return plan && { family: familyOf(plan.spec), steps: plan.steps.length, opens: plan.opens?.length ?? 0 };
    };
    document.body.dataset.ready = "1";
  }, []);
  return null;
}
