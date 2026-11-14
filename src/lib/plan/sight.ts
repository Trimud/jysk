import type { HwItem, PartItem, Plan, Vec3 } from "../types";
import { POSE_EULER, rotate, unrotate } from "./math";

/** The step view's camera, before a step's own `turn`: round from the front (az) and up (el), in radians. */
export const STEP_CAM = { az: 0.62, el: 0.46 };

/**
 * How many of step `s`'s new fittings go into faces turned towards the camera it opens with: when it is under half, the
 * manual draws the step from the other side and the step needs a `turn`. A dowel counts as seen: it stands half out of
 * its hole. ponytail: faces only, not what stands in front of them (a fitting behind a divider counts as seen).
 */
export function stepSight(plan: Plan, s: number) {
  const step = plan.steps[s];
  const az = STEP_CAM.az + (step.turn ?? 0), el = step.el ?? STEP_CAM.el;
  const toCam = unrotate([Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)], POSE_EULER[step.pose]);
  const parts = new Map(plan.items.filter((i): i is PartItem => i.kind === "part").map((p) => [p.key, p]));
  const kind = new Map(plan.hardware.map((h) => [h.id, h.kind]));
  // which way it goes in, in the root's frame, with its part where it sits in this step
  const dirOf = (h: HwItem): Vec3 => {
    const st = h.parent ? parts.get(h.parent)?.states.filter((x) => x.step <= s).at(-1) : undefined;
    return st ? rotate(h.dir, st.rot) : h.dir;
  };
  const fresh = plan.items.filter((i): i is HwItem => i.kind === "hw" && i.step === s && !i.preset);
  const seen = fresh.filter((h) => {
    const d = dirOf(h), n = Math.hypot(...d) || 1;
    return (d[0] * toCam[0] + d[1] * toCam[1] + d[2] * toCam[2]) / n < 0.05 || kind.get(h.ref) === "dowel";
  });
  return { seen: seen.length, total: fresh.length };
}
