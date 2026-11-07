"use client";

import { useEffect } from "react";
import { catalogSpec } from "@/lib/catalog";
import { buildPlan } from "@/lib/plan";
import { specForKind } from "@/lib/search";
import type { Kind } from "@/lib/products";
import type { Stage, StageMode } from "@/engine/stage";
import { shot, type Look } from "@/engine/thumbs";
import type { Plan } from "@/lib/types";
import { familyOf } from "@/lib/plan/families/family";

declare global {
  interface Window {
    __draw?: (o: { slug?: string; kind?: Kind; mode?: StageMode; look?: Look; w: number; h: number }) => Promise<string | null>;
    __steps?: (slug: string) => string[] | null;
    __info?: (slug: string) => { family: string; steps: number; opens: number } | null;
    __callouts?: (slug: string, w: number, h: number) => Promise<ReturnType<Stage["calloutLayout"]>[] | null>;
    __compare?: (ref: string, url: string, min: number) => Promise<{ changed: number; diff: string | null }>;
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
    // where each step's zoom circles land in a guide's live view of w x h, for scripts/qa/callouts.mjs
    let live: { stage: Stage; host: HTMLDivElement } | null = null;
    window.__callouts = async (slug, w, h) => {
      const plan = planOf(slug);
      if (!plan) return null;
      if (!live) {
        const { Stage } = await import("@/engine/stage");
        const host = document.createElement("div");
        host.style.cssText = "position:fixed;left:-10000px;top:0;pointer-events:none;";
        document.body.appendChild(host);
        live = { stage: new Stage(host, { callout: true, labels: false, loop: false }), host };
      }
      const { stage, host } = live;
      host.style.width = w + "px";
      host.style.height = h + "px";
      stage.resize(w, h);
      stage.setPlan(plan);
      return plan.steps.map((_, index) => {
        stage.setMode({ kind: "step", index }, { instant: true });
        return stage.calloutLayout();
      });
    };
    // how many pixels of two drawings differ, and when at least `min` do, the difference: changed pixels in red over a
    // faint copy of the second (scripts/qa/snapshots.mjs)
    window.__compare = async (ref, url, min) => {
      const load = (src: string) =>
        new Promise<HTMLImageElement>((r, e) => {
          const img = new Image();
          img.onload = () => r(img);
          img.onerror = e;
          img.src = src;
        });
      const [A, B] = await Promise.all([load(ref), load(url)]);
      if (A.width !== B.width || A.height !== B.height) return { changed: Infinity, diff: null };
      const c = Object.assign(document.createElement("canvas"), { width: A.width, height: A.height });
      const x = c.getContext("2d", { willReadFrequently: true })!;
      x.drawImage(A, 0, 0);
      const da = x.getImageData(0, 0, c.width, c.height).data;
      x.clearRect(0, 0, c.width, c.height);
      x.drawImage(B, 0, 0);
      const db = x.getImageData(0, 0, c.width, c.height).data;
      const out = x.createImageData(c.width, c.height);
      let n = 0;
      for (let i = 0; i < da.length; i += 4) {
        const d = Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2]), Math.abs(da[i + 3] - db[i + 3]));
        if (d > 32) {
          n++;
          out.data.set([230, 30, 30, 255], i);
        } else out.data.set([db[i], db[i + 1], db[i + 2], Math.round(db[i + 3] * 0.25)], i);
      }
      if (n < min) return { changed: n, diff: null };
      x.putImageData(out, 0, 0);
      return { changed: n, diff: c.toDataURL("image/png") };
    };
    document.body.dataset.ready = "1";
  }, []);
  return null;
}
